# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

Feature: Verify Lambda actions

  Scenario Outline: Check if the Lambda actions are allowed
    Given I invoke <service>:<action>
    When the region selected is <region>
    Then the status should be <result>

    Examples:
      | service | action                   | region    | result  |
      | lambda  | ListFunctions            | eu-west-2 | allowed |
      | lambda  | DeleteLayerVersion       | eu-west-2 | allowed |
      | lambda  | GetFunctionConfiguration | eu-west-2 | allowed |
      | lambda  | EnableReplication        | eu-west-2 | allowed |