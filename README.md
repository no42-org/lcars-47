# @riptide-labs/lcars

Authentic Star Trek LCARS (Library Computer Access / Retrieval System) user interface component library built with Lit Web Components, pure CSS design tokens, and a zero-asset Web Audio API procedural synthesizer.

## Features

- **Web Components**: Built on pure Lit Web Components (`Custom Elements v1` + `Shadow DOM`).
- **Zero-Asset Procedural Audio**: Mathematical waveform synthesis for classic interface sound effects with zero `.mp3` or `.wav` dependencies.
- **Era Color Palettes**: Switch instantly between `TNG` (The Next Generation), `DS9` (Deep Space Nine), `Nemesis` (Late 24th Century), and `High-Contrast` accessibility themes.
- **Geometric Primitives**: Authentic SVG curved elbows (`<lcars-elbow>`), responsive 2D grid layouts (`<lcars-frame>`), tactile pill buttons (`<lcars-button>`), and framed panels (`<lcars-panel>`).
- **Telemetry & Data Displays**: High-precision tabular readouts (`<lcars-readout>`), segmented/continuous level gauges (`<lcars-bargraph>`), and status pills (`<lcars-status-pill>`) with 60fps update batching.
- **Self-Contained Typography**: Bundled local `@font-face` definitions for Antonio condensed sans-serif with zero remote CDN calls.
- **Dual Bundle Distribution**: ESM module bundle for modern bundlers (Vite, Rollup, Webpack) and self-contained IIFE bundle for drop-in CDN `<script>` tag usage.

---

## Installation

### Package Manager (ESM)

Install via npm:

```bash
npm install @riptide-labs/lcars
```

Import the library and styles in your application:

```typescript
import '@riptide-labs/lcars';
import '@riptide-labs/lcars/dist/lcars.css';
import { setLcarsTheme, playLcarsSound } from '@riptide-labs/lcars';
```

### Standalone CDN (IIFE)

Include the standalone CSS and JavaScript bundles directly via `<script>` tag:

```html
<link rel="stylesheet" href="https://unpkg.com/@riptide-labs/lcars/dist/lcars.css" />
<script src="https://unpkg.com/@riptide-labs/lcars/dist/lcars.iife.js"></script>
```

All custom elements are automatically registered, and utility functions are available under `window.Lcars`.

---

## Quick Start

```html
<!doctype html>
<html lang="en" data-lcars-theme="tng">
  <head>
    <meta charset="UTF-8" />
    <title>LCARS Console</title>
    <link rel="stylesheet" href="/node_modules/@riptide-labs/lcars/dist/lcars.css" />
    <script type="module" src="/node_modules/@riptide-labs/lcars/dist/index.js"></script>
  </head>
  <body>
    <lcars-frame theme="tng">
      <lcars-elbow slot="elbow-tl" direction="top-left" title="LCARS 47" label="SEC-01"></lcars-elbow>
      <div slot="top-bar">USS ENTERPRISE // NCC-1701-D</div>

      <div slot="sidebar">
        <lcars-button sound="acknowledge" color="primary">ENGAGE</lcars-button>
        <lcars-button sound="warning" color="warning">SHIELDS</lcars-button>
        <lcars-button sound="alert" color="alert">RED ALERT</lcars-button>
      </div>

      <div slot="main">
        <lcars-panel title="PROPULSION" subtitle="WARP DRIVE">
          <lcars-readout label="WARP FACTOR" value="9.94" unit="WF" precision="2"></lcars-readout>
          <lcars-bargraph label="WARP CORE" value="82" max="100" segments="16" show-value unit="%"></lcars-bargraph>
          <lcars-status-pill status="nominal" code="01-A" label="CONTAINMENT STABLE"></lcars-status-pill>
        </lcars-panel>
      </div>

      <div slot="footer-readout">SYSTEM STATUS: NOMINAL</div>
      <lcars-elbow slot="elbow-br" direction="bottom-right" label="SYS OK"></lcars-elbow>
    </lcars-frame>
  </body>
</html>
```

