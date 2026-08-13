// Official Q&A certification: public dispatch paths only.
import { beforeEach, describe, expect, it } from 'vitest';
import { B03002 } from '@/cards/ct-p03/B03002';
import { B03078 } from '@/cards/ct-p03/B03078';
import { B05005 } from '@/cards/ct-p05/B05005';
import { PR296 } from '@/cards/pr-01/PR296';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const QA = {
  b03002NoUse: 'card:B03002:1a10996dd8c0a3a021039cf2bc3af89aa897fe0d5d6c6f2c7bedf7e9e005b707',
  b03002Zero: 'card:B03002:23c9bd7209af9bd9d812ae6f4607207f920a91b7b692105dc6b17b3c3d655bf2',
  b03002Enter: 'card:B03002:fead5e283504803d65d2dd745e3ca46752d70e3ea03250dc050a23eaefb57626',
  b03002Event: 'card:B03002:32dfdf12d183f78c1bf123cbe67660e3b1299585ac3db54acd8020d208b98bee',
  b03002Copies: 'card:B03002:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9',
  b03002Self: 'card:B03002:b1f7b5e6df788275f00be38b6902f95648f0ce080d9a88e3f22c5c940a8af860',
  b03002Declared: 'card:B03002:bfc5269bff8bf94b5858f537c65f7a799c6d413cd68611be33baf8e15bbe4071',
  b05005NoUse: 'card:B05005:164b2e66f982e360a525f5b7f90dc085377179475925e450baf48864064033c1',
  b05005Zero: 'card:B05005:9d12855c9753675d25e0cde7fba3c66cfab4bd9ce9c8a87541021dc19b506665',
  b05005Enter: 'card:B05005:dcfd322f5b315270bf3c06e56e5acf285ac62a5f5b71d38b148d652df71b8b14',
  b05005Event: 'card:B05005:4cbc051fc5b2cbaf0d66ef6248bb40e0f4dd2b32529c92f8f7962fe74b8dc125',
  b05005Self: 'card:B05005:e0064498d893cded43d2bddfb89a48bca47cda3d7211eccc52510b0e0d22bde8',
  b05005Required: 'card:B05005:6b3466d6028ee8cf6bd4dc34f5b93627c4da5a38c1229747dde4f1ba5a8b8ee6',
  b05005TwoActive: 'card:B05005:68a46ef50ff20d887ed135004d61a329e0a293d011f356d69901362a2d47ed0e',
  b05005SleepGuard: 'card:B05005:e95bb3042c0b617f223a250bfd13d058966a85d2f3cb42a92016df93ceba9608',
} as const;

const BLUE = B03002.colors[0]!;
const DETECTIVE = B03002.traits[0]!;
const SCOUT_TRAIT = B03002.traits.at(-1)!;
const SCOUT = 'QA_SCOUT';
const FILE_FILLER = 'QA_FILE_FILLER';
const DRAW_MARKER = 'QA_DRAW_MARKER';
const EVENT = 'QA_EVENT';
const ENTER = 'QA_ENTER';
const DECLARER = 'QA_DECLARER';
const ATTACKER = 'QA_ATTACKER';
const TARGET = 'QA_TARGET';
const GUARD = 'QA_GUARD';
const PARTNER = 'QA_BLUE_PARTNER';

function card(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: [BLUE], level: 1, ap: 1000, lp: 1,
    traits: [DETECTIVE], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...options,
  };
}

const draw: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene',
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};
const enterDraw: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};
const eventDraw: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (payload: unknown) => (payload as { kind?: unknown }).kind === 'event-use' },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};
const fixtures = [
  card(SCOUT, { traits: [DETECTIVE, SCOUT_TRAIT] }),
  card(FILE_FILLER), card(DRAW_MARKER),
  card(EVENT, { kind: 'event', abilities: [eventDraw] }),
  card(ENTER, { abilities: [enterDraw] }),
  card(DECLARER, { traits: [DETECTIVE, SCOUT_TRAIT], abilities: [draw] }),
  card(ATTACKER), card(TARGET), card(GUARD),
  card(PARTNER, { kind: 'partner' }),
];

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [BLUE];
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: FILE_FILLER }));
  state.players.self.deck = [DRAW_MARKER, FILE_FILLER, FILE_FILLER, FILE_FILLER];
  return state;
}

function setState(state: GameState): void {
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: state });
}

function putInFile(state: GameState, cardId: string, fromEnd = 1): void {
  state.players.self.file[state.players.self.file.length - fromEnd] = { type: 'card-back', cardId };
}

function setBluePartner(state: GameState): void {
  state.players.self.partner.cardId = PARTNER;
}

