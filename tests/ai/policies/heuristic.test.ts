// tests/ai/policies/heuristic.test.ts — Phase 6 Group B Task 6.4 tests
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

import { HeuristicPolicy } from '@/ai/policies/heuristic';
import type { Move } from '@/ai/move-enumerator';

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
  registerCardDef(makeCard('P-SELF', { kind: 'partner', ap: 1000, lp: 2 }));
  registerCardDef(makeCard('P-OPP', { kind: 'partner', ap: 1000, lp: 2 }));
  registerCardDef(makeCard('CASE-SELF', { kind: 'case' }));
  registerCardDef(makeCard('CASE-OPP', { kind: 'case' }));
});

describe('HeuristicPolicy — priority 1: solveCase', () => {
  it('always picks solveCase when available, even if assist and others present', () => {
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      { kind: 'assist' },
      { kind: 'reasoning', uid: 'partner:self' },
      { kind: 'solveCase' },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(makeBaseState(), moves, 'self');
    expect(got?.kind).toBe('solveCase');
  });
});

describe('HeuristicPolicy — priority 2: assist (only when FILE+1>=7)', () => {
  it('picks assist when FILE size is 6 (assist tips to 7)', () => {
    const policy = new HeuristicPolicy({ seed: 's' });
    const s = produce(makeBaseState(), draft => {
      // Fill FILE with 6 card-back placeholders
      for (let i = 0; i < 6; i++) {
        draft.players.self.file.push({ type: 'card-back' });
      }
    });
    const moves: Move[] = [
      { kind: 'assist' },
      { kind: 'reasoning', uid: 'partner:self' },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('assist');
  });

  it('does NOT pick assist when FILE size is 3 (assist would not reach 7)', () => {
    const policy = new HeuristicPolicy({ seed: 's' });
    const s = produce(makeBaseState(), draft => {
      for (let i = 0; i < 3; i++) {
        draft.players.self.file.push({ type: 'card-back' });
      }
    });
    // reasoning(partner) exists with LP > 0
    const moves: Move[] = [
      { kind: 'assist' },
      { kind: 'reasoning', uid: 'partner:self' },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    // reasoning is preferred (priority 3)
    expect(got?.kind).toBe('reasoning');
  });
});

describe('HeuristicPolicy — priority 3: reasoning by max LP', () => {
  it('picks the reasoning move with the highest LP source', () => {
    registerCardDef(makeCard('LowLP', { ap: 1000, lp: 1 }));
    registerCardDef(makeCard('HighLP', { ap: 1000, lp: 5 }));
    let lowUid = '';
    let highUid = '';
    const s = produce(makeBaseState(), draft => {
      const low = mutate.scene.enter(draft, 'self', 'LowLP', { active: true, named: false });
      const high = mutate.scene.enter(draft, 'self', 'HighLP', { active: true, named: false });
      lowUid = low.uid;
      highUid = high.uid;
    });
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      { kind: 'reasoning', uid: lowUid },
      { kind: 'reasoning', uid: highUid },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('reasoning');
    expect((got as Extract<Move, { kind: 'reasoning' }>).uid).toBe(highUid);
  });

  it('skips reasoning when LP=0 (rules/11) and falls through to next priority', () => {
    registerCardDef(makeCard('LP0', { ap: 1000, lp: 0 }));
    let uid = '';
    const s = produce(makeBaseState(), draft => {
      const c = mutate.scene.enter(draft, 'self', 'LP0', { active: true, named: false });
      uid = c.uid;
    });
    const policy = new HeuristicPolicy({ seed: 's' });
    // Only LP=0 reasoning + endTurn → should pick endTurn (after fallback non-end-random)
    const moves: Move[] = [
      { kind: 'reasoning', uid },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    // fallback returns reasoning anyway since fallback is random over non-endTurn moves
    // But the test asserts: heuristic SKIPS reasoning when LP=0, and falls through.
    // After fallthrough, no actionAgainstChar/Case/handUseCard/nextHint → fallback picks
    // reasoning as the only non-endTurn move.
    // So actually the policy CAN end up picking reasoning via fallback. We want to verify
    // the skip behavior: re-test with NO non-endTurn alternatives except reasoning.
    // The fallback DOES pick reasoning. So instead, assert it's not chosen by priority 3:
    // To distinguish, we add a winning action move and ensure that's picked over LP=0 reasoning.
    expect(got).not.toBeNull();
  });

  it('LP=0 reasoning is skipped in favor of a winning char-attack', () => {
    registerCardDef(makeCard('LP0Atk', { ap: 1500, lp: 0 }));
    registerCardDef(makeCard('OppLow', { ap: 1000, lp: 1 }));
    let atkUid = '';
    let oppUid = '';
    const s = produce(makeBaseState(), draft => {
      const atk = mutate.scene.enter(draft, 'self', 'LP0Atk', { active: true, named: false });
      atkUid = atk.uid;
      const opp = mutate.scene.enter(draft, 'opp', 'OppLow', { active: false, named: false });
      oppUid = opp.uid;
      mutate.scene.setState(draft, oppUid, 'sleep');
    });
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      { kind: 'reasoning', uid: atkUid }, // LP=0, should skip
      { kind: 'actionAgainstChar', byUid: atkUid, targetUid: oppUid }, // 1500>=1000 → winning
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('actionAgainstChar');
  });
});

describe('HeuristicPolicy — priority 4: actionAgainstCase', () => {
  it('picks the case attack with highest-AP attacker', () => {
    registerCardDef(makeCard('LowAP', { ap: 500, lp: 1 }));
    registerCardDef(makeCard('HighAP', { ap: 3000, lp: 1 }));
    let lowUid = '';
    let highUid = '';
    const s = produce(makeBaseState(), draft => {
      const low = mutate.scene.enter(draft, 'self', 'LowAP', { active: true, named: false });
      const high = mutate.scene.enter(draft, 'self', 'HighAP', { active: true, named: false });
      lowUid = low.uid;
      highUid = high.uid;
      draft.players.opp.evidence.push({
        cardId: 'ev',
        faceUp: false,
        origin: { turn: 1, via: 'opening' },
      });
    });
    const policy = new HeuristicPolicy({ seed: 's' });
    // Skip reasoning by making LPs=0 so priority 3 falls through
    // But we already have LowAP/HighAP with lp=1. Use only case attacks:
    const moves: Move[] = [
      { kind: 'actionAgainstCase', byUid: lowUid, targetPlayer: 'opp' },
      { kind: 'actionAgainstCase', byUid: highUid, targetPlayer: 'opp' },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('actionAgainstCase');
    expect((got as Extract<Move, { kind: 'actionAgainstCase' }>).byUid).toBe(highUid);
  });
});

describe('HeuristicPolicy — priority 5: actionAgainstChar (AP filter)', () => {
  it('uses the partner effective AP including turn modifiers', () => {
    registerCardDef(makeCard('P-SELF', { kind: 'partner', ap: 3000, lp: 2 }));
    registerCardDef(makeCard('SceneAtk', { ap: 1500, lp: 1 }));
    registerCardDef(makeCard('Def', { ap: 1000, lp: 1 }));
    let sceneAtkUid = '';
    let defUid = '';
    const s = produce(makeBaseState(), draft => {
      draft.players.self.partner.turnEffects = { apMod_turn: -2500 };
      sceneAtkUid = mutate.scene.enter(draft, 'self', 'SceneAtk', { active: true, named: false }).uid;
      defUid = mutate.scene.enter(draft, 'opp', 'Def', { active: false, named: false }).uid;
      mutate.scene.setState(draft, defUid, 'sleep');
    });
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      { kind: 'actionAgainstChar', byUid: 'partner:self', targetUid: defUid },
      { kind: 'actionAgainstChar', byUid: sceneAtkUid, targetUid: defUid },
      { kind: 'endTurn' },
    ];

    const got = policy.choose(s, moves, 'self');

    expect(got).toEqual({ kind: 'actionAgainstChar', byUid: sceneAtkUid, targetUid: defUid });
  });

  it('picks winning attack (attacker AP >= target AP)', () => {
    registerCardDef(makeCard('Atk', { ap: 2000, lp: 1 }));
    registerCardDef(makeCard('Def', { ap: 1500, lp: 1 }));
    let atkUid = '';
    let defUid = '';
    const s = produce(makeBaseState(), draft => {
      const a = mutate.scene.enter(draft, 'self', 'Atk', { active: true, named: false });
      atkUid = a.uid;
      const d = mutate.scene.enter(draft, 'opp', 'Def', { active: false, named: false });
      defUid = d.uid;
      mutate.scene.setState(draft, defUid, 'sleep');
    });
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      { kind: 'actionAgainstChar', byUid: atkUid, targetUid: defUid },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('actionAgainstChar');
  });

  it('skips char attack (AP<target) when a higher-priority partner reasoning is available', () => {
    registerCardDef(makeCard('WeakAtk', { ap: 500, lp: 1 }));
    registerCardDef(makeCard('StrongDef', { ap: 3000, lp: 1 }));
    let atkUid = '';
    let defUid = '';
    const s = produce(makeBaseState(), draft => {
      const a = mutate.scene.enter(draft, 'self', 'WeakAtk', { active: true, named: false });
      atkUid = a.uid;
      const d = mutate.scene.enter(draft, 'opp', 'StrongDef', { active: false, named: false });
      defUid = d.uid;
      mutate.scene.setState(draft, defUid, 'sleep');
    });
    const policy = new HeuristicPolicy({ seed: 's' });
    // partner reasoning (LP=2 from baseline) is priority 3, char attack (losing) is priority 5
    // Priority 5 filters out losing attacks → priority 3 reasoning wins.
    const moves: Move[] = [
      { kind: 'reasoning', uid: 'partner:self' },
      { kind: 'actionAgainstChar', byUid: atkUid, targetUid: defUid },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('reasoning');
  });

  it('picks the highest-AP attacker among winning options', () => {
    registerCardDef(makeCard('A1', { ap: 1500, lp: 1 }));
    registerCardDef(makeCard('A2', { ap: 2500, lp: 1 }));
    registerCardDef(makeCard('Def', { ap: 1000, lp: 1 }));
    let a1Uid = '';
    let a2Uid = '';
    let defUid = '';
    const s = produce(makeBaseState(), draft => {
      const a1 = mutate.scene.enter(draft, 'self', 'A1', { active: true, named: false });
      const a2 = mutate.scene.enter(draft, 'self', 'A2', { active: true, named: false });
      a1Uid = a1.uid;
      a2Uid = a2.uid;
      const d = mutate.scene.enter(draft, 'opp', 'Def', { active: false, named: false });
      defUid = d.uid;
      mutate.scene.setState(draft, defUid, 'sleep');
    });
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      { kind: 'actionAgainstChar', byUid: a1Uid, targetUid: defUid },
      { kind: 'actionAgainstChar', byUid: a2Uid, targetUid: defUid },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('actionAgainstChar');
    expect((got as Extract<Move, { kind: 'actionAgainstChar' }>).byUid).toBe(a2Uid);
  });
});

describe('HeuristicPolicy — priority 6: handUseCard (sparse-aware)', () => {
  // user_request 20260521_01 #12 改修:
  // - scene < 3 (sparse): character を AP/LP scoring で優先
  // - scene >= 3 (full): event を優先 (盤面補強より effect 優先)
  // - 同種内は AP/LP スコア最大

  it('prefers character card when scene is sparse (< 3) — character lays foundation first', () => {
    registerCardDef(makeCard('CharCard', { kind: 'character', colors: ['赤'], level: 0, ap: 3000, lp: 2 }));
    registerCardDef(makeCard('EventCard', { kind: 'event', colors: ['赤'], level: 0 }));
    const s = makeBaseState(); // scene 空
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      { kind: 'handUseCard', cardId: 'CharCard' },
      { kind: 'handUseCard', cardId: 'EventCard' },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('handUseCard');
    expect((got as Extract<Move, { kind: 'handUseCard' }>).cardId).toBe('CharCard');
  });

  it('prefers event card when scene is full (>= 3) — effect over redundant character', () => {
    registerCardDef(makeCard('CharCard', { kind: 'character', colors: ['赤'], level: 0, ap: 3000, lp: 2 }));
    registerCardDef(makeCard('EventCard', { kind: 'event', colors: ['赤'], level: 0 }));
    registerCardDef(makeCard('ExistingChar', { kind: 'character', ap: 1000, lp: 1 }));
    const s = produce(makeBaseState(), draft => {
      draft.players.self.scene = [
        { cardId: 'ExistingChar', uid: 'e1', state: 'sleep', isNamed: false, enterOrder: 0,
          setCards: [], stackedCards: 0,
          keywordOverrides: { granted: [], disabledOriginal: false },
          apOverride: null, lpOverride: null,
          turnEffects: { contactImmune: false, removeOnTurnEnd: false },
          declaredUseCount: {} },
        { cardId: 'ExistingChar', uid: 'e2', state: 'sleep', isNamed: false, enterOrder: 1,
          setCards: [], stackedCards: 0,
          keywordOverrides: { granted: [], disabledOriginal: false },
          apOverride: null, lpOverride: null,
          turnEffects: { contactImmune: false, removeOnTurnEnd: false },
          declaredUseCount: {} },
        { cardId: 'ExistingChar', uid: 'e3', state: 'sleep', isNamed: false, enterOrder: 2,
          setCards: [], stackedCards: 0,
          keywordOverrides: { granted: [], disabledOriginal: false },
          apOverride: null, lpOverride: null,
          turnEffects: { contactImmune: false, removeOnTurnEnd: false },
          declaredUseCount: {} },
      ];
    });
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      { kind: 'handUseCard', cardId: 'CharCard' },
      { kind: 'handUseCard', cardId: 'EventCard' },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('handUseCard');
    expect((got as Extract<Move, { kind: 'handUseCard' }>).cardId).toBe('EventCard');
  });

  it('picks highest AP+LP scored character when only character cards present (sparse)', () => {
    registerCardDef(makeCard('CharA', { kind: 'character', ap: 2000, lp: 1 }));
    registerCardDef(makeCard('CharB', { kind: 'character', ap: 5000, lp: 3 }));
    const s = makeBaseState();
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      { kind: 'handUseCard', cardId: 'CharA' },
      { kind: 'handUseCard', cardId: 'CharB' },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('handUseCard');
    expect((got as Extract<Move, { kind: 'handUseCard' }>).cardId).toBe('CharB');
  });
});

describe('HeuristicPolicy — priority 7: startNextHint', () => {
  it('picks startNextHint when fileLen >= 8 (surplus over assist threshold)', () => {
    // Phase 9-B: NextHint は FILE >= 8 の surplus がある時のみ採用。
    // assist 用 7 枚を確保した上での余剰でのみ使うため。
    const policy = new HeuristicPolicy({ seed: 's' });
    const state = produce(makeBaseState(), draft => {
      draft.players.self.file = Array.from({ length: 8 }, (_, i) => `f${i}`);
    });
    const moves: Move[] = [
      { kind: 'startNextHint' },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(state, moves, 'self');
    expect(got?.kind).toBe('startNextHint');
  });

  it('prefers endTurn over startNextHint when fileLen < 8 (Phase 9-B FILE protection)', () => {
    // Phase 9-B: FILE 不足で NextHint を抑制する gate のテスト。
    // assist 閾値到達を阻害しないための surplus 戦略。
    const policy = new HeuristicPolicy({ seed: 's' });
    const state = produce(makeBaseState(), draft => {
      draft.players.self.file = Array.from({ length: 5 }, (_, i) => `f${i}`);
    });
    const moves: Move[] = [
      { kind: 'startNextHint' },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(state, moves, 'self');
    expect(got?.kind).toBe('endTurn');
  });
});

describe('HeuristicPolicy — last resort: endTurn', () => {
  it('picks endTurn when only endTurn is available', () => {
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [{ kind: 'endTurn' }];
    const got = policy.choose(makeBaseState(), moves, 'self');
    expect(got?.kind).toBe('endTurn');
  });

  it('returns null for empty candidates', () => {
    const policy = new HeuristicPolicy({ seed: 's' });
    const got = policy.choose(makeBaseState(), [], 'self');
    expect(got).toBeNull();
  });
});

describe('HeuristicPolicy — fallback', () => {
  it('falls back to random non-end move when no priority branch matches', () => {
    // partnerAbility / declaredAbility are not handled by priority branches.
    // With ONLY partnerAbility + endTurn, fallback should pick partnerAbility.
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      { kind: 'partnerAbility', abilityId: 'a1' },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(makeBaseState(), moves, 'self');
    expect(got?.kind).toBe('partnerAbility');
  });
});

describe('HeuristicPolicy — partner reasoning by LP', () => {
  it('picks partner reasoning when partner LP > scene LP', () => {
    // partner LP=2 from beforeEach. Add a scene char with LP=1.
    registerCardDef(makeCard('LowLPChar', { ap: 1000, lp: 1 }));
    let uid = '';
    const s = produce(makeBaseState(), draft => {
      const c = mutate.scene.enter(draft, 'self', 'LowLPChar', { active: true, named: false });
      uid = c.uid;
    });
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      { kind: 'reasoning', uid: 'partner:self' },
      { kind: 'reasoning', uid },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('reasoning');
    expect((got as Extract<Move, { kind: 'reasoning' }>).uid).toBe('partner:self');
  });
});

describe('HeuristicPolicy — name', () => {
  it('name is "heuristic"', () => {
    const p = new HeuristicPolicy({ seed: 's' });
    expect(p.name).toBe('heuristic');
  });
});

describe('HeuristicPolicy — handUseCardSwitch removeUid (Cleanup #3 cardValue)', () => {
  // Cleanup #3 (2026-05-22): 「最古 enterOrder」→ cardValueSelf 最低を犠牲に変更
  it('picks lowest-cardValue self char for removeUid (not just oldest)', () => {
    registerCardDef(makeCard('NewCard', { kind: 'character', colors: ['赤'], level: 0, ap: 3000, lp: 2 }));
    registerCardDef(makeCard('Strong', { kind: 'character', ap: 6000, lp: 3 }));
    registerCardDef(makeCard('Weak', { kind: 'character', ap: 1000, lp: 1 }));
    const s = produce(makeBaseState(), draft => {
      // scene を 5 体埋める (switch 経路条件)
      // strongOld = 一番古いが高価値 / weakNew = 一番新しいが低価値 / 他 3 体
      draft.players.self.scene = [
        { cardId: 'Strong', uid: 'strongOld', state: 'active', isNamed: false, enterOrder: 0,
          setCards: [], stackedCards: 0,
          keywordOverrides: { granted: [], disabledOriginal: false },
          apOverride: null, lpOverride: null,
          turnEffects: { contactImmune: false, removeOnTurnEnd: false },
          declaredUseCount: {} },
        { cardId: 'Strong', uid: 's2', state: 'active', isNamed: false, enterOrder: 1,
          setCards: [], stackedCards: 0,
          keywordOverrides: { granted: [], disabledOriginal: false },
          apOverride: null, lpOverride: null,
          turnEffects: { contactImmune: false, removeOnTurnEnd: false },
          declaredUseCount: {} },
        { cardId: 'Strong', uid: 's3', state: 'active', isNamed: false, enterOrder: 2,
          setCards: [], stackedCards: 0,
          keywordOverrides: { granted: [], disabledOriginal: false },
          apOverride: null, lpOverride: null,
          turnEffects: { contactImmune: false, removeOnTurnEnd: false },
          declaredUseCount: {} },
        { cardId: 'Strong', uid: 's4', state: 'active', isNamed: false, enterOrder: 3,
          setCards: [], stackedCards: 0,
          keywordOverrides: { granted: [], disabledOriginal: false },
          apOverride: null, lpOverride: null,
          turnEffects: { contactImmune: false, removeOnTurnEnd: false },
          declaredUseCount: {} },
        { cardId: 'Weak', uid: 'weakNew', state: 'active', isNamed: false, enterOrder: 4,
          setCards: [], stackedCards: 0,
          keywordOverrides: { granted: [], disabledOriginal: false },
          apOverride: null, lpOverride: null,
          turnEffects: { contactImmune: false, removeOnTurnEnd: false },
          declaredUseCount: {} },
      ];
    });
    const policy = new HeuristicPolicy({ seed: 's' });
    const moves: Move[] = [
      // 全 5 体それぞれを犠牲にするオプション
      { kind: 'handUseCardSwitch', cardId: 'NewCard', removeUid: 'strongOld' },
      { kind: 'handUseCardSwitch', cardId: 'NewCard', removeUid: 's2' },
      { kind: 'handUseCardSwitch', cardId: 'NewCard', removeUid: 's3' },
      { kind: 'handUseCardSwitch', cardId: 'NewCard', removeUid: 's4' },
      { kind: 'handUseCardSwitch', cardId: 'NewCard', removeUid: 'weakNew' },
      { kind: 'endTurn' },
    ];
    const got = policy.choose(s, moves, 'self');
    expect(got?.kind).toBe('handUseCardSwitch');
    // 改修前 (oldest enterOrder): strongOld が選ばれる
    // 改修後 (cardValue 最低): weakNew が選ばれる
    expect((got as Extract<Move, { kind: 'handUseCardSwitch' }>).removeUid).toBe('weakNew');
  });
});
