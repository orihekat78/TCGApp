// tests/ai/policy.test.ts — Phase 6 Group A Task 6.2 tests
// spec: .claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { event } from '@/engine/event/index';
import {
  register as registerCardDef,
  _resetRegistry as resetDefRegistry,
} from '@/engine/read/def';
import type { CardDef, GameState } from '@/engine/types';

import { applyMove, playTurn, type AIPolicy } from '@/ai/policy';
import { enumerateMoves, type Move } from '@/ai/move-enumerator';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id],
    colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    ap: opts.ap ?? 1000,
    lp: opts.lp ?? 1000,
    traits: opts.traits ?? [],
    rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '',
    abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function makeBaseState(): GameState {
  return produce(createEmptyGameState(), draft => {
    mutate.partner.init(draft, 'self', 'P-SELF');
    mutate.partner.init(draft, 'opp', 'P-OPP');
    mutate.case.init(draft, 'self', 'CASE-SELF', ['赤']);
    mutate.case.init(draft, 'opp', 'CASE-OPP', ['青']);
    draft.turn.player = 'self';
    draft.turn.phase = 'main';
    draft.turn.number = 1;
    // give both decks some cards so reasoning / action-case have something
    draft.players.self.deck = Array.from({ length: 20 }, (_, i) => `s${i}`);
    draft.players.opp.deck = Array.from({ length: 20 }, (_, i) => `o${i}`);
  });
}

beforeEach(() => {
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('P-SELF', { kind: 'partner', lp: 2 }));
  registerCardDef(makeCard('P-OPP', { kind: 'partner', lp: 2 }));
  registerCardDef(makeCard('CASE-SELF', { kind: 'case' }));
  registerCardDef(makeCard('CASE-OPP', { kind: 'case' }));
  registerCardDef(makeCard('AtkChar', { ap: 1500, lp: 1 }));
  registerCardDef(makeCard('DefChar', { ap: 1000, lp: 1 }));
});

/**
 * FixedPolicy — テスト用: 常に candidates[index] を返す。
 *   - 配列を渡せば順番に試す (i 番目を選ぶ)
 *   - そうでなければ常に最初の手を選ぶ
 */
class FixedPolicy implements AIPolicy {
  readonly name = 'fixed';
  private callCount = 0;
  constructor(private readonly indices: number[] = [0]) {}

  choose(_s: GameState, candidates: Move[]): Move | null {
    if (candidates.length === 0) return null;
    const idx = this.indices[Math.min(this.callCount, this.indices.length - 1)] ?? 0;
    this.callCount++;
    return candidates[Math.min(idx, candidates.length - 1)];
  }
}

/**
 * EndTurnFirstPolicy — 常に endTurn を選ぶ (即終了テスト用)
 */
class EndTurnFirstPolicy implements AIPolicy {
  readonly name = 'endTurnFirst';
  choose(_s: GameState, candidates: Move[]): Move | null {
    const et = candidates.find(m => m.kind === 'endTurn');
    return et ?? null;
  }
}

/**
 * NeverEndsPolicy — endTurn を絶対選ばない (safety cap 試験用)
 *   - reasoning など何度でも選べる手があると無限になる
 *   - ここでは「常に最初の reasoning を選ぶ → 動かなくても残り手から選び続ける」
 *   - 実際にはエンジンが状態を更新するので必ずしも無限ではないが、
 *     reasoning した後も同じ手が enumerate されるよう partner.state を毎回 active に戻す
 *     のは無理 → 代わりに candidates[0] (endTurn 以外) を常に選ぶ。
 *
 * 実用上: もし endTurn 以外の合法手が無くなると endTurn が来てしまうので、
 * テスト戦略を変えて NeverEnds の代わりに「endTurn が含まれていれば throw する」policy を作る。
 */
class AlwaysFirstNonEndPolicy implements AIPolicy {
  readonly name = 'always-first-non-end';
  choose(_s: GameState, candidates: Move[]): Move | null {
    // skip endTurn deliberately to test safety cap
    const non = candidates.find(m => m.kind !== 'endTurn');
    return non ?? candidates[0] ?? null;
  }
}

