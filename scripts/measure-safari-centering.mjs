/*
 * Copyright 2026 Ronny Trommer <ronny@no42.org>
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

// Measures Antonio capital centering in real Safari, which the cross-engine
// suite cannot reach: Playwright WebKit shares Safari's layout engine but not
// its text stack. Talks to safaridriver's WebDriver API directly, so this needs
// Node builtins only. Run through `make check-safari`, not in CI: it needs a
// Mac with Remote Automation on, and for iOS a connected phone.

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const TOLERANCE_PX = 1;
const SETUP_TIMEOUT_MS = 10_000;
const POLL_TIMEOUT_MS = 1_000;
const SESSION_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 60_000;

const url = process.env.SAFARI_URL || 'https://lcars-47.no42.org/';
const platform = process.env.SAFARI_PLATFORM || 'mac';

const SETUP_HINT = {
  mac: 'Run `safaridriver --enable` once, and turn on Develop > Allow Remote Automation in Safari.',
  iOS: 'Connect the phone, and turn on Web Inspector and Remote Automation under Settings > Apps > Safari > Advanced.',
};

// A simulator uses the Mac's text stack, which is not what iOS is measured for.
const CAPABILITIES = {
  mac: { platformName: 'mac' },
  iOS: { platformName: 'iOS', 'safari:useSimulator': false, 'safari:deviceType': 'iPhone' },
};

// Runs in the page. The baseline comes from an empty inline-block, which sits
// on it, and canvas gives the cap height, because no DOM box measures ink. The
// span keeps both on one line: .button-inner is a flex container, so a bare
// inline-block would become its own centred flex item. Mirrors the centring
// test in test/compat.test.ts; change the two together.
const MEASURE = `
const done = arguments[arguments.length - 1];
(async () => {
  await customElements.whenDefined('lcars-button');
  const button = document.createElement('lcars-button');
  button.innerHTML = '<span>ENGAGE<i style="display: inline-block; width: 0; height: 0"></i></span>';
  document.body.appendChild(button);
  try {
    await button.updateComplete;
    const inner = button.shadowRoot.querySelector('.button-inner');
    const style = getComputedStyle(inner);
    const font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    await document.fonts.load(font);
    const antonioLoaded =
      /^["']?Antonio/.test(style.fontFamily) &&
      [...document.fonts].some(
        (face) => face.family.replace(/["']/g, '') === 'Antonio' && face.status === 'loaded'
      );
    const box = inner.getBoundingClientRect();
    const baseline = button.querySelector('i').getBoundingClientRect().bottom;
    const context = document.createElement('canvas').getContext('2d');
    context.font = font;
    const capHeight = context.measureText('H').actualBoundingBoxAscent;
    const build = document.querySelector('script[type="module"][src]')?.src.split('/').pop();
    return { antonioLoaded, build, above: baseline - capHeight - box.top, below: box.bottom - baseline };
  } finally {
    button.remove();
  }
})().then(done, (error) => done({ error: String(error) }));
`;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function webdriver(port, method, path, body, timeout = REQUEST_TIMEOUT_MS) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const { value } = await response.json();
  if (!response.ok) {
    throw new Error(`${value?.error ?? response.status}: ${value?.message ?? path}`);
  }
  return value;
}

async function waitForDriver(port, driverExit) {
  const deadline = Date.now() + SETUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (driverExit.code !== undefined) {
      throw new Error(
        driverExit.code === 'ENOENT'
          ? 'safaridriver not found: this check needs macOS'
          : `safaridriver exited with code ${driverExit.code}`
      );
    }
    try {
      await webdriver(port, 'GET', '/status', undefined, POLL_TIMEOUT_MS);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('safaridriver did not start');
}

async function measure(port) {
  let session;
  try {
    session = await webdriver(
      port,
      'POST',
      '/session',
      { capabilities: { alwaysMatch: { ...CAPABILITIES[platform], browserName: 'safari' } } },
      SESSION_TIMEOUT_MS
    );
  } catch (error) {
    const hint = error.message.startsWith('session not created') ? ` ${SETUP_HINT[platform]}` : '';
    throw new Error(`could not start a Safari session (${error.message}).${hint}`);
  }
  const base = `/session/${session.sessionId}`;
  try {
    await webdriver(port, 'POST', `${base}/url`, { url });
    const result = await webdriver(port, 'POST', `${base}/execute/async`, {
      script: MEASURE,
      args: [],
    });
    return { ...result, version: session.capabilities.browserVersion };
  } finally {
    await webdriver(port, 'DELETE', base).catch(() => {});
  }
}

if (!Object.hasOwn(SETUP_HINT, platform)) {
  console.error(`SAFARI_PLATFORM must be mac or iOS, not ${platform}`);
  process.exit(2);
}

const port = await freePort();
const driver = spawn('safaridriver', ['-p', String(port)], { stdio: ['ignore', 'ignore', 'inherit'] });
const driverExit = {};
driver.once('exit', (code) => {
  driverExit.code = code;
});
driver.once('error', (error) => {
  driverExit.code = error.code;
});

let failure;
try {
  await waitForDriver(port, driverExit);
  const r = await measure(port);
  if (r.error) {
    failure = `measurement failed: ${r.error}`;
  } else {
    const difference = Math.abs(r.above - r.below);
    console.log(
      `Safari ${r.version} (${platform}) at ${url}, build ${r.build}: ` +
        `${r.above.toFixed(2)}px above, ${r.below.toFixed(2)}px below, ` +
        `difference ${difference.toFixed(2)}px, Antonio ${r.antonioLoaded ? 'loaded' : 'NOT loaded'}`
    );
    if (!r.antonioLoaded) {
      failure = 'Antonio is not loaded, so this measured a fallback font';
    } else if (difference > TOLERANCE_PX) {
      failure = `capitals are off center by more than ${TOLERANCE_PX}px`;
    }
  }
} catch (error) {
  failure = error.message;
} finally {
  driver.kill();
}

if (failure) {
  console.error(`check-safari: ${failure}`);
  process.exit(1);
}
