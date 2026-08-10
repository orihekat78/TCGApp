import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = resolve(import.meta.dirname);
const pageUrl = pathToFileURL(resolve(here, 'replay-revised-v3.html')).href;
const output = resolve(here, 'replay-mobile-851x393-revised-v3-design-mock.png');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 851, height: 393 }, deviceScaleFactor: 1 });
await page.goto(pageUrl, { waitUntil: 'networkidle' });
await page.screenshot({ path: output });
await browser.close();
