// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from '@aws-cdk/core';
import {RemovalPolicy} from '@aws-cdk/core';
import {StackConstants} from "./util/constants";
import {BlockPublicAccess, BucketEncryption} from "@aws-cdk/aws-s3";
import {Effect, ManagedPolicy, ServicePrincipal} from "@aws-cdk/aws-iam";
import * as path from "path";
import codeCommit = require('@aws-cdk/aws-codecommit');
import s3 = require("@aws-cdk/aws-s3");
import iam = require("@aws-cdk/aws-iam");
import lambda = require('@aws-cdk/aws-lambda');
import codePipeline = require("@aws-cdk/aws-codepipeline");
import codePipelineActions = require("@aws-cdk/aws-codepipeline-actions");

export class SetupBuilderAccountStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // CodeCommit repository for storing the policies
        const scpRepo = new codeCommit.Repository(this, "scpRepo", {
            repositoryName: StackConstants.scpRepoName,
            description: StackConstants.scpRepoDesc
        });

        // S3 bucket for storing the policies
        const scpBucket = new s3.Bucket(this, "scpBucket", {
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.RETAIN
        });

        // S3 bucket for storing the code pipeline artifacts
        const scpArtifactsBucket = new s3.Bucket(this, "scpArtifactsBucket", {
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.RETAIN
        });

        // IAM role to create or attach SCP using custom lambda function
        const customLambdaServiceRole = new iam.Role(this, "customLambdaServiceRole", {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com')
        });

        const inlinePolicyForLambda = new iam.PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "sts:AssumeRole",
                "s3:List*",
                "s3:Get*",
                "codepipeline:GetJobDetails",
                "codepipeline:PutJobSuccessResult",
                "codepipeline:PutJobFailureResult"
            ],
            resources: ["*"]
        });

        customLambdaServiceRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'))
        customLambdaServiceRole.addToPolicy(inlinePolicyForLambda);

        // Custom resource to create and attach the SCPs
        const createAttachSCPs = new lambda.Function(this, 'createAttachSCPs', {
            code: lambda.Code.fromAsset(
                path.join(__dirname, 'custom_resources'),
                {
                    exclude: ["**", "!create_and_attach_scp.py"]
                }),
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'create_and_attach_scp.handler',
            environment: {
                'DEBUG_MODE': 'true',
                'ORG_ROLE': String(process.env.ORG_MANAGEMENT_ASSUMABLE_ROLE_ARN)
            },
            role: customLambdaServiceRole,
            description: "Custom resource to create and attach the SCPs",
            memorySize: 128,
            timeout: cdk.Duration.seconds(60)
        });

        // Code pipeline role to create and attach the SCPs
        const codePipelineServiceRole = new iam.Role(this, "codePipelineServiceRole", {
            assumedBy: new ServicePrincipal('codepipeline.amazonaws.com')
        });

        const inlinePolicyForCodePipeline = new iam.PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "sts:AssumeRole",
                "codecommit:Get*",
                "codecommit:List*",
                "codecommit:GitPull",
                "codecommit:UploadArchive",
                "lambda:Get*",
                "lambda:List*",
                "lambda:InvokeFunction",
                "s3:Get*",
                "s3:List*",
                "s3:PutObject"
            ],
            resources: ["*"]
        });

        codePipelineServiceRole.addToPolicy(inlinePolicyForCodePipeline);

        // Code pipeline to create and attach the SCPs
        const scpSourceOutput = new codePipeline.Artifact();

        const pipeline = new codePipeline.Pipeline(this, "scpPipeline", {
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
                            actionName: "createSCPs",
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
                            actionName: "attachSCPs",
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
        new cdk.CfnOutput(this, 'scpRepoCloneUrlGrc', {
            value: scpRepo.repositoryCloneUrlGrc,
            exportName: 'scpRepoCloneUrlGrc'
        });

    }
}

