// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from '@aws-cdk/core';
import {AccountPrincipal, Effect} from "@aws-cdk/aws-iam";
import iam = require("@aws-cdk/aws-iam");

export class SetupOrgManagementStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        /**
         * Create an IAM role which can be assumed by your AWS account responsible for deploying the policies
         */
        const orgManagementAssumableRole = new iam.Role(this, "orgManagementAssumableRole", {
            assumedBy: new AccountPrincipal(process.env.BUILDER_AWS_ACCOUNT_ID)
        });

        const orgPermissions = new iam.PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "sts:AssumeRole",
                "organizations:ListAccounts",
                "organizations:ListParents",
                "organizations:ListPoliciesForTarget",
                "organizations:ListPolicies",
                "organizations:DescribePolicy",
                "organizations:CreatePolicy",
                "organizations:AttachPolicy",
                "organizations:UpdatePolicy",
                "organizations:DetachPolicy",
                "organizations:DeletePolicy",
                "organizations:MoveAccount"
            ],
            resources: ["*"]
        });

        orgManagementAssumableRole.addToPolicy(orgPermissions);

        // Role ARN to be used
        new cdk.CfnOutput(this, 'orgManagementAssumableRoleArn', {
            value: orgManagementAssumableRole.roleArn,
            exportName: 'orgManagementAssumableRoleArn'
        });

    }
}
