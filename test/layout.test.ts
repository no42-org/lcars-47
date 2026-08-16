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

let server: ViteDevServer;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  server = await createServer({ server: { port: 0 }, logLevel: 'error' });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('vite dev server did not report a local URL');

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

  page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(url, { waitUntil: 'networkidle' });
  // Custom elements are registered by a module import, and the frame and the
  // elbows are separate Lit elements with independently scheduled first
  // updates. Wait for every shadow root these assertions reach into, or a
  // measurement can dereference null instead of waiting.
  await page.waitForFunction(() => {
    const frame = document.querySelector('lcars-frame');
    const arch = (slot: string) =>
      frame?.querySelector(`lcars-elbow[slot="${slot}"]`)?.shadowRoot?.querySelector('.arch');
    return !!(
      frame?.shadowRoot?.querySelector('.frame-grid') &&
      arch('elbow-tl') &&
      arch('elbow-bl')
    );
  });
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
