/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, css, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LcarsElement } from './base';

export type LcarsElbowDirection = 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right';

/**
 * `<lcars-elbow>` renders an authentic curved LCARS L-shape corner block.
 */
export class LcarsElbow extends LcarsElement {
  static override styles = css`
    :host {
      display: inline-block;
      box-sizing: border-box;
      user-select: none;
    }

    .elbow-container {
      display: flex;
      box-sizing: border-box;
      position: relative;
    }

    .arch,
    .bar-extension {
      background-color: var(--elbow-color, var(--lcars-color-primary));
    }

    .bar-extension {
      position: relative;
    }

    /* Concave inner fillet joining the bar to the column leg */
    .bar-extension::after {
      content: '';
      position: absolute;
      width: var(--lcars-radius-inner, 14px);
      height: var(--lcars-radius-inner, 14px);
      pointer-events: none;
    }

    /* Top-Left */
    .elbow-container.top-left {
      flex-direction: column;
      align-items: flex-start;
    }

    .elbow-container.top-left .top-row {
      display: flex;
      align-items: flex-start;
      width: 100%;
    }

    .elbow-container.top-left .arch {
      width: var(--lcars-sidebar-width, 160px);
      height: var(--lcars-elbow-height, 60px);
      border-top-left-radius: var(--lcars-radius-elbow, 28px);
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      padding: var(--lcars-gap-sm, 4px) var(--lcars-gap-md, 8px);
      box-sizing: border-box;
    }

    .elbow-container.top-left .bar-extension {
      flex: 1;
      height: var(--lcars-bar-height, 28px);
      display: flex;
      align-items: center;
      padding: 0 var(--lcars-gap-md, 8px);
      box-sizing: border-box;
    }

    .elbow-container.top-left .bar-extension::after {
      left: 0;
      top: 100%;
      background: radial-gradient(
        circle at 100% 100%,
        transparent calc(var(--lcars-radius-inner, 14px) - 0.5px),
        var(--elbow-color, var(--lcars-color-primary)) var(--lcars-radius-inner, 14px)
      );
    }

    /* Bottom-Left */
    .elbow-container.bottom-left {
      flex-direction: column-reverse;
      align-items: flex-start;
    }

    .elbow-container.bottom-left .bottom-row {
      display: flex;
      align-items: flex-end;
      width: 100%;
    }

    .elbow-container.bottom-left .arch {
      width: var(--lcars-sidebar-width, 160px);
      height: var(--lcars-elbow-height, 60px);
      border-bottom-left-radius: var(--lcars-radius-elbow, 28px);
      display: flex;
      align-items: flex-end;
      justify-content: flex-start;
      padding: var(--lcars-gap-sm, 4px) var(--lcars-gap-md, 8px);
      box-sizing: border-box;
    }

    .elbow-container.bottom-left .bar-extension {
      flex: 1;
      height: var(--lcars-bar-height, 28px);
      display: flex;
      align-items: center;
      padding: 0 var(--lcars-gap-md, 8px);
      box-sizing: border-box;
    }

    .elbow-container.bottom-left .bar-extension::after {
      left: 0;
      bottom: 100%;
      background: radial-gradient(
        circle at 100% 0%,
        transparent calc(var(--lcars-radius-inner, 14px) - 0.5px),
        var(--elbow-color, var(--lcars-color-primary)) var(--lcars-radius-inner, 14px)
      );
    }

    /* Top-Right */
    .elbow-container.top-right {
      flex-direction: column;
      align-items: flex-end;
    }

    .elbow-container.top-right .top-row {
      display: flex;
      flex-direction: row-reverse;
      align-items: flex-start;
      width: 100%;
    }

    .elbow-container.top-right .arch {
      width: var(--lcars-sidebar-width, 160px);
      height: var(--lcars-elbow-height, 60px);
      border-top-right-radius: var(--lcars-radius-elbow, 28px);
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      padding: var(--lcars-gap-sm, 4px) var(--lcars-gap-md, 8px);
      box-sizing: border-box;
    }

    .elbow-container.top-right .bar-extension {
      flex: 1;
      height: var(--lcars-bar-height, 28px);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 var(--lcars-gap-md, 8px);
      box-sizing: border-box;
    }

    .elbow-container.top-right .bar-extension::after {
      right: 0;
      top: 100%;
      background: radial-gradient(
        circle at 0% 100%,
        transparent calc(var(--lcars-radius-inner, 14px) - 0.5px),
        var(--elbow-color, var(--lcars-color-primary)) var(--lcars-radius-inner, 14px)
      );
    }

    /* Bottom-Right */
    .elbow-container.bottom-right {
      flex-direction: column-reverse;
      align-items: flex-end;
    }

    .elbow-container.bottom-right .bottom-row {
      display: flex;
      flex-direction: row-reverse;
      align-items: flex-end;
      width: 100%;
    }

    .elbow-container.bottom-right .arch {
      width: var(--lcars-sidebar-width, 160px);
      height: var(--lcars-elbow-height, 60px);
      border-bottom-right-radius: var(--lcars-radius-elbow, 28px);
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: var(--lcars-gap-sm, 4px) var(--lcars-gap-md, 8px);
      box-sizing: border-box;
    }

    .elbow-container.bottom-right .bar-extension {
      flex: 1;
      height: var(--lcars-bar-height, 28px);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 var(--lcars-gap-md, 8px);
      box-sizing: border-box;
    }

    .elbow-container.bottom-right .bar-extension::after {
      right: 0;
      bottom: 100%;
      background: radial-gradient(
        circle at 0% 0%,
        transparent calc(var(--lcars-radius-inner, 14px) - 0.5px),
        var(--elbow-color, var(--lcars-color-primary)) var(--lcars-radius-inner, 14px)
      );
    }

    .title-text {
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-sm, 0.875rem);
      font-weight: bold;
      letter-spacing: var(--lcars-letter-spacing-wide, 0.08em);
      text-transform: uppercase;
      color: var(--lcars-color-on-accent, #000000);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .label-text {
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-xs, 0.75rem);
      font-weight: bold;
      letter-spacing: var(--lcars-letter-spacing-widest, 0.12em);
      text-transform: uppercase;
      color: var(--lcars-color-on-accent, #000000);
      white-space: nowrap;
    }
  `;

