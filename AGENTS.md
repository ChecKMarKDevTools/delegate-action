# 🤖 AI Agent Configuration

## Repository Context

**Repository Type**: GitHub Action  
**Primary Language**: JavaScript (CommonJS, Node.js 22+)  
**Build Tool**: @vercel/ncc  
**Testing**: Jest  
**Linting**: ESLint 9 (flat config)  
**Formatting**: Prettier  
**CI/CD**: GitHub Actions  
**Quality**: SonarCloud, CodeQL, Codecov  
**Pre-commit**: Lefthook

---

## 🎯 Action Purpose

GitHub Action that delegates code changes to GitHub Copilot CLI, creates feature branches, commits changes, opens PRs, and assigns them to the workflow actor. No auto-merge. Human review required.

**Key Workflow**:

1. Validate optional file input
2. Execute Copilot CLI with instructions
3. Create timestamped branch
4. Commit changes with conventional commit messages
5. Run Copilot review pass
6. Create PR with description
7. Assign PR to workflow actor

---

## 🏗️ Architecture

### Entry Point

- `src/index.js`: Main action logic
- `dist/index.js`: Compiled bundle (committed to repo, required by GitHub Actions)

### Core Functions

- `validateFilename()`: Sanitize and validate filename input (path traversal protection)
- `validateFile()`: Check file existence, size limits (1MB max), and type
- `runCopilot()`: Execute @github/copilot npm package with token and instructions
- `createBranch()`: Create timestamped feature branch
- `commitAndPush()`: Configure git, commit changes, push to remote
- `createPullRequest()`: Use Octokit to create PR via GitHub API
- `assignPR()`: Assign PR to workflow actor

### Security Measures

- Input sanitization via `sanitize-filename` and `validator`
- Path traversal prevention (rejects absolute paths and `..`)
- File size limits (1MB) to prevent memory exhaustion
- No shell execution of user input
- Structured logging via `pino`

---

## 📋 Inputs

| Name            | Required | Default | Validation                                  |
| --------------- | -------- | ------- | ------------------------------------------- |
| `PRIVATE_TOKEN` | Yes      | -       | Must be valid GitHub PAT                    |
| `filename`      | No       | `''`    | Sanitized, no path traversal, max 255 chars |
| `branch`        | No       | `main`  | Base branch for PR                          |

---

## 📤 Outputs

| Name        | Description         |
| ----------- | ------------------- |
| `pr_number` | Created PR number   |
| `branch`    | Feature branch name |

---

## 🔄 CI/CD Agents

### Setup Agent

**Job**: `setup`  
**Purpose**: Extract Node.js version from Volta configuration in package.json  
**Outputs**: `node-version` (default: 22 if not found)

### Format Agent

**Job**: `format`  
**Command**: `npm run format:check`  
**Purpose**: Validate Prettier formatting compliance  
**Blocking**: Yes

### Lint Agent

**Job**: `lint`  
**Command**: `npm run lint`  
**Purpose**: ESLint validation, Responsible AI commit footer enforcement  
**Blocking**: Yes

### Build Agent

**Job**: `build`  
**Command**: `npm run build`  
**Purpose**: Compile action with @vercel/ncc into dist/  
**Artifacts**: Uploads dist/ for 7 days  
**Blocking**: Yes

### Test Agent

**Job**: `test`  
**Command**: `npm test`  
**Purpose**: Execute Jest test suite  
**Coverage Target**: 70% (branches, functions, lines, statements)  
**Blocking**: Yes

### Code Coverage Agent

**Job**: `codecov`  
**Command**: `npm run test:coverage`  
**Purpose**: Upload coverage to Codecov  
**Runs**: Only on push to main (not PRs)  
**Blocking**: No (fail_ci_if_error: false)

### Quality Gate Agent

**Job**: `gate`  
**Purpose**: Final validation that all quality agents passed  
**Dependencies**: format, lint, build, test  
**Blocking**: Yes

