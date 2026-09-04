// qa: card:B08092:2acd62799ca89c8181d220a474927d8805e8f2fac855125cae4be29f07af6fa5
// qa: card:B08092:9d286f11429c94d7f7161989e989662f07516c3df8a6c4945907ec6855175a2c
// qa: card:B08092:c059cac83edb5c5b4dc00457a0efa81f6b4caf9a0d2a7def41d117b64c59a427
// qa: card:B08093:701cfbd7877307922c55f555756e02ed66d7a8aa95b750733732866aa911b091
// qa: card:B08093:9e01ca22cca2f339265d90808c23c7e3a000b668ee36a95dc5943cc691497765
// qa: card:B08093:c54349866d5429d1bb74d16cbd2e788cf968eea7fd9d3188114c3cbfc026e4ec
// qa: card:B08093:fdb9ef6ae9c47b04e82005efd2265bb2204587a1de82c6b1c1e925446d2c4b8f
// qa: card:B08094:df3e059e3af81f1e43db225d821770f0df5199917d3a9be021bce7b151e0f9bd

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08092 } from '@/cards/ct-p08/B08092';
import { B08093 } from '@/cards/ct-p08/B08093';
import { B08094 } from '@/cards/ct-p08/B08094';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, EvidenceCard, GameState, Player } from '@/engine/types';
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

const inactiveLeave = (id: string, names: string[], colors: string[], level: number): CardDef => fixture(id, {
  names, colors, level,
  abilities: [{
    id: 'leave', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:to-remove', selfOnly: true },
    condition: { kind: 'turn', player: 'opp' },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: '【相手ターン中】【現場リムーブ時】。', ruleRefs: [],
  } as AbilityDef],
});

const DRAWN_HAIBARA = inactiveLeave('W186_DRAWN_HAIBARA', ['灰原哀'], ['青'], 4);
const REVEAL_BLUE = inactiveLeave('W186_REVEAL_BLUE', ['青の公開札'], ['青'], 3);
const REVEAL_BLACK = inactiveLeave('W186_REVEAL_BLACK', ['黒の公開札'], ['黒'], 3);
const REVEAL_YELLOW = inactiveLeave('W186_REVEAL_YELLOW', ['黄の公開札'], ['黄'], 3);
const PLAIN_BLUE = fixture('W186_PLAIN_BLUE', { colors: ['青'], level: 3 });
const LEVEL7 = fixture('W186_LEVEL7', { level: 7, ap: 7000 });
const LEVEL8 = fixture('W186_LEVEL8', { level: 8, ap: 8000 });
const LEVEL9 = fixture('W186_LEVEL9', { level: 9, ap: 9000 });
const LEVEL10 = fixture('W186_LEVEL10', { level: 10, ap: 10000 });
const DRAW = fixture('W186_DRAW', { kind: 'event' });
const TAIL = fixture('W186_TAIL', { kind: 'event' });

const MR_REMOVER = fixture('W186_MR_REMOVER', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'sceneRemove',
      args: {
        player: 'self', side: 'either', max: 1,
        filter: { kind: 'character', cardName: 'シェリー' }, cause: 'effect',
      },
    },
    description: 'シェリーを1枚までリムーブする。', ruleRefs: [],
  } as AbilityDef],
});

const FIXTURES = [
  DRAWN_HAIBARA, REVEAL_BLUE, REVEAL_BLACK, REVEAL_YELLOW, PLAIN_BLUE,
  LEVEL7, LEVEL8, LEVEL9, LEVEL10, DRAW, TAIL, MR_REMOVER,
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave186 game state');
  return state;
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: TAIL.id }));
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
  resetPresentationQueue(`qa-wave186-${label}`);
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

function settleDeckOrder(): void {
  const store = useGameStateStore.getState();
  if (store.pendingPublicHandReveal?.lifetime === 'presentation') {
    store.setPendingPublicHandReveal(null);
    surfacePendingSideChannels();
  }
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

describe('official QA Wave186: B08092 sequential draw, entry, and bond', () => {
  it.each(['self', 'opp'] as const)('owner=%s draws and enters an inactive Haibara before checking the later bond', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 186, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['青', '黒'];
    state.players[owner].file = fileCards(7);
    state.players[owner].hand = [B08092.id];
    state.players[owner].deck = [DRAWN_HAIBARA.id, TAIL.id];
    state.players[opponent].scene = [sceneChar(LEVEL7.id, 'valid'), sceneChar(LEVEL8.id, 'high')];
    install(state, owner, `${owner}-B08092-sequence`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08092.id }))
      .toEqual({ ok: true });
    const enter = pendingPick(B08092.id, 'a1', 'sceneEnter');
    expect(enter.candidates.map(candidate => candidate.cardId)).toEqual([DRAWN_HAIBARA.id]);
    chooseCard(enter, DRAWN_HAIBARA.id);
    expect(current().players[owner].scene.find(card => card.cardId === DRAWN_HAIBARA.id)?.state)
      .toBe('sleep');

    const remove = pendingPick(B08092.id, 'a1', 'sceneRemove');
    expect(remove.candidates.some(candidate => candidate.uid === 'valid')).toBe(true);
    expect(remove.candidates.some(candidate => candidate.uid === 'high')).toBe(false);
    choose(remove, 'valid');
    expect(current().players[opponent].remove).toContain(LEVEL7.id);
  });
});

