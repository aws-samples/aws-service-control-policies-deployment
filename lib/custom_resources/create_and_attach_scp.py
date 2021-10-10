# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import logging
import os
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

# Configure logging
LOGGER = logging.getLogger(__name__)
DEBUG_MODE = os.getenv('DEBUG_MODE', 'true')
if DEBUG_MODE == 'true':
    LOGGER.setLevel(logging.DEBUG)
else:
    LOGGER.setLevel(logging.INFO)

# Instantiate the boto3
s3_resource = boto3.resource('s3')
sts_client = boto3.client('sts')
pipeline_client = boto3.client('codepipeline')


# Get the ORG role
def get_org_role():
    """
    :return: The ORG role to be assumed in the master org for SCP create/ update
    """
    org_role = os.getenv('ORG_ROLE')
    LOGGER.info("SCP Org role : {}".format(org_role))
    return org_role


# Lambda Handler
def handler(event, context):
    LOGGER.info("Received event: " + json.dumps(event, indent=2))

    job_id = get_job_id(event)

    # Initialize status
    status = "FAILED"

    try:
        action_name = get_action_name(job_id)
        LOGGER.info("Action name - {}".format(action_name))

        if action_name == 'createSCPs':
            create_policies(event)
        elif action_name == 'attachSCPs':
            attach_policies(event)

        status = "SUCCESS"

        """Setting the job status success"""
        pipeline_client.put_job_success_result(
            jobId=job_id
        )
    except BaseException as ex:
        LOGGER.exception(ex)

        """Setting the job status failure"""
        pipeline_client.put_job_failure_result(
            jobId=job_id,
            failureDetails={
                'type': 'JobFailed',
                'message': str(ex)
            }
        )
    finally:
        response_body = {
            'Status': status,
            'Event': event,
            'Reason': 'See the details in CloudWatch Log Stream: ' + context.log_stream_name
        }
        LOGGER.info(json.dumps(response_body, indent=2))


# Get the policy from the S3 bucket
def get_policy(s3_bucket, key):
    """

    :param s3_bucket: S3 bucket name
    :param key: object to be fetched
    :return: Object content
    """
    policy_file = s3_resource.Object(s3_bucket, key)
    return policy_file.get()['Body'].read().decode('utf-8')


# Assume the role for adding the policy and attaching to the target
def assume_role(arn, session_name):
    """

    :param arn: ORG role to be assumed
    :param session_name: Session name
    :return: session object for the role
    """
    response = sts_client.assume_role(RoleArn=arn, RoleSessionName=session_name)
    session = boto3.Session(aws_access_key_id=response['Credentials']['AccessKeyId'],
                            aws_secret_access_key=response['Credentials']['SecretAccessKey'],
                            aws_session_token=response['Credentials']['SessionToken'])
    return session


def get_dict_from_key(s3_bucket: str, key: str) -> dict:
    """

    :param s3_bucket: S3 bucket name
    :param key: Key of the object
    :return: Dictionary of the S3 object contents
    """
    content = s3_resource.Object(s3_bucket, key).get()['Body'].read().decode('utf-8')
    data = json.loads(content)
    return data


def get_current_policies(org_client):
    """

    :param org_client: Organization client with the assumed role into the master
    :return: Map of current policies {[Name]:[Id]}
    """
    current_policies = {}
    p_response_ = org_client.list_policies(Filter='SERVICE_CONTROL_POLICY')
    for policy in p_response_['Policies']:
        current_policies[policy['Name']] = policy['Id']

    if 'NextToken' in p_response_:
        token_ = p_response_['NextToken']
        LOGGER.info("Next token is {}".format(token_))

        while token_ is not None:
            try:
                paginated_response_ = org_client.list_policies(Filter='SERVICE_CONTROL_POLICY', NextToken=token_)
                for policy in paginated_response_['Policies']:
                    current_policies[policy['Name']] = policy['Id']

                if 'NextToken' in paginated_response_:
                    token_ = paginated_response_['NextToken']
                else:
                    token_ = None
            except BaseException as e:
                LOGGER.error(e)
                raise BaseException("Failed the listing of the policies")

    return current_policies


