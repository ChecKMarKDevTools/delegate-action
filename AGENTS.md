# 🤖 AGENTS.md

> **Building software that works while you sleep. Well, mostly.**

This document describes the automated CI/CD "agents" that keep this action from becoming a dumpster fire. Each agent has a single job: do one thing, do it well, and yell loudly when it fails.

---

## 🎯 The Agents

### 🔐 Security Agents

#### CodeQL Agent

**File:** `.github/workflows/codeql.yml`  
**Runs:** On push to `main`, PRs, and weekly (Mondays at midnight UTC)  
**Purpose:** Static application security testing (SAST) for JavaScript  
**What it does:**

- Scans the codebase for security vulnerabilities
- Checks for common coding patterns that lead to bugs
- Runs the `security-and-quality` query suite
- Reports findings to GitHub Security tab

**How to read results:**

1. Navigate to the Security tab in the repo
2. Click "Code scanning alerts"
3. Fix the highest severity issues first
4. Don't ignore warnings just because they're annoying

#### Secret Scanning Agent

**File:** `.github/workflows/secret-scanning.yml`  
**Runs:** On push to `main` and PRs  
**Purpose:** Prevents you from committing your AWS keys (again)  
**What it does:**

- Scans the entire git history for leaked secrets
- Checks for API keys, tokens, passwords, and other sensitive data
- Blocks PRs if secrets are detected
- Uses Gitleaks for detection

**Pro tip:** If this catches something, rotate the credential immediately. It's already compromised.

---

### 🏗️ Build & Quality Agents

#### Setup Agent

**File:** `.github/workflows/ci.yml` (job: `setup`)  
**Purpose:** Reads Volta config and sets Node version for all downstream jobs  
**Outputs:**

- `node-version`: The Node.js version to use (defaults to 22 if not specified)

#### Format Agent

**File:** `.github/workflows/ci.yml` (job: `format`)  
**Purpose:** Enforces code formatting standards  
**What it checks:**

- Runs `npm run format:check`
- Validates Prettier formatting
- Fails if code isn't formatted correctly

**Fix it locally:** `npm run format`

#### Lint Agent

**File:** `.github/workflows/ci.yml` (job: `lint`)  
**Purpose:** Catches code quality issues before they haunt you  
**What it checks:**

- Runs ESLint with configuration from `eslint.config.mjs`
- Enforces code style and best practices
- Validates Responsible AI commit footers via `@checkmarkdevtools/rai-lint`

**Fix it locally:** `npm run lint`

#### Build Agent

**File:** `.github/workflows/ci.yml` (job: `build`)  
**Purpose:** Compiles the action into a distributable format  
**What it does:**

- Runs `npm run build` (uses `@vercel/ncc`)
- Creates the `dist/` directory
- Uploads artifacts for 7 days
- Ensures the action can actually be used

**Important:** The `dist/` folder is committed to the repo because GitHub Actions needs it.

#### Test Agent

**File:** `.github/workflows/ci.yml` (job: `test`)  
**Purpose:** Runs automated tests  
**What it does:**

- Executes `npm test`
- Validates functionality
- Currently just a placeholder (add real tests, you coward)

#### Code Coverage Agent

**File:** `.github/workflows/ci.yml` (job: `codecov`)  
**Purpose:** Tracks test coverage  
**What it does:**

- Runs tests with coverage enabled
- Uploads results to Codecov
- Only runs on push to `main` (not on PRs)
- Doesn't fail the build (yet)

#### Quality Gate Agent

**File:** `.github/workflows/ci.yml` (job: `gate`)  
**Purpose:** Final validation that everything passed  
**What it checks:**

- Format agent: MUST pass
- Lint agent: MUST pass
- Build agent: MUST pass
- Test agent: MUST pass

If any agent fails, the quality gate fails. No merge for you.

---

### 🚀 Release Agents

#### SonarCloud Agent

**File:** `.github/workflows/sonarcloud.yml`  
**Runs:** On push to `main` and PRs  
**Purpose:** Code quality and security analysis  
**What it does:**

- Static code analysis
- Detects code smells, bugs, and vulnerabilities
- Tracks technical debt
- Generates quality metrics

**Dashboard:** https://sonarcloud.io/project/overview?id=ChecKMarKDevTools_delegate-action

#### Release Please Agent

**File:** `.github/workflows/release-please.yml`  
**Runs:** On push to `main`  
**Purpose:** Automated semantic versioning and releases  
**What it does:**

- Parses Conventional Commits
- Generates CHANGELOG.md
- Creates release PRs
- Publishes GitHub releases
- Bumps version in package.json

**How it works:**

1. You merge a PR with a commit like `feat: add new feature`
2. Release Please opens a PR with the version bump
3. When you merge that PR, it creates a GitHub release
4. Magic happens

---

## 🔧 Local Development

### Pre-commit Hooks

**File:** `.lefthook.yml`  
**Managed by:** Lefthook  
**Runs automatically on:** `git commit`

**Hook order:**

1. **Format** (`npm run format`) - Auto-fixes formatting
2. **Lint** (`npm run lint`) - Catches code issues
3. **Test** (`npm test`) - Runs tests

If any step fails, the commit is blocked. Fix it and try again.

**Install hooks:**

```bash
npm install  # Hooks are installed automatically via postinstall script
```

**Skip hooks (use sparingly):**

```bash
git commit --no-verify
```

---

## 🎮 Agent Coordination

The agents run in parallel when possible, with strategic dependencies:

```
setup
├── format ────┐
├── lint ──────┤
├── build ─────┼──> gate
└── test ──────┘
     └── codecov (push only)
```

**Key points:**

- All quality agents depend on `setup` for Node version
- `gate` waits for all quality agents to finish
- `codecov` only runs after `test` succeeds (and only on `main`)
- Security agents (CodeQL, Secret Scanning) run independently

---

## 📊 Monitoring & Dashboards

- **GitHub Actions:** Check the Actions tab for workflow runs
- **CodeQL:** Security tab → Code scanning alerts
- **SonarCloud:** https://sonarcloud.io/project/overview?id=ChecKMarKDevTools_delegate-action
- **Codecov:** Badge in README (when it exists)

---

## 🚨 When Things Break

### "Quality gate failed"

One of the agents failed. Check the logs:

1. Click the failed workflow run
2. Expand the failed job
3. Read the error (I know, shocking)
4. Fix the issue locally
5. Push again

### "CodeQL found vulnerabilities"

1. Go to Security tab
2. Read the alert
3. Fix the code
4. Push the fix
5. Re-scan will happen automatically

### "Secret detected"

**STOP EVERYTHING.**

1. Identify the leaked secret
2. Rotate it immediately
3. Remove it from git history (`git filter-branch` or BFG Repo-Cleaner)
4. Push the cleaned history
5. Never speak of this again

### "Release Please won't create a release"

You probably didn't follow Conventional Commits:

- ✅ `feat: add new feature`
- ✅ `fix: resolve bug`
- ❌ `added new feature`
- ❌ `bug fix`

---

## 🤝 Contributing

When adding new agents:

1. Keep them focused (one job, one responsibility)
2. Make them fast (< 10 minutes)
3. Make them loud (fail fast, fail clearly)
4. Document them here
5. Add appropriate permissions
6. Set reasonable timeouts

---

## 📚 Further Reading

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Lefthook Documentation](https://github.com/evilmartians/lefthook)
- [GitHub Actions Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [CodeQL Documentation](https://codeql.github.com/docs/)

---

**Remember:** These agents work for you, not the other way around. If they're noisy, fix the root cause. If they're broken, fix them. If they're missing something important, add it.

Now go forth and ship.
