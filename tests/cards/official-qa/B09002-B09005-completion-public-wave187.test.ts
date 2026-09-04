// qa: card:B09002:b4865a17eaa7c68418a6b7755125081b917cc5203b710a3ee92ce60bee4d42ac
// qa: card:B09002:d23ba6975253f6942b27088c696d38d7dea9f50c7787e7a6e11f7ce1b8528be9
// qa: card:B09003:1fefea11e9f62644d0760810fefb72ce203d027c2194b205a1bb441878975d27
// qa: card:B09003:375e6476ac4c0a6476f747128f6e2d3e33951ddc341cad3e9f47bc49a674eb8a
// qa: card:B09003:682c1eea6331e85fd27be74ff5a7e85fd9e8d8ef09f8a04d5e25d55f30e63275
// qa: card:B09004:ac0a4acd14b49192dbccf5b816d6297764c707772330ffb738c2341676ccdf29
// qa: card:B09004:ae0b9a1c8b2159626d09127380fcc05b3f1f34f49b2242b8963a3beaf5267b46
// qa: card:B09005:85dcd05f07e7ce4b26c0a8c851f0d02178dad7f6c8fab24d7087d1baee0052ac

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08094 } from '@/cards/ct-p08/B08094';
import { B09002 } from '@/cards/ct-p09/B09002';
import { B09003 } from '@/cards/ct-p09/B09003';
import { B09004 } from '@/cards/ct-p09/B09004';
import { B09005 } from '@/cards/ct-p09/B09005';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, EvidenceCard, FileCard, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['青'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const leaveMarker: AbilityDef = {
  id: 'leave', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: { kind: 'atom', verb: 'noop', args: {} },
  description: '【相手ターン中】【現場リムーブ時】。', ruleRefs: [],
};

const SHINICHI_L8 = fixture('W187_SHINICHI_L8', { names: ['工藤新一'], level: 8 });
const SHINICHI_BOND = fixture('W187_SHINICHI_BOND', { names: ['工藤新一'], level: 7 });
const SHINICHI_HAND = fixture('W187_SHINICHI_HAND', {
  names: ['工藤新一'], level: 4, traits: ['探偵'],
});
const HAIBARA = fixture('W187_HAIBARA', { names: ['灰原哀'], level: 4 });
const DECK_SHINICHI = fixture('W187_DECK_SHINICHI', {
  names: ['工藤新一'], level: 4, abilities: [leaveMarker],
});
const HATTORI = fixture('W187_HATTORI', { names: ['服部平次'], colors: ['緑'], level: 7 });
const ENTERER = fixture('W187_ENTERER', {
  colors: ['青'], level: 7,
  abilities: [{
    id: 'enter-draw', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '【登場時】カードを1枚引く。', ruleRefs: [],
  } as AbilityDef],
});
const VICTIM7 = fixture('W187_VICTIM7', { level: 7, ap: 7000 });
const VICTIM8 = fixture('W187_VICTIM8', { level: 8, ap: 8001 });
const AP_TARGET = fixture('W187_AP_TARGET', { level: 5, ap: 3000 });
const COST_TOP = fixture('W187_COST_TOP', { kind: 'event' });
const FILE_NAMED = fixture('W187_FILE_NAMED', { names: ['指定札'] });
const FILE_REPLACEMENT = fixture('W187_FILE_REPLACEMENT', { kind: 'event' });
const REFRESH_FILLER = fixture('W187_REFRESH_FILLER', { kind: 'event' });
const FILE_BOTTOM = fixture('W187_FILE_BOTTOM', { kind: 'event' });
const FILE_FACEUP = fixture('W187_FILE_FACEUP', { kind: 'event' });
const DRAW = fixture('W187_DRAW', { kind: 'event' });
const SPARE = fixture('W187_SPARE', { kind: 'event' });
const TAIL = fixture('W187_TAIL', { kind: 'event' });

const FIXTURES = [
  SHINICHI_L8, SHINICHI_BOND, SHINICHI_HAND, HAIBARA, DECK_SHINICHI,
  HATTORI, ENTERER, VICTIM7, VICTIM8, AP_TARGET, COST_TOP, FILE_NAMED,
  FILE_REPLACEMENT, REFRESH_FILLER, FILE_BOTTOM, FILE_FACEUP, DRAW, SPARE, TAIL,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave187 game state');
  return state;
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: TAIL.id }));
}

function fileBack(cardId: string, faceUp = false): FileCard {
  return { type: 'card-back', cardId, ...(faceUp ? { faceUp: true } : {}) };
}

function evidence(cardId: string): EvidenceCard {
  return { cardId, faceUp: false, origin: { turn: 1, via: 'reasoning' } };
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave187-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, pickedUid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid,
  }))).toEqual({ ok: true });
}

