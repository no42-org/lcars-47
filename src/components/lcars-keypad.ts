/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { html, css, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LcarsElement } from './base';
import { playLcarsSound } from '../audio/index';
import type { LcarsSoundType } from '../audio/types';

export type LcarsKeypadKeyKind = 'digit' | 'delete' | 'clear' | 'submit';

interface LcarsKeypadKey {
  /** Character appended to the entry. Empty for command keys. */
  readonly char: string;
  readonly label: string;
  readonly kind: LcarsKeypadKeyKind;
  /**
   * Accessible name for command keys. WCAG 2.5.3 (Label in Name) requires the
   * visible label to be contained in it, so speech input can activate the key
   * by what it shows. Digit keys need no override: their text is the name.
   */
  readonly description?: string;
}

/** Key identifiers reported in `lcars-change` for the two command keys. */
const DELETE_KEY = 'DEL';
const CLEAR_KEY = 'CLR';

const digit = (char: string): LcarsKeypadKey => ({
  char,
  label: char,
  kind: 'digit',
});

/**
 * DOM order drives both the tab order and the CSS grid auto-placement:
 * three digit columns plus a command column, with ENTER spanning the last two
 * rows and 0 spanning the first three columns of the bottom row.
 */
const KEYPAD_LAYOUT: readonly LcarsKeypadKey[] = [
  digit('1'),
  digit('2'),
  digit('3'),
  { char: '', label: DELETE_KEY, kind: 'delete', description: `${DELETE_KEY} (delete last entry)` },
  digit('4'),
  digit('5'),
  digit('6'),
  { char: '', label: CLEAR_KEY, kind: 'clear', description: `${CLEAR_KEY} (clear entry)` },
  digit('7'),
  digit('8'),
  digit('9'),
  { char: '', label: 'ENTER', kind: 'submit', description: 'ENTER (submit entry)' },
  digit('0'),
];

export interface LcarsChangeEventDetail {
  /** The complete entry after the change. */
  value: string;
  /** What caused the change: a digit character, `'DEL'`, or `'CLR'`. */
  key: string;
}

export interface LcarsSubmitEventDetail {
  /** The entry at the moment of confirmation. */
  value: string;
}

/**
 * `<lcars-keypad>` renders an authentic LCARS key grid for numeric codes and
 * command sequences, emitting typed `lcars-change` and `lcars-submit` events
 * with per-keypress procedural audio (SPEC CAP-5).
 */
export class LcarsKeypad extends LcarsElement {
  // Keys are the focus targets, so the host delegates focus into the grid
  // rather than becoming a second, inert tab stop.
  static override shadowRootOptions: ShadowRootInit = {
    ...LcarsElement.shadowRootOptions,
    delegatesFocus: true,
  };

  static override styles = css`
    :host {
      display: inline-block;
      box-sizing: border-box;
    }

    :host([disabled]) {
      opacity: 0.45;
    }

    .keypad {
      display: grid;
      grid-template-columns: repeat(
        4,
        minmax(var(--lcars-keypad-key-min-width, var(--lcars-touch-target-min-height, 40px)), 1fr)
      );
      grid-auto-rows: minmax(
        var(--lcars-keypad-key-min-height, var(--lcars-touch-target-min-height, 40px)),
        auto
      );
      gap: var(--lcars-keypad-gap, var(--lcars-gap-sm, 4px));
      /* Reserves room for an edge key's focus ring, which is drawn outside the
         key and would otherwise be clipped by a scrolling ancestor. */
      padding: var(--lcars-keypad-focus-inset, 5px);
      box-sizing: border-box;
    }

    .key {
      display: flex;
      align-items: center;
      justify-content: center;
      /* Establishes the stacking context the focus ring is raised in. */
      position: relative;
      min-width: 0;
      padding: var(--lcars-gap-sm, 4px) var(--lcars-gap-md, 8px);
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-md, 1rem);
      font-weight: bold;
      letter-spacing: var(--lcars-letter-spacing-wide, 0.08em);
      text-transform: uppercase;
      color: var(--lcars-color-on-accent, #000000);
      background-color: var(--keypad-key-color, var(--lcars-color-primary));
      border: none;
      border-radius: var(--lcars-radius-sm, 6px);
      cursor: pointer;
      user-select: none;
      box-sizing: border-box;
      transition: filter 0.1s ease, transform 0.05s ease;
    }

    .key-delete,
    .key-clear {
      background-color: var(--lcars-keypad-command-color, var(--lcars-color-secondary));
      border-radius: var(--lcars-radius-pill, 14px);
    }

    .key-submit {
      background-color: var(--lcars-keypad-submit-color, var(--lcars-color-accent));
      border-radius: var(--lcars-radius-pill, 14px);
      grid-row: span 2;
    }

    .key-zero {
      grid-column: span 3;
    }

    .key:hover:not(:disabled) {
      filter: brightness(1.2);
    }

    .key:active:not(:disabled) {
      filter: brightness(1.4);
      transform: scale(0.98);
    }

    .key:disabled {
      cursor: default;
    }

    /* The ring sits outside the key, so it is drawn against the surface
       behind the grid rather than against the key colour itself. It is wider
       than the default grid gap, so the focused key is raised above its
       siblings or they would paint over it. */
    .key:focus-visible {
      outline: var(--lcars-border-width, 3px) solid
        var(--lcars-keypad-focus-color, var(--lcars-color-text, #ff9900));
      outline-offset: 2px;
      z-index: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .key {
        transition: none;
      }

      .key:active:not(:disabled) {
        transform: none;
      }
    }
  `;

