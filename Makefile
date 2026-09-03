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
# Paths excluded from the distributed plugin. Single source of truth, shared
# by `make package` (zip) and `make sync-svn` (rsync) so the two can never
# drift apart.
EXCLUDE_DIRS  := node_modules vendor tests dist .github .playwright-browsers playwright-report test-results wp-assets design
EXCLUDE_FILES := .phpunit.result.cache phpunit.xml playwright.config.js Dockerfile .dockerignore Makefile README.md
EXCLUDE_GLOBS := *.git* composer.* package*.json

ZIP_EXCLUDES := $(foreach entry,$(EXCLUDE_DIRS),"$(entry)/*") $(foreach entry,$(EXCLUDE_FILES),"$(entry)") $(foreach entry,$(EXCLUDE_GLOBS),"$(entry)")
RSYNC_EXCLUDES := $(foreach entry,$(EXCLUDE_DIRS),"--exclude=$(entry)/") $(foreach entry,$(EXCLUDE_FILES),"--exclude=$(entry)") $(foreach entry,$(EXCLUDE_GLOBS),"--exclude=$(entry)")

package:
	@echo "Packaging $(PLUGIN_SLUG) version $(VERSION)..."
	@mkdir -p dist
	@rm -f dist/$(PLUGIN_SLUG).zip
	@# Zip only the plugin files (exclusion list above keeps dev artifacts out)
	@zip -r dist/$(PLUGIN_SLUG).zip . -x $(ZIP_EXCLUDES)
	@echo "Package created at dist/$(PLUGIN_SLUG).zip"

# ==========================================
# SVN DEPLOYMENT
# ==========================================
# Define SVN_DIR. Can be overridden via command line.
SVN_DIR ?= ../cardea-svn

sync-svn:
	@echo "Syncing $(PLUGIN_SLUG) version $(VERSION) to SVN..."
	@if [ ! -d "$(SVN_DIR)" ]; then echo "Error: SVN directory $(SVN_DIR) does not exist."; exit 1; fi

	@echo "--> Mirroring production files to $(SVN_DIR)/trunk/"
	@rsync -av --delete $(RSYNC_EXCLUDES) ./ $(SVN_DIR)/trunk/

	@echo "--> Mirroring repository assets to $(SVN_DIR)/assets/"
	@rsync -av --delete ./wp-assets/ $(SVN_DIR)/assets/

	@echo "Sync complete. Run 'svn status' in $(SVN_DIR) to review changes."

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


