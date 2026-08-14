/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

// Build smoke check: every published artifact is a non-empty regular file, the
// ES entry externalizes lit (so consumers dedupe it), the IIFE bundle is
// self-contained for CDN use, and the documented export subpaths resolve.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir =
  typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : fileURLToPath(new URL('.', import.meta.url));

const root = resolve(baseDir, '..');
const dist = resolve(root, 'dist');

const required = ['index.js', 'lcars.iife.js', 'lcars.css', 'index.d.ts'];
const errors = [];
const contents = new Map();

// Single read per artifact: existence, regular-file-ness and non-emptiness all
// fall out of it, with no TOCTOU window between checks.
for (const name of required) {
  try {
    const text = readFileSync(resolve(dist, name), 'utf8');
    if (text.length === 0) {
      errors.push(`dist/${name} is empty (0 bytes)`);
    }
    contents.set(name, text);
  } catch (err) {
    errors.push(
      err.code === 'EISDIR'
        ? `dist/${name} is a directory, expected a file`
        : `dist/${name} is missing or unreadable (${err.code ?? err.message})`
    );
  }
}

// Anchored to a statement boundary so a bare `lit` inside an inlined copy
// cannot satisfy the check.
const es = contents.get('index.js');
if (es !== undefined && !/(^|[;\n])\s*import\s[^;]*?from\s*['"]lit(\/[^'"]*)?['"]/m.test(es)) {
  errors.push('dist/index.js does not externalize lit (no top-level import from "lit")');
}

const iife = contents.get('lcars.iife.js');
if (iife !== undefined && (/^\s*import\b/m.test(iife) || /^\s*export\b/m.test(iife))) {
  errors.push('dist/lcars.iife.js contains top-level import/export; expected self-contained IIFE');
}

// Public API symbols must survive declaration rollup. test/dist.test.ts makes
// the same assertion, but its block is skipped when no build is present, so
// this postbuild check is the one that always runs.
const dts = contents.get('index.d.ts');
if (dts !== undefined) {
  for (const symbol of [
    'LcarsAudio',
    'LcarsFrame',
    'LcarsBargraph',
    'LcarsKeypad',
    'LcarsChangeEventDetail',
    'LcarsSubmitEventDetail',
    'setLcarsTheme',
  ]) {
    // Word-anchored: a substring test would let a renamed `LcarsKeypadXX`
    // satisfy the check for `LcarsKeypad`.
    // Anchored to an export: declaration rollup's realistic failure is
    // emitting a declaration that is no longer re-exported from the entry.
    if (!new RegExp(`export[^\\n]*\\b${symbol}\\b|export \\{[^}]*\\b${symbol}\\b`).test(dts)) {
      errors.push(`dist/index.d.ts does not declare ${symbol}`);
    }
  }
}

// The README documents these specifiers; a narrowed exports map must keep them
// resolvable.
try {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  for (const subpath of ['.', './css', './iife']) {
    if (!pkg.exports?.[subpath]) {
      errors.push(`package.json exports is missing the documented subpath "${subpath}"`);
    }
  }
  if (pkg.license !== 'LGPL-3.0-or-later') {
    errors.push(`package.json license is "${pkg.license}", expected LGPL-3.0-or-later`);
  }
} catch (err) {
  errors.push(`could not read package.json (${err.code ?? err.message})`);
}

if (errors.length) {
  console.error('verify-dist FAILED:\n - ' + errors.join('\n - '));
  process.exit(1);
}

console.log(
  `verify-dist OK: ${required.length} artifacts present and non-empty, ES externalizes lit, ` +
    'IIFE self-contained, public API declared in index.d.ts, documented export subpaths resolve'
);
