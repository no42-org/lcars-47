/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { LcarsAudioSynthesizer } from './synthesizer';
import type { LcarsSoundType, LcarsAudioOptions, LcarsSoundHandle } from './types';

export * from './types';
export { LcarsAudioSynthesizer } from './synthesizer';

let globalSynthesizer: LcarsAudioSynthesizer | null = null;

/**
 * Retrieve or lazily initialize the singleton LCARS audio synthesizer.
 */
export function getAudioSynthesizer(): LcarsAudioSynthesizer {
  if (!globalSynthesizer) {
    globalSynthesizer = new LcarsAudioSynthesizer();
  }
  return globalSynthesizer;
}

/**
 * Play a procedural LCARS interface sound effect.
 */
export function playLcarsSound(
  sound: LcarsSoundType | string = 'chirp',
  options?: LcarsAudioOptions
): LcarsSoundHandle {
  return getAudioSynthesizer().play(sound, options);
}

/**
 * Set the master volume for LCARS sound effects (0.0 to 1.0).
 */
export function setAudioVolume(level: number): void {
  getAudioSynthesizer().setVolume(level);
}

/**
 * Get the current master volume level.
 */
export function getAudioVolume(): number {
  return getAudioSynthesizer().getVolume();
}

/**
 * Mute all LCARS sound effects.
 */
export function muteAudio(): void {
  getAudioSynthesizer().mute();
}

/**
 * Unmute LCARS sound effects.
 */
export function unmuteAudio(): void {
  getAudioSynthesizer().unmute();
}

/**
 * Check if LCARS audio is currently muted.
 */
export function isAudioMuted(): boolean {
  return getAudioSynthesizer().isMuted();
}

/**
 * Resume suspended AudioContext on user interaction.
 */
export async function resumeAudio(): Promise<void> {
  await getAudioSynthesizer().resume();
}

/**
 * Close and release underlying Web Audio hardware resources.
 */
export async function closeAudio(): Promise<void> {
  if (globalSynthesizer) {
    await globalSynthesizer.close();
    globalSynthesizer = null;
  }
}
