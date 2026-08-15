<!--
Copyright 2026 Ronny Trommer <ronny@no42.org>
SPDX-License-Identifier: LGPL-3.0-or-later
-->

# Support

This is a small, volunteer-maintained project. There is no commercial support and no response-time guarantee, but issues are read.

## Where to go

| I want to… | Go to |
| :--- | :--- |
| Report a bug | [Open a bug report](https://github.com/no42-org/lcars-47/issues/new?template=bug_report.yml) |
| Propose a feature | [Open an enhancement](https://github.com/no42-org/lcars-47/issues/new?template=enhancement.yml) |
| Report a vulnerability | **Not an issue** — see [SECURITY.md](SECURITY.md) |
| Ask how to use something | [Open an issue](https://github.com/no42-org/lcars-47/issues/new/choose) labelled `question` |
| Contribute a change | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Before opening an issue

Most questions are answered by the material already in the repo:

- **[README.md](README.md)** — installation, quick start, and the component reference: every attribute, event, and CSS custom property.
- **[index.html](index.html)** — the interactive workbench. Run it with `make dev`; it exercises every component, the theme switcher, and the audio subsystem, and is usually the fastest way to see whether the library or your integration is at fault.
- **[RELEASING.md](RELEASING.md)** — what a release contains and how to verify its signatures.

## What helps a report get fixed

A minimal reproduction beats a description. These are Web Components, so a few lines of HTML that show the problem is usually enough, and it removes any ambiguity about which of the three entry points (bundler, CDN script tag, or stylesheet only) you are using — they behave differently, and that is the first thing that needs establishing.

Please include the version or commit you observed it on. The bug form asks for all of this.
