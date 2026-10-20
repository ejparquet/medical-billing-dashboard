// Usage: node screenshot.mjs <url> [label] [width] [height]
// Saves to ./temporary screenshots/screenshot-N[-label].png (auto-incremented)
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteerPath = process.env.PUPPETEER_PATH || 'puppeteer-core';
const puppeteer = require(require.resolve(puppeteerPath, { paths: [process.cwd(), ...(process.env.NODE_PATH || '').split(':')] }));

const [url = 'http://localhost:3000', label, width = '1440', height = '900'] = process.argv.slice(2);
const dir = join(fileURLToPath(new URL('.', import.meta.url)), 'temporary screenshots');
await mkdir(dir, { recursive: true });
const nums = (await readdir(dir)).map(f => +(f.match(/^screenshot-(\d+)/)?.[1] ?? 0));
const n = Math.max(0, ...nums) + 1;
const out = join(dir, `screenshot-${n}${label ? '-' + label : ''}.png`);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const page = await browser.newPage();
if (process.env.SCHEME) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: process.env.SCHEME }]);
await page.setViewport({ width: +width, height: +height, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1200));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
