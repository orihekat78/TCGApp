// tests/cards/night-wB2/B05075 勝又力 — engine変更0 exemplar probe (WB2)
//
// engine 変更なし: 既存 primitive (phase:main:start hook / triggerPlayerIs / charRemoveSetCard bind /
//   conditional bound presence / charSetCard fromDeckTop faceUp:false / sleepSelf cost) の合成。
//
// a1: 自分メインフェイズ開始時、このキャラのセットカード1枚除去 → そうした場合 証拠1 (bind gate)。
// a2: 【宣言】【スリープ】自分デッキ上端を裏向きでこのキャラにセット。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { canPay } from '@/engine/cost/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { _peekPendingEffectOptionalSide, _clearPendingEffectOptionalSide } from '@/engine/effect/resolve-picks';
import { applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { makeChar } from '../../helpers/fixtures';
import { B05075 } from '@/cards/ct-p05/B05075';
import type { CardDef, GameState, SceneCharacter, AbilityDef } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  registerCardDef(B05075);
  registerCardDef(ch('SET1'));
  registerCardDef(ch('SET2'));
  registerCardDef(ch('DECKTOP'));
  registerCardDef(ch('DECK2'));
  registerTriggeredListener();
  setHuman('self');
});

function sceneUid(s: GameState, uid: string): SceneCharacter {
  return s.players.self.scene.find((c) => c.uid === uid)!;
}

// ============================================================
// shape
// ============================================================
describe('B05075 — shape (engine変更0)', () => {
  it('a1 phase:main:start chain[charRemoveSetCard bind, conditional evidenceGain] / a2 declared sleepSelf charSetCard fromDeckTop', () => {
    const [a1, a2] = B05075.abilities as AbilityDef[];
    expect(a1.trigger).toMatchObject({ hook: 'phase:main:start', matcherCondition: { kind: 'triggerPlayerIs', side: 'self' } });
    expect(a1.effect).toMatchObject({ kind: 'optional' }); // 「してもよい」= optional (T2 review 反映)
    expect(a2.cost).toMatchObject({ kind: 'sleepSelf' });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false } });
  });
});

// ============================================================
// a1 — main:start でセットカード除去 → 証拠1 (そうした場合 gate)
// ============================================================
describe('B05075 a1 — メインフェイズ開始時 セット除去→証拠1', () => {
  // optional 化 (T2 review BLOCK 反映): human 'self' で emit → surface した optional を optIn で解決。
  function fire(setCards: { cardId: string; faceUp: boolean }[], player: 'self' | 'opp' = 'self', optIn = true): GameState {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    let s = createEmptyGameState();
    s.turn = { number: 5, player, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [makeChar({ uid: 'k0', cardId: 'B05075', state: 'active', setCards })];
    s.players.self.deck = ['d1', 'd2'];
    return produce(s, (d) => {
      event.emit(d, 'phase:main:start', { player }, undefined);
      runAllUntilEmpty(d);
      const opt = _peekPendingEffectOptionalSide();
      if (opt) {
        applyOptionalAndContinuation(d, opt, optIn);
        _clearPendingEffectOptionalSide();
        runAllUntilEmpty(d);
      }
      for (let i = 0; i < 3; i++) { _drainAllEffectPicksForTest(d); runAllUntilEmpty(d); }
    });
  }

  it('「してもよい」decline (しない) → セット不変・証拠なし (rules/15)', () => {
    const s = fire([{ cardId: 'SET1', faceUp: false }], 'self', false);
    expect(sceneUid(s, 'k0').setCards.length, 'decline → セット維持').toBe(1);
    expect(s.players.self.evidence.length, 'decline → 証拠なし').toBe(0);
  });

  it('セット1枚 → 除去 + 証拠1 (そうした場合)', () => {
    const s = fire([{ cardId: 'SET1', faceUp: false }]);
    expect(sceneUid(s, 'k0').setCards.length, 'セット除去').toBe(0);
    expect(s.players.self.remove, 'セットカードはリムーブへ (表向き)').toContain('SET1');
    expect(s.players.self.evidence.length, '証拠1獲得').toBe(1);
  });

  it('セット無し → 除去も証拠も無し (そうした場合 gate)', () => {
    const s = fire([]);
    expect(s.players.self.evidence.length, 'セット無しなら証拠得ない').toBe(0);
  });

  it('セット2枚 → 1枚のみ除去 + 証拠1 (公式Q&A: 複数枚→1証拠 不可)', () => {
    const s = fire([{ cardId: 'SET1', faceUp: false }, { cardId: 'SET2', faceUp: false }]);
    expect(sceneUid(s, 'k0').setCards.length, '1枚のみ除去 (残1)').toBe(1);
    expect(s.players.self.evidence.length, '証拠1のみ').toBe(1);
  });

  it('相手ターンの main:start → 自分の a1 は不発 (triggerPlayerIs self)', () => {
    const s = fire([{ cardId: 'SET1', faceUp: false }], 'opp');
    expect(sceneUid(s, 'k0').setCards.length, 'opp ターン → 除去せず').toBe(1);
    expect(s.players.self.evidence.length, '証拠得ない').toBe(0);
  });
});

// ============================================================
// a2 — 【宣言】【スリープ】デッキ上端を裏向きでこのキャラにセット
// ============================================================
describe('B05075 a2 — declared: デッキ上端を裏向きセット + 自身スリープ', () => {
  function setup(): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [makeChar({ uid: 'k0', cardId: 'B05075', state: 'active', setCards: [] })];
    s.players.self.deck = ['DECKTOP', 'DECK2'];
    return s;
  }
  it('active → 宣言可 → DECKTOP を裏向きセット + k0 スリープ (cost)', () => {
    const s0 = setup();
    expect(canDeclaredAbility(s0, 'k0', 'a2')).toBe(true);
    const s = produce(s0, (d) => { activateDeclaredAbility(d, 'k0', 'a2', undefined); runAllUntilEmpty(d); });
    const k0 = sceneUid(s, 'k0');
    expect(k0.setCards.length, 'セット1枚追加').toBe(1);
    expect(k0.setCards[0], '裏向き (faceUp:false) の DECKTOP').toMatchObject({ cardId: 'DECKTOP', faceUp: false });
    expect(s.players.self.deck, 'DECKTOP はデッキから消える').not.toContain('DECKTOP');
    expect(read.char.state(s, 'k0'), 'cost sleepSelf で k0 スリープ').toBe('sleep');
  });
  it('スリープ状態では cost sleepSelf を支払えない (canPay=false、rules/21)', () => {
    const s0 = setup();
    s0.players.self.scene = [makeChar({ uid: 'k0', cardId: 'B05075', state: 'sleep', setCards: [] })];
    const cost = (B05075.abilities[1] as AbilityDef).cost!;
    const ctx = { source: { player: 'self', uid: 'k0', cardId: 'B05075', abilityId: 'a2', area: 'scene' }, bindings: {} } as unknown as import('@/engine/types').EffectCtx;
    expect(canPay(s0, cost, ctx), 'スリープ済 → sleepSelf 不能').toBe(false);
  });
});
