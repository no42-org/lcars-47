<!--
Copyright 2026 Ronny Trommer <ronny@no42.org>
SPDX-License-Identifier: LGPL-3.0-or-later
-->

# Agent instructions

LCARS Web Component library. See README.md for usage, CONTRIBUTING.md for process.

## Commands

Everything goes through `make`; CI runs the same targets.

```bash
make verify      # the gate: typecheck, build, test, dist and layout checks
make test        # unit tests only, no browser
make test-layout # browser layout gate only
make dev         # workbench at index.html
```

Single test file: `npx vitest run test/keypad.test.ts`. Single case: add `-t "part of the name"`.

`make verify` builds **before** testing on purpose — `test/dist.test.ts` skips its assertions when `dist/` is absent, so reordering silently drops five checks.

Geometry is invisible to `make test`: happy-dom has no layout engine, so every `getBoundingClientRect()` there is zero. `test/layout.test.ts` runs from its own config (`vitest.layout.config.ts`, node environment) and measures the workbench in headless Chromium. It needs `make install-browsers` once, and fails rather than skips without it.

## Architecture

Three layers, strictly one-directional: CSS custom properties in `src/tokens/` → Lit components in `src/components/` (all extend `LcarsElement` in `base.ts`) → `src/audio/` synthesizer, reached only through `playLcarsSound`. `src/index.ts` is the single barrel: it registers every element behind a `customElements.get` guard and re-exports the public API.

Theming is CSS-only. `data-lcars-theme` on any ancestor re-declares the `--lcars-color-*` set; components never read the theme in JS. A `theme` attribute on a component stamps that attribute on *itself*, which overrides the document theme for its subtree — that is what broke the workbench theme switcher once.

## Gotchas

Each of these shipped as a real bug here at least once:

- **Never name a property after a reserved global HTML attribute.** `title` fires a native tooltip, `dir` breaks bidi. Use `heading` and `orientation`.
- **Never declare a default-`true` boolean property.** Lit's converter never runs for an absent attribute, so markup cannot switch it off. Model the inverse (`continuous`, not `segmented`).
- **`import './tokens/index.css'` in `src/index.ts` is load-bearing.** It is what makes tokens travel with the JS entry. Removing it to satisfy a type checker ships unstyled components.
- **Declaration bundling fails soft.** If `@microsoft/api-extractor` is missing, the build logs "skip bundle declaration files", emits 15 `.d.ts` instead of one, and still exits 0. `verify-dist` catches it; do not weaken that check.
- **TypeScript is pinned to 6.x deliberately.** 7.x drops the JavaScript Compiler API that declaration bundling needs. See issue #6.
- **No colour literals in component templates.** Everything resolves through `--lcars-*` tokens, or the era themes stop working.

## Conventions

SPDX `LGPL-3.0-or-later` header in every source file. Conventional Commits. Every commit signed off (`git commit -s`), AI-assisted ones additionally carrying `Assisted-by: <Agent>:<model>`.
