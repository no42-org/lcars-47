/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Symbol-level coverage of the source barrel lives in test/exports.test.ts.
// This file asserts the *published* contract: the package manifest and, when a
// build is present, the emitted artifacts themselves.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const distFile = (name: string): string | null => {
  const p = resolve(root, 'dist', name);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};
const hasBuild = distFile('index.js') !== null;

describe('LCARS Distribution Package Contracts', () => {
  describe('package manifest', () => {
    it('declares the documented export subpaths', () => {
      // Every specifier the README tells consumers to import.
      for (const subpath of ['.', './css', './tokens', './iife']) {
        expect(pkg.exports, `missing export subpath: ${subpath}`).toHaveProperty([subpath]);
      }
    });

    it('does not expose the whole dist directory as public API', () => {
      // A `./dist/*` wildcard would publish source maps and internal chunks,
      // freezing the build layout as a compatibility surface.
      expect(Object.keys(pkg.exports)).not.toContain('./dist/*');
    });

    it('points main, module, and types at the ESM build, not the IIFE', () => {
      expect(pkg.main).toBe('./dist/index.js');
      expect(pkg.module).toBe('./dist/index.js');
      expect(pkg.types).toBe('./dist/index.d.ts');
      expect(pkg.exports['.'].import).toBe('./dist/index.js');
    });

    it('declares the project license', () => {
      expect(pkg.license).toBe('LGPL-3.0-or-later');
    });

    it('marks the JS entries as side-effectful so registration is not tree-shaken', () => {
      expect(pkg.sideEffects).toContain('./dist/index.js');
    });

    it('routes CDN fields at the self-contained IIFE bundle', () => {
      expect(pkg.unpkg).toBe('./dist/lcars.iife.js');
      expect(pkg.jsdelivr).toBe('./dist/lcars.iife.js');
    });
  });

  describe.skipIf(!hasBuild)('built artifacts', () => {
    it('emits every artifact the exports map references', () => {
      for (const name of ['index.js', 'lcars.iife.js', 'lcars.css', 'index.d.ts']) {
        expect(distFile(name), `missing dist/${name}`).not.toBeNull();
      }
    });

    it('externalizes lit from the ESM bundle', () => {
      expect(distFile('index.js')).toMatch(/import\s[^;]*?from\s*['"]lit(\/[^'"]*)?['"]/);
    });

    it('ships a self-contained IIFE with no bare module syntax', () => {
      const iife = distFile('lcars.iife.js') ?? '';
      expect(iife).not.toMatch(/^\s*import\s/m);
      expect(iife).not.toMatch(/^\s*export\s/m);
      expect(iife).toContain('Lcars');
    });

    it('declares the public API in the type definitions', () => {
      const dts = distFile('index.d.ts') ?? '';
      for (const symbol of [
        'LcarsAudio',
        'LcarsFrame',
        'LcarsBargraph',
        'LcarsKeypad',
        'LcarsChangeEventDetail',
        'LcarsSubmitEventDetail',
        'setLcarsTheme',
      ]) {
        // Anchored to an export: a declaration that survives rollup but is no
        // longer re-exported from the entry is the realistic failure mode.
        expect(dts, `index.d.ts does not export ${symbol}`).toMatch(
          new RegExp(`export[^\\n]*\\b${symbol}\\b|export \\{[^}]*\\b${symbol}\\b`)
        );
      }
    });

    it('emits design tokens into the standalone stylesheet', () => {
      expect(distFile('lcars.css')).toContain('--lcars-color-primary');
    });
  });
});
