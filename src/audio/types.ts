/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

export type LcarsSoundType =
  | 'chirp'
  | 'acknowledge'
  | 'warning'
  | 'alert'
  | 'input'
  | 'deny'
  | 'beep'
  | 'warp'
  | 'silent'
  | 'none';

export interface LcarsAudioOptions {
  volume?: number;
  duration?: number;
  frequency?: number;
}

export interface LcarsSoundHandle {
  stop: () => void;
}
