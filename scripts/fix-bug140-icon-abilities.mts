// BUG-140 一括補修 (one-shot): TSV cutIn/hirameki 列が非空なのに def に該当アイコン能力が
// 無い出荷済カードへ、正準形テンプレの AbilityDef を機械追記する。
// 使い方: npx tsx scripts/fix-bug140-icon-abilities.mts        (dry-run: 分類表のみ)
//         npx tsx scripts/fix-bug140-icon-abilities.mts --write (実書込)
// 正準形の出典:
//   hirameki draw1        — src/cards/ct-d03/D03011.ts a2
//   hirameki char-sleep   — src/cards/ct-d05/D05007.ts a2 (明示 $pick+target: hirameki fire は
//                           hiramekiResolve が chooseAtomTarget で auto-resolve するため短縮形不可)
//   hirameki evidenceGain — D03011 a2 trigger + evidenceGain atom (D11003 a1 同 verb)
//   hirameki remove→hand  — B01094 自身の a1 step1 と同一 atom (handAddFromRemove 明示 pick)
//   cutin AP+N            — src/cards/ct-d08/D08015.ts a2
//   cutin ターン条件       — src/cards/ct-p04/B04096.ts a2 (BUG-140 先行補修分)
// DEFER (実装しない): B06035 (hirameki 内 chain+条件 gate が fire 経路で未確証) /
//                     B05039 (コンタクト対象キャラの特徴条件が Condition union に存在しない)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_CARDS } from '../src/cards/index.js';
import { defHasKeyword } from '../src/engine/read/keyword.js';

const WRITE = process.argv.includes('--write');
const ROOT = resolve(import.meta.dirname, '..');
const DATA = resolve(ROOT, '.claude/specs/cards-data');
const DEFER = new Set(['B06035', 'B05039']);

const registered = new Map(ALL_CARDS.map((d) => [d.id, d]));

// ---- 1. TSV 走査 (audit-icon-abilities.mts と同一ロジック) ----
type Row = { id: string; set: string; cutIn: string; hirameki: string };
const rows: Row[] = [];
for (const set of readdirSync(DATA)) {
  const dir = resolve(DATA, set);
  for (const kind of ['character', 'event']) {
    const f = resolve(dir, `${kind}.tsv`);
    if (!existsSync(f)) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    const header = lines[0]!.split('\t');
    const iId = header.indexOf('cardNum');
    const iCut = header.indexOf('cutIn');
    const iHir = header.indexOf('hirameki');
    if (iId === -1 || iCut === -1) continue;
    for (const line of lines.slice(1)) {
      const cols = line.split('\t');
      const id = cols[iId]?.trim();
      if (!id) continue;
      rows.push({ id, set, cutIn: cols[iCut]?.trim() ?? '', hirameki: cols[iHir]?.trim() ?? '' });
    }
  }
}

// ---- 2. 欠落抽出 ----
type Task = { id: string; set: string; icon: 'cutin' | 'hirameki'; text: string };
const tasks: Task[] = [];
for (const r of rows) {
  const def = registered.get(r.id);
  if (!def) continue;
  if (r.cutIn && !defHasKeyword(def, 'カットイン')) tasks.push({ id: r.id, set: r.set, icon: 'cutin', text: r.cutIn });
  if (r.hirameki && !defHasKeyword(def, 'ヒラメキ')) tasks.push({ id: r.id, set: r.set, icon: 'hirameki', text: r.hirameki });
}
const fixIds = new Set(tasks.map((t) => t.id));

// ---- 3. 分類 ----
type Tpl = 'h-draw' | 'h-sleep' | 'h-evid' | 'h-removeYellowToHand' | 'c-ap1000' | 'c-ap2000' | 'c-turnAP';
function classify(t: Task): Tpl | null {
  if (t.icon === 'hirameki') {
    const m = t.text.replace(/^【ヒラメキ】（証拠からリムーブされるときに発動する）/, '');
    if (m === 'カードを1枚引く。') return 'h-draw';
    if (m === 'キャラを1枚まで選び、スリープさせる。') return 'h-sleep';
    if (m === '自分は証拠を1つ得る。') return 'h-evid';
    if (m.startsWith('自分のリムーブエリアにある【黄】のキャラを1枚まで選び、手札に加える')) return 'h-removeYellowToHand';
    return null;
  }
  if (/^【カットイン】AP＋1000(（コンタクト中に手札からリムーブして使う）)?$/.test(t.text)) return 'c-ap1000';
  if (/^【カットイン】AP＋2000(（コンタクト中に手札からリムーブして使う）)?$/.test(t.text)) return 'c-ap2000';
  if (t.text.includes('【自分ターン中】AP＋1000') && t.text.includes('【相手ターン中】AP＋3000')) return 'c-turnAP';
  return null;
}

