// qa: card:B09056:33271f1e19ae0c4fa4f2f6b6aa1f038e58c6c82bef4e1d59394a5ddb47300767
// qa: card:B10023:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:PR291:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:PR297:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// Rules: 13, 15, 17, 20, 25. Outer enter/event effects finish before
// the effect-entered character's own normal enter ability resolves.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09056 } from '@/cards/ct-p09/B09056';
import { B10023, B10023P } from '@/cards/ct-p10/B10023';
import { PR291 } from '@/cards/pr-01/PR291';
import { PR297 } from '@/cards/pr-01/PR297';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const DRAW = 'W55_DRAW';
const FILLER = 'W55_FILLER';
const RED_PARTNER = 'W55_RED_PARTNER';
const GREEN_PARTNER = 'W55_GREEN_PARTNER';
const WHITE_PARTNER = 'W55_WHITE_PARTNER';
const BLACK_ENTRY = 'W55_BLACK_ENTRY';
const BLACK_HIGH = 'W55_BLACK_HIGH';
const BLACK_WRONG = 'W55_BLACK_WRONG';
const DISCARD = 'W55_DISCARD';
const GREEN_POLICE = 'W55_GREEN_POLICE';
const GREEN_HIGH = 'W55_GREEN_HIGH';
const GREEN_WRONG = 'W55_GREEN_WRONG';
const KID = 'W55_KID';
const WHITE_ENTRY = 'W55_WHITE_ENTRY';
const WHITE_HIGH = 'W55_WHITE_HIGH';
const WHITE_WRONG = 'W55_WHITE_WRONG';
const REMOVE_TARGET = 'W55_REMOVE_TARGET';

const enterDraw: AbilityDef = {
  id: 'enter-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '登場時に1枚引く。', ruleRefs: [],
};

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

