# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import logging
import os

from behave import *

from policy_simulator import simulate_policy

logging.basicConfig(level=logging.INFO)


@given('I invoke {service}:{action}')
def step_impl(context, service, action):
    logging.info('Service name : {}'.format(service))
    logging.info('Action name : {}'.format(action))
    context.action_name = ''.join([service, ':', action])


@when('the region selected is {region}')
def step_impl(context, region):
    logging.info('Region name : {}'.format(region))
    os.environ['AWS_DEFAULT_REGION'] = region


@then('the status should be {result}')
def step_impl(context, result):
    response = simulate_policy(context, [context.action_name])
    eval_decision = response['EvaluationResults'][0]['EvalDecision']
    allowed_by_organisation = response['EvaluationResults'][0]['OrganizationsDecisionDetail']['AllowedByOrganizations']

    logging.info('Eval decision = {}'.format(eval_decision))
    logging.info('Organisation decision = {}'.format(allowed_by_organisation))
    logging.info('Expected outcome = {}'.format(result))

    if eval_decision in ['explicitDeny', 'implicitDeny']:
        eval_decision = 'denied'
        assert eval_decision == result
        assert allowed_by_organisation is False
    elif eval_decision == 'allowed':
        assert eval_decision == result
        assert allowed_by_organisation is True
