/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    // The layout gate needs a real browser and a real layout engine; it runs
    // from vitest.layout.config.ts so this suite stays fast and browser-free.
    exclude: ['**/node_modules/**', '**/dist/**', 'test/layout.test.ts'],
  },
});
