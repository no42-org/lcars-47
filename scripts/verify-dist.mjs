/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync, statSync, existsSync } from 'node:fs';
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

for (const f of required) {
  const p = resolve(dist, f);
  if (!existsSync(p)) {
    errors.push(`missing dist/${f}`);
  } else {
    const stats = statSync(p);
    if (stats.size === 0) {
      errors.push(`dist/${f} is empty (0 bytes)`);
    }
  }
}

const read = (name) => {
  const p = resolve(dist, name);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

const es = read('index.js');
if (es && !/from\s*['"]lit(\/.*)?['"]/.test(es)) {
  errors.push('dist/index.js does not seem to externalize lit (no import from "lit" found)');
}

const iife = read('lcars.iife.js');
if (iife && (/^\s*import\b/m.test(iife) || /^\s*export\b/m.test(iife))) {
  errors.push('dist/lcars.iife.js contains top-level import/export; expected self-contained IIFE');
}

if (errors.length) {
  console.error('verify-dist FAILED:\n - ' + errors.join('\n - '));
  process.exit(1);
}

console.log('verify-dist OK: 4 artifacts present and non-empty, ES externalizes lit, IIFE self-contained');
