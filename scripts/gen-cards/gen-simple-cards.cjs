#!/usr/bin/env node
// scripts/gen-cards/gen-simple-cards.cjs
// cards-data の非MVP 全パッケージから「機械的に量産できる単純カード」3 種を
// src/cards/<pkg>/<cardNum>.ts として生成し、集約 barrel src/cards/_generated/simple-cards.ts を生成する。
//
//   1. simple cut-in (character)   : 【カットイン】[【自分ターン中】]AP＋N の固定値 3 shape
//   2. keyword-only (character)    : 【パートナー色】〚突撃/迅速〛 等、条件付きキーワードのみ
//   3. case no-ability             : 効果テキストが空の事件カード
//
// 複雑カットイン (条件付きドロー / スケーリング / リムーブ系) は手書き (本スクリプト対象外)。
// MVP (ct-d08 / ct-d11) は手書き済のためスキップ。同 cardId が MVP に在る場合は MVP base を spread。
//
// 再実行: node scripts/gen-cards/gen-simple-cards.cjs
// spec: .claude/specs/card-authoring-convention.md / card-condition-catalog.md

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, '.claude', 'specs', 'cards-data');
const CARDS_DIR = path.join(ROOT, 'src', 'cards');
const MVP_PKGS = ['ct-d08', 'ct-d11'];
const SKIP_PKGS = new Set(MVP_PKGS);
const KWS = ['迅速', '突撃[キャラ]', '突撃[事件]', '突撃', 'ブレット'];
const COLORS = '青赤黄緑白黒';

function sq(s) {
  return "'" + String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}
const norm = (s) => (s || '').replace(/\\n/g, '\n').trim();

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

// ---- MVP cardId -> {cardNum, pkg} (手書き済 base からの spread 用) ----
function buildMvpMap() {
  const map = {};
  for (const pkg of MVP_PKGS) {
    const dir = path.join(CARDS_DIR, pkg);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/^[A-Z]\d+\.ts$/.test(f)) continue;
      const txt = fs.readFileSync(path.join(dir, f), 'utf8');
      const m = txt.match(/no:\s*['"]([0-9A-Za-z]+)\/([0-9A-Za-z]+)['"]/);
      if (m) map[m[1]] = { cardNum: m[2], pkg };
    }
  }
  return map;
}

// ---- 分類 ----
function classifyCutin(cut) {
  const m = cut.match(/^【カットイン】(【自分ターン中】)?AP＋(\d+)(（[^）]*）)?$/);
  if (m) return { simple: true, selfTurn: !!m[1], delta: Number(m[2]) };
  return { simple: false };
}

// keyword line -> { ok, conds:[{kind,...}], kw } | null
function parseKeywordLine(line) {
  let s = line.trim();
  if (!s) return null;
  const conds = [];
  // strip leading condition icons 【...】
  let cm;
  while ((cm = s.match(/^【([^】]+)】/))) {
    const inner = cm[1];
    if (inner.startsWith('パートナー') && COLORS.includes(inner.slice(-1))) {
      conds.push({ kind: 'partnerColor', color: inner.slice(-1) });
    } else if (inner === '解決編' || inner === '事件編') {
      conds.push({ kind: 'caseStatus', status: inner });
    } else {
      return { ok: false }; // 未知条件 → keyword-only 扱いしない
    }
    s = s.slice(cm[0].length);
  }
  let kw = null;
  for (const k of KWS) {
    if (s.startsWith('〚' + k + '〛')) {
      kw = k;
      s = s.slice(('〚' + k + '〛').length);
      break;
    }
  }
  if (!kw) return { ok: false };
  s = s.replace(/^（[^）]*）/, '').trim();
  if (s !== '') return { ok: false };
  return { ok: true, conds, kw };
}

function collect() {
  const out = { cutin: [], keyword: [], caseNo: [] };
  const pkgs = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !SKIP_PKGS.has(n))
    .sort();
  for (const pkg of pkgs) {
    const dir = path.join(DATA_DIR, pkg);
    const cf = path.join(dir, 'character.tsv');
    if (fs.existsSync(cf)) {
      for (const row of parseTsv(cf)) {
        const eff = norm(row.effect), cut = norm(row.cutIn), hir = norm(row.hirameki), hen = norm(row.henso);
        const base = {
          pkg, num: row.cardNum, id: row.cardId, title: row.title, color: row.color,
          level: row.level, ap: row.ap, lp: row.lp, traits: row.features, rarity: row.rarity, img: row.imagePath,
        };
        if (!eff && cut && !hir && !hen) {
          const cc = classifyCutin(cut);
          if (cc.simple) out.cutin.push({ ...base, cut, delta: cc.delta, selfTurn: cc.selfTurn });
        } else if (eff && !cut && !hir && !hen) {
          const lines = eff.split('\n').map((l) => l.trim()).filter(Boolean);
          const parsed = lines.map(parseKeywordLine);
          if (parsed.length && parsed.every((p) => p && p.ok)) {
            out.keyword.push({ ...base, abilities: parsed, eff });
          }
        }
      }
    }
    const casef = path.join(dir, 'case.tsv');
    if (fs.existsSync(casef)) {
      for (const row of parseTsv(casef)) {
        if (!norm(row.effect)) {
          out.caseNo.push({
            pkg, num: row.cardNum, id: row.cardId, title: row.title, color: row.color,
            rarity: row.rarity, img: row.imagePath, df: row.difficultyFirst,
          });
        }
      }
    }
  }
  return out;
}

