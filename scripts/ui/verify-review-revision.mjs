import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('.claude/research/ui/mockups/2026-08-04-review-revision');
const expected = [
  ['history-desktop-1440x900-runtime.png', 1440, 900, 'runtime', 'implemented HISTORY route'],
  ['history-mobile-851x393-runtime.png', 851, 393, 'runtime', 'implemented HISTORY route'],
  ['result-desktop-1440x900-design-mock.png', 1440, 900, 'design-mock', 'result-revised.html'],
  ['result-mobile-851x393-design-mock.png', 851, 393, 'design-mock', 'result-revised.html'],
  ['replay-mobile-851x393-design-mock.png', 851, 393, 'design-mock', 'replay-revised.html'],
  ['match-desktop-1440x900-design-mock.png', 1440, 900, 'design-mock', 'match-revised.html'],
  ['match-mobile-851x393-resolution-design-mock.png', 851, 393, 'design-mock', 'match-revised.html'],
  ['match-mobile-851x393-target-selection-design-mock.png', 851, 393, 'design-mock', 'match-revised.html'],
];

function pngDimensions(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('invalid PNG signature');
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') throw new Error('PNG has no leading IHDR');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const hashes = new Set();
const entries = [];
for (const [filename, width, height, provenance, source] of expected) {
  if (/settings|tutorial|replay-desktop/.test(filename)) throw new Error(`excluded asset entered review set: ${filename}`);
  const buffer = await readFile(path.join(outputDir, filename));
  const actual = pngDimensions(buffer);
  if (actual.width !== width || actual.height !== height) throw new Error(`${filename}: ${actual.width}x${actual.height}`);
  if (buffer.length < 10_000) throw new Error(`${filename}: suspiciously small or blank output`);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  if (hashes.has(sha256)) throw new Error(`${filename}: duplicate image output`);
  hashes.add(sha256);
  entries.push({ filename, viewport: `${width}x${height}`, provenance, source, sha256 });
}

const manifest = {
  generatedAt: new Date().toISOString(),
  scope: {
    implemented: ['HISTORY'],
    reviewMocks: ['RESULT desktop', 'RESULT mobile', 'REPLAY mobile', 'MATCH desktop', 'MATCH mobile resolution', 'MATCH mobile target selection'],
    excluded: ['SETTINGS', 'TUTORIAL', 'REPLAY desktop'],
  },
  entries,
};
await writeFile(path.join(outputDir, 'provenance.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`verified ${entries.length} review images`);
