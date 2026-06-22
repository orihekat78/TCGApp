/**
 * Task A 再分類サーベイ — 残カタログの決定的再構築 (2026-06-07)
 *
 * 元 workflow (2026-06-06 session #8) は signature を in-agent で計算したため非再現。
 * 本スクリプトは実データ (TSV カタログ + 実行時 ALL_CARDS) から
 *   1. 残カード (= カタログ - 実装済) を確定
 *   2. 保守的 signature でクラスタ化 (色/数値/名前のみ抽象化、機構テキストは温存)
 *   3. 既存 classification-partial.json の 240 verdict (rep cardNum 基準) と突合し、
 *      まだ分類されていない signature だけを抽出
 * を行い、分類 workflow への入力 remaining-to-classify.json を生成する。
 *
 * 出力: .claude/specs/catalog-survey-2026-06-06/remaining-to-classify.json
 * 使い方: npx tsx scripts/survey/build-remaining.ts
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_CARDS } from '@/cards/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = join(ROOT, '.claude', 'specs', 'cards-data');
const SURVEY_DIR = join(ROOT, '.claude', 'specs', 'catalog-survey-2026-06-06');

type Kind = 'character' | 'event' | 'case' | 'partner';
interface CatalogCard {
  cardNum: string;
  cardId: string;
  title: string;
  kind: Kind;
  pkg: string;
  color: string;
  level: string;
  ap: string;
  lp: string;
  features: string;
  effect: string;
  cutIn: string;
  hirameki: string;
  henso: string;
}

/** TSV を header 行基準で {col: value}[] に parse (列数差異に頑健)。 */
function parseTsv(path: string): Record<string, string>[] {
  const raw = readFileSync(path, 'utf8').replace(/\r/g, '');
  const lines = raw.split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

function loadCatalog(): CatalogCard[] {
  const pkgs = readdirSync(DATA_DIR).filter((d) => /^(ct-[dp]\d\d|pr-\d\d)$/.test(d));
  const out: CatalogCard[] = [];
  const kinds: Kind[] = ['character', 'event', 'case', 'partner'];
  for (const pkg of pkgs) {
    for (const kind of kinds) {
      const path = join(DATA_DIR, pkg, `${kind}.tsv`);
      if (!existsSync(path)) continue;
      for (const r of parseTsv(path)) {
        if (!r.cardNum) continue;
        out.push({
          cardNum: r.cardNum,
          cardId: r.cardId ?? '',
          title: r.title ?? '',
          kind,
          pkg,
          color: r.color ?? '',
          level: r.level ?? '',
          ap: r.ap ?? '',
          lp: r.lp ?? '',
          features: r.features ?? '',
          effect: r.effect ?? '',
          cutIn: r.cutIn ?? '',
          hirameki: r.hirameki ?? '',
          henso: r.henso ?? '',
        });
      }
    }
  }
  return out;
}

/**
 * 保守的 signature: 機構テキストは温存しつつ、色違い・数値違い・名前違いの
 * 同型再録だけをまとめる。over-merge を避けるため括弧種別は保持。
 *  - 数値 (半角/全角) → #
 *  - 色漢字 → ◆
 *  - ［...］ 内 (特徴/カード名) → ［・］
 *  - 全角空白除去
 */
function signature(c: CatalogCard): string {
  const body = [c.kind, c.effect, c.cutIn, c.hirameki, c.henso].join('');
  return body
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)) // 全角数字→半角
    .replace(/\d+/g, '#')
    .replace(/[赤青黄緑白黒]/g, '◆')
    .replace(/［[^］]*］/g, '［・］')
    .replace(/\s+/g, '')
    .trim();
}