function chooseCard(pending: PendingPick, cardId: string | null): void {
  const pickedUid = cardId === null
    ? null
    : pending.candidates.find(candidate => candidate.cardId === cardId)?.uid;
  if (cardId !== null) expect(pickedUid, `${cardId} must be selectable`).toBeTruthy();
  choose(pending, pickedUid ?? null);
}

function resolveOptional(cardId: string, abilityId: string, run: boolean): void {
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional).toMatchObject({ source: { cardId, abilityId } });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
}

function clearPresentationReveal(): void {
  const store = useGameStateStore.getState();
  if (store.pendingPublicHandReveal?.lifetime !== 'presentation') return;
  store.setPendingPublicHandReveal(null);
  surfacePendingSideChannels();
}

function settleDeckOrder(): void {
  clearPresentationReveal();
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  if (!reorder) return;
  expect(dispatchEngineAction(bindPendingDecision(reorder, {
    type: 'deckReorderResolve', order: [...reorder.cardIds],
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave187: B09002 MR replacement and self activation', () => {
  it.each(['self', 'opp'] as const)('owner=%s removes the old MR before the new copy can trigger it', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 187, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['青'];
    state.players[owner].file = fileCards(9);
    state.players[owner].scene = [sceneChar(B09002.id, 'old-mr')];
    state.players[owner].hand = [B09002.id];
    state.players[owner].deck = [TAIL.id, TAIL.id];
    install(state, owner, `${owner}-B09002-mr-replacement`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B09002.id }))
      .toEqual({ ok: true });
    expect(current().players[owner].scene.filter(card => card.cardId === B09002.id)).toHaveLength(1);
    expect(current().players[owner].scene.some(card => card.uid === 'old-mr')).toBe(false);
    expect(current().players[owner].remove).toContain(B09002.id);
    expect(current().pendingEffects.some(entry => (
      entry.source.cardId === B09002.id && entry.source.abilityId === 'a1'
    ))).toBe(false);
    expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
  });

  it.each(['self', 'opp'] as const)('owner=%s may activate the end-trigger source itself', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 187, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B09002.id, 'mr-source', { state: 'sleep' })];
    state.players[owner].hand = [SHINICHI_L8.id];
    state.players[owner].deck = [TAIL.id, TAIL.id];
    state.players[other(owner)].deck = [TAIL.id, TAIL.id];
    install(state, owner, `${owner}-B09002-self-active`);

    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    chooseCard(pendingPick(B09002.id, 'a2', 'handReveal'), SHINICHI_L8.id);
    const activation = pendingPick(B09002.id, 'a2', 'sceneSetState');
    expect(activation.candidates.map(candidate => candidate.uid)).toContain('mr-source');
    choose(activation, 'mr-source');
    expect(current().players[owner].scene.find(card => card.uid === 'mr-source')?.state).toBe('active');
  });
});

describe('official QA Wave187: B09003 effective level, simultaneous order, and refresh snapshot', () => {
  it.each(['self', 'opp'] as const)('owner=%s is continuously level 6 only during its own turn', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 187, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B09003.id, 'conan')];
    install(state, owner, `${owner}-B09003-level`);
    expect(read.char.level(current(), 'conan')).toBe(6);
    const offTurn = structuredClone(current());
    offTurn.turn.player = other(owner);
    expect(read.char.level(offTurn, 'conan')).toBe(8);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it.each([
    { owner: 'self' as const, firstCardId: ENTERER.id },
    { owner: 'opp' as const, firstCardId: B09003.id },
  ])('owner=$owner chooses $firstCardId first among simultaneous enter effects', ({ owner, firstCardId }) => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 187, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['青', '緑'];
    state.players[owner].file = fileCards(7);
    state.players[owner].scene = [sceneChar(B09003.id, 'conan')];
    state.players[owner].hand = [ENTERER.id];
    state.players[owner].deck = [DRAW.id, TAIL.id];
    state.players[opponent].scene = [sceneChar(VICTIM7.id, 'victim')];
    install(state, owner, `${owner}-B09003-order-${firstCardId}`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: ENTERER.id }))
      .toEqual({ ok: true });
    const group = pendingOwnerOrderGroup(current(), owner);
    expect(group.map(entry => entry.source.cardId).sort())
      .toEqual([B09003.id, ENTERER.id].sort());
    const first = group.find(entry => entry.source.cardId === firstCardId)!;
    expect(dispatchEngineAction({
      type: 'setEffectOrder', entryId: first.id, order: 0, player: owner,
    })).toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(current(), owner);
    expect(ordered[0]?.source.cardId).toBe(firstCardId);
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: owner, entryIds: ordered.map(entry => entry.id),
    })).toEqual({ ok: true });
    choose(pendingPick(B09003.id, 'a2', 'sceneRemove'), null);
    expect(current().players[owner].hand).toContain(DRAW.id);
    expect(current().pendingEffects.filter(entry => (
      [B09003.id, ENTERER.id].includes(entry.source.cardId)
    )).every(entry => entry.state === 'resolved')).toBe(true);
  });

  it.each(['self', 'opp'] as const)('owner=%s keeps the removed FILE name after refresh moved the card', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 187, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B09003.id, 'conan'), sceneChar(HATTORI.id, 'hattori'),
      sceneChar(AP_TARGET.id, 'ap-target'),
    ];
    state.players[owner].deck = [COST_TOP.id, TAIL.id];
    state.players[opponent].file = [fileBack(FILE_NAMED.id)];
    state.players[opponent].deck = [FILE_REPLACEMENT.id];
    state.players[opponent].remove = [REFRESH_FILLER.id];
    install(state, owner, `${owner}-B09003-refresh-snapshot`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'conan', abilId: 'a3',
      costParams: { declaredName: '指定札' },
    })).toEqual({ ok: true });
    const buff = pendingPick(B09003.id, 'a3', 'charModifyAP');
    expect(current().refreshCount[opponent]).toBe(1);
    expect(current().players[opponent].remove).not.toContain(FILE_NAMED.id);
    expect(current().players[opponent].file.at(-1)?.cardId).toBe(FILE_REPLACEMENT.id);
    choose(buff, 'ap-target');
    expect(read.char.ap(current(), 'ap-target')).toBe(5000);
  });
});