---

## Era Themes

Set the active theme globally using `setLcarsTheme()` or the `data-lcars-theme` attribute on the root `<html>` element:

```typescript
import { setLcarsTheme } from '@riptide-labs/lcars';

// Switch active theme
setLcarsTheme('ds9'); // 'tng' | 'ds9' | 'nemesis' | 'contrast'
```

| Theme | Era Description | Primary Accent Colors |
| :--- | :--- | :--- |
| `tng` | 2360s Galaxy-class interface | Butterscotch Gold (`#ff9900`), Lilac (`#cc99cc`), Pale Peach (`#ffaa66`) |
| `ds9` | 2370s Deep Space 9 / Defiant | Ice Blue (`#99ccff`), Magenta (`#cc6699`), Sand Gold (`#eeaa55`) |
| `nemesis` | Late 24th-century Sovereign-class | Teal Cyan (`#0099cc`), Pale Blue (`#88aacc`), Warm Gold (`#ddaa44`) |
| `contrast` | High-contrast tactical mode | Vivid Amber (`#ffaa00`), Pure Cyan (`#00ddff`), Green (`#00cc66`) |

---

## Component Reference

### `<lcars-frame>`
Responsive 2D CSS grid layout wrapping standard LCARS interfaces.
- **Slots**: `top-bar`, `elbow-tl`, `sidebar`, `main`, `footer-readout`, `elbow-br`.
- **Properties**: `theme` (`'tng' | 'ds9' | 'nemesis' | 'contrast'`).

### `<lcars-elbow>`
Curved LCARS corner bracket rendered with precision SVG paths.
- **Properties**: `direction` (`'top-left' | 'bottom-left' | 'top-right' | 'bottom-right'`), `title`, `label`, `color`.

### `<lcars-button>`
Tactile tactile button with procedural audio feedback and keyboard interaction.
- **Properties**: `color`, `shape` (`'pill' | 'pill-start' | 'pill-end' | 'rect' | 'bracket'`), `sound` (`'chirp' | 'acknowledge' | 'warning' | 'alert' | 'input' | 'deny' | 'beep' | 'warp' | 'none'`), `disabled`, `active`.
- **Events**: `lcars-click` (CustomEvent with `{ color, shape, sound }`).

### `<lcars-panel>`
Structured container with title header, subtitle, and bracket accents.
- **Properties**: `title`, `subtitle`, `color`.

### `<lcars-readout>`
High-precision numeric telemetry readout with tabular spacing and unit badges.
- **Properties**: `label`, `value`, `unit`, `prefix`, `precision`, `placeholder`, `color`, `align` (`'left' | 'center' | 'right'`).

### `<lcars-bargraph>`
Segmented or continuous level meter with dynamic threshold color transitions.
- **Properties**: `value`, `min`, `max`, `segments`, `segmented`, `show-value`, `unit`, `precision`, `warning-threshold`, `alert-threshold`, `orientation` (`'horizontal' | 'vertical'`), `color`.

### `<lcars-status-pill>`
Diagnostic system state indicator with optional CSS pulse animations.
- **Properties**: `status` (`'nominal' | 'warning' | 'alert' | 'offline' | 'standby'`), `label`, `code`, `blink`, `color`.

---

## Procedural Audio Subsystem

Trigger authentic Starfleet UI acoustic feedback programmatically with zero audio files:

```typescript
import { playLcarsSound, setAudioVolume, muteAudio, unmuteAudio } from '@riptide-labs/lcars';

// Play sound presets
playLcarsSound('chirp');
playLcarsSound('acknowledge');
playLcarsSound('warning');
playLcarsSound('alert');
playLcarsSound('input');
playLcarsSound('deny');
playLcarsSound('beep');
playLcarsSound('warp');

// Manage master audio volume and mute
setAudioVolume(0.8);
muteAudio();
unmuteAudio();
```

---

## License

Apache-2.0. Copyright 2026 Ronny Trommer <ronny@no42.org>.
