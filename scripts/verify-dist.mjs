/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

// Build smoke check: all four dist artifacts exist, the ES entry externalizes
// lit, and the IIFE bundle is self-contained (no module syntax).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '../dist');
const errors = [];

const read = (name) => {
  try {
    return readFileSync(resolve(dist, name), 'utf8');
  } catch {
    errors.push(`missing artifact: dist/${name}`);
    return null;
  }
};

const esm = read('index.js');
const iife = read('lcars.iife.js');
read('lcars.css');
read('index.d.ts');

if (esm && !/from\s*["']lit["']/.test(esm)) {
  errors.push('dist/index.js does not import lit — externalization broken');
}
if (iife && /^\s*import\s/m.test(iife)) {
  errors.push('dist/lcars.iife.js contains top-level import — not self-contained');
}

if (errors.length > 0) {
  console.error('verify-dist FAILED:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('verify-dist OK: 4 artifacts present, ES externalizes lit, IIFE self-contained');
