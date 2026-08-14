/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../src/index';
import { LcarsButton } from '../src/components/lcars-button';
import { LcarsElbow } from '../src/components/lcars-elbow';
import { LcarsPanel } from '../src/components/lcars-panel';
import { LcarsFrame } from '../src/components/lcars-frame';

describe('LCARS Geometric Framework Components', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('<lcars-button>', () => {
    it('renders with default pill shape and primary color', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      button.textContent = 'ENGAGE';
      document.body.appendChild(button);
      await button.updateComplete;

      expect(button.getAttribute('role')).toBe('button');
      expect(button.getAttribute('aria-disabled')).toBe('false');
      expect(button.tabIndex).toBe(0);

      const inner = button.shadowRoot?.querySelector('.button-inner');
      expect(inner?.classList.contains('shape-pill')).toBe(true);
      expect(inner?.getAttribute('style')).toContain('background-color: var(--lcars-color-primary);');
    });

    it('renders different shapes and bracket styling', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      button.shape = 'pill-start';
      document.body.appendChild(button);
      await button.updateComplete;

      let inner = button.shadowRoot?.querySelector('.button-inner');
      expect(inner?.classList.contains('shape-pill-start')).toBe(true);

      button.shape = 'bracket';
      button.color = 'secondary';
      await button.updateComplete;
      inner = button.shadowRoot?.querySelector('.button-inner');
      expect(inner?.classList.contains('shape-bracket')).toBe(true);
      expect(inner?.getAttribute('style')).toContain('color: var(--lcars-color-secondary);');
    });

    it('applies active class when active property is true', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      button.active = true;
      document.body.appendChild(button);
      await button.updateComplete;

      const inner = button.shadowRoot?.querySelector('.button-inner');
      expect(inner?.classList.contains('active')).toBe(true);
    });

    it('dispatches lcars-click event on mouse click with resolved color', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      button.color = 'alert';
      button.sound = 'warning';
      document.body.appendChild(button);
      await button.updateComplete;

      const inner = button.shadowRoot?.querySelector('.button-inner');
      expect(inner?.getAttribute('style')).toContain('background-color: var(--lcars-color-alert);');

      const clickSpy = vi.fn();
      button.addEventListener('lcars-click', clickSpy);

      button.click();

      expect(clickSpy).toHaveBeenCalledTimes(1);
      const customEvent = clickSpy.mock.calls[0][0] as CustomEvent;
      expect(customEvent.detail).toEqual({
        color: 'alert',
        shape: 'pill',
        sound: 'warning',
      });
    });

    it('dispatches lcars-click event on Enter and Space keydown without auto-repeating', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      document.body.appendChild(button);
      await button.updateComplete;

      const clickSpy = vi.fn();
      button.addEventListener('lcars-click', clickSpy);

      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Repeat keydown should be ignored
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true }));
      expect(clickSpy).toHaveBeenCalledTimes(1);

      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(clickSpy).toHaveBeenCalledTimes(2);
    });

    it('does not dispatch events when disabled', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      button.disabled = true;
      document.body.appendChild(button);
      await button.updateComplete;

      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.tabIndex).toBe(-1);

      const clickSpy = vi.fn();
      button.addEventListener('lcars-click', clickSpy);

      button.click();
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('reflects theme property to data-lcars-theme attribute', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      button.theme = 'nemesis';
      document.body.appendChild(button);
      await button.updateComplete;

      expect(button.getAttribute('data-lcars-theme')).toBe('nemesis');

      button.theme = undefined;
      await button.updateComplete;
      expect(button.hasAttribute('data-lcars-theme')).toBe(false);
    });
  });

  describe('<lcars-elbow>', () => {
    it('renders directional elbows with correct row classes and text', async () => {
      const elbow = document.createElement('lcars-elbow') as LcarsElbow;
      elbow.dir = 'top-left';
      elbow.title = 'SYS-47';
      elbow.label = 'SEC-01';
      elbow.color = 'butterscotch';
      document.body.appendChild(elbow);
      await elbow.updateComplete;

      const container = elbow.shadowRoot?.querySelector('.elbow-container');
      expect(container?.classList.contains('top-left')).toBe(true);

      const row = elbow.shadowRoot?.querySelector('.top-row');
      expect(row).not.toBeNull();

      const arch = elbow.shadowRoot?.querySelector('.arch');
      expect(arch?.getAttribute('style')).toContain('background-color: var(--lcars-tng-butterscotch);');

      const titleSpan = elbow.shadowRoot?.querySelector('.title-text');
      expect(titleSpan?.textContent).toBe('SYS-47');

      const labelSpan = elbow.shadowRoot?.querySelector('.label-text');
      expect(labelSpan?.textContent).toBe('SEC-01');

      elbow.dir = 'bottom-right';
      await elbow.updateComplete;
      expect(container?.classList.contains('bottom-right')).toBe(true);
      const bottomRow = elbow.shadowRoot?.querySelector('.bottom-row');
      expect(bottomRow).not.toBeNull();
    });

    it('defaults to top-left when direction is invalid', async () => {
      const elbow = document.createElement('lcars-elbow') as LcarsElbow;
      // @ts-expect-error testing invalid direction fallback
      elbow.dir = 'invalid-dir';
      document.body.appendChild(elbow);
      await elbow.updateComplete;

      const container = elbow.shadowRoot?.querySelector('.elbow-container');
      expect(container?.classList.contains('top-left')).toBe(true);
    });
  });

  describe('<lcars-panel>', () => {
    it('renders panel with header, title, and subtitle', async () => {
      const panel = document.createElement('lcars-panel') as LcarsPanel;
      panel.title = 'PROPULSION MATRIX';
      panel.subtitle = 'DIAGNOSTIC';
      panel.color = 'accent';
      document.body.appendChild(panel);
      await panel.updateComplete;

      const titleEl = panel.shadowRoot?.querySelector('.panel-title');
      expect(titleEl?.textContent).toBe('PROPULSION MATRIX');

      const subtitleEl = panel.shadowRoot?.querySelector('.panel-subtitle');
      expect(subtitleEl?.textContent).toBe('DIAGNOSTIC');

      const container = panel.shadowRoot?.querySelector('.panel-container');
      expect(container?.classList.contains('bordered')).toBe(true);
      expect(container?.getAttribute('style')).toContain('--panel-color: var(--lcars-color-accent);');
    });

    it('supports borderless mode and omits header when title and subtitle are empty', async () => {
      const panel = document.createElement('lcars-panel') as LcarsPanel;
      panel.bordered = false;
      document.body.appendChild(panel);
      await panel.updateComplete;

      const container = panel.shadowRoot?.querySelector('.panel-container');
      expect(container?.classList.contains('bordered')).toBe(false);

      const header = panel.shadowRoot?.querySelector('.panel-header');
      expect(header).toBeNull();
    });
  });

  describe('<lcars-frame>', () => {
    it('renders frame grid and applies theme attribute', async () => {
      const frame = document.createElement('lcars-frame') as LcarsFrame;
      frame.theme = 'ds9';
      document.body.appendChild(frame);
      await frame.updateComplete;

      expect(frame.getAttribute('data-lcars-theme')).toBe('ds9');
      const grid = frame.shadowRoot?.querySelector('.frame-grid');
      expect(grid).not.toBeNull();
    });
  });
});
