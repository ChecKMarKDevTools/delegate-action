# delegate-action

[![GitHub Repo Stars](https://img.shields.io/github/stars/ChecKMarKDevTools/delegate-action?style=for-the-badge&color=F0544B&cacheSeconds=3600)](https://github.com/ChecKMarKDevTools/delegate-action/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/ChecKMarKDevTools/delegate-action?style=for-the-badge&color=34A853&cacheSeconds=3600)](https://github.com/ChecKMarKDevTools/delegate-action/issues)
[![GitHub Release](https://img.shields.io/github/v/release/ChecKMarKDevTools/delegate-action?style=for-the-badge&color=EDC531)](https://github.com/ChecKMarKDevTools/delegate-action/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-orange?style=for-the-badge)](LICENSE)
[![Sonar Quality Gate](https://img.shields.io/sonar/alert_status/ChecKMarKDevTools_delegate-action?server=https%3A%2F%2Fsonarcloud.io&style=for-the-badge&logo=sonarcloud)](https://sonarcloud.io/summary/new_code?id=ChecKMarKDevTools_delegate-action)
[![Bugs](https://img.shields.io/sonar/bugs/ChecKMarKDevTools_delegate-action?color=brightgreen&server=https%3A%2F%2Fsonarcloud.io&style=for-the-badge&logo=sonarcloud)](https://sonarcloud.io/summary/new_code?id=ChecKMarKDevTools_delegate-action)
[![Code Smells](https://img.shields.io/sonar/code_smells/ChecKMarKDevTools_delegate-action?server=https%3A%2F%2Fsonarcloud.io&style=for-the-badge&logo=sonarcloud)](https://sonarcloud.io/summary/new_code?id=ChecKMarKDevTools_delegate-action)

> **Turns prompts into PRs. Delegates to Copilot. Refuses to auto-merge. The coding-agent workflow, but with adult supervision.**

Look, we all know the dream: write a prompt, get a PR, merge it, ship it. But in reality? You probably want a human to glance at the code before it goes to prod. That's what this action does — it uses GitHub Copilot CLI to generate changes, opens a PR, assigns you as the reviewer, and then gets out of the way.

No auto-merging. No surprises. Just automation with a safety net.

![ChecKMarK Delegate social banner](./assets/checkmark-delegate-action-resized.png)

---

## 🎯 Features

- **AI-Powered Code Generation**: Uses the new `@github/copilot` npm package (not the deprecated `gh copilot` extension)
- **Secure by Default**: Real input validation with `sanitize-filename` and `validator` (no homemade regex disasters)
- **Real Logging**: Structured JSON logs via `pino` (because `console.log` is for debugging, not production)
- **Pre-commit Hooks**: Lefthook runs format → lint → test before every commit (you can thank me later)
- **Responsible AI Compliance**: Enforces RAI attribution in commits via `@checkmarkdevtools/commitlint-plugin-rai`
- **Security Scanning**: CodeQL + Gitleaks on every push (catching secrets before they become incidents)
- **Quality Gate**: CI won't pass unless format, lint, build, and test all succeed
- **Automated PRs**: Creates a branch, commits changes, opens a PR, and assigns the workflow actor
- **Production-Ready**: Concurrency control, permissions scoping, and timeouts built-in

---

## 🚀 Quick Start

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

      - uses: ChecKMarKDevTools/delegate-action@v0
        with:
          PRIVATE_TOKEN: ${{ secrets.GH_PAT }}
          filename: ${{ github.event.inputs.filename }}
          branch: ${{ github.event.inputs.branch }}
```

---

## 📋 Inputs

| Input           | Description                                    | Required | Default |
| --------------- | ---------------------------------------------- | -------- | ------- |
| `PRIVATE_TOKEN` | Personal Access Token for GitHub Copilot CLI   | Yes      | -       |
| `filename`      | Optional filename in the repository to process | No       | `''`    |
| `branch`        | Target branch to base changes on               | No       | `main`  |

---

## 📤 Outputs

| Output      | Description                                   |
| ----------- | --------------------------------------------- |
| `pr_number` | The number of the created pull request        |
| `branch`    | The name of the branch containing the changes |

---

## 🔄 How It Works

1. **Validate File**: Uses `sanitize-filename` and `validator` to ensure input safety (no path traversal, no funny business)
2. **Run Copilot**: Executes `@github/copilot` npm package with instructions
3. **Create Branch**: Generates a timestamped branch (e.g., `copilot/delegate-2026-01-17T05-30-00-000Z`)
4. **Commit & Push**: Commits changes with a Conventional Commit message
5. **Review & Docs**: Runs Copilot again for review, documentation, and test suggestions
6. **Create PR**: Opens a pull request with a clear description
7. **Assign Actor**: Assigns the PR to the workflow actor (you)

Then you review, approve, and merge. Or don't. That's the point.

---

## 🛠️ Development

### Prerequisites

- **Node.js**: v22+ (managed via Volta)
- **npm**: v10+

### Setup

```bash
npm install
```

This will:

- Install all dependencies
- Set up Lefthook pre-commit hooks (format → lint → test)
- Configure Volta to pin Node.js 22.13.1

### Build

```bash
npm run build
```

Compiles the action into `dist/` using `@vercel/ncc`. The `dist/` folder is committed to the repo because GitHub Actions requires it.

### Lint

```bash
npm run lint
```

Runs ESLint with the flat config (`eslint.config.mjs`). Targets ECMAScript 2024 (Node.js 22 LTS).

### Format

```bash
npm run format       # Auto-fix
npm run format:check # Check only
```

Uses Prettier to enforce consistent code style.

### Test

```bash
npm test
```

Currently just a placeholder. Add real tests, you coward.

---

## 🔐 Security

This action takes security seriously:

- **Input Validation**: All filenames are sanitized with `sanitize-filename` and validated with `validator`
- **Path Traversal Protection**: Absolute paths and `..` sequences are rejected
- **File Size Limits**: Files larger than 1MB are rejected to prevent memory exhaustion
- **Secret Scanning**: Gitleaks runs on every push and PR to catch leaked credentials
- **CodeQL Analysis**: Weekly SAST scans to detect security vulnerabilities
- **Dependency Auditing**: Automated dependency updates and security advisories

See [SECURITY.md](SECURITY.md) for more details.

---

## 📚 Documentation

- **[AGENTS.md](AGENTS.md)**: Detailed breakdown of all CI/CD agents (security, quality, release)
- **[CONTRIBUTING.md](CONTRIBUTING.md)**: How to contribute (spoiler: follow Conventional Commits or get rejected)
- **[SECURITY.md](SECURITY.md)**: Security policy and vulnerability reporting

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Follow [Conventional Commits](https://www.conventionalcommits.org/)
4. Include RAI attribution in your commits (enforced by `@checkmarkdevtools/commitlint-plugin-rai`)
5. Pre-commit hooks will run format → lint → test
6. Push your branch and open a PR

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 💡 Why This Exists

Because sometimes you want AI to write code for you, but you're not quite ready to let it deploy to production unsupervised. This action is the middle ground: automation without the anxiety.

If you want full autonomy, there are other tools for that. This one is for the rest of us who still like to know what's going into `main`.

---

## 🔗 Links

- [GitHub Repository](https://github.com/ChecKMarKDevTools/delegate-action)
- [Issue Tracker](https://github.com/ChecKMarKDevTools/delegate-action/issues)
- [SonarCloud Dashboard](https://sonarcloud.io/project/overview?id=ChecKMarKDevTools_delegate-action)
- [Release Notes](https://github.com/ChecKMarKDevTools/delegate-action/releases)

---

**Built with questionable life choices and excessive caffeine by Verdent AI.**
