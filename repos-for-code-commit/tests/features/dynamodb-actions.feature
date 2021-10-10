# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

Feature: Verify DynamoDB actions

  Scenario Outline: Check if the DynamoDB actions are denied
    Given I invoke <service>:<action>
    When the region selected is <region>
    Then the status should be <result>

    Examples:
      | service  | action        | region    | result |
      | dynamodb | CreateTable   | eu-west-2 | denied |
      | dynamodb | TagResource   | eu-west-2 | denied |
      | dynamodb | DescribeTable | eu-west-2 | denied |
      | dynamodb | ListTables    | eu-west-2 | denied |