### CodeQL Security Agent

**Workflow**: `.github/workflows/codeql.yml`  
**Language**: JavaScript  
**Query Suite**: security-and-quality  
**Schedule**: Weekly (Mondays 00:00 UTC)  
**Runs**: Push to main, PRs  
**Blocking**: No (reports to Security tab)

### Secret Scanning Agent

**Workflow**: `.github/workflows/secret-scanning.yml`  
**Tool**: Gitleaks v2  
**Scope**: Full git history  
**Runs**: Push to main, PRs  
**Blocking**: Yes (prevents secret leaks)

### SonarCloud Agent

**Workflow**: `.github/workflows/sonarcloud.yml`  
**Version**: v3.1.0 (pinned)  
**Runs**: Push to main, PRs  
**Metrics**: Code smells, bugs, vulnerabilities, tech debt  
**Dashboard**: https://sonarcloud.io/project/overview?id=ChecKMarKDevTools_delegate-action

### Release Please Agent

**Workflow**: `.github/workflows/release-please.yml`  
**Version**: v4  
**Trigger**: Push to main  
**Purpose**: Parse conventional commits, generate changelog, create release PRs, bump versions

---

## 🧪 Testing Strategy

### Unit Tests

**Location**: `__tests__/index.test.js`  
**Framework**: Jest  
**Mocking**: @actions/core, @actions/exec, @actions/github, fs, pino  
**Coverage Target**: 70% minimum

### Test Cases

- Filename validation (empty, too long, absolute paths, traversal attempts, valid)
- File validation (existence, size limits, file vs directory)
- Copilot execution (version check, token passing, error handling)
- Branch creation (new branch, existing branch fallback)
- Commit/push (git config, change detection, no-change skip, error handling)
- PR creation (API success, API errors)
- PR assignment (API success, API errors)
- Input validation (required token, default branch)

### Coverage Thresholds

```javascript
{
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  }
}
```

---

## 🔐 Security Guidelines

**Input Validation**:

- All filenames sanitized with `sanitize-filename`
- Validator.js for additional validation
- Reject absolute paths
- Reject path traversal (`..`)
- Max filename length: 255 characters
- Max file size: 1MB

**Secret Management**:

- Never log secrets
- Use GitHub secrets for tokens
- Gitleaks scans every commit
- CodeQL weekly SAST

**Permissions**:

- CI: `contents: read`, `pull-requests: write`, `checks: write`
- CodeQL: `actions: read`, `contents: read`, `security-events: write`
- Secret Scanning: `contents: read`, `security-events: write`
- Release Please: `contents: write`, `pull-requests: write`

---

## 📝 Code Style Rules

**ESLint**:

- ECMAScript 2024
- CommonJS modules
- Prettier integration
- No unused vars (except prefixed with `_`)
- Console allowed (structured logging via pino)

**Prettier**:

- Auto-format via lefthook pre-commit hook
- Targets: `*.{js,json,md,yml,yaml}`

**Commitlint**:

- Conventional Commits enforced
- Responsible AI attribution required via `@checkmarkdevtools/commitlint-plugin-rai`
- Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

---

## 🛠️ Development Workflow

**Setup**:

```bash
npm install  # Installs deps + lefthook hooks
```

**Build**:

```bash
npm run build  # Compiles to dist/
```

**Lint**:

```bash
npm run lint  # ESLint check
```

**Format**:

```bash
npm run format        # Auto-fix
npm run format:check  # Check only
```

**Test**:

```bash
npm test              # Run tests
npm run test:coverage # With coverage
```

**Pre-commit Hooks** (Lefthook):

1. Format (auto-fixes)
2. Lint (must pass)
3. Test (must pass)

---

## 🎮 Agent Coordination

```
setup
├── format ────┐
├── lint ──────┤
├── build ─────┼──> gate
└── test ──────┘
     └── codecov (main only)
```