def get_job_id(event):
    return event['CodePipeline.job']['id']


def get_user_params(event) -> dict:
    json_string = event['CodePipeline.job']['data']['actionConfiguration']['configuration']['UserParameters']
    return json.loads(json_string)


def get_s3_bucket_name(event):
    param = get_user_params(event)
    return param['BucketName']


def get_action_name(job_id):
    response = pipeline_client.get_job_details(jobId=job_id)
    return response['jobDetails']['data']['pipelineContext']['action']['name']


def create_or_attach_scps(org_session, bucket_name, attach_scp=False):
    LOGGER.info("Bucket name : {}".format(bucket_name))

    dir_root = "scp/"
    metadata_key = "".join([dir_root, "metadata.json"])
    metadata = get_dict_from_key(bucket_name, metadata_key)

    # Extract the OU metadata
    ou_list = metadata['ou-ids']

    for ou in ou_list:
        ou_id = ou['id']
        dir_name = ou['dir_name']
        scp_list = ou['scps']

        for file_name in scp_list:
            scp_key = "".join([dir_root, dir_name, "/", file_name])
            scp_name = Path(file_name).resolve().stem.title()
            ou_name = dir_name.title()

            policy_name = "{}-{}".format(scp_name, ou_name)
            policy_desc = "{} SCP for {}".format(scp_name, ou_name)
            policy_body = get_policy(bucket_name, scp_key)

            """Fetch all the policies"""
            current_policies = get_current_policies(org_session)

            if attach_scp is False:
                """Check if policy with the same name exists - Update the policy ELSE create policy"""
                policy_names = list(current_policies.keys())

                if policy_name in policy_names:
                    org_session.update_policy(
                        PolicyId=current_policies[policy_name],
                        Name=policy_name,
                        Description=policy_desc,
                        Content=policy_body
                    )
                else:
                    new_policy_response = org_session.create_policy(
                        Name=policy_name,
                        Description=policy_desc,
                        Content=policy_body,
                        Type="SERVICE_CONTROL_POLICY"
                    )

                    """Add to the current policies"""
                    new_policy_id_ = new_policy_response['Policy']['PolicySummary']['Id']
                    current_policies[policy_name] = new_policy_id_

            if attach_scp is True:
                LOGGER.info("Within the delivery of the SCPs - Attach to the OU")

                try:
                    org_session.attach_policy(
                        PolicyId=current_policies[policy_name],
                        TargetId=ou_id
                    )
                except ClientError as ce:
                    code_ = ce.response['Error']['Code']
                    message_ = ce.response['Error']['Message']
                    if code_ == "DuplicatePolicyAttachmentException" or code_ == "ConstraintViolationException":
                        LOGGER.info(message_)
                        LOGGER.info("Skipping the exception since the policy is existing or can't be attached")
                    else:
                        raise BaseException(ce)


# Create the policies
def create_policies(event):
    LOGGER.info("Invoking the CreateSCPs")

    # Get the S3 bucket
    s3_bucket = get_s3_bucket_name(event)

    # Get the ORG role
    org_role = get_org_role()

    # Assume role using the ORG role for editing the SCPs
    setup = assume_role(org_role, "CreateSCPs")
    org_client = setup.client('organizations')

    create_or_attach_scps(org_session=org_client, bucket_name=s3_bucket)


# Attach policies to OUs
def attach_policies(event):
    LOGGER.info("Invoking the AttachSCPs")

    # Get the S3 bucket
    s3_bucket = get_s3_bucket_name(event)

    # Get the ORG role
    org_role = get_org_role()

    # Assume role using the ORG role for editing the SCPs
    setup = assume_role(org_role, "AttachSCPs")
    org_client = setup.client('organizations')

    create_or_attach_scps(org_session=org_client, bucket_name=s3_bucket, attach_scp=True)
