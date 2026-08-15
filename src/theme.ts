/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

export const VERSION = '0.0.1';

export type LcarsEraTheme = 'tng' | 'ds9' | 'nemesis' | 'contrast';

export type LcarsThemeAlias = 'voyager' | 'refit' | 'accessible';

export type LcarsThemeName = LcarsEraTheme | LcarsThemeAlias;

export const LCARS_THEMES: readonly LcarsEraTheme[] = ['tng', 'ds9', 'nemesis', 'contrast'] as const;

export const LCARS_THEME_ALIASES: Readonly<Record<LcarsThemeAlias, LcarsEraTheme>> = {
  voyager: 'ds9',
  refit: 'nemesis',
  accessible: 'contrast',
} as const;

/**
 * Resolve a theme or alias name to the canonical era theme identifier.
 */
export function resolveLcarsTheme(themeName: string): LcarsEraTheme {
  if (LCARS_THEMES.includes(themeName as LcarsEraTheme)) {
    return themeName as LcarsEraTheme;
  }
  if (Object.hasOwn(LCARS_THEME_ALIASES, themeName)) {
    return LCARS_THEME_ALIASES[themeName as LcarsThemeAlias];
  }
  return 'tng';
}

/**
 * Apply an LCARS era theme to an element or root document.
 */
export function setLcarsTheme(
  theme?: LcarsThemeName | null,
  target?: HTMLElement | null
): void {
  const el = target ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!el) {
    return;
  }
  if (theme) {
    const resolved = resolveLcarsTheme(theme);
    el.setAttribute('data-lcars-theme', resolved);
  } else {
    el.removeAttribute('data-lcars-theme');
  }
}

/**
 * Retrieve current active LCARS era theme from an element or root document.
 */
export function getLcarsTheme(
  target?: HTMLElement | null
): LcarsEraTheme {
  const el = target ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!el) {
    return 'tng';
  }
  const current = el.getAttribute('data-lcars-theme');
  return current ? resolveLcarsTheme(current) : 'tng';
}
