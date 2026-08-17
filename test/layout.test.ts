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
 *   - Anything to do with scrollbars. Gutters and their effect on the container
 *     query width are invisible on macOS overlay scrollbars, so those choices
 *     are policy on every platform and asserted by nothing here.
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
        (frame as HTMLElement).style.height = '100%';
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

  /**
   * The frame is a size container, so its layout answers to its own width.
   * Both of these fail when the breakpoint is keyed to the viewport, and they
   * fail in opposite directions.
   */
  async function embed(
    viewport: typeof VIEWPORT,
    cell: { width: number; height: number }
  ): Promise<{
    frameWidth: number;
    stacked: boolean;
    sidebarAboveMain: boolean;
    overshoot: number;
  }> {
    const p = await openWorkbench(viewport);
    try {
      return await p.evaluate((cell) => {
        const frame = document.querySelector('lcars-frame')!;
        const box = document.createElement('div');
        box.style.cssText = `width: ${cell.width}px; height: ${cell.height}px;`;
        document.body.prepend(box);
        box.appendChild(frame);
        document.querySelector('.app-container')?.remove();
        // Filling a container takes both halves: the element is told to fill
        // its parent, and the frame is told to use that height. The token
        // alone is a percentage with nothing definite to resolve against.
        (frame as HTMLElement).style.height = '100%';
        (frame as HTMLElement).style.setProperty('--lcars-frame-height', '100%');

        const root = frame.shadowRoot!;
        const side = root.querySelector('.slot-sidebar')!.getBoundingClientRect();
        const main = root.querySelector('.slot-main')!.getBoundingClientRect();
        const footer = root.querySelector('.slot-footer-row')!.getBoundingClientRect();
        return {
          frameWidth: Math.round(frame.getBoundingClientRect().width),
          stacked: side.bottom <= main.top + 1,
          sidebarAboveMain: side.top < main.top,
          overshoot: footer.bottom - box.getBoundingClientRect().bottom,
        };
      }, cell);
    } finally {
      await p.close();
    }
  }

  it('keeps a roomy frame pinned inside its box on a narrow screen', async () => {
    // Keyed to the viewport this stacked and burst out of the container.
    const r = await embed(NARROW_VIEWPORT, { width: 800, height: 400 });
    expect(r.frameWidth).toBe(800);
    expect(r.stacked).toBe(false);
    expect(r.overshoot).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE_PX);
  });

  it('stacks a narrow frame on a wide screen', async () => {
    // Keyed to the viewport this kept a 160px sidebar beside a 220px main.
    const r = await embed(VIEWPORT, { width: 400, height: 900 });
    expect(r.frameWidth).toBe(400);
    expect(r.stacked).toBe(true);
  });

  it('stacks the sidebar above main, matching the order the keyboard walks', async () => {
    // DOM order is sidebar then main, and the wide layout puts the sidebar in
    // the left column. Reversing that when stacked sent Tab to the lower block
    // first and then back up (#28).
    const r = await embed(VIEWPORT, { width: 400, height: 900 });
    expect(r.sidebarAboveMain).toBe(true);
  });

  it('survives being placed somewhere shrink-to-fit', async () => {
    // Inline-size containment computes the host's width as if it had no
    // contents, so without an explicit width the frame collapses to nothing in
    // every one of these and renders invisible, with no error anywhere.
    const p = await openWorkbench(VIEWPORT);
    try {
      const widths = await p.evaluate(() => {
        const frame = document.querySelector('lcars-frame')!;
        document.querySelector('.app-container')?.remove();
        const parents: Record<string, string> = {
          'flex item': 'display: flex; width: 1000px;',
          'inline-block': 'display: inline-block; width: 1000px;',
          float: 'width: 1000px;',
          absolute: 'position: relative; width: 1000px; height: 600px;',
        };
        const out: Record<string, number> = {};
        for (const [name, css] of Object.entries(parents)) {
          const parent = document.createElement('div');
          parent.style.cssText = css;
          document.body.append(parent);
          parent.appendChild(frame);
          if (name === 'float') (frame as HTMLElement).style.cssText = 'float: left';
          else if (name === 'absolute') (frame as HTMLElement).style.cssText = 'position: absolute';
          else (frame as HTMLElement).style.cssText = '';
          out[name] = Math.round(frame.getBoundingClientRect().width);
        }
        return out;
      });
      for (const [context, width] of Object.entries(widths)) {
        expect(width, `frame collapsed as a ${context}`).toBeGreaterThan(100);
      }
    } finally {
      await p.close();
    }
  });

  it('is exactly as tall as it says, whatever its parent is', async () => {
    // The host must not carry a height of its own. When it does, a parent
    // taller than the token leaves a band of frame-coloured dead space below
    // the console and pushes the next sibling down.
    const p = await openWorkbench(VIEWPORT);
    try {
      const r = await p.evaluate(() => {
        const frame = document.querySelector('lcars-frame')!;
        const parent = document.createElement('div');
        parent.style.cssText = 'width: 800px; height: 800px;';
        document.body.prepend(parent);
        parent.appendChild(frame);
        document.querySelector('.app-container')?.remove();
        (frame as HTMLElement).style.setProperty('--lcars-frame-height', '400px');
        const grid = frame.shadowRoot!.querySelector('.frame-grid')!;
        return {
          host: frame.getBoundingClientRect().height,
          grid: grid.getBoundingClientRect().height,
        };
      });
      expect(r.grid).toBeCloseTo(400, 0);
      expect(r.host).toBeCloseTo(r.grid, 0);
    } finally {
      await p.close();
    }
  });

  /**
   * Containment, asserted by hit-testing rather than by arithmetic.
   *
   * A scrolled element reports content rectangles far outside its own box while
   * being correctly clipped, so `getBoundingClientRect` cannot tell a contained
   * component from an escaping one. `elementFromPoint` can, and it states the
   * invariant literally: nothing of this component is painted outside its box.
   * Shadow content reports the host, so one probe covers everything inside.
   */
  async function paintsBelowItsBox(
    selector: string,
    build: string
  ): Promise<{ escapes: boolean; found: string }> {
    const p = await openWorkbench(VIEWPORT);
    try {
      return await p.evaluate(
        ({ selector, build }) => {
          const box = document.createElement('div');
          box.style.cssText = 'position: absolute; top: 40px; left: 40px;';
          document.body.prepend(box);
          // eslint-disable-next-line no-new-func
          new Function('box', build)(box);

          const component = document.querySelector(selector)!;
          const r = box.getBoundingClientRect();
          // Sample every edge, not just one point below the middle. Content can
          // leave sideways as easily as downwards.
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
    } finally {
      await p.close();
    }
  }

  it('paints nothing outside a container too small for it', async () => {
    const r = await paintsBelowItsBox(
      'lcars-frame',
      `box.style.width = '360px';
       box.style.height = '420px';
       const frame = document.querySelector('lcars-frame');
       box.appendChild(frame);
       document.querySelector('.app-container')?.remove();
       frame.style.height = '100%';
       frame.style.setProperty('--lcars-frame-height', '100%');`
    );
    expect(r.escapes, `frame painted ${r.found} below its container`).toBe(false);
  });

  it('paints nothing outside a panel given a height smaller than its content', async () => {
    const r = await paintsBelowItsBox(
      'lcars-panel',
      `box.style.width = '400px';
       box.style.height = '120px';
       const panel = document.querySelector('lcars-panel');
       box.appendChild(panel);
       document.querySelector('.app-container')?.remove();
       panel.style.height = '120px';`
    );
    expect(r.escapes, `panel painted ${r.found} below its container`).toBe(false);
  });

  it('keeps bar text inside its band when a long elbow heading squeezes it', async () => {
    // How much room the bar gets depends on how long the *elbow's* heading is,
    // which is an unrelated authoring decision. A fixed band height turns that
    // into text rendered outside the bar. #18 fixed this below the narrow
    // breakpoint only, which treated a general constraint as a mobile symptom.
    const p = await openWorkbench({ width: 900, height: 720 });
    try {
      const r = await p.evaluate(async () => {
        const frame = document.querySelector('lcars-frame')!;
        const elbow = frame.querySelector('lcars-elbow[slot="elbow-tl"]') as HTMLElement & {
          heading: string;
          updateComplete: Promise<unknown>;
        };
        elbow.heading = 'UNITED FEDERATION OF PLANETS STARFLEET COMMAND SECTOR 001';
        await elbow.updateComplete;

        const band = frame.shadowRoot!.querySelector('.slot-top-bar')!.getBoundingClientRect();
        const content = frame.querySelector('[slot="top-bar"]')!.getBoundingClientRect();
        return {
          bandHeight: Math.round(band.height),
          contentHeight: Math.round(content.height),
          spillsBelow: Math.round(content.bottom - band.bottom),
          spillsAbove: Math.round(band.top - content.top),
        };
      });
      expect(r.spillsBelow, 'bar text rendered below its band').toBeLessThanOrEqual(
        SUBPIXEL_TOLERANCE_PX
      );
      expect(r.spillsAbove, 'bar text rendered above its band').toBeLessThanOrEqual(
        SUBPIXEL_TOLERANCE_PX
      );
    } finally {
      await p.close();
    }
  });

  it('sizes the elbow arch from its own property, falling back to the sidebar', async () => {
    const p = await openWorkbench(VIEWPORT);
    try {
      const r = await p.evaluate(async () => {
        const elbow = document.querySelector('lcars-elbow') as HTMLElement & {
          updateComplete: Promise<unknown>;
        };
        const arch = () =>
          Math.round(elbow.shadowRoot!.querySelector('.arch')!.getBoundingClientRect().width);

        const byDefault = arch();
        // An elbow used outside a frame has no sidebar to inherit from, so it
        // must be sizeable on its own terms.
        elbow.style.setProperty('--lcars-elbow-width', '220px');
        const overridden = arch();
        elbow.style.removeProperty('--lcars-elbow-width');
        // With no elbow width of its own, the arch tracks the sidebar column it
        // has to line up with.
        elbow.style.setProperty('--lcars-sidebar-width', '200px');
        const followsSidebar = arch();
        return { byDefault, overridden, followsSidebar };
      });
      expect(r.byDefault).toBe(160);
      expect(r.overridden).toBe(220);
      expect(r.followsSidebar).toBe(200);
    } finally {
      await p.close();
    }
  });

  it('lets a panel grow inside the region that scrolls it', async () => {
    // The clamp must not reach panels placed in a frame region. Those sit in a
    // flex container with a definite height, so a clamp on the panel host
    // resolves there and cuts the panel down to the region, giving it an inner
    // scroller and stopping the region from scrolling it.
    const p = await openWorkbench(VIEWPORT);
    try {
      const r = await p.evaluate(async () => {
        const frame = document.querySelector('lcars-frame')!;
        const panel = document.createElement('lcars-panel') as HTMLElement & {
          updateComplete: Promise<unknown>;
        };
        panel.setAttribute('slot', 'main');
        frame.appendChild(panel);
        await panel.updateComplete;
        const block = document.createElement('div');
        block.style.cssText = 'height: 2000px;';
        panel.appendChild(block);

        const main = frame.shadowRoot!.querySelector('.slot-main')!;
        const body = panel.shadowRoot!.querySelector('.panel-body')!;
        return {
          mainHeight: Math.round(main.getBoundingClientRect().height),
          panelHeight: Math.round(panel.getBoundingClientRect().height),
          panelBodyScrolls: body.scrollHeight > body.clientHeight,
          mainScrolls: main.scrollHeight > main.clientHeight,
        };
      });
      expect(r.panelHeight).toBeGreaterThan(r.mainHeight);
      expect(r.panelBodyScrolls).toBe(false);
      expect(r.mainScrolls).toBe(true);
    } finally {
      await p.close();
    }
  });

  it('leaves an unbounded parent alone', async () => {
    // The clamp must be inert wherever the parent's height is indefinite, which
    // is every ordinary page, or it would cap the viewport shell too.
    const p = await openWorkbench(NARROW_VIEWPORT);
    try {
      const r = await p.evaluate(() => {
        const frame = document.querySelector('lcars-frame')!;
        const block = document.createElement('div');
        block.setAttribute('slot', 'main');
        block.style.cssText = 'height: 2000px;';
        frame.appendChild(block);
        return {
          frameHeight: Math.round(frame.getBoundingClientRect().height),
          pageScrolls: document.documentElement.scrollHeight > window.innerHeight,
        };
      });
      expect(r.frameHeight).toBeGreaterThan(NARROW_VIEWPORT.height);
      expect(r.pageScrolls).toBe(true);
    } finally {
      await p.close();
    }
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
