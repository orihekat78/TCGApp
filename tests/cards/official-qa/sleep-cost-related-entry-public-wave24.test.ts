// qa: card:B07015:90178c65731533021339234d85b8740114d42f59cdc8a453b6336bba3cd197e1
// qa: card:B07002:18266db4732b9571ebae419afbd36f26fb54fb836c7752251e64e6dad817b4d1
// qa: card:B07016:34b5e50478a370f3ee9ce8bf309eeb4e4825d1b3115ec9eeab3024bdaf99dfa9
// qa: card:B07067:af8822a01561a87d2ab1e21dd52ac12867f116177e9257c6a784645d5e09261a
// qa: card:B07067:cbb325dcff012450afb4952c83f39a01b09170f5ef8155ed39e023bd6f5a8b20
// qa: card:B09058:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B09058:7124f41d3267d0e2df2692070acfdd9e66fca11edbbbfb6b64ada8bee4c94b79
// qa: card:B09058:ee4ff12ae2f5d9aaa25b2b03a760a31f15b0d141c59c71aebf70ad2269611e12
// Rules: 03-field-areas.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07002 } from '@/cards/ct-p07/B07002';
import { B07015 } from '@/cards/ct-p07/B07015';
import { B07016 } from '@/cards/ct-p07/B07016';
import { B07067 } from '@/cards/ct-p07/B07067';
import { B09058 } from '@/cards/ct-p09/B09058';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const Q = {
  refreshB07002: '18266db4', turnOneB07016: '34b5e504', equalB07067: 'af8822a0',
  handB07067: 'cbb325dc', enterB09058: '56b2d90b', removedB09058: '7124f41d',
  switchB09058: 'ee4ff12a',
} as const;

const DRAW = 'QA_W24_RELATED_DRAW';
const HAND_A = 'QA_W24_RELATED_HAND_A';
const HAND_B = 'QA_W24_RELATED_HAND_B';
const REFRESH_A = 'QA_W24_RELATED_REFRESH_A';
const REFRESH_B = 'QA_W24_RELATED_REFRESH_B';
const REFRESH_C = 'QA_W24_RELATED_REFRESH_C';
const GREEN_EVENT_A = 'QA_W24_RELATED_GREEN_EVENT_A';
const GREEN_EVENT_B = 'QA_W24_RELATED_GREEN_EVENT_B';
const FILLER = 'QA_W24_RELATED_FILLER';
const AKAI_ENTRY = 'QA_W24_RELATED_AKAI_ENTRY';
const RED_PARTNER = 'QA_W24_RELATED_RED_PARTNER';
const GREEN_PARTNER = 'QA_W24_RELATED_GREEN_PARTNER';

