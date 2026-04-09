# CI/CD Rules

## Purpose

Ensure all code changes are automatically validated, tested, and safe before reaching production.

The agent must treat CI/CD as a gatekeeper, not a suggestion.

---

## Core Principles

- Every change should be verifiable
- Builds must pass before merging
- Automation is preferred over manual steps

---

## Minimum Requirements

The agent should ensure the project supports:

1. Build validation
2. Linting (code quality checks)
3. Basic test execution (if tests exist)

---

## Pipeline Expectations

When CI/CD is present:

- Do NOT merge code if pipeline fails
- Investigate and fix issues before proceeding
- Do NOT bypass checks unless explicitly instructed

---

## If CI/CD Does NOT Exist

The agent should recommend adding:

- GitHub Actions workflow
- Basic build + lint step
- Test execution step (if applicable)

---

## Example GitHub Actions Workflow

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm run build
      - run: npm run lint
```

---

## Deployment Rules

- Never deploy untested code
- Prefer automated deployments over manual ones
- Keep environments separated: dev, staging, production

---

## Agent Behavior

The agent should:

- Suggest CI/CD if it is missing
- Update pipelines when new tools are introduced
- Keep pipelines simple and maintainable

---

## Hard Stops

Refuse to:

- Merge code with failing checks
- Skip validation steps without justification
- Deploy directly from unreviewed branches