function main() {
  const implemented = new Set(ALL_CARDS.map((c) => c.id));
  const catalog = loadCatalog();
  const remaining = catalog.filter((c) => !implemented.has(c.cardNum));

  // signature でクラスタ化
  const clusters = new Map<string, CatalogCard[]>();
  for (const c of remaining) {
    const sig = signature(c);
    (clusters.get(sig) ?? clusters.set(sig, []).get(sig)!).push(c);
  }

  // 既存 verdict (rep cardNum) を読む
  const partialPath = join(SURVEY_DIR, 'classification-partial.json');
  const partial = JSON.parse(readFileSync(partialPath, 'utf8'));
  const classifiedReps = new Set<string>();
  for (const bucket of ['green', 'yellow', 'black'] as const) {
    for (const v of partial[bucket] ?? []) classifiedReps.add(v.rep);
  }

  // 各クラスタが既存 verdict でカバーされているか
  const covered: { sig: string; rep: string; size: number; members: string[] }[] = [];
  const todo: {
    sig: string;
    rep: string;
    size: number;
    kind: Kind;
    members: string[];
    title: string;
    color: string;
    level: string;
    ap: string;
    lp: string;
    features: string;
    effect: string;
    cutIn: string;
    hirameki: string;
    henso: string;
  }[] = [];

  for (const [sig, members] of clusters) {
    const memNums = members.map((m) => m.cardNum);
    const hit = memNums.find((n) => classifiedReps.has(n));
    if (hit) {
      covered.push({ sig, rep: hit, size: members.length, members: memNums });
      continue;
    }
    // rep = cluster 最小 cardNum (決定的)
    const rep = [...members].sort((a, b) => a.cardNum.localeCompare(b.cardNum))[0];
    todo.push({
      sig,
      rep: rep.cardNum,
      size: members.length,
      kind: rep.kind,
      members: memNums,
      title: rep.title,
      color: rep.color,
      level: rep.level,
      ap: rep.ap,
      lp: rep.lp,
      features: rep.features,
      effect: rep.effect,
      cutIn: rep.cutIn,
      hirameki: rep.hirameki,
      henso: rep.henso,
    });
  }

  todo.sort((a, b) => b.size - a.size || a.rep.localeCompare(b.rep));

  const byKind = (arr: { kind?: Kind }[]) => {
    const m: Record<string, number> = {};
    for (const x of arr) m[x.kind ?? '?'] = (m[x.kind ?? '?'] ?? 0) + 1;
    return m;
  };
  const todoCards = todo.reduce((s, t) => s + t.size, 0);
  const coveredCards = covered.reduce((s, t) => s + t.size, 0);

  const out = {
    generatedFrom: 'scripts/survey/build-remaining.ts',
    catalogTotal: catalog.length,
    implemented: implemented.size,
    remainingCards: remaining.length,
    distinctSignatures: clusters.size,
    coveredByExistingVerdicts: { signatures: covered.length, cards: coveredCards },
    toClassify: {
      signatures: todo.length,
      cards: todoCards,
      byKind: byKind(todo),
    },
    todo,
  };
  const outPath = join(SURVEY_DIR, 'remaining-to-classify.json');
  writeFileSync(outPath, JSON.stringify(out, null, 1));

  // 人間向けサマリ (stderr)
  const e = console.error;
  e('=== Task A 再分類サーベイ: 残カタログ再構築 ===');
  e(`catalog total      : ${catalog.length}`);
  e(`implemented        : ${implemented.size}`);
  e(`remaining cards    : ${remaining.length}  byKind=${JSON.stringify(byKind(remaining))}`);
  e(`distinct signatures: ${clusters.size}`);
  e(`  covered (既存verdict): ${covered.length} sig / ${coveredCards} cards`);
  e(`  TO CLASSIFY        : ${todo.length} sig / ${todoCards} cards  byKind=${JSON.stringify(byKind(todo))}`);
  e(`top 15 unclassified clusters (size desc):`);
  for (const t of todo.slice(0, 15)) {
    e(`  ${t.rep} ×${t.size} [${t.kind}] ${t.title.slice(0, 20)} :: ${(t.effect || t.cutIn || t.hirameki).slice(0, 60)}`);
  }
  e(`\nwrote ${outPath}`);
}

main();
