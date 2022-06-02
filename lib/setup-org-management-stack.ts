// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as iam from 'aws-cdk-lib/aws-iam';
import {AccountPrincipal, Effect} from 'aws-cdk-lib/aws-iam';
import {CfnOutput, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';

export class SetupOrgManagementStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        /**
         * Create an IAM role which can be assumed by your AWS account responsible for deploying the policies
         */
        const orgManagementAssumableRole = new iam.Role(this, 'orgManagementAssumableRole', {
            assumedBy: new AccountPrincipal(process.env.BUILDER_AWS_ACCOUNT_ID)
        });

        const orgPermissions = new iam.PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                'sts:AssumeRole',
                'organizations:ListAccounts',
                'organizations:ListParents',
                'organizations:ListPoliciesForTarget',
                'organizations:ListPolicies',
                'organizations:DescribePolicy',
                'organizations:CreatePolicy',
                'organizations:AttachPolicy',
                'organizations:UpdatePolicy',
                'organizations:DetachPolicy',
                'organizations:DeletePolicy',
                'organizations:MoveAccount'
            ],
            resources: ['*']
        });

        orgManagementAssumableRole.addToPolicy(orgPermissions);

        // Role ARN to be used
        new CfnOutput(this, 'orgManagementAssumableRoleArn', {
            value: orgManagementAssumableRole.roleArn,
            exportName: 'orgManagementAssumableRoleArn'
        });

    }
}
