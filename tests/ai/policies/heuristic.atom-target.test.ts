// HeuristicPolicy.chooseAtomTarget — Phase 7-3 unit tests
// spec: .claude/plans/jiggly-watching-lake.md / Phase 7-3 design
//
// verb 別ヒューリスティック分岐の網羅:
//   - sceneRemove: 敵 AP 最高
//   - sceneSetState sleep/stun: 敵 active 最高 AP (sleep/stun 候補は除外)
//   - sceneSetState active: 自陣 sleep/stun 最高 AP
//   - charModifyAP +: 自陣 AP 最低 / -: 敵 AP 最高
//   - charModifyLP +: 自陣 LP 最高 / -: 敵 LP 最高
//   - 候補 0 件 / 未知 verb: null fallback

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState, Candidate } from '@/engine/types';
import { HeuristicPolicy } from '@/ai/policies/heuristic';

function makeCard(id: string, opts: { ap?: number; lp?: number } = {}): CardDef {
  return {
    id,
    name: id,
    type: 'character',
    levels: [1],
    colors: ['赤'],
    traits: [],
    ap: opts.ap ?? 1000,
    lp: opts.lp ?? 1,
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
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

function asCharCand(
  uid: string,
  cardId: string,
  player: 'self' | 'opp',
): Candidate {
  return { kind: 'char', uid, cardId, player };
}

function candsFromState(s: GameState): Candidate[] {
  const out: Candidate[] = [];
  for (const p of ['self', 'opp'] as const) {
    for (const c of s.players[p].scene) {
      out.push(asCharCand(c.uid, c.cardId, p));
    }
  }
  return out;
}

describe('HeuristicPolicy.chooseAtomTarget', () => {
  let policy: HeuristicPolicy;

  beforeEach(() => {
    resetDefRegistry();
    _resetUidCounter();
    registerCardDef(makeCard('P-SELF', { ap: 2000, lp: 1 }));
    registerCardDef(makeCard('P-OPP', { ap: 2000, lp: 1 }));
    registerCardDef(makeCard('Weak', { ap: 1500, lp: 1 }));
    registerCardDef(makeCard('Mid', { ap: 3000, lp: 2 }));
    registerCardDef(makeCard('Strong', { ap: 5000, lp: 3 }));
    registerCardDef(makeCard('Ace', { ap: 1000, lp: 4 }));
    policy = new HeuristicPolicy({ seed: 'atom-target' });
  });

  it('returns null when no char candidates', () => {
    const s = makeBaseState();
    const result = policy.chooseAtomTarget!(s, 'sceneRemove', {}, [], 'self');
    expect(result).toBeNull();
  });

  it('returns null for non-char candidates only', () => {
    const s = makeBaseState();
    const result = policy.chooseAtomTarget!(s, 'sceneRemove', {}, [{ kind: 'partner', player: 'opp' }], 'self');
    expect(result).toBeNull();
  });

  describe('sceneRemove', () => {
    it('picks enemy char with highest AP', () => {
      const s = produce(makeBaseState(), (draft) => {
        mutate.scene.enter(draft, 'opp', 'Weak', { active: true });
        mutate.scene.enter(draft, 'opp', 'Strong', { active: true });
        mutate.scene.enter(draft, 'opp', 'Mid', { active: true });
      });
      const cands = candsFromState(s);
      const result = policy.chooseAtomTarget!(s, 'sceneRemove', {}, cands, 'self');
      expect(result).not.toBeNull();
      expect((result as Candidate & { kind: 'char' }).cardId).toBe('Strong');
    });

    it('ignores ally chars in candidate pool', () => {
      const s = produce(makeBaseState(), (draft) => {
        mutate.scene.enter(draft, 'self', 'Strong', { active: true });
        mutate.scene.enter(draft, 'opp', 'Weak', { active: true });
      });
      const cands = candsFromState(s);
      const result = policy.chooseAtomTarget!(s, 'sceneRemove', {}, cands, 'self');
      expect((result as Candidate & { kind: 'char' }).cardId).toBe('Weak');
    });
  });

  describe('sceneSetState sleep/stun', () => {
    it('picks enemy active char with highest AP, skipping sleeping enemy', () => {
      const s = produce(makeBaseState(), (draft) => {
        mutate.scene.enter(draft, 'opp', 'Weak', { active: true }); // 1500 active
        mutate.scene.enter(draft, 'opp', 'Strong', { active: false }); // 5000 sleep
        mutate.scene.enter(draft, 'opp', 'Mid', { active: true }); // 3000 active
      });
      const cands = candsFromState(s);
      const result = policy.chooseAtomTarget!(s, 'sceneSetState', { state: 'sleep' }, cands, 'self');
      expect((result as Candidate & { kind: 'char' }).cardId).toBe('Mid');
    });

    it('falls back to highest AP enemy when no active enemies', () => {
      const s = produce(makeBaseState(), (draft) => {
        mutate.scene.enter(draft, 'opp', 'Weak', { active: false });
        mutate.scene.enter(draft, 'opp', 'Strong', { active: false });
      });
      const cands = candsFromState(s);
      const result = policy.chooseAtomTarget!(s, 'sceneSetState', { state: 'stun' }, cands, 'self');
      expect((result as Candidate & { kind: 'char' }).cardId).toBe('Strong');
    });
  });

  describe('sceneSetState active', () => {
    it('picks downed ally with highest AP (re-activation)', () => {
      const s = produce(makeBaseState(), (draft) => {
        mutate.scene.enter(draft, 'self', 'Weak', { active: false });
        mutate.scene.enter(draft, 'self', 'Strong', { active: false });
        mutate.scene.enter(draft, 'self', 'Ace', { active: true });
      });
      const cands = candsFromState(s);
      const result = policy.chooseAtomTarget!(s, 'sceneSetState', { state: 'active' }, cands, 'self');
      expect((result as Candidate & { kind: 'char' }).cardId).toBe('Strong');
    });
  });

  describe('charModifyAP', () => {
    it('delta>0 picks ally with lowest AP (buff room)', () => {
      const s = produce(makeBaseState(), (draft) => {
        mutate.scene.enter(draft, 'self', 'Weak', { active: true });
        mutate.scene.enter(draft, 'self', 'Strong', { active: true });
      });
      const cands = candsFromState(s);
      const result = policy.chooseAtomTarget!(s, 'charModifyAP', { delta: 1000 }, cands, 'self');
      expect((result as Candidate & { kind: 'char' }).cardId).toBe('Weak');
    });

    it('delta<0 picks enemy with highest AP (debuff threat)', () => {
      const s = produce(makeBaseState(), (draft) => {
        mutate.scene.enter(draft, 'opp', 'Weak', { active: true });
        mutate.scene.enter(draft, 'opp', 'Strong', { active: true });
      });
      const cands = candsFromState(s);
      const result = policy.chooseAtomTarget!(s, 'charModifyAP', { delta: -1000 }, cands, 'self');
      expect((result as Candidate & { kind: 'char' }).cardId).toBe('Strong');
    });
  });

  describe('charModifyLP', () => {
    it('delta>0 picks ally with highest LP (reasoning ace)', () => {
      const s = produce(makeBaseState(), (draft) => {
        mutate.scene.enter(draft, 'self', 'Weak', { active: true }); // lp 1
        mutate.scene.enter(draft, 'self', 'Ace', { active: true });  // lp 4
      });
      const cands = candsFromState(s);
      const result = policy.chooseAtomTarget!(s, 'charModifyLP', { delta: 1 }, cands, 'self');
      expect((result as Candidate & { kind: 'char' }).cardId).toBe('Ace');
    });

    it('delta<0 picks enemy with highest LP', () => {
      const s = produce(makeBaseState(), (draft) => {
        mutate.scene.enter(draft, 'opp', 'Weak', { active: true });
        mutate.scene.enter(draft, 'opp', 'Ace', { active: true });
      });
      const cands = candsFromState(s);
      const result = policy.chooseAtomTarget!(s, 'charModifyLP', { delta: -1 }, cands, 'self');
      expect((result as Candidate & { kind: 'char' }).cardId).toBe('Ace');
    });
  });

  it('byPlayer=opp inverts ally/enemy interpretation', () => {
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'Weak', { active: true });
      mutate.scene.enter(draft, 'opp', 'Strong', { active: true });
    });
    const cands = candsFromState(s);
    // byPlayer='opp' で sceneRemove → enemy = 'self' 側を選ぶ
    const result = policy.chooseAtomTarget!(s, 'sceneRemove', {}, cands, 'opp');
    expect((result as Candidate & { kind: 'char' }).cardId).toBe('Weak');
  });

  it('returns null for unknown verb (caller falls back to first-pick)', () => {
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'opp', 'Strong', { active: true });
    });
    const cands = candsFromState(s);
    const result = policy.chooseAtomTarget!(s, 'unknownVerb', {}, cands, 'self');
    expect(result).toBeNull();
  });

  it('returns null for charModifyAP delta=0 (no direction)', () => {
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'opp', 'Strong', { active: true });
    });
    const cands = candsFromState(s);
    const result = policy.chooseAtomTarget!(s, 'charModifyAP', { delta: 0 }, cands, 'self');
    expect(result).toBeNull();
  });
});
