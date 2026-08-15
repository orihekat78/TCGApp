import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B10019, B10019P } from '@/cards/ct-p10/B10019';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { drainAiEffectPicks, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { canPay } from '@/engine/cost/evaluate';
import { pay } from '@/engine/cost/pay';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EffectCtx, EvidenceCard, GameState } from '@/engine/types';

const globals = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const FILLER = card('B10019_FILLER');
const SOCCER = card('B10019_SOCCER', { level: 6, traits: ['サッカー選手'] });
const GADGET = card('B10019_GADGET', { kind: 'event', level: 6, traits: ['ガジェット'] });
const SOCCER_EVENT = card('B10019_SOCCER_EVENT', { kind: 'event', level: 6, traits: ['サッカー選手'] });
const GADGET_CHAR = card('B10019_GADGET_CHAR', { level: 6, traits: ['ガジェット'] });
const LEVEL7 = card('B10019_LEVEL7', { level: 7, traits: ['サッカー選手'] });

function evidence(cardId: string, faceUp = false): EvidenceCard {
  return { cardId, faceUp, origin: { turn: 1, via: 'reasoning' } };
}

function state(evidenceCards: EvidenceCard[]): GameState {
  const result = createEmptyGameState();
  result.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  result.players.self.case = { cardId: 'B10019', status: '解決編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
  result.players.self.evidence = evidenceCards;
  return result;
}

function ctx(indices: number[]): EffectCtx {
  return { source: { cardId: 'B10019', abilityId: 'a2', uid: 'case:self', player: 'self', area: 'case' }, bindings: {}, dyn: { costParams: { flipFaceUpEvidence: { indices } } } } as EffectCtx;
}

function settleAi(s: GameState): void {
  for (let i = 0; i < 5; i += 1) {
    runAllUntilEmpty(s);
    const queue = (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue ?? [];
    if (queue.length === 0) return;
    drainAiEffectPicks(s, new HeuristicPolicy());
  }
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectPickQueue();
  _resetRegistry();
  [B10019, B10019P, FILLER, SOCCER, GADGET, SOCCER_EVENT, GADGET_CHAR, LEVEL7].forEach(register);
  registerTriggeredListener();
  globals.__humanPlayerSide = 'self';
});

describe('CT-P10 B10019 プロサッカー選手権大会', () => {
  it('removes one hand card only when its own case reaches 解決編', () => {
    const result = state([]);
    result.players.self.case.status = '事件編';
    result.players.self.hand = [FILLER.id];
    globals.__humanPlayerSide = null;

    mutate.case.toResolved(result, 'self');
    settleAi(result);

    expect(result.players.self.hand).toEqual([]);
    expect(result.players.self.remove).toContain(FILLER.id);
  });

  it('flips exactly two chosen own evidence and offers only level-6 soccer characters or gadget events', () => {
    let result = state([evidence('E0'), evidence('E1'), evidence('E2')]);
    result.players.opp.evidence = [evidence('OPP0'), evidence('OPP1')];
    result.players.self.remove = [SOCCER.id, GADGET.id, SOCCER_EVENT.id, GADGET_CHAR.id, LEVEL7.id];
    const effectCtx = ctx([0, 2]);

    result = produce(result, draft => {
      pay(draft, B10019.abilities[1]!.cost!, effectCtx);
      flow.useDeclaredAbility(draft, 'case:self', 'a2', effectCtx);
      runAllUntilEmpty(draft);
    });
    const pick = _drainPendingEffectPickSide()!;

    // qa: card:B10019:9d0790992ac15c9e4a2f284d4b0f667e34549c1e3c38b86e01080fa0a851b41a
    expect(result.players.self.evidence.map(item => [item.cardId, item.faceUp])).toEqual([['E0', true], ['E1', false], ['E2', true]]);
    expect(result.players.opp.evidence.map(item => item.faceUp)).toEqual([false, false]);
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([SOCCER.id, GADGET.id]);
    result = produce(result, draft => applyPickAndContinuation(draft, pick, pick.candidates[1]!.uid));
    expect(result.players.self.hand).toEqual([GADGET.id]);
    expect(result.players.self.remove).not.toContain(GADGET.id);
  });

  it('cannot supplement its cost with opponent evidence', () => {
    const result = state([evidence('E0')]);
    result.players.opp.evidence = [evidence('OPP0'), evidence('OPP1')];
    const effectCtx = ctx([0]);

    // qa: card:B10019:251efe3bc94fcb1824ebc992ad6eb2711721421520d6b2090a5f786e4d0420b2
    expect(canPay(result, B10019.abilities[1]!.cost!, effectCtx)).toBe(false);
    expect(result.players.self.evidence.map(item => item.faceUp)).toEqual([false]);
    expect(result.players.opp.evidence.map(item => item.faceUp)).toEqual([false, false]);
  });

  it('requires exactly two face-down own evidence', () => {
    const result = state([evidence('E0')]);
    const effectCtx = ctx([0]);

    // qa: card:B10019:324a24588d4bb1ddbf561b347a12dcb2d77569ebb134f8d747e7ca53c6a9f570
    expect(canPay(result, B10019.abilities[1]!.cost!, effectCtx)).toBe(false);
    expect(result.players.self.evidence.map(item => item.faceUp)).toEqual([false]);
    expect(result.players.opp.evidence).toEqual([]);
  });

  it('requires a self-side soccer-player character before the declared ability is available', () => {
    const result = state([evidence('E0'), evidence('E1')]);
    expect(flow.canDeclaredAbility(result, 'case:self', 'a2')).toBe(false);

    mutate.scene.enter(result, 'self', SOCCER.id, { active: true });
    expect(flow.canDeclaredAbility(result, 'case:self', 'a2')).toBe(true);
  });

  it('permits choosing zero eligible remove cards', () => {
    let result = state([evidence('E0'), evidence('E1')]);
    result.players.self.remove = [SOCCER.id];
    const effectCtx = ctx([0, 1]);
    result = produce(result, draft => {
      pay(draft, B10019.abilities[1]!.cost!, effectCtx);
      flow.useDeclaredAbility(draft, 'case:self', 'a2', effectCtx);
      runAllUntilEmpty(draft);
    });
    const pick = _drainPendingEffectPickSide()!;
    result = produce(result, draft => applyPickSkipAndContinuation(draft, pick));

    expect(result.players.self.hand).toEqual([]);
    expect(result.players.self.remove).toEqual([SOCCER.id]);
  });

  it('keeps the promo printing mechanically identical with official metadata', () => {
    expect(B10019P.abilities).toEqual(B10019.abilities);
    expect(B10019).toMatchObject({ kind: 'case', no: '1081/B10019', colors: ['青'], caseLevel: 7, rarity: 'R', imageUrl: '1783904095025459.jpg' });
    expect(B10019P).toMatchObject({ no: '1081/B10019P', rarity: 'RP', imageUrl: '1783904095033295.jpg' });
  });
});
