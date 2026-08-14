/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { LcarsElement } from './base';

/**
 * `<lcars-panel>` renders a framed LCARS content container with header bar and bracket borders.
 */
@customElement('lcars-panel')
export class LcarsPanel extends LcarsElement {
  static override styles = css`
    :host {
      display: block;
      box-sizing: border-box;
    }

    .panel-container {
      display: flex;
      flex-direction: column;
      background-color: var(--lcars-color-surface, #101014);
      border-radius: var(--lcars-radius-sm, 6px);
      overflow: hidden;
      box-sizing: border-box;
    }

    .panel-container.bordered {
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-left: var(--lcars-border-width, 3px) solid var(--panel-color, var(--lcars-color-secondary));
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--lcars-bar-height, 28px);
      background-color: var(--panel-color, var(--lcars-color-secondary));
      padding: 0 var(--lcars-gap-md, 8px);
      box-sizing: border-box;
      user-select: none;
    }

    .panel-title {
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-md, 1rem);
      font-weight: bold;
      letter-spacing: var(--lcars-letter-spacing-wide, 0.08em);
      text-transform: uppercase;
      color: #000000;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .panel-subtitle {
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-xs, 0.75rem);
      font-weight: bold;
      letter-spacing: var(--lcars-letter-spacing-widest, 0.12em);
      text-transform: uppercase;
      color: #000000;
      opacity: 0.85;
    }

    .panel-body {
      padding: var(--lcars-gap-md, 8px);
      color: var(--lcars-color-text, #ff9900);
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      box-sizing: border-box;
    }
  `;

  @property({ type: String })
  override title = '';

  @property({ type: String })
  subtitle = '';

  @property({ type: String })
  color = 'secondary';

  @property({ type: Boolean, reflect: true })
  bordered = true;

  override render(): TemplateResult {
    const accentColor = this.resolveColor(this.color, '--lcars-color-secondary');
    const borderClass = this.bordered ? 'bordered' : '';

    return html`
      <div
        class="panel-container ${borderClass}"
        style="--panel-color: ${accentColor};"
      >
        ${this.title || this.subtitle
          ? html`
              <div class="panel-header">
                <span class="panel-title">${this.title}</span>
                ${this.subtitle ? html`<span class="panel-subtitle">${this.subtitle}</span>` : ''}
              </div>
            `
          : ''}
        <div class="panel-body">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-panel': LcarsPanel;
  }
}
