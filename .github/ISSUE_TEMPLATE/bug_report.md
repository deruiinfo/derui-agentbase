name: Bug report
description: Report a reproducible bug or unexpected behavior
title: "[Bug]: "
labels: ["bug", "triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to file a bug. Please do **not** report
        security vulnerabilities here — see [SECURITY.md](../SECURITY.md).
  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: A clear and concise description of the bug.
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      placeholder: |
        1. ...
        2. ...
        3. ...
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: Version / commit
      description: Release tag, or commit SHA if running from source.
      placeholder: v0.1.0
    validations:
      required: true
  - type: dropdown
    id: component
    attributes:
      label: Component
      options:
        - api (backend)
        - web (frontend)
        - db / RLS / migrations
        - cli (create-derui-admin)
        - tools (generator / MCP)
        - deploy (docker / scripts)
        - docs
        - other
    validations:
      required: true
  - type: input
    id: environment
    attributes:
      label: Environment
      description: OS, Node version, PostgreSQL version, how it was run (Docker / local).
      placeholder: "Ubuntu 22.04, Node 20, PostgreSQL 16, docker compose"
    validations:
      required: false
  - type: textarea
    id: logs
    attributes:
      label: Relevant logs / output
      description: Paste any relevant logs. Remove secrets first.
      render: shell
    validations:
      required: false
