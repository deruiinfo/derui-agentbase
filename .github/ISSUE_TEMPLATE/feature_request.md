name: Feature request
description: Suggest an idea or enhancement
title: "[Feature]: "
labels: ["enhancement", "triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for the suggestion! Note this project is intentionally scoped:
        open-core with a single-tenant, on-prem focus. See `docs/roadmap.md`.
  - type: textarea
    id: problem
    attributes:
      label: Problem / use case
      description: What problem are you trying to solve? Who is it for?
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: Proposed solution
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
    validations:
      required: false
  - type: dropdown
    id: scope
    attributes:
      label: Area
      options:
        - auth / accounts / MFA / SSO
        - RBAC / field-level / RLS / audit
        - Agent Kit (generator / MCP / self-check)
        - frontend UI
        - deployment / ops
        - docs
        - other
    validations:
      required: false
