// tests/cards/night-wA4/B05007 妃英理 — Wave A 刈り取り card probe (2026-07-11)
//   a1 【登場時】optional{ sequence[ sceneSetState $self sleep, sceneEnter{hand,filterAny 工藤新一/毛利探偵事務所 Lv6},
//      draw ] } を実 engine 経路で駆動。核心 = 公式Q&A「登場0枚でも必ず1枚引く」→ sequence の独立 tail。
//   a2 【宣言】setActionCutinBanFilter arm (core mechanic は night-wA3/B05007-action-cutin-ban.test.ts が検証済 →
//      本 file は card 経由で filter が正しく arm されることのみ確認)。
// rules: 03 / 07 / 09 / 15 / 17 / 20 / 22

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B05007 } from '@/cards/ct-p05/B05007';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

const KUDO = 'KUDO_TEST';   // 手札の [工藤新一] Lv6 (filterAny 一致)
const MTJ = 'MTJ_TEST';     // 手札の [毛利探偵事務所] Lv6 (filterAny 一致)
const DECOY = 'DECOY_TEST'; // 非一致 (Lv7 [探偵]) — 候補にならない
const FILLER = 'FILLER_TEST'; // デッキ充填 (draw 用)

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerCardDef(B05007);
  registerCardDef(ch(KUDO, { names: ['工藤新一'], level: 6 }));
  registerCardDef(ch(MTJ, { names: ['毛利のむすめ'], level: 6, traits: ['毛利探偵事務所'] }));
  registerCardDef(ch(DECOY, { names: ['名探偵'], level: 7, traits: ['探偵'] }));
  registerCardDef(ch(FILLER, { names: ['山札'], level: 1 }));
  registerTriggeredListener();
});

function turnSelf(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

/** ability の effect を実 engine 経路で駆動 (optional は optionalRun=true で強制発火)。 */
function runA1(setup: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  turnSelf(s);
  s.players.self.scene = [sceneChar('B05007', 'eri#1')];
  setup(s);
  const ab = B05007.abilities.find((a) => a.id === 'a1')!;
  s = produce(s, (d) => {
    const ctx = {
      source: { player: 'self', cardId: 'B05007', uid: 'eri#1', abilityId: 'a1', area: 'scene' },
      bindings: {}, dyn: { optionalRun: true },
    } as unknown as EffectCtx;
    runEffect(d, ab.effect as never, ctx);
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    }
  });
  return s;
}

describe('B05007 a1 — 【登場時】optional sleep→hand登場+draw', () => {
  it('候補あり: 妃英理スリープ + 手札の[工藤新一]登場 + 1枚ドロー', () => {
    const s = runA1((st) => {
      st.players.self.hand = [KUDO];
      st.players.self.deck = [FILLER, FILLER, FILLER];
    });
    const eri = s.players.self.scene.find((c) => c.uid === 'eri#1')!;
    expect(eri.state, '妃英理はスリープ').toBe('sleep');
    expect(s.players.self.scene.some((c) => c.cardId === KUDO), '[工藤新一]が登場').toBe(true);
    expect(s.players.self.deck.length, 'デッキ -1 (ドロー)').toBe(2);
    expect(s.players.self.hand.includes(FILLER), 'ドロー分が手札に').toBe(true);
    expect(s.players.self.hand.includes(KUDO), '登場した工藤新一は手札から消える').toBe(false);
  });

  it('候補あり([毛利探偵事務所]): trait 一致で登場', () => {
    const s = runA1((st) => {
      st.players.self.hand = [MTJ];
      st.players.self.deck = [FILLER, FILLER];
    });
    expect(s.players.self.scene.some((c) => c.cardId === MTJ), '[毛利探偵事務所]が登場').toBe(true);
    expect(s.players.self.deck.length, 'デッキ -1').toBe(1);
  });

  it('公式Q&A: 候補ゼロ(非一致のみ)でも 妃英理スリープ + 必ず1枚ドロー (登場0枚)', () => {
    const s = runA1((st) => {
      st.players.self.hand = [DECOY];
      st.players.self.deck = [FILLER, FILLER];
    });
    const eri = s.players.self.scene.find((c) => c.uid === 'eri#1')!;
    expect(eri.state, '妃英理はスリープ').toBe('sleep');
    expect(s.players.self.scene.some((c) => c.cardId === DECOY), '非一致[探偵]は登場しない').toBe(false);
    expect(s.players.self.deck.length, '登場0枚でも draw は実行 (デッキ -1)').toBe(1);
    expect(s.players.self.hand.includes(FILLER), 'ドロー分が手札に').toBe(true);
  });
});

describe('B05007 a2 — 【宣言】setActionCutinBanFilter arm (card 経由)', () => {
  it('a2 effect を実行すると turnState.self.actionCutinBanOppFilter に {trait:毛利探偵事務所} が arm される', () => {
    let s = createEmptyGameState();
    turnSelf(s);
    s.players.self.scene = [sceneChar('B05007', 'eri#1')];
    const ab = B05007.abilities.find((a) => a.id === 'a2')!;
    s = produce(s, (d) => {
      const ctx = { source: { player: 'self', cardId: 'B05007', uid: 'eri#1', abilityId: 'a2', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
      runEffect(d, ab.effect as never, ctx);
    });
    expect(s.turnState.self.actionCutinBanOppFilter).toEqual({ trait: '毛利探偵事務所' });
  });
});
