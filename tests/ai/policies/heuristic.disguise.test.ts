// Phase 8.7e: HeuristicPolicy.chooseDisguise unit tests
//
// rules: 09-cutin-disguise.md (変装: 手札の変装持ちキャラと入替)
//
// 仕様 (chooseCutIn と同形):
//   - candidates 空 → null
//   - 自 AP >= 敵 AP → null (既に勝てる)
//   - 自 AP < 敵 AP + candidates あり → candidates[0]

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState, ActionContext } from '@/engine/types';

import { HeuristicPolicy } from '@/ai/policies/heuristic';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id], colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    ap: opts.ap ?? 1000, lp: opts.lp ?? 1000,
    traits: opts.traits ?? [], rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '', abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function makeBaseState(): GameState {
  return produce(createEmptyGameState(), (draft) => {
    mutate.partner.init(draft, 'self', 'P-SELF');
    mutate.partner.init(draft, 'opp', 'P-OPP');
    mutate.case.init(draft, 'self', 'CASE-SELF', ['赤']);
    mutate.case.init(draft, 'opp', 'CASE-OPP', ['青']);
    draft.turn.player = 'self';
    draft.turn.phase = 'main';
  });
}

function makeAxForContact(byUid: string, byPlayer: 'self' | 'opp', firstUid: string, secondUid: string): ActionContext {
  return {
    id: 'ax_test', byUid, byPlayer,
    target: { kind: 'char', uid: secondUid === byUid ? firstUid : secondUid },
    phase: 'action-1',
    startedAt: { turn: 1, nano: 0 },
    cutInUsed: {},
    firstUid, secondUid,
  };
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

describe('HeuristicPolicy.chooseDisguise', () => {
  it('returns null when no candidates', () => {
    const policy = new HeuristicPolicy({ seed: 'd' });
    registerCardDef(makeCard('Atk', { ap: 1000 }));
    registerCardDef(makeCard('Def', { ap: 1500 }));
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'Atk', { active: true });
      mutate.scene.enter(draft, 'opp', 'Def', { active: false });
    });
    const atkUid = s.players.self.scene[0].uid;
    const defUid = s.players.opp.scene[0].uid;
    const ax = makeAxForContact(atkUid, 'self', atkUid, defUid);
    expect(policy.chooseDisguise!(s, ax, 'self', [])).toBe(null);
  });

  it('returns null when my AP >= opp AP', () => {
    const policy = new HeuristicPolicy({ seed: 'd' });
    registerCardDef(makeCard('StrongAtk', { ap: 2000 }));
    registerCardDef(makeCard('WeakDef', { ap: 1000 }));
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'StrongAtk', { active: true });
      mutate.scene.enter(draft, 'opp', 'WeakDef', { active: false });
    });
    const atkUid = s.players.self.scene[0].uid;
    const defUid = s.players.opp.scene[0].uid;
    const ax = makeAxForContact(atkUid, 'self', defUid, atkUid);
    expect(policy.chooseDisguise!(s, ax, 'self', ['DisgA'])).toBe(null);
  });

  it('returns candidates[0] when my AP < opp AP (try disguise to swap in stronger char)', () => {
    const policy = new HeuristicPolicy({ seed: 'd' });
    registerCardDef(makeCard('WeakAtk', { ap: 800 }));
    registerCardDef(makeCard('StrongDef', { ap: 2000 }));
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'WeakAtk', { active: true });
      mutate.scene.enter(draft, 'opp', 'StrongDef', { active: false });
    });
    const atkUid = s.players.self.scene[0].uid;
    const defUid = s.players.opp.scene[0].uid;
    const ax = makeAxForContact(atkUid, 'self', atkUid, defUid);
    expect(policy.chooseDisguise!(s, ax, 'self', ['DisgA', 'DisgB'])).toBe('DisgA');
  });

  it('defender perspective: chooses disguise when defender AP < attacker AP', () => {
    const policy = new HeuristicPolicy({ seed: 'd' });
    registerCardDef(makeCard('Atk', { ap: 2500 }));
    registerCardDef(makeCard('Def', { ap: 1000 }));
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'Atk', { active: true });
      mutate.scene.enter(draft, 'opp', 'Def', { active: false });
    });
    const atkUid = s.players.self.scene[0].uid;
    const defUid = s.players.opp.scene[0].uid;
    const ax = makeAxForContact(atkUid, 'self', defUid, atkUid);
    expect(policy.chooseDisguise!(s, ax, 'opp', ['DisgOpp'])).toBe('DisgOpp');
  });
});
