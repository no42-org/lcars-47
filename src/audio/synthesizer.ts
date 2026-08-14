/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import type { LcarsSoundType, LcarsAudioOptions, LcarsSoundHandle } from './types';

/**
 * Zero-asset Web Audio API synthesizer for authentic LCARS interface sounds.
 */
export class LcarsAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.5;
  private muted = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtxClass =
        window.AudioContext ||
        // @ts-expect-error webkitAudioContext fallback
        window.webkitAudioContext;

      if (!AudioCtxClass) {
        return null;
      }

      try {
        this.ctx = new AudioCtxClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public setVolume(level: number): void {
    if (!Number.isFinite(level)) {
      return;
    }
    this.volume = Math.max(0, Math.min(1, level));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public mute(): void {
    this.muted = true;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    }
  }

  public unmute(): void {
    this.muted = false;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.01);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public async resume(): Promise<void> {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }
  }

  public async close(): Promise<void> {
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        await this.ctx.close();
      } catch {}
      this.ctx = null;
      this.masterGain = null;
    }
  }

  public play(sound: LcarsSoundType | string = 'chirp', options: LcarsAudioOptions = {}): LcarsSoundHandle {
    const noopHandle: LcarsSoundHandle = { stop: () => {} };

    if (this.muted || sound === 'none' || sound === '') {
      return noopHandle;
    }

    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) {
      return noopHandle;
    }

    const now = ctx.currentTime;
    const soundVolume =
      options.volume !== undefined && Number.isFinite(options.volume)
        ? Math.max(0, Math.min(1, options.volume))
        : 1.0;

    switch (sound) {
      case 'chirp':
        return this.synthesizeChirp(ctx, now, soundVolume, options);
      case 'acknowledge':
        return this.synthesizeAcknowledge(ctx, now, soundVolume, options);
      case 'warning':
        return this.synthesizeWarning(ctx, now, soundVolume, options);
      case 'alert':
        return this.synthesizeAlert(ctx, now, soundVolume, options);
      case 'input':
        return this.synthesizeInput(ctx, now, soundVolume, options);
      case 'deny':
        return this.synthesizeDeny(ctx, now, soundVolume, options);
      case 'beep':
        return this.synthesizeBeep(ctx, now, soundVolume, options);
      case 'warp':
        return this.synthesizeWarp(ctx, now, soundVolume, options);
      default:
        return this.synthesizeChirp(ctx, now, soundVolume, options);
    }
  }

  /**
   * Standard LCARS UI Chirp (Descending sweep 880Hz -> 440Hz in ~55ms)
   */
  private synthesizeChirp(
    ctx: AudioContext,
    now: number,
    vol: number,
    options: LcarsAudioOptions
  ): LcarsSoundHandle {
    const duration = Math.max(0.005, options.duration ?? 0.055);
    const startFreq = Math.max(10, options.frequency ?? 880);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq / 2, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + duration);

    return {
      stop: () => {
        try {
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.005);
          osc.stop(ctx.currentTime + 0.005);
        } catch {}
      },
    };
  }

  /**
   * Ascending Acknowledge Chime (587Hz -> 880Hz dual tone)
   */
  private synthesizeAcknowledge(
    ctx: AudioContext,
    now: number,
    vol: number,
    options: LcarsAudioOptions
  ): LcarsSoundHandle {
    const duration = Math.max(0.02, options.duration ?? 0.16);
    const baseFreq = Math.max(10, options.frequency ?? 587.33);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    const t1 = duration * 0.38;

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, now); // D5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq * 1.5, now + t1); // A5

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol * 0.8, now + 0.004);
    gain.gain.setValueAtTime(vol * 0.8, now + t1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain!);

    osc1.onended = () => osc1.disconnect();
    osc2.onended = () => {
      osc2.disconnect();
      gain.disconnect();
    };

    osc1.start(now);
    osc1.stop(now + t1);
    osc2.start(now + t1);
    osc2.stop(now + duration);

    return {
      stop: () => {
        try {
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.005);
          osc1.stop(ctx.currentTime + 0.005);
          osc2.stop(ctx.currentTime + 0.005);
        } catch {}
      },
    };
  }

  /**
   * Warning Staccato Pulse (Dual 330Hz / 440Hz pulse)
   */
  private synthesizeWarning(
    ctx: AudioContext,
    now: number,
    vol: number,
    options: LcarsAudioOptions
  ): LcarsSoundHandle {
    const duration = Math.max(0.02, options.duration ?? 0.14);
    const baseFreq = Math.max(10, options.frequency ?? 330);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.setValueAtTime(baseFreq * 1.33, now + duration * 0.5);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.003);
    gain.gain.setValueAtTime(vol, now + duration * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + duration);

    return {
      stop: () => {
        try {
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.005);
          osc.stop(ctx.currentTime + 0.005);
        } catch {}
      },
    };
  }

  /**
   * Red Alert Siren Sweep (Rising 400Hz -> 800Hz sawtooth/sine)
   */
  private synthesizeAlert(
    ctx: AudioContext,
    now: number,
    vol: number,
    options: LcarsAudioOptions
  ): LcarsSoundHandle {
    const duration = Math.max(0.05, options.duration ?? 0.45);
    const baseFreq = Math.max(10, options.frequency ?? 400);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + duration * 0.8);
    osc.frequency.linearRampToValueAtTime(baseFreq, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol * 0.7, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + duration);

    return {
      stop: () => {
        try {
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.005);
          osc.stop(ctx.currentTime + 0.005);
        } catch {}
      },
    };
  }

  /**
   * Short Tactile Input Tick (1400Hz 25ms pulse)
   */
  private synthesizeInput(
    ctx: AudioContext,
    now: number,
    vol: number,
    options: LcarsAudioOptions
  ): LcarsSoundHandle {
    const duration = Math.max(0.005, options.duration ?? 0.025);
    const startFreq = Math.max(10, options.frequency ?? 1400);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.65, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol * 0.9, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + duration);

    return {
      stop: () => {
        try {
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.005);
          osc.stop(ctx.currentTime + 0.005);
        } catch {}
      },
    };
  }

  /**
   * Deny / Error Discordant Tone (Descending dissonant buzz)
   */
  private synthesizeDeny(
    ctx: AudioContext,
    now: number,
    vol: number,
    options: LcarsAudioOptions
  ): LcarsSoundHandle {
    const duration = Math.max(0.02, options.duration ?? 0.12);
    const baseFreq = Math.max(10, options.frequency ?? 200);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.linearRampToValueAtTime(baseFreq * 0.6, now + duration);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(baseFreq * 0.925, now);
    osc2.frequency.linearRampToValueAtTime(baseFreq * 0.55, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol * 0.6, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain!);

    osc1.onended = () => osc1.disconnect();
    osc2.onended = () => {
      osc2.disconnect();
      gain.disconnect();
    };

    osc1.start(now);
    osc1.stop(now + duration);
    osc2.start(now + duration);
    osc2.stop(now + duration);

    return {
      stop: () => {
        try {
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.005);
          osc1.stop(ctx.currentTime + 0.005);
          osc2.stop(ctx.currentTime + 0.005);
        } catch {}
      },
    };
  }

  /**
   * Clean Monotone Beep (800Hz)
   */
  private synthesizeBeep(
    ctx: AudioContext,
    now: number,
    vol: number,
    options: LcarsAudioOptions
  ): LcarsSoundHandle {
    const duration = Math.max(0.005, options.duration ?? 0.08);
    const freq = Math.max(10, options.frequency ?? 800);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + duration);

    return {
      stop: () => {
        try {
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.005);
          osc.stop(ctx.currentTime + 0.005);
        } catch {}
      },
    };
  }

  /**
   * Resonant Warp Engine Sub-Bass Sweep (70Hz -> 140Hz)
   */
  private synthesizeWarp(
    ctx: AudioContext,
    now: number,
    vol: number,
    options: LcarsAudioOptions
  ): LcarsSoundHandle {
    const duration = Math.max(0.05, options.duration ?? 0.6);
    const baseFreq = Math.max(10, options.frequency ?? 70);

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(baseFreq * 3.5, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol * 0.8, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + duration);

    return {
      stop: () => {
        try {
          gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.005);
          osc.stop(ctx.currentTime + 0.005);
        } catch {}
      },
    };
  }
}
