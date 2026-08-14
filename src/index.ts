/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import './tokens/index.css';

import { LcarsElement } from './components/base';
import { LcarsFrame } from './components/lcars-frame';
import { LcarsElbow, type LcarsElbowDirection } from './components/lcars-elbow';
import {
  LcarsButton,
  type LcarsButtonShape,
  type LcarsClickEventDetail,
} from './components/lcars-button';
import { LcarsPanel } from './components/lcars-panel';
import { LcarsReadout, type LcarsReadoutAlign } from './components/lcars-readout';
import { LcarsBargraph, type LcarsBargraphOrientation } from './components/lcars-bargraph';
import { LcarsStatusPill, type LcarsSystemStatus } from './components/lcars-status-pill';

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

// Export Procedural Audio Subsystem
export {
  type LcarsSoundType,
  type LcarsAudioOptions,
  type LcarsSoundHandle,
  LcarsAudioSynthesizer,
  getAudioSynthesizer,
  playLcarsSound,
  setAudioVolume,
  getAudioVolume,
  muteAudio,
  unmuteAudio,
  isAudioMuted,
  resumeAudio,
  closeAudio,
} from './audio/index';

// Export Components & Event Types
export {
  LcarsElement,
  LcarsFrame,
  LcarsElbow,
  type LcarsElbowDirection,
  LcarsButton,
  type LcarsButtonShape,
  type LcarsClickEventDetail,
  LcarsPanel,
  LcarsReadout,
  type LcarsReadoutAlign,
  LcarsBargraph,
  type LcarsBargraphOrientation,
  LcarsStatusPill,
  type LcarsSystemStatus,
};

// Register custom elements, guarded so a second evaluation of the module
// (dual bundle, HMR, CDN + bundler) does not throw NotSupportedError.
const define = (name: string, ctor: CustomElementConstructor): void => {
  if (typeof customElements !== 'undefined' && !customElements.get(name)) {
    customElements.define(name, ctor);
  }
};

define('lcars-frame', LcarsFrame);
define('lcars-elbow', LcarsElbow);
define('lcars-button', LcarsButton);
define('lcars-panel', LcarsPanel);
define('lcars-readout', LcarsReadout);
define('lcars-bargraph', LcarsBargraph);
define('lcars-status-pill', LcarsStatusPill);