// features/color 列は弾により区切りが '|' と ',' で混在する (BUG-115)。両方で分割する。
// color は色文字 (青赤黄緑白黒) を直接抽出 (区切り無し連結 '青緑' にも対応)。
const traitsArr = (features) =>
  (features || '').split(/[|,]/).map((t) => t.trim()).filter(Boolean);
const traitsLit = (features) => '[' + traitsArr(features).map(sq).join(', ') + ']';
const colorsArr = (c) => [...new Set(((c || '').match(/[青赤黄緑白黒]/g)) || [])];
const colorsLit = (c) => '[' + colorsArr(c).map(sq).join(', ') + ']';
const KIND_JP = { character: 'キャラ', case: '事件' };

// ---- ファイル本体生成 ----
function cutinAbility(rec) {
  const cond = rec.selfTurn ? `\n  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】` : '';
  const desc = `【カットイン】${rec.selfTurn ? '【自分ターン中】' : ''}AP＋${rec.delta}`;
  return `const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)${cond}
  // ${desc} — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算 (D08015 a2 同型)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: ${rec.delta}, scope: 'contact' } },
  description: ${sq(desc)},
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};`;
}

function genCutinBase(rec) {
  return `// cards/${rec.pkg}/${rec.num} ${rec.title} (キャラ) — auto-generated by scripts/gen-cards/gen-simple-cards.cjs
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト(カットイン): ${rec.cut.replace(/\n/g, ' / ')}

import type { AbilityDef, CardDef } from '@/engine/types';

${cutinAbility(rec)}

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

function condLit(c) {
  if (c.kind === 'partnerColor') return `{ kind: 'partnerColor', color: ${sq(c.color)} }`;
  if (c.kind === 'caseStatus') return `{ kind: 'caseStatus', status: ${sq(c.status)} }`;
  throw new Error('unknown cond ' + JSON.stringify(c));
}

function keywordAbilities(rec) {
  // returns { usesShared:boolean, kwArrayLiteral:string, abilitiesCode:string[], abilitiesRefs:string[] }
  const bareKws = [];
  const abilityDefs = [];
  let idx = 0;
  let usesShared = false;
  for (const ab of rec.abilities) {
    idx++;
    const aid = `a${idx}`;
    const pc = ab.conds.find((c) => c.kind === 'partnerColor');
    const others = ab.conds.filter((c) => c.kind !== 'partnerColor');
    if (ab.conds.length === 0) {
      bareKws.push(ab.kw); // 無条件キーワード → keywords フィールドへ
      idx--;
      continue;
    }
    if (pc) {
      usesShared = true;
      const addl = others.length ? `, additionalCondition: ${others.length === 1 ? condLit(others[0]) : `{ kind: 'and', cs: [${others.map(condLit).join(', ')}] }`}` : '';
      abilityDefs.push(`  partnerColorKeyword({ color: ${sq(pc.color)}, kw: ${sq(ab.kw)}${addl}, abilityId: ${sq(aid)} })`);
    } else {
      // caseStatus 等のみ → inline continuous
      const cond = others.length === 1 ? condLit(others[0]) : `{ kind: 'and', cs: [${others.map(condLit).join(', ')}] }`;
      const condDesc = ab.conds.map((c) => (c.kind === 'partnerColor' ? `【パートナー${c.color}】` : `【${c.status}】`)).join('');
      abilityDefs.push(`  {
    id: ${sq(aid)},
    type: 'continuous',
    scope: 'on-scene',
    condition: ${cond},
    continuousModifier: { grantKeywords: () => [${sq(ab.kw)}] },
    description: ${sq(`${condDesc}〚${ab.kw}〛`)},
    ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
  }`);
    }
  }
  return { usesShared, bareKws, abilitiesCode: abilityDefs };
}

function genKeywordBase(rec) {
  const { usesShared, bareKws, abilitiesCode } = keywordAbilities(rec);
  const importShared = usesShared
    ? `import { partnerColorKeyword } from '../_shared/index.js';\n`
    : '';
  // keyword カードは partnerColorKeyword (戻り値 AbilityDef) か inline object literal のみで
  // 型注釈付き const を使わないため AbilityDef import は不要。
  const typeImport = `import type { CardDef } from '@/engine/types';`;
  return `// cards/${rec.pkg}/${rec.num} ${rec.title} (キャラ) — auto-generated by scripts/gen-cards/gen-simple-cards.cjs
// rules: 13-keywords.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト: ${rec.eff.replace(/\n/g, ' / ')}

${typeImport}
${importShared}
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
  keywords: [${bareKws.map(sq).join(', ')}],
  rarity: ${sq(rec.rarity)},
  imageUrl: ${sq(rec.img)},
  abilities: [
${abilitiesCode.join(',\n')}${abilitiesCode.length ? ',' : ''}
  ],
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};
`;
}

function genCaseBase(rec) {
  return `// cards/${rec.pkg}/${rec.num} ${rec.title} (事件) — auto-generated by scripts/gen-cards/gen-simple-cards.cjs
