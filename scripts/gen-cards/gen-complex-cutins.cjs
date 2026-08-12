#!/usr/bin/env node
// scripts/gen-cards/gen-complex-cutins.cjs
// 複雑カットイン (条件付きドロー / 特徴スケーリング / 全リムーブ / アクティブ化 等) を
// cardId 別 decision table (PLAN) に基づき DSL へ翻訳して src/cards/<pkg>/<cardNum>.ts を生成。
// 集約 barrel: src/cards/_generated/complex-cutins.ts
//
// 「手書き判断」は PLAN テーブルに集約 (各 cardId の pattern + params)。メタ (level/ap/lp/
// traits/img/rarity) は cards-data TSV を権威ソースとして読む。再実行: node scripts/gen-cards/gen-complex-cutins.cjs
//
// engine 未対応 (verb / dyn root / 複数カットイン択一) は pattern:'deferred' で vanilla stub
// + DEFERRED コメントを出力 (カード自体は使用可、カットイン効果のみ未実装)。BUG 管理表で追跡。
//
// spec: .claude/specs/card-authoring-convention.md / card-condition-catalog.md

const fs = require('fs');
const path = require('path');
const { withCardsDataSnapshot } = require('../cards/official-api.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.resolve(process.env.CONAN_CARDS_DATA_DIR || path.join(ROOT, '.claude', 'specs', 'cards-data'));
const CARDS_DIR = path.join(ROOT, 'src', 'cards');
const SKIP_PKGS = new Set(['ct-d08', 'ct-d11']);

const sq = (s) => "'" + String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const norm = (s) => (s || '').replace(/\\n/g, '\n').trim();
// features/color 列は弾により区切りが '|' / ',' で混在する (BUG-115)。両方で分割。color は色文字抽出。
const traitsArr = (f) => (f || '').split(/[|,]/).map((t) => t.trim()).filter(Boolean);
const traitsLit = (f) => '[' + traitsArr(f).map(sq).join(', ') + ']';
const colorsArr = (c) => [...new Set(((c || '').match(/[青赤黄緑白黒]/g)) || [])];
const colorsLit = (c) => '[' + colorsArr(c).map(sq).join(', ') + ']';

// ---- cardId 別 実装計画 (手書き判断の集約) ----
const PLAN = {
  // partnerColor ゲート + AP+1000 + 事件が単色なら 1 ドロー
  '0516': { p: 'monoColorDraw', partner: '青', color: '青' },
  '0540': { p: 'monoColorDraw', partner: '緑', color: '緑' },
  '0570': { p: 'monoColorDraw', partner: '赤', color: '赤' },
  // 2 ドロー + 1 リムーブ (条件なし)
  '0085': { p: 'drawDiscard', draw: 2, discard: 1 },
  // 【自分ターン中】コンタクト中のすべてのキャラをリムーブ
  '0086': { p: 'removeAllContact' },
  // 【相手/自分ターン中】特徴キャラを1枚までアクティブに
  '0275': { p: 'activateTrait', turn: 'opp', trait: '少年探偵団' },
  '0594': { p: 'activateTrait', turn: 'opp', trait: '警察' },
  // 【自分ターン中】現場の特徴1枚につき AP+1000 (D08007 同型)
  '0593': { p: 'traitScale', trait: '警察' },
  '0813': { p: 'traitScale', trait: '喫茶ポアロ' },
  '0975': { p: 'traitScale', trait: '探偵' },
  // AP+1000 + コンタクト相手が指定の名/特徴なら 1 ドロー
  '0664': { p: 'contactDraw', names: ['服部平次', '服部平蔵', '遠山和葉'] },
  '0711': { p: 'contactDraw', traits: ['喫茶ポアロ'] },
  '0741': { p: 'contactDraw', names: ['白鳥任三郎'], traits: ['少年探偵団'] },
  // 【解決編】1ドロー + 黒キャラにカットインなら AP+1000
  '0483': { p: 'resolvedDrawColorAp', color: '黒' },
  // MVP 実装済 (D11013) と同 cardId → spread
  '0940': { p: 'spreadMvp', base: 'D11013', basePkg: 'ct-d11' },
  // engine gap → vanilla stub + DEFERRED
  '0291': { p: 'manual', reason: 'カットイン実装済 (BUG-114, 2026-06-07) — 手書き ct-p03/B03034.ts。$contact.targetUid(BUG-104)+charSetCard{player:opp,fromDeckTop} で engine変更0' },
  '0296': { p: 'manual', reason: 'カットイン実装済 (BUG-114, 2026-06-07) — 手書き ct-p03/B03039.ts。再生成で上書きしない (task-C charRemoveSetCard + side 分離で engine変更0 化)' },
  '0544': { p: 'manual', reason: 'カットイン実装済 (BUG-114, 2026-06-07) — 手書き ct-p05/B05040.ts。discard-bind dyn ($discarded.level) primitive 追加で実装' },
  '0893': { p: 'manual', reason: 'カットイン実装済 (BUG-114, 2026-06-07) — 手書き ct-p08/B08055(P).ts。discard-bind dyn ($discarded.ap) primitive 追加で実装' },
  '0671': { p: 'manual', reason: 'カットイン実装済 (BUG-114, 2026-06-07) — 手書き ct-p06/B06050(P).ts。複数カットイン択一=1 ability+choice{[conditional]}、choice-binding fix で $contact 保持。opt_b は event-traits data gate' },
};

// ---- 複雑カットイン候補の再分類 (effect 空 / cutIn 有 / 単純固定AP でない) ----
function classifyCutinSimple(cut) {
  return /^【カットイン】(【自分ターン中】)?AP＋(\d+)(（[^）]*）)?$/.test(cut);
}
function parseTsv(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = lines[0].split('\t');
  return lines.slice(1).map((l) => {
    const c = l.split('\t');
    const o = {};
    header.forEach((h, i) => (o[h] = c[i] ?? ''));
    return o;
  });
}
function collect() {
  const recs = [];
  const pkgs = fs.readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).filter((n) => !SKIP_PKGS.has(n)).sort();
  for (const pkg of pkgs) {
    const cf = path.join(DATA_DIR, pkg, 'character.tsv');
    if (!fs.existsSync(cf)) continue;
    for (const row of parseTsv(cf)) {
      const eff = norm(row.effect), cut = norm(row.cutIn), hir = norm(row.hirameki), hen = norm(row.henso);
      if (!eff && cut && !hir && !hen && !classifyCutinSimple(cut)) {
        recs.push({
          pkg, num: row.cardNum, id: row.cardId, title: row.title, color: row.color,
          level: row.level, ap: row.ap, lp: row.lp, traits: row.features, rarity: row.rarity, img: row.imagePath, cut,
        });
      }
    }
  }
  return recs;
}