function card(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const enterDraw: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

const fixtures = [
  card(DRAW), card(HAND_A), card(HAND_B), card(REFRESH_A), card(REFRESH_B), card(REFRESH_C),
  card(GREEN_EVENT_A, { kind: 'event', colors: ['緑'], level: 5 }),
  card(GREEN_EVENT_B, { kind: 'event', colors: ['緑'], level: 6 }),
  card(FILLER),
  card(AKAI_ENTRY, { colors: ['赤'], level: 6, traits: ['赤井家'], abilities: [enterDraw] }),
  card(RED_PARTNER, { kind: 'partner', colors: ['赤'], level: 0 }),
  card(GREEN_PARTNER, { kind: 'partner', colors: ['緑'], level: 0 }),
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave 24 related-entry game state');
  return state;
}

function install(state: GameState, label: string): void {
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function base(colors: string[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = colors;
  state.players.self.case.status = '解決編';
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  state.players.self.deck = [DRAW, FILLER];
  return state;
}

function pendingPick(cardId: string, abilityId: string, atomVerb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${cardId}: ${atomVerb} authority`).toMatchObject({
    player: 'self', atomVerb, source: { cardId, abilityId },
  });
  return pending!;
}

function resolvePick(pending: ReturnType<typeof pendingPick>, pickedUid: string | null, pickedUids?: string[], switchRemoveUid?: string): void {
  const action = pickedUids
    ? { type: 'effectPickResolve' as const, pickedUid: pickedUid!, pickedUids }
    : switchRemoveUid
      ? { type: 'effectPickResolve' as const, pickedUid, switchRemoveUid }
      : { type: 'effectPickResolve' as const, pickedUid };
  expect(dispatchEngineAction(bindPendingDecision(pending, action))).toEqual({ ok: true });
}

function expectSettled(label: string): void {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick, `${label}: pick cleared`).toBeNull();
  expect(store.pendingEffectChoice, `${label}: choice cleared`).toBeNull();
  expect(store.pendingEffectOptional, `${label}: optional cleared`).toBeNull();
  expect(store.activeActionId, `${label}: action cleared`).toBeNull();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved'), `${label}: effects resolved`).toBe(true);
  expect(current().pendingRuntimeState, `${label}: runtime cleared`).toBeUndefined();
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('Wave 24 related official Q&A through public actions', () => {
  it(`card:B07002:${Q.refreshB07002}: short-deck draw refreshes immediately, completes two draws, then removes exactly two hand cards`, () => {
    const state = base(['青']);
    state.players.self.hand = [B07002.id, HAND_A, HAND_B];
    state.players.self.deck = [DRAW];
    state.players.self.remove = [REFRESH_A, REFRESH_B, REFRESH_C];
    install(state, 'qa-wave24-B07002-short-refresh');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B07002.id })).toEqual({ ok: true });
    const discard = pendingPick(B07002.id, 'a1', 'discard');
    expect(current().refreshCount.self).toBe(1);
    expect(current().players.self.hand).toHaveLength(4);
    const costs = [HAND_A, HAND_B].map(cardId => discard.candidates.find(candidate => candidate.cardId === cardId)!);
    expect(costs.every(Boolean)).toBe(true);
    resolvePick(discard, costs[0]!.uid, costs.map(candidate => candidate.uid));

    expect(current().players.self.hand).toHaveLength(2);
    expect(current().players.self.scene.some(card => card.cardId === B07002.id)).toBe(true);
    expect(current().players.self.remove).toEqual(expect.arrayContaining([HAND_A, HAND_B]));
    expect(current().players.opp.evidence).toHaveLength(1);
    expectSettled(B07002.id);
  });

  it(`card:B07016:${Q.turnOneB07016}: declining the first event-use removal still consumes its turn-one trigger`, () => {
    const state = base(['緑']);
    state.players.self.partner = { cardId: GREEN_PARTNER, state: 'active', location: 'partner-area' };
    state.players.self.scene = [
      makeChar({ cardId: B07016.id, uid: 'observer', state: 'active' }),
      makeChar({ cardId: B07015.id, uid: 'event-source-a', state: 'active' }),
      makeChar({ cardId: B07015.id, uid: 'event-source-b', state: 'active' }),
    ];
    state.players.self.hand = [GREEN_EVENT_A, GREEN_EVENT_B];
    install(state, 'qa-wave24-B07016-turn-one');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'event-source-a', abilId: 'a1' })).toEqual({ ok: true });
    const firstEvent = pendingPick(B07015.id, 'a1', 'useEventFromHand');
    resolvePick(firstEvent, firstEvent.candidates.find(candidate => candidate.cardId === GREEN_EVENT_A)!.uid);
    const firstRemoval = pendingPick(B07016.id, 'a1', 'sceneRemove');
    expect(firstRemoval.nMin).toBe(0);
    resolvePick(firstRemoval, null);
    expect(readChar.declaredUseCount(current(), 'observer', 'a1')).toBe(1);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'event-source-b', abilId: 'a1' })).toEqual({ ok: true });
    const secondEvent = pendingPick(B07015.id, 'a1', 'useEventFromHand');
    resolvePick(secondEvent, secondEvent.candidates.find(candidate => candidate.cardId === GREEN_EVENT_B)!.uid);

    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(readChar.declaredUseCount(current(), 'observer', 'a1')).toBe(1);
    expect(current().players.self.remove).toEqual(expect.arrayContaining([GREEN_EVENT_A, GREEN_EVENT_B]));
    expectSettled(B07016.id);
  });

  it(`card:B07067:${Q.equalB07067} card:B07067:${Q.handB07067}: the used card has left hand before its equal-hand enter condition`, () => {
    const state = base(['赤']);
    state.players.self.partner = { cardId: RED_PARTNER, state: 'active', location: 'partner-area' };
    state.players.self.hand = [B07067.id, HAND_A];
    state.players.opp.hand = [HAND_B];
    install(state, 'qa-wave24-B07067-equal-hand');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B07067.id })).toEqual({ ok: true });
    expect(current().players.self.hand).toEqual([HAND_A]);
    expect(current().players.opp.hand).toEqual([HAND_B]);
    const removal = pendingPick(B07067.id, 'a1', 'sceneRemove');
    expect(removal.nMin).toBe(0);
    resolvePick(removal, null);
    expectSettled(B07067.id);
  });

  it(`card:B09058:${Q.enterB09058} card:B09058:${Q.removedB09058} card:B09058:${Q.switchB09058}: paid hand card effect-enters, fires, and may switch out the source at a full scene`, () => {
    const state = base(['赤']);
    state.players.self.hand = [B09058.id, AKAI_ENTRY];
    state.players.self.scene = Array.from({ length: 5 }, (_, index) => makeChar({
      cardId: FILLER, uid: `full-${index}`, state: 'active',
    }));
    state.players.self.deck = [DRAW, FILLER];
    install(state, 'qa-wave24-B09058-entry-switch');

    expect(dispatchEngineAction({
      type: 'handUseCardSwitch', player: 'self', cardId: B09058.id, removeUid: 'full-0',
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional?.source).toMatchObject({ cardId: B09058.id, abilityId: 'a1' });
    expect(dispatchEngineAction(bindPendingDecision(optional!, { type: 'optionalResolve', run: true }))).toEqual({ ok: true });

    const discard = pendingPick(B09058.id, 'a1', 'discard');
    const handCost = discard.candidates.find(candidate => candidate.cardId === AKAI_ENTRY)!;
    expect(handCost).toBeTruthy();
    resolvePick(discard, handCost.uid);

    const entry = pendingPick(B09058.id, 'a1', 'sceneEnter');
    expect(current().players.self.remove).toContain(AKAI_ENTRY);
    const candidate = entry.candidates.find(item => item.cardId === AKAI_ENTRY)!;
    expect(candidate).toBeTruthy();
    const sourceUid = current().players.self.scene.find(item => item.cardId === B09058.id)!.uid;
    resolvePick(entry, candidate.uid, undefined, sourceUid);

    const after = current();
    expect(after.players.self.scene).toHaveLength(5);
    expect(after.players.self.scene.some(item => item.uid === sourceUid)).toBe(false);
    expect(after.players.self.scene.find(item => item.cardId === AKAI_ENTRY)?.state).toBe('active');
    expect(after.players.self.remove).toContain(B09058.id);
    expect(after.players.self.remove).not.toContain(AKAI_ENTRY);
    expect(after.players.self.hand).toContain(DRAW);
    expectSettled(B09058.id);
  });
});
