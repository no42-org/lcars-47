/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { html, css, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LcarsElement } from './base';

export type LcarsSystemStatus = 'nominal' | 'warning' | 'alert' | 'offline' | 'standby';

/**
 * `<lcars-status-pill>` renders a diagnostic state indicator pill with threshold colors and pulse animations.
 */
export class LcarsStatusPill extends LcarsElement {
  static override styles = css`
    :host {
      display: inline-flex;
      box-sizing: border-box;
      user-select: none;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      min-height: var(--lcars-bar-height-sm, 18px);
      border-radius: var(--lcars-radius-pill, 14px);
      background-color: var(--status-color, var(--lcars-color-primary));
      color: var(--status-fg, var(--lcars-color-on-accent, #000000));
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-weight: bold;
      letter-spacing: var(--lcars-letter-spacing-wide, 0.08em);
      text-transform: uppercase;
      padding: 2px var(--lcars-gap-md, 8px);
      box-sizing: border-box;
      gap: var(--lcars-gap-sm, 4px);
    }

    /* Inverted chip: reuses the pill's own contrast-checked colour pair
       instead of a translucent overlay that darkens the background. */
    .status-code {
      font-size: var(--lcars-font-size-xs, 0.75rem);
      padding: 1px 4px;
      border-radius: 2px;
      background-color: var(--status-fg, var(--lcars-color-on-accent, #000000));
      color: var(--status-color, var(--lcars-color-primary));
      font-variant-numeric: tabular-nums;
    }

    .status-label {
      font-size: var(--lcars-font-size-xs, 0.75rem);
      white-space: nowrap;
    }

    /* Pulse animation */
    .status-pill.blinking {
      animation: lcars-pulse 1.2s infinite ease-in-out;
    }

    @keyframes lcars-pulse {
      0%,
      100% {
        opacity: 1;
        filter: brightness(1);
      }
      50% {
        opacity: 0.35;
        filter: brightness(1.4);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .status-pill.blinking {
        animation: none;
      }
    }
  `;

  @property({ type: String, reflect: true })
  status: LcarsSystemStatus = 'nominal';

  @property({ type: String })
  label = '';

  @property({ type: String })
  code = '';

  @property({ type: Boolean, reflect: true })
  blink = false;

  @property({ type: String })
  color?: string;

  private get statusColorToken(): string {
    if (this.color) {
      return this.resolveColor(this.color);
    }

    switch (this.status) {
      case 'warning':
        return 'var(--lcars-color-warning, #ffaa00)';
      case 'alert':
        return 'var(--lcars-color-alert, #cc3333)';
      case 'offline':
        return 'var(--lcars-color-surface-muted, #555566)';
      case 'standby':
        return 'var(--lcars-color-secondary, #cc99cc)';
      case 'nominal':
      default:
        return 'var(--lcars-color-primary, #ff9900)';
    }
  }

  /**
   * Foreground paired with each status colour so 0.75rem bold text stays above
   * the 4.5:1 WCAG AA threshold. Dark states (alert, offline) need light text.
   */
  private get statusForegroundToken(): string {
    if (this.color) {
      return 'var(--lcars-color-on-accent, #000000)';
    }

    switch (this.status) {
      case 'alert':
      case 'offline':
        return 'var(--lcars-color-on-accent-inverse, #ffffff)';
      default:
        return 'var(--lcars-color-on-accent, #000000)';
    }
  }

  override render(): TemplateResult {
    const isBlinking = this.blink || this.status === 'alert';
    const blinkClass = isBlinking ? 'blinking' : '';
    const colorStyle = this.statusColorToken;
    const fgStyle = this.statusForegroundToken;
    const displayLabel = this.label || this.status;

    return html`
      <div
        class="status-pill ${blinkClass}"
        style="--status-color: ${colorStyle}; --status-fg: ${fgStyle};"
        role="status"
        aria-label="System status: ${this.status}${this.code ? ` (${this.code})` : ''} - ${displayLabel}"
      >
        ${this.code ? html`<span class="status-code">${this.code}</span>` : ''}
        <span class="status-label">${displayLabel}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-status-pill': LcarsStatusPill;
  }
}
