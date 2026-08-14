/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { describe, it, expect, beforeEach } from 'vitest';
import '../src/index';
import { LcarsReadout } from '../src/components/lcars-readout';
import { LcarsBargraph } from '../src/components/lcars-bargraph';
import { LcarsStatusPill } from '../src/components/lcars-status-pill';

describe('LCARS Telemetry & Data Displays', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('<lcars-readout>', () => {
    it('renders label, formatted value, and unit badge', async () => {
      const readout = document.createElement('lcars-readout') as LcarsReadout;
      readout.label = 'WARP OUTPUT';
      readout.value = 9.94;
      readout.unit = 'COCHRANES';
      readout.precision = 2;
      document.body.appendChild(readout);
      await readout.updateComplete;

      const labelEl = readout.shadowRoot?.querySelector('.readout-label');
      expect(labelEl?.textContent).toBe('WARP OUTPUT');

      const valueEl = readout.shadowRoot?.querySelector('.readout-value');
      expect(valueEl?.textContent).toBe('9.94');

      const unitEl = readout.shadowRoot?.querySelector('.readout-unit');
      expect(unitEl?.textContent).toBe('COCHRANES');
    });

    it('renders fallback when value is null, undefined, or empty', async () => {
      const readout = document.createElement('lcars-readout') as LcarsReadout;
      readout.placeholder = 'OFFLINE';
      document.body.appendChild(readout);
      await readout.updateComplete;

      const valueEl = readout.shadowRoot?.querySelector('.readout-value');
      expect(valueEl?.textContent).toBe('OFFLINE');
    });

    it('renders prefix and alignment classes', async () => {
      const readout = document.createElement('lcars-readout') as LcarsReadout;
      readout.valuePrefix = 'SEC-';
      readout.value = '47';
      readout.align = 'right';
      document.body.appendChild(readout);
      await readout.updateComplete;

      const prefixEl = readout.shadowRoot?.querySelector('.readout-prefix');
      expect(prefixEl?.textContent).toBe('SEC-');

      const container = readout.shadowRoot?.querySelector('.readout-container');
      expect(container?.classList.contains('align-right')).toBe(true);
    });

    it('safely clamps extreme precision values', async () => {
      const readout = document.createElement('lcars-readout') as LcarsReadout;
      readout.value = 3.14159265;
      readout.precision = 1000;
      document.body.appendChild(readout);
      await readout.updateComplete;

      const valueEl = readout.shadowRoot?.querySelector('.readout-value');
      expect(valueEl?.textContent).toBeDefined();
    });
  });

  describe('<lcars-bargraph>', () => {
    it('renders segmented level bar and calculates filled segments', async () => {
      const bar = document.createElement('lcars-bargraph') as LcarsBargraph;
      bar.value = 50;
      bar.min = 0;
      bar.max = 100;
      bar.segments = 10;
      document.body.appendChild(bar);
      await bar.updateComplete;

      const segments = bar.shadowRoot?.querySelectorAll('.segment');
      expect(segments?.length).toBe(10);

      const filled = bar.shadowRoot?.querySelectorAll('.segment.filled');
      expect(filled?.length).toBe(5);
    });

    it('renders header with label, showValue, unit, and precision', async () => {
      const bar = document.createElement('lcars-bargraph') as LcarsBargraph;
      bar.label = 'WARP CORE';
      bar.showValue = true;
      bar.unit = '%';
      bar.value = 75.4;
      bar.precision = 1;
      document.body.appendChild(bar);
      await bar.updateComplete;

      const labelEl = bar.shadowRoot?.querySelector('.bargraph-label');
      expect(labelEl?.textContent).toBe('WARP CORE');

      const valEl = bar.shadowRoot?.querySelector('.bargraph-value');
      expect(valEl?.textContent).toBe('75.4 %');
    });

    it('clamps values below min and above max', async () => {
      const bar = document.createElement('lcars-bargraph') as LcarsBargraph;
      bar.value = 150;
      bar.min = 0;
      bar.max = 100;
      bar.segments = 10;
      document.body.appendChild(bar);
      await bar.updateComplete;

      const filled = bar.shadowRoot?.querySelectorAll('.segment.filled');
      expect(filled?.length).toBe(10);

      bar.value = -20;
      await bar.updateComplete;
      const filledMin = bar.shadowRoot?.querySelectorAll('.segment.filled');
      expect(filledMin?.length).toBe(0);
    });

    it('transitions to warning and alert colors when crossing thresholds', async () => {
      const bar = document.createElement('lcars-bargraph') as LcarsBargraph;
      bar.value = 75;
      bar.min = 0;
      bar.max = 100;
      bar.warningThreshold = 70;
      bar.alertThreshold = 90;
      document.body.appendChild(bar);
      await bar.updateComplete;

      const wrapper = bar.shadowRoot?.querySelector('.bargraph-wrapper');
      expect(wrapper?.getAttribute('style')).toContain('var(--lcars-color-warning');

      bar.value = 95;
      await bar.updateComplete;
      expect(wrapper?.getAttribute('style')).toContain('var(--lcars-color-alert');

      bar.value = 50;
      await bar.updateComplete;
      expect(wrapper?.getAttribute('style')).toContain('var(--lcars-color-primary');
    });

    it('supports continuous mode and vertical orientation', async () => {
      const bar = document.createElement('lcars-bargraph') as LcarsBargraph;
      bar.segmented = false;
      bar.orientation = 'vertical';
      bar.value = 40;
      document.body.appendChild(bar);
      await bar.updateComplete;

      const continuousBar = bar.shadowRoot?.querySelector('.continuous-bar');
      expect(continuousBar?.classList.contains('vertical')).toBe(true);
      expect(continuousBar?.getAttribute('style')).toContain('height: 40%;');
    });
  });

  describe('<lcars-status-pill>', () => {
    it('renders status state with code badge, label, and direct CSS custom property', async () => {
      const pill = document.createElement('lcars-status-pill') as LcarsStatusPill;
      pill.status = 'nominal';
      pill.code = '47-A';
      pill.label = 'ONLINE';
      document.body.appendChild(pill);
      await pill.updateComplete;

      const codeEl = pill.shadowRoot?.querySelector('.status-code');
      expect(codeEl?.textContent).toBe('47-A');

      const labelEl = pill.shadowRoot?.querySelector('.status-label');
      expect(labelEl?.textContent).toBe('ONLINE');

      const inner = pill.shadowRoot?.querySelector('.status-pill');
      expect(inner?.getAttribute('style')).toBe('--status-color: var(--lcars-color-primary, #ff9900);');
    });

    it('renders offline and standby states correctly', async () => {
      const pill = document.createElement('lcars-status-pill') as LcarsStatusPill;
      pill.status = 'offline';
      document.body.appendChild(pill);
      await pill.updateComplete;

      let inner = pill.shadowRoot?.querySelector('.status-pill');
      expect(inner?.getAttribute('style')).toContain('var(--lcars-color-surface-muted');

      pill.status = 'standby';
      await pill.updateComplete;
      inner = pill.shadowRoot?.querySelector('.status-pill');
      expect(inner?.getAttribute('style')).toContain('var(--lcars-color-secondary');
    });

    it('applies blinking animation for alert status or explicit blink property', async () => {
      const pill = document.createElement('lcars-status-pill') as LcarsStatusPill;
      pill.status = 'alert';
      document.body.appendChild(pill);
      await pill.updateComplete;

      let inner = pill.shadowRoot?.querySelector('.status-pill');
      expect(inner?.classList.contains('blinking')).toBe(true);
      expect(inner?.getAttribute('style')).toContain('var(--lcars-color-alert');

      pill.status = 'warning';
      pill.blink = true;
      await pill.updateComplete;
      inner = pill.shadowRoot?.querySelector('.status-pill');
      expect(inner?.classList.contains('blinking')).toBe(true);
      expect(inner?.getAttribute('style')).toContain('var(--lcars-color-warning');
    });
  });
});
