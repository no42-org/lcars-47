/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { html, css, type TemplateResult } from 'lit';
import { LcarsElement } from './base';

/**
 * `<lcars-frame>` organizes named slots in a standard 2D LCARS layout grid.
 */
export class LcarsFrame extends LcarsElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      min-height: var(--lcars-frame-min-height, 100dvh);
      background-color: var(--lcars-color-bg, #000000);
      color: var(--lcars-color-text, #ff9900);
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      box-sizing: border-box;
      padding: var(--lcars-gap-md, 8px);
    }

    .frame-grid {
      display: grid;
      grid-template-columns: var(--lcars-sidebar-width, 160px) 1fr;
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        'elbow-tl top-bar'
        'sidebar  main'
        'elbow-br footer';
      gap: var(--lcars-gap-sm, 4px);
      width: 100%;
      min-height: calc(var(--lcars-frame-min-height, 100dvh) - 2 * var(--lcars-gap-md, 8px));
      box-sizing: border-box;
    }

    .slot-elbow-tl {
      grid-area: elbow-tl;
      display: flex;
    }

    .slot-top-bar {
      grid-area: top-bar;
      display: flex;
      align-items: center;
      gap: var(--lcars-gap-sm, 4px);
    }

    .slot-sidebar {
      grid-area: sidebar;
      display: flex;
      flex-direction: column;
      gap: var(--lcars-gap-sm, 4px);
    }

    .slot-main {
      grid-area: main;
      display: flex;
      flex-direction: column;
      gap: var(--lcars-gap-md, 8px);
      padding: var(--lcars-gap-md, 8px);
      background-color: var(--lcars-color-overlay, rgba(0, 0, 0, 0.4));
      border-radius: var(--lcars-radius-sm, 6px);
      overflow: auto;
    }

    .slot-footer {
      grid-area: footer;
      display: flex;
      align-items: center;
      gap: var(--lcars-gap-sm, 4px);
    }

    .slot-elbow-br {
      grid-area: elbow-br;
      display: flex;
      justify-content: flex-start;
    }

    /* Responsive adjustments for narrow screens */
    @media (max-width: 600px) {
      .frame-grid {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto 1fr auto auto auto;
        grid-template-areas:
          'elbow-tl'
          'top-bar'
          'main'
          'sidebar'
          'elbow-br'
          'footer';
      }

      .slot-sidebar {
        flex-direction: row;
        flex-wrap: wrap;
      }
    }
  `;

  override render(): TemplateResult {
    return html`
      <div class="frame-grid">
        <div class="slot-elbow-tl">
          <slot name="elbow-tl"></slot>
        </div>

        <div class="slot-top-bar">
          <slot name="top-bar"></slot>
        </div>

        <aside class="slot-sidebar">
          <slot name="sidebar"></slot>
        </aside>

        <main class="slot-main">
          <slot></slot>
          <slot name="main"></slot>
        </main>

        <div class="slot-footer">
          <slot name="footer-readout"></slot>
          <slot name="footer"></slot>
        </div>

        <div class="slot-elbow-br">
          <slot name="elbow-br"></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-frame': LcarsFrame;
  }
}