describe('official QA Wave186: B08093 reveal cost, independent picks, and MR leave', () => {
  it.each(['self', 'opp'] as const)('owner=%s selects an inactive printed leave card and hides it before effect choice', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 186, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08093.id, 'haibara-mr')];
    state.players[owner].hand = [REVEAL_BLUE.id, REVEAL_BLACK.id, REVEAL_YELLOW.id];
    state.players[opponent].scene = [sceneChar(LEVEL9.id, 'level9'), sceneChar(LEVEL10.id, 'level10')];
    install(state, owner, `${owner}-B08093-reveal-cost`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'haibara-mr', abilId: 'a1',
      costParams: { revealFromHand: { indices: [1] } },
    })).toEqual({ ok: true });
    const remove = pendingPick(B08093.id, 'a1', 'sceneRemove');
    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner, cardIds: [REVEAL_BLACK.id], lifetime: 'presentation',
    });
    expect(current().players[owner].hand)
      .toEqual([REVEAL_BLUE.id, REVEAL_BLACK.id, REVEAL_YELLOW.id]);
    useGameStateStore.getState().setPendingPublicHandReveal(null);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    expect(remove.candidates.some(candidate => candidate.uid === 'level9')).toBe(true);
    expect(remove.candidates.some(candidate => candidate.uid === 'level10')).toBe(false);
    choose(remove, 'level9');
  });

  it.each(['self', 'opp'] as const)('owner=%s may take only the blue pick and decline the independent black pick', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 186, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08093.id, 'haibara-mr')];
    install(state, owner, `${owner}-B08093-independent-picks`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'haibara-mr', abilId: 'a3' }))
      .toEqual({ ok: true });
    choose(pendingPick(B08093.id, 'a3', 'charModifyAP'), 'haibara-mr');
    choose(pendingPick(B08093.id, 'a3', 'charModifyAP'), null);
    expect(read.char.ap(current(), 'haibara-mr')).toBe(9000);
  });

  it.each(['self', 'opp'] as const)('owner=%s triggers leave draw before the opponent-turn MR settles in PA', owner => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 186, player: opponent, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08093.id, 'haibara-mr')];
    state.players[owner].hand = [PLAIN_BLUE.id];
    state.players[owner].deck = [DRAW.id, TAIL.id];
    state.players[opponent].scene = [sceneChar(MR_REMOVER.id, 'remover')];
    install(state, owner, `${owner}-B08093-mr-leave`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' }))
      .toEqual({ ok: true });
    surfacePendingSideChannels();
    const removal = useGameStateStore.getState().pendingEffectPick;
    if (removal?.atomVerb === 'sceneRemove') chooseCard(removal, B08093.id);
    expect(current().players[owner].partnerAreaMR?.cardId).toBe(B08093.id);
    expect(current().players[owner].remove).not.toContain(B08093.id);
    expect(current().players[owner].hand).toContain(DRAW.id);
  });
});

describe('official QA Wave186: B08094 printed leave ability in deck', () => {
  it.each(['self', 'opp'] as const)('owner=%s may take an opponent-turn-only leave holder during its own turn', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 186, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case = {
      ...state.players[owner].case, cardId: B08094.id, colors: ['青', '黒'], status: '解決編',
    };
    state.players[owner].scene = [sceneChar(DRAWN_HAIBARA.id, 'haibara')];
    state.players[owner].evidence = [evidence('evidence-a'), evidence('evidence-b')];
    state.players[owner].deck = [REVEAL_BLUE.id, PLAIN_BLUE.id, TAIL.id];
    install(state, owner, `${owner}-B08094-static-leave`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2',
      costParams: { flipFaceUpEvidence: { indices: [0, 1] } },
    })).toEqual({ ok: true });
    const reveal = pendingPick(B08094.id, 'a2', 'deckRevealUntil');
    expect(reveal.candidates.map(candidate => candidate.cardId)).toEqual([REVEAL_BLUE.id]);
    chooseCard(reveal, REVEAL_BLUE.id);
    settleDeckOrder();
    expect(current().players[owner].hand).toContain(REVEAL_BLUE.id);
  });
});
