/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LcarsElement } from './base';

/** `object`, so interface types are accepted, which `Record<string, unknown>` rejects. */
export type LcarsTableRow = object;
export type LcarsTableAlign = 'start' | 'center' | 'end';
export type LcarsTableSortDirection = 'ascending' | 'descending';

export interface LcarsTableColumn {
  /** Property of the row this column shows and sorts by. */
  key: string;
  /** Header text. */
  label: string;
  sortable?: boolean;
  align?: LcarsTableAlign;
  /** Sets the column in the monospace font. */
  mono?: boolean;
  /**
   * Cell content: a string, a DOM node or a Lit template. Defaults to the row's
   * value. A single DOM node is kept for its row object and column, so this
   * runs once for such a cell. Anything else, a fragment or an array of nodes
   * included, runs on every update.
   */
  render?(row: LcarsTableRow): unknown;
}

export interface LcarsSortEventDetail {
  key: string;
  direction: LcarsTableSortDirection;
}

const collator = new Intl.Collator(undefined, { numeric: true });

const cellValue = (row: LcarsTableRow, key: string): unknown =>
  (row as Record<string, unknown>)[key];

const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || value === '' || Number.isNaN(value);

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  return collator.compare(String(a), String(b));
}

/**
 * `<lcars-table>` renders tabular data with sortable headers, scrolling
 * horizontally inside its own box.
 */
export class LcarsTable extends LcarsElement {
  static override styles = css`
    :host([hidden]) {
      display: none;
    }

    :host {
      display: block;
      box-sizing: border-box;
      min-width: 0;
      max-width: 100%;
    }

    /* The padding is the room for the widest focus ring in the library: this
       box clips at its padding edge, so a control in a cell at the edge would
       otherwise lose part of its outline. */
    .scroll {
      overflow-x: auto;
      /* Positioned content is only clipped by a scroller that contains it. */
      position: relative;
      padding: calc(var(--lcars-border-width, 3px) + 2px);
      box-sizing: border-box;
    }

    .scroll:focus-visible {
      outline: 2px solid var(--lcars-color-primary, #ff9900);
      outline-offset: -2px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-sm, 0.875rem);
      letter-spacing: var(--lcars-letter-spacing-wide, 0.08em);
      color: var(--lcars-color-text);
    }

    th,
    td {
      padding: var(--lcars-gap-sm, 4px) var(--lcars-gap-md, 8px);
      text-align: var(--cell-align, start);
      white-space: nowrap;
      /* The user-agent default is middle, which misaligns mixed fonts. */
      vertical-align: baseline;
    }

    th {
      background-color: var(--table-color);
      color: var(--lcars-color-on-accent, #000000);
      font-size: var(--lcars-font-size-xs, 0.75rem);
      font-weight: bold;
      text-transform: uppercase;
    }

    th:first-child {
      border-top-left-radius: var(--lcars-radius-sm, 6px);
      border-bottom-left-radius: var(--lcars-radius-sm, 6px);
    }

    th:last-child {
      border-top-right-radius: var(--lcars-radius-sm, 6px);
      border-bottom-right-radius: var(--lcars-radius-sm, 6px);
    }

    td {
      border-bottom: var(--lcars-border-width-sm, 1.5px) solid var(--lcars-color-surface);
    }

    td.mono {
      font-family: var(--lcars-font-mono, monospace);
      letter-spacing: normal;
    }

    .sort {
      display: inline-flex;
      align-items: center;
      gap: var(--lcars-gap-sm, 4px);
      margin: 0;
      padding: 0;
      border: none;
      border-radius: var(--lcars-radius-sm, 6px);
      background: none;
      color: inherit;
      font: inherit;
      letter-spacing: inherit;
      text-transform: inherit;
      cursor: pointer;
    }

    /* On the cell, not the button: on-accent text is black, and brightening
       black shows nothing. */
    th[aria-sort]:hover {
      filter: brightness(var(--lcars-hover-brightness, 1.2));
    }

    th[aria-sort]:active {
      filter: brightness(var(--lcars-active-brightness, 1.4));
    }

    .sort:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    /* A triangle from borders, so its position owes nothing to font metrics. */
    .sort-indicator {
      width: 0;
      height: 0;
      border-inline: 4px solid transparent;
      border-block-end: 6px solid currentColor;
      visibility: hidden;
    }

    th[aria-sort='ascending'] .sort-indicator,
    th[aria-sort='descending'] .sort-indicator {
      visibility: visible;
    }

    th[aria-sort='descending'] .sort-indicator {
      transform: rotate(180deg);
    }
  `;

  @property({ attribute: false })
  columns: LcarsTableColumn[] = [];

  @property({ attribute: false })
  rows: LcarsTableRow[] = [];

  @property({ type: String, attribute: 'sort-key' })
  sortKey = '';

  @property({ type: String, attribute: 'sort-direction' })
  sortDirection: LcarsTableSortDirection = 'ascending';

  @property({ type: String })
  color = 'primary';

  /** Accessible name of the table and its scroll region. */
  @property({ type: String })
  label = 'Table';

  /**
   * Nodes from `render`, by row object, then by that row's listing in `rows`,
   * then by column index. A node sits in one place only, so a row object listed
   * twice needs a set per listing.
   */
  private keptNodes = new WeakMap<LcarsTableRow, Node[][]>();