function vkey(num) {
  const isPR = /^PR/.test(num) ? 1 : 0;
  const suf = /(P|Sec\d*)$/.test(num) ? 1 : 0;
  return [isPR, suf, num];
}
function pickBase(g) {
  return [...g].sort((a, b) => {
    const ka = vkey(a.num), kb = vkey(b.num);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2] < kb[2] ? -1 : 1;
  })[0];
}

// ---- 各 pattern の AbilityDef コード ----
const CUTIN_TRIGGER = `trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)`;
const AP_BYUID = (n) => `{ kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: ${n}, scope: 'contact' } }`;
const DRAW = (n) => `{ kind: 'atom', verb: 'draw', args: { player: 'self', n: ${n} } }`;

function abilityCode(rec, plan) {
  switch (plan.p) {
    case 'traitScale':
      return {
        imports: '',
        code: `const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  ${CUTIN_TRIGGER}
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  // 自分の現場の[${plan.trait}]1枚につき AP＋1000 (D08007 dyn 同型)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: { dyn: ${sq('$self.sceneTrait.' + plan.trait + ' * 1000')} }, scope: 'contact' } },
  description: ${sq(`【カットイン】【自分ターン中】自分の現場の[${plan.trait}]1枚につきAP＋1000`)},
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};`,
      };
    case 'drawDiscard':
      return {
        imports: '',
        code: `const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  ${CUTIN_TRIGGER}
  effect: {
    kind: 'sequence',
    steps: [
      // カードを${plan.draw}枚引く
      ${DRAW(plan.draw)},
      // 手札を${plan.discard}枚選びリムーブする
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: ${plan.discard} } },
    ],
  },
  description: ${sq(`【カットイン】カードを${plan.draw}枚引き、手札を${plan.discard}枚リムーブする。`)},
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/14-refresh.md'],
};`,
      };
    case 'monoColorDraw':
      return {
        imports: `import { caseMonoColor } from '../_shared/index.js';\n`,
        code: `const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  ${CUTIN_TRIGGER}
  condition: { kind: 'partnerColor', color: ${sq(plan.partner)} }, // 【パートナー${plan.partner}】
  effect: {
    kind: 'sequence',
    steps: [
      // AP＋1000
      ${AP_BYUID(1000)},
      // 自分の事件が【${plan.color}】以外の色を持たない場合、カードを1枚引く
      { kind: 'conditional', if: caseMonoColor(${sq(plan.color)}), then: ${DRAW(1)} },
    ],
  },
  description: ${sq(`【カットイン】【パートナー${plan.partner}】AP＋1000、事件が${plan.color}単色ならカードを1枚引く。`)},
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};`,
      };
    case 'contactDraw': {
      const filterParts = [];
      if (plan.names) filterParts.push(`names: [${plan.names.map(sq).join(', ')}]`);
      if (plan.traits) filterParts.push(`traits: [${plan.traits.map(sq).join(', ')}]`);
      const label = [...(plan.names || []).map((n) => `[${n}]`), ...(plan.traits || []).map((t) => `[${t}]`)].join('か');
      return {
        imports: `import { contactTargetMatches } from '../_shared/index.js';\n`,
        code: `const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  ${CUTIN_TRIGGER}
  effect: {
    kind: 'sequence',
    steps: [
      // AP＋1000
      ${AP_BYUID(1000)},
      // ${label}に【カットイン】した場合、カードを1枚引く
      { kind: 'conditional', if: contactTargetMatches({ ${filterParts.join(', ')} }), then: ${DRAW(1)} },
    ],
  },
  description: ${sq(`【カットイン】AP＋1000、${label}にカットインした場合カードを1枚引く。`)},
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};`,
      };
    }
    case 'removeAllContact':
      return {
        imports: '',
        code: `const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  ${CUTIN_TRIGGER}
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  effect: {
    kind: 'sequence',
    steps: [
      // コンタクト中のすべてのキャラ (相手側 → 自分側) をリムーブする
      { kind: 'atom', verb: 'sceneRemove', args: { uid: '$contact.targetUid', cause: 'effect' } },
      { kind: 'atom', verb: 'sceneRemove', args: { uid: '$contact.byUid', cause: 'effect' } },
    ],
  },
  description: '【カットイン】【自分ターン中】コンタクト中のすべてのキャラをリムーブする。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md'],
};`,
      };
    case 'activateTrait':
      return {
        imports: '',
        code: `const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  ${CUTIN_TRIGGER}
  condition: { kind: 'turn', player: ${sq(plan.turn)} }, // 【${plan.turn === 'opp' ? '相手' : '自分'}ターン中】
  // [${plan.trait}]のキャラを1枚まで選び、アクティブにする (side 既定 either, max:1=0可)
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, state: 'active', filter: { trait: ${sq(plan.trait)} } } },
  description: ${sq(`【カットイン】【${plan.turn === 'opp' ? '相手' : '自分'}ターン中】[${plan.trait}]のキャラを1枚までアクティブにする。`)},
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md'],
};`,
      };
    case 'resolvedDrawColorAp':
      return {
        imports: `import { contactTargetMatches } from '../_shared/index.js';\n`,
        code: `const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  ${CUTIN_TRIGGER}
  condition: { kind: 'caseStatus', status: '解決編' }, // 【解決編】(leading icon = 能力全体ゲート, rules/17)
  effect: {
    kind: 'sequence',
    steps: [
      // カードを1枚引く
      ${DRAW(1)},
      // 【${plan.color}】のキャラに【カットイン】する場合、AP＋1000
      { kind: 'conditional', if: contactTargetMatches({ colors: [${sq(plan.color)}] }), then: ${AP_BYUID(1000)} },
    ],
  },
  description: ${sq(`【カットイン】【解決編】カードを1枚引く。${plan.color}キャラにカットインする場合AP＋1000。`)},
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};`,
      };
    default:
      throw new Error('unknown pattern ' + plan.p);
  }
}

