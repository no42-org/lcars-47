/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { describe, it, expect } from 'vitest';
import * as lcars from '../src/index';

// Guards the public entry point: a symbol dropped from the barrel is invisible
// to suites that import their module directly.
describe('public barrel exports', () => {
  it('re-exports the documented runtime API', () => {
    for (const name of [
      'VERSION',
      'LCARS_THEMES',
      'resolveLcarsTheme',
      'setLcarsTheme',
      'getLcarsTheme',
      'LcarsAudio',
      'LcarsAudioSynthesizer',
      'playLcarsSound',
      'muteAudio',
      'LcarsElement',
      'LcarsFrame',
      'LcarsElbow',
      'LcarsButton',
      'LcarsPanel',
      'LcarsReadout',
      'LcarsBargraph',
      'LcarsStatusPill',
      'LcarsKeypad',
    ]) {
      expect(lcars, `missing export: ${name}`).toHaveProperty(name);
    }
  });

  it('exposes LcarsAudio.mute() per SPEC CAP-3', () => {
    expect(typeof lcars.LcarsAudio.mute).toBe('function');
  });

  it('registers every documented custom element', () => {
    for (const tag of [
      'lcars-frame',
      'lcars-elbow',
      'lcars-button',
      'lcars-panel',
      'lcars-readout',
      'lcars-bargraph',
      'lcars-status-pill',
      'lcars-keypad',
    ]) {
      expect(customElements.get(tag), `unregistered element: ${tag}`).toBeDefined();
    }
  });
});
