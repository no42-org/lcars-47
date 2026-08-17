/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

import { defineConfig } from 'vite';

// App-mode build of the workbench for GitHub Pages. Deliberately separate from
// vite.config.ts: that one is lib-mode and guarded by verify-dist, this one
// treats index.html as the entry and must never touch dist/. The relative base
// keeps the built page servable from any subpath (project pages live under
// /lcars-47/), so nothing here needs editing on a repo rename or custom domain.
// Any resolve/define/css setting added to vite.config.ts that affects how the
// workbench is served must be mirrored here, or make dev and the published
// site silently diverge.
export default defineConfig({
  base: './',
  build: {
    outDir: 'site',
    emptyOutDir: true,
  },
});
