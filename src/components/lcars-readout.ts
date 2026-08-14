/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { html, css, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LcarsElement } from './base';

export type LcarsReadoutAlign = 'left' | 'center' | 'right';

/**
 * `<lcars-readout>` renders a high-precision numeric or telemetry display with tabular spacing.
 */
export class LcarsReadout extends LcarsElement {
  static override styles = css`
    :host {
      display: inline-flex;
      flex-direction: column;
      box-sizing: border-box;
      user-select: none;
    }

    .readout-container {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .readout-container.align-left {
      align-items: flex-start;
      text-align: left;
    }

    .readout-container.align-center {
      align-items: center;
      text-align: center;
    }

    .readout-container.align-right {
      align-items: flex-end;
      text-align: right;
    }

    .readout-label {
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-xs, 0.75rem);
      font-weight: bold;
      letter-spacing: var(--lcars-letter-spacing-widest, 0.12em);
      text-transform: uppercase;
      color: var(--readout-color, var(--lcars-color-primary));
      opacity: 0.9;
      margin-bottom: var(--lcars-gap-xs, 2px);
      white-space: nowrap;
    }

    .readout-value-row {
      display: inline-flex;
      align-items: baseline;
      gap: var(--lcars-gap-xs, 2px);
    }

    .readout-prefix {
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-lg, 1.25rem);
      font-weight: bold;
      color: var(--readout-color, var(--lcars-color-primary));
      opacity: 0.8;
    }

    .readout-value {
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-2xl, 2rem);
      font-weight: bold;
      font-variant-numeric: tabular-nums;
      letter-spacing: var(--lcars-letter-spacing-normal, 0.05em);
      line-height: var(--lcars-line-height-tight, 1.1);
      color: var(--readout-color, var(--lcars-color-primary));
    }

    .readout-unit {
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-sm, 0.875rem);
      font-weight: bold;
      letter-spacing: var(--lcars-letter-spacing-wide, 0.08em);
      text-transform: uppercase;
      color: var(--readout-color, var(--lcars-color-primary));
      opacity: 0.85;
      margin-left: var(--lcars-gap-xs, 2px);
    }
  `;

  @property({ type: String })
  label = '';

  @property({ type: String })
  value: string | number | null = null;

  @property({ type: String })
  unit = '';

  @property({ type: String })
  color = 'primary';

  @property({ type: String, attribute: 'prefix' })
  valuePrefix = '';

  @property({ type: String })
  placeholder = '--';

  @property({ type: Number })
  precision?: number;

  @property({ type: String })
  align: LcarsReadoutAlign = 'left';

  // Opt-in: a readout driven at telemetry rates would otherwise queue an
  // announcement per frame and block all other screen-reader speech.
  @property({ type: Boolean })
  announce = false;

  private formatValue(): string {
    if (this.value === null || this.value === undefined) {
      return this.placeholder;
    }

    const strVal = String(this.value).trim();
    if (strVal === '') {
      return this.placeholder;
    }

    const prec =
      this.precision !== undefined && Number.isFinite(this.precision)
        ? Math.max(0, Math.min(20, Math.floor(this.precision)))
        : undefined;

    if (typeof this.value === 'number') {
      if (!Number.isFinite(this.value)) {
        return this.placeholder;
      }
      return prec !== undefined ? this.value.toFixed(prec) : String(this.value);
    }

    const num = Number(strVal);
    if (!Number.isNaN(num) && Number.isFinite(num) && prec !== undefined) {
      return num.toFixed(prec);
    }

    return strVal;
  }

  override render(): TemplateResult {
    const textColor = this.resolveColor(this.color, '--lcars-color-primary');
    const alignClass = `align-${this.align}`;
    const displayValue = this.formatValue();

    return html`
      <div
        class="readout-container ${alignClass}"
        style="--readout-color: ${textColor};"
        role="${this.announce ? 'status' : 'group'}"
        aria-live="${this.announce ? 'polite' : 'off'}"
        aria-atomic="true"
        aria-label="${this.label ? `${this.label}: ` : ''}${displayValue}${this.unit ? ` ${this.unit}` : ''}"
      >
        ${this.label ? html`<span class="readout-label">${this.label}</span>` : ''}
        <div class="readout-value-row">
          ${this.valuePrefix ? html`<span class="readout-prefix">${this.valuePrefix}</span>` : ''}
          <span class="readout-value">${displayValue}</span>
          ${this.unit ? html`<span class="readout-unit">${this.unit}</span>` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-readout': LcarsReadout;
  }
}
