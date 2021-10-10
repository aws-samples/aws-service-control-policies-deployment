# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

Feature: Verify AppStream actions

  Scenario Outline: Check if the AppStream actions are denied
    Given I invoke <service>:<action>
    When the region selected is <region>
    Then the status should be <result>

    Examples:
      | service   | action                   | region    | result |
      | appstream | DescribeDirectoryConfigs | eu-west-2 | denied |
      | appstream | AssociateFleet           | eu-west-2 | denied |
      | appstream | TagResource              | eu-west-2 | denied |