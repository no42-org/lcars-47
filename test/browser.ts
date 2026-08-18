/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

/**
 * Shared bootstrap for the browser-driven suites: the Chromium layout gate
 * (`layout.test.ts`) and the cross-engine tier (`compat.test.ts`). One copy,
 * because the two independent copies had already diverged once: the layout
 * gate waited for elbow shadow roots but missed the WebKit font workaround,
 * the compat tier the reverse. A bootstrap fix must land in both suites, and
 * the CI-only one is where a miss goes unnoticed.
 */

import { createServer, type ViteDevServer } from 'vite';
import type { Browser, BrowserType, Page } from 'playwright';

/**
 * Slack for sub-pixel layout. Several invariants are exact by construction —
 * a label's padding and the corner radius resolve from the same token — and a
 * strict comparison would fail on a fractional device pixel ratio or a radius
 * expressed in `rem`.
 */
export const SUBPIXEL_TOLERANCE_PX = 1;

/**
 * Same digit count, opposite extremes of Antonio's bold advances: '0' is the
 * widest digit and '1' a third narrower, so a width reservation that fails
 * shows up between these values in any engine.
 */
export const SAME_WIDTH_READOUT_VALUES = [4700, 4111, 4757, 4820];

/** A vite dev server serving the workbench on an ephemeral port. */
export async function startWorkbenchServer(): Promise<{ server: ViteDevServer; url: string }> {
  const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('vite dev server did not report a local URL');
  return { server, url };
}

/**
 * Launches an engine, failing loudly with the matching install target. Never
 * downgrade a missing browser to a skip: a gate that quietly opts out is the
 * same trap as a dist check that fails soft.
 */
export async function launchBrowser(engine: BrowserType, name: string): Promise<Browser> {
  try {
    return await engine.launch();
  } catch (cause) {
    const target = name === 'chromium' ? 'make install-browsers' : 'make install-browsers-all';
    throw new Error(`Could not launch ${name}. Run \`${target}\`.`, { cause });
  }
}

/** A workbench page at the given viewport, ready to measure. */
export async function openWorkbenchPage(
  browser: Browser,
  url: string,
  viewport: { width: number; height: number }
): Promise<Page> {
  const p = await browser.newPage({ viewport });
  await p.goto(url, { waitUntil: 'networkidle' });
  // Custom elements are registered by a module import, and the frame and the
  // elbows are separate Lit elements with independently scheduled first
  // updates. Wait for every shadow root assertions reach into, or a
  // measurement can dereference null instead of waiting.
  await p.waitForFunction(() => {
    const frame = document.querySelector('lcars-frame');
    const arch = (slot: string) =>
      frame?.querySelector(`lcars-elbow[slot="${slot}"]`)?.shadowRoot?.querySelector('.arch');
    return !!(frame?.shadowRoot?.querySelector('.slot-main') && arch('elbow-tl') && arch('elbow-bl'));
  });
  // Fonts drive the width-stability invariants; do not measure before them.
  // Explicit load, not document.fonts.ready: in WebKit the ready promise can
  // stay pending forever (fonts.status never leaves "loading"), while load()
  // of a concrete face resolves immediately.
  await p.evaluate(() => document.fonts.load('700 16px Antonio'));
  return p;
}

/**
 * Containment, asserted by hit-testing rather than by arithmetic.
 *
 * A scrolled element reports content rectangles far outside its own box while
 * being correctly clipped, so `getBoundingClientRect` cannot tell a contained
 * component from an escaping one. `elementFromPoint` can, and it states the
 * invariant literally: nothing of this component is painted outside its box.
 * Shadow content reports the host, so one probe covers everything inside.
 */
export async function probesFindComponentOutside(
  page: Page,
  selector: string,
  build: string
): Promise<{ escapes: boolean; found: string }> {
  return page.evaluate(
    ({ selector, build }) => {
      const box = document.createElement('div');
      box.style.cssText = 'position: absolute; top: 40px; left: 40px;';
      document.body.prepend(box);
      // eslint-disable-next-line no-new-func
      new Function('box', build)(box);

      const component = document.querySelector(selector)!;
      const r = box.getBoundingClientRect();
      // Sample every edge, not just one point below the middle. Content can
      // leave sideways or upward as easily as downwards; dropping probes is
      // how a copy of this check went blind to half the directions.
      const probes: Array<[string, number, number]> = [
        ['below left', r.left + 8, r.bottom + 10],
        ['below centre', r.left + r.width / 2, r.bottom + 10],
        ['below right', r.right - 8, r.bottom + 10],
        ['right of middle', r.right + 10, r.top + r.height / 2],
        ['left of middle', r.left - 10, r.top + r.height / 2],
        ['above centre', r.left + r.width / 2, r.top - 10],
      ];
      // Slotted content answers as itself, not as the host, so ask whether
      // whatever is painted there belongs to the component.
      for (const [where, x, y] of probes) {
        const el = document.elementFromPoint(x, y);
        if (el && (el === component || component.contains(el))) {
          return { escapes: true, found: `${el.tagName.toLowerCase()} ${where}` };
        }
      }
      return { escapes: false, found: 'none' };
    },
    { selector, build }
  );
}
