/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { html, css, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
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
      /* No vh fallback: once this substitutes a value the browser cannot parse,
         the declaration is invalid at computed-value time and the property is
         unset, not rolled back to an earlier declaration. A guard here could
         never fire, so the token's default carries the requirement instead. */
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

    /* Keyboard focus only. These regions are focusable so they can be scrolled
       without a pointer, which would otherwise put a ring around half the
       console every time someone clicks in it. Drawn inside, since a region is
       flush against its neighbours. */
    .slot-main:focus-visible,
    .slot-sidebar:focus-visible {
      outline: var(--lcars-border-width, 3px) solid var(--lcars-color-primary, #ff9900);
      outline-offset: calc(-1 * var(--lcars-border-width, 3px));
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

  /**
   * Accessible name for the scrollable main region. Optional: the region is a
   * `main` landmark, which assistive technology already announces by role.
   * Name it when a page carries more than one frame, or when "main" is not
   * descriptive enough on its own.
   */
  @property({ type: String, attribute: 'main-label' })
  mainLabel = '';

  /** Accessible name for the scrollable sidebar region. See {@link mainLabel}. */
  @property({ type: String, attribute: 'sidebar-label' })
  sidebarLabel = '';

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

      <!-- Both regions scroll, so both must be focusable: a keyboard-only user
           cannot otherwise reach content that has scrolled out of view. Chrome
           127+ does this for scrollers without focusable descendants, which a
           console region rarely is; Safari and Firefox not at all.

           Unconditional, though below the narrow breakpoint these regions stop
           scrolling and the two tab stops buy nothing there. CSS cannot drive
           tabindex, and a resize observer toggling it would reorder focus as
           the window changes, which is worse than two inert stops. -->
      <aside class="slot-sidebar" tabindex="0" aria-label=${this.sidebarLabel || nothing}>
        <slot name="sidebar"></slot>
      </aside>

      <main class="slot-main" tabindex="0" aria-label=${this.mainLabel || nothing}>
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
