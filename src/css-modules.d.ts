/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

// TypeScript 7 type-checks side-effect imports of non-TS files and fails with
// TS2882 without a declaration. The `import './tokens/index.css'` in index.ts
// is load-bearing: it is what makes the design tokens travel with the JS entry
// (see the vite-plugin-lib-inject-css setup in vite.config.ts), so it cannot
// simply be dropped to satisfy the checker.
declare module '*.css' {
  const css: string;
  export default css;
}