// ---- 4. テンプレ生成 ----
function esc(s: string): string {
  // TSV セル内の literal \n (backslash+n) は TS 文字列 escape としてそのまま通す。' のみ escape。
  return s.replace(/'/g, "\\'");
}
function genAbility(name: string, tpl: Tpl, text: string): string {
  const desc = `'${esc(text)}'`;
  const hiraHead = [
    `const ${name}: AbilityDef = {`,
    `  id: '${name}',`,
    `  type: 'triggered',`,
    `  scope: 'on-evidence',`,
    `  trigger: { hook: 'evidence:remove-by-action', optional: true },`,
  ].join('\n');
  const cutinHead = [
    `const ${name}: AbilityDef = {`,
    `  id: '${name}',`,
    `  type: 'triggered',`,
    `  scope: 'on-hand',`,
    `  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)`,
  ].join('\n');
  switch (tpl) {
    case 'h-draw':
      return [
        `// ${name}: 【ヒラメキ】カードを1枚引く (BUG-140 補修 2026-06-13: TSV hirameki 列の取りこぼし修正) — D03011 a2 同型`,
        hiraHead,
        `  // カードを1枚引く`,
        `  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },`,
        `  description: ${desc},`,
        `  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],`,
        `};`,
      ].join('\n');
    case 'h-sleep':
      return [
        `// ${name}: 【ヒラメキ】キャラを1枚まで選びスリープ (BUG-140 補修 2026-06-13) — D05007 a2 同型`,
        `// (明示 $pick+target: hirameki fire は hiramekiResolve が chooseAtomTarget で auto-resolve するため短縮形不可)`,
        hiraHead,
        `  effect: {`,
        `    kind: 'atom',`,
        `    verb: 'sceneSetState',`,
        `    args: {`,
        `      uid: '$pick',`,
        `      state: 'sleep',`,
        `      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },`,
        `    },`,
        `  },`,
        `  description: ${desc},`,
        `  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],`,
        `};`,
      ].join('\n');
    case 'h-evid':
      return [
        `// ${name}: 【ヒラメキ】自分は証拠を1つ得る (BUG-140 補修 2026-06-13) — D03011 a2 trigger + evidenceGain (D11003 a1 同 verb)`,
        hiraHead,
        `  // 自分は証拠を1つ得る`,
        `  effect: { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } },`,
        `  description: ${desc},`,
        `  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],`,
        `};`,
      ].join('\n');
    case 'h-removeYellowToHand':
      return [
        `// ${name}: 【ヒラメキ】リムーブの【黄】キャラを1枚まで手札へ (BUG-140 補修 2026-06-13) — 自身 a1 step1 と同一 atom`,
        `// BUG-123: テキストは「【黄】のキャラ」。kind:'character' が無いと remove の【黄】イベントも候補化する。`,
        hiraHead,
        `  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { color: '黄', kind: 'character' } }, n: { min: 0, max: 1 }, chooser: 'self' } } },`,
        `  description: ${desc},`,
        `  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],`,
        `};`,
      ].join('\n');
    case 'c-ap1000':
    case 'c-ap2000': {
      const delta = tpl === 'c-ap1000' ? 1000 : 2000;
      return [
        `// ${name}: 【カットイン】AP＋${delta} (BUG-140 補修 2026-06-13: TSV cutIn 列の取りこぼし修正) — D08015 a2 同型`,
        cutinHead,
        `  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: ${delta}, scope: 'contact' } },`,
        `  description: ${desc},`,
        `  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],`,
        `};`,
      ].join('\n');
    }
    case 'c-turnAP':
      return [
        `// ${name}: 【カットイン】【自分ターン中】AP＋1000 / 【相手ターン中】AP＋3000 (BUG-140 補修 2026-06-13) — B04096 a2 同型`,
        `// (コンタクト中はどちらか一方が必ず成立するため conditional if/else が意味等価 — rules/17 条件アイコン)`,
        cutinHead,
        `  effect: {`,
        `    kind: 'conditional',`,
        `    if: { kind: 'turn', player: 'self' },`,
        `    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },`,
        `    else: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 3000, scope: 'contact' } },`,
        `  },`,
        `  description: ${desc},`,
        `  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],`,
        `};`,
      ].join('\n');
  }
}

// ---- 5. パッチ適用 ----
const byFile = new Map<string, Task[]>();
for (const t of tasks) {
  const key = `${t.set}/${t.id}`;
  if (!byFile.has(key)) byFile.set(key, []);
  byFile.get(key)!.push(t);
}

let patched = 0;
let inherited = 0;
let deferred = 0;
const failures: string[] = [];

for (const [key, ts] of [...byFile.entries()].sort()) {
  const { set, id } = { set: key.split('/')[0]!, id: key.split('/')[1]! };
  if (DEFER.has(id)) {
    console.log(`DEFER     ${key}: ${ts.map((t) => t.icon).join(',')}`);
    deferred += ts.length;
    continue;
  }
  const file = resolve(ROOT, `src/cards/${set}/${id}.ts`);
  if (!existsSync(file)) {
    failures.push(`${key}: card file not found`);
    continue;
  }
  let src = readFileSync(file, 'utf8');

  const abilitiesMatch = src.match(/abilities:\s*\[([\s\S]*?)\]/);
  if (!abilitiesMatch) {
    // spread 再録: base が fix 対象なら継承で治る
    const spread = src.match(/\.\.\.([A-Za-z0-9]+)/);
    if (spread && fixIds.has(spread[1]!) && !DEFER.has(spread[1]!)) {
      console.log(`INHERIT   ${key}: <- ${spread[1]} (spread 再録、base 補修で自動継承)`);
      inherited += ts.length;
      continue;
    }
    failures.push(`${key}: no abilities array & not a spread of a fixed base (spread=${spread?.[1] ?? 'none'})`);
    continue;
  }

  // 既存 ability id の最大値 → 次の id
  const usedNums = [...src.matchAll(/\bid:\s*'a(\d+)'/g), ...src.matchAll(/\bconst a(\d+)\b/g)].map((m) => Number(m[1]));
  let next = (usedNums.length ? Math.max(...usedNums) : 0) + 1;

  const existing = abilitiesMatch[1]!
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const newNames: string[] = [];
  let blocks = '';
  let ok = true;
  for (const t of ts) {
    const tpl = classify(t);
    if (!tpl) {
      failures.push(`${key}: unclassified ${t.icon} text: ${t.text.slice(0, 50)}`);
      ok = false;
      continue;
    }
    const name = `a${next++}`;
    newNames.push(name);
    blocks += genAbility(name, tpl, t.text) + '\n\n';
    console.log(`PATCH     ${key}: +${name} (${tpl})`);
  }
  if (!ok || newNames.length === 0) continue;

  // import に AbilityDef が無ければ追加
  if (!/import type \{[^}]*AbilityDef/.test(src)) {
    if (/import type \{ CardDef \}/.test(src)) {
      src = src.replace(/import type \{ CardDef \}/, 'import type { AbilityDef, CardDef }');
    } else {
      failures.push(`${key}: cannot add AbilityDef import (unrecognized import shape)`);
      continue;
    }
  }

  // export const <ID>: CardDef の直前に const block を挿入
  const anchor = new RegExp(`export const ${id}: CardDef`);
  if (!anchor.test(src)) {
    failures.push(`${key}: anchor 'export const ${id}: CardDef' not found`);
    continue;
  }
  src = src.replace(anchor, `${blocks}export const ${id}: CardDef`);

  // abilities 配列へ追記
  src = src.replace(/abilities:\s*\[[\s\S]*?\]/, `abilities: [${[...existing, ...newNames].join(', ')}]`);

  if (WRITE) writeFileSync(file, src);
  patched += newNames.length;
}

console.log(
  `---\nmode=${WRITE ? 'WRITE' : 'dry-run'} tasks=${tasks.length} patched=${patched} inherited=${inherited} deferred=${deferred} failures=${failures.length}`,
);
for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length) process.exit(1);
