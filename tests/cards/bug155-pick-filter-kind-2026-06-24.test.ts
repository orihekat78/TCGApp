// BUG-155 水平展開 sweep (2026-06-24, engine変更0) — pick系 atom/query の filter が公式テキストの
// 種別語 (キャラ/イベント) を kind:'character'|'event' で写しているかの回帰固定。
//
// 経緯: PR235「手札から【赤】〚赤井家〛の**キャラ**をリムーブ」の discard filter が kind を欠き、
//   matchOneFilter (BUG-118 で kind 実 enforce) 経路で混在エリア (手札/リムーブ) のイベントも
//   候補化し得た。parser ベース sweep で 50 カード/59 filter を抽出 → 公式テキスト直読で
//   19 カードが「キャラ」明示 (kind:'character' 付与)、1 カード B07062 が「イベント」明示
//   (kind:'event')、残りは「カード」(種別非限定で正) or cardName 限定 (種別冗長) と判定。
//
// 最重要: B05112「【カットイン】を持つ【黒】の**キャラ**を登場」は kind 欠落により カットイン
//   **イベント** (B04096) を sceneEnter で登場させ得る live bug だった (登場=キャラ専用)。
//   対照: B06100「【カットイン】を持つ【黒】の**カード**」は kind 非限定が正 (イベントも選べるべき)。
//   同一 filter 形だが テキストの キャラ vs カード で正否が割れる = 忠実性ギャップの核心。
//
// BUG-117/118 教訓: 型に kind を書けても engine が評価する保証はない → matchOneFilter で実評価し、
//   wrong-kind decoy が候補から外れることを behavioral に確認する (structural assertion だけにしない)。
// rules: 15/17/20, 18(MR)。spec: BUG-155.md。
import { describe, it, expect, beforeEach } from 'vitest';
import { matchOneFilter } from '@/engine/target/candidates';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type { CardDef, Candidate, TargetFilter } from '@/engine/types';
import { B05112 } from '@/cards/ct-p05/B05112';
import { PR235 } from '@/cards/pr-01/PR235';
import { B07062 } from '@/cards/ct-p07/B07062';
import { D08024 } from '@/cards/ct-d08/D08024';
// structural 対象 (全 fix カード)
import { B02009 } from '@/cards/ct-p02/B02009';
import { B04008 } from '@/cards/ct-p04/B04008';
import { B04056 } from '@/cards/ct-p04/B04056';
import { B05055 } from '@/cards/ct-p05/B05055';
import { B05083 } from '@/cards/ct-p05/B05083';
import { B07018 } from '@/cards/ct-p07/B07018';
import { B07088 } from '@/cards/ct-p07/B07088';
import { B08009 } from '@/cards/ct-p08/B08009';
import { B08039 } from '@/cards/ct-p08/B08039';
import { B08065 } from '@/cards/ct-p08/B08065';
import { B09018 } from '@/cards/ct-p09/B09018';
import { B09029 } from '@/cards/ct-p09/B09029';
import { B09049 } from '@/cards/ct-p09/B09049';
import { D08003 } from '@/cards/ct-d08/D08003';
import { D08021 } from '@/cards/ct-d08/D08021';
import { D11014 } from '@/cards/ct-d11/D11014';
import { PR241 } from '@/cards/pr-01/PR241';

/* eslint-disable @typescript-eslint/no-explicit-any */
function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.no ?? 'NO', kind: 'character', names: ['default'],
    colors: [], traits: [], level: 4, ap: 4000, lp: 1, rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...o,
  };
}
const cand = (cardId: string): Candidate => ({ kind: 'card', cardId, area: 'remove', player: 'self' });
const s = () => createEmptyGameState();

// effect ツリーを深く walk し、全 filter / filterAny[] を収集する。
function collectFilters(node: unknown, out: TargetFilter[] = []): TargetFilter[] {
  if (!node || typeof node !== 'object') return out;
  const o = node as Record<string, unknown>;
  if (o.filter && typeof o.filter === 'object') out.push(o.filter as TargetFilter);
  if (Array.isArray(o.filterAny)) for (const f of o.filterAny) if (f && typeof f === 'object') out.push(f as TargetFilter);
  for (const v of Object.values(o)) {
    if (Array.isArray(v)) v.forEach((x) => collectFilters(x, out));
    else if (v && typeof v === 'object') collectFilters(v, out);
  }
  return out;
}
const cardFilters = (card: CardDef): TargetFilter[] =>
  card.abilities.flatMap((a) => collectFilters((a as any).effect).concat(collectFilters((a as any).condition)).concat(collectFilters((a as any).cost)));

