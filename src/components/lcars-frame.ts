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
    /* The host is the grid. Two boxes each declaring a height is what let the
       footer row drift off screen: the inner one tracked the outer through
       hand-maintained arithmetic, and the seam between them was the bug. */
    :host {
      display: grid;
      grid-template-columns: var(--lcars-sidebar-width, 160px) 1fr;
      /* The definite height and this minmax are a pair. The height stops 1fr
         resolving to max-content (which pushed the footer past the viewport);
         the minmax lets the row shrink below its content when space is tight
         (embedded, the track overflowed its own frame by 165px). Each looks
         redundant when tested in the other's regime; deleting either one
         reinstates a shipped bug. See test/layout.test.ts. */
      grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-areas:
        'header  header'
        'sidebar main'
        'footer  footer';
      gap: var(--lcars-gap-sm, 4px);
      width: 100%;
      height: 100vh;
      height: var(--lcars-frame-height, 100dvh);
      background-color: var(--lcars-color-bg, #000000);
      color: var(--lcars-color-text, #ff9900);
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      box-sizing: border-box;
      padding: var(--lcars-gap-md, 8px);
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
      /* Without this a long control column paints over the pinned footer row
         and off the bottom of the screen, silently. */
      overflow: auto;
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

    /* A flex column shrinks its items to fit rather than overflowing, so
       the overflow:auto above would never have anything to scroll: content would
       be compressed to whatever room was left, with no scrollbar to reveal it. */
    .slot-main slot::slotted(*),
    .slot-sidebar slot::slotted(*) {
      flex-shrink: 0;
    }

    /* Reserve the scrollbar's space at all times, or content shifts sideways
       the moment a region crosses its scroll threshold. Invisible on overlay
       scrollbars (macOS), load-bearing on Windows and Linux. */
    .slot-main,
    .slot-sidebar {
      scrollbar-gutter: stable;
    }

    /* Responsive adjustments for narrow screens */
    @media (max-width: 600px) {
      /* Deliberate change of identity, not just a reflow: too narrow to be a
         cockpit, so the frame becomes a document block and the page scrolls.
         Pinning the shell here starves main — a stacked sidebar taller than
         half the viewport leaves it its padding and nothing else. */
      :host {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto auto;
        grid-template-areas:
          'header'
          'main'
          'sidebar'
          'footer';
        height: auto;
        min-height: 100vh;
        min-height: var(--lcars-frame-height, 100dvh);
      }

      .slot-main,
      .slot-sidebar {
        overflow: visible;
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-frame': LcarsFrame;
  }
}
