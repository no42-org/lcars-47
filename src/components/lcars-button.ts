/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { html, css, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LcarsElement } from './base';
import { playLcarsSound } from '../audio/index';

export type LcarsButtonShape = 'pill' | 'pill-start' | 'pill-end' | 'rect' | 'bracket';

const BUTTON_SHAPES: readonly LcarsButtonShape[] = ['pill', 'pill-start', 'pill-end', 'rect', 'bracket'];

export interface LcarsClickEventDetail {
  color: string;
  shape: LcarsButtonShape;
  sound: string;
}

/**
 * `<lcars-button>` renders an authentic tactile LCARS button with shape variants.
 */
export class LcarsButton extends LcarsElement {
  static override styles = css`
    :host {
      display: inline-block;
      box-sizing: border-box;
      outline: none;
    }

    :host([disabled]) {
      pointer-events: none;
      opacity: 0.45;
    }

    .button-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: var(--lcars-touch-target-min-width, 80px);
      min-height: var(--lcars-touch-target-min-height, 40px);
      padding: var(--lcars-gap-sm, 4px) var(--lcars-gap-md, 8px);
      font-family: var(--lcars-font-family, 'Antonio', sans-serif);
      font-size: var(--lcars-font-size-md, 1rem);
      font-weight: bold;
      letter-spacing: var(--lcars-letter-spacing-wide, 0.08em);
      text-transform: uppercase;
      color: var(--lcars-color-on-accent, #000000);
      cursor: pointer;
      user-select: none;
      box-sizing: border-box;
      transition: filter 0.1s ease, transform 0.05s ease, opacity 0.1s ease;
    }

    /* Shapes */
    .shape-pill {
      border-radius: var(--lcars-radius-pill, 14px);
    }

    .shape-pill-start {
      border-top-left-radius: var(--lcars-radius-pill, 14px);
      border-bottom-left-radius: var(--lcars-radius-pill, 14px);
      border-top-right-radius: var(--lcars-radius-none, 0px);
      border-bottom-right-radius: var(--lcars-radius-none, 0px);
    }

    .shape-pill-end {
      border-top-right-radius: var(--lcars-radius-pill, 14px);
      border-bottom-right-radius: var(--lcars-radius-pill, 14px);
      border-top-left-radius: var(--lcars-radius-none, 0px);
      border-bottom-left-radius: var(--lcars-radius-none, 0px);
    }

    .shape-rect {
      border-radius: var(--lcars-radius-none, 0px);
    }

    .shape-bracket {
      border-radius: var(--lcars-radius-sm, 6px);
      border: var(--lcars-border-width, 3px) solid currentColor;
    }

    /* Tactile Interaction States */
    :host(:hover:not([disabled])) .button-inner {
      filter: brightness(1.2);
    }

    :host(:active:not([disabled])) .button-inner,
    .button-inner.active {
      filter: brightness(1.4);
      transform: scale(0.98);
    }

    :host(:focus-visible) {
      outline: var(--lcars-border-width, 3px) solid var(--lcars-color-primary, #ff9900);
      outline-offset: 2px;
    }

    :host([shape='pill']:focus-visible) {
      border-radius: var(--lcars-radius-pill, 14px);
    }

    :host([shape='pill-start']:focus-visible) {
      border-top-left-radius: var(--lcars-radius-pill, 14px);
      border-bottom-left-radius: var(--lcars-radius-pill, 14px);
    }

    :host([shape='pill-end']:focus-visible) {
      border-top-right-radius: var(--lcars-radius-pill, 14px);
      border-bottom-right-radius: var(--lcars-radius-pill, 14px);
    }

    :host([shape='rect']:focus-visible) {
      border-radius: var(--lcars-radius-none, 0px);
    }

    :host([shape='bracket']:focus-visible) {
      border-radius: var(--lcars-radius-sm, 6px);
    }
  `;

  @property({ type: String, reflect: true })
  shape: LcarsButtonShape = 'pill';

  @property({ type: String })
  color = 'primary';

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, reflect: true })
  active = false;

  @property({ type: String })
  sound = 'chirp';

  private authorTabIndex: string | null = null;

  private spaceArmed = false;

  constructor() {
    super();
    this.addEventListener('click', this.handleClick.bind(this));
    this.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.addEventListener('keyup', this.handleKeyUp.bind(this));
    this.addEventListener('blur', () => {
      this.spaceArmed = false;
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'button');
    }
    // Capture only on the first connect; on reconnects the attribute holds
    // the component-managed value, not the author's.
    if (!this.hasUpdated && this.hasAttribute('tabindex')) {
      this.authorTabIndex = this.getAttribute('tabindex');
    }
    this.updateTabIndex();
  }

  override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    if (changedProperties.has('disabled')) {
      this.setAttribute('aria-disabled', String(this.disabled));
      this.updateTabIndex();
    }
    if (changedProperties.has('active') && (this.active || this.hasAttribute('aria-pressed'))) {
      this.setAttribute('aria-pressed', String(this.active));
    }
  }

  private get safeShape(): LcarsButtonShape {
    return BUTTON_SHAPES.includes(this.shape) ? this.shape : 'pill';
  }

  private updateTabIndex(): void {
    if (this.disabled) {
      this.tabIndex = -1;
    } else {
      this.setAttribute('tabindex', this.authorTabIndex ?? '0');
    }
  }

  private handleClick(event: Event): void {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (this.sound && this.sound !== 'none' && this.sound !== 'silent') {
      playLcarsSound(this.sound);
    }

    this.dispatchEvent(
      new CustomEvent<LcarsClickEventDetail>('lcars-click', {
        bubbles: true,
        composed: true,
        detail: {
          color: this.color,
          shape: this.safeShape,
          sound: this.sound,
        },
      })
    );
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.disabled || event.repeat) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.click();
    } else if (event.key === ' ') {
      // Native buttons activate Space on keyup; suppress scrolling here only.
      event.preventDefault();
      this.spaceArmed = true;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.key !== ' ') {
      return;
    }
    const armed = this.spaceArmed;
    this.spaceArmed = false;
    if (this.disabled || !armed) {
      return;
    }
    event.preventDefault();
    this.click();
  }

  override render(): TemplateResult {
    const bgColor = this.resolveColor(this.color, '--lcars-color-primary');
    const shapeClass = `shape-${this.safeShape}`;
    const activeClass = this.active ? 'active' : '';

    const isBracket = this.safeShape === 'bracket';
    const styleString = isBracket ? `color: ${bgColor};` : `background-color: ${bgColor};`;

    return html`
      <div class="button-inner ${shapeClass} ${activeClass}" style="${styleString}">
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lcars-button': LcarsButton;
  }
}
