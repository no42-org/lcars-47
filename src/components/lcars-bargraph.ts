/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { html, css, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LcarsElement, valueReservationStyle } from './base';

export type LcarsBargraphOrientation = 'horizontal' | 'vertical';

/**
 * `<lcars-bargraph>` renders a segmented or continuous level gauge with dynamic threshold color shifts.
 */
export class LcarsBargraph extends LcarsElement {
  static override styles = css`
    :host {
      display: inline-flex;
      flex-direction: column;
      box-sizing: border-box;
      user-select: none;
    }

    .bargraph-wrapper {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      gap: var(--lcars-gap-xs, 2px);
    }

    .bargraph-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--lcars-gap-sm, 4px);
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-xs, 0.75rem);
      font-weight: bold;
      letter-spacing: var(--lcars-letter-spacing-wide, 0.08em);
      text-transform: uppercase;
      color: var(--bar-active-color, var(--lcars-color-primary));
    }

    /* The numeric part of a live value gets a width-stable box, or the value's
       left edge shimmers at telemetry rate: bold Antonio's digit advances are
       proportional and tabular-nums has no tnum feature to activate. Same
       reservation as lcars-readout — digits at the advance of '0' (1ch),
       others at half, rounded up to whole pixels — using the letter-spacing
       declared on the header above; keep the two in step. geometricPrecision
       is load-bearing: FreeType's per-glyph advance hinting made '7' wider
       than '0' at this 12px size, defeating any '0'-based charge; it forces
       true fractional metrics. min-width needs a box, hence inline-block. */
    .bargraph-value-number {
      display: inline-block;
      text-rendering: geometricPrecision;
      min-width: calc(
        var(--value-digits, 0) *
          (round(up, 1ch, 1px) + var(--lcars-letter-spacing-wide, 0.08em)) +
          var(--value-others, 0) *
          (round(up, 0.5ch, 1px) + var(--lcars-letter-spacing-wide, 0.08em))
      );
    }

    .bargraph-track {
      display: flex;
      box-sizing: border-box;
      background-color: rgba(255, 255, 255, 0.05);
      border-radius: var(--lcars-radius-sm, 6px);
      overflow: hidden;
    }

    /* Horizontal track */
    .bargraph-track.horizontal {
      flex-direction: row;
      height: var(--lcars-bar-height-sm, 18px);
      width: var(--lcars-bargraph-length, 140px);
      gap: 2px;
      padding: 2px;
    }

    /* Vertical track. Needs a definite height so the continuous bar's
       percentage height has something to resolve against. */
    .bargraph-track.vertical {
      flex-direction: column-reverse;
      width: var(--lcars-bar-height-sm, 18px);
      height: var(--lcars-bargraph-length, 140px);
      gap: 2px;
      padding: 2px;
    }

    /* Segment block */
    .segment {
      flex: 1;
      border-radius: 2px;
      transition: background-color 0.15s ease, opacity 0.15s ease;
      background-color: var(--bar-active-color, var(--lcars-color-primary));
      opacity: 0.15;
    }

    .segment.filled {
      opacity: 1;
    }

    /* Continuous fill bar */
    .continuous-bar {
      border-radius: 2px;
      background-color: var(--bar-active-color, var(--lcars-color-primary));
      transition: width 0.15s ease, height 0.15s ease, background-color 0.15s ease;
    }

    .continuous-bar.horizontal {
      height: 100%;
    }

    .continuous-bar.vertical {
      width: 100%;
    }
  `;

  @property({ type: Number })
  value = 0;

  @property({ type: Number })
  min = 0;

  @property({ type: Number })
  max = 100;

  @property({ type: Number })
  segments = 10;

  // Inverted rather than `segmented = true`: a default-true boolean property
  // cannot be switched off from markup, since the converter never runs for an
  // absent attribute.
  @property({ type: Boolean })
  continuous = false;

  @property({ type: Number, attribute: 'warning-threshold' })
  warningThreshold?: number;

  @property({ type: Number, attribute: 'alert-threshold' })
  alertThreshold?: number;

  @property({ type: String })
  color = 'primary';

  @property({ type: String })
  orientation: LcarsBargraphOrientation = 'horizontal';

