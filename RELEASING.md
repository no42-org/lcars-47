<!--
Copyright 2026 Ronny Trommer <ronny@no42.org>
SPDX-License-Identifier: LGPL-3.0-or-later
-->

# Releasing

Versions follow [SemVer](https://semver.org/), derived from the [Conventional Commits](https://www.conventionalcommits.org/) since the previous tag: a `BREAKING CHANGE` or `!` bumps major, `feat` bumps minor, anything else bumps patch.

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

## Not yet wired up

**Publishing to the npm registry.** The release workflow builds and signs the tarball but does not `npm publish` it. Doing so needs an `NPM_TOKEN` secret and a deliberate decision to make the package public, since the repository is currently private. When that happens, publish with `--provenance` so npm carries the same attestation, and document the registry URL here.

**Preview builds from `main`.** The audit checklist expects a rolling preview. This project ships no container image, so the useful equivalent is a `preview` prerelease refreshed on each push to `main`. Not implemented yet.
