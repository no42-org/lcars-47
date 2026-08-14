/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import * as LcarsSrc from '../src/index';

describe('LCARS Distribution Package Contracts', () => {
  it('exports semantic version and theme constants', () => {
    expect(LcarsSrc.VERSION).toBeDefined();
    expect(typeof LcarsSrc.VERSION).toBe('string');
    expect(LcarsSrc.LCARS_THEMES).toEqual(['tng', 'ds9', 'nemesis', 'contrast']);
    expect(LcarsSrc.LCARS_THEME_ALIASES).toBeDefined();
  });

  it('exports theme management functions', () => {
    expect(typeof LcarsSrc.setLcarsTheme).toBe('function');
    expect(typeof LcarsSrc.getLcarsTheme).toBe('function');
    expect(typeof LcarsSrc.resolveLcarsTheme).toBe('function');
  });

  it('exports procedural audio APIs', () => {
    expect(typeof LcarsSrc.playLcarsSound).toBe('function');
    expect(typeof LcarsSrc.setAudioVolume).toBe('function');
    expect(typeof LcarsSrc.getAudioVolume).toBe('function');
    expect(typeof LcarsSrc.muteAudio).toBe('function');
    expect(typeof LcarsSrc.unmuteAudio).toBe('function');
    expect(typeof LcarsSrc.isAudioMuted).toBe('function');
    expect(typeof LcarsSrc.resumeAudio).toBe('function');
    expect(typeof LcarsSrc.closeAudio).toBe('function');
    expect(typeof LcarsSrc.getAudioSynthesizer).toBe('function');
  });

  it('registers all 7 custom elements in customElements registry', () => {
    const registered = [
      customElements.get('lcars-frame'),
      customElements.get('lcars-elbow'),
      customElements.get('lcars-button'),
      customElements.get('lcars-panel'),
      customElements.get('lcars-readout'),
      customElements.get('lcars-bargraph'),
      customElements.get('lcars-status-pill'),
    ];

    for (const ctor of registered) {
      expect(ctor).toBeDefined();
    }
  });

  it('exports all component constructors', () => {
    expect(LcarsSrc.LcarsElement).toBeDefined();
    expect(LcarsSrc.LcarsFrame).toBeDefined();
    expect(LcarsSrc.LcarsElbow).toBeDefined();
    expect(LcarsSrc.LcarsButton).toBeDefined();
    expect(LcarsSrc.LcarsPanel).toBeDefined();
    expect(LcarsSrc.LcarsReadout).toBeDefined();
    expect(LcarsSrc.LcarsBargraph).toBeDefined();
    expect(LcarsSrc.LcarsStatusPill).toBeDefined();
  });
});
