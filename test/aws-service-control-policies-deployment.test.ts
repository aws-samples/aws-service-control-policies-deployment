// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import managementStack = require('../lib/setup-org-management-stack');
import builderStack = require('../lib/setup-builder-account-stack');
import memberStack = require('../lib/setup-member-account-stack');
import {Template} from "aws-cdk-lib/assertions";
import {App} from "aws-cdk-lib";

test('Assumable role created in OrgManagement', () => {
    const app = new App();
    // WHEN
    const stack = new managementStack.SetupOrgManagementStack(app, 'SetupOrgManagementStack');
    // THEN
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::IAM::Role', 1);

});

test('SCPs for the OUs created and attached in Builder', () => {
    const app = new App();
    // WHEN
    const stack = new builderStack.SetupBuilderAccountStack(app, 'SetupBuilderAccountStack');
    // THEN
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::CodeCommit::Repository', 1);
});

test('Behave acceptance tests to verify the SCPs from the member account', () => {
    const app = new App();
    // WHEN
    const stack = new memberStack.SetupMemberAccountStack(app, 'SetupMemberAccountStack');
    // THEN
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::CodeCommit::Repository', 1);
    template.resourceCountIs('AWS::CodeBuild::Project', 1);
});
