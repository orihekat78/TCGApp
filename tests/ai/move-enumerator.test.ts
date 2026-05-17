// tests/ai/move-enumerator.test.ts — Phase 6 Group A Task 6.1 tests
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
import type { CardDef, GameState, AbilityDef } from '@/engine/types';

import { enumerateMoves, canAssist, canSolveCase, type Move } from '@/ai/move-enumerator';

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

/**
 * 最小限の test GameState を作る。
 *   - self/opp に partner/case を設定 (色は事件側からは指定なし)
 *   - turn.player='self', phase='main' (列挙はフェイズに依存しないが安全側で)
 */
function makeBaseState(): GameState {
  return produce(createEmptyGameState(), draft => {
    mutate.partner.init(draft, 'self', 'P-SELF');
    mutate.partner.init(draft, 'opp', 'P-OPP');
    mutate.case.init(draft, 'self', 'CASE-SELF', ['赤']);
    mutate.case.init(draft, 'opp', 'CASE-OPP', ['青']);
    draft.turn.player = 'self';
    draft.turn.phase = 'main';
    draft.turn.number = 1;
  });
}

describe('enumerateMoves', () => {
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
  });

  it('empty state: returns only endTurn when no other moves are available', () => {
    // partner is sleep → cannot reason / cannot assist / cannot action
    const s = produce(makeBaseState(), draft => {
      mutate.partner.setState(draft, 'self', 'sleep');
    });
    const moves = enumerateMoves(s, 'self');
    // The only move should be endTurn
    expect(moves.map(m => m.kind)).toEqual(['endTurn']);
  });

  it('partner active + reasoning available: includes assist, reasoning(partner), endTurn', () => {
    const s = makeBaseState();
    const moves = enumerateMoves(s, 'self');
    const kinds = moves.map(m => m.kind);
    expect(kinds).toContain('assist');
    expect(kinds).toContain('reasoning');
    expect(kinds).toContain('endTurn');
    // assist is first
    expect(kinds[0]).toBe('assist');
    // endTurn is last
    expect(kinds[kinds.length - 1]).toBe('endTurn');
  });

  it('hand has playable card (color match, low level): includes handUseCard', () => {
    registerCardDef(
      makeCard('CharA', { colors: ['赤'], level: 0, ap: 1000, lp: 1 }),
    );
    const s = produce(makeBaseState(), draft => {
      draft.players.self.hand.push('CharA');
    });
    const moves = enumerateMoves(s, 'self');
    const handMoves = moves.filter(m => m.kind === 'handUseCard');
    expect(handMoves).toHaveLength(1);
    expect((handMoves[0] as Extract<Move, { kind: 'handUseCard' }>).cardId).toBe('CharA');
  });

  it('hand has unplayable card (color mismatch): no handUseCard moves', () => {
    registerCardDef(
      makeCard('CharBlue', { colors: ['青'], level: 0, ap: 1000, lp: 1 }),
    );
    const s = produce(makeBaseState(), draft => {
      draft.players.self.hand.push('CharBlue');
    });
    const moves = enumerateMoves(s, 'self');
    expect(moves.find(m => m.kind === 'handUseCard')).toBeUndefined();
  });

  it('handUseUsed flag set: no handUseCard moves', () => {
    registerCardDef(
      makeCard('CharA', { colors: ['赤'], level: 0, ap: 1000, lp: 1 }),
    );
    const s = produce(makeBaseState(), draft => {
      draft.players.self.hand.push('CharA');
      draft.turnState.self.handUseUsed = true;
    });
    const moves = enumerateMoves(s, 'self');
    expect(moves.find(m => m.kind === 'handUseCard')).toBeUndefined();
  });

  it('nextHintUsed flag set: handUseCard blocked (rules/05)', () => {
    registerCardDef(
      makeCard('CharA', { colors: ['赤'], level: 0, ap: 1000, lp: 1 }),
    );
    const s = produce(makeBaseState(), draft => {
      draft.players.self.hand.push('CharA');
      draft.turnState.self.nextHintUsed = true;
    });
    const moves = enumerateMoves(s, 'self');
    expect(moves.find(m => m.kind === 'handUseCard')).toBeUndefined();
  });

  it('FILE has 1 card: startNextHint is enumerated', () => {
    const s = produce(makeBaseState(), draft => {
      draft.players.self.deck = Array.from({ length: 10 }, (_, i) => `d${i}`);
      mutate.file.addFromDeckTop(draft, 'self', 1);
    });
    const moves = enumerateMoves(s, 'self');
    expect(moves.find(m => m.kind === 'startNextHint')).toBeDefined();
  });

  it('scene has 1 active char + opp has 1 sleep char: actionAgainstChar + reasoning + endTurn', () => {
    registerCardDef(makeCard('AtkChar', { ap: 1500, lp: 2 }));
    registerCardDef(makeCard('DefChar', { ap: 1000, lp: 1 }));
    let atkUid = '';
    let defUid = '';
    const s = produce(makeBaseState(), draft => {
      const a = mutate.scene.enter(draft, 'self', 'AtkChar', { active: true, named: false });
      atkUid = a.uid;
      const d = mutate.scene.enter(draft, 'opp', 'DefChar', { active: false, named: false });
      defUid = d.uid;
      mutate.scene.setState(draft, defUid, 'sleep');
    });
    const moves = enumerateMoves(s, 'self');
    const actionChars = moves.filter(m => m.kind === 'actionAgainstChar');
    expect(actionChars.length).toBeGreaterThanOrEqual(1);
    const found = actionChars.find(
      m =>
        (m as Extract<Move, { kind: 'actionAgainstChar' }>).byUid === atkUid &&
        (m as Extract<Move, { kind: 'actionAgainstChar' }>).targetUid === defUid,
    );
    expect(found).toBeDefined();
    // reasoning for atkChar is also enumerated (active, not named)
    const reasonChar = moves.find(
      m => m.kind === 'reasoning' &&
        (m as Extract<Move, { kind: 'reasoning' }>).uid === atkUid,
    );
    expect(reasonChar).toBeDefined();
  });

  it('actionAgainstCase: enumerates when opp has evidence', () => {
    registerCardDef(makeCard('AtkChar', { ap: 1000, lp: 1 }));
    let atkUid = '';
    const s = produce(makeBaseState(), draft => {
      const a = mutate.scene.enter(draft, 'self', 'AtkChar', { active: true, named: false });
      atkUid = a.uid;
      // give opp an evidence card
      draft.players.opp.evidence.push({
        cardId: 'EV',
        faceUp: false,
        origin: { turn: 1, via: 'opening' },
      });
    });
    const moves = enumerateMoves(s, 'self');
    const caseMove = moves.find(
      m =>
        m.kind === 'actionAgainstCase' &&
        (m as Extract<Move, { kind: 'actionAgainstCase' }>).byUid === atkUid,
    );
    expect(caseMove).toBeDefined();
  });

  it('canAssist: requires partner active + not assistedThisTurn', () => {
    const s1 = makeBaseState();
    expect(canAssist(s1, 'self')).toBe(true);

    // sleep partner cannot assist
    const s2 = produce(s1, draft => {
      mutate.partner.setState(draft, 'self', 'sleep');
    });
    expect(canAssist(s2, 'self')).toBe(false);

    // already assisted this turn
    const s3 = produce(s1, draft => {
      draft.turnState.self.assistedThisTurn = true;
    });
    expect(canAssist(s3, 'self')).toBe(false);
  });

  it('canSolveCase: requires 解決編 + evidence>=required + partner active + not assisted', () => {
    // base: status=事件編 → false
    const s0 = makeBaseState();
    expect(canSolveCase(s0, 'self')).toBe(false);

    // status=解決編 but evidence=0 → false
    const s1 = produce(s0, draft => {
      draft.players.self.case.status = '解決編';
      draft.players.self.case.requiredEvidence = 1;
    });
    expect(canSolveCase(s1, 'self')).toBe(false);

    // status=解決編 + enough evidence → true
    const s2 = produce(s1, draft => {
      draft.players.self.evidence.push({
        cardId: 'EV',
        faceUp: false,
        origin: { turn: 1, via: 'opening' },
      });
    });
    expect(canSolveCase(s2, 'self')).toBe(true);

    // assisted this turn → false (rules/01 注意)
    const s3 = produce(s2, draft => {
      draft.turnState.self.assistedThisTurn = true;
    });
    expect(canSolveCase(s3, 'self')).toBe(false);

    // partner sleep → false
    const s4 = produce(s2, draft => {
      mutate.partner.setState(draft, 'self', 'sleep');
    });
    expect(canSolveCase(s4, 'self')).toBe(false);
  });

  it('partnerAbility: enumerates declared-type abilities', () => {
    const ability: AbilityDef = {
      id: 'a1',
      type: 'declared',
      description: 'test declared',
    };
    // Re-register partner card with a declared ability.
    registerCardDef(makeCard('P-SELF', { kind: 'partner', lp: 2, abilities: [ability] }));
    const s = makeBaseState();
    const moves = enumerateMoves(s, 'self');
    const pa = moves.find(m => m.kind === 'partnerAbility');
    expect(pa).toBeDefined();
    expect((pa as Extract<Move, { kind: 'partnerAbility' }>).abilityId).toBe('a1');
  });

  it('declaredAbility: enumerates declared abilities on scene characters', () => {
    const ability: AbilityDef = {
      id: 'da1',
      type: 'declared',
      description: 'test char declared',
    };
    registerCardDef(makeCard('CharWithAbility', { abilities: [ability] }));
    let uid = '';
    const s = produce(makeBaseState(), draft => {
      const c = mutate.scene.enter(draft, 'self', 'CharWithAbility', {
        active: true,
        named: false,
      });
      uid = c.uid;
    });
    const moves = enumerateMoves(s, 'self');
    const da = moves.find(
      m => m.kind === 'declaredAbility' &&
        (m as Extract<Move, { kind: 'declaredAbility' }>).uid === uid &&
        (m as Extract<Move, { kind: 'declaredAbility' }>).abilityId === 'da1',
    );
    expect(da).toBeDefined();
  });

  it('deterministic order: assist > solveCase > handUseCard > startNextHint > ... > endTurn', () => {
    registerCardDef(makeCard('CharA', { colors: ['赤'], level: 0, ap: 1000, lp: 1 }));
    const s = produce(makeBaseState(), draft => {
      draft.players.self.hand.push('CharA');
      draft.players.self.deck = Array.from({ length: 5 }, (_, i) => `d${i}`);
      mutate.file.addFromDeckTop(draft, 'self', 1);
    });
    const moves = enumerateMoves(s, 'self');
    const kinds = moves.map(m => m.kind);
    // expected order: assist, handUseCard, startNextHint, reasoning(partner), endTurn
    expect(kinds.indexOf('assist')).toBeLessThan(kinds.indexOf('handUseCard'));
    expect(kinds.indexOf('handUseCard')).toBeLessThan(kinds.indexOf('startNextHint'));
    expect(kinds.indexOf('startNextHint')).toBeLessThan(kinds.indexOf('reasoning'));
    expect(kinds.indexOf('reasoning')).toBeLessThan(kinds.indexOf('endTurn'));
    expect(kinds[kinds.length - 1]).toBe('endTurn');
  });

  it('hand with duplicate cardIds: dedup to single handUseCard move', () => {
    registerCardDef(makeCard('CharA', { colors: ['赤'], level: 0, ap: 1000, lp: 1 }));
    const s = produce(makeBaseState(), draft => {
      draft.players.self.hand.push('CharA', 'CharA', 'CharA');
    });
    const moves = enumerateMoves(s, 'self');
    const hand = moves.filter(m => m.kind === 'handUseCard');
    expect(hand).toHaveLength(1);
  });

  // ---- rules/20 §スイッチ (Phase 5 advance) ----
  it('scene=5 + character in hand: emits handUseCardSwitch for each scene char (5 moves)', () => {
    registerCardDef(makeCard('CharA', { kind: 'character', colors: ['赤'], level: 0, ap: 1000, lp: 1 }));
    registerCardDef(makeCard('SC', { kind: 'character', colors: ['赤'], level: 0, ap: 1000, lp: 1 }));
    const s = produce(makeBaseState(), draft => {
      draft.players.self.hand.push('CharA');
      // 5 既存 scene chars
      for (let i = 0; i < 5; i++) {
        mutate.scene.enter(draft, 'self', 'SC', { named: false, viaEffect: false });
      }
    });
    const moves = enumerateMoves(s, 'self');
    const handNormal = moves.filter(m => m.kind === 'handUseCard');
    const handSwitch = moves.filter((m): m is Extract<Move, { kind: 'handUseCardSwitch' }> => m.kind === 'handUseCardSwitch');
    // 通常 handUseCard は出ない (scene=5 で canHandUseCard=false)
    expect(handNormal).toHaveLength(0);
    // switch は scene char 数 (5) と同数列挙
    expect(handSwitch).toHaveLength(5);
    // 各 removeUid が scene の uid と一致
    const sceneUids = s.players.self.scene.map(c => c.uid);
    const removeUids = handSwitch.map(m => m.removeUid);
    expect(new Set(removeUids)).toEqual(new Set(sceneUids));
  });

  it('scene=4 + character in hand: emits normal handUseCard only (no switch)', () => {
    registerCardDef(makeCard('CharA', { kind: 'character', colors: ['赤'], level: 0, ap: 1000, lp: 1 }));
    registerCardDef(makeCard('SC', { kind: 'character', colors: ['赤'], level: 0, ap: 1000, lp: 1 }));
    const s = produce(makeBaseState(), draft => {
      draft.players.self.hand.push('CharA');
      for (let i = 0; i < 4; i++) {
        mutate.scene.enter(draft, 'self', 'SC', { named: false, viaEffect: false });
      }
    });
    const moves = enumerateMoves(s, 'self');
    expect(moves.filter(m => m.kind === 'handUseCard')).toHaveLength(1);
    expect(moves.filter(m => m.kind === 'handUseCardSwitch')).toHaveLength(0);
  });

  it('scene=5 + event in hand: emits handUseCard normally (event は scene 上限と無関係)', () => {
    registerCardDef(makeCard('EvtA', { kind: 'event', colors: ['赤'], level: 0 }));
    registerCardDef(makeCard('SC', { kind: 'character', colors: ['赤'], level: 0, ap: 1000, lp: 1 }));
    const s = produce(makeBaseState(), draft => {
      draft.players.self.hand.push('EvtA');
      for (let i = 0; i < 5; i++) {
        mutate.scene.enter(draft, 'self', 'SC', { named: false, viaEffect: false });
      }
    });
    const moves = enumerateMoves(s, 'self');
    expect(moves.filter(m => m.kind === 'handUseCard')).toHaveLength(1);
    expect(moves.filter(m => m.kind === 'handUseCardSwitch')).toHaveLength(0);
  });
});