**Parallel Execution**: format, lint, build, test all run in parallel after setup  
**Quality Gate**: Blocks merge if any quality agent fails  
**Coverage Upload**: Only after test succeeds on main branch

---

## 📊 Quality Metrics

**Required for Merge**:

- ✅ Format check passes
- ✅ Lint check passes
- ✅ Build succeeds
- ✅ Tests pass (70% coverage minimum)
- ✅ No secrets detected
- ✅ Quality gate passes

**Advisory** (non-blocking):

- CodeQL security alerts
- SonarCloud quality metrics
- Codecov coverage trends

---

## 🚨 Error Handling Patterns

**Graceful Degradation**:

- Copilot execution errors → log warning, continue
- Commit errors (no changes) → log info, skip
- PR assignment errors → log warning, continue

**Hard Failures**:

- Missing PRIVATE_TOKEN → setFailed
- Invalid filename → setFailed
- File too large → setFailed
- PR creation fails → return null, log error

**Logging**:

- Use `pino` for structured JSON logs
- Include context (filename, branch, error messages)
- No secrets in logs

---

## 🔧 Build Artifacts

**Compiled Output**:

- `dist/index.js`: Single bundled file created by @vercel/ncc
- **Must be committed to repo** (GitHub Actions requirement)
- Generated via `npm run build`

**Excluded from Bundle**:

- node_modules (bundled into dist)
- Tests
- Dev dependencies

---

## 📦 Dependencies

**Production**:

- `@actions/core@^2.0.2`: GitHub Actions core utilities
- `@actions/exec@^2.0.0`: Execute shell commands
- `@actions/github@^7.0.0`: Octokit GitHub API client
- `pino@^10.2.0`: Structured logging
- `pino-pretty@^13.1.3`: Log formatting
- `sanitize-filename@^1.6.3`: Filename sanitization
- `validator@^13.15.26`: Input validation

**Development**:

- `jest@^29.7.0`: Testing framework
- `eslint@^9.39.2`: Linting
- `prettier@^3.3.3`: Code formatting
- `@vercel/ncc@^0.38.3`: Bundler
- `@commitlint/*@^20.3.1`: Commit message validation
- `lefthook@^2.0.15`: Git hooks

---

## 🎯 AI Agent Instructions

When working in this repository:

1. **Never** modify CI configuration without explicit request
2. **Always** export functions in `src/index.js` for testability
3. **Always** update tests when changing functionality
4. **Always** run validation loop before completion:
   - `npm run format`
   - `npm run lint`
   - `npm run build`
   - `npm test`
5. **Always** maintain 70%+ test coverage
6. **Never** commit secrets or sensitive data
7. **Always** use conventional commits with RAI attribution
8. **Always** update dist/ after src/ changes
9. **Never** introduce breaking changes without major version bump
10. **Always** validate inputs for security (path traversal, size limits)

---

## 🔍 Common Tasks

**Add new feature**:

1. Update `src/index.js`
2. Export new functions in module.exports
3. Add tests in `__tests__/index.test.js`
4. Run `npm run build` to update dist/
5. Verify coverage: `npm run test:coverage`
6. Commit with conventional commit + RAI footer

**Fix bug**:

1. Write failing test
2. Fix implementation
3. Verify test passes
4. Run full validation loop
5. Update dist/

**Update dependencies**:

1. Run `npm outdated`
2. Update package.json versions
3. Run `npm install`
4. Test thoroughly
5. Update dist/
6. Commit with `build:` prefix

---

## 📚 Further Reading

- [GitHub Actions Toolkit](https://github.com/actions/toolkit)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Jest Documentation](https://jestjs.io/)
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [Lefthook Documentation](https://github.com/evilmartians/lefthook)

---

**Last Updated**: 2026-01-17  
**Node Version**: 22.13.1 (Volta)  
**Action Version**: 1.0.0
