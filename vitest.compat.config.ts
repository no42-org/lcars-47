/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { defineConfig } from 'vitest/config';

// The cross-engine tier runs in its own config for the same reason the layout
// gate does: it drives real browsers, so it needs the node environment and
// generous timeouts — three engines launch here, not one.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/compat.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
