.PHONY: ai-checks format lint test build help

help:
	@echo "Available targets:"
	@echo "  ai-checks  - Run format, lint, and test in sequence"
	@echo "  format     - Format code with Prettier"
	@echo "  lint       - Lint code with ESLint"
	@echo "  test       - Run tests with Vitest"
	@echo "  build      - Build distribution bundle"

ai-checks: format lint test
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

build:
	@echo "📦 Building distribution..."
	@npm run build
