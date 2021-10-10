# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

Feature: Verify AppMesh actions

  Scenario Outline: Check if the AppMesh actions are denied
    Given I invoke <service>:<action>
    When the region selected is <region>
    Then the status should be <result>

    Examples:
      | service | action       | region    | result |
      | appmesh | ListMeshes   | eu-west-2 | denied |
      | appmesh | DescribeMesh | eu-west-2 | denied |
      | appmesh | CreateMesh   | eu-west-2 | denied |