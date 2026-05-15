// Phase 8.7c: HeuristicPolicy.chooseGuard tests
//
// 仕様 (rules/07, rules/08):
//   - 候補 0 件 → null (passGuard)
//   - 最大 AP 候補 >= attacker AP → 最大 AP 候補 uid (ガード成功で attacker をリムーブ可)
//   - 全候補 AP < attacker AP → null (どうせ負けるならガード資源浪費しない)

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

/** stub ActionContext: chooseGuard は ax.byUid のみ参照する */
function makeAx(byUid: string): ActionContext {
  return {
    id: 'ax_test',
    byUid,
    byPlayer: byUid.startsWith('partner:opp') || byUid.endsWith(':opp') ? 'opp' : 'self',
    target: { kind: 'char', uid: 'dummy' },
    phase: 'guard-window',
    startedAt: { turn: 1, nano: 0 },
    cutInUsed: {},
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('P-SELF', { kind: 'partner', ap: 2000, lp: 2 }));
  registerCardDef(makeCard('P-OPP', { kind: 'partner', ap: 2000, lp: 2 }));
  registerCardDef(makeCard('CASE-SELF', { kind: 'case' }));
  registerCardDef(makeCard('CASE-OPP', { kind: 'case' }));
});

describe('HeuristicPolicy.chooseGuard', () => {
  it('returns null when there are no candidates', () => {
    const policy = new HeuristicPolicy({ seed: 'g' });
    const s = makeBaseState();
    const result = policy.chooseGuard!(s, makeAx('partner:self'), []);
    expect(result).toBe(null);
  });

  it('picks the highest-AP candidate when its AP >= attacker AP', () => {
    registerCardDef(makeCard('Weak', { ap: 1000, lp: 1 }));
    registerCardDef(makeCard('Strong', { ap: 3000, lp: 1 }));
    const policy = new HeuristicPolicy({ seed: 'g' });
    const s = produce(makeBaseState(), (draft) => {
      // attacker = self.partner (P-SELF, AP=2000)
      // defender = opp.scene のキャラ
      mutate.scene.enter(draft, 'opp','Weak', { active: true });
      mutate.scene.enter(draft, 'opp','Strong', { active: true });
    });
    // sceneの uid を取得
    const candidates = s.players.opp.scene.map((c) => ({ uid: c.uid, cardId: c.cardId }));
    const result = policy.chooseGuard!(s, makeAx('partner:self'), candidates);
    // Strong (AP 3000 >= attacker AP 2000) が選ばれる
    const strongUid = s.players.opp.scene.find((c) => c.cardId === 'Strong')!.uid;
    expect(result).toBe(strongUid);
  });

  it('returns null when no candidate can match attacker AP (lose anyway = save resources)', () => {
    registerCardDef(makeCard('Tiny', { ap: 500, lp: 1 }));
    registerCardDef(makeCard('Small', { ap: 1500, lp: 1 }));
    const policy = new HeuristicPolicy({ seed: 'g' });
    const s = produce(makeBaseState(), (draft) => {
      // attacker = self.partner (AP=2000)
      mutate.scene.enter(draft, 'opp','Tiny', { active: true });
      mutate.scene.enter(draft, 'opp','Small', { active: true });
    });
    const candidates = s.players.opp.scene.map((c) => ({ uid: c.uid, cardId: c.cardId }));
    const result = policy.chooseGuard!(s, makeAx('partner:self'), candidates);
    // どれも 2000 未満 → 諦めて passGuard
    expect(result).toBe(null);
  });

  it('uses attacker partner AP correctly (partner uid lookup)', () => {
    registerCardDef(makeCard('Match', { ap: 2000, lp: 1 }));
    const policy = new HeuristicPolicy({ seed: 'g' });
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'opp','Match', { active: true });
    });
    const candidates = s.players.opp.scene.map((c) => ({ uid: c.uid, cardId: c.cardId }));
    // attacker = partner:self (AP=2000), defender candidate AP=2000 → 引分でリムーブできる
    const result = policy.chooseGuard!(s, makeAx('partner:self'), candidates);
    const matchUid = s.players.opp.scene[0].uid;
    expect(result).toBe(matchUid);
  });

  it('picks tied highest-AP candidate (first found) deterministically', () => {
    registerCardDef(makeCard('A1', { ap: 2500, lp: 1 }));
    registerCardDef(makeCard('A2', { ap: 2500, lp: 1 }));
    const policy = new HeuristicPolicy({ seed: 'g' });
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'opp','A1', { active: true });
      mutate.scene.enter(draft, 'opp','A2', { active: true });
    });
    const candidates = s.players.opp.scene.map((c) => ({ uid: c.uid, cardId: c.cardId }));
    const result = policy.chooseGuard!(s, makeAx('partner:self'), candidates);
    // 同 AP は先に見つけた候補 (= candidates[0]) を採用
    expect(result).toBe(candidates[0].uid);
  });
});
