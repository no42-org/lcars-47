/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

// Workflow pin check: when a step pins an action by commit SHA and also hands
// that same action a digest-pinned image, the two must name one version.
//
// Dependabot updates a `uses:` pin and its trailing comment. It does not touch
// a digest sitting in `with:`, so a bump splits the pair and leaves the action
// and the image a release apart. That shipped in #52 (action v0.8.1, image
// report-0.7.1) and stayed invisible because release.yml only runs on a tag
// push, so no gate ever evaluated the pair. See #53.
//
// zizmor resolves `uses:` pins against their upstream tags, which is what
// caught the stale pin itself, but it does not read `with:` inputs. Nothing
// else covers the pairing.
//
// Deliberately textual. Comments are not part of the YAML data model, so a
// parser would discard the version markers this exists to compare. It proves
// the two comments agree, not that either digest resolves upstream; verifying
// the image digest against GHCR would need a registry token this gate does
// not have.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir =
  typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : fileURLToPath(new URL('.', import.meta.url));

const workflows = resolve(baseDir, '..', '.github', 'workflows');

// `uses: owner/repo@<40-hex commit> # v1.2.3`, with or without the leading
// `- `: the list item is usually `- name:`, leaving `uses:` a plain key. The
// 40-hex bound keeps docker:// refs out, since those pin by 64-hex digest.
const ACTION_PIN = /^\s*-?\s*uses:\s*([\w.-]+\/[\w./-]+)@([0-9a-f]{40})\b\s*(?:#\s*(.*?))?\s*$/;
// `image: host/path@sha256:<64-hex> # report-1.2.3`, as a `with:` input.
const IMAGE_PIN = /^\s*([\w-]+):\s*(\S+?)@sha256:([0-9a-f]{64})\b\s*(?:#\s*(.*?))?\s*$/;
// A step is a list item keyed on one of the step-level fields. Anchoring on
// these keeps nested sequences (an `args:` list, say) from opening a block.
const STEP_START = /^(\s*)-\s+(?:name|uses|id|if|run|env|with):/;

const semver = (comment) => comment?.match(/\d+\.\d+\.\d+/)?.[0];

// Step blocks, as [start, end) line ranges. A block runs until the next step
// item at the same or shallower indent, so a deeper nested list stays inside.
function stepRanges(lines) {
  const starts = [];
  for (const [i, line] of lines.entries()) {
    const match = STEP_START.exec(line);
    if (match) starts.push({ index: i, indent: match[1].length });
  }
  return starts.map(({ index, indent }, n) => {
    const next = starts.slice(n + 1).find((s) => s.indent <= indent);
    return [index, next ? next.index : lines.length];
  });
}

const errors = [];

for (const file of readdirSync(workflows).filter((f) => /\.ya?ml$/.test(f))) {
  const lines = readFileSync(resolve(workflows, file), 'utf8').split('\n');

  for (const [start, end] of stepRanges(lines)) {
    const block = lines.slice(start, end);

    const actionLine = block.findIndex((l) => ACTION_PIN.test(l));
    if (actionLine === -1) continue;

    // `uses:` is excluded explicitly: a docker:// action ref is also a digest
    // pin, but it is the step's action, not an image handed to one.
    const images = block
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => IMAGE_PIN.test(line) && IMAGE_PIN.exec(line)[1] !== 'uses');
    if (images.length === 0) continue;

    const [, action, , actionComment] = ACTION_PIN.exec(block[actionLine]);
    const where = (i) => `${file}:${start + i + 1}`;
    const actionVersion = semver(actionComment);

    if (!actionVersion) {
      errors.push(
        `${where(actionLine)}: ${action} is pinned by SHA but its comment carries no version, ` +
          `so the image pinned alongside it cannot be checked against anything`
      );
      continue;
    }

    for (const { line, i } of images) {
      const [, key, image, , comment] = IMAGE_PIN.exec(line);
      const imageVersion = semver(comment);

      if (!imageVersion) {
        errors.push(
          `${where(i)}: ${key} pins ${image} by digest with no version comment; ` +
            `a reviewer cannot tell whether it matches ${action} ${actionVersion}`
        );
      } else if (imageVersion !== actionVersion) {
        errors.push(
          `${where(i)}: ${key} is ${image} ${imageVersion} but the step runs ${action} ` +
            `${actionVersion} (${where(actionLine)}); bump the digest and its comment together`
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Action and image pins disagree:\n');
  for (const error of errors) console.error(`  ${error}`);
  console.error('');
  process.exit(1);
}

console.log('Action and image pins agree.');
