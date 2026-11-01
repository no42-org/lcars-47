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
  measureWideTable,
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

  it('scrolls a wide table inside its own box', async () => {
    const p = await openWorkbench({ width: 400, height: 800 });
    try {
      expect(await measureWideTable(p)).toEqual({ pageGrew: false, scrollsInside: true });
    } finally {
      await p.close();
    }
  });

  it('keeps a table header fixed over a scrolled body', async () => {
    const p = await openWorkbench();
    try {
      const r = await p.evaluate(async () => {
        const box = document.createElement('div');
        box.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 9999; width: 600px; height: 200px';
        const table = document.createElement('lcars-table') as HTMLElement & {
          columns: unknown[];
          rows: unknown[];
          updateComplete: Promise<unknown>;
        };
        table.style.height = '100%';
        table.columns = [{ key: 'name', label: 'NAME' }];
        table.rows = Array.from({ length: 20 }, (_, i) => ({ name: `Contact ${i}` }));
        box.appendChild(table);
        document.body.appendChild(box);
        await table.updateComplete;
        const scroll = table.shadowRoot!.querySelector('.scroll')!;
        scroll.scrollTop = scroll.scrollHeight;
        await new Promise(requestAnimationFrame);
        return {
          scrolled: scroll.scrollTop > 0,
          gap: table.shadowRoot!.querySelector('th')!.getBoundingClientRect().top - box.getBoundingClientRect().top,
          boxClip: getComputedStyle(scroll).clipPath,
        };
      });
      expect(r.scrolled, `table did not scroll in ${engineName}`).toBe(true);
      expect(Math.abs(r.gap), `header moved in ${engineName}`).toBeLessThanOrEqual(1);
      // The compositor clip against Safari's seam above the header; see the
      // layout gate for what it covers. Pinned here too because WebKit is the
      // engine it is for, and a rule scoped away from one engine would pass
      // the other's gate.
      expect(r.boxClip, `scroll box clip missing in ${engineName}`).toBe('inset(0px)');
    } finally {
      await p.close();
    }
  });

  it('keeps a disabled chip on the focus path and restores it', async () => {
    // Engines disagree on both halves: what happens to focus on a button that
    // becomes disabled, and whether a delegatesFocus host with nothing left to
    // delegate to can take focus (none can: focus lands on the chip's surface).
    // Both controls start the path, because either can hold focus when disabled.
    // Inputs as neighbours, because they are Tab stops in every engine.
    const p = await openWorkbench();
    try {
      await p.evaluate(async () => {
        const box = document.createElement('div');
        box.id = 'chip-compat';
        box.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 9999';
        box.innerHTML =
          '<input id="chip-before" />' +
          '<button id="chip-plain"></button>' +
          '<lcars-chip label="WARP" removable></lcars-chip>' +
          '<input id="chip-after" />';
        document.body.prepend(box);
        await (box.children[2] as HTMLElement & { updateComplete: Promise<unknown> })
          .updateComplete;
      });
      const setDisabled = (disabled: boolean) =>
        p.evaluate(async (disabled) => {
          const chip = document.querySelector('#chip-compat lcars-chip') as HTMLElement & {
            disabled: boolean;
            updateComplete: Promise<unknown>;
          };
          chip.disabled = disabled;
          await chip.updateComplete;
        }, disabled);
      const focused = () =>
        p.evaluate(() => {
          const active = document.activeElement!;
          const inner = active.shadowRoot?.activeElement;
          return inner?.tagName === 'BUTTON' ? `.${inner.className}` : active.id || active.tagName;
        });

      await p.locator('#chip-before').focus();
      await p.keyboard.press('Tab');
      const buttonsAreTabStops = (await focused()) === 'chip-plain';

      for (const control of ['.chip-toggle', '.chip-remove']) {
        await p.locator(`#chip-compat ${control}`).focus();
        await setDisabled(true);
        expect(await focused(), `${control} lost focus in ${engineName}`).toBe('LCARS-CHIP');
        await setDisabled(false);
        expect(await focused(), `re-enable from ${control} in ${engineName}`).toBe('.chip-toggle');
      }

      await setDisabled(true);
      await p.keyboard.press('Tab');
      expect(await focused(), `Tab from a disabled chip in ${engineName}`).toBe('chip-after');
      await setDisabled(false);
      await p.keyboard.press('Shift+Tab');
      // Whether Tab stops on a button depends on the platform: WebKit on macOS
      // skips them, WebKit on Linux does not. A chip control must do what a
      // plain button does here.
      const previous = buttonsAreTabStops ? '.chip-remove' : 'chip-before';
      expect(await focused(), `Shift+Tab after re-enable in ${engineName}`).toBe(previous);
    } finally {
      await p.close();
    }
  });

  it('keeps a disabled keypad on the focus path and restores it', async () => {
    // The same pair of engine disagreements as the chip above. Without a
    // focusable surface every key is disabled and delegation has nowhere to go.
    const p = await openWorkbench();
    try {
      await p.evaluate(async () => {
        const box = document.createElement('div');
        box.id = 'keypad-compat';
        box.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 9999';
        box.innerHTML =
          '<input id="keypad-before" />' +
          '<button id="keypad-plain"></button>' +
          '<lcars-keypad></lcars-keypad>' +
          '<input id="keypad-after" />';
        document.body.prepend(box);
        await (box.children[2] as HTMLElement & { updateComplete: Promise<unknown> })
          .updateComplete;
      });
      const setDisabled = (disabled: boolean) =>
        p.evaluate(async (disabled) => {
          const keypad = document.querySelector('#keypad-compat lcars-keypad') as HTMLElement & {
            disabled: boolean;
            updateComplete: Promise<unknown>;
          };
          keypad.disabled = disabled;
          await keypad.updateComplete;
        }, disabled);
      const focused = () =>
        p.evaluate(() => {
          const active = document.activeElement!;
          const inner = active.shadowRoot?.activeElement as HTMLElement | null | undefined;
          return inner?.dataset.key ?? (active.id || active.tagName);
        });

      // Whether Tab stops on a button depends on the platform, as for the chip.
      await p.locator('#keypad-before').focus();
      await p.keyboard.press('Tab');
      const buttonsAreTabStops = (await focused()) === 'keypad-plain';
      await p.locator('#keypad-plain').focus();
      await p.keyboard.press('Tab');
      expect(await focused(), `Tab into a keypad in ${engineName}`).toBe(
        buttonsAreTabStops ? '1' : 'keypad-after'
      );

      await p.locator('#keypad-compat [data-key="5"]').focus();
      await setDisabled(true);
      expect(await focused(), `disable in ${engineName}`).toBe('LCARS-KEYPAD');
      await setDisabled(false);
      expect(await focused(), `re-enable in ${engineName}`).toBe('5');
      await p.keyboard.press('Shift+Tab');
      expect(await focused(), `Shift+Tab after re-enable in ${engineName}`).toBe(
        buttonsAreTabStops ? '4' : 'keypad-before'
      );

      await p.locator('#keypad-compat [data-key="5"]').focus();
      await setDisabled(true);
      await p.keyboard.press('Tab');
      expect(await focused(), `Tab from a disabled keypad in ${engineName}`).toBe('keypad-after');
    } finally {
      await p.close();
    }
  });

  it('centres Antonio capitals in a button label', async () => {
    // Font metrics are the category engines disagree on. The balance lives in
    // the font files; see src/tokens/fonts/README.md. This passes in Playwright
    // WebKit whatever real Safari does, so `make check-safari` is the proof
    // for Safari. The baseline
    // comes from an empty inline-block, which sits on it; canvas gives the cap
    // height, because no DOM box measures ink. Mirrored for real Safari in
    // scripts/measure-safari-centering.mjs; change the two together.
    const p = await openWorkbench();
    try {
      const r = await p.evaluate(async () => {
        const button = document.createElement('lcars-button') as HTMLElement & {
          updateComplete: Promise<unknown>;
        };
        button.innerHTML = '<span>ENGAGE<i style="display: inline-block; width: 0; height: 0"></i></span>';
        document.body.appendChild(button);
        try {
          await button.updateComplete;
          const inner = button.shadowRoot!.querySelector('.button-inner')!;
          const style = getComputedStyle(inner);
          const font = `${style.fontWeight} ${style.fontSize} Antonio`;
          await document.fonts.load(font);
          const box = inner.getBoundingClientRect();
          const baseline = button.querySelector('i')!.getBoundingClientRect().bottom;
          const context = document.createElement('canvas').getContext('2d')!;
          context.font = font;
          const capHeight = context.measureText('H').actualBoundingBoxAscent;
          return { above: baseline - capHeight - box.top, below: box.bottom - baseline };
        } finally {
          button.remove();
        }
      });
      expect(
        Math.abs(r.above - r.below),
        `${r.above}px above and ${r.below}px below the capitals in ${engineName}`
      ).toBeLessThanOrEqual(SUBPIXEL_TOLERANCE_PX);
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

  it('keeps positioned main content from stretching the document', async () => {
    const p = await openWorkbench();
    try {
      const r = await p.evaluate(() => {
        const block = document.createElement('div');
        block.setAttribute('slot', 'main');
        block.innerHTML =
          '<div style="height: 2000px"></div><span style="position: absolute; width: 1px; height: 1px">hidden</span>';
        document.querySelector('lcars-frame')!.appendChild(block);
        return { documentHeight: document.documentElement.scrollHeight, viewportHeight: window.innerHeight };
      });
      expect(r.documentHeight, `document grew in ${engineName}`).toBe(r.viewportHeight);
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
    // the browser's input stack must leave the synthesizer's context created
    // and playable; a synthetic dispatchEvent would not prove that.
    //
    // On headless Linux (CI) there is no audio backend, so Firefox keeps the
    // context 'suspended' even after a real click and ctx.resume(). The test
    // accepts 'running' or 'suspended' — both prove a context was created and
    // resume() was attempted — while rejecting 'closed' and 'no-context'
    // (which would mean the synthesis path was never entered).
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
        // Poll until the context settles. On engines with an audio backend
        // this reaches 'running'; on headless Linux Firefox it stays
        // 'suspended'. Either proves the synthesis path was entered.
        for (
          let i = 0, s = synth.getContextState();
          i < 50 && (s === null || s === 'closed');
          i++, s = synth.getContextState()
        ) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        // With a created context and no mute, play() cannot take its noop
        // path, so a green result means the synthesis path actually ran.
        const muted = mod.isAudioMuted();
        mod.playLcarsSound('chirp');
        return { state: synth.getContextState() ?? 'no-context', muted };
      });
      expect(
        ['running', 'suspended'],
        `audio context in unexpected state '${r.state}' in ${engineName}`
      ).toContain(r.state);
      expect(r.muted, `audio unexpectedly muted in ${engineName}`).toBe(false);
    } finally {
      await p.close();
    }
  });
});
