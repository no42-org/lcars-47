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
      min-height: 100vh;
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
        'header  header'
        'sidebar main'
        'footer  footer';
      gap: var(--lcars-gap-sm, 4px);
      width: 100%;
      min-height: calc(100vh - 2 * var(--lcars-gap-md, 8px));
      min-height: calc(var(--lcars-frame-min-height, 100dvh) - 2 * var(--lcars-gap-md, 8px));
      box-sizing: border-box;
    }

    /* The elbow and the bar next to it share one row: the elbow is as wide as
       its own arch plus heading, so a grid column would either clip it or let it
       overflow onto the bar text. */
    .slot-header {
      grid-area: header;
      display: flex;
      align-items: flex-start;
      gap: var(--lcars-gap-md, 8px);
    }

    .slot-footer-row {
      grid-area: footer;
      display: flex;
      align-items: flex-end;
      gap: var(--lcars-gap-md, 8px);
    }

    .slot-elbow-tl,
    .slot-elbow-bl {
      display: flex;
      flex: 0 0 auto;
    }

    /* Bar-height bands pinned to the same edge as the elbow's bar extension, so
       their text sits on the elbow heading's line. */
    .slot-top-bar,
    .slot-footer {
      display: flex;
      flex: 1;
      min-width: 0;
      height: var(--lcars-bar-height, 28px);
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

    /* Responsive adjustments for narrow screens */
    @media (max-width: 600px) {
      .frame-grid {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr auto auto;
        grid-template-areas:
          'header'
          'main'
          'sidebar'
          'footer';
      }

      .slot-sidebar {
        flex-direction: row;
        flex-wrap: wrap;
      }

      .slot-header,
      .slot-footer-row {
        flex-wrap: wrap;
      }

      /* Too little width to sit beside the elbow: drop onto an own line and let
         the bar text wrap instead of spilling out of the band. */
      .slot-top-bar,
      .slot-footer {
        flex-basis: 100%;
        height: auto;
        min-height: var(--lcars-bar-height, 28px);
      }
    }
  `;

  override render(): TemplateResult {
    return html`
      <div class="frame-grid">
        <div class="slot-header">
          <div class="slot-elbow-tl">
            <slot name="elbow-tl"></slot>
          </div>

          <div class="slot-top-bar">
            <slot name="top-bar"></slot>
          </div>
        </div>

        <aside class="slot-sidebar">
          <slot name="sidebar"></slot>
        </aside>

        <main class="slot-main">
          <slot></slot>
          <slot name="main"></slot>
        </main>

        <div class="slot-footer-row">
          <div class="slot-elbow-bl">
            <slot name="elbow-bl"></slot>
          </div>

          <div class="slot-footer">
            <slot name="footer-readout"></slot>
            <slot name="footer"></slot>
          </div>
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
