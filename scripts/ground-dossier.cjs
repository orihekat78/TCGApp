#!/usr/bin/env node
// Ground only explicit, parent-validated TSV inputs into a pinned output directory.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const cardsDataRoot = path.resolve(process.env.CONAN_CARDS_DATA_DIR || path.join(ROOT, '.claude', 'specs', 'cards-data'));
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outputArg = outIndex >= 0 ? args[outIndex + 1] : null;
const tsvInputs = [];
const tsvDigests = [];
const ids = [];
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--out') { index += 1; continue; }
  if (args[index] === '--tsv') { tsvInputs.push(args[index + 1]); index += 1; continue; }
  if (args[index] === '--tsv-sha') { tsvDigests.push(args[index + 1]); index += 1; continue; }
  if (!args[index].startsWith('-')) ids.push(args[index]);
}
if (outIndex < 0 || !outputArg || outputArg.startsWith('-') || !tsvInputs.length
  || tsvInputs.some((file) => !file || file.startsWith('-')) || tsvDigests.length !== tsvInputs.length
  || tsvDigests.some((digest) => !/^[a-f0-9]{64}$/.test(digest ?? '')) || !ids.length) {
  console.error('usage: node scripts/ground-dossier.cjs --out <pinned-output-dir> --tsv <validated.tsv> --tsv-sha <sha256> <ID> [<ID> ...]');
  process.exit(1);
}

const OUT = path.resolve(outputArg);
const outStat = fs.lstatSync(OUT);
if (!outStat.isDirectory() || outStat.isSymbolicLink() || fs.readdirSync(OUT).length !== 0) {
  throw new Error('ground-dossier output directory is unsafe');
}
const outputIdentity = { dev: outStat.dev, ino: outStat.ino };
function assertOutput() {
  const stat = fs.lstatSync(OUT);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== outputIdentity.dev || stat.ino !== outputIdentity.ino) {
    throw new Error('ground-dossier output directory changed while writing');
  }
}
function writeOutput(name, content) {
  assertOutput();
  if (!/^(?:_capabilities|[A-Z0-9]+)\.md$/.test(name)) throw new Error('ground-dossier output name is invalid');
  try { fs.writeFileSync(path.join(OUT, name), content, { encoding: 'utf8', flag: 'wx' }); } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('ground-dossier output file already exists');
    throw error;
  }
}
function read(file) { return fs.readFileSync(file, 'utf8'); }
function tryRead(file) { try { return read(file); } catch { return null; } }
function listFiles(directory, predicate, acc = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) listFiles(file, predicate, acc);
    else if (predicate(file)) acc.push(file);
  }
  return acc;
}
const tsvFiles = tsvInputs.map((input, index) => {
  const file = path.resolve(input);
  const relative = path.relative(cardsDataRoot, file);
  const stat = fs.lstatSync(file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('ground-dossier TSV manifest entry is unsafe');
  }
  const bytes = fs.readFileSync(file);
  const digest = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  if (digest !== tsvDigests[index]) throw new Error('ground-dossier TSV manifest digest changed');
  return { file, text: bytes.toString('utf8') };
});
const cardFiles = listFiles(path.join(ROOT, 'src', 'cards'), (file) => file.endsWith('.ts'));
const reuseIndex = read(path.join(ROOT, 'src', 'cards', '_reuse', 'index.ts'));
const deferredIndex = read(path.join(ROOT, '.claude', 'specs', 'DEFERRED-INDEX.md'));

function capabilities() {
  const types = read(path.join(ROOT, 'src', 'engine', 'types', 'effect.ts'));
  const verbs = [...(types.match(/export type AtomVerb =([\s\S]*?);/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
  return ['# engine capability snapshot', '', `## AtomVerb (${verbs.length})`, verbs.join(' / '), ''].join('\n');
}
function dossier(id) {
  const out = [`# grounding dossier: ${id}`, '', '## output', `- directory: ${OUT}`, '', '## TSV'];
  let hits = 0;
  for (const tsv of tsvFiles) {
    for (const line of tsv.text.split('\n')) {
      if (line.split('\t').some((cell) => cell === id || cell === `${id}P` || cell === `${id}P2`)) {
        out.push(`- ${path.relative(cardsDataRoot, tsv.file)}:`, '```', line.trim(), '```');
        hits += 1;
      }
    }
  }
  if (!hits) out.push('- not found');
  const definitions = cardFiles.filter((file) => new RegExp(`export const ${id}(P|P2)?:\\s*CardDef`).test(read(file)));
  out.push('', '## existing CardDef');
  out.push(...(definitions.length ? definitions.map((file) => `- ${path.relative(ROOT, file)}`) : ['- none']));
  const reuse = [id, `${id}P`, `${id}P2`].filter((value) => new RegExp(`\\b${value}\\b`).test(reuseIndex));
  out.push('', '## reuse', `- ${reuse.length ? reuse.join(', ') : 'none'}`);
  const deferred = deferredIndex.split('\n').filter((line) => line.includes(id));
  out.push('', '## deferred', ...(deferred.length ? deferred.map((line) => `- ${line.trim()}`) : ['- none']));
  out.push('', '## prior grounding', `- ${tryRead(path.join(ROOT, '.claude', 'specs', 'grounding', `${id}.md`)) ? 'present' : 'none'}`);
  out.push('', '## capability snapshot', `- ${path.join(OUT, '_capabilities.md')}`);
  return out.join('\n');
}

writeOutput('_capabilities.md', capabilities());
console.log(`[ground-dossier] capabilities -> ${path.join(OUT, '_capabilities.md')}`);
for (const id of ids) {
  const content = dossier(id);
  const output = path.join(OUT, `${id}.md`);
  writeOutput(`${id}.md`, content);
  console.log(`[ground-dossier] ${id} -> ${output}`);
}
