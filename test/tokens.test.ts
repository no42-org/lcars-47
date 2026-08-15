/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import {
  VERSION,
  LCARS_THEMES,
  LCARS_THEME_ALIASES,
  resolveLcarsTheme,
  setLcarsTheme,
  getLcarsTheme,
} from '../src/index';

describe('LCARS Design Tokens & Theme Manager', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-lcars-theme');
  });

  it('exports valid version and supported theme list', () => {
    expect(VERSION).toBe('0.0.1');
    expect(LCARS_THEMES).toEqual(['tng', 'ds9', 'nemesis', 'contrast']);
    expect(LCARS_THEME_ALIASES).toEqual({
      voyager: 'ds9',
      refit: 'nemesis',
      accessible: 'contrast',
    });
  });

  it('defaults to tng theme when no attribute is present', () => {
    expect(getLcarsTheme(document.documentElement)).toBe('tng');
    expect(getLcarsTheme(null)).toBe('tng');
    expect(getLcarsTheme(undefined)).toBe('tng');
  });

  it('resolves theme aliases correctly', () => {
    expect(resolveLcarsTheme('voyager')).toBe('ds9');
    expect(resolveLcarsTheme('refit')).toBe('nemesis');
    expect(resolveLcarsTheme('accessible')).toBe('contrast');
    expect(resolveLcarsTheme('unknown-theme')).toBe('tng');
  });

  it('ignores inherited object properties as theme names', () => {
    expect(resolveLcarsTheme('toString')).toBe('tng');
    expect(resolveLcarsTheme('constructor')).toBe('tng');
    expect(resolveLcarsTheme('hasOwnProperty')).toBe('tng');
  });

  it('sets and gets valid LCARS themes and aliases', () => {
    setLcarsTheme('ds9', document.documentElement);
    expect(getLcarsTheme(document.documentElement)).toBe('ds9');
    expect(document.documentElement.getAttribute('data-lcars-theme')).toBe('ds9');

    setLcarsTheme('voyager', document.documentElement);
    expect(getLcarsTheme(document.documentElement)).toBe('ds9');
    expect(document.documentElement.getAttribute('data-lcars-theme')).toBe('ds9');

    setLcarsTheme('nemesis', document.documentElement);
    expect(getLcarsTheme(document.documentElement)).toBe('nemesis');

    setLcarsTheme('refit', document.documentElement);
    expect(getLcarsTheme(document.documentElement)).toBe('nemesis');

    setLcarsTheme('contrast', document.documentElement);
    expect(getLcarsTheme(document.documentElement)).toBe('contrast');

    setLcarsTheme('accessible', document.documentElement);
    expect(getLcarsTheme(document.documentElement)).toBe('contrast');
  });

  it('sets theme on specific container elements and handles null targets gracefully', () => {
    const container = document.createElement('div');
    setLcarsTheme('ds9', container);
    expect(container.getAttribute('data-lcars-theme')).toBe('ds9');
    expect(getLcarsTheme(container)).toBe('ds9');

    expect(() => setLcarsTheme('tng', null)).not.toThrow();
  });
});

describe('CSS Design Token Source Verification', () => {
  const rootCss = readFileSync(resolve(__dirname, '../src/tokens/index.css'), 'utf-8');
  const colorsCss = readFileSync(resolve(__dirname, '../src/tokens/colors.css'), 'utf-8');
  const typographyCss = readFileSync(resolve(__dirname, '../src/tokens/typography.css'), 'utf-8');
  const geometryCss = readFileSync(resolve(__dirname, '../src/tokens/geometry.css'), 'utf-8');
  const themesCss = readFileSync(resolve(__dirname, '../src/tokens/themes.css'), 'utf-8');

  it('declares standard CSS layers in root stylesheet', () => {
    expect(rootCss).toContain('@layer tokens, reset, components, utilities;');
    expect(rootCss).toContain("@import './colors.css';");
    expect(rootCss).toContain("@import './typography.css';");
    expect(rootCss).toContain("@import './geometry.css';");
    expect(rootCss).toContain("@import './themes.css';");
  });

  it('defines required functional color tokens in themes.css only', () => {
    expect(themesCss).toContain('--lcars-color-primary');
    expect(themesCss).toContain('--lcars-color-secondary');
    expect(themesCss).toContain('--lcars-color-accent');
    expect(themesCss).toContain('--lcars-color-warning');
    expect(themesCss).toContain('--lcars-color-alert');
    expect(themesCss).toContain('--lcars-color-bg');
    expect(themesCss).toContain('--lcars-color-surface');
    expect(themesCss).toContain('--lcars-color-text');
    // Functional tokens must not be duplicated in colors.css (single source of truth).
    expect(colorsCss).not.toContain('--lcars-color-primary:');
  });

  it('defines all era color palettes', () => {
    // TNG
    expect(colorsCss).toContain('--lcars-tng-butterscotch: #ff9900;');
    expect(colorsCss).toContain('--lcars-tng-lilac: #cc99cc;');
    // DS9
    expect(colorsCss).toContain('--lcars-ds9-ice-blue: #99ccff;');
    expect(colorsCss).toContain('--lcars-ds9-magenta: #cc6699;');
    // Nemesis
    expect(colorsCss).toContain('--lcars-nemesis-teal: #00ccff;');
    expect(colorsCss).toContain('--lcars-nemesis-alert-red: #ff4444;');
    // Contrast
    expect(colorsCss).toContain('--lcars-contrast-amber: #ffaa00;');
    expect(colorsCss).toContain('--lcars-contrast-cyan: #33d6ff;');
  });

  it('defines typography tokens and bundled Antonio font-face', () => {
    expect(typographyCss).toContain("font-family: 'Antonio';");
    expect(typographyCss).toContain("url('./fonts/antonio-latin-var.woff2') format('woff2')");
    expect(typographyCss).toContain("url('./fonts/antonio-latin-ext-var.woff2') format('woff2')");
    expect(typographyCss).toContain('--lcars-font-family:');
    expect(typographyCss).toContain('--lcars-font-size-xs:');
    expect(typographyCss).toContain('--lcars-font-size-3xl:');
    expect(typographyCss).toContain('--lcars-letter-spacing-wide:');
  });

  it('defines geometry and layout tokens in geometry.css', () => {
    expect(geometryCss).toContain('--lcars-radius-elbow: 28px;');
    expect(geometryCss).toContain('--lcars-radius-pill: 14px;');
    expect(geometryCss).toContain('--lcars-bar-height: 28px;');
    expect(geometryCss).toContain('--lcars-touch-target-min-width: 80px;');
  });

  it('wires theme attribute selectors in themes.css', () => {
    expect(themesCss).toContain('[data-lcars-theme="tng"]');
    expect(themesCss).toContain('[data-lcars-theme="ds9"]');
    expect(themesCss).toContain('[data-lcars-theme="voyager"]');
    expect(themesCss).toContain('[data-lcars-theme="nemesis"]');
    expect(themesCss).toContain('[data-lcars-theme="refit"]');
    expect(themesCss).toContain('[data-lcars-theme="contrast"]');
    expect(themesCss).toContain('[data-lcars-theme="accessible"]');
  });
});