  private overflowObserver?: ResizeObserver;

  private get sortedRows(): LcarsTableRow[] {
    const key = this.sortKey;
    if (!this.columns.some((column) => column.key === key && column.sortable)) {
      return this.rows;
    }
    const sign = this.sortDirection === 'descending' ? -1 : 1;
    return [...this.rows].sort((a, b) => {
      const [left, right] = [cellValue(a, key), cellValue(b, key)];
      if (isEmpty(left) || isEmpty(right)) {
        return Number(isEmpty(left)) - Number(isEmpty(right));
      }
      return sign * compareValues(left, right);
    });
  }

  private handleSort(key: string): void {
    const reverse = this.sortKey === key && this.sortDirection === 'ascending';
    this.sortKey = key;
    this.sortDirection = reverse ? 'descending' : 'ascending';
    this.dispatchEvent(
      new CustomEvent<LcarsSortEventDetail>('lcars-sort', {
        bubbles: true,
        composed: true,
        detail: { key, direction: this.sortDirection },
      })
    );
  }

  // A native button repeats Enter while the key is held.
  private handleSortKeyDown(event: KeyboardEvent): void {
    if (event.repeat) {
      event.preventDefault();
    }
  }

  private ariaSortOf(column: LcarsTableColumn): string | typeof nothing {
    if (!column.sortable) {
      return nothing;
    }
    if (column.key !== this.sortKey) {
      return 'none';
    }
    return this.sortDirection === 'descending' ? 'descending' : 'ascending';
  }

  private renderHeader(column: LcarsTableColumn): TemplateResult {
    return html`
      <th
        scope="col"
        aria-sort="${this.ariaSortOf(column)}"
        style="--cell-align: ${column.align ?? 'start'};"
      >
        ${column.sortable
          ? html`<button
              class="sort"
              type="button"
              @click=${() => this.handleSort(column.key)}
              @keydown=${this.handleSortKeyDown}
            >
              ${column.label}<span class="sort-indicator" aria-hidden="true"></span>
            </button>`
          : column.label}
      </th>
    `;
  }

  private keepNode(row: LcarsTableRow, listing: number, index: number, node: Node): void {
    const listings = this.keptNodes.get(row) ?? [];
    this.keptNodes.set(row, listings);
    (listings[listing] ??= [])[index] = node;
  }

  private cellContent(
    column: LcarsTableColumn,
    index: number,
    row: LcarsTableRow,
    listing: number
  ): unknown {
    if (!column.render) {
      return cellValue(row, column.key) ?? '';
    }
    const kept = this.keptNodes.get(row)?.[listing]?.[index];
    if (kept) {
      return kept;
    }
    const content = column.render(row);
    // Inserting a fragment empties it, so a kept one would render nothing.
    if (content instanceof Node && !(content instanceof DocumentFragment)) {
      this.keepNode(row, listing, index, content);
    }
    return content;
  }

  private renderCell(column: LcarsTableColumn, content: unknown): TemplateResult {
    return html`
      <td
        class="${column.mono ? 'mono' : ''}"
        style="--cell-align: ${column.align ?? 'start'};"
      >
        ${content}
      </td>
    `;
  }

  private renderRow(row: LcarsTableRow, listing: number): TemplateResult {
    return html`
      <tr>
        ${this.columns.map((column, index) =>
          this.renderCell(column, this.cellContent(column, index, row, listing))
        )}
      </tr>
    `;
  }

  private get scrollBox(): HTMLElement | null {
    return this.renderRoot.querySelector('.scroll');
  }

  // Set here and not in the template: it takes layout to know, so a reactive
  // value would queue a second update from inside `updated`. A focused box
  // keeps it until blur, because removing it would drop keyboard focus.
  private syncTabStop(): void {
    const box = this.scrollBox;
    if (box && box.scrollWidth > box.clientWidth) {
      box.setAttribute('tabindex', '0');
    } else if (this.shadowRoot?.activeElement !== box) {
      box?.removeAttribute('tabindex');
    }
  }

  // The box follows its container, the table follows content that changes
  // without an update, such as a late font.
  private observeOverflow(): void {
    this.overflowObserver ??= new ResizeObserver(() => this.syncTabStop());
    this.overflowObserver.observe(this.scrollBox!);
    this.overflowObserver.observe(this.scrollBox!.querySelector('table')!);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.observeOverflow();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.overflowObserver?.disconnect();
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    if (changedProperties.has('columns')) {
      this.keptNodes = new WeakMap();
    }
  }

  protected override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    if (this.isConnected) {
      this.observeOverflow();
    }
  }

  override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    this.syncTabStop();
  }

  override render(): TemplateResult {
    const tableColor = this.resolveColor(this.color, '--lcars-color-primary');
    const listings = new Map<LcarsTableRow, number>();

    return html`
      <div
        class="scroll"
        role="region"
        aria-label="${this.label}"
        style="--table-color: ${tableColor};"
        @blur=${this.syncTabStop}
      >
        <table aria-label="${this.label}">
          <thead>
            <tr>
              ${this.columns.map((column) => this.renderHeader(column))}
            </tr>
          </thead>
          <tbody>
            ${this.sortedRows.map((row) => {
              const listing = listings.get(row) ?? 0;
              listings.set(row, listing + 1);
              return this.renderRow(row, listing);
            })}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-table': LcarsTable;
  }
}