function next(cardId?: string): void {
  expect(dispatchEngineAction({ type: 'nextHint', player: 'self', optionalCardId: cardId })).toEqual({ ok: true });
}

function pending(cardId: 'B03002' | 'B05005') {
  return useGameStateStore.getState().gameState!.pendingEffects.filter((entry) => entry.source.cardId === cardId && entry.source.abilityId === 'a1');
}

function visibleOrder(cardIds: string[], firstCardId: string): void {
  const visible = useGameStateStore.getState().gameState!.pendingEffects
    .filter((entry) => entry.state === 'pending' && entry.source.player === 'self' && cardIds.includes(entry.source.cardId));
  expect(visible.map((entry) => entry.source.cardId).sort()).toEqual([...cardIds].sort());
  const first = visible.find((entry) => entry.source.cardId === firstCardId)!;
  expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: first.id, order: 0, player: 'self' })).toEqual({ ok: true });
  const ordered = useGameStateStore.getState().gameState!.pendingEffects
    .filter((entry) => visible.some((shown) => shown.id === entry.id))
    .sort((a, b) => (a.ownerChosenOrder ?? Infinity) - (b.ownerChosenOrder ?? Infinity));
  expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: ordered.map((entry) => entry.id), player: 'self' })).toEqual({ ok: true });
}

function resolveVisibleOrder(entries: ReturnType<typeof pending>, firstEntryId: string): void {
  const visible = useGameStateStore.getState().gameState!.pendingEffects
    .filter((entry) => entry.state === 'pending' && entries.some((shown) => shown.id === entry.id));
  expect(visible.map((entry) => entry.id).sort()).toEqual(entries.map((entry) => entry.id).sort());
  expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: firstEntryId, order: 0, player: 'self' })).toEqual({ ok: true });
  const ordered = useGameStateStore.getState().gameState!.pendingEffects
    .filter((entry) => visible.some((shown) => shown.id === entry.id))
    .sort((a, b) => (a.ownerChosenOrder ?? Infinity) - (b.ownerChosenOrder ?? Infinity));
  expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: ordered.map((entry) => entry.id), player: 'self' })).toEqual({ ok: true });
}

function resolvePick(pickedUid: string | null): void {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).not.toBeNull();
  expect(dispatchEngineAction(bindPendingDecision(pick!, { type: 'effectPickResolve', pickedUid }))).toEqual({ ok: true });
}

function resolveDeckReorder(): void {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  if (store.pendingDeckReveal) {
    store.setPendingDeckReveal(null);
    surfacePendingSideChannels();
  }
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  if (reorder) {
    expect(dispatchEngineAction(bindPendingDecision(reorder, { type: 'deckReorderResolve', order: reorder.cardIds }))).toEqual({ ok: true });
  }
}

function markRequired(targetUid: string, uid = 'partnerMR:self', abilId = 'a2'): void {
  expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId })).toEqual({ ok: true });
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick!;
  expect(pick.source.abilityId).toBe(abilId);
  expect(dispatchEngineAction(bindPendingDecision(pick, { type: 'effectPickResolve', pickedUid: targetUid }))).toEqual({ ok: true });
}

function declareAction(attackerUid: string, targetUid: string): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: attackerUid, targetUid })).toEqual({ ok: true });
  return useGameStateStore.getState().activeActionId!;
}

beforeEach(() => {
  event._resetRegistry(); _resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter();
  register(B03002); register(B03078); register(B05005); register(PR296); fixtures.forEach(register); registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
});