  /** The accumulated entry. Coerced to a string and clamped to `maxlength`. */
  @property({ type: String })
  value = '';

  /**
   * Maximum entry length. Anything that is not a positive number -- omitted,
   * empty, zero, negative or non-numeric -- means unlimited. A keypad that
   * accepts nothing at all is never the intent, so `maxlength="0"` and
   * `maxlength=""` are read as "no limit" rather than "permanently inert".
   */
  @property({ type: Number, attribute: 'maxlength' })
  maxLength?: number;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: String })
  color = 'primary';

  /** Accessible name for the key grid. Falls back to `KEYPAD` when empty. */
  @property({ type: String })
  label = 'KEYPAD';

  /** Per-keypress sound. `silent` and `none` suppress all keypad audio. */
  @property({ type: String })
  sound: LcarsSoundType | (string & {}) = 'input';

  private restoreFocusOnDisable = false;

  constructor() {
    super();
    this.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Focus target of last resort. `tabindex="-1"` keeps the host out of the
    // tab order (the keys are the tab stops) while still letting
    // `delegatesFocus` land focus somewhere when every key is disabled.
    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '-1');
    }
  }

  /**
   * The entry as a string, whatever a host assigned to `value`. Reading
   * through this rather than `this.value` keeps a mistyped assignment from
   * throwing before `willUpdate` gets a chance to normalize it.
   */
  private get entry(): string {
    return typeof this.value === 'string' ? this.value : String(this.value ?? '');
  }

  /** Effective entry limit; `Infinity` unless a positive number was given. */
  private get entryLimit(): number {
    const limit = this.maxLength;
    return limit !== undefined && Number.isFinite(limit) && limit >= 1
      ? Math.floor(limit)
      : Number.POSITIVE_INFINITY;
  }

  override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    // `value` and `maxLength` are public and writable, so a host can hand us a
    // non-string, an over-long entry, or shrink the limit under an existing
    // entry. Normalize before anything reads the entry.
    if (changedProperties.has('value') || changedProperties.has('maxLength')) {
      const normalized = this.entry;
      const limit = this.entryLimit;
      this.value = normalized.length > limit ? normalized.slice(0, limit) : normalized;
    }

    // Must run before the render disables the keys: the browser drops focus to
    // <body> the instant the focused key becomes disabled, so afterwards there
    // is nothing left to detect and nothing left to blur cleanly.
    if (changedProperties.has('disabled') && this.disabled && this.hasKeyFocus()) {
      (this.shadowRoot?.activeElement as HTMLElement | null)?.blur?.();
      this.restoreFocusOnDisable = true;
    }
  }

  override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    // Disabling the focused key would strand a keyboard user at the top of the
    // document. Anchor focus on the host so the next Tab resumes from here.
    if (this.restoreFocusOnDisable) {
      this.restoreFocusOnDisable = false;
      this.focus();
    }
  }

  /** True when focus currently sits on one of this keypad's keys. */
  private hasKeyFocus(): boolean {
    const active = this.shadowRoot?.activeElement;
    return !!active && active.classList?.contains('key');
  }

  private playFeedback(sound: string): void {
    if (!this.sound || this.sound === 'none' || this.sound === 'silent') {
      return;
    }
    playLcarsSound(sound);
  }

  private emitChange(key: string): void {
    this.dispatchEvent(
      new CustomEvent<LcarsChangeEventDetail>('lcars-change', {
        bubbles: true,
        composed: true,
        detail: { value: this.entry, key },
      })
    );
  }

  private appendChar(char: string): void {
    if (this.disabled) {
      return;
    }

    if (this.entry.length >= this.entryLimit) {
      this.playFeedback('deny');
      return;
    }

    this.value = `${this.entry}${char}`;
    this.playFeedback(this.sound);
    this.emitChange(char);
  }

  private deleteLast(): void {
    // An empty entry is a strict no-op: no value change, no event, no sound.
    if (this.disabled || this.entry.length === 0) {
      return;
    }

    this.value = this.entry.slice(0, -1);
    this.playFeedback(this.sound);
    this.emitChange(DELETE_KEY);
  }

  private clearEntry(): void {
    if (this.disabled || this.entry.length === 0) {
      return;
    }

    this.value = '';
    this.playFeedback(this.sound);
    this.emitChange(CLEAR_KEY);
  }

  private submitEntry(): void {
    if (this.disabled) {
      return;
    }

    if (this.entry.length === 0) {
      this.playFeedback('deny');
      return;
    }

    this.playFeedback('acknowledge');
    this.dispatchEvent(
      new CustomEvent<LcarsSubmitEventDetail>('lcars-submit', {
        bubbles: true,
        composed: true,
        detail: { value: this.entry },
      })
    );
  }

  private actuate(key: LcarsKeypadKey): void {
    switch (key.kind) {
      case 'digit':
        this.appendChar(key.char);
        break;
      case 'delete':
        this.deleteLast();
        break;
      case 'clear':
        this.clearEntry();
        break;
      case 'submit':
        this.submitEntry();
        break;
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.disabled || event.defaultPrevented) {
      return;
    }

    // `event.repeat`: a held key must not machine-gun digits or fire a second
    // submit, matching <lcars-button>. Returning is not enough for a focused
    // key: the browser synthesizes a click per repeat for a focused <button>,
    // which would reach actuate() and bypass this guard entirely. Cancelling
    // the default action of the repeated keydown suppresses that click.
    if (event.repeat) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
      }
      return;
    }

    // Modified chords belong to the browser and the host application
    // (Cmd+1 switches tabs, Ctrl+Backspace deletes a word). Swallowing them
    // here would both break the shortcut and enter a digit.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    // Enter and Space on a focused key are the native <button> activation
    // path; re-handling them here would fire the action twice.
    const origin = event.composedPath()[0] as Element | undefined;
    if (origin && origin !== this && origin.classList?.contains('key')) {
      if (event.key === 'Enter' || event.key === ' ') {
        return;
      }
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.submitEntry();
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.deleteLast();
      return;
    }

    if (event.key.length === 1 && event.key >= '0' && event.key <= '9') {
      event.preventDefault();
      this.appendChar(event.key);
    }
  }

  override render(): TemplateResult {
    const keyColor = this.resolveColor(this.color, '--lcars-color-primary');

    return html`
      <div
        class="keypad"
        role="group"
        aria-label="${this.label || 'KEYPAD'}"
        aria-disabled="${this.disabled}"
        style="--keypad-key-color: ${keyColor};"
      >
        ${KEYPAD_LAYOUT.map(
          (key) => html`
            <button
              type="button"
              class="key key-${key.kind}${key.char === '0' ? ' key-zero' : ''}"
              data-key="${key.char || key.label}"
              aria-label="${key.description ?? nothing}"
              ?disabled="${this.disabled}"
              @click="${() => this.actuate(key)}"
            >
              ${key.label}
            </button>
          `
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-keypad': LcarsKeypad;
  }
}
