import { chromium } from '@playwright/test';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

const baseURL = process.env.MOCK_BASE_URL ?? 'http://127.0.0.1:5217';
const outputDir = path.resolve('.claude/research/ui/mockups/2026-08-04-fresh-review');
const legacyMockDir = path.resolve('.claude/research/ui/mockups/2026-08-03-ui-refresh');
const manifestPath = path.join(outputDir, 'provenance.json');
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 851, height: 393 },
};
const matchCanvas = { x: 103, y: 98, width: 247, height: 197 };

const historyFixture = [
  { id: 'mock-win', sessionId: 'mock-win', recorded: Date.UTC(2026, 7, 3, 9, 58), won: true, deckName: '少年探偵団・事件', oppDeckName: '警察・事件', mode: 'solo', turns: 12, duration: 720, evidGot: 7, evidLost: 4, contacts: 2, hirameki: 1, misread: 0, p1Target: 7, p2Target: 6 },
  { id: 'mock-loss', sessionId: 'mock-loss', recorded: Date.UTC(2026, 7, 2, 9, 55), won: false, deckName: '警察・事件', oppDeckName: '黒ずくめの組織', mode: 'solo', turns: 15, duration: 900, evidGot: 5, evidLost: 7, contacts: 1, hirameki: 0, misread: 2, p1Target: 7, p2Target: 6 },
  { id: 'mock-win-2', sessionId: 'mock-win-2', recorded: Date.UTC(2026, 7, 1, 9, 58), won: true, deckName: '少年探偵団・事件', oppDeckName: '怪盗キッド', mode: 'solo', turns: 10, duration: 600, evidGot: 7, evidLost: 3, contacts: 3, hirameki: 2, misread: 0, p1Target: 7, p2Target: 6 },
];

const entries = [];
const timestamp = new Date().toISOString();

function addEntry(filename, routeState, viewport, provenance, source, captureMethod) {
  entries.push({ filename, routeState, viewport: `${viewport.width}x${viewport.height}`, provenance, source, captureMethod, generatedAt: timestamp });
}

function outputPath(filename) {
  return path.join(outputDir, filename);
}

async function captureLive(browser, filename, route, viewport, prepare) {
  const page = await browser.newPage({ viewport });
  if (prepare) await prepare(page);
  await page.goto(`${baseURL}/#${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: outputPath(filename), animations: 'disabled' });
  await page.close();
  addEntry(filename, `#${route}`, viewport, 'runtime', `${baseURL}/#${route}`, 'Playwright screenshot from fresh loopback server');
}

async function captureSettings(browser, filename, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseURL}/#settings`, { waitUntil: 'domcontentloaded' });
  const save = page.getByRole('button', { name: '設定を保存', exact: true });
  const reset = page.getByRole('button', { name: '初期状態に戻す', exact: true });
  if (await save.count() !== 1 || await reset.count() !== 1) throw new Error('settings save/reset controls missing');
  await page.getByRole('button', { name: 'コンパクト', exact: true }).click();
  if (await page.getByText('未保存の変更があります。', { exact: true }).count() !== 1) throw new Error('settings unsaved indicator missing');
  await page.screenshot({ path: outputPath(filename), animations: 'disabled' });
  await page.close();
  addEntry(filename, '#settings unsaved save/reset controls', viewport, 'runtime', `${baseURL}/#settings`, 'Playwright screenshot from fresh loopback server with unsaved indicator and persistent save/reset footer');
}

async function assertRemovedMatchHud(page) {
  for (const forbidden of ['CPU\u91cd\u8981\u624b\u306e\u8868\u793a\u9593\u9694', 'CPU\u5236\u5fa1', '5\u79d2/\u624b', '10\u79d2/\u624b']) {
    const count = await page.getByText(forbidden, { exact: false }).count();
    if (count !== 0) throw new Error(`fresh MATCH contains removed HUD text: ${forbidden}`);
  }
  const spectatorHudCount = await page.locator('.spectator-hud, [data-testid*="spectator" i], [class*="spectator" i]').count();
  if (spectatorHudCount !== 0) throw new Error(`fresh MATCH contains SpectatorHUD-equivalent element(s): ${spectatorHudCount}`);
}

