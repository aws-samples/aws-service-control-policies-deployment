# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

Feature: Verify EC2 actions

  Scenario Outline: Check if the EC2 actions are allowed
    Given I invoke <service>:<action>
    When the region selected is <region>
    Then the status should be <result>

    Examples:
      | service | action                           | region    | result  |
      | ec2     | DescribeInstances                | eu-west-2 | allowed |
      | ec2     | CreateNetworkInterfacePermission | eu-west-2 | allowed |
      | ec2     | DescribeVpnConnections           | eu-west-2 | allowed |
      | ec2     | CreateTags                       | eu-west-2 | allowed |
      | ec2     | CreateVpnConnection              | eu-west-2 | allowed |