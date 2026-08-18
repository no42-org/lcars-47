# Copyright 2026 Ronny Trommer <ronny@no42.org>
# SPDX-License-Identifier: LGPL-3.0-or-later
#
# Single entry point for local and CI workflows. CI calls these targets, never
# npm directly, so the two cannot drift.

NPM ?= npm

.PHONY: help install install-browsers install-browsers-all typecheck test test-watch test-layout test-compat build site verify dev clean distclean

help: ## Show available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies from the lockfile
	$(NPM) ci

install-browsers: node_modules ## Install the browser the layout gate drives
	$(NPM) run install:browsers

# Only the cross-engine job needs all three; keeping this separate spares the
# verify and release jobs Firefox and WebKit downloads (and WebKit's apt
# dependency set) for gates that only launch Chromium.
install-browsers-all: node_modules ## Install all three engines for the compat tier
	$(NPM) run install:browsers:all

node_modules: package-lock.json
	$(NPM) ci
	@touch node_modules

typecheck: node_modules ## Type-check without emitting
	$(NPM) run typecheck

test: node_modules ## Run the unit test suite once
	$(NPM) test

test-watch: node_modules ## Run tests in watch mode
	$(NPM) run test:watch

# Geometry is invisible to the unit suite: happy-dom has no layout engine, so
# every rect there is zero. This drives the workbench in a real browser and
# fails, never skips, when that browser is missing.
test-layout: node_modules ## Run the browser layout gate
	$(NPM) run test:layout

# Behavioral invariants in all three engines. Deliberately not part of verify:
# the local gate stays single-browser, CI runs this as its own job.
test-compat: node_modules ## Run cross-engine invariants (Chromium, Firefox, WebKit)
	$(NPM) run test:compat

build: node_modules ## Build ESM + IIFE + CSS + declarations, then verify dist
	$(NPM) run build

site: node_modules ## Build the workbench as a static site into site/ (GitHub Pages)
	$(NPM) run build:site

# Build before test on purpose: test/dist.test.ts gates its built-artifact
# assertions on dist/ existing, so running tests first silently skips them on
# every clean checkout, which is exactly what CI is. site comes last so that
# ordering stays undisturbed; it catches workbench breakage in the PR gate,
# since the Pages deploy workflow runs only make site and no other checks.
verify: typecheck build test test-layout site ## Full gate: types, build, tests, dist, layout and site checks

release-build: verify ## Assemble signed-release inputs into release/
	rm -rf release && mkdir -p release
	# The npm tarball is what consumers actually install; pack it so the
	# released artifact is byte-identical to the publishable one.
	$(NPM) pack --pack-destination release
	# Standalone bundles for direct download / CDN mirroring.
	cp dist/lcars.iife.js dist/lcars.css dist/index.d.ts release/
	# SBOM of what ships (runtime tree only), generated first-party by npm so
	# the release job needs no third-party tooling for it. CycloneDX rather
	# than SPDX because the blitsbom VEX overlay is CycloneDX-only. The
	# filename carries the version, like the tarball next to it.
	$(NPM) sbom --sbom-format cyclonedx --omit dev \
		> "release/lcars-47-$$(node -p 'require("./package.json").version')-sbom.cdx.json"

dev: node_modules ## Start the workbench dev server
	$(NPM) run dev

clean: ## Remove build output
	rm -rf dist site

distclean: clean ## Remove build output and installed dependencies
	rm -rf node_modules
