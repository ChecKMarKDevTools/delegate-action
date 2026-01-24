.PHONY: ai-checks format lint test secrets build help

help:
	@echo "Available targets:"
	@echo "  ai-checks  - Run format, lint, test, and secrets in sequence"
	@echo "  format     - Format code with Prettier"
	@echo "  lint       - Lint code with ESLint"
	@echo "  test       - Run tests with Vitest"
	@echo "  secrets    - Scan for secrets with Gitleaks"
	@echo "  build      - Build distribution bundle"

ai-checks: format lint test secrets
	@echo "✅ All checks passed"

format:
	@echo "🎨 Running formatter..."
	@npm run format

lint:
	@echo "🔍 Running linter..."
	@npm run lint

test:
	@echo "🧪 Running tests..."
	@npm test

secrets:
	@echo "🔒 Scanning for secrets..."
	@command -v gitleaks >/dev/null 2>&1 || { echo "❌ gitleaks not installed. Install: brew install gitleaks"; exit 1; }
	@gitleaks detect --no-git --source . --verbose --report-path gitleaks-report.json

build:
	@echo "📦 Building distribution..."
	@npm run build
