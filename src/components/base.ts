/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { setLcarsTheme, type LcarsEraTheme } from '../theme';

/**
 * Base element for all LCARS web components.
 * Provides shared theme resolution, theme lifecycle reflection, and color property utilities.
 */
export class LcarsElement extends LitElement {
  @property({ type: String, reflect: true })
  theme?: LcarsEraTheme;

  override updated(changedProperties: Map<string, unknown>): void {
    super.updated(changedProperties);
    if (changedProperties.has('theme')) {
      if (this.theme) {
        setLcarsTheme(this.theme, this);
      } else {
        this.removeAttribute('data-lcars-theme');
      }
    }
  }

  /**
   * Resolves a color name or variable to a valid CSS color value.
   * Handles semantic names ('primary', 'secondary', 'accent', 'warning', 'alert')
   * as well as palette names ('butterscotch', 'ice-blue', 'teal', etc.).
   */
  protected resolveColor(colorName?: string, defaultToken = '--lcars-color-primary'): string {
    if (!colorName) {
      return `var(${defaultToken})`;
    }

    const namedTokens: Record<string, string> = {
      // Functional tokens
      primary: '--lcars-color-primary',
      secondary: '--lcars-color-secondary',
      accent: '--lcars-color-accent',
      info: '--lcars-color-info',
      warning: '--lcars-color-warning',
      alert: '--lcars-color-alert',
      surface: '--lcars-color-surface',
      // TNG Era
      butterscotch: '--lcars-tng-butterscotch',
      gold: '--lcars-tng-gold',
      tan: '--lcars-tng-tan',
      lilac: '--lcars-tng-lilac',
      violet: '--lcars-tng-violet',
      red: '--lcars-tng-red',
      // DS9 Era
      'ice-blue': '--lcars-ds9-ice-blue',
      'dark-blue': '--lcars-ds9-dark-blue',
      magenta: '--lcars-ds9-magenta',
      'light-purple': '--lcars-ds9-light-purple',
      amber: '--lcars-ds9-amber',
      'alert-red': '--lcars-ds9-alert-red',
      // Nemesis Era
      teal: '--lcars-nemesis-teal',
      'deep-teal': '--lcars-nemesis-deep-teal',
      'nemesis-gold': '--lcars-nemesis-gold',
      'light-cyan': '--lcars-nemesis-light-cyan',
      'nemesis-alert-red': '--lcars-nemesis-alert-red',
      // Contrast Mode
      cyan: '--lcars-contrast-cyan',
      green: '--lcars-contrast-green',
      'contrast-amber': '--lcars-contrast-amber',
      'contrast-white': '--lcars-contrast-white',
    };

    if (Object.hasOwn(namedTokens, colorName)) {
      return `var(${namedTokens[colorName]})`;
    }

    if (colorName.startsWith('--')) {
      return `var(${colorName})`;
    }

    return colorName;
  }
}
