/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

/**
 * Layout invariants, measured in a browser that actually performs layout.
 *
 * The unit suite runs under happy-dom, which has no layout engine: every
 * `getBoundingClientRect()` there is zero, so a frame whose footer sits 175px
 * below the fold, or an elbow label clipped by its own corner radius, passes it
 * without complaint. Both shipped that way (#17, #19) and were caught by a human
 * looking at a screenshot.
 *
 * This file drives the workbench in headless Chromium and asserts positions.
 * It asserts numbers, never pixels: a theme colour or a label's wording must not
 * be able to break it.
 *
 * Known gaps, deliberately not asserted here:
 *   - The footer row is only checked at 1440x900. At 1280x720 it is currently
 *     off-screen (#19); that viewport lands with the fix, not with this harness.
 *   - Scrollbar gutter behaviour is invisible on macOS overlay scrollbars, so it
 *     is not measured on any platform.
 *   - Embedding is only checked above the narrow breakpoint. Below it the frame
 *     switches to document flow on viewport width alone and an embedded frame
 *     outgrows its container (#25).
 *   - Nothing here looks at appearance. A green run is not a visual review.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Page } from 'playwright';

/**
 * Slack for sub-pixel layout. Several of these invariants are exact by
 * construction — the label's padding and the corner radius resolve from the
 * same token, so the label lands precisely on the arc — and a strict comparison
 * would fail on a fractional device pixel ratio or a radius expressed in `rem`.
 */
const SUBPIXEL_TOLERANCE_PX = 1;

const VIEWPORT = { width: 1440, height: 900 };
/** Wide enough for the pinned-shell layout, short enough that content overflows. */
const SHORT_VIEWPORT = { width: 1280, height: 720 };
/** Below the 600px breakpoint, where the frame becomes a document block. */
const NARROW_VIEWPORT = { width: 420, height: 720 };

let server: ViteDevServer;
let browser: Browser;
let url: string;
let page: Page;

/** A workbench page at the given viewport, ready to measure. */
async function openWorkbench(viewport: { width: number; height: number }): Promise<Page> {
  const p = await browser.newPage({ viewport });
  await p.goto(url, { waitUntil: 'networkidle' });
  // Custom elements are registered by a module import, and the frame and the
  // elbows are separate Lit elements with independently scheduled first
  // updates. Wait for every shadow root these assertions reach into, or a
  // measurement can dereference null instead of waiting.
  await p.waitForFunction(() => {
    const frame = document.querySelector('lcars-frame');
    const arch = (slot: string) =>
      frame?.querySelector(`lcars-elbow[slot="${slot}"]`)?.shadowRoot?.querySelector('.arch');
    return !!(frame?.shadowRoot?.querySelector('.slot-main') && arch('elbow-tl') && arch('elbow-bl'));
  });
  return p;
}

beforeAll(async () => {
  server = await createServer({ server: { port: 0 }, logLevel: 'error' });
  await server.listen();
  const local = server.resolvedUrls?.local[0];
  if (!local) throw new Error('vite dev server did not report a local URL');
  url = local;

  try {
    browser = await chromium.launch();
  } catch (cause) {
    // Never downgrade a missing browser to a skip: a layout gate that quietly
    // opts out in CI is the same trap as a dist check that fails soft.
    throw new Error(
      'Could not launch Chromium for the layout gate. Run `make install-browsers`.',
      { cause }
    );
  }

  page = await openWorkbench(VIEWPORT);
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

/** Geometry of the workbench, collected in one pass so all of it agrees. */
async function measure() {
  return page.evaluate(() => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, centreY: r.top + r.height / 2 };
    };
    const frame = document.querySelector('lcars-frame')!;
    const root = frame.shadowRoot!;
    const tl = frame.querySelector('lcars-elbow[slot="elbow-tl"]')!;
    const bl = frame.querySelector('lcars-elbow[slot="elbow-bl"]')!;
    const arch = tl.shadowRoot!.querySelector('.arch')!;

    return {
      viewportHeight: window.innerHeight,
      headerElbow: box(tl),
      headerArch: box(arch),
      headerArchRadius: parseFloat(getComputedStyle(arch).borderTopLeftRadius),
      headerLabel: box(tl.shadowRoot!.querySelector('.label-text')!),
      headerHeading: box(tl.shadowRoot!.querySelector('.title-text')!),
      topBarBand: box(root.querySelector('.slot-top-bar')!),
      topBarContent: box(frame.querySelector('[slot="top-bar"]')!),
      footerRow: box(root.querySelector('.slot-footer-row')!),
      footerLabel: box(bl.shadowRoot!.querySelector('.label-text')!),
      footerReadout: box(frame.querySelector('[slot="footer-readout"]')!),
    };
  });
}

