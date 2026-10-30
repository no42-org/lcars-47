/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../src/index';
import { setLcarsTheme } from '../src/theme';
import { LcarsButton } from '../src/components/lcars-button';
import { LcarsElbow } from '../src/components/lcars-elbow';
import { LcarsPanel } from '../src/components/lcars-panel';
import { LcarsFrame } from '../src/components/lcars-frame';
import { LcarsChip } from '../src/components/lcars-chip';
import { LcarsTable, type LcarsTableColumn } from '../src/components/lcars-table';

describe('LCARS Geometric Framework Components', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('<lcars-chip>', () => {
    async function makeChip(attributes: Record<string, string> = {}): Promise<LcarsChip> {
      const chip = document.createElement('lcars-chip') as LcarsChip;
      chip.setAttribute('label', 'WARP');
      for (const [name, value] of Object.entries(attributes)) chip.setAttribute(name, value);
      document.body.appendChild(chip);
      await chip.updateComplete;
      return chip;
    }
    const toggleOf = (chip: LcarsChip) =>
      chip.shadowRoot?.querySelector('.chip-toggle') as HTMLButtonElement;
    const removeOf = (chip: LcarsChip) =>
      chip.shadowRoot?.querySelector('.chip-remove') as HTMLButtonElement;

    it('toggles pressed, exposes aria-pressed and fires one event', async () => {
      const chip = await makeChip();
      const toggled = vi.fn();
      chip.addEventListener('lcars-toggle', toggled);

      toggleOf(chip).click();
      await chip.updateComplete;

      expect(chip.pressed).toBe(true);
      expect(toggleOf(chip).getAttribute('aria-pressed')).toBe('true');
      expect(toggled).toHaveBeenCalledTimes(1);
      expect(toggled.mock.calls[0][0].detail).toEqual({ pressed: true, label: 'WARP' });
    });

    it('fires remove without toggling, and names the control', async () => {
      const chip = await makeChip({ removable: '' });
      const toggled = vi.fn();
      const removed = vi.fn();
      chip.addEventListener('lcars-toggle', toggled);
      chip.addEventListener('lcars-remove', removed);

      removeOf(chip).click();

      expect(removed).toHaveBeenCalledTimes(1);
      expect(toggled).not.toHaveBeenCalled();
      expect(chip.pressed).toBe(false);
    });

    it('reports the visible text, preferring slotted content', async () => {
      const chip = await makeChip({ removable: '' });
      chip.textContent = ' IMPULSE ';
      const removed = vi.fn();
      chip.addEventListener('lcars-remove', removed);
      removeOf(chip).click();
      expect(removed.mock.calls[0][0].detail).toEqual({ label: 'IMPULSE' });
    });

    it('lets remove-label replace the composed name', async () => {
      const chip = await makeChip({ removable: '', 'remove-label': 'Drop filter' });
      expect(removeOf(chip).getAttribute('aria-label')).toBe('Drop filter');
      expect(removeOf(chip).hasAttribute('aria-labelledby')).toBe(false);
    });

    it('renders no remove control unless removable', async () => {
      expect(removeOf(await makeChip())).toBeNull();
    });

    it('disables both controls', async () => {
      const chip = await makeChip({ removable: '', disabled: '' });
      expect(toggleOf(chip).disabled).toBe(true);
      expect(removeOf(chip).disabled).toBe(true);
    });
  });

  describe('<lcars-table>', () => {
    const columns: LcarsTableColumn[] = [
      { key: 'name', label: 'Vessel', sortable: true },
      { key: 'warp', label: 'Warp', sortable: true },
      { key: 'note', label: 'Note' },
    ];
    const rows = [
      { name: 'Voyager', warp: 9.975, note: 'A' },
      { name: 'Defiant', warp: 9.5, note: 'B' },
      { name: 'Runabout', warp: null, note: 'C' },
      { name: 'Enterprise', warp: 10, note: 'D' },
    ];

    async function makeTable(): Promise<LcarsTable> {
      const table = document.createElement('lcars-table') as LcarsTable;
      table.columns = columns;
      table.rows = rows;
      document.body.appendChild(table);
      await table.updateComplete;
      return table;
    }
    const headerOf = (table: LcarsTable, index: number) =>
      table.shadowRoot?.querySelectorAll('th')[index] as HTMLElement;
    const sortBy = async (table: LcarsTable, index: number) => {
      headerOf(table, index).querySelector('button')?.click();
      await table.updateComplete;
    };
    const column = (table: LcarsTable, index: number) =>
      Array.from(table.shadowRoot?.querySelectorAll('tbody tr') ?? []).map((row) =>
        row.querySelectorAll('td')[index].textContent?.trim()
      );

    it('renders rows in the given order until sorted', async () => {
      const table = await makeTable();
      expect(column(table, 0)).toEqual(['Voyager', 'Defiant', 'Runabout', 'Enterprise']);
      expect(headerOf(table, 0).getAttribute('aria-sort')).toBe('none');
      expect(headerOf(table, 2).hasAttribute('aria-sort')).toBe(false);
      expect(headerOf(table, 2).querySelector('button')).toBeNull();
    });

    it('sorts on activation, reverses on the next, and fires lcars-sort', async () => {
      const table = await makeTable();
      const sorted = vi.fn();
      table.addEventListener('lcars-sort', sorted);

      await sortBy(table, 0);
      expect(column(table, 0)).toEqual(['Defiant', 'Enterprise', 'Runabout', 'Voyager']);
      expect(headerOf(table, 0).getAttribute('aria-sort')).toBe('ascending');
      expect(sorted.mock.calls[0][0].detail).toEqual({ key: 'name', direction: 'ascending' });

      await sortBy(table, 0);
      expect(column(table, 0)).toEqual(['Voyager', 'Runabout', 'Enterprise', 'Defiant']);
      expect(headerOf(table, 0).getAttribute('aria-sort')).toBe('descending');
      expect(sorted).toHaveBeenCalledTimes(2);
    });

    it('sorts numbers numerically, keeps empty values last, and leaves rows alone', async () => {
      const table = await makeTable();
      await sortBy(table, 1);
      expect(column(table, 1)).toEqual(['9.5', '9.975', '10', '']);
      await sortBy(table, 1);
      expect(column(table, 1)).toEqual(['10', '9.975', '9.5', '']);
      expect(rows[0].name).toBe('Voyager');
    });

    it('treats NaN and empty strings as empty, and sorts dates by time', async () => {
      const table = await makeTable();
      table.columns = [
        { key: 'v', label: 'V', sortable: true },
        { key: 'd', label: 'D', sortable: true },
      ];
      table.rows = [
        { v: 3, d: new Date('2026-01-05') },
        { v: NaN, d: new Date('2026-10-30') },
        { v: 1, d: new Date('2025-06-01') },
        { v: '', d: null },
        { v: 2, d: new Date('2026-03-02') },
      ];
      await table.updateComplete;
      await sortBy(table, 0);
      expect(column(table, 0).slice(0, 3)).toEqual(['1', '2', '3']);

      await sortBy(table, 1);
      const years = column(table, 1).map((text) => text?.match(/\d{4}/)?.[0]);
      expect(years).toEqual(['2025', '2026', '2026', '2026', undefined]);
      expect(column(table, 0).slice(0, 3)).toEqual(['1', '3', '2']);
    });

    it('renders a row object that appears twice', async () => {
      const table = await makeTable();
      table.rows = [rows[0], rows[1], rows[0]];
      await table.updateComplete;
      expect(column(table, 0)).toEqual(['Voyager', 'Defiant', 'Voyager']);
    });

    it('moves aria-sort to the new column and starts it ascending', async () => {
      const table = await makeTable();
      await sortBy(table, 0);
      await sortBy(table, 0);
      await sortBy(table, 1);
      expect(headerOf(table, 0).getAttribute('aria-sort')).toBe('none');
      expect(headerOf(table, 1).getAttribute('aria-sort')).toBe('ascending');
    });

    it('sorts from attributes, and ignores a key that is not sortable', async () => {
      const table = document.createElement('lcars-table') as LcarsTable;
      table.setAttribute('sort-key', 'name');
      table.setAttribute('sort-direction', 'descending');
      table.columns = columns;
      table.rows = rows;
      document.body.appendChild(table);
      await table.updateComplete;
      expect(column(table, 0)[0]).toBe('Voyager');

      table.sortKey = 'note';
      await table.updateComplete;
      expect(column(table, 0)).toEqual(['Voyager', 'Defiant', 'Runabout', 'Enterprise']);
    });

    it('renders a DOM node from a column render function', async () => {
      const table = await makeTable();
      table.columns = [
        {
          key: 'name',
          label: 'Vessel',
          render: (row: { name: string }) => {
            const link = document.createElement('a');
            link.textContent = row.name;
            return link;
          },
        },
      ];
      await table.updateComplete;
      expect(table.shadowRoot?.querySelector('td a')?.textContent).toBe('Voyager');
    });

    describe('render returning a DOM node', () => {
      const inputColumn = (render = vi.fn(() => document.createElement('input'))) => ({
        render,
        column: { key: 'name', label: 'Vessel', sortable: true, render } as LcarsTableColumn,
      });
      const cellNodes = (table: LcarsTable) =>
        Array.from(table.shadowRoot?.querySelectorAll('td input') ?? []);

      it('keeps the node across updates and renders it once', async () => {
        const table = await makeTable();
        const { render, column: col } = inputColumn();
        table.columns = [col];
        await table.updateComplete;
        const before = cellNodes(table);

        table.color = 'accent';
        await table.updateComplete;

        expect(cellNodes(table)).toEqual(before);
        expect(cellNodes(table)[0]).toBe(before[0]);
        expect(render).toHaveBeenCalledTimes(rows.length);
      });

      it('renders a new row object fresh', async () => {
        const table = await makeTable();
        const { column: col } = inputColumn();
        table.columns = [col];
        table.rows = [rows[0], rows[1]];
        await table.updateComplete;
        const [first, second] = cellNodes(table);

        table.rows = [{ ...rows[0] }, rows[1]];
        await table.updateComplete;

        expect(cellNodes(table)[0]).not.toBe(first);
        expect(cellNodes(table)[1]).toBe(second);
      });

      it('drops kept nodes when columns change', async () => {
        const table = await makeTable();
        const { column: col } = inputColumn();
        table.columns = [col];
        await table.updateComplete;
        const before = cellNodes(table)[0];

        table.columns = [{ ...col }];
        await table.updateComplete;

        expect(cellNodes(table)[0]).not.toBe(before);
      });

      it('moves kept nodes with their rows on a re-sort', async () => {
        const table = await makeTable();
        const col: LcarsTableColumn = {
          key: 'name',
          label: 'Vessel',
          sortable: true,
          render: (row) => {
            const input = document.createElement('input');
            input.value = (row as { name: string }).name;
            return input;
          },
        };
        table.columns = [col];
        await table.updateComplete;
        const byName = new Map(
          (cellNodes(table) as HTMLInputElement[]).map((input) => [input.value, input])
        );

        await sortBy(table, 0);

        const after = cellNodes(table) as HTMLInputElement[];
        expect(after.map((input) => input.value)).toEqual([
          'Defiant',
          'Enterprise',
          'Runabout',
          'Voyager',
        ]);
        after.forEach((input) => expect(input).toBe(byName.get(input.value)));
      });

      it('gives a row object listed twice one node per listing, across updates', async () => {
        const table = await makeTable();
        const { column: col } = inputColumn();
        table.columns = [col];
        table.rows = [rows[0], rows[1], rows[0]];
        await table.updateComplete;
        const before = cellNodes(table);
        expect(before).toHaveLength(3);
        expect(new Set(before).size).toBe(3);

        table.color = 'accent';
        await table.updateComplete;

        const after = cellNodes(table);
        expect(after).toHaveLength(3);
        after.forEach((node, index) => expect(node).toBe(before[index]));
      });

      it('gives two columns of one row their own nodes', async () => {
        const table = await makeTable();
        const { column: col } = inputColumn();
        table.columns = [col, col];
        table.rows = [rows[0]];
        await table.updateComplete;
        expect(new Set(cellNodes(table)).size).toBe(2);
      });

      it('renders a fragment again on every update, since inserting empties it', async () => {
        const table = await makeTable();
        table.columns = [
          {
            key: 'name',
            label: 'Vessel',
            sortable: true,
            render: (row) => {
              const fragment = document.createDocumentFragment();
              fragment.append((row as { name: string }).name);
              return fragment;
            },
          },
        ];
        await table.updateComplete;
        await sortBy(table, 0);
        expect(column(table, 0)).toEqual(['Defiant', 'Enterprise', 'Runabout', 'Voyager']);
      });

      it('renders untyped primitive rows without keeping anything', async () => {
        const table = await makeTable();
        table.columns = [
          { key: 'x', label: 'X', render: (row) => String(row) },
          { key: 'y', label: 'Y' },
        ];
        table.rows = ['Enterprise', 'Defiant'] as unknown as object[];
        await table.updateComplete;
        expect(column(table, 0)).toEqual(['Enterprise', 'Defiant']);
      });

      it('keeps calling render for templates and strings', async () => {
        const table = await makeTable();
        const render = vi.fn((row: object) => (row as { name: string }).name);
        table.columns = [{ key: 'name', label: 'Vessel', render }];
        await table.updateComplete;
        const calls = render.mock.calls.length;

        table.color = 'accent';
        await table.updateComplete;

        expect(render.mock.calls.length).toBe(calls + rows.length);
      });
    });

    describe('scroll region tab stop', () => {
      const scrollOf = (table: LcarsTable) =>
        table.shadowRoot?.querySelector('.scroll') as HTMLElement;
      const setOverflow = (table: LcarsTable, overflowing: boolean) =>
        Object.defineProperty(scrollOf(table), 'scrollWidth', {
          configurable: true,
          get: () => (overflowing ? scrollOf(table).clientWidth + 1 : scrollOf(table).clientWidth),
        });

      class FakeObserver {
        static instances: FakeObserver[] = [];
        observed: Element[] = [];
        disconnects = 0;
        constructor(readonly callback: () => void) {
          FakeObserver.instances.push(this);
        }
        observe(target: Element) {
          this.observed.push(target);
        }
        unobserve() {}
        disconnect() {
          this.observed = [];
          this.disconnects += 1;
        }
      }

      beforeEach(() => {
        FakeObserver.instances = [];
        vi.stubGlobal('ResizeObserver', FakeObserver);
      });
      afterEach(() => vi.unstubAllGlobals());

      it('is no tab stop while the content fits, and keeps its role and label', async () => {
        const table = await makeTable();
        const scroll = scrollOf(table);
        expect(scroll.hasAttribute('tabindex')).toBe(false);
        expect(scroll.getAttribute('role')).toBe('region');
        expect(scroll.getAttribute('aria-label')).toBe('Table');
      });

      it('follows overflow on an update and on an observer report', async () => {
        const table = await makeTable();
        setOverflow(table, true);
        table.color = 'accent';
        await table.updateComplete;
        expect(scrollOf(table).getAttribute('tabindex')).toBe('0');

        setOverflow(table, false);
        FakeObserver.instances[0].callback();
        expect(scrollOf(table).hasAttribute('tabindex')).toBe(false);
      });

      it('observes the box and the table, and stops on disconnect until reconnected', async () => {
        const table = await makeTable();
        const observer = FakeObserver.instances[0];
        expect(observer.observed).toEqual([
          scrollOf(table),
          table.shadowRoot?.querySelector('table'),
        ]);

        table.remove();
        expect(observer.disconnects).toBe(1);
        expect(observer.observed).toEqual([]);

        document.body.appendChild(table);
        expect(observer.observed).toHaveLength(2);
      });
    });
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
      // The host is a size container and the grid sits inside it, because a
      // container query cannot style its own container. Exactly one of the two
      // declares a height: two boxes owning it is what drifted the footer row
      // off screen (#19).
      const grid = frame.shadowRoot?.querySelector('.frame-grid');
      expect(grid?.parentNode).toBe(frame.shadowRoot);
      expect(frame.shadowRoot?.querySelector('.slot-main')?.parentNode).toBe(grid);

      const styles = (frame.constructor as typeof LcarsFrame).styles?.toString() ?? '';
      const hostBlock = styles.match(/:host\s*\{[^}]*\}/)?.[0] ?? '';
      expect(hostBlock).toContain('container-type: inline-size');
      // Any height on the host is a second opinion about how tall the frame
      // is, including `height: 100%`, which only looks harmless while the
      // parent's height is indefinite. Grepping for the token alone missed it.
      expect(hostBlock).not.toMatch(/(^|[^-])height:/);
      // Containment zeroes the intrinsic width, so the host needs an explicit
      // one or the frame collapses wherever it is shrink-to-fit.
      expect(hostBlock).toMatch(/width:\s*100%/);
    });

    it('makes both scrollable regions focusable, and names them only on request', async () => {
      const frame = document.createElement('lcars-frame') as LcarsFrame;
      document.body.appendChild(frame);
      await frame.updateComplete;

      const main = frame.shadowRoot?.querySelector('.slot-main');
      const sidebar = frame.shadowRoot?.querySelector('.slot-sidebar');

      // Both scroll, so a keyboard-only user has to be able to reach them.
      expect(main?.getAttribute('tabindex')).toBe('0');
      expect(sidebar?.getAttribute('tabindex')).toBe('0');

      // No name by default: `main` and `aside` are landmarks that assistive
      // technology announces by role, so a hardcoded English string would add
      // nothing and would not be localisable.
      expect(main?.hasAttribute('aria-label')).toBe(false);
      expect(sidebar?.hasAttribute('aria-label')).toBe(false);

      frame.mainLabel = 'ENGINEERING TELEMETRY';
      frame.sidebarLabel = 'CONSOLE CONTROLS';
      await frame.updateComplete;

      expect(main?.getAttribute('aria-label')).toBe('ENGINEERING TELEMETRY');
      expect(sidebar?.getAttribute('aria-label')).toBe('CONSOLE CONTROLS');
    });

    it('drives the region labels from markup', async () => {
      document.body.innerHTML =
        '<lcars-frame main-label="SENSOR SWEEP" sidebar-label="NAV CONTROLS"></lcars-frame>';
      const frame = document.body.firstElementChild as LcarsFrame;
      await frame.updateComplete;

      expect(frame.shadowRoot?.querySelector('.slot-main')?.getAttribute('aria-label')).toBe(
        'SENSOR SWEEP'
      );
      expect(frame.shadowRoot?.querySelector('.slot-sidebar')?.getAttribute('aria-label')).toBe(
        'NAV CONTROLS'
      );
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
