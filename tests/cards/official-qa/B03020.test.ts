// qaId=card:B03020:7e1b89161d4cc08ba1dd9f60c2dd203d56a0d75ebc1fe8ce0ada2bb43af5a270
// qaId=card:B03020:9e084cf085f22eef16c2055f8f9232946d3ea27dccdc48e09f6017c75558a781
// Official Q&A B03020: fewer than three cards cannot resolve the effect.
// rules: 07-action-flow.md, 14-refresh.md, 15-abilities-effects.md, 26-qa-deck-refresh.md

import { beforeEach, describe, expect, it } from 'vitest';
import { advance, declare, passGuard, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { runAllUntilEmpty } from '@/engine/resolve';
import { event } from '@/engine/event';
import { mutate } from '@/engine/mutate';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { registerTriggeredListener, _resetTriggeredRegistered, _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingEffectOptionalSide, _clearPendingEffectOptionalSide } from '@/engine/effect/pending-state';
import { applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { B03020 } from '@/cards/ct-p03/B03020';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import type { CardDef, GameState } from '@/engine/types';

const EXACT_THREE_QA_ID = 'card:B03020:7e1b89161d4cc08ba1dd9f60c2dd203d56a0d75ebc1fe8ce0ada2bb43af5a270';
const DECLARE_BEFORE_GUARD_QA_ID = 'card:B03020:9e084cf085f22eef16c2055f8f9232946d3ea27dccdc48e09f6017c75558a781';

const MATCH: CardDef = {
  id: 'B03020_MATCH', no: 'B03020_MATCH', kind: 'character', names: ['妃英理'],
  colors: ['赤'], level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const DECOY: CardDef = {
  id: 'B03020_DECOY', no: 'B03020_DECOY', kind: 'character', names: ['蘭の友人'],
  colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

function setup(deck: string[], owner: 'self' | 'opp' = 'self'): { s: GameState; uid: string } {
  const s = createEmptyGameState();
  const target = owner === 'self' ? 'opp' : 'self';
  s.turn = { number: 3, player: owner, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players[owner].deck = [...deck];
  s.players[target].evidence = [{ cardId: DECOY.id, faceUp: false, origin: { turn: 1, via: 'opening' } }];
  const uid = mutate.scene.enter(s, owner, 'B03020', {}).uid;
  return { s, uid };
}

function beginDeclaration(s: GameState, uid: string, owner: 'self' | 'opp' = 'self') {
  const target = owner === 'self' ? 'opp' : 'self';
  const ax = declare(s, uid, { kind: 'case', player: target });
  runAllUntilEmpty(s);
  const pending = _drainPendingEffectOptionalSide();
  expect(pending, 'action:declare must surface B03020 optional').not.toBeNull();
  return { ax, pending: pending! };
}

function declareAndChoose(s: GameState, uid: string, take: boolean, owner: 'self' | 'opp' = 'self') {
  const { ax, pending } = beginDeclaration(s, uid, owner);
  applyOptionalAndContinuation(s, pending, take);
  runAllUntilEmpty(s);
  return ax;
}

function declareAndChooseThroughPublicDispatch(s: GameState, uid: string, take: boolean) {
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: s, pendingEffectOptional: null });
  expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: uid, targetPlayer: 'opp' })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending, `${EXACT_THREE_QA_ID}: declaration surfaces B03020 optional`).not.toBeNull();
  expect(dispatchCurrentDecision({ type: 'optionalResolve', run: take })).toEqual({ ok: true });
  return useGameStateStore.getState().gameState!;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  _resetActionContexts();
  _clearPendingEffectOptionalSide();
  _setHumanPlayerSide('self');
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null, pendingEffectOptional: null });
  for (const card of [B03020, MATCH, DECOY]) registerCardDef(card);
  registerTriggeredListener();
});