  @property({ type: String, reflect: true })
  orientation: LcarsElbowDirection = 'top-left';

  @property({ type: String, attribute: 'direction' })
  direction?: LcarsElbowDirection;

  @property({ type: String })
  color = 'primary';

  @property({ type: String })
  heading = '';

  @property({ type: String, attribute: 'title' })
  elbowTitle = '';

  @property({ type: String })
  label = '';

  private get activeOrientation(): LcarsElbowDirection {
    const raw = this.direction || this.orientation;
    return ['top-left', 'bottom-left', 'top-right', 'bottom-right'].includes(raw)
      ? raw
      : 'top-left';
  }

  private get displayHeading(): string {
    return this.elbowTitle || this.heading;
  }

  override render(): TemplateResult {
    const bgColor = this.resolveColor(this.color, '--lcars-color-primary');
    const orientationClass = this.activeOrientation;
    const isTop = orientationClass.startsWith('top');
    const rowClass = isTop ? 'top-row' : 'bottom-row';

    return html`
      <div class="elbow-container ${orientationClass}" style="--elbow-color: ${bgColor};">
        <div class="${rowClass}">
          <div class="arch">
            <slot name="label">
              ${this.label ? html`<span class="label-text">${this.label}</span>` : ''}
            </slot>
          </div>
          <div class="bar-extension">
            <slot>
              ${this.displayHeading ? html`<span class="title-text">${this.displayHeading}</span>` : ''}
            </slot>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-elbow': LcarsElbow;
  }
}
