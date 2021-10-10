#!/usr/bin/env node

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {SetupOrgManagementStack} from '../lib/setup-org-management-stack';
import {SetupMemberAccountStack} from "../lib/setup-member-account-stack";
import {SetupBuilderAccountStack} from "../lib/setup-builder-account-stack";

const app = new cdk.App();
new SetupOrgManagementStack(app, 'SetupOrgManagementStack', {
    description: 'Setup org management account resources for SCP deployment'
});
new SetupBuilderAccountStack(app, 'SetupBuilderAccountStack', {
    description: 'Setup builder account resources for SCP deployment'
});
new SetupMemberAccountStack(app, 'SetupMemberAccountStack', {
    description: 'Setup test account resources for SCP deployment'
});
