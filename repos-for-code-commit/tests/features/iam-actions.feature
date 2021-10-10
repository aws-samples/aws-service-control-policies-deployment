# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

Feature: Verify IAM actions

  Scenario Outline: Check if the IAM actions are allowed
    Given I invoke <service>:<action>
    When the region selected is <region>
    Then the status should be <result>

    Examples:
      | service | action                        | region    | result  |
      | iam     | ListPolicies                  | eu-west-2 | allowed |
      | iam     | GetPolicy                     | eu-west-2 | allowed |
      | iam     | TagRole                       | eu-west-2 | allowed |
      | iam     | DeleteRole                    | eu-west-2 | allowed |
      | iam     | DeleteRolePermissionsBoundary | eu-west-2 | allowed |