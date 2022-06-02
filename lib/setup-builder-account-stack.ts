// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {CfnOutput, Duration, RemovalPolicy, Stack, StackProps} from 'aws-cdk-lib';
import {StackConstants} from './util/constants';
import * as  s3 from 'aws-cdk-lib/aws-s3';
import {BlockPublicAccess, BucketEncryption} from 'aws-cdk-lib/aws-s3';
import * as  iam from 'aws-cdk-lib/aws-iam';
import {Effect, ManagedPolicy, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as codeCommit from 'aws-cdk-lib/aws-codecommit'
import * as  lambda from 'aws-cdk-lib/aws-lambda'
import * as  codePipeline from 'aws-cdk-lib/aws-codepipeline'
import * as  codePipelineActions from 'aws-cdk-lib/aws-codepipeline-actions'
import {Construct} from 'constructs';

export class SetupBuilderAccountStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // CodeCommit repository for storing the policies
        const scpRepo = new codeCommit.Repository(this, 'scpRepo', {
            repositoryName: StackConstants.scpRepoName,
            description: StackConstants.scpRepoDesc
        });

        // S3 bucket for storing the policies
        const scpBucket = new s3.Bucket(this, 'scpBucket', {
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.RETAIN
        });

        // S3 bucket for storing the code pipeline artifacts
        const scpArtifactsBucket = new s3.Bucket(this, 'scpArtifactsBucket', {
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.RETAIN
        });

        // IAM role to create or attach SCP using custom lambda function
        const customLambdaServiceRole = new iam.Role(this, 'customLambdaServiceRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com')
        });

        const inlinePolicyForLambda = new iam.PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                'sts:AssumeRole',
                's3:List*',
                's3:Get*',
                'codepipeline:GetJobDetails',
                'codepipeline:PutJobSuccessResult',
                'codepipeline:PutJobFailureResult'
            ],
            resources: ['*']
        });

        customLambdaServiceRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'))
        customLambdaServiceRole.addToPolicy(inlinePolicyForLambda);

        // Custom resource to create and attach the SCPs
        const createAttachSCPs = new lambda.Function(this, 'createAttachSCPs', {
            code: lambda.Code.fromAsset(
                path.join(__dirname, 'custom_resources'),
                {
                    exclude: ['**', '!create_and_attach_scp.py']
                }),
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'create_and_attach_scp.handler',
            environment: {
                'DEBUG_MODE': 'true',
                'ORG_ROLE': String(process.env.ORG_MANAGEMENT_ASSUMABLE_ROLE_ARN)
            },
            role: customLambdaServiceRole,
            description: 'Custom resource to create and attach the SCPs',
            memorySize: 128,
            timeout: Duration.seconds(60)
        });

        // Code pipeline role to create and attach the SCPs
        const codePipelineServiceRole = new iam.Role(this, 'codePipelineServiceRole', {
            assumedBy: new ServicePrincipal('codepipeline.amazonaws.com')
        });

        const inlinePolicyForCodePipeline = new iam.PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                'sts:AssumeRole',
                'codecommit:Get*',
                'codecommit:List*',
                'codecommit:GitPull',
                'codecommit:UploadArchive',
                'lambda:Get*',
                'lambda:List*',
                'lambda:InvokeFunction',
                's3:Get*',
                's3:List*',
                's3:PutObject'
            ],
            resources: ['*']
        });

        codePipelineServiceRole.addToPolicy(inlinePolicyForCodePipeline);

        // Code pipeline to create and attach the SCPs
        const scpSourceOutput = new codePipeline.Artifact();

        new codePipeline.Pipeline(this, 'scpPipeline', {
            role: codePipelineServiceRole,
            artifactBucket: scpArtifactsBucket,
            stages: [
                {
                    stageName: 'Source',
                    actions: [
                        new codePipelineActions.CodeCommitSourceAction({
                            actionName: 'scpSource',
                            repository: scpRepo,
                            output: scpSourceOutput,
                            branch: 'main'
                        }),
                    ]
                },
                {
                    stageName: 'Setup',
                    actions: [
                        new codePipelineActions.S3DeployAction({
                            actionName: 'copySCPs',
                            input: scpSourceOutput,
                            bucket: scpBucket,
                            extract: true
                        })
                    ]
                },
                {
                    stageName: 'CreateSCPs',
                    actions: [
                        new codePipelineActions.LambdaInvokeAction({
                            actionName: 'createSCPs',
                            lambda: createAttachSCPs,
                            userParameters: {
                                BucketName: scpBucket.bucketName
                            }
                        })
                    ]
                },
                {
                    stageName: 'AttachSCPs',
                    actions: [
                        new codePipelineActions.LambdaInvokeAction({
                            actionName: 'attachSCPs',
                            lambda: createAttachSCPs,
                            userParameters: {
                                BucketName: scpBucket.bucketName
                            }
                        })
                    ]
                }
            ]
        });

        // CodeCommit repository to be used
        new CfnOutput(this, 'scpRepoCloneUrlGrc', {
            value: scpRepo.repositoryCloneUrlGrc,
            exportName: 'scpRepoCloneUrlGrc'
        });

    }
}

