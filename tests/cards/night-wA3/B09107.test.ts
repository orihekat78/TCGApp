// tests/cards/night-wA3/B09107 犯人たちの犯行 (case) — engine A3 wave (2026-07-11)
//   新 primitive: removeDeckAll cost (〚デッキのカードをすべてリムーブする〛= n 固定でない全部リムーブ)。
//   他 primitive (evidenceFlip{all}/evidenceTraitAtLeast/cannotSolveCase/opponentLoses) は E3 P53 / E3増分1 出荷済
//   → 本 probe は removeDeckAll 単体 + B09107 a2 の production 統合 (cost→全表向き→犯人≥8→相手敗北) を検証。
// production dispatch: activateDeclaredAbility('case:self'/'case:opp') + runAllUntilEmpty (m2latter-deck-scene 準拠)。
// owner='opp' pin (case:opp + human opp)。BUG-117/118 decoy: 犯人以外の証拠を同居。
// rules: 01 (事件解決不可・alt-lose) / 14 (refresh) / 17 (継続能力) / 21 (コスト全部払えねば不可) / 25 (逐次).

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { event } from '@/engine/event/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { cost as engineCost } from '@/engine/cost/index';
import { canPayAtomically } from '@/engine/cost/pay';
import { B09107 } from '@/cards/ct-p09/B09107';
import type { CardDef, GameState, EffectCtx, EvidenceCard } from '@/engine/types';

const HAN = 'DEC_WA3_HAN';    // 特徴[犯人] character (evidence 用)
const OTHER = 'DEC_WA3_OTHER'; // 特徴[探偵] character (犯人 decoy)
const D = (i: number) => `DEC_WA3_D${i}`;

function ch(id: string, traits: string[]): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: [], level: 1, ap: 1000, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'effect' } });

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = v; };

const FIXTURES: CardDef[] = [
  B09107,
  ch(HAN, ['犯人']), ch(OTHER, ['探偵']),
  ...Array.from({ length: 12 }, (_, i) => ch(D(i), [])),
];

beforeEach(() => {
  event._resetRegistry();
  resetDefRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
  setHuman('self');
});

function base(opts: { side?: 'self' | 'opp'; status?: string; deck?: number; han?: number; other?: number } = {}): GameState {
  const side = opts.side ?? 'self';
  const s = createEmptyGameState();
  s.turn = { number: 6, player: side, phase: 'main', isFirstPlayerFirstTurn: false };
  const p = s.players[side];
  p.case.cardId = 'B09107';
  p.case.status = (opts.status ?? '解決編') as GameState['players']['self']['case']['status'];
  p.case.colors = ['黒'];
  p.deck = Array.from({ length: opts.deck ?? 5 }, (_, i) => D(i));
  const han = opts.han ?? 8;
  const other = opts.other ?? 0;
  p.evidence = [
    ...Array.from({ length: han }, () => ev(HAN)),
    ...Array.from({ length: other }, () => ev(OTHER)),
  ];
  return s;
}

// ─────────────────────── removeDeckAll cost 単体 (新 primitive)
describe('removeDeckAll cost', () => {
  const ctxOf = (side: 'self' | 'opp'): EffectCtx =>
    ({ source: { cardId: 'B09107', uid: `case:${side}`, abilityId: 'a2', player: side, area: 'case' }, bindings: {} } as EffectCtx);

  it('canPay は恒真 (デッキ5枚)', () => {
    expect(engineCost.canPay(base({ deck: 5 }), { kind: 'removeDeckAll', player: 'self' }, ctxOf('self'))).toBe(true);
  });
  it('canPay はデッキ0枚でも true (公式Q&A: 全部の残りは無し)', () => {
    expect(engineCost.canPay(base({ deck: 0 }), { kind: 'removeDeckAll', player: 'self' }, ctxOf('self'))).toBe(true);
  });
  // ★T2 review BLOCK 反映 (night-wA): 公式Q&A「リフレッシュはコストを支払った時点で行う」—
  //   pay が即時 refresh を発火する (rules/14: 相手証拠+1 + 痕跡 + reshuffle)。
  it('pay: デッキ全部リムーブ → 即時 refresh (reshuffle + 相手証拠+1、公式Q&A)', () => {
    const after = produce(base({ deck: 5 }), (d) => { engineCost.pay(d, { kind: 'removeDeckAll', player: 'self' }, ctxOf('self')); });
    expect(after.players.self.deck.length, 'refresh でリムーブ5枚がデッキへ戻る').toBe(5);
    expect(after.players.self.remove.length, 'リムーブ0').toBe(0);
    expect(after.players.opp.evidence.length, 'rules/14: 相手は証拠を1つ得る').toBe(1);
    expect(after.scratchTrace.opp, '相手 痕跡=発見済 (rules/13)').toBe('発見済');
  });
  it('pay: デッキ0枚 + リムーブ0枚 → refresh 不能 = 支払者敗北 (rules/14)', () => {
    const after = produce(base({ deck: 0 }), (d) => { engineCost.pay(d, { kind: 'removeDeckAll', player: 'self' }, ctxOf('self')); });
    expect(after.gameResult?.winner, 'リムーブ0で refresh 不能 → self 敗北').toBe('opp');
    expect(after.gameResult?.reason).toBe('deck-out');
  });
  it('pay: owner=opp は opp のデッキのみ触る (refresh も opp 側)', () => {
    const after = produce(base({ side: 'opp', deck: 4 }), (d) => { engineCost.pay(d, { kind: 'removeDeckAll', player: 'self' }, ctxOf('opp')); });
    expect(after.players.opp.deck.length, 'opp: refresh で4枚戻る').toBe(4);
    expect(after.players.opp.remove.length).toBe(0);
    expect(after.players.self.evidence.length, 'opp の refresh → self が証拠+1').toBe(1);
  });
  it('atomic preflight: owner=opp の removeDeckAll は opp のリムーブをrefreshして後続コストへ渡す', () => {
    const state = base({ side: 'opp', deck: 0 });
    state.players.opp.remove = [D(0), D(1)];
    expect(canPayAtomically(state, {
      kind: 'pay',
      items: [
        { kind: 'removeDeckAll', player: 'self' },
        { kind: 'removeDeckTop', player: 'self', n: 1 },
      ],
    }, ctxOf('opp'))).toBe(true);
  });
});