function genBase(rec, plan) {
  const { imports, code } = abilityCode(rec, plan);
  return `// cards/${rec.pkg}/${rec.num} ${rec.title} (キャラ) — auto-generated by scripts/gen-cards/gen-complex-cutins.cjs
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト(カットイン): ${rec.cut.replace(/\n/g, ' / ')}

import type { AbilityDef, CardDef } from '@/engine/types';
${imports}
${code}

export const ${rec.num}: CardDef = {
  id: ${sq(rec.num)},
  no: ${sq(`${rec.id}/${rec.num}`)},
  kind: 'character',
  names: [${sq(rec.title)}],
  colors: ${colorsLit(rec.color)},
  level: ${Number(rec.level) || 0},
  ap: ${Number(rec.ap) || 0},
  lp: ${Number(rec.lp) || 0},
  traits: ${traitsLit(rec.traits)},
  keywords: [],
  rarity: ${sq(rec.rarity)},
  imageUrl: ${sq(rec.img)},
  abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};
`;
}

function genDeferred(rec, plan) {
  return `// cards/${rec.pkg}/${rec.num} ${rec.title} (キャラ) — auto-generated by scripts/gen-cards/gen-complex-cutins.cjs
// rules: 09-cutin-disguise.md, 17-icons.md
//
// 公式テキスト(カットイン): ${rec.cut.replace(/\n/g, ' / ')}
//
// ⚠ DEFERRED (BUG-114): ${plan.reason}
//   → カード自体は vanilla キャラとして使用可。カットイン効果のみ未実装 (abilities:[])。

import type { CardDef } from '@/engine/types';

export const ${rec.num}: CardDef = {
  id: ${sq(rec.num)},
  no: ${sq(`${rec.id}/${rec.num}`)},
  kind: 'character',
  names: [${sq(rec.title)}],
  colors: ${colorsLit(rec.color)},
  level: ${Number(rec.level) || 0},
  ap: ${Number(rec.ap) || 0},
  lp: ${Number(rec.lp) || 0},
  traits: ${traitsLit(rec.traits)},
  keywords: [],
  rarity: ${sq(rec.rarity)},
  imageUrl: ${sq(rec.img)},
  abilities: [], // DEFERRED (BUG-114): カットイン効果は engine 未対応
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};
`;
}