// rules: 01-victory-conditions.md, 06-card-types.md
//
// 能力テキストなしの事件カード。caseTraits は公式データに特徴列が無いため [] (推測補完しない / CLAUDE.md)。

import type { CardDef } from '@/engine/types';

export const ${rec.num}: CardDef = {
  id: ${sq(rec.num)},
  no: ${sq(`${rec.id}/${rec.num}`)},
  kind: 'case',
  names: [${sq(rec.title)}],
  colors: ${colorsLit(rec.color)},
  traits: [],
  rarity: ${sq(rec.rarity)},
  imageUrl: ${sq(rec.img)},
  caseLevel: ${Number(rec.df) || 7},
  caseTraits: [],
  abilities: [],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md'],
};
`;
}

// spread (絵柄違い / MVP base 共有)
function genSpread(rec, baseExport, basePkg, baseRarity, kindJp) {
  const rel = `../${basePkg}/${baseExport}.js`;
  const rarityOverride = rec.rarity && rec.rarity !== baseRarity ? `, rarity: ${sq(rec.rarity)}` : '';
  return `// cards/${rec.pkg}/${rec.num} ${rec.title} (${kindJp}) — auto-generated; ${baseExport} の絵柄違い (同 cardId)
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

// variant ソート: B-prefix を PR より優先、suffix 無し(base)を P/Sec より優先、cardNum 昇順
function variantSortKey(num) {
  const isPR = /^PR/.test(num) ? 1 : 0;
  const hasSuffix = /(P|Sec\d*)$/.test(num) ? 1 : 0;
  return [isPR, hasSuffix, num];
}
function pickBase(recs) {
  return [...recs].sort((a, b) => {
    const ka = variantSortKey(a.num), kb = variantSortKey(b.num);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2] < kb[2] ? -1 : ka[2] > kb[2] ? 1 : 0;
  })[0];
}

function main() {
  const mvp = buildMvpMap();
  const data = collect();
  const generated = []; // {num, pkg}
  const perCat = { cutin: 0, keyword: 0, caseNo: 0 };

  function emit(num, pkg, body) {
    const outDir = path.join(CARDS_DIR, pkg);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${num}.ts`), body, 'utf8');
    generated.push({ num, pkg });
  }

  function processCategory(recs, kindJp, genBase, catKey) {
    // group by cardId
    const byId = {};
    for (const r of recs) (byId[r.id] = byId[r.id] || []).push(r);
    for (const id of Object.keys(byId)) {
      const group = byId[id];
      if (mvp[id]) {
        // MVP base が存在 → 全 variant を MVP base から spread
        const base = mvp[id];
        for (const r of group) {
          emit(r.num, r.pkg, genSpread(r, base.cardNum, base.pkg, null, kindJp));
          perCat[catKey]++;
        }
      } else {
        const base = pickBase(group);
        emit(base.num, base.pkg, genBase(base));
        perCat[catKey]++;
        for (const r of group) {
          if (r.num === base.num) continue;
          emit(r.num, r.pkg, genSpread(r, base.num, base.pkg, base.rarity, kindJp));
          perCat[catKey]++;
        }
      }
    }
  }

  processCategory(data.cutin, 'キャラ', genCutinBase, 'cutin');
  processCategory(data.keyword, 'キャラ', genKeywordBase, 'keyword');
  processCategory(data.caseNo, '事件', genCaseBase, 'caseNo');

  // barrel
  generated.sort((a, b) => (a.pkg + a.num < b.pkg + b.num ? -1 : 1));
  const imports = generated.map((g) => `import { ${g.num} } from '../${g.pkg}/${g.num}.js';`).join('\n');
  const arrLines = [];
  const items = generated.map((g) => g.num);
  for (let i = 0; i < items.length; i += 8) arrLines.push('  ' + items.slice(i, i + 8).join(', ') + ',');
  const barrel = `// cards/_generated/simple-cards — auto-generated by scripts/gen-cards/gen-simple-cards.cjs
// ${generated.length} 件の単純カード (simple cut-in / keyword-only / case no-ability) を集約。手で編集しない。
import type { CardDef } from '@/engine/types';

${imports}

export const GENERATED_SIMPLE_CARDS: CardDef[] = [
${arrLines.join('\n')}
];
`;
  const genDir = path.join(CARDS_DIR, '_generated');
  if (!fs.existsSync(genDir)) fs.mkdirSync(genDir, { recursive: true });
  fs.writeFileSync(path.join(genDir, 'simple-cards.ts'), barrel, 'utf8');

  console.log(`[gen-simple-cards] generated ${generated.length} files:`);
  console.log(`  simple cut-in : ${perCat.cutin}`);
  console.log(`  keyword-only  : ${perCat.keyword}`);
  console.log(`  case no-ability: ${perCat.caseNo}`);
  console.log(`[gen-simple-cards] barrel: src/cards/_generated/simple-cards.ts`);
}

main();
