/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import '../src/index';
import * as audioModule from '../src/audio/index';
import {
  LcarsAudioSynthesizer,
  playLcarsSound,
  setAudioVolume,
  getAudioVolume,
  muteAudio,
  unmuteAudio,
  isAudioMuted,
  resumeAudio,
  closeAudio,
  getAudioSynthesizer,
} from '../src/audio/index';
import { LcarsButton } from '../src/components/lcars-button';

// Mock Web Audio API
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

describe('LCARS Procedural Audio Subsystem', () => {
  let synth: LcarsAudioSynthesizer;
  const originalAudioContext = window.AudioContext;

  beforeEach(() => {
    // @ts-expect-error Mocking window.AudioContext
    window.AudioContext = MockAudioContext;
    synth = new LcarsAudioSynthesizer();
    unmuteAudio();
    setAudioVolume(0.5);
  });

  afterEach(async () => {
    await closeAudio();
    window.AudioContext = originalAudioContext;
  });

  it('initializes with default volume and unmuted state', () => {
    expect(synth.getVolume()).toBe(0.5);
    expect(synth.isMuted()).toBe(false);
  });

  it('sets and clamps volume level between 0.0 and 1.0, ignoring NaN', () => {
    synth.setVolume(0.8);
    expect(synth.getVolume()).toBe(0.8);

    synth.setVolume(-0.5);
    expect(synth.getVolume()).toBe(0);

    synth.setVolume(1.5);
    expect(synth.getVolume()).toBe(1);

    synth.setVolume(Number.NaN);
    expect(synth.getVolume()).toBe(1);
  });

  it('manages mute and unmute toggles', () => {
    synth.mute();
    expect(synth.isMuted()).toBe(true);

    synth.unmute();
    expect(synth.isMuted()).toBe(false);
  });

  it('synthesizes all standard sound presets with custom options', () => {
    const presets = ['chirp', 'acknowledge', 'warning', 'alert', 'input', 'deny', 'beep', 'warp'] as const;

    for (const preset of presets) {
      const handle = synth.play(preset, { duration: 0.1, frequency: 600, volume: 0.8 });
      expect(handle).toBeDefined();
      expect(typeof handle.stop).toBe('function');
      expect(() => handle.stop()).not.toThrow();
    }
  });

  it('handles negative or zero duration/frequency without crashing', () => {
    const handle = synth.play('chirp', { duration: -1, frequency: -100 });
    expect(handle).toBeDefined();
    expect(() => handle.stop()).not.toThrow();
  });

  it('returns noop handle when sound is muted or disabled', () => {
    synth.mute();
    const handle = synth.play('chirp');
    expect(handle).toBeDefined();
    expect(() => handle.stop()).not.toThrow();

    synth.unmute();
    const noneHandle = synth.play('none');
    expect(() => noneHandle.stop()).not.toThrow();
  });

  it('constructs zero audio nodes when muted and for silent/none sentinels', () => {
    synth.play('chirp');
    // @ts-expect-error access private for testing
    const ctx = synth.getAudioContext() as unknown as MockAudioContext;
    ctx.createOscillator.mockClear();

    synth.mute();
    synth.play('chirp');
    expect(ctx.createOscillator).not.toHaveBeenCalled();

    synth.unmute();
    synth.play('silent');
    synth.play('none');
    expect(ctx.createOscillator).not.toHaveBeenCalled();

    // Unknown names fall back to the default chirp
    synth.play('blorp');
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('schedules distinct, correctly-timed graphs per preset', () => {
    // @ts-expect-error access private for testing
    const ctx = synth.getAudioContext() as unknown as MockAudioContext;

    ctx.createOscillator.mockClear();
    synth.play('deny');
    const denyOscs = ctx.createOscillator.mock.results.map(
      (r) => r.value as MockOscillatorNode
    );
    expect(denyOscs).toHaveLength(2);
    for (const osc of denyOscs) {
      expect(osc.start).toHaveBeenCalledWith(0);
    }

    ctx.createBiquadFilter.mockClear();
    synth.play('warp');
    expect(ctx.createBiquadFilter).toHaveBeenCalledTimes(1);

    ctx.createOscillator.mockClear();
    synth.play('beep');
    const beepOsc = ctx.createOscillator.mock.results[0].value as MockOscillatorNode;
    expect(beepOsc.frequency.setValueAtTime).toHaveBeenCalledWith(800, 0);
  });

  it('ramps the master gain on volume and mute changes', () => {
    synth.play('chirp');
    // @ts-expect-error access private for testing
    const ctx = synth.getAudioContext() as unknown as MockAudioContext;
    const masterGain = ctx.createGain.mock.results[0].value as MockGainNode;

    masterGain.gain.setTargetAtTime.mockClear();
    synth.setVolume(0.3);
    expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.3, 0, 0.01);

    synth.mute();
    expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.01);

    synth.unmute();
    expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.3, 0, 0.01);
  });

  it('sanitizes NaN and Infinity duration/frequency options', () => {
    // @ts-expect-error access private for testing
    const ctx = synth.getAudioContext() as unknown as MockAudioContext;
    ctx.createOscillator.mockClear();

    const handle = synth.play('chirp', {
      duration: Number.NaN,
      frequency: Number.POSITIVE_INFINITY,
    });
    expect(handle).toBeDefined();

    const osc = ctx.createOscillator.mock.results[0].value as MockOscillatorNode;
    expect(osc.stop).toHaveBeenCalledWith(0.055);
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(880, 0);
  });

  it('exposes the LcarsAudio control surface per CAP-3', () => {
    audioModule.LcarsAudio.setVolume(0.4);
    expect(audioModule.LcarsAudio.getVolume()).toBe(0.4);

    audioModule.LcarsAudio.mute();
    expect(audioModule.LcarsAudio.isMuted()).toBe(true);

    audioModule.LcarsAudio.unmute();
    expect(audioModule.LcarsAudio.isMuted()).toBe(false);
  });

  it('resumes suspended AudioContext via resumeAudio', async () => {
    const globalSynth = getAudioSynthesizer();
    // @ts-expect-error access private for testing
    const ctx = globalSynth.getAudioContext() as unknown as MockAudioContext;
    ctx.state = 'suspended';

    await resumeAudio();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('closes AudioContext and cleans up resources', async () => {
    const globalSynth = getAudioSynthesizer();
    // @ts-expect-error access private for testing
    const ctx = globalSynth.getAudioContext() as unknown as MockAudioContext;

    await closeAudio();
    expect(ctx.close).toHaveBeenCalled();
  });

  it('plays sounds via global helper functions', () => {
    setAudioVolume(0.7);
    expect(getAudioVolume()).toBe(0.7);

    muteAudio();
    expect(isAudioMuted()).toBe(true);

    unmuteAudio();
    expect(isAudioMuted()).toBe(false);

    const handle = playLcarsSound('acknowledge', { volume: 0.9 });
    expect(handle).toBeDefined();
  });

  it('safely handles missing AudioContext in SSR or headless environments', () => {
    // @ts-expect-error simulating environment without Web Audio API
    delete window.AudioContext;
    const ssrSynth = new LcarsAudioSynthesizer();
    expect(() => ssrSynth.play('chirp')).not.toThrow();
  });

  it('integrates with <lcars-button> to trigger audio on click', async () => {
    const playSpy = vi.spyOn(getAudioSynthesizer(), 'play');

    const button = document.createElement('lcars-button') as LcarsButton;
    button.sound = 'acknowledge';
    document.body.appendChild(button);
    await button.updateComplete;

    // Click button
    button.click();

    expect(playSpy).toHaveBeenCalledWith('acknowledge', undefined);

    // Disabled button should not play sound
    playSpy.mockClear();
    button.disabled = true;
    await button.updateComplete;

    button.click();
    expect(playSpy).not.toHaveBeenCalled();

    // Button with sound="none" should not play sound
    playSpy.mockClear();
    button.disabled = false;
    button.sound = 'none';
    await button.updateComplete;

    button.click();
    expect(playSpy).not.toHaveBeenCalled();

    // Button with sound="silent" must be honored (CAP-3 / AD-3)
    playSpy.mockClear();
    button.sound = 'silent';
    await button.updateComplete;

    button.click();
    expect(playSpy).not.toHaveBeenCalled();
  });
});
