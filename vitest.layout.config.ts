/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { defineConfig } from 'vitest/config';

// The layout gate runs in its own config so `make test` stays fast and
// browser-free: it drives a real browser, so it needs the node environment
// rather than happy-dom, and generous timeouts for the first browser launch.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/layout.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
