/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { html, css, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LcarsElement } from './base';

/**
 * `<lcars-panel>` renders a framed LCARS content container with header bar and bracket borders.
 */
export class LcarsPanel extends LcarsElement {
  static override styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      /* Never paint outside the box we were given. Inert until a parent
         bounds us, which is why every panel in the workbench is unaffected.
         See the same pair on lcars-frame, and the hit-test that guards both. */
      max-height: 100%;
      overflow: auto;
    }

    .panel-container {
      display: flex;
      flex-direction: column;
      background-color: var(--lcars-color-surface, #101014);
      border-radius: var(--lcars-radius-sm, 6px);
      overflow: hidden;
      box-sizing: border-box;
      /* Fit the host rather than outgrowing it. Without this a panel given a
         height renders a container taller than itself, which painted over
         whatever came next. */
      max-height: 100%;
    }

    .panel-container.bordered {
      border: 1px solid var(--lcars-color-border-subtle, rgba(255, 255, 255, 0.1));
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
      color: var(--lcars-color-on-accent, #000000);
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
      color: var(--lcars-color-on-accent, #000000);
      opacity: 0.85;
    }

    .panel-body {
      padding: var(--lcars-gap-md, 8px);
      color: var(--lcars-color-text, #ff9900);
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      box-sizing: border-box;
      /* A clamped panel has to put its content somewhere. Without this the
         container's overflow: hidden simply cuts it off, trading painting
         over the neighbours for hiding the panel's own content. */
      overflow: auto;
      min-height: 0;
    }
  `;

  @property({ type: String })
  heading = '';

  @property({ type: String })
  subtitle = '';

  @property({ type: String })
  color = 'secondary';

  @property({ type: Boolean, reflect: true, attribute: 'no-border' })
  noBorder = false;

  private get displayHeading(): string {
    return this.heading;
  }

  override render(): TemplateResult {
    const accentColor = this.resolveColor(this.color, '--lcars-color-secondary');
    const borderClass = this.noBorder ? '' : 'bordered';
    const headerTitle = this.displayHeading;

    return html`
      <div
        class="panel-container ${borderClass}"
        style="--panel-color: ${accentColor};"
      >
        ${headerTitle || this.subtitle
          ? html`
              <div class="panel-header">
                <span class="panel-title">${headerTitle}</span>
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
