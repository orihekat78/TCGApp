// B09056/P: 【パートナー赤】はパートナーがFILEにアシスト中でも色を参照する。
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { registerAll } from '@/cards';
import { B09056 } from '@/cards/ct-p09/B09056';
import { B09056P } from '@/cards/ct-p09/B09056P';
import { event } from '@/engine/event';
import {
  _clearPendingEffectChoiceSide,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _drainPendingEffectChoiceSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectPickSide,
} from '@/engine/effect/pending-state';
import {
  applyOptionalAndContinuation,
  applyPickSkipAndContinuation,
  drainAiEffectPicks,
} from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, EffectCtx } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';

const FILE_BACK = { type: 'card-back' as const, cardId: 'D04014' };
const AI_BLACK_ENTRY: CardDef = {
  id: 'B09056_AI_BLACK_ENTRY', no: 'test/B09056_AI_BLACK_ENTRY', kind: 'character',
  names: ['AI黒候補'], colors: ['黒'], level: 3, ap: 1000, lp: 1, traits: [],
  keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const AI_OPPONENT: CardDef = {
  ...AI_BLACK_ENTRY, id: 'B09056_AI_OPPONENT', no: 'test/B09056_AI_OPPONENT',
  names: ['AI相手候補'], colors: ['青'],
};

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectChoiceSide();
  _clearPendingEffectPickQueue();
  registerAll();
  register(AI_BLACK_ENTRY);
  register(AI_OPPONENT);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  _clearPendingEffectOptionalSide();
  _clearPendingEffectChoiceSide();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

function printedTraceChoice(card: CardDef): Extract<Effect, { kind: 'choice' }> {
  const outer = card.abilities[0]?.effect;
  if (outer?.kind !== 'conditional' || outer.then.kind !== 'optional'
    || outer.then.effect.kind !== 'sequence') throw new Error(`${card.id}: unexpected a1 shape`);
  const choice = outer.then.effect.steps[2];
  if (choice?.kind !== 'choice') throw new Error(`${card.id}: missing printed choice`);
  return choice;
}

describe('B09056/P 赤井秀一 — パートナーアシスト中の登場時効果', () => {
  it.each([B09056, B09056P])('$id: 赤partnerがFILE中でもoptional、remove選択、必須2択を順にsurfaceする', card => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner.cardId = 'D04001'; // 赤パートナー
    state.players.self.case.cardId = 'B09113P';
    state.players.self.case.colors = ['赤', '黒'];
    state.players.self.file = Array.from({ length: 7 }, () => ({ ...FILE_BACK }));
    state.players.self.hand = [card.id];

    mutate.partner.assist(state, 'self');
    expect(state.players.self.partner.location).toBe('file-area');

    handUseCard(state, 'self', card.id);
    runAllUntilEmpty(state);
    const group = pendingOwnerOrderGroup(state, 'self');
    expect(group, 'same-timing effects pause before the optional prompt').toHaveLength(2);
    group.forEach((entry, order) => {
      entry.ownerChosenOrder = order;
      entry.ownerOrderConfirmed = true;
    });
    runAllUntilEmpty(state);

    const optional = _drainPendingEffectOptionalSide();
    expect(optional).toMatchObject({
      player: 'self',
      source: { cardId: card.id, abilityId: 'a1' },
    });

    applyOptionalAndContinuation(state, optional!, true);
    const removePick = _drainPendingEffectPickSide();
    expect(removePick).toMatchObject({
      player: 'self',
      atomVerb: 'sceneRemove',
      nMin: 0,
      nMax: 1,
      source: { cardId: card.id },
    });
    expect(removePick?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: card.id, player: 'self' }),
    ]));
    expect(state.players.self.scene.find(character => character.cardId === card.id)?.state).toBe('sleep');

    applyPickSkipAndContinuation(state, removePick!, false);
    const branchChoice = _drainPendingEffectChoiceSide();
    expect(branchChoice).toMatchObject({
      player: 'self',
      source: { cardId: card.id, abilityId: 'a1' },
    });
    expect(branchChoice?.options).toHaveLength(2);
  });

  it.each([
    { card: B09056, trace: '発見済' as const },
    { card: B09056, trace: '未発見' as const },
    { card: B09056P, trace: '発見済' as const },
    { card: B09056P, trace: '未発見' as const },
  ])('$card.id autonomous choice selects the applicable $trace branch', ({ card, trace }) => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(card.id, 'source')];
    state.players.self.remove = [AI_BLACK_ENTRY.id];
    state.players.opp.scene = [sceneChar(AI_OPPONENT.id, 'opp')];
    state.players.opp.deck = Array.from({ length: 6 }, () => AI_OPPONENT.id);
    state.scratchTrace.self = trace;
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    const ctx: EffectCtx = {
      source: { cardId: card.id, uid: 'source', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {},
    };
    runEffect(state, printedTraceChoice(card), ctx);
    drainAiEffectPicks(state, new HeuristicPolicy());
    runAllUntilEmpty(state);
    expect(_drainPendingEffectChoiceSide(), `${card.id}/${trace}: autonomous path has no human choice`).toBeNull();
    expect({
      entered: state.players.self.scene.some(character => character.cardId === AI_BLACK_ENTRY.id),
      opponentDeck: state.players.opp.deck.length,
    }).toEqual(trace === '発見済'
      ? { entered: true, opponentDeck: 6 }
      : { entered: false, opponentDeck: 4 });
  });

  it('does not surface an opponent-owned trace choice to the human side', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.scene = [sceneChar(B09056.id, 'source')];
    state.players.self.scene = [sceneChar(AI_OPPONENT.id, 'human-scene')];
    state.players.self.deck = Array.from({ length: 6 }, () => AI_OPPONENT.id);
    state.scratchTrace.opp = '未発見';
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const ctx: EffectCtx = {
      source: { cardId: B09056.id, uid: 'source', abilityId: 'a1', player: 'opp', area: 'scene' },
      bindings: {},
    };

    runEffect(state, printedTraceChoice(B09056), ctx);

    expect(_drainPendingEffectChoiceSide()).toBeNull();
    expect(state.players.self.deck).toHaveLength(4);
  });
});
