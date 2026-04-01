PLUGIN_SLUG=cardea
VERSION=$(shell grep -m 1 "Version:" cardea.php | awk '{print $$NF}')
# Use PWD so Docker volume mounts work reliably across different OS environments
PWD=$(shell pwd)

.PHONY: build install test-jest test-phpunit test-e2e test package clean lint

# ==========================================
# ENVIRONMENT BUILD
# ==========================================
build:
	@echo "Building the unified development image..."
	docker build -t cardea-dev .

# ==========================================
# LOCAL VALIDATION
# ==========================================
lint:
	@echo "Running WordPress Coding Standards check..."
	docker run --rm -v $(PWD):/app cardea-dev sh -c "git config --global --add safe.directory /app && composer phpcs"

# ==========================================
# DEPENDENCIES (Runs via Ephemeral Docker)
# ==========================================
install: build
	@echo "Installing dependencies and Chromium..."
	docker run --rm -v $(PWD):/app -e PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers cardea-dev sh -c "git config --global --add safe.directory /app && composer install && npm install && npx playwright install chromium"

# ==========================================
# TESTING (Runs via Ephemeral Docker)
# ==========================================
test: test-jest test-phpunit test-e2e

test-jest:
	@echo "Running Jest Worker Tests..."
	docker run --rm -v $(PWD):/app cardea-dev npm run test:jest

test-phpunit:
	@echo "Running PHPUnit Tests..."
	docker run --rm -v $(PWD):/app cardea-dev ./vendor/bin/phpunit

test-e2e:
	@echo "Running Playwright E2E Tests..."
	# --ipc=host prevents Chromium from crashing due to Docker's default shared memory limits
	docker run --rm --ipc=host -v $(PWD):/app -e PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers cardea-dev npm run test:e2e

# ==========================================
# PACKAGING
# ==========================================
package:
	@echo "Packaging $(PLUGIN_SLUG) version $(VERSION)..."
	@mkdir -p dist
	@rm -f dist/$(PLUGIN_SLUG).zip
	@# Use a temporary directory to ensure only the necessary files are zipped
	@zip -r dist/$(PLUGIN_SLUG).zip . \
		-x "*.git*" \
		-x "node_modules/*" \
		-x "vendor/*" \
		-x "tests/*" \
		-x "dist/*" \
		-x ".github/*" \
		-x ".playwright-browsers/*" \
		-x "playwright-report/*" \
		-x "test-results/*" \
		-x ".phpunit.result.cache" \
		-x "phpunit.xml" \
		-x "playwright.config.js" \
		-x "composer.*" \
		-x "package*.json" \
		-x "Dockerfile" \
		-x ".dockerignore" \
		-x "Makefile" \
		-x "README.md"
	@echo "Package created at dist/$(PLUGIN_SLUG).zip"

# ==========================================
# CLEANUP
# ==========================================
clean:
	@echo "Cleaning up generated artifacts..."
	# We use Docker to delete these so we don't hit root permission errors from volume mounts
	docker run --rm -v $(PWD):/app cardea-dev sh -c "rm -rf dist/ vendor/ node_modules/ playwright-report/ test-results/ .phpunit.result.cache"

purge: clean
	@echo "Performing deep clean (removing cached Playwright browsers)..."
	docker run --rm -v $(PWD):/app cardea-dev sh -c "rm -rf .playwright-browsers/"