describe('B03002 / B05005 official Q&A', () => {
  it(`${QA.b03002NoUse}: a no-use hint leaves the later same-turn use eligible`, () => {
    const state = base(); mutate.scene.enter(state, 'self', B03002.id, {}); state.players.self.hand = [SCOUT]; setState(state);
    next(); expect(pending(B03002.id)).toHaveLength(0);
    next(SCOUT);
    expect(pending(B03002.id)).toHaveLength(1);
  });

  it(`${QA.b03002Zero}: zero selection fires once and a later same-turn use adds no trigger`, () => {
    const state = base(); mutate.scene.enter(state, 'self', B03002.id, {}); state.players.self.hand = [SCOUT, SCOUT]; setState(state);
    next(SCOUT); resolvePick(null); resolveDeckReorder();
    expect(pending(B03002.id)).toHaveLength(1);
    next(SCOUT);
    expect(pending(B03002.id)).toHaveLength(1);
  });

  it(`${QA.b03002Enter}: character entry and its observer are owner ordered through the public surface`, () => {
    const state = base(); mutate.scene.enter(state, 'self', B03002.id, {}); putInFile(state, ENTER); setState(state);
    next(ENTER); visibleOrder([B03002.id, ENTER], ENTER);
    expect(useGameStateStore.getState().gameState!.players.self.hand).toContain(DRAW_MARKER);
  });

  it(`${QA.b03002Event}: an event body mutation completes before the observer resolves`, () => {
    const state = base(); mutate.scene.enter(state, 'self', B03002.id, {}); putInFile(state, EVENT); setState(state);
    expect(state.players.self.hand).not.toContain(DRAW_MARKER);
    next(EVENT);
    expect(useGameStateStore.getState().gameState!.players.self.hand).toContain(DRAW_MARKER);
    expect(pending(B03002.id)).toHaveLength(1);
  });

  it(`${QA.b03002Copies}: copies are mandatory and owner-selectable`, () => {
    const state = base(); mutate.scene.enter(state, 'self', B03002.id, {}); mutate.scene.enter(state, 'self', B03002.id, {}); state.players.self.hand = [SCOUT]; state.players.self.deck = [SCOUT, SCOUT, SCOUT, SCOUT]; setState(state);
    next(SCOUT); const entries = pending(B03002.id); expect(entries).toHaveLength(2);
    const second = entries.at(-1)!;
    resolveVisibleOrder(entries, second.id);
    expect(useGameStateStore.getState().gameState!.pendingEffects.find((entry) => entry.id === second.id)).toMatchObject({ ownerChosenOrder: 0, ownerOrderConfirmed: true });
    resolvePick(useGameStateStore.getState().pendingEffectPick!.candidates[0]!.uid); resolveDeckReorder();
    resolvePick(useGameStateStore.getState().pendingEffectPick!.candidates[0]!.uid); resolveDeckReorder();
    expect(useGameStateStore.getState().gameState!.pendingEffects.filter((entry) => entries.some((shown) => shown.id === entry.id) && entry.state === 'resolved')).toHaveLength(2);
  });

  it(`${QA.b03002Self}: the card used by Next Hint does not observe itself, but a later eligible use does`, () => {
    const state = base(); putInFile(state, B03002.id); state.players.self.hand = [SCOUT]; setState(state);
    next(B03002.id); expect(pending(B03002.id)).toHaveLength(0);
    next(SCOUT); expect(pending(B03002.id)).toHaveLength(1);
  });

  it(`${QA.b03002Declared}: a public declared ability produces its distinct observer`, () => {
    const state = base(); const observer = mutate.scene.enter(state, 'self', B03002.id, {}).uid; const declarer = mutate.scene.enter(state, 'self', DECLARER, {}).uid; setState(state);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: declarer, abilId: 'a1' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.hand).toContain(DRAW_MARKER);
    const observed = useGameStateStore.getState().gameState!.pendingEffects
      .find((entry) => entry.source.uid === observer && entry.source.abilityId === 'a2');
    expect(observed).toBeDefined();
    const log = useGameStateStore.getState().gameState!.log;
    const drawIndex = log.findIndex((entry) => entry.action === 'effect:draw');
    const grantIndex = log.findIndex((entry) => entry.action === 'effect:charGrantKeyword');
    expect(drawIndex).toBeGreaterThanOrEqual(0);
    expect(grantIndex).toBeGreaterThan(drawIndex);
  });

  it(`${QA.b05005NoUse}: a no-use hint leaves the same-turn coloured use eligible`, () => {
    const state = base(); setBluePartner(state); mutate.scene.enter(state, 'self', B05005.id, {}); state.players.self.hand = [SCOUT]; setState(state);
    next(); expect(pending(B05005.id)).toHaveLength(0);
    next(SCOUT); expect(pending(B05005.id)).toHaveLength(1);
  });

  it(`${QA.b05005Zero}: zero selection fires once and a later same-turn use adds no trigger`, () => {
    const state = base(); setBluePartner(state); mutate.scene.enter(state, 'self', B05005.id, {}); mutate.scene.enter(state, 'opp', GUARD, {}); state.players.self.hand = [SCOUT, SCOUT]; setState(state);
    next(SCOUT); resolvePick(null);
    expect(pending(B05005.id)).toHaveLength(1);
    next(SCOUT); expect(pending(B05005.id)).toHaveLength(1);
  });

  it(`${QA.b05005Enter}: character entry and its observer use the public owner-order path`, () => {
    const state = base(); setBluePartner(state); mutate.scene.enter(state, 'self', B05005.id, {}); putInFile(state, ENTER); setState(state);
    next(ENTER); visibleOrder([B05005.id, ENTER], ENTER);
    expect(useGameStateStore.getState().gameState!.players.self.hand).toContain(DRAW_MARKER);
  });

  it(`${QA.b05005Event}: the event's own mutation is complete before B05005 observes it`, () => {
    const state = base(); setBluePartner(state); mutate.scene.enter(state, 'self', B05005.id, {}); putInFile(state, EVENT); mutate.scene.enter(state, 'opp', GUARD, {}); setState(state);
    expect(state.players.self.hand).not.toContain(DRAW_MARKER);
    next(EVENT);
    expect(useGameStateStore.getState().gameState!.players.self.hand).toContain(DRAW_MARKER);
    expect(pending(B05005.id)).toHaveLength(1);
  });

  it(`${QA.b05005Self}: self-use requires FILE 10 and waits for a later eligible use`, () => {
    const state = base(); setBluePartner(state); putInFile(state, B05005.id); state.players.self.hand = [SCOUT]; setState(state);
    next(B05005.id); expect(pending(B05005.id)).toHaveLength(0);
    next(SCOUT); expect(pending(B05005.id)).toHaveLength(1);
  });

  it(`${QA.b05005Required}: active required blocks null and another guard, then accepts itself`, () => {
    const state = base(); setBluePartner(state); state.players.self.partnerAreaMR = sceneChar(B05005.id, 'partnerMR:self'); const attacker = 'attacker:self'; const target = 'target:opp'; const required = 'required:opp'; const other = 'other:opp'; state.players.self.scene = [sceneChar(ATTACKER, attacker, { enterOrderThisTurn: undefined })]; state.players.opp.scene = [sceneChar(TARGET, target, { state: 'sleep' }), sceneChar(GUARD, required), sceneChar(GUARD, other)]; setState(state);
    markRequired(required); const actionId = declareAction(attacker, target);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: other })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: required })).toEqual({ ok: true });

    const sleeping = base(); setBluePartner(sleeping); sleeping.players.self.partnerAreaMR = sceneChar(B05005.id, 'partnerMR:self'); const sleepingAttacker = 'sleeping-attacker:self'; const sleepingTarget = 'sleeping-target:opp'; const sleepingGuard = 'sleeping-guard:opp'; sleeping.players.self.scene = [sceneChar(ATTACKER, sleepingAttacker, { enterOrderThisTurn: undefined })]; sleeping.players.opp.scene = [sceneChar(TARGET, sleepingTarget, { state: 'sleep' }), sceneChar(GUARD, sleepingGuard, { state: 'sleep' })]; setState(sleeping);
    markRequired(sleepingGuard);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: declareAction(sleepingAttacker, sleepingTarget), guarderUid: null })).toEqual({ ok: true });
  });

  it(`${QA.b05005TwoActive}: two independently marked active guards may each guard`, () => {
    const state = base(); setBluePartner(state); state.players.self.case.colors = [...B05005.colors, ...PR296.colors, '白']; state.players.self.partnerAreaMR = sceneChar(B05005.id, 'partnerMR:self'); const attacker = 'attacker:self'; const target = 'target:opp'; const first = 'first:opp'; const second = 'second:opp'; state.players.self.scene = [sceneChar(ATTACKER, attacker, { enterOrderThisTurn: undefined }), sceneChar(PR296.id, 'pr296:self')]; state.players.opp.scene = [sceneChar(TARGET, target, { state: 'sleep' }), sceneChar(GUARD, first), sceneChar(GUARD, second)]; setState(state);
    markRequired(first); markRequired(second, 'pr296:self', 'a3');
    const marked = structuredClone(useGameStateStore.getState().gameState!);
    setState(structuredClone(marked));
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: declareAction(attacker, target), guarderUid: first })).toEqual({ ok: true });
    setState(structuredClone(marked));
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: declareAction(attacker, target), guarderUid: second })).toEqual({ ok: true });
  });

  it(`${QA.b05005SleepGuard}: sleeping ordinary guards permit null, while B03078 remains forced`, () => {
    const guarded = base(); setBluePartner(guarded); guarded.players.self.partnerAreaMR = sceneChar(B05005.id, 'partnerMR:self'); const attacker = 'guarded-attacker:self'; const target = 'guarded-target:opp'; const sleeper = 'sleep-guard:opp'; guarded.players.self.scene = [sceneChar(ATTACKER, attacker, { enterOrderThisTurn: undefined })]; guarded.players.opp.scene = [sceneChar(TARGET, target, { state: 'sleep' }), sceneChar(B03078.id, sleeper, { state: 'sleep' })]; setState(guarded);
    markRequired(sleeper); const actionId = declareAction(attacker, target);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: sleeper })).toEqual({ ok: true });
  });
});
