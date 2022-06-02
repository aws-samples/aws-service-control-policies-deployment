// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {StackConstants} from './util/constants';
import * as iam from 'aws-cdk-lib/aws-iam';
import {AccountPrincipal, Effect, ManagedPolicy, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import * as codeBuild from 'aws-cdk-lib/aws-codebuild';
import {ComputeType} from 'aws-cdk-lib/aws-codebuild';
import * as codeCommit from 'aws-cdk-lib/aws-codecommit'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import {CfnOutput, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';


export class SetupMemberAccountStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // CodeCommit repository for storing the acceptance tests
        const acceptanceTestsRepo = new codeCommit.Repository(
            this,
            'acceptanceTestsRepo',
            {
                repositoryName: StackConstants.acceptanceTestsRepoName,
                description: StackConstants.acceptanceTestsRepoDesc
            }
        );

        // IAM role for testing the SCPs
        const policyTestRole = new iam.Role(this, 'policyTestRole', {
            assumedBy: new AccountPrincipal(this.account)
        });
        policyTestRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'))

        // IAM role for the code build project
        const codeBuildServiceRole = new iam.Role(this, 'codeBuildServiceRole', {
            assumedBy: new ServicePrincipal('codebuild.amazonaws.com')
        });

        const inlinePolicyForCodeBuild = new iam.PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                'sts:AssumeRole',
                'codecommit:Get*',
                'codecommit:List*',
                'codecommit:GitPull',
                'iam:SimulatePrincipalPolicy',
                'iam:SimulateCustomPolicy',
                'iam:GetContextKeysForPrincipalPolicy',
                'iam:GetContextKeysForCustomPolicy',
                'codebuild:CreateReportGroup',
                'codebuild:CreateReport',
                'codebuild:UpdateReport',
                'codebuild:BatchPutTestCases'
            ],
            resources: ['*']
        });

        codeBuildServiceRole.addToPolicy(inlinePolicyForCodeBuild);

        // Creating the code build project
        const acceptanceTestsProject = new codeBuild.Project(this, 'acceptanceTestsProject', {
            role: codeBuildServiceRole,
            description: StackConstants.acceptanceTestsCodeBuildDesc,
            environment: {
                buildImage: codeBuild.LinuxBuildImage.STANDARD_5_0,
                computeType: ComputeType.SMALL,
                environmentVariables: {
                    testRoleArn: {
                        value: policyTestRole.roleArn
                    }
                }
            },
            source: codeBuild.Source.codeCommit({
                repository: acceptanceTestsRepo,
                branchOrRef: 'main'
            })
        });

        // Event rule for onCommit of acceptanceTestsRepo to trigger code build
        acceptanceTestsRepo.onCommit('OnCommit', {
            branches: [
                'main'
            ],
            target: new targets.CodeBuildProject(acceptanceTestsProject),
            description: 'Execute the acceptance tests on code commit'
        });

        // CodeCommit repository to be used
        new CfnOutput(this, 'acceptanceTestsRepoCloneUrlGrc', {
            value: acceptanceTestsRepo.repositoryCloneUrlGrc,
            exportName: 'acceptanceTestsRepoCloneUrlGrc'
        });

    }
}
