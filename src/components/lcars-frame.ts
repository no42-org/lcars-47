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
    /* The host is a size container, so every responsive rule below asks how
       wide the frame is rather than how wide the window is. A frame keyed to
       the viewport is wrong in both directions: an 800px frame on a 420px
       screen stacked and burst out of its box, and a 400px frame on a 1280px
       screen kept a 160px sidebar beside a 220px main.

       A container query can never style its own container, so the grid sits
       inside the host rather than on it. Only the grid declares a height —
       the host has none of its own to disagree with, which is what made the
       previous two-box arrangement drift the footer off screen (#19). */
    :host {
      display: block;
      container-type: inline-size;
      /* Inline-size containment computes this box's width as if it had no
         contents, so anywhere the frame is shrink-to-fit (a flex item, a
         float, inline-block, absolutely positioned) that intrinsic width is
         zero and the console silently disappears. An explicit width gives
         every one of those cases something real to resolve against. */
      width: 100%;
      /* No height here on purpose. The grid owns it, so the host wraps the
         grid exactly and cannot paint a band of frame-coloured dead space
         under it when the two disagree. */

      /* Never paint outside the box we were given. A percentage max-height
         resolves to none against a parent whose height is indefinite and
         clamps against one that is definite, which is exactly the difference
         between being the page and being a card, with nothing for the
         consumer to declare. The overflow is the other half: clamping alone
         leaves the box the right size and the content still painting past it.

         This looks like dead code, because it does nothing until a parent is
         bounded and no ordinary page is. test/layout.test.ts hit-tests just
         outside the box to keep it honest. */
      max-height: 100%;
      overflow: auto;
      /* No scrollbar-gutter here, unlike the regions inside. This box is the
         query container, and a reserved gutter comes out of the content box
         the query measures, so it would move the documented threshold by the
         width of a scrollbar and leave a permanent empty band on every frame.
         The cost of leaving it off is narrower: a frame within a scrollbar's
         width of the threshold can have its layout decided by whether one
         appears. */

      background-color: var(--lcars-color-bg, #000000);
      color: var(--lcars-color-text, #ff9900);
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      box-sizing: border-box;
    }

    .frame-grid {
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
      /* Padding belongs to the box that owns the height, so the token means the
         frame's outer height rather than its height plus two gaps. */
      padding: var(--lcars-gap-md, 8px);
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

    /* Narrow frames, whatever the window is doing */
    @container (max-width: 600px) {
      /* Deliberate change of identity, not just a reflow: too narrow to be a
         cockpit, so the frame flows with the document. Pinning a shell at this
         width starves main — a stacked sidebar taller than half the frame
         leaves it its padding and nothing else.

         Sidebar before main, matching the DOM order the wide layout already
         relies on: reversing them here sent the keyboard to the lower block
         first and back up again (#28). */
      .frame-grid {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto auto;
        grid-template-areas:
          'header'
          'sidebar'
          'main'
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
      <div class="frame-grid">
        <div class="slot-header">
          <div class="slot-elbow-tl">
            <slot name="elbow-tl"></slot>
          </div>

          <div class="slot-top-bar">
            <slot name="top-bar"></slot>
          </div>
        </div>

        <!-- Both regions scroll, so both must be focusable: a keyboard-only
             user cannot otherwise reach content that has scrolled out of view.
             Chrome 127+ does this for scrollers without focusable descendants,
             which a console region rarely is; Safari and Firefox not at all.

             Unconditional, though a narrow frame stops scrolling these regions
             and the two tab stops buy nothing there. CSS cannot drive tabindex,
             and a resize observer toggling it would reorder focus as the frame
             changes size, which is worse than two inert stops.

             Sidebar first, matching the visual order of both layouts. -->
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
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-frame': LcarsFrame;
  }
}