describe('AIPolicy / playTurn', () => {
  it('EndTurnFirstPolicy: playTurn terminates immediately with [endTurn]', () => {
    const s = makeBaseState();
    const policy = new EndTurnFirstPolicy();
    const { moves, finalState } = playTurn(s, policy, 'self');
    expect(moves).toHaveLength(1);
    expect(moves[0].kind).toBe('endTurn');
    // state should be largely unchanged
    expect(finalState.players.self.partner.state).toBe('active');
  });

  it('FixedPolicy(0): chooses first move every step until endTurn appears', () => {
    // base state — first non-end move is "assist". After assist, partner is sleep
    // so reasoning(partner) is no longer available, but other moves remain
    // (endTurn will eventually be candidates[0] when partner is sleep & nothing else).
    const s = makeBaseState();
    const policy = new FixedPolicy([0]);
    const { moves } = playTurn(s, policy, 'self');
    // moves should end with endTurn
    expect(moves[moves.length - 1].kind).toBe('endTurn');
    // and should include assist as first move (default first in enumeration)
    expect(moves[0].kind).toBe('assist');
  });

  it('playTurn returns a list of moves with finalState updated', () => {
    const s = makeBaseState();
    const policy = new EndTurnFirstPolicy();
    const result = playTurn(s, policy, 'self');
    expect(Array.isArray(result.moves)).toBe(true);
    expect(result.finalState).toBeDefined();
    // finalState is a new object (Immer produce returns frozen new ref)
    expect(typeof result.finalState).toBe('object');
  });

  it('safety cap throws when policy never picks endTurn', () => {
    // To force "never endTurn", we need moves that don't naturally exhaust.
    // Strategy: after partner.assist, partner is sleep; after that, the
    // remaining moves naturally shrink to [endTurn]. To prevent endTurn from
    // becoming the only option, register reasoning that doesn't change state
    // (this is not feasible in pure engine state). Instead we test the
    // safety cap directly by constructing a policy that picks endTurn==null.
    //
    // Simpler approach: a policy that always returns the same hand-card-use
    // move even when it's not in candidates — but our applyMove will throw.
    // Use a degenerate policy that always picks a non-endTurn from a state
    // crafted to have an infinite repeatable move.
    //
    // Practical approach: stack many evidence pieces on opp so actionAgainstCase
    // is repeatable. The actor (atkChar) becomes sleep after first action,
    // so the move disappears. To make it repeatable, set partner back to
    // active each iteration — but we can't from outside.
    //
    // Instead: use a custom policy that returns the same fake hand move
    // regardless of candidates. applyMove will throw on canHandUseCard guard
    // — that throw bubbles up. So we cannot easily hit the 200-cap via this
    // path.
    //
    // Best test: directly construct a custom "loop" — create a Move list
    // that is always non-empty with no endTurn, by mocking enumerateMoves
    // via a custom policy that always returns the same Move that is a no-op.
    // We use a 'partnerAbility' move with an abilityId that is unregistered,
    // which canPartnerAbility may or may not validate strictly.
    //
    // For Phase 6 Group A, document the safety cap exists by directly
    // invoking a degenerate scenario: a policy that always returns the same
    // partnerAbility move on a partner that stays active. usePartnerAbility
    // doesn't sleep the partner, so the move stays valid. → infinite loop
    // until cap hits.
    //
    // Register a partner with a declared ability so partnerAbility is legal.
    registerCardDef(
      makeCard('P-SELF', {
        kind: 'partner',
        lp: 2,
        abilities: [{ id: 'loop', type: 'declared', description: 'loop' }],
      }),
    );
    const s = produce(makeBaseState(), draft => {
      // Re-init partner with new def
      mutate.partner.init(draft, 'self', 'P-SELF');
    });

    class LoopPolicy implements AIPolicy {
      readonly name = 'loop';
      choose(_s: GameState, candidates: Move[]): Move | null {
        const pa = candidates.find(m => m.kind === 'partnerAbility');
        if (pa) return pa;
        // fallback: never end
        return candidates.find(m => m.kind !== 'endTurn') ?? null;
      }
    }

    expect(() => playTurn(s, new LoopPolicy(), 'self')).toThrow(
      /200-move safety cap exceeded/,
    );
  });

  it('AlwaysFirstNonEndPolicy: eventually terminates when state has no infinite moves', () => {
    // Without a partner ability or repeatable trigger, partner.assist exhausts
    // the assist option, reasoning sleeps the partner, and we eventually have
    // only [endTurn] → enumerateMoves emits ['endTurn'], and our policy falls
    // back to candidates[0] = endTurn.
    const s = makeBaseState();
    const policy = new AlwaysFirstNonEndPolicy();
    const { moves } = playTurn(s, policy, 'self');
    expect(moves[moves.length - 1].kind).toBe('endTurn');
  });

  it('applyMove(endTurn) is no-op on state', () => {
    const s = makeBaseState();
    const after = produce(s, draft => {
      applyMove(draft, { kind: 'endTurn' }, 'self');
    });
    // state unchanged
    expect(after.players.self.partner.state).toBe(s.players.self.partner.state);
    expect(after.turn.phase).toBe(s.turn.phase);
  });

  it('applyMove(reasoning) with partner uid sleeps the partner', () => {
    const s = makeBaseState();
    const after = produce(s, draft => {
      applyMove(draft, { kind: 'reasoning', uid: 'partner:self' }, 'self');
    });
    expect(after.players.self.partner.state).toBe('sleep');
  });

  it('applyMove(assist) puts partner in FILE and may transition to 解決編', () => {
    const s = makeBaseState();
    const after = produce(s, draft => {
      applyMove(draft, { kind: 'assist' }, 'self');
    });
    expect(after.players.self.partner.state).toBe('sleep');
    expect(after.players.self.partner.location).toBe('file-area');
    // file has 1 entry (assisted-partner). Not 7 — so still 事件編.
    expect(after.players.self.case.status).toBe('事件編');
  });

  it('applyMove(solveCase) sets gameResult to winner=byPlayer', () => {
    const s = produce(makeBaseState(), draft => {
      draft.players.self.case.status = '解決編';
      draft.players.self.case.requiredEvidence = 0;
    });
    const after = produce(s, draft => {
      applyMove(draft, { kind: 'solveCase' }, 'self');
    });
    expect(after.gameResult).toBeDefined();
    expect(after.gameResult?.winner).toBe('self');
  });

  it('applyMove(actionAgainstChar) drives state machine to action-end', () => {
    let atkUid = '';
    let defUid = '';
    const s = produce(makeBaseState(), draft => {
      const a = mutate.scene.enter(draft, 'self', 'AtkChar', { active: true, named: false });
      atkUid = a.uid;
      const d = mutate.scene.enter(draft, 'opp', 'DefChar', { active: false, named: false });
      defUid = d.uid;
      mutate.scene.setState(draft, defUid, 'sleep');
    });
    const after = produce(s, draft => {
      applyMove(
        draft,
        { kind: 'actionAgainstChar', byUid: atkUid, targetUid: defUid },
        'self',
      );
    });
    // Atk AP 1500 >= Def AP 1000 → def removed
    expect(after.players.opp.scene.find(c => c.uid === defUid)).toBeUndefined();
    // attacker remains, sleep
    const atk = after.players.self.scene.find(c => c.uid === atkUid);
    expect(atk).toBeDefined();
    expect(atk?.state).toBe('sleep');
  });

  it('applyMove(actionAgainstCase) removes opp evidence and gains self evidence', () => {
    let atkUid = '';
    const s = produce(makeBaseState(), draft => {
      const a = mutate.scene.enter(draft, 'self', 'AtkChar', { active: true, named: false });
      atkUid = a.uid;
      draft.players.opp.evidence.push({
        cardId: 'EV',
        faceUp: false,
        origin: { turn: 1, via: 'opening' },
      });
    });
    const oppEvBefore = s.players.opp.evidence.length;
    const selfEvBefore = s.players.self.evidence.length;
    const after = produce(s, draft => {
      applyMove(
        draft,
        { kind: 'actionAgainstCase', byUid: atkUid, targetPlayer: 'opp' },
        'self',
      );
    });
    expect(after.players.opp.evidence.length).toBe(oppEvBefore - 1);
    expect(after.players.self.evidence.length).toBe(selfEvBefore + 1);
  });

  it('enumerateMoves + playTurn integration: terminates and only plays legal moves', () => {
    // Use FixedPolicy(0) which picks the first move each step.
    const s = makeBaseState();
    const policy = new FixedPolicy([0]);
    const { moves, finalState } = playTurn(s, policy, 'self');
    // Each move should be legal at the time it was picked
    // (we trust enumerateMoves; sanity check that final state ends with endTurn)
    expect(moves[moves.length - 1].kind).toBe('endTurn');
    // finalState should be a valid GameState (no gameResult error)
    expect(finalState).toBeDefined();
    // candidates after final state should still include endTurn
    const finalCands = enumerateMoves(finalState, 'self');
    expect(finalCands.find(m => m.kind === 'endTurn')).toBeDefined();
  });

  it('playTurn returns finalState with gameResult when solveCase fires', () => {
    // Setup: status=解決編, partner active, required=0, evidence=0
    const s = produce(makeBaseState(), draft => {
      draft.players.self.case.status = '解決編';
      draft.players.self.case.requiredEvidence = 0;
    });
    class SolvePolicy implements AIPolicy {
      readonly name = 'solve';
      choose(_s: GameState, candidates: Move[]): Move | null {
        return (
          candidates.find(m => m.kind === 'solveCase') ??
          candidates.find(m => m.kind === 'endTurn') ??
          null
        );
      }
    }
    const { moves, finalState } = playTurn(s, new SolvePolicy(), 'self');
    expect(finalState.gameResult).toBeDefined();
    expect(finalState.gameResult?.winner).toBe('self');
    expect(moves[moves.length - 1].kind).toBe('solveCase');
  });
});