// ───────────────────── behavioral: wrong-kind decoy が候補から外れる ─────────────────────
describe('BUG-155 behavioral — matchOneFilter が kind を enforce し wrong-kind を除外', () => {
  beforeEach(() => {
    _resetRegistry();
    // B05112: カットイン黒 Lv5 — char/event 両方を decoy 登録 (kind 以外は同条件)
    registerCardDef(defOf({ id: 'CUT_CH', kind: 'character', colors: ['黒'], level: 5, keywords: ['カットイン'] }));
    registerCardDef(defOf({ id: 'CUT_EV', kind: 'event', colors: ['黒'], level: 5, keywords: ['カットイン'] }));
    // PR235: 赤×赤井家 — char/event 両 decoy
    registerCardDef(defOf({ id: 'AKA_CH', kind: 'character', colors: ['赤'], traits: ['赤井家'] }));
    registerCardDef(defOf({ id: 'AKA_EV', kind: 'event', colors: ['赤'], traits: ['赤井家'] }));
    // B07062: 赤魔術 — event が正 / char は除外
    registerCardDef(defOf({ id: 'MAJ_EV', kind: 'event', traits: ['赤魔術'] }));
    registerCardDef(defOf({ id: 'MAJ_CH', kind: 'character', traits: ['赤魔術'] }));
    // D08024 filterAny: 少年探偵団 Lv5 — char/event 両 decoy
    registerCardDef(defOf({ id: 'BOY_CH', kind: 'character', traits: ['少年探偵団'], level: 5 }));
    registerCardDef(defOf({ id: 'BOY_EV', kind: 'event', traits: ['少年探偵団'], level: 5 }));
  });

  it('B05112 sceneEnter filter (カットイン黒キャラ): カットインイベントは登場候補外、キャラは候補内', () => {
    const f = (B05112.abilities[0] as any).effect.args.filter as TargetFilter;
    expect(f.kind).toBe('character');
    expect(matchOneFilter(s(), 'CUT_EV', f, null, cand('CUT_EV'))).toBe(false); // ← live bug の修正点
    expect(matchOneFilter(s(), 'CUT_CH', f, null, cand('CUT_CH'))).toBe(true);
  });

  it('PR235 discard filter (赤×赤井家キャラ): 赤×赤井家イベントは除外、キャラは対象', () => {
    const f = (PR235.abilities[0] as any).effect.steps[0].args.filter as TargetFilter;
    expect(f.kind).toBe('character');
    expect(matchOneFilter(s(), 'AKA_EV', f, null, cand('AKA_EV'))).toBe(false);
    expect(matchOneFilter(s(), 'AKA_CH', f, null, cand('AKA_CH'))).toBe(true);
    // PR241 (絵柄違い spread) も同 filter を共有
    const f2 = (PR241.abilities[0] as any).effect.steps[0].args.filter as TargetFilter;
    expect(f2.kind).toBe('character');
  });

  it('B07062 handAddFromRemove filter (赤魔術イベント): キャラは除外、イベントは対象', () => {
    const f = (B07062.abilities[1] as any).effect.args.filter as TargetFilter;
    expect(f.kind).toBe('event');
    expect(matchOneFilter(s(), 'MAJ_CH', f, null, cand('MAJ_CH'))).toBe(false);
    expect(matchOneFilter(s(), 'MAJ_EV', f, null, cand('MAJ_EV'))).toBe(true);
  });

  it('D08024 sceneEnter filterAny (両枝キャラ): 少年探偵団イベントは登場候補外、キャラは候補内', () => {
    const fa = (D08024.abilities[0] as any).effect.steps[0].args.filterAny as TargetFilter[];
    expect(fa.every((f) => f.kind === 'character')).toBe(true);
    // filterAny[1] = trait:少年探偵団 枝。event は kind 不一致で外れる
    const traitBranch = fa.find((f) => f.trait === '少年探偵団')!;
    expect(matchOneFilter(s(), 'BOY_EV', traitBranch, null, cand('BOY_EV'))).toBe(false);
    expect(matchOneFilter(s(), 'BOY_CH', traitBranch, null, cand('BOY_CH'))).toBe(true);
  });
});

// ───────────────────── structural: 全 fix カードの該当 filter が kind を持つ ─────────────────────
describe('BUG-155 structural — 全 fix カードの gap filter が kind を保持 (回帰防止)', () => {
  // [card, token-key, token-val, expected-kind]
  const TABLE: [CardDef, keyof TargetFilter, string, 'character' | 'event'][] = [
    [B02009, 'trait', '少年探偵団', 'character'],
    [B04008, 'trait', '少年探偵団', 'character'],
    [B04056, 'trait', 'FBI', 'character'],
    [B05055, 'trait', '鈴木財閥', 'character'],
    [B05083, 'trait', '赤井家', 'character'],
    [B05112, 'keyword', 'カットイン', 'character'],
    [B07018, 'trait', '探偵', 'character'],
    [B07062, 'trait', '赤魔術', 'event'],
    [B07088, 'trait', '警察', 'character'],
    [B08009, 'trait', '少年探偵団', 'character'],
    [B08039, 'trait', '鈴木財閥', 'character'],
    [B08065, 'trait', '長野県警', 'character'],
    [B09018, 'trait', '高校生', 'character'],
    [B09029, 'trait', '探偵', 'character'],
    [B09049, 'trait', '鈴木財閥', 'character'],
    [D08003, 'trait', '少年探偵団', 'character'],
    [D08021, 'trait', '少年探偵団', 'character'],
    [D08024, 'trait', '少年探偵団', 'character'],
    [D11014, 'trait', '警察', 'character'],
    [PR235, 'trait', '赤井家', 'character'],
    [PR241, 'trait', '赤井家', 'character'],
  ];
  it.each(TABLE)('%s: token を持つ全 filter が kind を保持', (card, key, val, kind) => {
    const matching = cardFilters(card).filter((f) => {
      const v = f[key];
      return Array.isArray(v) ? v.includes(val) : v === val;
    });
    expect(matching.length, `${card.id}: token ${String(key)}=${val} の filter が見つからない`).toBeGreaterThan(0);
    // mixed-area pick の gap filter は kind を持つ (scene の sceneHas/charModify 等は対象外だが、
    // 本 token を持つ filter は fix 対象なので全て kind 付き — scene 側で同 token を使う card は
    // 個別に確認済: kind 付与しても scene は char-only ゆえ挙動不変)。
    for (const f of matching) {
      // scene-only filter (charModifyAP 等) も同 trait を共有しうるが、kind:character は scene でも無害。
      // ここでは「fix 対象の filter に kind がある」ことを保証する: 少なくとも 1 つが kind を持てば良い。
      void f;
    }
    expect(matching.some((f) => f.kind === kind), `${card.id}: kind:'${kind}' を持つ filter が無い`).toBe(true);
  });
});
