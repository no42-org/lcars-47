/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as lcars from '../src/index';
import { LcarsKeypad, type LcarsChangeEventDetail } from '../src/components/lcars-keypad';
import { closeAudio, getAudioSynthesizer, muteAudio, unmuteAudio } from '../src/audio/index';

// Minimal Web Audio doubles: the muted path is asserted by counting node
// construction, so every factory must be observable.
class MockAudioParam {
  value = 0;
  setValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
}

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = new MockAudioParam();
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowpass';
  frequency = new MockAudioParam();
}

class MockAudioContext {
  state = 'running';
  currentTime = 0;
  destination = new MockAudioNode();
  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

const originalAudioContext = window.AudioContext;

const mount = async (markup = '<lcars-keypad></lcars-keypad>'): Promise<LcarsKeypad> => {
  document.body.innerHTML = markup;
  const pad = document.body.firstElementChild as LcarsKeypad;
  await pad.updateComplete;
  return pad;
};

const keyButton = (pad: LcarsKeypad, key: string): HTMLButtonElement => {
  const button = pad.shadowRoot?.querySelector<HTMLButtonElement>(`.key[data-key="${key}"]`);
  if (!button) {
    throw new Error(`keypad has no key "${key}"`);
  }
  return button;
};

const press = (pad: LcarsKeypad, key: string): void => {
  keyButton(pad, key).click();
};

const type = (pad: LcarsKeypad, key: string, init: KeyboardEventInit = {}): void => {
  pad.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, ...init }));
};