// ─────────────────────── B09107 a2 production 統合
describe('B09107 a2 — 【解決編】【宣言】〚デッキ全部リムーブ〛→ 証拠全表向き → 犯人≥8 で相手敗北', () => {
  it('犯人8枚 → cost で deck 全リムーブ + 証拠全表向き + opponentLoses (winner=self)', () => {
    const after = produce(base({ deck: 5, han: 8 }), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.deck.length, 'cost: 全リムーブ → 即時 refresh で5枚戻る (公式Q&A)').toBe(5);
    expect(after.players.self.remove.length, 'リムーブ0 (refresh 済)').toBe(0);
    expect(after.players.opp.evidence.length, 'refresh penalty: 相手証拠+1 (効果解決より前)').toBe(1);
    expect(after.players.self.evidence.every((e) => e.faceUp), '証拠すべて表向き').toBe(true);
    expect(after.gameResult?.winner, '犯人8枚 → 相手敗北 = self 勝利').toBe('self');
    expect(after.gameResult?.reason).toBe('alt-lose');
  });

  it('犯人7枚 (+探偵混在) → 全表向きするが敗北条件未達 (gameResult なし)', () => {
    const after = produce(base({ deck: 3, han: 7, other: 3 }), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.evidence.every((e) => e.faceUp), '証拠は表向きになる').toBe(true);
    expect(after.gameResult, '犯人7枚 → 相手敗北しない').toBeUndefined();
  });

  it('犯人以外が混在しても犯人だけ計数して8枚 → 敗北 (公式Q&A)', () => {
    const after = produce(base({ deck: 2, han: 8, other: 4 }), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2');
      runAllUntilEmpty(d);
    });
    expect(after.gameResult?.winner, '犯人8 + 探偵4 → 犯人だけ数えて成立').toBe('self');
  });

  it('owner=opp (case:opp, human opp): opp が宣言 → opp 側で解決 + winner=opp (BUG-174 pin)', () => {
    setHuman('opp');
    const after = produce(base({ side: 'opp', deck: 5, han: 8 }), (d) => {
      activateDeclaredAbility(d, 'case:opp', 'a2');
      runAllUntilEmpty(d);
    });
    expect(after.players.opp.deck.length, 'opp デッキ全リムーブ → refresh で5枚戻る').toBe(5);
    expect(after.players.opp.evidence.every((e) => e.faceUp), 'opp 証拠表向き').toBe(true);
    expect(after.gameResult?.winner, 'opp の相手 = self が敗北 → winner=opp').toBe('opp');
  });

  it('gate: 事件編 → 宣言不可 (【解決編】condition)', () => {
    expect(canDeclaredAbility(base({ status: '事件編' }), 'case:self', 'a2')).toBe(false);
    expect(canDeclaredAbility(base({ status: '解決編' }), 'case:self', 'a2')).toBe(true);
  });

  it('【ターン1】: 2回目の宣言は不可', () => {
    const s = base({ deck: 5, han: 8 });
    activateDeclaredAbility(s, 'case:self', 'a2');
    runAllUntilEmpty(s);
    expect(canDeclaredAbility(s, 'case:self', 'a2'), '【ターン1】消費済').toBe(false);
  });
});

// ─────────────────────── a1 cannotSolveCase (E3 P53、shape 確認のみ)
describe('B09107 a1 — 自分は【事件解決】できない (continuous cannotSolveCase)', () => {
  it('a1 shape', () => {
    const a1 = B09107.abilities[0];
    expect(a1.type).toBe('continuous');
    expect(a1.continuousModifier?.cannotSolveCase).toBe(true);
  });
});
