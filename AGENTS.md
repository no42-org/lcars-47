<!--
Copyright 2026 Ronny Trommer <ronny@no42.org>
SPDX-License-Identifier: LGPL-3.0-or-later
-->

# Agent instructions

LCARS Web Component library. See README.md for usage, CONTRIBUTING.md for process.

## Commands

Everything goes through `make`; CI runs the same targets.

```bash
make verify      # the gate: typecheck, build, test, dist, layout and site checks
make test        # unit tests only, no browser
make test-layout # browser layout gate only
make test-compat # cross-engine invariants (Chromium, Firefox, WebKit); CI-only job, not in verify
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
- **A container query never styles its own container.** `<lcars-frame>`'s host is the size container, so the grid it drives has to sit inside the host rather than on it. Only the grid declares a height. `height: 100%` on the host counts as a height and looks harmless only while the parent's height is indefinite, which is the case tests tend to cover.
- **`max-height: 100%` is the only self-branching mechanism available here.** It resolves to `none` against a parent whose height is indefinite and clamps against one that is definite, which is how a component tells "I am the page" from "I am in a card" without asking the consumer. It reads as dead code, because it does nothing until a parent is bounded. `test/layout.test.ts` is what stops it being tidied away.
- **Containment is asserted by `elementFromPoint`, not by rectangles.** A scrolled element reports content rectangles far outside its own box while being correctly clipped, so rect arithmetic has given three different answers to "does it escape". Hit-test just outside the box, and ask whether the element found there belongs to the component: slotted content answers as itself, not as the host.
- **`container-type: inline-size` computes the box's width as if it had no contents.** Anywhere the element is shrink-to-fit (flex item, float, inline-block, absolutely positioned) that width is zero and the component renders invisible with no error. A container needs an explicit `width`.
- **`<lcars-frame>`'s definite height and its `minmax(0, 1fr)` row are a pair.** The height stops `1fr` resolving to max-content, which pushed the footer row off screen; the `minmax` lets that row shrink below its content when space is tight, which an embedded frame needs. Each looks redundant when tested in the other's regime — delete either and a viewport-sized test suite stays green while a shipped bug comes back.
- **A flex column with a definite height shrinks its children instead of scrolling.** `overflow: auto` on such a region never fires: content is silently compressed to fit and no scrollbar appears. Scrollable regions need `flex-shrink: 0` on what is slotted into them.
- **Lit's `adoptedStyleSheets` outrank a `<style>` injected into the shadow root** at equal specificity. An override tried from devtools or a probe script can silently not apply; use `!important` when probing, and check it took.
- **Backticks inside `css`/`html` templates end the template.** A CSS comment mentioning `` `1fr` `` is a parse error, and the message points at the number, not the comment.
- **A variable font's instances can disagree about advance widths.** Antonio's digits are uniform at the default weight but proportional at bold (`1` is a third narrower than `0`), so bold live values jitter layout that regular-weight checks call stable — on a phone-width viewport that flipped a readout across its row's wrap boundary at telemetry rate. `font-variant-numeric: tabular-nums` cannot fix it: the font ships no `tnum` feature, so the declaration silently does nothing. `<lcars-readout>` and `<lcars-bargraph>` reserve their value boxes instead (digits at `1ch` — the advance of `0`, the widest bold digit — punctuation at half, via `valueReservationStyle` in `base.ts`); `test/layout.test.ts` holds the line. `<lcars-status-pill>` labels stay shrink-to-fit knowingly: letter-dominated text is wider than the charge, which leaves this reservation inert.

## Conventions

SPDX `LGPL-3.0-or-later` header in every source file. Conventional Commits. Every commit signed off (`git commit -s`), AI-assisted ones additionally carrying `Assisted-by: <Agent>:<model>`.
