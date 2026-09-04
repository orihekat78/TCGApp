// Phase 8.8d: policy.applyMove + move-enumerator の ability cost 統合テスト
//
// rules: 21-declared-ability-cost.md
// 仕様:
//   - move-enumerator は cost.canPay=false な ability を candidates から除外
//   - applyMove は cost あり ability で cost.pay → flow.use* を atomic 実行

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { AbilityDef, CardDef, Cost, GameState } from '@/engine/types';

import { applyMove } from '@/ai/policy';
import { enumerateMoves } from '@/ai/move-enumerator';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id], colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1, ap: opts.ap ?? 1000, lp: opts.lp ?? 1000,
    traits: opts.traits ?? [], rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '', abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function declAbil(id: string, cost?: Cost) {
  return { id, name: id, type: 'declared' as const, description: '', cost };
}

function setupBase(): GameState {
  return produce(createEmptyGameState(), (d) => {
    mutate.partner.init(d, 'self', 'P-SELF');
    mutate.partner.init(d, 'opp', 'P-OPP');
    mutate.case.init(d, 'self', 'CASE-SELF', ['赤']);
    mutate.case.init(d, 'opp', 'CASE-OPP', ['青']);
    d.turn.player = 'self';
    d.turn.phase = 'main';
  });
}

beforeEach(() => {
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('P-SELF', { kind: 'partner', ap: 1500, lp: 2 }));
  registerCardDef(makeCard('P-OPP', { kind: 'partner', ap: 1500, lp: 2 }));
  registerCardDef(makeCard('CASE-SELF', { kind: 'case' }));
  registerCardDef(makeCard('CASE-OPP', { kind: 'case' }));
});

describe('Phase 8.8d: AI cost integration', () => {
  it('applyMove: cost-free declared ability → no cost pay, just flow.use', () => {
    registerCardDef(makeCard('NoCost', { abilities: [declAbil('a1')] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'NoCost', { active: true });
    });
    const uid = s.players.self.scene[0].uid;
    const after = produce(s, (d) => {
      applyMove(d, { kind: 'declaredAbility', uid, abilityId: 'a1' }, 'self');
    });
    // char は active のまま (sleepSelf cost 無し)
    expect(after.players.self.scene.find((c) => c.uid === uid)?.state).toBe('active');
    // log に declaredAbility 記録
    const lastLog = after.log[after.log.length - 1];
    expect(lastLog?.action).toBe('declaredAbility');
  });

  it('applyMove: sleepSelf cost declared ability → cost.pay sleeps char + flow.use runs', () => {
    const cost: Cost = { kind: 'sleepSelf' };
    registerCardDef(makeCard('SleepCost', { abilities: [declAbil('a1', cost)] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'SleepCost', { active: true });
    });
    const uid = s.players.self.scene[0].uid;
    const after = produce(s, (d) => {
      applyMove(d, { kind: 'declaredAbility', uid, abilityId: 'a1' }, 'self');
    });
    // cost.pay により char が sleep
    expect(after.players.self.scene.find((c) => c.uid === uid)?.state).toBe('sleep');
    // declaredAbility log は走った
    const lastLog = after.log[after.log.length - 1];
    expect(lastLog?.action).toBe('declaredAbility');
  });

  it('enumerateMoves: filters out ability when cost.canPay returns false (already sleeping)', () => {
    const cost: Cost = { kind: 'sleepSelf' };
    registerCardDef(makeCard('Slept', { abilities: [declAbil('a1', cost)] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'Slept', { active: false }); // already sleep → can't sleepSelf
    });
    const moves = enumerateMoves(s, 'self');
    // declaredAbility ('a1') が候補に含まれていないこと
    const declMoves = moves.filter((m) => m.kind === 'declaredAbility');
    expect(declMoves).toHaveLength(0);
  });

  it('enumerateMoves: cost-payable ability is included in candidates', () => {
    const cost: Cost = { kind: 'sleepSelf' };
    registerCardDef(makeCard('Active', { abilities: [declAbil('a1', cost)] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'Active', { active: true });
    });
    const moves = enumerateMoves(s, 'self');
    const declMoves = moves.filter((m) => m.kind === 'declaredAbility');
    expect(declMoves).toHaveLength(1);
    if (declMoves[0]?.kind === 'declaredAbility') {
      expect(declMoves[0].abilityId).toBe('a1');
    }
  });

  it('enumerates one canonical AI name independently of hidden deck order and applies it', () => {
    registerCardDef(makeCard('AI-NAME', { names: ['Alpha Target'] }));
    registerCardDef(makeCard('AI-ZETA', { names: ['Zeta Target'] }));
    const ability: AbilityDef = {
      id: 'a1', type: 'declared', scope: 'on-scene',
      effect: {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom', verb: 'declareName',
            args: { bind: 'named', domain: 'registered-character-card-name' },
          },
          { kind: 'atom', verb: 'noop', args: {} },
        ],
      },
      description: 'AI declares one registered character name', ruleRefs: [],
    };
    registerCardDef(makeCard('ZZ-AI-SOURCE', { names: ['ZZ Source'], abilities: [ability] }));
    const stateFor = (deck: string[]) => produce(setupBase(), draft => {
      mutate.scene.enter(draft, 'self', 'ZZ-AI-SOURCE', { active: true });
      draft.players.self.deck = deck;
    });
    const forward = stateFor(['AI-NAME', 'AI-ZETA']);
    const reverse = stateFor(['AI-ZETA', 'AI-NAME']);
    const uid = forward.players.self.scene[0]!.uid;
    const declaredMove = (state: GameState) => enumerateMoves(state, 'self').find(candidate => (
      candidate.kind === 'declaredAbility' && candidate.abilityId === 'a1'
    ));
    const forwardMove = declaredMove(forward);
    const reverseMove = declaredMove(reverse);
    expect(forwardMove?.kind === 'declaredAbility' ? forwardMove.declaredName : undefined)
      .toBe(reverseMove?.kind === 'declaredAbility' ? reverseMove.declaredName : undefined);
    expect(forwardMove).toMatchObject({
      kind: 'declaredAbility', uid, abilityId: 'a1', declaredName: 'Alpha Target',
    });

    const after = produce(forward, draft => applyMove(draft, forwardMove!, 'self'));
    expect(after.log.at(-1)?.action).toBe('declaredAbility');
  });
});
