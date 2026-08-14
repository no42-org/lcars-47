/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

// Two-pass build: the ES bundle externalizes lit so consumers dedupe it via
// their own dependency graph; the IIFE pass (`--mode iife`) bundles lit for
// zero-build CDN usage.
export default defineConfig(({ mode }) => {
  const iife = mode === 'iife';

  return {
    plugins: [
      libInjectCss(),
      ...(iife
        ? []
        : [
            dts({
              rollupTypes: true,
              include: ['src/**/*.ts'],
            }),
          ]),
    ],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'Lcars',
        formats: [iife ? ('iife' as const) : ('es' as const)],
        fileName: () => (iife ? 'lcars.iife.js' : 'index.js'),
      },
      rollupOptions: {
        external: iife ? [] : [/^lit(\/|$)/, /^@lit(\/|-)/],
        output: {
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.css')) {
              return 'lcars.css';
            }
            return assetInfo.name ?? 'assets/[name][extname]';
          },
        },
      },
      sourcemap: true,
      emptyOutDir: !iife,
    },
  };
});