describe('official QA Wave187: B09004 reveal origin and post-trigger bond loss', () => {
  it.each(['self', 'opp'] as const)('owner=%s ignores a matching card revealed from deck into hand', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 187, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case = {
      ...state.players[owner].case, cardId: B08094.id, colors: ['青', '黒'], status: '解決編',
    };
    state.players[owner].scene = [
      sceneChar(B09004.id, 'ran'), sceneChar(HAIBARA.id, 'haibara'),
      sceneChar(SHINICHI_BOND.id, 'bond'),
    ];
    state.players[owner].evidence = [evidence('evidence-a'), evidence('evidence-b')];
    state.players[owner].deck = [DECK_SHINICHI.id, TAIL.id];
    install(state, owner, `${owner}-B09004-deck-reveal`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2',
      costParams: { flipFaceUpEvidence: { indices: [0, 1] } },
    })).toEqual({ ok: true });
    chooseCard(pendingPick(B08094.id, 'a2', 'deckRevealUntil'), DECK_SHINICHI.id);
    settleDeckOrder();
    expect(current().players[owner].hand).toContain(DECK_SHINICHI.id);
    expect(current().pendingEffects.some(entry => (
      entry.source.cardId === B09004.id && entry.source.abilityId === 'a1'
    ))).toBe(false);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it.each(['self', 'opp'] as const)('owner=%s resolves the queued reaction after the source effect removes the last bond', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 187, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['青', '緑'];
    state.players[owner].scene = [
      sceneChar(B09004.id, 'ran'), sceneChar(SHINICHI_BOND.id, 'bond'),
      sceneChar(B09005.id, 'hondo'),
    ];
    state.players[owner].hand = [SHINICHI_HAND.id, SPARE.id];
    state.players[opponent].scene = [sceneChar(VICTIM7.id, 'victim')];
    state.players[opponent].file = [fileBack(FILE_BOTTOM.id), fileBack(FILE_FACEUP.id, true)];
    install(state, owner, `${owner}-B09004-bond-loss`);

    const fileBefore = structuredClone(current().players[opponent].file);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'hondo', abilId: 'a1',
      costParams: { revealFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    expect(pendingPick(B09005.id, 'a1', 'sceneRemove').candidates.some(candidate => candidate.uid === 'bond'))
      .toBe(true);
    choose(useGameStateStore.getState().pendingEffectPick!, 'bond');
    expect(current().players[owner].scene.some(card => card.uid === 'bond')).toBe(false);
    expect(current().players[opponent].file).toEqual(fileBefore);
    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      cardIds: [SHINICHI_HAND.id], lifetime: 'presentation',
    });
    clearPresentationReveal();

    resolveOptional(B09004.id, 'a1', true);
    chooseCard(pendingPick(B09004.id, 'a1', 'discard'), SPARE.id);
    choose(pendingPick(B09004.id, 'a1', 'sceneRemove'), 'victim');
    expect(current().players[opponent].remove).toContain(VICTIM7.id);
    expect(current().players[owner].hand).toContain(SHINICHI_HAND.id);
  });
});