async function captureFreshMatchBase(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseURL}/#setup`, { waitUntil: 'domcontentloaded' });
  const ready = page.locator('.meta-btn-ready').first();
  if (await ready.count()) await ready.click();
  else await page.getByRole('button', { name: '対戦開始', exact: true }).click();
  const skip = page.locator('button.mulligan-skip');
  await skip.waitFor({ state: 'visible', timeout: 10_000 });
  await skip.click();
  await skip.waitFor({ state: 'hidden', timeout: 10_000 });
  await page.locator('#scaler').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  await assertRemovedMatchHud(page);
  const buffer = await page.screenshot({ animations: 'disabled' });
  await page.close();
  return buffer;
}

async function captureMatch(browser, filename, viewport) {
  const buffer = await captureFreshMatchBase(browser, viewport);
  await writeFile(outputPath(filename), buffer);
  addEntry(filename, '#setup live match after mulligan', viewport, 'runtime', `${baseURL}/#setup`, 'Playwright screenshot from fresh loopback server; asserted removed CPU HUD text and SpectatorHUD-equivalent selectors absent');
  entries.at(-1).cpuHudRemoved = true;
}

async function captureMobileMatchDesignMocks(browser) {
  const base = await captureFreshMatchBase(browser, viewports.mobile);
  const baseDataUrl = `data:image/png;base64,${base.toString('base64')}`;
  const render = async (filename, targetSelection) => {
    const page = await browser.newPage({ viewport: viewports.mobile });
    const rail = targetSelection ? '<aside class="target-rail"><strong>&#23550;&#35937;&#12434;&#36984;&#25246;</strong><button>&#23550;&#35937; A</button><button>&#23550;&#35937; B</button><button>&#12461;&#12515;&#12531;&#12475;&#12523;</button></aside>' : '';
    await page.setContent(`<!doctype html><style>html,body{margin:0;width:851px;height:393px;overflow:hidden;background:#020912}.base{position:absolute;inset:0;width:851px;height:393px;display:block}.target-rail{position:absolute;left:740px;top:0;width:111px;height:393px;padding:8px 6px;background:#041321;color:#dff8ff;font:700 11px/1.2 sans-serif;border-left:1px solid #236a8a}.target-rail strong{display:block;margin:2px 0 8px}.target-rail button{width:99px;min-height:44px;margin:0 0 8px;border:1px solid #33b9e7;border-radius:4px;background:#092a3d;color:#f3fbff;font:700 11px sans-serif}</style><img class="base" src="${baseDataUrl}" alt="fresh MATCH base">${rail}`);
    await page.screenshot({ path: outputPath(filename), animations: 'disabled' });
    await page.close();
    addEntry(filename, targetSelection ? '#setup live match target-selection static composition' : '#setup live match resolution static composition', viewports.mobile, 'design-mock', `fresh runtime base ${baseURL}/#setup after mulligan + static composition`, 'Playwright screenshot of static composition over a fresh HUD-asserted runtime base');
    entries.at(-1).cpuHudRemoved = true;
    entries.at(-1).baseDomCpuHudRemoved = true;
  };
  await render('match-mobile-851x393-resolution-design-mock.png', false);
  await render('match-mobile-851x393-target-selection-design-mock.png', true);
}