describe('frame and elbow layout', () => {
  it('keeps the elbow label out of the corner the radius cuts away', async () => {
    const m = await measure();

    // Within the top-left square of side r, the rounded corner paints only what
    // is *within* r of the arc centre; everything beyond the arc is cut away.
    // So the label's nearest corner is safe when it is either past the square
    // entirely or inside the arc — never in the gap between them.
    const r = m.headerArchRadius;
    const cx = m.headerArch.left + r;
    const cy = m.headerArch.top + r;
    const inCornerSquare = m.headerLabel.left < cx && m.headerLabel.top < cy;
    const distanceFromArcCentre = Math.hypot(cx - m.headerLabel.left, cy - m.headerLabel.top);
    // The label lands exactly on the arc by construction (its padding and the
    // radius are the same token), so compare with slack or a fractional pixel
    // fails a layout that is correct.
    const clipped = inCornerSquare && distanceFromArcCentre > r + SUBPIXEL_TOLERANCE_PX;

    expect(
      clipped,
      `label corner sits ${distanceFromArcCentre.toFixed(1)}px from the arc centre, outside the ${r}px radius`
    ).toBe(false);
  });

  it('sits the elbow label on the same line as the elbow heading', async () => {
    const m = await measure();
    expect(Math.abs(m.headerLabel.centreY - m.headerHeading.centreY)).toBeLessThanOrEqual(
      SUBPIXEL_TOLERANCE_PX
    );
  });

  it('sits the top-bar text on the same line as the elbow heading', async () => {
    const m = await measure();
    expect(Math.abs(m.topBarContent.centreY - m.headerHeading.centreY)).toBeLessThanOrEqual(
      SUBPIXEL_TOLERANCE_PX
    );
    expect(Math.abs(m.topBarBand.centreY - m.headerHeading.centreY)).toBeLessThanOrEqual(
      SUBPIXEL_TOLERANCE_PX
    );
  });

  it('leaves a gap between the elbow and the bar text instead of overlapping it', async () => {
    const m = await measure();
    // The elbow is sized by its own arch plus heading; the bar must start after
    // it, not underneath it.
    expect(m.topBarBand.left).toBeGreaterThan(m.headerElbow.right);
    expect(m.topBarContent.left).toBeGreaterThan(m.headerElbow.right);
  });

  it('sits the footer readout on the same line as the footer elbow label', async () => {
    const m = await measure();
    expect(Math.abs(m.footerReadout.centreY - m.footerLabel.centreY)).toBeLessThanOrEqual(
      SUBPIXEL_TOLERANCE_PX
    );
    expect(m.footerReadout.left).toBeGreaterThan(m.footerLabel.right);
  });

  it('keeps the footer row inside the viewport', async () => {
    const m = await measure();
    expect(m.footerRow.bottom).toBeLessThanOrEqual(m.viewportHeight);
  });
});

/**
 * The frame's height contract (#19): a viewport shell above the narrow
 * breakpoint, a document block below it, with every region that receives
 * content stating whether it scrolls.
 */
