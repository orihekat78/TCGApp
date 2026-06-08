/**
 * Task A 再分類サーベイ — 完走集約 (2026-06-07)
 *
 * classification-partial.json (元 session #8 の 240 sig 分類) +
 * classify-triage.json (本 session の残 411 sig 決定的 gate トリアージ) を
 * classification-complete.json に統合し、task D 優先度マップを再計算する。
 *
 * 出力:
 *   classification-complete.json — 全 651 sig (= 残カタログ全数) の verdict
 *   task-d-priority-map.json     — yellow 不足機能の cluster-weighted 集計
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude', 'specs', 'catalog-survey-2026-06-06');

function main() {
  const partial = JSON.parse(readFileSync(join(DIR, 'classification-partial.json'), 'utf8'));
  const triage = JSON.parse(readFileSync(join(DIR, 'classify-triage.json'), 'utf8'));

  // 元 240 (verifyReason 付き高信頼) と 新 411 (決定的 gate) を分けて保持
  const certifiedGreen = (partial.green ?? []).map((g: Record<string, unknown>) => ({ ...g, source: 'session#8-verified' }));
  const wave1Yellow = (partial.yellow ?? []).map((y: Record<string, unknown>) => ({ ...y, source: 'session#8-verified' }));
  const wave1Black = (partial.black ?? []).map((b: Record<string, unknown>) => ({ ...b, source: 'session#8-verified' }));

  const wave2Green = triage.greenCandidate.map((g: Record<string, unknown>) => ({ ...g, source: 'session#7-triage', certified: false }));
  const wave2Yellow = triage.yellow.map((y: Record<string, unknown>) => ({ ...y, source: 'session#7-triage' }));
  const wave2Black = triage.black.map((b: Record<string, unknown>) => ({ ...b, source: 'session#7-triage' }));

  const sumCards = (arr: { clusterSize?: number; size?: number }[]) =>
    arr.reduce((s, x) => s + (x.clusterSize ?? x.size ?? 1), 0);

  const complete = {
    meta: {
      generated: 'scripts/survey/finalize.ts (2026-06-07, inline 分類)',
      method:
        'wave1 = session#8 多エージェント workflow の 240 sig (verifyReason 付き、engine file:line 裏取り)。' +
        'wave2 = 本 session の残 411 sig を capability-map.txt の gate を決定的パターン化してトリアージ + 実 verb list 検証。' +
        'wave2 の greenCandidate は「既知 gate 未検出」= 実装時に card-addition-checklist + text-faithfulness Playwright で最終確認する候補 (個別 certify 済ではない)。',
      catalogRemaining: 1071,
      distinctSignatures: certifiedGreen.length + wave1Yellow.length + wave1Black.length + wave2Green.length + wave2Yellow.length + wave2Black.length,
    },
    counts: {
      certifiedGreen: { sig: certifiedGreen.length, cards: sumCards(certifiedGreen) },
      greenCandidate: { sig: wave2Green.length, cards: sumCards(wave2Green) },
      yellow: { sig: wave1Yellow.length + wave2Yellow.length, cards: sumCards(wave1Yellow) + sumCards(wave2Yellow) },
      black: { sig: wave1Black.length + wave2Black.length, cards: sumCards(wave1Black) + sumCards(wave2Black) },
    },
    certifiedGreen,
    greenCandidate: wave2Green,
    yellow: { wave1: wave1Yellow, wave2: wave2Yellow },
    black: { wave1: wave1Black, wave2: wave2Black },
  };
  writeFileSync(join(DIR, 'classification-complete.json'), JSON.stringify(complete, null, 1));

  // task D 優先度マップ: wave2 gateCounts (cluster-weighted) + wave1 _buckets を併記
  const wave1Buckets = JSON.parse(readFileSync(join(DIR, '_buckets.json'), 'utf8'));
  // wave2 を gate ラベル別に cards 重み集計
  const wave2ByGate: Record<string, { sig: number; cards: number }> = {};
  for (const y of wave2Yellow) {
    const k = (y.gate as string) ?? 'unlabeled';
    wave2ByGate[k] ??= { sig: 0, cards: 0 };
    wave2ByGate[k].sig += 1;
    wave2ByGate[k].cards += (y.size as number) ?? 1;
  }
  const priorityMap = {
    note: 'task D (engine 拡張) 優先度。wave2 = 本 session 決定的トリアージ (gate 別 sig/cards)。wave1 = session#8 の _buckets (cards 重み)。両者を合算して engine 機能の需要を見る。',
    wave2_gateDistribution: Object.fromEntries(
      Object.entries(wave2ByGate).sort((a, b) => b[1].cards - a[1].cards),
    ),
    wave1_buckets_cards: wave1Buckets,
  };
  writeFileSync(join(DIR, 'task-d-priority-map.json'), JSON.stringify(priorityMap, null, 1));

  const e = console.error;
  e('=== Task A 再分類サーベイ 完走集約 ===');
  e(`distinct signatures (残カタログ全数): ${complete.meta.distinctSignatures}`);
  e(`  🟢 certified green : ${complete.counts.certifiedGreen.sig} sig / ${complete.counts.certifiedGreen.cards} cards (wave1 検証済)`);
  e(`  🟢 green candidate : ${complete.counts.greenCandidate.sig} sig / ${complete.counts.greenCandidate.cards} cards (wave2 要最終確認)`);
  e(`  🟡 yellow          : ${complete.counts.yellow.sig} sig / ${complete.counts.yellow.cards} cards`);
  e(`  ⚫ black           : ${complete.counts.black.sig} sig / ${complete.counts.black.cards} cards`);
  e('wrote classification-complete.json + task-d-priority-map.json');
}
main();
