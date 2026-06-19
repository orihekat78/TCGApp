// tests/ai/step-turn — Task3: stepTurn (playTurn の 1手駆動分解)
// stepTurn は playTurn ループの 1 反復を取り出したもの。UI (useOppTurnDriver) が
// 1手ずつ間に遅延を挟んで CPU を可視化するために使う。playTurn は stepTurn ループに再構成され、
// 「stepTurn を done まで反復した結果」==「playTurn の結果」(byte 等価) を本テストで pin する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState } from '@/engine/types';
import { playTurn, stepTurn, type AIPolicy } from '@/ai/policy';
import type { Move } from '@/ai/move-enumerator';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: opts.kind ?? 'character', names: opts.names ?? [id], colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1, ap: opts.ap ?? 1000, lp: opts.lp ?? 1000, traits: opts.traits ?? [],
    rarity: opts.rarity ?? 'C', imageUrl: opts.imageUrl ?? '', abilities: opts.abilities ?? [], ruleRefs: [], ...opts,
  };
}
function makeBaseState(): GameState {
  return produce(createEmptyGameState(), (draft) => {
    mutate.partner.init(draft, 'self', 'P-SELF');
    mutate.partner.init(draft, 'opp', 'P-OPP');
    mutate.case.init(draft, 'self', 'CASE-SELF', ['赤']);
    mutate.case.init(draft, 'opp', 'CASE-OPP', ['青']);
    draft.turn.player = 'self'; draft.turn.phase = 'main'; draft.turn.number = 1;
    draft.players.self.deck = Array.from({ length: 20 }, (_, i) => `s${i}`);
    draft.players.opp.deck = Array.from({ length: 20 }, (_, i) => `o${i}`);
  });
}
beforeEach(() => {
  event._resetRegistry(); _resetActionContexts(); _resetTargetExpanders(); _resetUidCounter(); resetDefRegistry();
  registerCardDef(makeCard('P-SELF', { kind: 'partner', lp: 2 }));
  registerCardDef(makeCard('P-OPP', { kind: 'partner', lp: 2 }));
  registerCardDef(makeCard('CASE-SELF', { kind: 'case' }));
  registerCardDef(makeCard('CASE-OPP', { kind: 'case' }));
});

class EndTurnFirst implements AIPolicy {
  readonly name = 'endTurnFirst';
  choose(_s: GameState, cs: Move[]): Move | null { return cs.find((m) => m.kind === 'endTurn') ?? null; }
}
class FirstMove implements AIPolicy {
  readonly name = 'first';
  choose(_s: GameState, cs: Move[]): Move | null { return cs[0] ?? null; }
}

function runViaStep(s0: GameState, makePolicy: () => AIPolicy): { moves: Move[]; finalState: GameState } {
  let s = s0; const moves: Move[] = []; const policy = makePolicy();
  for (let i = 0; i < 300; i++) {
    const step = stepTurn(s, policy, 'self');
    s = step.nextState;
    if (step.paused) break;
    if (step.move) moves.push(step.move);
    if (step.done) break;
  }
  return { moves, finalState: s };
}

describe('stepTurn', () => {
  it('endTurn を選ぶと done=true + move.kind=endTurn (state 不変)', () => {
    const s = makeBaseState();
    const step = stepTurn(s, new EndTurnFirst(), 'self');
    expect(step.done).toBe(true);
    expect(step.move?.kind).toBe('endTurn');
  });

  it('非 endTurn 手では done=false で 1 手だけ前進する', () => {
    const s = makeBaseState();
    const step = stepTurn(s, new FirstMove(), 'self');
    expect(step.move).not.toBeNull();
    expect(step.move?.kind).not.toBe('endTurn');
    expect(step.done).toBe(false);
    expect(step.nextState).not.toBe(s); // state 前進
  });

  it('stepTurn ループ結果 == playTurn 結果 (moves 列 + finalState byte 等価)', () => {
    for (const makePolicy of [() => new EndTurnFirst(), () => new FirstMove()]) {
      const s = makeBaseState();
      const viaStep = runViaStep(s, makePolicy);
      const viaPlay = playTurn(s, makePolicy(), 'self');
      expect(viaStep.moves.map((m) => m.kind)).toEqual(viaPlay.moves.map((m) => m.kind));
      expect(JSON.stringify(viaStep.finalState)).toBe(JSON.stringify(viaPlay.finalState));
    }
  });
});
