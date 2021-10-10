// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from '@aws-cdk/core';
import {SynthUtils} from "@aws-cdk/assert";
import managementStack = require('../lib/setup-org-management-stack');
import builderStack = require('../lib/setup-builder-account-stack');
import memberStack = require('../lib/setup-member-account-stack');

test('Assumable role created in OrgManagement', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new managementStack.SetupOrgManagementStack(app, 'SetupOrgManagementStack');
    // THEN
    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('SCPs for the OUs created and attached in Builder', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new builderStack.SetupBuilderAccountStack(app, 'SetupBuilderAccountStack');
    // THEN
    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('Behave acceptance tests to verify the SCPs from the member account', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new memberStack.SetupMemberAccountStack(app, 'SetupMemberAccountStack');
    // THEN
    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
