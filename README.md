# delegate-action

[![CI](https://github.com/ChecKMarKDevTools/delegate-action/workflows/CI/badge.svg)](https://github.com/ChecKMarKDevTools/delegate-action/actions/workflows/ci.yml)
[![Release Please](https://github.com/ChecKMarKDevTools/delegate-action/workflows/Release%20Please/badge.svg)](https://github.com/ChecKMarKDevTools/delegate-action/actions/workflows/release-please.yml)
[![codecov](https://codecov.io/gh/ChecKMarKDevTools/delegate-action/branch/main/graph/badge.svg)](https://codecov.io/gh/ChecKMarKDevTools/delegate-action)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=ChecKMarKDevTools_delegate-action&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=ChecKMarKDevTools_delegate-action)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

🤖 A GitHub Action that uses Copilot CLI to delegate tasks, create PRs, and assign reviewers. Turns prompts into stacked PRs using Copilot, assigns humans to review, and refuses to auto-merge. Basically the coding-agent workflow, but cooperative and reviewable.

## Features

- 🔐 **Secure**: Sanitizes input files to prevent security issues
- 🤖 **AI-Powered**: Uses GitHub Copilot CLI for intelligent code suggestions
- 🔄 **Automated PRs**: Creates pull requests with generated changes
- 👥 **Auto-Assignment**: Automatically assigns PRs to the workflow actor
- ⚙️ **Configurable**: Supports custom filenames and branch targets
- 🚀 **Production-Ready**: Includes concurrency control, permissions, and timeouts

## Usage

```yaml
name: Delegate Task

on:
  workflow_dispatch:
    inputs:
      filename:
        description: 'Optional file to process'
        required: false
      branch:
        description: 'Target branch'
        required: false
        default: 'main'

concurrency:
  group: delegate-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write

jobs:
  delegate:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: ChecKMarKDevTools/delegate-action@v1
        with:
          PRIVATE_TOKEN: ${{ secrets.GH_PAT }}
          filename: ${{ github.event.inputs.filename }}
          branch: ${{ github.event.inputs.branch }}
```

## Inputs

| Input           | Description                                    | Required | Default |
| --------------- | ---------------------------------------------- | -------- | ------- |
| `PRIVATE_TOKEN` | Personal Access Token for GitHub Copilot CLI   | Yes      | -       |
| `filename`      | Optional filename in the repository to process | No       | `''`    |
| `branch`        | Target branch to base changes on               | No       | `main`  |

## Outputs

| Output      | Description                                   |
| ----------- | --------------------------------------------- |
| `pr_number` | The number of the created pull request        |
| `branch`    | The name of the branch containing the changes |

## Workflow Steps

The action follows these steps:

1. **Sanitize File**: Validates and sanitizes the input file (if provided)
2. **Run Copilot**: Executes Copilot CLI with base reference and instructions
3. **Create Branch**: Creates a new timestamped branch
4. **Commit & Push**: Commits changes and pushes to remote
5. **Review & Docs**: Runs Copilot for review, documentation, and tests
6. **Create PR**: Opens a pull request with the changes
7. **Assign Actor**: Assigns the PR to the workflow actor

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Format

```bash
npm run format
```

## License

MIT