describe('B03020 official-QA exact-three reveal gate', () => {
  it(`${DECLARE_BEFORE_GUARD_QA_ID}: public declaration resolves B03020 before guard choice becomes available`, () => {
    const { s, uid } = setup([MATCH.id, DECOY.id, DECOY.id]);
    useGameStateStore.getState().resetMatchSessionState();
    useGameStateStore.setState({ gameState: s, pendingEffectOptional: null });

    expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: uid, targetPlayer: 'opp' })).toEqual({ ok: true });
    const store = useGameStateStore.getState();
    expect(store.pendingEffectOptional?.source.cardId, `${DECLARE_BEFORE_GUARD_QA_ID}: B03020 trigger is surfaced`).toBe(B03020.id);
    expect(store.gameState?.actionContexts?.[store.activeActionId!]?.phase, `${DECLARE_BEFORE_GUARD_QA_ID}: action has reached the guard window after the trigger`).toBe('guard-window');
    expect(
      dispatchEngineAction({ type: 'actionGuard', actionId: store.activeActionId!, guarderUid: null }),
      `${DECLARE_BEFORE_GUARD_QA_ID}: guard choice is blocked until B03020 resolves`,
    ).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchCurrentDecision({ type: 'optionalResolve', run: false })).toEqual({ ok: true });
    expect(
      dispatchEngineAction({ type: 'actionGuard', actionId: store.activeActionId!, guarderUid: null }),
      `${DECLARE_BEFORE_GUARD_QA_ID}: guard choice opens after B03020 resolves`,
    ).toEqual({ ok: true });
  });

  it('keeps the activation gate after JSON descriptor serialization', () => {
    const revived = JSON.parse(JSON.stringify(B03020)) as CardDef;
    expect(revived.abilities[0]?.effect).toMatchObject({
      kind: 'optional',
      effect: { kind: 'conditional', if: { kind: 'deckAtLeast', player: 'self', n: 3 } },
    });
  });

  it('executes the JSON-revived CardDef through the real listener and exact-three gate', () => {
    const revived = JSON.parse(JSON.stringify(B03020)) as CardDef;
    _resetRegistry();
    for (const card of [revived, MATCH, DECOY]) registerCardDef(card);
    const { s, uid } = setup([MATCH.id, DECOY.id]);
    const before = [...s.players.self.deck];
    declareAndChoose(s, uid, true);
    expect(s.players.self.deck).toEqual(before);
    expect(s.log.some(entry => entry.action === 'effect:deckRevealUntil')).toBe(false);
  });

  it.each([0, 1, 2])('deck %i: public action optional accepted, but exact-three gate leaves deck/AP/remove unchanged', (count) => {
    const { s, uid } = setup(Array.from({ length: count }, () => MATCH.id));
    const apBefore = readChar.ap(s, uid);
    const deckBefore = [...s.players.self.deck];
    declareAndChoose(s, uid, true);

    expect(s.players.self.deck).toEqual(deckBefore);
    expect(s.players.self.remove).toEqual([]);
    expect(readChar.ap(s, uid)).toBe(apBefore);
    expect(s.log.some(entry => entry.action === 'effect:deckRevealUntil')).toBe(false);
    expect(s.log.some(entry => entry.action === 'effect:boundToRemove')).toBe(false);
  });

  it(`${EXACT_THREE_QA_ID}: public dispatch keeps a two-card deck unchanged after accepting B03020`, () => {
    const { s, uid } = setup([MATCH.id, DECOY.id]);
    const apBefore = readChar.ap(s, uid);
    const after = declareAndChooseThroughPublicDispatch(s, uid, true);

    expect(after.players.self.deck, `${EXACT_THREE_QA_ID}: short deck is not revealed or removed`).toEqual([MATCH.id, DECOY.id]);
    expect(after.players.self.remove, `${EXACT_THREE_QA_ID}: short deck moves no card to remove`).toEqual([]);
    expect(readChar.ap(after, uid), `${EXACT_THREE_QA_ID}: short deck grants no action AP`).toBe(apBefore);
    expect(after.log.some(entry => entry.action === 'effect:deckRevealUntil'), `${EXACT_THREE_QA_ID}: reveal atom is skipped`).toBe(false);
  });

  it('deck 3 + match: action declaration is before guard, resolves all three, gives action AP, then refreshes', () => {
    const { s, uid } = setup([MATCH.id, DECOY.id, DECOY.id]);
    const apBefore = readChar.ap(s, uid);
    declareAndChoose(s, uid, true);

    expect(s.players.self.scene.find(char => char.uid === uid)?.state).toBe('sleep');
    expect(readChar.ap(s, uid)).toBe(apBefore + 1000);
    expect(s.log.filter(entry => entry.action === 'effect:boundToRemove').map(entry => entry.result)).toEqual(['2', '1']);
    expect(s.players.self.deck).toHaveLength(3); // exact-three removal reaches refresh boundary
    expect(s.players.self.remove).toEqual([]);
  });

  it('deck 3 + no match: all three still resolve/remove, but AP is unchanged', () => {
    const { s, uid } = setup([DECOY.id, DECOY.id, DECOY.id]);
    const apBefore = readChar.ap(s, uid);
    declareAndChoose(s, uid, true);

    expect(readChar.ap(s, uid)).toBe(apBefore);
    expect(s.log.filter(entry => entry.action === 'effect:boundToRemove').map(entry => entry.result)).toEqual(['3']);
    expect(s.players.self.deck).toHaveLength(3);
  });

  it('optional decline: neither the exact-three gate nor later effects run', () => {
    const { s, uid } = setup([MATCH.id, DECOY.id, DECOY.id]);
    const apBefore = readChar.ap(s, uid);
    declareAndChoose(s, uid, false);

    expect(readChar.ap(s, uid)).toBe(apBefore);
    expect(s.players.self.deck).toEqual([MATCH.id, DECOY.id, DECOY.id]);
    expect(s.log.some(entry => entry.action === 'effect:deckRevealUntil')).toBe(false);
  });

  it('resolves source-relative deckAtLeast for an opp-owned B03020', () => {
    _setHumanPlayerSide('opp');
    const { s, uid } = setup([MATCH.id, DECOY.id, DECOY.id], 'opp');
    const apBefore = readChar.ap(s, uid);
    declareAndChoose(s, uid, true, 'opp');
    expect(readChar.ap(s, uid)).toBe(apBefore + 1000);
    expect(s.log.find(entry => entry.action === 'effect:deckRevealUntil')?.player).toBe('opp');
  });

  it('clears the action-scoped AP bonus when that action ends', () => {
    const { s, uid } = setup([MATCH.id, DECOY.id, DECOY.id]);
    const apBefore = readChar.ap(s, uid);
    const ax = declareAndChoose(s, uid, true);
    expect(readChar.ap(s, uid)).toBe(apBefore + 1000);
    passGuard(s, ax);
    advance(s, ax); // judge -> contact-end
    advance(s, ax); // contact-end -> action-end, scope cleanup
    expect(readChar.ap(s, uid)).toBe(apBefore);
  });

});
