// engine-extension evidence 抑制 batch (2026-06-06 タスクC) — evidenceToDeck verb +
// optional 越しの $trigger.gained 引継ぎ + B03038 時津潤哉。
//
// 検証: 推理で得た証拠 (gained 枚) を「する」選択時に evidenceToDeck($trigger.gained) でデッキへ戻し、
//   net で「証拠を得ない」(rules/11 §LP≤0) を実現。draw 1 は行う。「しない」/ AI は通常どおり証拠を保持。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { doReasoning } from '@/engine/flow/main/reasoning';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyOptionalAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _peekPendingEffectOptionalSide, _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B03038 } from '@/cards/ct-p03/B03038';
import type { GameState, CardDef } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';

const REASONER: CardDef = {
  id: 'REASONER2', no: 'NO', kind: 'character', names: ['推理キャラ'], colors: ['緑'],
  level: 5, ap: 5000, lp: 2, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
function setHuman(side: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = side;
}
function build(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene = [sceneChar('B03038', 'tok#1'), sceneChar('REASONER2', 'r#1')];
  s.players.self.deck = ['e1', 'e2', 'draw1', 'rest']; // LP2 で e1/e2 証拠化、a1 draw で draw1
  s.players.self.evidence = [];
  return s;
}

describe('engine-extension evidence 抑制 batch (2026-06-06)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    registerCardDef(REASONER);
    _clearPendingEffectOptionalSide();
    _clearPendingEffectPickQueue();
    setHuman(null);
  });

  it('card def: turn:self + limit turn1 + triggerCharMatches{self,lpMin1} + optional(draw, suppress current reasoning evidence)', () => {
    expect(B03038.abilities[0].condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(B03038.abilities[0].trigger).toMatchObject({ hook: 'reasoning:after-sleep', matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { lpMin: 1 } } });
    const eff = B03038.abilities[0].effect as { kind: string; effect: { steps: { verb?: string; args?: { n?: unknown } }[] } };
    expect(eff.kind).toBe('optional');
    expect(eff.effect.steps[1]?.verb).toBe('charSetTurnEffect');
    expect(eff.effect.steps[1]?.args).toMatchObject({ key: 'suppressReasoningEvidence', val: true });
  });

  it('する: 推理で得た証拠2枚をデッキへ戻す (証拠を得ない) + 1ドロー', () => {
    setHuman('self');
    let s = build();
    s = produce(s, (d) => {
      doReasoning(d, 'r#1'); runAllUntilEmpty(d);          // LP2 → evidence=[e1,e2], gained=2
      const pending = _peekPendingEffectOptionalSide();
      expect(pending, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, pending!, true);
      runAllUntilEmpty(d);
    });
    expect(s.players.self.evidence.length, '証拠を得ない (evidence 0 に戻る)').toBe(0);
    expect(s.players.self.hand, 'draw occurs before this reasoning gains evidence').toContain('e1');
    expect(s.players.self.deck[0], 'evidence remains in deck because it was never gained').toBe('e2');
  });

  it('しない: 証拠はそのまま (2枚保持) / ドローなし', () => {
    setHuman('self');
    let s = build();
    s = produce(s, (d) => {
      doReasoning(d, 'r#1'); runAllUntilEmpty(d);
      const pending = _peekPendingEffectOptionalSide();
      applyOptionalAndContinuation(d, pending!, false);
      runAllUntilEmpty(d);
    });
    expect(s.players.self.evidence.length, 'しない → 証拠2枚保持').toBe(2);
    expect(s.players.self.hand, 'しない → ドローなし').not.toContain('draw1');
  });

  it('AI (humanChooser=false): optional skip → 証拠は通常どおり保持', () => {
    setHuman(null);
    const policy = new HeuristicPolicy();
    let s = build();
    s = produce(s, (d) => { doReasoning(d, 'r#1'); runAllUntilEmpty(d); drainAiEffectPicks(d, policy); });
    expect(_peekPendingEffectOptionalSide(), 'AI は optional を surface しない').toBeNull();
    expect(s.players.self.evidence.length, 'AI は証拠を保持 (2枚)').toBe(2);
  });
});
