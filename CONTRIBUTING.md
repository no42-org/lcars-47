<!--
Copyright 2026 Ronny Trommer <ronny@no42.org>
SPDX-License-Identifier: LGPL-3.0-or-later
-->

# Contributing

Thanks for considering a contribution. This project is a framework-agnostic LCARS Web Component library; see the [README](README.md) for what it does and [RELEASING.md](RELEASING.md) for how versions ship.

## Working agreement

Work starts from an issue, not a drive-by pull request. Open one describing the problem or the enhancement, then reference it from the PR with a closing keyword (`Closes #123`) so merging resolves it.

## Developer Certificate of Origin

All commits must be signed off with `git commit -s`, certifying the [DCO](https://developercertificate.org/):

```
Signed-off-by: Your Name <you@example.org>
```

The `Signed-off-by` trailer must name a **human identity** — the person responsible for the contribution. Never an agent, tool, or bot.

## AI-assisted contributions

AI assistance is welcome, and this project uses it heavily. Commits produced with an AI agent carry an additional trailer naming the agent and model:

```
Assisted-by: ClaudeCode:claude-opus-5
Signed-off-by: Ronny Trommer <ronny@no42.org>
```

Both trailers appear in that order. The human signer reviews all AI-generated code and remains responsible for its correctness and license compliance. Attribution is a disclosure, not a transfer of responsibility.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `<type>[scope]: <description>`, where type is one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`. Breaking changes append `!` or add a `BREAKING CHANGE:` footer. The release version is derived from these, so the type is not cosmetic.

Write the body to explain *why*, wrapped at ~72 columns. What changed is already in the diff.

## Development

Everything runs through `make`; CI calls the same targets, so local and CI cannot drift.

```bash
make install     # install from the lockfile
make verify      # the full gate: typecheck, build, tests, dist checks
make dev         # workbench dev server at index.html
make test-watch  # tests in watch mode
```

Run a single test file with `npx vitest run test/keypad.test.ts`, or a single case with `-t "substring of the test name"`.

`make verify` must pass before you open a PR. It is exactly what CI runs.

## Conventions worth knowing

These are the mistakes this codebase has actually made and now guards against:

- **Never use a reserved global HTML attribute as a component property name.** `title` and `dir` are global attributes; overriding them fires native tooltips and breaks bidi text. Use `heading` and `orientation`.
- **Never declare a default-`true` boolean property.** Lit's boolean converter never runs for an absent attribute, so markup cannot switch it off. Model the inverse (`continuous`, not `segmented = true`).
- **All styling goes through `--lcars-*` CSS custom properties.** No colour literals in component templates; that is what makes the era themes work.
- **Every source file carries an SPDX header** (`LGPL-3.0-or-later`), matching `LICENSE` and the package manifest.

## Security

Please do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
