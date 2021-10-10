# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import logging

import boto3

# IAM client
client = boto3.client('iam')


# Pretty print the JSON
def print_json(obj):
    return json.dumps(obj, sort_keys=True, indent=4, default=str)


# Simulate policy AWS API invocation
def simulate_policy(context, _action_name):
    try:
        _source_arn = get_source_arn(context)
        logging.info('Simulating the policy: Arn: {} ActionName: {}'.format(_source_arn, _action_name))
        _response = client.simulate_principal_policy(PolicySourceArn=_source_arn, ActionNames=_action_name)
    except Exception as e:
        raise Exception('Unable to simulate the policy, {}'.format(e))

    logging.info('Response from simulation: {}'.format(print_json(_response)))

    return _response


# Extract the source ARN
def get_source_arn(context):
    logging.info('Fetching the source arn')
    _source_arn = context.config.userdata['policy_source_arn']
    return _source_arn
