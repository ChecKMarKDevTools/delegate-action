# Security Policy

> **Found a vulnerability? Report it. Don't exploit it. We're watching.**

---

## Reporting Security Vulnerabilities

If you discover a security vulnerability in delegate-action, **do not** open a public issue. That's how you get exploited before you get patched.

Instead, report it privately:

1. **Email:** Open an issue with the title `[SECURITY]` and we'll contact you for details
2. **GitHub Security Advisories:** Use the [Security tab](https://github.com/ChecKMarKDevTools/delegate-action/security/advisories) to report privately
3. **Expected Response Time:** 48-72 hours for acknowledgment, 7 days for initial assessment

We take security seriously. You'll get credit for responsible disclosure (if you want it).

---

## Security Measures Implemented

### Input Validation

**Location:** `src/index.js`

- **Filename Sanitization**: Uses `sanitize-filename` library (not homemade regex)
- **Path Traversal Protection**: Rejects absolute paths and `..` sequences
- **File Size Limits**: Rejects files larger than 1MB to prevent memory exhaustion
- **Input Length Limits**: Truncates instructions to 500 characters to prevent buffer issues

### Secret Handling

- **No Hardcoded Secrets**: All tokens are passed via GitHub Actions secrets
- **Environment Variables Only**: Secrets are used in `process.env`, never logged
- **Token Scoping**: Uses minimal required permissions (contents: write, pull-requests: write)

### Command Execution

- **Safe Execution**: Uses `@actions/exec` for controlled command execution
- **No Shell Evaluation**: No `eval()`, `exec()`, or shell interpolation
- **Parameterized Commands**: All arguments are properly escaped and validated
- **No User-Controlled Strings**: Git commands use predefined arguments only

### File System Operations

- **Workspace Restriction**: Only operates within the GitHub Actions workspace
- **Path Validation**: Uses `path.join()` to prevent directory traversal
- **File Type Validation**: Checks that paths are files (not directories or symlinks)

### Dependencies

- **Automated Audits**: Dependabot runs weekly to catch known vulnerabilities
- **SonarCloud Analysis**: Static code analysis on every PR
- **CodeQL Scanning**: Weekly SAST scans for security vulnerabilities
- **Gitleaks**: Secret scanning on every push and PR

### Logging

- **Structured Logging**: Uses `pino` for JSON-formatted logs
- **No Sensitive Data**: Logs never include tokens, credentials, or file contents
- **Error Handling**: Errors are caught and logged without exposing internal state

---

## Permissions Required

| Permission             | Reason                                                |
| ---------------------- | ----------------------------------------------------- |
| `contents: write`      | Required for creating branches and committing changes |
| `pull-requests: write` | Required for creating and assigning PRs               |

**We don't ask for more than we need.** If you see this action requesting additional permissions, something is wrong.

---

## Security Best Practices

If you're using this action, follow these guidelines:

1. **Use Fine-Grained PATs**: Create a Personal Access Token with minimal scopes
   - `contents: write`
   - `pull_requests: write`
   - Nothing else
2. **Enable Branch Protection**: Require reviews before merging PRs (the action doesn't auto-merge)
3. **Use Secrets**: Store tokens in GitHub Secrets, not in workflow files
4. **Review Generated PRs**: Don't blindly merge AI-generated code
5. **Monitor Dependency Alerts**: Enable Dependabot alerts for the repository

---

## Known Issues

### Low Severity Vulnerabilities

**Status:** Tracked, not exploitable in our context

- **Undici vulnerability** in `@actions/github` transitive dependency
- **Impact:** Unbounded decompression chain in HTTP responses (GHSA-g9mf-h72j-4rw9)
- **Mitigation:** Low risk in GitHub Actions context (trusted GitHub API only)
- **Fix:** Waiting for upstream `@actions/github` to update dependencies

We don't run arbitrary HTTP requests. We only communicate with the GitHub API, which is trusted infrastructure.

---

## Security Checklist

✅ Input validation and sanitization  
✅ No `eval()` or similar dangerous functions  
✅ Proper error handling without exposing sensitive data  
✅ Use of official GitHub Actions libraries  
✅ No hardcoded credentials  
✅ Proper permission scoping  
✅ Code review and static analysis (ESLint, Prettier, SonarCloud, CodeQL)  
✅ Secret scanning (Gitleaks)  
✅ Dependency auditing (Dependabot)

---

## CodeQL Analysis

CodeQL runs weekly on Mondays at midnight UTC. Results are available in the [Security tab](https://github.com/ChecKMarKDevTools/delegate-action/security/code-scanning).

If CodeQL finds something, we'll fix it. If it's a false positive, we'll document why.

---

## Gitleaks Secret Scanning

Gitleaks runs on every push and PR. If you accidentally commit a secret, the CI will fail and yell at you.

**If you leak a secret:**

1. Rotate it immediately
2. Remove it from git history (`git filter-branch` or BFG Repo-Cleaner)
3. Push the cleaned history
4. Learn from your mistake

---

## Vulnerability Disclosure Timeline

1. **Day 0**: Vulnerability reported
2. **Day 1-3**: Acknowledgment sent
3. **Day 7**: Initial assessment and severity rating
4. **Day 14-30**: Patch developed and tested
5. **Day 30**: Public disclosure and release (or earlier if critical)

We'll work with you to coordinate disclosure if you reported the issue responsibly.

---

## Security Updates

Security patches are released as soon as they're ready. They follow this process:

1. Fix is developed in a private branch
2. Fix is tested thoroughly
3. Release is created with security advisory
4. Public disclosure happens after users have time to update

**Critical vulnerabilities** are patched within 24-48 hours. **High severity** within 7 days. **Medium/Low** within 30 days.

---

## Questions?

If you have security questions that aren't sensitive, open an issue. If they are sensitive, use the private reporting methods above.

---

## Credits

Thanks to everyone who reports security issues responsibly. You're making the internet a safer place.

**Last Updated:** 2026-01-17
