<!--
Copyright 2026 Ronny Trommer <ronny@no42.org>
SPDX-License-Identifier: LGPL-3.0-or-later
-->

# Releasing

Versions follow [SemVer](https://semver.org/), derived from the [Conventional Commits](https://www.conventionalcommits.org/) since the previous tag: a `BREAKING CHANGE` or `!` bumps major, `feat` bumps minor, anything else bumps patch.

**While the major version is `0`, every bump costs one digit less, floored at patch:**

| commits since the tag | from `1.0.0` onward | while `0.x` |
| :--- | :--- | :--- |
| `BREAKING CHANGE` or `!` | major | **minor** (`0.0.2` → `0.1.0`) |
| `feat` | minor | patch (`0.0.2` → `0.0.3`) |
| anything else | patch | patch (`0.0.2` → `0.0.3`) |

[SemVer §4](https://semver.org/#spec-item-4) permits this: major version zero is initial development and the public API is not to be considered stable, so a breaking change costs a minor rather than declaring 1.0.
The spec does not prescribe how to derive bumps within `0.x`; the mapping above is this project's choice.

Two consequences of being in `0.x`, both of which invert the usual reading of a version number:

- A feature release and a bugfix release are indistinguishable by version, and a minor bump means *something broke*, not *something was added*.
- No row can produce `1.0.0`. Leaving `0.x` is a deliberate decision that the public API is stable, taken by the maintainer, not derived from the commits.

A breaking change carries its `!` or its `BREAKING CHANGE:` footer either way — the marker is the migration note for consumers, independent of which digit it moves.

A release is triggered by **pushing a `vX.Y.Z` tag**. Nothing else publishes.

## Cutting a release

1. Ensure CI on `main` is green.
2. Open a PR bumping `version` in `package.json` (and the lockfile) to `X.Y.Z`, titled `chore(release): vX.Y.Z`. Merge it once CI passes. The release workflow **fails fast if the tag does not match the manifest version**, so this step is not optional.
3. Tag the merged bump commit and push it:

   ```bash
   git pull origin main
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

4. The `Release` workflow runs the same quality gates as CI, builds the artifacts, generates an SBOM, signs the checksums with cosign, attests build provenance, and creates a **draft** GitHub Release with everything attached.
5. Review the draft, add curated notes, and publish:

   ```bash
   gh release edit vX.Y.Z --notes-file notes.md --draft=false
   ```

Prerelease tags (`vX.Y.Z-rc1`) are detected by the hyphen and marked `--prerelease` automatically.

## What a release contains

| Asset | What it is |
| :--- | :--- |
| `no42-org-lcars-47-X.Y.Z.tgz` | The npm tarball — byte-identical to what would be published |
| `lcars.iife.js` | Self-contained browser bundle for a `<script>` tag |
| `lcars.css` | Standalone design tokens and layout stylesheet |
| `index.d.ts` | Bundled TypeScript declarations for the whole public API |
| `sbom.spdx.json` | SPDX software bill of materials |
| `checksums.txt` | SHA-256 of every other asset |
| `checksums.txt.bundle` | cosign keyless Sigstore bundle (signature + certificate) |

## Verifying a release

Checksums are signed with cosign keyless (GitHub OIDC), so verification needs no distributed public key:

```bash
cosign verify-blob checksums.txt \
  --bundle checksums.txt.bundle \
  --certificate-identity-regexp 'https://github.com/no42-org/lcars-47/\.github/workflows/release\.yml@.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

cosign v3 emits a single Sigstore bundle rather than separate `.sig` and `.pem` files.

Then confirm the artifact you downloaded appears in the verified `checksums.txt`:

```bash
sha256sum --check --ignore-missing checksums.txt
```

Build provenance for the npm tarball is attested to the GitHub attestation store:

```bash
gh attestation verify no42-org-lcars-47-X.Y.Z.tgz --repo no42-org/lcars-47
```

## Where the package is published

The release workflow publishes to **GitHub Packages** (`npm.pkg.github.com`) as its last step, after every other step has succeeded — publishing is the one action here that cannot be undone, since a version number cannot be reused.

It publishes the **exact tarball** that was checksummed, signed and attested, rather than repacking, so what a user installs is what the signature covers. Authentication uses the built-in `GITHUB_TOKEN`; there is no registry secret to manage. Prerelease tags publish under the `next` dist-tag so they never become `latest`.

Consumers must authenticate to install from GitHub Packages, **even though the package is public** — that is a registry limitation, not a licensing one. The README documents the `.npmrc` this needs, and points anyone who would rather not authenticate at the release assets, which serve anonymously.

## Not yet wired up

**Publishing to npmjs.com.** Would make `npm install` work with no `.npmrc` and no token, and would light up the unpkg and jsDelivr CDN paths, which mirror npmjs.com only and cannot serve GitHub Packages. It needs an npm account and an `NPM_TOKEN` secret. Publish with `--provenance` so npm carries the same SLSA attestation this pipeline already produces.

**Preview builds from `main`.** The audit checklist expects a rolling preview. This project ships no container image, so the useful equivalent is a `preview` prerelease refreshed on each push to `main`. Not implemented yet.
