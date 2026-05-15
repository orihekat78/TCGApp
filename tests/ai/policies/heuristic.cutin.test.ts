// Phase 8.7d: HeuristicPolicy.chooseCutIn unit tests
//
// rules: 08-contact.md (コンタクト中の行動) / 09-cutin-disguise.md (1コンタクト1枚)
//
// 仕様:
//   - candidates 空 → null (cutin スキップ)
//   - 自分のコンタクトキャラの AP が相手の AP 以上 → null (既に勝てるので不要)
//   - 自分の AP が相手より小さい → candidates[0] を返す (不利の挽回試行)
//   - ax.firstUid / secondUid / byUid から自分の uid を特定する

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
    id: 'ax_test',
    byUid,
    byPlayer,
    target: { kind: 'char', uid: secondUid === byUid ? firstUid : secondUid },
    phase: 'action-1',
    startedAt: { turn: 1, nano: 0 },
    cutInUsed: {},
    firstUid,
    secondUid,
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

describe('HeuristicPolicy.chooseCutIn', () => {
  it('returns null when there are no candidates', () => {
    const policy = new HeuristicPolicy({ seed: 'c' });
    registerCardDef(makeCard('Atk', { ap: 1000, lp: 1 }));
    registerCardDef(makeCard('Def', { ap: 1500, lp: 1 }));
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'Atk', { active: true });
      mutate.scene.enter(draft, 'opp', 'Def', { active: false });
    });
    const atkUid = s.players.self.scene[0].uid;
    const defUid = s.players.opp.scene[0].uid;
    const ax = makeAxForContact(atkUid, 'self', atkUid, defUid);
    const result = policy.chooseCutIn!(s, ax, 'self', []);
    expect(result).toBe(null);
  });

  it('returns null when my AP >= opponent AP (already winning, no need)', () => {
    const policy = new HeuristicPolicy({ seed: 'c' });
    registerCardDef(makeCard('StrongAtk', { ap: 2000, lp: 1 }));
    registerCardDef(makeCard('WeakDef', { ap: 1000, lp: 1 }));
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'StrongAtk', { active: true });
      mutate.scene.enter(draft, 'opp', 'WeakDef', { active: false });
    });
    const atkUid = s.players.self.scene[0].uid;
    const defUid = s.players.opp.scene[0].uid;
    const ax = makeAxForContact(atkUid, 'self', defUid, atkUid); // low AP = first
    const result = policy.chooseCutIn!(s, ax, 'self', ['CutA', 'CutB']);
    expect(result).toBe(null);
  });

  it('returns candidates[0] when my AP < opponent AP (losing → try cutin)', () => {
    const policy = new HeuristicPolicy({ seed: 'c' });
    registerCardDef(makeCard('WeakAtk', { ap: 800, lp: 1 }));
    registerCardDef(makeCard('StrongDef', { ap: 2000, lp: 1 }));
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'WeakAtk', { active: true });
      mutate.scene.enter(draft, 'opp', 'StrongDef', { active: false });
    });
    const atkUid = s.players.self.scene[0].uid;
    const defUid = s.players.opp.scene[0].uid;
    const ax = makeAxForContact(atkUid, 'self', atkUid, defUid); // low AP = first = attacker
    const result = policy.chooseCutIn!(s, ax, 'self', ['CutA', 'CutB']);
    expect(result).toBe('CutA');
  });

  it('correctly identifies player ownership via firstUid/secondUid (defender perspective)', () => {
    const policy = new HeuristicPolicy({ seed: 'c' });
    registerCardDef(makeCard('Atk', { ap: 2500, lp: 1 }));
    registerCardDef(makeCard('Def', { ap: 1000, lp: 1 }));
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'Atk', { active: true });
      mutate.scene.enter(draft, 'opp', 'Def', { active: false });
    });
    const atkUid = s.players.self.scene[0].uid;
    const defUid = s.players.opp.scene[0].uid;
    // defender opp の視点。attacker AP 2500 > defender AP 1000 → 不利 → cutin
    const ax = makeAxForContact(atkUid, 'self', defUid, atkUid); // low AP = first = defender
    const result = policy.chooseCutIn!(s, ax, 'opp', ['CutOpp']);
    expect(result).toBe('CutOpp');
  });
});
