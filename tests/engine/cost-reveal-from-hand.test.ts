// engine additive wave — Cost `revealFromHand`。
// 宣言コスト〚手札から filter 一致カードを N 枚公開する〛(B08093 灰原哀＆シェリー a1)。
// 公開は zone 変化なし (公式Q&A B08093: コスト支払い完了→効果解決時に手札へ戻してよい)。
// removeFromHand と同型の canPay (candidates ≥ n) だが pay() は no-op = presence-check cost。
// 既存カードは revealFromHand 未使用 → 回帰0 (additive)。
//
// 検証:
//   §1 canPay=true  — hand に filter 一致 ≥ n。
//   §2 canPay=false — filter 一致が n 未満。
//   §3 canPay=false — hand にカードはあるが filter 不一致 (0枚)。
//   §4 pay no-op    — pay 後 hand 不変 (公開のみ、リムーブしない) / remove 増えない。
//   §5 pay-nest     — `pay` 複合コスト内でも no-op。
//   §6 再宣言可能   — pay 後もカードが手札に残り同 cost を再 canPay できる (消費なし)。
// rules: 21-declared-ability-cost.md (コスト「自分の」省略), 15/25 (cost→effect 解決順)
// spec: .claude/specs/engine-additive-handreveal-design.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { canPay } from '@/engine/cost/evaluate';
import { pay } from '@/engine/cost/pay';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, EffectCtx, Cost } from '@/engine/types';

function pchar(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors, level: 3, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

const ctxBare = (): EffectCtx => ({ source: { cardId: 'X', uid: 'u-x', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx);

const COST = (n: number): Cost => ({
  kind: 'revealFromHand',
  target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { color: '青' } }, n: { min: 1, max: 1 }, chooser: 'self' },
  n,
} as unknown as Cost);

function handState(hand: string[]): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn.player = 'self';
    d.players.self.hand = hand;
  });
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  registerCardDef(pchar('BLUE1', ['青']));
  registerCardDef(pchar('BLUE2', ['青']));
  registerCardDef(pchar('RED1', ['赤']));
});

describe('revealFromHand §1-3 — canPay gating (filter 一致 ≥ n)', () => {
  it('§1a hand=[青,青,赤] → canPay(n=1)=true', () => {
    expect(canPay(handState(['BLUE1', 'BLUE2', 'RED1']), COST(1), ctxBare())).toBe(true);
  });
  it('§1b hand=[青,青] → canPay(n=2)=true', () => {
    expect(canPay(handState(['BLUE1', 'BLUE2']), COST(2), ctxBare())).toBe(true);
  });
  it('§2 hand=[青,赤] → canPay(n=2)=false (青1枚のみ)', () => {
    expect(canPay(handState(['BLUE1', 'RED1']), COST(2), ctxBare())).toBe(false);
  });
  it('§3 hand=[赤] → canPay(n=1)=false (青 不一致0枚)', () => {
    expect(canPay(handState(['RED1']), COST(1), ctxBare())).toBe(false);
  });
});

describe('revealFromHand §4-6 — pay no-op (公開のみ、消費なし)', () => {
  it('§4 pay 後 hand 不変 / remove 増えない', () => {
    const s = handState(['BLUE1', 'RED1']);
    const after = produce(s, (d) => { pay(d, COST(1), ctxBare()); });
    expect(after.players.self.hand).toEqual(['BLUE1', 'RED1']); // 公開のみ = zone 変化なし
    expect(after.players.self.remove.length).toBe(0);
  });

  it('§5 pay-nest (`pay` 複合コスト内) でも no-op', () => {
    const s = handState(['BLUE1', 'BLUE2']);
    const NESTED = { kind: 'pay', items: [COST(1)] } as unknown as Cost;
    const after = produce(s, (d) => { pay(d, NESTED, ctxBare()); });
    expect(after.players.self.hand).toEqual(['BLUE1', 'BLUE2']);
    expect(after.players.self.remove.length).toBe(0);
  });

  it('§6 pay 後も再 canPay 可能 (presence-check、消費されない)', () => {
    const s = handState(['BLUE1']);
    const after = produce(s, (d) => { pay(d, COST(1), ctxBare()); });
    expect(canPay(after, COST(1), ctxBare())).toBe(true); // カードが残るので再宣言可能
  });
});

// review concern (edge-test-adequacy) を反映: n>1 multi 契約 + pay の唯一の観測可能副作用 (paidItems) +
// trait filter 種別の被覆。
describe('revealFromHand §7-9 — review-concern 予防', () => {
  it('§7 n=2 multi: canPay(n=2)=true / pay で paidItems.ids 2件 / hand 不変', () => {
    const s = handState(['BLUE1', 'BLUE2', 'RED1']);
    expect(canPay(s, COST(2), ctxBare())).toBe(true);
    let res: { paidItems: { kind: string; details: unknown }[] } | undefined;
    const after = produce(s, (d) => { res = pay(d, COST(2), ctxBare()); });
    const ids = (res!.paidItems.find((p) => p.kind === 'revealFromHand')!.details as { ids: string[] }).ids;
    expect(ids.length).toBe(2); // 2枚公開を記録
    expect(after.players.self.hand).toEqual(['BLUE1', 'BLUE2', 'RED1']); // 消費なし
  });

  it('§8 pay は paidItems に kind=revealFromHand を積む (no-op の唯一の観測可能副作用)', () => {
    const s = handState(['BLUE1']);
    let res: { paidItems: { kind: string; details: unknown }[] } | undefined;
    produce(s, (d) => { res = pay(d, COST(1), ctxBare()); });
    expect(res!.paidItems.some((p) => p.kind === 'revealFromHand')).toBe(true);
  });

  it('§9 trait filter 版でも canPay/pay 動作 (filter は candidates へ委譲、色非依存)', () => {
    const TRAIT_COST: Cost = {
      kind: 'revealFromHand',
      target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { trait: '少年探偵団' } }, n: { min: 1, max: 1 }, chooser: 'self' },
      n: 1,
    } as unknown as Cost;
    resetDefRegistry();
    registerCardDef(pchar('DB1', ['青']));
    registerCardDef({ ...pchar('SDC1', ['赤']), traits: ['少年探偵団'] } as unknown as CardDef);
    expect(canPay(handState(['DB1']), TRAIT_COST, ctxBare())).toBe(false); // 特徴不一致
    expect(canPay(handState(['SDC1']), TRAIT_COST, ctxBare())).toBe(true);  // 少年探偵団 一致
  });
});
