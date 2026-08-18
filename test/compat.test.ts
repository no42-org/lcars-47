/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

/**
 * Cross-engine behavioral invariants, run in Chromium, Firefox and WebKit.
 *
 * This is a second tier beside the layout gate, not a matrix of it. The layout
 * gate's 1px tolerances are calibrated against Chromium; run verbatim in other
 * engines they fail on legitimate sub-pixel font differences, and widening
 * them would weaken the gate in its home engine. So this suite asserts only
 * behavior — booleans and inequalities, plus same-element equality within one
 * engine — in the categories where engines genuinely can disagree: font
 * metrics, container queries, clipping, and Web Audio activation.
 *
 * Known limit, deliberately accepted: Playwright WebKit is not iOS Safari. It
 * shares the layout engine but not the text stack (HarfBuzz/FreeType here,
 * Core Text on the phone), and text metrics are precisely the category that
 * produced the readout wrap-flicker bug. The real-device check stays manual:
 * RELEASING.md says to open the redeployed demo on a real phone after a
 * release. A green run here is not a device test.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type ViteDevServer } from 'vite';
import { chromium, firefox, webkit, type Browser, type Page } from 'playwright';
import {
  SUBPIXEL_TOLERANCE_PX,
  SAME_WIDTH_READOUT_VALUES,
  startWorkbenchServer,
  launchBrowser,
  openWorkbenchPage,
  probesFindComponentOutside,
} from './browser';

const ENGINES = [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
] as const;

let server: ViteDevServer;
let url: string;

beforeAll(async () => {
  ({ server, url } = await startWorkbenchServer());
});

afterAll(async () => {
  await server?.close();
});

describe.each(ENGINES)('%s', (engineName, engineType) => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await launchBrowser(engineType, engineName);
  });

  afterAll(async () => {
    await browser?.close();
  });

  async function openWorkbench(viewport = { width: 1280, height: 900 }): Promise<Page> {
    return openWorkbenchPage(browser, url, viewport);
  }

  it('renders every component with a non-zero box', async () => {
    // The cheap canary for engine-specific collapse: container-type computes
    // widths as if the box had no contents, custom-element upgrade timing
    // differs, and either failure mode renders as an invisible component with
    // no error anywhere.
    const p = await openWorkbench();
    try {
      const sizes = await p.evaluate(() => {
        const seen = new Map<string, { width: number; height: number }>();
        for (const el of document.querySelectorAll('*')) {
          const tag = el.tagName.toLowerCase();
          if (!tag.startsWith('lcars-')) continue;
          const r = el.getBoundingClientRect();
          const best = seen.get(tag);
          if (!best || r.width * r.height > best.width * best.height) {
            seen.set(tag, { width: r.width, height: r.height });
          }
        }
        return Object.fromEntries(seen);
      });
      expect(Object.keys(sizes).length).toBeGreaterThan(0);
      for (const [tag, size] of Object.entries(sizes)) {
        expect(size.width, `${tag} collapsed to zero width in ${engineName}`).toBeGreaterThan(0);
        expect(size.height, `${tag} collapsed to zero height in ${engineName}`).toBeGreaterThan(0);
      }
    } finally {
      await p.close();
    }
  });

  it('keeps a live readout the same size for every value with the same digit count', async () => {
    // The readout wrap-flicker class, checked per engine: font shaping, ch
    // resolution and advance hinting all differ across engines, and each has
    // already produced a distinct failure mode of this one invariant.
    const p = await openWorkbench({ width: 375, height: 812 });
    try {
      const r = await p.evaluate(async (values) => {
        const readout = document.getElementById('readout-power') as HTMLElement & {
          value: number;
          updateComplete: Promise<unknown>;
        };
        const out: Array<{ width: number; top: number }> = [];
        for (const value of values) {
          readout.value = value;
          await readout.updateComplete;
          const rect = readout.getBoundingClientRect();
          out.push({ width: rect.width, top: rect.top });
        }
        return out;
      }, SAME_WIDTH_READOUT_VALUES);
      for (const sample of r) {
        expect(
          Math.abs(sample.width - r[0].width),
          `readout width changed with its value in ${engineName}`
        ).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE_PX);
        expect(
          Math.abs(sample.top - r[0].top),
          `readout changed lines with its value in ${engineName}`
        ).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE_PX);
      }
    } finally {
      await p.close();
    }
  });

  it('paints nothing outside a panel given a height smaller than its content', async () => {
    const p = await openWorkbench();
    try {
      const r = await probesFindComponentOutside(
        p,
        'lcars-panel',
        `box.style.width = '400px';
         box.style.height = '120px';
         const panel = document.querySelector('lcars-panel');
         box.appendChild(panel);
         document.querySelector('.app-container')?.remove();
         panel.style.height = '120px';`
      );
      expect(r.escapes, `panel painted ${r.found} outside its box in ${engineName}`).toBe(false);
    } finally {
      await p.close();
    }
  });

  it('stacks an embedded frame in a narrow container and pins it in a wide one', async () => {
    // The container-query breakpoint, which answers to the frame's own width.
    // Keyed to the viewport this fails in opposite directions in the two
    // containers, and container queries are young enough to diverge by engine.
    const p = await openWorkbench();
    try {
      const r = await p.evaluate(() => {
        const measure = (cellWidth: number) => {
          const frame = document.querySelector('lcars-frame')!;
          const box = document.createElement('div');
          box.style.cssText = `width: ${cellWidth}px; height: 600px;`;
          document.body.prepend(box);
          box.appendChild(frame);
          document.querySelector('.app-container')?.remove();
          (frame as HTMLElement).style.height = '100%';
          (frame as HTMLElement).style.setProperty('--lcars-frame-height', '100%');
          const root = frame.shadowRoot!;
          const side = root.querySelector('.slot-sidebar')!.getBoundingClientRect();
          const main = root.querySelector('.slot-main')!.getBoundingClientRect();
          return { stacked: side.bottom <= main.top + 1, width: frame.getBoundingClientRect().width };
        };
        const narrow = measure(400);
        const wide = measure(800);
        return { narrow, wide };
      });
      expect(r.narrow.stacked, `narrow frame did not stack in ${engineName}`).toBe(true);
      expect(r.wide.stacked, `wide frame stacked in ${engineName}`).toBe(false);
      expect(Math.round(r.wide.width)).toBe(800);
    } finally {
      await p.close();
    }
  });

  it('starts audio from a real click and plays a sound', async () => {
    // Web Audio activation is policy-gated per engine. A genuine click through
    // the browser's input stack must leave the synthesizer's context running
    // and playable; a synthetic dispatchEvent would not prove that.
    const p = await openWorkbench();
    try {
      await p.click('#btn-sound-warp');
      const r = await p.evaluate(async () => {
        // Same module instance the page's components use: the dev server
        // resolves this specifier to the already-registered singleton. Built
        // via Function because vitest's transformer would rewrite a literal
        // dynamic import in this closure into an SSR helper the browser
        // does not have.
        const dynamicImport = new Function('s', 'return import(s)') as (
          s: string
        ) => Promise<typeof import('../src/index')>;
        const mod = await dynamicImport('/src/index.ts');
        const synth = mod.getAudioSynthesizer();
        // Poll the accessor, never a captured context: the synthesizer
        // re-creates a closed or failed context on the next play, so a
        // snapshot can report 'no-context' while audio is running.
        for (let i = 0; i < 50 && synth.getContextState() !== 'running'; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        // With a running context and no mute, play() cannot take its noop
        // path, so a green result means the synthesis path actually ran.
        const muted = mod.isAudioMuted();
        mod.playLcarsSound('chirp');
        return { state: synth.getContextState() ?? 'no-context', muted };
      });
      expect(r.state, `audio context did not start in ${engineName}`).toBe('running');
      expect(r.muted, `audio unexpectedly muted in ${engineName}`).toBe(false);
    } finally {
      await p.close();
    }
  });
});
