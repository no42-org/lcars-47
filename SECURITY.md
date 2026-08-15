<!--
Copyright 2026 Ronny Trommer <ronny@no42.org>
SPDX-License-Identifier: LGPL-3.0-or-later
-->

# Security Policy

## Supported versions

| Version | Supported |
| :--- | :--- |
| 0.x | Yes — current development line |

This project is pre-1.0. Fixes land on the latest minor; there are no maintained back-branches yet.

## Reporting a vulnerability

**Please do not open a public issue.**

Email **ronny@no42.org** with:

- what the issue is and which component or entry point it affects,
- how to reproduce it, ideally as a minimal HTML page or test case,
- the version or commit you observed it on.

You can expect an acknowledgement within **5 working days** and an assessment within **10 working days**. If a fix is warranted, it ships in the next release and the advisory credits you unless you prefer otherwise.

GitHub private vulnerability reporting is not enabled on this repository, so email is the reporting channel. If that changes, this file changes with it.

## Scope

This is a browser-side component library with no server, no network calls, and no runtime dependencies beyond [Lit](https://lit.dev/). The realistic attack surface is therefore:

- **Attribute and property injection.** Component attributes resolve into inline styles and rendered markup. Values are sanitised before interpolation (see `resolveColor` in `src/components/base.ts`), and a bypass of that guard is in scope.
- **Supply chain.** The published package, its declared dependency tree, and the CDN bundles.
- **The procedural audio subsystem.** It synthesises sound with the Web Audio API and loads no external media.

Out of scope: anything requiring the host application to already be compromised, and the intentional ability of a host page to style or script its own components.

## Verifying what you install

Release artifacts are signed and carry build provenance. See [RELEASING.md](RELEASING.md) for the `cosign verify` and `gh attestation verify` commands.