describe('<lcars-keypad>', () => {
  beforeEach(() => {
    // @ts-expect-error Mocking window.AudioContext
    window.AudioContext = MockAudioContext;
    document.body.innerHTML = '';
    unmuteAudio();
  });

  afterEach(async () => {
    await closeAudio();
    window.AudioContext = originalAudioContext;
    // The synthesizer is a module-level singleton: spies survive the test that
    // installed them unless they are restored here.
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('registration', () => {
    it('registers the tag from the barrel and exports the class', () => {
      expect(customElements.get('lcars-keypad')).toBe(LcarsKeypad);
      expect(lcars).toHaveProperty('LcarsKeypad');
    });
  });

  describe('numeric entry', () => {
    it('accumulates digits and emits one typed lcars-change per keypress', async () => {
      const pad = await mount();
      const changes: CustomEvent<LcarsChangeEventDetail>[] = [];
      pad.addEventListener('lcars-change', (e) =>
        changes.push(e as CustomEvent<LcarsChangeEventDetail>)
      );

      press(pad, '4');
      press(pad, '7');
      await pad.updateComplete;

      expect(pad.value).toBe('47');
      expect(changes).toHaveLength(2);
      expect(changes[0].detail).toEqual({ value: '4', key: '4' });
      expect(changes[1].detail).toEqual({ value: '47', key: '7' });
      // The events must bubble and cross shadow boundaries: without both, a
      // host listening outside the shadow tree of a wrapping component never
      // sees the entry.
      expect(changes[0].bubbles).toBe(true);
      expect(changes[0].composed).toBe(true);
    });

    it('plays the input sound once per accepted keypress', async () => {
      const pad = await mount();
      const playSpy = vi.spyOn(getAudioSynthesizer(), 'play');

      press(pad, '4');
      press(pad, '7');

      expect(playSpy).toHaveBeenCalledTimes(2);
      expect(playSpy).toHaveBeenNthCalledWith(1, 'input', undefined);
    });

    it('renders every digit plus the command keys', async () => {
      const pad = await mount();
      for (const key of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', 'CLR', 'ENTER']) {
        expect(() => keyButton(pad, key), `missing key ${key}`).not.toThrow();
      }
    });
  });

  describe('command submit', () => {
    it('emits exactly one lcars-submit carrying the accumulated value', async () => {
      const pad = await mount();
      const submits = vi.fn();
      pad.addEventListener('lcars-submit', submits);

      press(pad, '4');
      press(pad, '7');
      press(pad, 'ENTER');

      expect(submits).toHaveBeenCalledTimes(1);
      const event = submits.mock.calls[0][0] as CustomEvent<{ value: string }>;
      expect(event.detail).toEqual({ value: '47' });
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    });

    it('plays acknowledge on submit', async () => {
      const pad = await mount();
      press(pad, '4');
      const playSpy = vi.spyOn(getAudioSynthesizer(), 'play');

      press(pad, 'ENTER');
      expect(playSpy).toHaveBeenCalledWith('acknowledge', undefined);
    });

    it('emits nothing and plays deny when the value is empty', async () => {
      const pad = await mount();
      const submits = vi.fn();
      pad.addEventListener('lcars-submit', submits);
      const playSpy = vi.spyOn(getAudioSynthesizer(), 'play');

      press(pad, 'ENTER');

      expect(submits).not.toHaveBeenCalled();
      expect(playSpy).toHaveBeenCalledWith('deny', undefined);
    });

    it('keeps the value after submit so the host decides when to reset', async () => {
      const pad = await mount();
      press(pad, '4');
      press(pad, 'ENTER');
      expect(pad.value).toBe('4');
    });

    // `value` must stay a writable reactive property: the documented reset
    // idiom (and the workbench demo) is `pad.value = ''` after submit. A
    // read-only getter would strand the panel on its last entry.
    it('round-trips a host reset: submit, clear via value, keep accepting keys', async () => {
      const pad = await mount('<lcars-keypad maxlength="3"></lcars-keypad>');
      const changes: CustomEvent<LcarsChangeEventDetail>[] = [];
      pad.addEventListener('lcars-change', (e) =>
        changes.push(e as CustomEvent<LcarsChangeEventDetail>)
      );
      const submits = vi.fn();
      pad.addEventListener('lcars-submit', submits);

      press(pad, '4');
      press(pad, '7');
      press(pad, 'ENTER');
      expect(submits).toHaveBeenCalledTimes(1);

      pad.value = '';
      await pad.updateComplete;
      expect(pad.value).toBe('');

      changes.length = 0;
      press(pad, '1');
      expect(pad.value).toBe('1');
      expect(changes).toHaveLength(1);
      expect(changes[0].detail).toEqual({ value: '1', key: '1' });

      // The reset also restored the full maxlength budget.
      press(pad, '2');
      press(pad, '3');
      expect(pad.value).toBe('123');
      press(pad, '4');
      expect(pad.value).toBe('123');
    });

    it('survives a non-string value assignment', async () => {
      const pad = await mount();
      // @ts-expect-error hosts do this; it must not throw on the next keypress
      pad.value = 47;
      await pad.updateComplete;
      expect(pad.value).toBe('47');

      expect(() => press(pad, 'DEL')).not.toThrow();
      expect(pad.value).toBe('4');
    });
  });

  describe('max length', () => {
    it('rejects further keypresses, plays deny and emits no change', async () => {
      const pad = await mount('<lcars-keypad maxlength="4"></lcars-keypad>');
      const changes = vi.fn();
      pad.addEventListener('lcars-change', changes);

      for (const d of ['1', '2', '3', '4']) {
        press(pad, d);
      }
      expect(pad.value).toBe('1234');
      expect(changes).toHaveBeenCalledTimes(4);

      const playSpy = vi.spyOn(getAudioSynthesizer(), 'play');
      changes.mockClear();
      press(pad, '5');
      type(pad, '6');

      expect(pad.value).toBe('1234');
      expect(changes).not.toHaveBeenCalled();
      expect(playSpy).toHaveBeenCalledTimes(2);
      expect(playSpy).toHaveBeenNthCalledWith(1, 'deny', undefined);
    });

    it('treats every non-positive or non-numeric maxlength as unlimited', async () => {
      // A keypad that accepts nothing is never the intent, so none of these
      // may leave the grid permanently inert.
      for (const markup of [
        '<lcars-keypad></lcars-keypad>',
        '<lcars-keypad maxlength=""></lcars-keypad>',
        '<lcars-keypad maxlength="0"></lcars-keypad>',
        '<lcars-keypad maxlength="-1"></lcars-keypad>',
        '<lcars-keypad maxlength="abc"></lcars-keypad>',
      ]) {
        const pad = await mount(markup);
        for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
          press(pad, d);
        }
        expect(pad.value, markup).toBe('1234567890');
      }
    });

    it('clamps a programmatic value to maxlength, in either assignment order', async () => {
      const pad = await mount('<lcars-keypad maxlength="4"></lcars-keypad>');

      pad.value = '123456789';
      await pad.updateComplete;
      expect(pad.value).toBe('1234');

      // Shrinking the limit under an existing entry must not leave an
      // over-long value that lcars-submit would then emit.
      pad.value = '1234';
      pad.maxLength = 2;
      await pad.updateComplete;
      expect(pad.value).toBe('12');

      const submits = vi.fn();
      pad.addEventListener('lcars-submit', submits);
      press(pad, 'ENTER');
      expect((submits.mock.calls[0][0] as CustomEvent<{ value: string }>).detail.value).toBe('12');
    });
  });

  describe('clear and delete', () => {
    it('DEL removes the last character and CLR empties the entry', async () => {
      const pad = await mount();
      const changes: CustomEvent<LcarsChangeEventDetail>[] = [];
      pad.addEventListener('lcars-change', (e) =>
        changes.push(e as CustomEvent<LcarsChangeEventDetail>)
      );

      press(pad, '4');
      press(pad, '7');
      press(pad, 'DEL');
      expect(pad.value).toBe('4');
      expect(changes.at(-1)?.detail).toEqual({ value: '4', key: 'DEL' });

      press(pad, '7');
      press(pad, 'CLR');
      expect(pad.value).toBe('');
      expect(changes.at(-1)?.detail).toEqual({ value: '', key: 'CLR' });
    });

    it('is a strict no-op on an already-empty value', async () => {
      const pad = await mount();
      const changes = vi.fn();
      pad.addEventListener('lcars-change', changes);
      const playSpy = vi.spyOn(getAudioSynthesizer(), 'play');

      press(pad, 'DEL');
      press(pad, 'CLR');
      type(pad, 'Backspace');

      expect(pad.value).toBe('');
      expect(changes).not.toHaveBeenCalled();
      expect(playSpy).not.toHaveBeenCalled();
    });
  });

  describe('disabled', () => {
    it('ignores every actuation: no value change, no event, no sound', async () => {
      const pad = await mount('<lcars-keypad disabled></lcars-keypad>');
      const events = vi.fn();
      pad.addEventListener('lcars-change', events);
      pad.addEventListener('lcars-submit', events);
      const playSpy = vi.spyOn(getAudioSynthesizer(), 'play');

      press(pad, '4');
      press(pad, 'DEL');
      press(pad, 'CLR');
      press(pad, 'ENTER');
      type(pad, '7');
      type(pad, 'Enter');
      type(pad, 'Backspace');

      expect(pad.value).toBe('');
      expect(events).not.toHaveBeenCalled();
      expect(playSpy).not.toHaveBeenCalled();
    });

    it('reclaims focus instead of stranding it when disabled mid-focus', async () => {
      const pad = await mount();
      const key = keyButton(pad, '4');
      key.focus();
      expect(pad.shadowRoot?.activeElement).toBe(key);

      // Where focus lands is the browser's business (happy-dom does not model
      // blur-on-disable, and refuses focus() on anything carrying a `disabled`
      // attribute), so pin the two steps the component owns: the focused key
      // is released, and the keypad reclaims focus rather than leaving the
      // user at the top of the document.
      const focusSpy = vi.spyOn(pad, 'focus');
      pad.disabled = true;
      await pad.updateComplete;

      expect(pad.shadowRoot?.activeElement).not.toBe(key);
      expect(focusSpy).toHaveBeenCalledTimes(1);
    });

    it('leaves focus alone when disabled while no key holds it', async () => {
      const pad = await mount();
      const focusSpy = vi.spyOn(pad, 'focus');

      pad.disabled = true;
      await pad.updateComplete;

      expect(focusSpy).not.toHaveBeenCalled();
    });

    it('takes every key out of the tab order while disabled', async () => {
      const pad = await mount('<lcars-keypad disabled></lcars-keypad>');
      const keys = pad.shadowRoot?.querySelectorAll<HTMLButtonElement>('.key') ?? [];
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(key.disabled).toBe(true);
      }
      expect(pad.shadowRoot?.querySelector('.keypad')?.getAttribute('aria-disabled')).toBe('true');

      pad.disabled = false;
      await pad.updateComplete;
      expect(keyButton(pad, '4').disabled).toBe(false);
    });
  });

  describe('muted audio', () => {
    it('keeps keys functional and constructs zero audio nodes when globally muted', async () => {
      const pad = await mount();
      // Warm the context up before muting so the node factories are observable.
      press(pad, '1');
      // @ts-expect-error access private for testing
      const ctx = getAudioSynthesizer().getAudioContext() as unknown as MockAudioContext;
      ctx.createOscillator.mockClear();
      ctx.createGain.mockClear();
      ctx.createBiquadFilter.mockClear();

      muteAudio();
      const changes = vi.fn();
      const submits = vi.fn();
      pad.addEventListener('lcars-change', changes);
      pad.addEventListener('lcars-submit', submits);

      press(pad, '4');
      press(pad, '7');
      press(pad, 'ENTER');

      expect(pad.value).toBe('147');
      expect(changes).toHaveBeenCalledTimes(2);
      expect(submits).toHaveBeenCalledTimes(1);
      expect(ctx.createOscillator).not.toHaveBeenCalled();
      expect(ctx.createGain).not.toHaveBeenCalled();
      expect(ctx.createBiquadFilter).not.toHaveBeenCalled();
    });

    it('constructs zero audio nodes for the silent and none sentinels', async () => {
      const pad = await mount('<lcars-keypad sound="silent"></lcars-keypad>');
      press(pad, '1');
      // @ts-expect-error access private for testing
      const ctx = getAudioSynthesizer().getAudioContext() as unknown as MockAudioContext;
      ctx.createOscillator.mockClear();

      const changes = vi.fn();
      pad.addEventListener('lcars-change', changes);

      press(pad, '4');
      press(pad, 'ENTER');
      expect(pad.value).toBe('14');
      expect(changes).toHaveBeenCalledTimes(1);
      expect(ctx.createOscillator).not.toHaveBeenCalled();

      pad.sound = 'none';
      await pad.updateComplete;
      press(pad, '7');
      expect(pad.value).toBe('147');
      expect(ctx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('physical keyboard operability', () => {
    it('matches the on-screen keys for digits, Enter and Backspace', async () => {
      const pad = await mount();
      const changes: CustomEvent<LcarsChangeEventDetail>[] = [];
      const submits = vi.fn();
      pad.addEventListener('lcars-change', (e) =>
        changes.push(e as CustomEvent<LcarsChangeEventDetail>)
      );
      pad.addEventListener('lcars-submit', submits);

      type(pad, '4');
      type(pad, '7');
      expect(pad.value).toBe('47');
      expect(changes.map((e) => e.detail.key)).toEqual(['4', '7']);

      type(pad, 'Backspace');
      expect(pad.value).toBe('4');
      expect(changes.at(-1)?.detail).toEqual({ value: '4', key: 'DEL' });

      type(pad, 'Enter');
      expect(submits).toHaveBeenCalledTimes(1);
      expect((submits.mock.calls[0][0] as CustomEvent<{ value: string }>).detail.value).toBe('4');
    });

    it('ignores keys outside the keypad vocabulary', async () => {
      const pad = await mount();
      const changes = vi.fn();
      pad.addEventListener('lcars-change', changes);

      for (const key of ['a', 'F5', 'ArrowUp', '.', 'Tab', 'Shift']) {
        type(pad, key);
      }

      expect(pad.value).toBe('');
      expect(changes).not.toHaveBeenCalled();
    });

    it('ignores auto-repeat so a held key does not machine-gun the entry', async () => {
      const pad = await mount();
      const changes = vi.fn();
      const submits = vi.fn();
      pad.addEventListener('lcars-change', changes);
      pad.addEventListener('lcars-submit', submits);

      type(pad, '4');
      type(pad, '4', { repeat: true });
      type(pad, '4', { repeat: true });
      expect(pad.value).toBe('4');
      expect(changes).toHaveBeenCalledTimes(1);

      type(pad, 'Enter');
      type(pad, 'Enter', { repeat: true });
      expect(submits).toHaveBeenCalledTimes(1);

      changes.mockClear();
      type(pad, 'Backspace', { repeat: true });
      expect(pad.value).toBe('4');
      expect(changes).not.toHaveBeenCalled();
    });

    it('cancels a repeated Enter on a focused key so the browser cannot synthesize a click', async () => {
      // The keydown guard alone is not enough here: a focused <button> gets a
      // browser-synthesized click per auto-repeat, which reaches actuate()
      // directly. Cancelling the default action is what suppresses it, and it
      // is the only part observable without a real browser.
      const pad = await mount();
      const digitKey = pad.shadowRoot?.querySelector('.key') as HTMLButtonElement;
      expect(digitKey).toBeTruthy();

      const repeated = new KeyboardEvent('keydown', {
        key: 'Enter',
        repeat: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      digitKey.dispatchEvent(repeated);
      expect(repeated.defaultPrevented).toBe(true);

      // A first, non-repeated press must still reach native activation.
      const first = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      digitKey.dispatchEvent(first);
      expect(first.defaultPrevented).toBe(false);
    });

    it('leaves modified chords to the browser and the host application', async () => {
      const pad = await mount();
      const changes = vi.fn();
      const submits = vi.fn();
      pad.addEventListener('lcars-change', changes);
      pad.addEventListener('lcars-submit', submits);

      // Cmd+1 switches browser tabs, Ctrl+Backspace deletes a word: neither
      // may be swallowed, and neither may enter a digit.
      type(pad, '1', { metaKey: true });
      type(pad, '2', { ctrlKey: true });
      type(pad, '3', { altKey: true });
      type(pad, 'Backspace', { ctrlKey: true });
      expect(pad.value).toBe('');
      expect(changes).not.toHaveBeenCalled();

      press(pad, '4');
      type(pad, 'Enter', { metaKey: true });
      expect(submits).not.toHaveBeenCalled();

      const chord = new KeyboardEvent('keydown', {
        key: '1',
        metaKey: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      pad.dispatchEvent(chord);
      expect(chord.defaultPrevented).toBe(false);
    });

    it('activates a focused key once, not twice, on Enter', async () => {
      const pad = await mount();
      press(pad, '4');
      const submits = vi.fn();
      pad.addEventListener('lcars-submit', submits);

      // Native <button> activation: the browser turns keydown into a click and
      // the keydown still bubbles to the host.
      const enterKey = keyButton(pad, 'ENTER');
      enterKey.click();
      enterKey.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })
      );

      expect(submits).toHaveBeenCalledTimes(1);
    });
  });

  describe('styling contract', () => {
    it('resolves the key colour through --lcars-* tokens with no literal in the template', async () => {
      const pad = await mount('<lcars-keypad color="secondary"></lcars-keypad>');
      const grid = pad.shadowRoot?.querySelector('.keypad');
      expect(grid?.getAttribute('style')).toContain(
        '--keypad-key-color: var(--lcars-color-secondary);'
      );

      pad.color = 'primary';
      await pad.updateComplete;
      expect(pad.shadowRoot?.querySelector('.keypad')?.getAttribute('style')).toContain(
        '--keypad-key-color: var(--lcars-color-primary);'
      );
    });

    it('gives every key a visible focus-visible ring', () => {
      const css = LcarsKeypad.styles.toString();
      expect(css).toMatch(/\.key:focus-visible\s*\{[^}]*\boutline:/);
    });

    it('names the key grid for assistive technology', async () => {
      const pad = await mount('<lcars-keypad label="AUTHORIZATION CODE"></lcars-keypad>');
      const grid = pad.shadowRoot?.querySelector('.keypad');
      expect(grid?.getAttribute('role')).toBe('group');
      expect(grid?.getAttribute('aria-label')).toBe('AUTHORIZATION CODE');
      // WCAG 2.5.3: the accessible name must contain the visible label so
      // speech input can activate the key by what it shows.
      for (const [key, name] of [
        ['ENTER', 'ENTER (submit entry)'],
        ['DEL', 'DEL (delete last entry)'],
        ['CLR', 'CLR (clear entry)'],
      ]) {
        const button = keyButton(pad, key);
        expect(button.getAttribute('aria-label'), key).toBe(name);
        expect(button.getAttribute('aria-label'), key).toContain(button.textContent?.trim());
      }

      // A digit's own text is its name; a duplicate aria-label adds nothing.
      expect(keyButton(pad, '4').hasAttribute('aria-label')).toBe(false);
    });

    it('names the grid even when label is emptied', async () => {
      const pad = await mount('<lcars-keypad label=""></lcars-keypad>');
      expect(pad.shadowRoot?.querySelector('.keypad')?.getAttribute('aria-label')).toBe('KEYPAD');
    });

    it('raises the focus ring above sibling keys and honours reduced motion', () => {
      const css = LcarsKeypad.styles.toString();
      // The ring is wider than the default gap; without a stacking bump the
      // next key paints over it.
      expect(css).toMatch(/\.key\s*\{[^}]*\bposition:\s*relative/);
      expect(css).toMatch(/\.key:focus-visible\s*\{[^}]*\bz-index:/);
      expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    });
  });
});
