import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B10023, B10023P } from '@/cards/ct-p10/B10023';
import { REUSE_CARDS } from '@/cards';
import { canPay } from '@/engine/cost/evaluate';
import { canPayAtomically, pay } from '@/engine/cost/pay';
import { event } from '@/engine/event';
import { applyOptionalAndContinuation, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue, _drainPendingEffectOptionalSide, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { canActivateDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register, _resetRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import { mutate } from '@/engine/mutate';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

const POLICE: CardDef = { id: 'TEST_POLICE', no: 'TEST_POLICE', kind: 'character', names: ['\u8b66\u5bdf'], colors: ['\u7dd1'], level: 6, ap: 1000, lp: 1, traits: ['\u8b66\u5bdf'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const ctx = (sourceUid: string, ids: string[]): EffectCtx => ({ source: { cardId: 'B10023', uid: sourceUid, abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {}, dyn: { costParams: { removeSetCard: { hostUids: [sourceUid, sourceUid], instanceIds: ids } } } } as EffectCtx);

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner.cardId = 'B10023';
  state.players.self.case.status = '\u89e3\u6c7a\u7de8';
  state.players.self.scene = [sceneChar('B10023', 'src')];
  return state;
}

function withSetCards(cards: Array<{ id: string; faceUp: boolean }>): { state: GameState; uid: string } {
  let uid = '';
  const state = produce(createEmptyGameState(), (draft) => {
    draft.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    draft.players.self.partner.cardId = 'B10023';
    draft.players.self.case.status = '\u89e3\u6c7a\u7de8';
    uid = mutate.scene.enter(draft, 'self', 'B10023', {}).uid;
    cards.forEach(({ id, faceUp }) => mutate.char.setCard(draft, uid, id, faceUp));
  });
  return { state, uid };
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  register(B10023);
  register(B10023P);
  register(POLICE);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('B10023 服部平次', () => {
  it('pays its two face-down set cards across own scene hosts, never an opponent host', () => {
    const { state: raw, uid } = withSetCards([{ id: 'SOURCE-SET', faceUp: false }]);
    let secondUid = '';
    let opponentUid = '';
    const state = produce(raw, (draft) => {
      secondUid = mutate.scene.enter(draft, 'self', 'TEST_POLICE', {}).uid;
      mutate.char.setCard(draft, secondUid, 'SECOND-SET', false);
      opponentUid = mutate.scene.enter(draft, 'opp', 'TEST_POLICE', {}).uid;
      mutate.char.setCard(draft, opponentUid, 'OPPONENT-SET', false);
    });
    const sourceId = state.players.self.scene.find((char) => char.uid === uid)!.setCards[0]!.instanceId!;
    const secondId = state.players.self.scene.find((char) => char.uid === secondUid)!.setCards[0]!.instanceId!;
    const opponentId = state.players.opp.scene.find((char) => char.uid === opponentUid)!.setCards[0]!.instanceId!;
    const ownCtx: EffectCtx = {
      source: { cardId: 'B10023', uid, abilityId: 'a2', player: 'self', area: 'scene' },
      bindings: {},
      dyn: { costParams: { removeSetCard: { hostUids: [uid, secondUid], instanceIds: [sourceId, secondId] } } },
    } as EffectCtx;
    expect(canPay(state, B10023.abilities[1]!.cost!, ownCtx)).toBe(true);
    expect(canPayAtomically(state, B10023.abilities[1]!.cost!, ownCtx)).toBe(true);
    expect(canActivateDeclaredAbility(state, uid, 'a2', ownCtx.dyn!.costParams as never)).toBe(true);
    const paid = produce(state, (draft) => { pay(draft, B10023.abilities[1]!.cost!, ownCtx); });
    expect(paid.players.self.remove).toEqual(['SOURCE-SET', 'SECOND-SET']);
    expect(paid.players.opp.scene[0]!.setCards.map((entry) => entry.cardId)).toEqual(['OPPONENT-SET']);

    const opponentCtx: EffectCtx = {
      ...ownCtx,
      dyn: { costParams: { removeSetCard: { hostUids: [uid, opponentUid], instanceIds: [sourceId, opponentId] } } },
    } as EffectCtx;
    expect(canPayAtomically(state, B10023.abilities[1]!.cost!, opponentCtx)).toBe(false);
    expect(canActivateDeclaredAbility(state, uid, 'a2', opponentCtx.dyn!.costParams as never)).toBe(false);
  });

  it('keeps the hand gate outside its optional entry chain and re-enters only eligible police characters', () => {
    const a1 = B10023.abilities[0]!;
    expect(a1.condition).toMatchObject({ kind: 'and' });
    expect(JSON.stringify(a1.condition)).toContain('handAtLeast');
    expect(a1.effect).toMatchObject({ kind: 'optional' });
    expect(JSON.stringify(a1.effect)).toContain('sceneEnter');
    expect(JSON.stringify(a1.effect)).toContain('levelMax');
  });

  it('requires exactly two distinct face-down cards on itself, then removes them and draws', () => {
    const { state: raw, uid } = withSetCards([{ id: 'X', faceUp: false }, { id: 'Y', faceUp: false }]);
    const s = produce(raw, (draft) => { draft.players.self.deck = ['DRAW']; });
    const ids = s.players.self.scene[0]!.setCards.map((card) => card.instanceId);
    expect(canPay(s, B10023.abilities[1]!.cost!, ctx(uid, ids))).toBe(true);
    expect(canActivateDeclaredAbility(s, uid, 'a2', { removeSetCard: { hostUids: [uid, uid], instanceIds: ids } })).toBe(true);
    const paid = produce(s, (draft) => {
      const result = pay(draft, B10023.abilities[1]!.cost!, ctx(uid, ids));
      expect(result.paidItems).toHaveLength(2);
    });
    expect(paid.players.self.remove).toEqual(['X', 'Y']);
    const after = produce(paid, (draft) => {
      runEffect(draft, B10023.abilities[1]!.effect!, { source: { cardId: 'B10023', uid, abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} });
    });
    expect(after.players.self.hand).toEqual(['DRAW']);
  });

  it('activates through the public dispatcher with an exact two-host witness', () => {
    const { state: raw, uid } = withSetCards([{ id: 'SOURCE-SET', faceUp: false }]);
    let secondUid = '';
    const state = produce(raw, (draft) => {
      secondUid = mutate.scene.enter(draft, 'self', 'TEST_POLICE', {}).uid;
      mutate.char.setCard(draft, secondUid, 'SECOND-SET', false);
      // Keep one card after the draw: an empty deck would immediately refresh
      // from remove and obscure the paid set cards in the final state.
      draft.players.self.deck = ['DRAW', 'DECK-REST'];
    });
    const sourceId = state.players.self.scene.find((char) => char.uid === uid)!.setCards[0]!.instanceId!;
    const secondId = state.players.self.scene.find((char) => char.uid === secondUid)!.setCards[0]!.instanceId!;
    const params = { removeSetCard: { hostUids: [uid, secondUid], instanceIds: [sourceId, secondId] } };

    const activated = produce(state, (draft) => {
      activateDeclaredAbility(draft, uid, 'a2', params);
      runAllUntilEmpty(draft);
    });

    expect(activated.players.self.remove).toEqual(['SOURCE-SET', 'SECOND-SET']);
    expect(activated.players.self.hand).toEqual(['DRAW']);
    expect(activated.players.self.scene.find((char) => char.uid === uid)!.declaredUseCount.a2).toBe(1);
  });

  it('rejects duplicate, face-up, and insufficient declared-cost picks without mutation', () => {
    const { state: duplicate, uid: duplicateUid } = withSetCards([{ id: 'X', faceUp: false }, { id: 'Y', faceUp: false }]);
    const duplicateId = duplicate.players.self.scene[0]!.setCards[0]!.instanceId;
    const before = JSON.stringify(duplicate);
    expect(canPay(duplicate, B10023.abilities[1]!.cost!, ctx(duplicateUid, [duplicateId, duplicateId]))).toBe(true);
    expect(canActivateDeclaredAbility(duplicate, duplicateUid, 'a2', { removeSetCard: { hostUids: [duplicateUid, duplicateUid], instanceIds: [duplicateId, duplicateId] } })).toBe(false);
    expect(() => produce(duplicate, (draft) => pay(draft, B10023.abilities[1]!.cost!, ctx(duplicateUid, [duplicateId, duplicateId])))).toThrow('invalid removeSetCard picks');
    expect(JSON.stringify(duplicate)).toBe(before);

    const { state: faceUp, uid: faceUpUid } = withSetCards([{ id: 'X', faceUp: false }, { id: 'Y', faceUp: true }]);
    const faceUpIds = faceUp.players.self.scene[0]!.setCards.map((card) => card.instanceId);
    expect(canPay(faceUp, B10023.abilities[1]!.cost!, ctx(faceUpUid, faceUpIds))).toBe(false);

    const { state: insufficient, uid: insufficientUid } = withSetCards([{ id: 'X', faceUp: false }]);
    const insufficientId = insufficient.players.self.scene[0]!.setCards[0]!.instanceId;
    expect(canPay(insufficient, B10023.abilities[1]!.cost!, ctx(insufficientUid, [insufficientId, 'missing']))).toBe(false);
  });

  it('keeps the source active for no hand or optional decline, and can enter the discarded eligible card', () => {
    const noHand = base();
    event.emit(noHand, 'enter', { uid: 'src', viaEffect: false, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', uid: 'src', cardId: 'B10023' });
    runAllUntilEmpty(noHand);
    expect(_drainPendingEffectOptionalSide()).toBeNull();
    expect(noHand.players.self.scene[0]!.state).toBe('active');

    const declined = base();
    declined.players.self.hand = ['TEST_POLICE'];
    event.emit(declined, 'enter', { uid: 'src', viaEffect: false, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', uid: 'src', cardId: 'B10023' });
    runAllUntilEmpty(declined);
    applyOptionalAndContinuation(declined, _drainPendingEffectOptionalSide()!, false);
    expect(declined.players.self.scene[0]!.state).toBe('active');
    expect(declined.players.self.hand).toEqual(['TEST_POLICE']);

    const accepted = base();
    accepted.players.self.hand = ['TEST_POLICE'];
    event.emit(accepted, 'enter', { uid: 'src', viaEffect: false, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', uid: 'src', cardId: 'B10023' });
    runAllUntilEmpty(accepted);
    applyOptionalAndContinuation(accepted, _drainPendingEffectOptionalSide()!, true);
    const discard = _drainPendingEffectPickSide()!;
    expect(discard.atomVerb).toBe('discard');
    applyPickAndContinuation(accepted, discard, discard.candidates[0]!.uid!);
    const enter = _drainPendingEffectPickSide()!;
    expect(enter.atomVerb).toBe('sceneEnter');
    applyPickAndContinuation(accepted, enter, enter.candidates[0]!.uid!);
    expect(accepted.players.self.scene.find((char) => char.uid === 'src')!.state).toBe('sleep');
    expect(accepted.players.self.scene.some((char) => char.cardId === 'TEST_POLICE')).toBe(true);
  });

  it('keeps the promo mechanically identical', () => {
    expect(B10023P.abilities).toEqual(B10023.abilities);
  });

  it('registers the base and promo printings exactly once', () => {
    expect(REUSE_CARDS.filter((card) => card.id === 'B10023' || card.id === 'B10023P').map((card) => card.id))
      .toEqual(['B10023', 'B10023P']);
  });
});