describe('frame height contract', () => {
  /** Drops a plain block into `main`, so nothing brings its own scroller. */
  const TALL_BLOCK_PX = 2000;

  async function withTallMain<T>(viewport: typeof VIEWPORT, read: (p: Page) => Promise<T>): Promise<T> {
    const p = await openWorkbench(viewport);
    try {
      await p.evaluate((height) => {
        const block = document.createElement('div');
        block.id = 'tall-block';
        block.setAttribute('slot', 'main');
        block.style.cssText = `height: ${height}px; background: #202;`;
        document.querySelector('lcars-frame')!.appendChild(block);
      }, TALL_BLOCK_PX);
      return await read(p);
    } finally {
      await p.close();
    }
  }

  it('keeps the footer row on screen when main content is taller than the frame', async () => {
    const r = await withTallMain(SHORT_VIEWPORT, (p) =>
      p.evaluate(() => {
        const root = document.querySelector('lcars-frame')!.shadowRoot!;
        return {
          footerBottom: root.querySelector('.slot-footer-row')!.getBoundingClientRect().bottom,
          viewportHeight: window.innerHeight,
        };
      })
    );
    expect(r.footerBottom).toBeLessThanOrEqual(r.viewportHeight);
  });

  it('scrolls main rather than compressing what is slotted into it', async () => {
    const r = await withTallMain(SHORT_VIEWPORT, (p) =>
      p.evaluate(() => {
        const main = document.querySelector('lcars-frame')!.shadowRoot!.querySelector('.slot-main')!;
        return {
          blockHeight: document.getElementById('tall-block')!.getBoundingClientRect().height,
          clientHeight: main.clientHeight,
          scrollHeight: main.scrollHeight,
        };
      })
    );
    // A flex column shrinks its items to fit unless told otherwise, which
    // destroys content silently instead of producing a scrollbar.
    expect(r.blockHeight).toBeCloseTo(TALL_BLOCK_PX, 0);
    expect(r.scrollHeight).toBeGreaterThan(r.clientHeight);
  });

  it('stays inside a sized container when embedded with --lcars-frame-height', async () => {
    const p = await openWorkbench(SHORT_VIEWPORT);
    try {
      const r = await p.evaluate(() => {
        const frame = document.querySelector('lcars-frame')!;
        const cell = document.createElement('div');
        cell.style.cssText = 'width: 800px; height: 400px;';
        document.body.appendChild(cell);
        cell.appendChild(frame);
        (frame as HTMLElement).style.setProperty('--lcars-frame-height', '100%');

        const root = frame.shadowRoot!;
        const cellBottom = cell.getBoundingClientRect().bottom;
        const main = root.querySelector('.slot-main')!;
        return {
          cellHeight: cell.getBoundingClientRect().height,
          frameHeight: frame.getBoundingClientRect().height,
          overshoot: root.querySelector('.slot-footer-row')!.getBoundingClientRect().bottom - cellBottom,
          mainOvershoot: main.getBoundingClientRect().bottom - cellBottom,
        };
      });
      // A definite height alone does not cap the flexible row when space is
      // tight: the box is right and the track still paints outside it.
      expect(r.frameHeight).toBeCloseTo(r.cellHeight, 0);
      expect(r.overshoot).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE_PX);
      expect(r.mainOvershoot).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE_PX);
    } finally {
      await p.close();
    }
  });

  it('scrolls the sidebar rather than painting it over the footer', async () => {
    const p = await openWorkbench(SHORT_VIEWPORT);
    try {
      const r = await p.evaluate(async () => {
        const frame = document.querySelector('lcars-frame')!;
        const sidebar = frame.querySelector('[slot="sidebar"]')!;
        const added = Array.from({ length: 30 }, (_, i) => {
          const b = document.createElement('lcars-button');
          b.textContent = `SYS ${i}`;
          sidebar.appendChild(b);
          return b as HTMLElement & { updateComplete?: Promise<unknown> };
        });
        await Promise.all(added.map((b) => b.updateComplete));

        const root = frame.shadowRoot!;
        const region = root.querySelector('.slot-sidebar')!;
        return {
          clientHeight: region.clientHeight,
          scrollHeight: region.scrollHeight,
          overflowY: getComputedStyle(region).overflowY,
          regionBottom: region.getBoundingClientRect().bottom,
          footerTop: root.querySelector('.slot-footer-row')!.getBoundingClientRect().top,
        };
      });
      expect(r.scrollHeight).toBeGreaterThan(r.clientHeight);
      expect(r.overflowY).not.toBe('visible');
      expect(r.regionBottom).toBeLessThanOrEqual(r.footerTop + SUBPIXEL_TOLERANCE_PX);
    } finally {
      await p.close();
    }
  });

  it('lets a keyboard reach and scroll the regions it made scrollable', async () => {
    // Tab traversal, not `element.focus()`: programmatic focus succeeds on a
    // scroll container in Chromium whether or not it carries `tabindex`, so a
    // `.focus()`-based check would pass against a region no keyboard user can
    // reach. Chromium's focusable-scroller behaviour skips any scroller that
    // already contains focusable descendants, which both of these do.
    const MAX_TAB_PRESSES = 40;
    const r = await withTallMain(SHORT_VIEWPORT, async (p) => {
      const scrollTop = () =>
        p.evaluate(
          () =>
            document.querySelector('lcars-frame')!.shadowRoot!.querySelector('.slot-main')!.scrollTop
        );

      const onMain = () =>
        p.evaluate(() => {
          const root = document.querySelector('lcars-frame')!.shadowRoot!;
          return root.activeElement === root.querySelector('.slot-main');
        });

      await p.evaluate(() => document.body.focus());
      let focused = false;
      let presses = 0;
      while (!focused && presses < MAX_TAB_PRESSES) {
        await p.keyboard.press('Tab');
        presses += 1;
        focused = await onMain();
      }

      const before = await scrollTop();
      // Real key press through the browser's input stack, not a synthetic
      // event: the point is that the browser scrolls the focused region.
      await p.keyboard.press('End');
      await p.waitForFunction(
        () =>
          document.querySelector('lcars-frame')!.shadowRoot!.querySelector('.slot-main')!.scrollTop >
          0,
        undefined,
        { timeout: 2_000 }
      );
      return { focused, before, after: await scrollTop() };
    });
    expect(r.focused).toBe(true);
    expect(r.after).toBeGreaterThan(r.before);
  });

  it('lets main keep its natural height below the narrow breakpoint', async () => {
    // Guard rather than reproduction: this passes today. Pinning a shell height
    // on a phone, where the stacked sidebar alone is taller than half the
    // viewport, collapses main to its padding — the regression the fix could
    // introduce.
    const r = await withTallMain(NARROW_VIEWPORT, (p) =>
      p.evaluate(() => {
        const main = document.querySelector('lcars-frame')!.shadowRoot!.querySelector('.slot-main')!;
        return { clientHeight: main.clientHeight, scrollHeight: main.scrollHeight };
      })
    );
    expect(r.clientHeight).toBeGreaterThanOrEqual(r.scrollHeight - SUBPIXEL_TOLERANCE_PX);
  });
});
