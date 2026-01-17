# Contributing to Delegate Action

Thank you for your interest in contributing to delegate-action! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/delegate-action.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

### Check Formatting

```bash
npm run format:check
```

### Testing

```bash
npm test
```

## Commit Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Your commit messages should follow this format:

```
<type>(<scope>): <subject>
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes that don't modify src or test files

### Examples

```
feat: add support for custom Copilot commands
fix: resolve path traversal vulnerability
docs: update README with new examples
```

## Pull Request Process

1. Update documentation if needed
2. Ensure all tests pass
3. Run linting and formatting: `npm run lint && npm run format`
4. Build the action: `npm run build`
5. Commit the built `dist/` directory
6. Create a pull request with a clear description
7. Wait for code review

## Code Style

- Use ES6+ JavaScript features
- Follow ESLint and Prettier configurations
- Write clear, descriptive variable and function names
- Add JSDoc comments for functions
- Keep functions small and focused

## Security

- Never commit secrets or credentials
- Validate all user inputs
- Use safe file path operations
- Follow the security guidelines in SECURITY.md

## Release Process

Releases are automated using [Release Please](https://github.com/googleapis/release-please):

1. Merge PRs to main branch
2. Release Please creates/updates a release PR
3. Merge the release PR to trigger a new release
4. GitHub Actions will publish the new version

## Questions?

Open an issue for questions or discussions.