async function captureResult(browser, filename, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseURL}/#home`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const viteModule = (sourcePath) => performance.getEntriesByType('resource').map((entry) => entry.name).find((name) => name.includes(sourcePath));
    const gameStoreModule = viteModule('/src/ui/state/store.ts');
    if (!gameStoreModule) throw new Error('Mock fixture could not resolve /src/ui/state/store.ts');
    const sampleGameModule = gameStoreModule.replace('/src/ui/state/store.ts', '/src/ui/fixtures/sampleGameState.ts');
    const metaStoreModule = viteModule('/src/state/metaStore.ts');
    if (!metaStoreModule) throw new Error('Mock fixture could not resolve /src/state/metaStore.ts');
    const [{ createSampleGameState }, { useGameStateStore }, { useMetaStore }] = await Promise.all([import(sampleGameModule), import(gameStoreModule), import(metaStoreModule)]);
    const state = createSampleGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    state.turn.number = 8;
    useGameStateStore.getState().setGameState(state);
    useMetaStore.getState().setMatchMeta({ sessionId: 'fresh-result-mock', mode: 'solo', selfDeckName: '少年探偵団・事件', oppDeckName: '黒ずくめの組織' });
    window.location.hash = '#result';
  });
  await page.locator('.result-screen').waitFor({ state: 'visible' });
  await page.screenshot({ path: outputPath(filename), animations: 'disabled' });
  await page.close();
  addEntry(filename, '#result fixture: evidence win', viewport, 'runtime', `${baseURL}/#home`, 'Playwright screenshot from fresh loopback server with in-page fixture');
}

async function copyDesignMock(filename, source, routeState, viewport) {
  await copyFile(path.join(legacyMockDir, source), outputPath(filename));
  addEntry(filename, routeState, viewport, 'design-mock', path.join('.claude/research/ui/mockups/2026-08-03-ui-refresh', source), 'Byte-for-byte copy of named reviewed design-mock source');
}

async function captureDesignMock(browser, filename, source, routeState, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(pathToFileURL(path.join(legacyMockDir, source)).href, { waitUntil: 'load' });
  await page.screenshot({ path: outputPath(filename), animations: 'disabled' });
  await page.close();
  addEntry(filename, routeState, viewport, 'design-mock', path.join('.claude/research/ui/mockups/2026-08-03-ui-refresh', source), 'Playwright screenshot of named reviewed design-mock HTML');
}

function decodePng(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) throw new Error('not a PNG');
  let offset = 8;
  let width;
  let height;
  let colorType;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset); const type = buffer.toString('ascii', offset + 4, offset + 8); const chunk = buffer.subarray(offset + 8, offset + 8 + length); offset += length + 12;
    if (type === 'IHDR') { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); if (chunk[8] !== 8 || chunk[12] !== 0) throw new Error('unsupported PNG bit depth or interlace'); colorType = chunk[9]; }
    if (type === 'IDAT') idat.push(chunk);
    if (type === 'IEND') break;
  }
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!width || !height || !bytesPerPixel) throw new Error('unsupported PNG color type');
  const raw = inflateSync(Buffer.concat(idat)); const stride = width * bytesPerPixel; const pixels = Buffer.alloc(stride * height); let input = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[input++]; const row = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x += 1) {
      const value = raw[input++]; const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0; const above = y ? pixels[(y - 1) * stride + x] : 0; const upperLeft = y && x >= bytesPerPixel ? pixels[(y - 1) * stride + x - bytesPerPixel] : 0;
      if (filter === 0) row[x] = value;
      else if (filter === 1) row[x] = (value + left) & 255;
      else if (filter === 2) row[x] = (value + above) & 255;
      else if (filter === 3) row[x] = (value + Math.floor((left + above) / 2)) & 255;
      else if (filter === 4) { const p = left + above - upperLeft; const pa = Math.abs(p - left); const pb = Math.abs(p - above); const pc = Math.abs(p - upperLeft); row[x] = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft)) & 255; }
      else throw new Error(`unsupported PNG filter ${filter}`);
    }
  }
  const rgba = colorType === 6 ? pixels : Buffer.alloc(width * height * 4);
  if (colorType === 2) for (let source = 0, target = 0; source < pixels.length; source += 3, target += 4) { rgba[target] = pixels[source]; rgba[target + 1] = pixels[source + 1]; rgba[target + 2] = pixels[source + 2]; rgba[target + 3] = 255; }
  return { width, height, rgba };
}