  @property({ type: String })
  label = '';

  @property({ type: Boolean, attribute: 'show-value' })
  showValue = false;

  @property({ type: String })
  unit = '';

  @property({ type: Number })
  precision?: number;

  private get isSegmentedMode(): boolean {
    return !this.continuous;
  }

  private get normalizedValue(): number {
    const val = Number.isFinite(this.value) ? this.value : 0;
    const minVal = Number.isFinite(this.min) ? this.min : 0;
    const maxVal = Number.isFinite(this.max) ? this.max : 100;
    return Math.max(minVal, Math.min(maxVal, val));
  }

  private get percentage(): number {
    const minVal = Number.isFinite(this.min) ? this.min : 0;
    const maxVal = Number.isFinite(this.max) ? this.max : 100;
    const range = maxVal - minVal;
    if (!Number.isFinite(range) || range <= 0) {
      return 0;
    }
    return ((this.normalizedValue - minVal) / range) * 100;
  }

  private get activeColor(): string {
    if (this.alertThreshold !== undefined && this.normalizedValue >= this.alertThreshold) {
      return 'var(--lcars-color-alert, #cc3333)';
    }
    if (this.warningThreshold !== undefined && this.normalizedValue >= this.warningThreshold) {
      return 'var(--lcars-color-warning, #ffaa00)';
    }
    return this.resolveColor(this.color, '--lcars-color-primary');
  }

  private formatDisplayValue(): string {
    if (this.precision !== undefined && Number.isFinite(this.precision)) {
      const prec = Math.max(0, Math.min(20, Math.floor(this.precision)));
      return this.normalizedValue.toFixed(prec);
    }
    return String(Math.round(this.normalizedValue));
  }

  override render(): TemplateResult {
    const barColor = this.activeColor;
    const percent = this.percentage;
    const minVal = Number.isFinite(this.min) ? this.min : 0;
    const maxVal = Number.isFinite(this.max) ? this.max : 100;
    const segCount = Number.isFinite(this.segments) ? Math.floor(this.segments) : 10;
    const clampedSegments = Math.max(1, Math.min(100, segCount));

    // Floor, so displayed fill never exceeds the actual reading.
    let filledCount = Math.floor((percent / 100) * clampedSegments);
    if (percent > 0 && filledCount === 0) {
      filledCount = 1;
    } else if (percent < 100 && filledCount === clampedSegments) {
      filledCount = clampedSegments - 1;
    }

    const orientationClass = this.orientation === 'vertical' ? 'vertical' : 'horizontal';
    const displayVal = this.formatDisplayValue();

    return html`
      <div
        class="bargraph-wrapper"
        style="--bar-active-color: ${barColor};"
        role="progressbar"
        aria-valuenow="${this.normalizedValue}"
        aria-valuemin="${minVal}"
        aria-valuemax="${maxVal}"
        aria-valuetext="${displayVal}${this.unit ? ` ${this.unit}` : ''}"
        aria-label="${this.label ? `${this.label}: ` : ''}${displayVal}${this.unit ? ` ${this.unit}` : ''}"
      >
        ${this.label || this.showValue
          ? html`
              <div class="bargraph-header">
                ${this.label ? html`<span class="bargraph-label">${this.label}</span>` : ''}
                ${this.showValue
                  ? html`<span class="bargraph-value"
                      ><span class="bargraph-value-number" style="${valueReservationStyle(displayVal)}"
                        >${displayVal}</span
                      >${this.unit ? ` ${this.unit}` : ''}</span
                    >`
                  : ''}
              </div>
            `
          : ''}

        <div class="bargraph-track ${orientationClass}">
          ${this.isSegmentedMode
            ? Array.from({ length: clampedSegments }, (_, i) => {
                const isFilled = i < filledCount;
                return html`<div class="segment ${isFilled ? 'filled' : ''}"></div>`;
              })
            : html`
                <div
                  class="continuous-bar ${orientationClass}"
                  style="${orientationClass === 'horizontal' ? `width: ${percent}%;` : `height: ${percent}%;`}"
                ></div>
              `}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-bargraph': LcarsBargraph;
  }
}