function genSpread(rec, baseExport, basePkg, baseRarity) {
  const rel = `../${basePkg}/${baseExport}.js`;
  const rarityOverride = rec.rarity && rec.rarity !== baseRarity ? `, rarity: ${sq(rec.rarity)}` : '';
  return `// cards/${rec.pkg}/${rec.num} ${rec.title} (キャラ) — auto-generated; ${baseExport} の絵柄違い (同 cardId)
import type { CardDef } from '@/engine/types';
import { ${baseExport} } from '${rel}';

export const ${rec.num}: CardDef = {
  ...${baseExport},
  id: ${sq(rec.num)},
  no: ${sq(`${rec.id}/${rec.num}`)},
  imageUrl: ${sq(rec.img)}${rarityOverride},
};
`;
}

function main() {
  const recs = collect();
  const byId = {};
  for (const r of recs) (byId[r.id] = byId[r.id] || []).push(r);
  const generated = [];
  const counts = { feasible: 0, deferred: 0, spreadMvp: 0, variants: 0 };

  function emit(num, pkg, body) {
    const outDir = path.join(CARDS_DIR, pkg);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${num}.ts`), body, 'utf8');
    generated.push({ num, pkg });
  }

  for (const id of Object.keys(byId)) {
    const group = byId[id];
    const plan = PLAN[id];
    if (!plan) throw new Error(`no PLAN entry for complex cut-in cardId ${id} (${group[0].pkg}/${group[0].num})`);

    if (plan.p === 'spreadMvp') {
      for (const r of group) {
        emit(r.num, r.pkg, genSpread(r, plan.base, plan.basePkg, 'D')); // D11013 rarity='D'
        counts.spreadMvp++;
      }
      continue;
    }
    if (plan.p === 'manual') {
      // 手書き実装済 (BUG-114): ファイルは上書きせず barrel import にのみ含める。
      for (const r of group) generated.push({ num: r.num, pkg: r.pkg });
      counts.feasible++;
      continue;
    }
    const base = pickBase(group);
    const body = plan.p === 'deferred' ? genDeferred(base, plan) : genBase(base, plan);
    emit(base.num, base.pkg, body);
    if (plan.p === 'deferred') counts.deferred++; else counts.feasible++;
    for (const r of group) {
      if (r.num === base.num) continue;
      emit(r.num, r.pkg, genSpread(r, base.num, base.pkg, base.rarity));
      counts.variants++;
    }
  }

  generated.sort((a, b) => (a.pkg + a.num < b.pkg + b.num ? -1 : 1));
  const imports = generated.map((g) => `import { ${g.num} } from '../${g.pkg}/${g.num}.js';`).join('\n');
  const items = generated.map((g) => g.num);
  const arrLines = [];
  for (let i = 0; i < items.length; i += 8) arrLines.push('  ' + items.slice(i, i + 8).join(', ') + ',');
  const barrel = `// cards/_generated/complex-cutins — auto-generated by scripts/gen-cards/gen-complex-cutins.cjs
// ${generated.length} 件の複雑カットイン (条件付きドロー / スケーリング / 全リムーブ / アクティブ化 / DEFERRED stub)。手で編集しない。
import type { CardDef } from '@/engine/types';

${imports}

export const GENERATED_COMPLEX_CUTINS: CardDef[] = [
${arrLines.join('\n')}
];
`;
  const genDir = path.join(CARDS_DIR, '_generated');
  if (!fs.existsSync(genDir)) fs.mkdirSync(genDir, { recursive: true });
  fs.writeFileSync(path.join(genDir, 'complex-cutins.ts'), barrel, 'utf8');

  console.log(`[gen-complex-cutins] generated ${generated.length} files:`);
  console.log(`  feasible bases : ${counts.feasible}`);
  console.log(`  variant spreads: ${counts.variants}`);
  console.log(`  MVP spreads    : ${counts.spreadMvp}`);
  console.log(`  deferred stubs : ${counts.deferred}`);
  console.log(`[gen-complex-cutins] barrel: src/cards/_generated/complex-cutins.ts`);
}

withCardsDataSnapshot({ baseDir: DATA_DIR, read: () => main() });
