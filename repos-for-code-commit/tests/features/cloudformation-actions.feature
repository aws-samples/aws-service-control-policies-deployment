# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

Feature: Verify CloudFormation actions

  Scenario Outline: Check if the CloudFormation actions are allowed
    Given I invoke <service>:<action>
    When the region selected is <region>
    Then the status should be <result>

    Examples:
      | service        | action                | region    | result  |
      | cloudformation | SetStackPolicy        | eu-west-2 | allowed |
      | cloudformation | TagResource           | eu-west-2 | allowed |
      | cloudformation | DescribeAccountLimits | eu-west-2 | allowed |
      | cloudformation | CreateChangeSet       | eu-west-2 | allowed |
      | cloudformation | DescribeStacks        | eu-west-2 | allowed |