const FIXTURES: CardDef[] = [
  fixture(DRAW), fixture(FILLER), fixture(DISCARD),
  fixture(RED_PARTNER, { kind: 'partner', colors: ['赤'] }),
  fixture(GREEN_PARTNER, { kind: 'partner', colors: ['緑'] }),
  fixture(WHITE_PARTNER, { kind: 'partner', colors: ['白'] }),
  fixture(BLACK_ENTRY, { colors: ['黒'], level: 3, abilities: [enterDraw] }),
  fixture(BLACK_HIGH, { colors: ['黒'], level: 4, abilities: [enterDraw] }),
  fixture(BLACK_WRONG, { colors: ['青'], level: 3, abilities: [enterDraw] }),
  fixture(GREEN_POLICE, { colors: ['緑'], traits: ['警察'], level: 6, abilities: [enterDraw] }),
  fixture(GREEN_HIGH, { colors: ['緑'], traits: ['警察'], level: 7, abilities: [enterDraw] }),
  fixture(GREEN_WRONG, { colors: ['緑'], traits: ['探偵'], level: 6, abilities: [enterDraw] }),
  fixture(KID, { names: ['怪盗キッド'], colors: ['白'], level: 7 }),
  fixture(WHITE_ENTRY, { colors: ['白'], level: 3, abilities: [enterDraw] }),
  fixture(WHITE_HIGH, { colors: ['白'], level: 4, abilities: [enterDraw] }),
  fixture(WHITE_WRONG, { colors: ['青'], level: 3, abilities: [enterDraw] }),
  fixture(REMOVE_TARGET, { ap: 8000 }),
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave55 state');
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-w55-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, atomVerb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${cardId}: ${atomVerb} authority`).toMatchObject({
    player: 'self', atomVerb, source: { cardId, abilityId },
  });
  return pending!;
}

function resolveCandidate(
  cardId: string,
  abilityId: string,
  atomVerb: string,
  target: string,
  excluded: string[] = [],
): void {
  const pending = pendingPick(cardId, abilityId, atomVerb);
  const ids = pending.candidates.map(candidate => candidate.cardId);
  expect(ids, `${cardId}: includes target`).toContain(target);
  excluded.forEach(decoy => expect(ids, `${cardId}: excludes ${decoy}`).not.toContain(decoy));
  const picked = pending.candidates.find(candidate => candidate.cardId === target)!;
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: picked.uid,
  }))).toEqual({ ok: true });
}

function resolveOptional(cardId: string, run: boolean): void {
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional, `${cardId}: optional authority`).toMatchObject({
    player: 'self', source: { cardId, abilityId: 'a1' },
  });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
}

function expectNormalEnter(cardId: string, state: 'active' | 'sleep'): void {
  expect(current().players.self.scene.find(character => character.cardId === cardId)?.state).toBe(state);
  expect(current().pendingEffects.filter(entry => (
    entry.source.cardId === cardId && entry.source.abilityId === enterDraw.id
  )).map(entry => entry.state), `${cardId}: entrant enter source`).toEqual(['resolved']);
  const actions = current().log.map(entry => entry.action);
  expect(actions.lastIndexOf('effect:draw')).toBeGreaterThan(actions.lastIndexOf('effect:sceneEnter'));
}

function resolveOwnerOrder(cardId: string): void {
  const group = pendingOwnerOrderGroup(current(), 'self');
  if (group.length < 2) return;
  expect(group.some(entry => entry.source.cardId === cardId && entry.source.abilityId === 'a1')).toBe(true);
  const ordered = [...group].sort((left, right) => (
    left.source.cardId === cardId ? -1 : right.source.cardId === cardId ? 1 : 0
  ));
  expect(dispatchEngineAction({
    type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map(entry => entry.id),
  })).toEqual({ ok: true });
}

function b09056State(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner.cardId = RED_PARTNER;
  state.players.self.case.colors = ['赤', '黒'];
  state.players.self.file = Array.from({ length: 8 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  state.players.self.hand = [B09056.id];
  state.players.self.remove = [BLACK_ENTRY, BLACK_HIGH, BLACK_WRONG];
  state.players.self.deck = [DRAW, FILLER];
  state.players.opp.scene = [sceneChar(FILLER, 'opp-one')];
  state.players.opp.deck = [FILLER, FILLER, FILLER, FILLER];
  state.scratchTrace.self = '発見済';
  return state;
}

function openB09056Choice(label: string) {
  install(b09056State(), label);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B09056.id }))
    .toEqual({ ok: true });
  resolveOwnerOrder(B09056.id);
  resolveOptional(B09056.id, true);
  const removal = pendingPick(B09056.id, 'a1', 'sceneRemove');
  expect(removal.nMin).toBe(0);
  expect(dispatchEngineAction(bindPendingDecision(removal, {
    type: 'effectPickResolve', pickedUid: null,
  }))).toEqual({ ok: true });
  const choice = useGameStateStore.getState().pendingEffectChoice;
  expect(choice, 'B09056 always surfaces both printed branches').toMatchObject({
    player: 'self', source: { cardId: B09056.id, uid: expect.any(String), abilityId: 'a1' },
  });
  expect(choice?.options).toHaveLength(2);
  return choice!;
}

function provePartnerEvent(card: CardDef) {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner.cardId = WHITE_PARTNER;
  state.players.self.case.colors = ['白'];
  state.players.self.case.status = '解決編';
  state.players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  state.players.self.hand = [card.id, WHITE_ENTRY, WHITE_HIGH, WHITE_WRONG];
  state.players.self.scene = [sceneChar(KID, 'bond')];
  state.players.self.deck = [DRAW, FILLER];
  state.players.opp.scene = [sceneChar(REMOVE_TARGET, 'remove-target', { state: 'sleep' })];
  install(state, card.id);

  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id }))
    .toEqual({ ok: true });
  resolveCandidate(card.id, 'a1', 'sceneRemove', REMOVE_TARGET);
  resolveCandidate(card.id, 'a1', 'sceneEnter', WHITE_ENTRY, [WHITE_HIGH, WHITE_WRONG]);
  expectNormalEnter(WHITE_ENTRY, 'sleep');
  const actions = current().log.map(entry => entry.action);
  return {
    partnerArea: [...(current().players.self.partnerAreaCards ?? [])],
    targetRemoved: current().players.opp.remove.includes(REMOVE_TARGET),
    enteredState: current().players.self.scene.find(character => character.cardId === WHITE_ENTRY)?.state,
    enterResolved: current().pendingEffects.some(entry => entry.source.cardId === WHITE_ENTRY
      && entry.source.abilityId === enterDraw.id && entry.state === 'resolved'),
    entryAfterPartner: actions.lastIndexOf('effect:sceneEnter') > actions.lastIndexOf('effect:toPartnerArea'),
    remainingHand: [...current().players.self.hand].sort(),
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave55: nested and event effect-entry routes', () => {
  it('B09056 keeps the printed choice after zero removal, then fires the found-trace entrant', () => {
    const choice = openB09056Choice('B09056-found');
    expect(dispatchEngineAction(bindPendingDecision(choice, {
      type: 'choiceResolve', choiceIndex: 0,
    }))).toEqual({ ok: true });
    resolveCandidate(B09056.id, 'a1', 'sceneEnter', BLACK_ENTRY, [BLACK_HIGH, BLACK_WRONG]);
    expectNormalEnter(BLACK_ENTRY, 'sleep');
    expect(current().pendingEffects.some(entry => entry.source.cardId === BLACK_ENTRY
      && entry.source.abilityId === enterDraw.id && entry.state === 'resolved')).toBe(true);
    expect(current().players.self.scene.find(character => character.cardId === B09056.id)?.state).toBe('sleep');
    const outer = current().pendingEffects.filter(entry => (
      entry.source.cardId === B09056.id && entry.source.abilityId === 'a1'
    ));
    expect(outer.length).toBeGreaterThan(0);
    expect(outer.every(entry => entry.state === 'resolved')).toBe(true);
  });

  it('B09056 permits the inapplicable printed branch and resolves it as no-op', () => {
    const choice = openB09056Choice('B09056-noop-branch');
    const beforeDeck = [...current().players.opp.deck];
    expect(dispatchEngineAction(bindPendingDecision(choice, {
      type: 'choiceResolve', choiceIndex: 1,
    }))).toEqual({ ok: true });
    expect(current().players.opp.deck).toEqual(beforeDeck);
    expect(current().players.self.scene.some(character => character.cardId === BLACK_ENTRY)).toBe(false);
    expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('B10023 outer enter sleeps/discards before the nested Police entrant fires normally', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner.cardId = GREEN_PARTNER;
    state.players.self.case.colors = ['緑'];
    state.players.self.case.status = '解決編';
    state.players.self.file = Array.from({ length: 7 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
    state.players.self.hand = [B10023.id, DISCARD];
    state.players.self.remove = [GREEN_POLICE, GREEN_HIGH, GREEN_WRONG];
    state.players.self.deck = [DRAW, FILLER];
    install(state, B10023.id);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B10023.id }))
      .toEqual({ ok: true });
    resolveOptional(B10023.id, true);
    resolveCandidate(B10023.id, 'a1', 'discard', DISCARD);
    resolveCandidate(B10023.id, 'a1', 'sceneEnter', GREEN_POLICE, [GREEN_HIGH, GREEN_WRONG]);
    expectNormalEnter(GREEN_POLICE, 'active');
    expect(current().pendingEffects.some(entry => entry.source.cardId === GREEN_POLICE
      && entry.source.abilityId === enterDraw.id && entry.state === 'resolved')).toBe(true);
    expect(current().players.self.scene.find(character => character.cardId === B10023.id)?.state).toBe('sleep');
    expect(current().players.self.remove).toContain(DISCARD);
    expect(B10023P.abilities).toEqual(B10023.abilities);
  });

  it('B10023 with no post-use hand cannot open the optional or false nested entry', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner.cardId = GREEN_PARTNER;
    state.players.self.case.colors = ['緑'];
    state.players.self.case.status = '解決編';
    state.players.self.file = Array.from({ length: 7 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
    state.players.self.hand = [B10023.id];
    state.players.self.remove = [GREEN_POLICE];
    install(state, `${B10023.id}-no-hand`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B10023.id }))
      .toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.scene.find(character => character.cardId === B10023.id)?.state).toBe('active');
    expect(current().players.self.remove).toContain(GREEN_POLICE);
  });

  it('PR291 physical event reaches partner area before its sleeping entrant fires', () => {
    expect(provePartnerEvent(PR291)).toEqual({
      partnerArea: [PR291.id], targetRemoved: true, enteredState: 'sleep', enterResolved: true,
      entryAfterPartner: true, remainingHand: [DRAW, WHITE_HIGH, WHITE_WRONG].sort(),
    });
  });

  it('PR297 physical event reaches partner area before its sleeping entrant fires', () => {
    expect(provePartnerEvent(PR297)).toEqual({
      partnerArea: [PR297.id], targetRemoved: true, enteredState: 'sleep', enterResolved: true,
      entryAfterPartner: true, remainingHand: [DRAW, WHITE_HIGH, WHITE_WRONG].sort(),
    });
  });

  it('PR291 partner-only Kid does not satisfy Bond or surface a false entry', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner.cardId = KID;
    state.players.self.case.colors = ['白'];
    state.players.self.case.status = '解決編';
    state.players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
    state.players.self.hand = [PR291.id, WHITE_ENTRY];
    install(state, `${PR291.id}-partner-only`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: PR291.id }))
      .toEqual({ ok: true });
    surfacePendingSideChannels();
    const removal = useGameStateStore.getState().pendingEffectPick;
    if (removal) {
      expect(dispatchEngineAction(bindPendingDecision(removal, {
        type: 'effectPickResolve', pickedUid: null,
      }))).toEqual({ ok: true });
    }
    expect(current().players.self.partnerAreaCards).toContain(PR291.id);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.hand).toContain(WHITE_ENTRY);
  });
});