function canvasRegion(image) {
  const bytes = Buffer.alloc(matchCanvas.width * matchCanvas.height * 4);
  for (let row = 0; row < matchCanvas.height; row += 1) image.rgba.copy(bytes, row * matchCanvas.width * 4, ((matchCanvas.y + row) * image.width + matchCanvas.x) * 4, ((matchCanvas.y + row) * image.width + matchCanvas.x + matchCanvas.width) * 4);
  return bytes;
}

export async function verifyReviewSet() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.entries) || manifest.entries.length !== 13) throw new Error(`manifest must contain exactly 13 entries; found ${manifest.entries?.length ?? 'none'}`);
  const filenames = new Set(); const imageHashes = new Set(); const decoded = new Map();
  for (const entry of manifest.entries) {
    for (const field of ['filename', 'routeState', 'viewport', 'provenance', 'source', 'captureMethod', 'generatedAt']) if (!entry[field]) throw new Error(`manifest entry missing ${field}`);
    if (filenames.has(entry.filename)) throw new Error(`duplicate filename: ${entry.filename}`); filenames.add(entry.filename);
    if (!['runtime', 'design-mock'].includes(entry.provenance)) throw new Error(`invalid provenance: ${entry.filename}`);
    const image = decodePng(await readFile(outputPath(entry.filename)));
    const expected = entry.filename.includes('-desktop-') ? viewports.desktop : entry.filename.includes('-mobile-') ? viewports.mobile : undefined;
    if (!expected || image.width !== expected.width || image.height !== expected.height) throw new Error(`wrong dimensions: ${entry.filename} is ${image.width}x${image.height}`);
    const firstPixel = image.rgba.subarray(0, 4); let differs = false;
    for (let i = 4; i < image.rgba.length; i += 4) if (!image.rgba.subarray(i, i + 4).equals(firstPixel)) { differs = true; break; }
    if (!differs) throw new Error(`blank PNG: ${entry.filename}`);
    const hash = createHash('sha256').update(image.rgba).digest('hex'); if (imageHashes.has(hash)) throw new Error(`duplicated output image: ${entry.filename}`); imageHashes.add(hash); decoded.set(entry.filename, image);
  }
  const expectedNames = new Set([
    'match-desktop-1440x900-runtime.png', 'match-mobile-851x393-resolution-design-mock.png', 'match-mobile-851x393-target-selection-design-mock.png',
    ...['history', 'result', 'replay', 'tutorial', 'settings'].flatMap((route) => [`${route}-desktop-1440x900-${['replay', 'tutorial'].includes(route) ? 'design-mock' : 'runtime'}.png`, `${route}-mobile-851x393-${['replay', 'tutorial'].includes(route) ? 'design-mock' : 'runtime'}.png`]),
  ]);
  if (filenames.size !== expectedNames.size || [...expectedNames].some((name) => !filenames.has(name))) throw new Error('manifest filenames do not match the exact 13-asset contract');
  const resolution = decoded.get('match-mobile-851x393-resolution-design-mock.png'); const target = decoded.get('match-mobile-851x393-target-selection-design-mock.png');
  if (!canvasRegion(resolution).equals(canvasRegion(target))) throw new Error('MATCH central canvas differs between resolution and target-selection');
  const runtimeMatch = manifest.entries.find((entry) => entry.filename === 'match-desktop-1440x900-runtime.png');
  if (runtimeMatch?.provenance !== 'runtime' || runtimeMatch?.cpuHudRemoved !== true || !String(runtimeMatch.source).startsWith('http://127.0.0.1:')) throw new Error('fresh runtime MATCH provenance or removed-CPU-HUD assertion missing');
  for (const filename of ['match-mobile-851x393-resolution-design-mock.png', 'match-mobile-851x393-target-selection-design-mock.png']) {
    const entry = manifest.entries.find((candidate) => candidate.filename === filename);
    if (entry?.provenance !== 'design-mock' || entry?.cpuHudRemoved !== true || entry?.baseDomCpuHudRemoved !== true || !String(entry.source).includes('fresh runtime base') || String(entry.source).includes('2026-08-03-ui-refresh')) throw new Error(`fresh mobile MATCH provenance or HUD assertion missing: ${filename}`);
  }
  for (const filename of ['replay-desktop-1440x900-design-mock.png', 'replay-mobile-851x393-design-mock.png']) {
    const entry = manifest.entries.find((candidate) => candidate.filename === filename);
    if (entry?.provenance !== 'design-mock' || !String(entry.source).endsWith('replay-reviewed.html') || !String(entry.captureMethod).includes('HTML')) throw new Error(`replay must be captured from the reviewed HTML source: ${filename}`);
  }
  const staleDesktopReplay = decodePng(await readFile(path.join(legacyMockDir, 'replay-desktop-1440x900-reviewed.png')));
  if (decoded.get('replay-desktop-1440x900-design-mock.png').rgba.equals(staleDesktopReplay.rgba)) throw new Error('replay desktop header is a stale translucent/copy output');
  console.log(`PASS: 13 PNGs, manifest, dimensions, nonblank pixels, unique decoded images, ${matchCanvas.width}x${matchCanvas.height} MATCH central canvas identity, and removed CPU HUD assertion`);
}

