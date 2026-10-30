/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { html, css, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LcarsElement } from './base';
import { playLcarsSound } from '../audio/index';

export interface LcarsToggleEventDetail {
  pressed: boolean;
  label: string;
}

export interface LcarsRemoveEventDetail {
  label: string;
}

/**
 * `<lcars-chip>` renders a compact pressable value with an optional remove control.
 */
export class LcarsChip extends LcarsElement {
  static override shadowRootOptions: ShadowRootInit = {
    ...LcarsElement.shadowRootOptions,
    delegatesFocus: true,
  };

  static override styles = css`
    :host {
      display: inline-flex;
      box-sizing: border-box;
      user-select: none;
    }

    :host([hidden]) {
      display: none;
    }

    :host([disabled]) {
      pointer-events: none;
      opacity: 0.45;
    }

    .chip {
      display: inline-flex;
      align-items: stretch;
      border: var(--lcars-border-width-sm, 1.5px) solid var(--chip-color);
      border-radius: var(--lcars-radius-pill, 14px);
      color: var(--chip-color);
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-xs, 0.75rem);
      font-weight: bold;
      letter-spacing: var(--lcars-letter-spacing-wide, 0.08em);
      text-transform: uppercase;
      box-sizing: border-box;
      transition: filter 0.1s ease, transform 0.05s ease;
    }

    .chip.pressed {
      background-color: var(--chip-color);
      color: var(--lcars-color-on-accent, #000000);
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      /* Below the button's touch target so a chip fits a table row, but still
         a usable pointer target for the remove control. */
      min-height: 24px;
      margin: 0;
      border: none;
      border-radius: var(--lcars-radius-pill, 14px);
      background: none;
      color: inherit;
      font: inherit;
      letter-spacing: inherit;
      text-transform: inherit;
      cursor: pointer;
    }

    button:focus-visible,
    .chip:focus-visible {
      /* Inset and in the text colour: an outset ring would cross the sibling
         control, and on a pressed primary chip it would match the fill. */
      outline: 2px solid currentColor;
      outline-offset: -4px;
    }

    .chip-toggle {
      flex: 1;
      padding: 0 var(--lcars-gap-md, 8px);
      white-space: nowrap;
    }

    .chip-remove {
      flex: none;
      width: 24px;
      padding: 0;
    }

    /* Drawn from the box, so it stays centred whatever the font's metrics. */
    .chip-cross {
      position: relative;
      display: block;
      width: 10px;
      height: 10px;
    }

    .chip-cross::before,
    .chip-cross::after {
      content: '';
      position: absolute;
      top: calc(50% - 1px);
      left: 0;
      width: 100%;
      height: 2px;
      background-color: currentColor;
      transform: rotate(45deg);
    }

    .chip-cross::after {
      transform: rotate(-45deg);
    }

    /* Tactile Interaction States */
    :host(:hover:not([disabled])) .chip {
      filter: brightness(var(--lcars-hover-brightness, 1.2));
    }

    :host(:active:not([disabled])) .chip {
      filter: brightness(var(--lcars-active-brightness, 1.4));
      transform: scale(var(--lcars-active-scale, 0.98));
    }

    /* The pressed fill and the cross are backgrounds, which forced colours
       remove, so choose system colours here instead of adapting. */
    @media (forced-colors: active) {
      .chip {
        forced-color-adjust: none;
        border-color: ButtonText;
        background-color: ButtonFace;
        color: ButtonText;
      }

      .chip.pressed {
        background-color: Highlight;
        color: HighlightText;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .chip {
        transition: none;
      }

      :host(:active:not([disabled])) .chip {
        transform: none;
      }
    }
  `;

  @property({ type: Boolean, reflect: true })
  pressed = false;

  @property({ type: Boolean, reflect: true })
  removable = false;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: String })
  color = 'primary';

  @property({ type: String })
  label = '';

  @property({ type: String, attribute: 'remove-label' })
  removeLabel = '';

  @property({ type: String })
  sound = 'none';

  private restoreFocus = false;

  /** Forwarded so that scripts activate the chip like a pointer does. */
  override click(): void {
    if (this.disabled) {
      return;
    }
    // The rendered button lags the properties: it may not exist yet, or still
    // carry a `disabled` attribute that was just cleared.
    this.performUpdate();
    this.shadowRoot?.querySelector<HTMLButtonElement>('.chip-toggle')?.click();
  }

  override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    // Must run before the render: the element holding focus is about to stop
    // being focusable, and engines disagree on what happens to focus then.
    if (changedProperties.has('disabled') && changedProperties.get('disabled') !== this.disabled) {
      const active = this.shadowRoot?.activeElement as HTMLElement | null | undefined;
      if (active) {
        active.blur();
        this.restoreFocus = true;
      }
    }
  }

  override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    // Disabling the focused control would strand a keyboard user at the top of
    // the document. Delegation lands on the chip surface while disabled and on
    // the toggle once enabled. Without that surface focus() would do nothing:
    // no engine lets a delegatesFocus host take focus itself, tabindex or not.
    if (this.restoreFocus) {
      this.restoreFocus = false;
      this.focus({ preventScroll: true });
    }
  }

  private get displayLabel(): string {
    return (this.textContent ?? '').trim() || this.label;
  }

  private playSound(): void {
    if (this.sound && this.sound !== 'none' && this.sound !== 'silent') {
      playLcarsSound(this.sound);
    }
  }

  // A native button repeats Enter while the key is held.
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.repeat) {
      event.preventDefault();
    }
  }

  private handleToggle(): void {
    this.pressed = !this.pressed;
    this.playSound();
    this.dispatchEvent(
      new CustomEvent<LcarsToggleEventDetail>('lcars-toggle', {
        bubbles: true,
        composed: true,
        detail: { pressed: this.pressed, label: this.displayLabel },
      })
    );
  }

  private handleRemove(): void {
    this.playSound();
    this.dispatchEvent(
      new CustomEvent<LcarsRemoveEventDetail>('lcars-remove', {
        bubbles: true,
        composed: true,
        detail: { label: this.displayLabel },
      })
    );
  }

  override render(): TemplateResult {
    const chipColor = this.resolveColor(this.color, '--lcars-color-primary');

    return html`
      <span
        class="chip ${this.pressed ? 'pressed' : ''}"
        style="--chip-color: ${chipColor};"
        tabindex="${this.disabled ? '-1' : nothing}"
        role="${this.disabled ? 'group' : nothing}"
        aria-labelledby="${this.disabled ? 'toggle' : nothing}"
        aria-disabled="${this.disabled ? 'true' : nothing}"
      >
        <button
          id="toggle"
          class="chip-toggle"
          type="button"
          aria-pressed="${this.pressed}"
          ?disabled=${this.disabled}
          @click=${this.handleToggle}
          @keydown=${this.handleKeyDown}
        >
          <slot>${this.label}</slot>
        </button>
        ${this.removable
          ? html`<button
              id="remove"
              class="chip-remove"
              type="button"
              aria-label="${this.removeLabel || 'Remove'}"
              aria-labelledby="${this.removeLabel ? nothing : 'remove toggle'}"
              ?disabled=${this.disabled}
              @click=${this.handleRemove}
              @keydown=${this.handleKeyDown}
            >
              <span class="chip-cross" aria-hidden="true"></span>
            </button>`
          : nothing}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-chip': LcarsChip;
  }
}
