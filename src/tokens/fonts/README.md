<!--
Copyright 2026 Ronny Trommer <ronny@no42.org>
SPDX-License-Identifier: LGPL-3.0-or-later
-->

# Bundled Antonio

These files are modified from [Antonio](https://github.com/googlefonts/antonioFont) 1.002 and are licensed under the SIL Open Font License 1.1, in `OFL.txt`.
Antonio declares no Reserved Font Name, so the modified files keep the name.

## What changed

Only the vertical metrics, and a note in the version string.

| Field | Upstream | Here |
| :--- | :--- | :--- |
| `hhea.ascent`, `OS/2.sTypoAscender` | 2365 | 2205 |
| `hhea.descent`, `OS/2.sTypoDescender` | -285 | -445 |

Upstream leaves 605 units above the capitals and 285 below, so capitals sit low in any box.
The new values leave 445 on both sides and keep the 2650-unit line box.
`usWinAscent` and `usWinDescent` keep their upstream values: they are clipping bounds, and `USE_TYPO_METRICS` directs renderers to the typo fields.

The edit is in the files because Safari drops the `ascent-override` and `descent-override` descriptors.
`typography.css` has no `local()` source for the same reason: an installed copy has the upstream metrics.

## Updating the font

1. Replace the files with the new upstream subset.
2. Run `make balance-fonts`, with `fonttools` and `brotli` installed for Python. It changes nothing if the em size, cap height, line box, line gap or `USE_TYPO_METRICS` no longer match.
3. Run `make verify` and `make test-compat`.
4. Start `make dev`, then run `SAFARI_URL=http://localhost:5173/ make check-safari`. Without `SAFARI_URL` it measures the deployed demo, not these files.
