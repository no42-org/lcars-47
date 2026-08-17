/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../src/index';
import { setLcarsTheme } from '../src/theme';
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

    it('falls back to pill for invalid shape values', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      // @ts-expect-error testing invalid shape fallback
      button.shape = 'hexagon';
      document.body.appendChild(button);
      await button.updateComplete;

      const inner = button.shadowRoot?.querySelector('.button-inner');
      expect(inner?.classList.contains('shape-pill')).toBe(true);

      const clickSpy = vi.fn();
      button.addEventListener('lcars-click', clickSpy);
      button.click();
      expect((clickSpy.mock.calls[0][0] as CustomEvent).detail.shape).toBe('pill');
    });

    it('resolves custom-property, raw, empty, and unsafe color values', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      button.color = '--my-token';
      document.body.appendChild(button);
      await button.updateComplete;

      const inner = () => button.shadowRoot?.querySelector('.button-inner');
      expect(inner()?.getAttribute('style')).toContain('background-color: var(--my-token);');

      button.color = '#ff0000';
      await button.updateComplete;
      expect(inner()?.getAttribute('style')).toContain('background-color: #ff0000;');

      button.color = '';
      await button.updateComplete;
      expect(inner()?.getAttribute('style')).toContain('background-color: var(--lcars-color-primary);');

      // Injection attempt must fall back to the default token.
      button.color = 'red;outline: 900px solid red';
      await button.updateComplete;
      expect(inner()?.getAttribute('style')).toContain('background-color: var(--lcars-color-primary);');
      expect(inner()?.getAttribute('style')).not.toContain('outline');
    });

    it('applies active class and aria-pressed when active property is true', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      button.active = true;
      document.body.appendChild(button);
      await button.updateComplete;

      const inner = button.shadowRoot?.querySelector('.button-inner');
      expect(inner?.classList.contains('active')).toBe(true);
      expect(button.getAttribute('aria-pressed')).toBe('true');

      button.active = false;
      await button.updateComplete;
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('dispatches lcars-click event on mouse click with color name detail', async () => {
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

    it('dispatches lcars-click on Enter keydown and Space keyup without auto-repeating', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      document.body.appendChild(button);
      await button.updateComplete;

      const clickSpy = vi.fn();
      button.addEventListener('lcars-click', clickSpy);

      // Space keyup without a preceding keydown on this button must not activate
      button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      expect(clickSpy).not.toHaveBeenCalled();

      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Repeat keydown should be ignored
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true }));
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Space activates on keyup, matching native button behavior
      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(clickSpy).toHaveBeenCalledTimes(1);
      button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
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
      button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('respects author-set tabindex across disabled toggles', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      button.setAttribute('tabindex', '5');
      document.body.appendChild(button);
      await button.updateComplete;

      expect(button.tabIndex).toBe(5);

      button.disabled = true;
      await button.updateComplete;
      expect(button.tabIndex).toBe(-1);

      button.disabled = false;
      await button.updateComplete;
      expect(button.tabIndex).toBe(5);
    });

    it('reflects theme property to data-lcars-theme attribute and resolves aliases', async () => {
      const button = document.createElement('lcars-button') as LcarsButton;
      button.theme = 'nemesis';
      document.body.appendChild(button);
      await button.updateComplete;

      expect(button.getAttribute('data-lcars-theme')).toBe('nemesis');

      button.theme = 'voyager';
      await button.updateComplete;
      expect(button.getAttribute('data-lcars-theme')).toBe('ds9');

      button.theme = undefined;
      await button.updateComplete;
      expect(button.hasAttribute('data-lcars-theme')).toBe(false);
    });
  });

  describe('<lcars-elbow>', () => {
    it('renders directional elbows with correct row classes, color, and text', async () => {
      const elbow = document.createElement('lcars-elbow') as LcarsElbow;
      elbow.orientation = 'top-left';
      elbow.heading = 'SYS-47';
      elbow.label = 'SEC-01';
      elbow.color = 'butterscotch';
      document.body.appendChild(elbow);
      await elbow.updateComplete;

      const container = elbow.shadowRoot?.querySelector('.elbow-container');
      expect(container?.classList.contains('top-left')).toBe(true);
      expect(container?.getAttribute('style')).toContain('--elbow-color: var(--lcars-tng-butterscotch);');

      const row = elbow.shadowRoot?.querySelector('.top-row');
      expect(row).not.toBeNull();

      const titleSpan = elbow.shadowRoot?.querySelector('.title-text');
      expect(titleSpan?.textContent).toBe('SYS-47');

      const labelSpan = elbow.shadowRoot?.querySelector('.label-text');
      expect(labelSpan?.textContent).toBe('SEC-01');

      elbow.orientation = 'bottom-right';
      await elbow.updateComplete;
      expect(container?.classList.contains('bottom-right')).toBe(true);
      const bottomRow = elbow.shadowRoot?.querySelector('.bottom-row');
      expect(bottomRow).not.toBeNull();
    });

    it('defaults to top-left when orientation is invalid', async () => {
      const elbow = document.createElement('lcars-elbow') as LcarsElbow;
      // @ts-expect-error testing invalid orientation fallback
      elbow.orientation = 'invalid-dir';
      document.body.appendChild(elbow);
      await elbow.updateComplete;

      const container = elbow.shadowRoot?.querySelector('.elbow-container');
      expect(container?.classList.contains('top-left')).toBe(true);
    });

    it('drives orientation and heading from markup, without global-attribute aliases', async () => {
      document.body.innerHTML =
        '<lcars-elbow orientation="bottom-right" heading="LCARS 47"></lcars-elbow>';
      const elbow = document.body.firstElementChild as LcarsElbow;
      await elbow.updateComplete;

      expect(elbow.shadowRoot?.querySelector('.elbow-container')?.classList.contains('bottom-right')).toBe(true);
      expect(elbow.shadowRoot?.querySelector('.title-text')?.textContent).toBe('LCARS 47');
      // The reflected attribute must agree with what was rendered.
      expect(elbow.getAttribute('orientation')).toBe('bottom-right');

      // `title` is a reserved global attribute and must not drive the heading.
      document.body.innerHTML = '<lcars-elbow title="TOOLTIP"></lcars-elbow>';
      const tooltipElbow = document.body.firstElementChild as LcarsElbow;
      await tooltipElbow.updateComplete;
      expect(tooltipElbow.shadowRoot?.querySelector('.title-text')).toBeNull();
    });

    it('renders heading and label as slot fallback content so slotted content wins', async () => {
      const elbow = document.createElement('lcars-elbow') as LcarsElbow;
      elbow.heading = 'FALLBACK';
      document.body.appendChild(elbow);
      await elbow.updateComplete;

      const defaultSlot = elbow.shadowRoot?.querySelector('.bar-extension slot');
      expect(defaultSlot).not.toBeNull();
      expect(defaultSlot?.textContent).toContain('FALLBACK');

      const labelSlot = elbow.shadowRoot?.querySelector('slot[name="label"]');
      expect(labelSlot).not.toBeNull();
    });
  });

  describe('<lcars-panel>', () => {
    it('renders panel with header, heading, and subtitle', async () => {
      const panel = document.createElement('lcars-panel') as LcarsPanel;
      panel.heading = 'PROPULSION MATRIX';
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

    it('drives the header from heading, not the global title attribute', async () => {
      document.body.innerHTML = '<lcars-panel heading="PROPULSION" title="TOOLTIP"></lcars-panel>';
      const panel = document.body.firstElementChild as LcarsPanel;
      await panel.updateComplete;

      expect(panel.shadowRoot?.querySelector('.panel-title')?.textContent).toBe('PROPULSION');
    });

    it('supports no-border attribute and omits header when heading and subtitle are empty', async () => {
      const panel = document.createElement('lcars-panel') as LcarsPanel;
      panel.setAttribute('no-border', '');
      document.body.appendChild(panel);
      await panel.updateComplete;

      expect(panel.noBorder).toBe(true);
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
      // The host itself is the grid: a wrapper would mean two boxes owning the
      // frame's height, which is what pushed the footer row off screen (#19).
      // Asserted structurally, so any re-introduced wrapper fails this whatever
      // it is called.
      const main = frame.shadowRoot?.querySelector('.slot-main');
      expect(main).not.toBeNull();
      expect(main?.parentNode).toBe(frame.shadowRoot);
    });

    it('provides all named layout slots', async () => {
      const frame = document.createElement('lcars-frame') as LcarsFrame;
      document.body.appendChild(frame);
      await frame.updateComplete;

      for (const name of ['elbow-tl', 'top-bar', 'sidebar', 'main', 'footer-readout', 'footer', 'elbow-bl']) {
        expect(
          frame.shadowRoot?.querySelector(`slot[name="${name}"]`),
          `missing slot: ${name}`
        ).not.toBeNull();
      }

      // Default slot for unslotted content inside the main area
      expect(frame.shadowRoot?.querySelector('.slot-main slot:not([name])')).not.toBeNull();
    });

    it('assigns slotted children to their named slots', async () => {
      const frame = document.createElement('lcars-frame') as LcarsFrame;
      const sidebarChild = document.createElement('div');
      sidebarChild.setAttribute('slot', 'sidebar');
      frame.appendChild(sidebarChild);
      document.body.appendChild(frame);
      await frame.updateComplete;

      const sidebarSlot = frame.shadowRoot?.querySelector(
        'slot[name="sidebar"]'
      ) as HTMLSlotElement | null;
      expect(sidebarSlot?.assignedElements()).toContain(sidebarChild);
    });
  });

  describe('theme utilities', () => {
    it('setLcarsTheme with undefined clears the theme attribute', () => {
      const el = document.createElement('div');
      setLcarsTheme('tng', el);
      expect(el.getAttribute('data-lcars-theme')).toBe('tng');

      setLcarsTheme(undefined, el);
      expect(el.hasAttribute('data-lcars-theme')).toBe(false);
    });

    it('setLcarsTheme resolves aliases to canonical era identifiers', () => {
      const el = document.createElement('div');
      setLcarsTheme('voyager', el);
      expect(el.getAttribute('data-lcars-theme')).toBe('ds9');
    });
  });
});