async function main() {
  if (process.argv.includes('--verify')) return verifyReviewSet();
  if (process.argv.includes('--replay-only')) {
    const existing = JSON.parse(await readFile(manifestPath, 'utf8'));
    const browser = await chromium.launch({ headless: true });
    try {
      await captureDesignMock(browser, 'replay-desktop-1440x900-design-mock.png', 'replay-reviewed.html', '#replay reviewed direction', viewports.desktop);
      await captureDesignMock(browser, 'replay-mobile-851x393-design-mock.png', 'replay-reviewed.html', '#replay reviewed direction', viewports.mobile);
    } finally { await browser.close(); }
    await writeFile(manifestPath, `${JSON.stringify({ generatedAt: timestamp, entries: [...existing.entries.filter((entry) => !entry.filename.startsWith('replay-')), ...entries] }, null, 2)}\n`);
    return verifyReviewSet();
  }
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await captureMatch(browser, 'match-desktop-1440x900-runtime.png', viewports.desktop);
    await captureMobileMatchDesignMocks(browser);
    await captureLive(browser, 'history-desktop-1440x900-runtime.png', 'history', viewports.desktop, async (page) => page.addInitScript((records) => localStorage.setItem('conan.meta.v1.history', JSON.stringify({ state: { history: records }, version: 1 })), historyFixture));
    await captureLive(browser, 'history-mobile-851x393-runtime.png', 'history', viewports.mobile, async (page) => page.addInitScript((records) => localStorage.setItem('conan.meta.v1.history', JSON.stringify({ state: { history: records }, version: 1 })), historyFixture));
    await captureResult(browser, 'result-desktop-1440x900-runtime.png', viewports.desktop);
    await captureResult(browser, 'result-mobile-851x393-runtime.png', viewports.mobile);
    await captureDesignMock(browser, 'replay-desktop-1440x900-design-mock.png', 'replay-reviewed.html', '#replay reviewed direction', viewports.desktop);
    await captureDesignMock(browser, 'replay-mobile-851x393-design-mock.png', 'replay-reviewed.html', '#replay reviewed direction', viewports.mobile);
    await captureDesignMock(browser, 'tutorial-desktop-1440x900-design-mock.png', 'tutorial-reviewed.html', '#tutorial reviewed direction', viewports.desktop);
    await captureDesignMock(browser, 'tutorial-mobile-851x393-design-mock.png', 'tutorial-reviewed.html', '#tutorial reviewed direction', viewports.mobile);
    await captureSettings(browser, 'settings-desktop-1440x900-runtime.png', viewports.desktop);
    await captureSettings(browser, 'settings-mobile-851x393-runtime.png', viewports.mobile);
  } finally { await browser.close(); }
  await writeFile(manifestPath, `${JSON.stringify({ generatedAt: timestamp, entries }, null, 2)}\n`);
  await verifyReviewSet();
  console.log(outputDir);
}

await main();
