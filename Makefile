# Copyright 2026 Ronny Trommer <ronny@no42.org>
# SPDX-License-Identifier: LGPL-3.0-or-later
#
# Single entry point for local and CI workflows. CI calls these targets, never
# npm directly, so the two cannot drift.

NPM ?= npm

.PHONY: help install typecheck test test-watch build verify dev clean distclean

help: ## Show available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies from the lockfile
	$(NPM) ci

node_modules: package-lock.json
	$(NPM) ci
	@touch node_modules

typecheck: node_modules ## Type-check without emitting
	$(NPM) run typecheck

test: node_modules ## Run the unit test suite once
	$(NPM) test

test-watch: node_modules ## Run tests in watch mode
	$(NPM) run test:watch

build: node_modules ## Build ESM + IIFE + CSS + declarations, then verify dist
	$(NPM) run build

verify: typecheck test build ## Full gate: types, tests, build and dist checks

dev: node_modules ## Start the workbench dev server
	$(NPM) run dev

clean: ## Remove build output
	rm -rf dist

distclean: clean ## Remove build output and installed dependencies
	rm -rf node_modules
