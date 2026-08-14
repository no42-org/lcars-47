/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import './tokens/index.css';

// Export Themes & Utilities
export {
  VERSION,
  LCARS_THEMES,
  LCARS_THEME_ALIASES,
  type LcarsEraTheme,
  type LcarsThemeAlias,
  type LcarsThemeName,
  resolveLcarsTheme,
  setLcarsTheme,
  getLcarsTheme,
} from './theme';

// Export Components & Event Types
export { LcarsElement } from './components/base';
export { LcarsFrame } from './components/lcars-frame';
export { LcarsElbow, type LcarsElbowDirection } from './components/lcars-elbow';
export {
  LcarsButton,
  type LcarsButtonShape,
  type LcarsClickEventDetail,
} from './components/lcars-button';
export { LcarsPanel } from './components/lcars-panel';
