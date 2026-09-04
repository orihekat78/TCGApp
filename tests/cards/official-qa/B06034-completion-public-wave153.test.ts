// qa: card:B06034:69959d6bea858af0019b9119c1e8ca433349b7964059e710a523adc480d9e5e5
// qa: card:B06034:a54fba013cee1c4f1657f7007dbc6e664a2cedf67c66990f1a3a2daa903b7ef5
// qa: card:B06034:a5f52b076ec741896b015d58bcb3a08173a3d501057513a697d828359fe8f5a6
// qa: card:B06034:ce881ce830b0156ebce763608d2da6878acb277765f1fc7927e75ef2a4257b2a

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05079 } from '@/cards/ct-p05/B05079';
import { B06025 } from '@/cards/ct-p06/B06025';
import { B06026 } from '@/cards/ct-p06/B06026';
import { B06034 } from '@/cards/ct-p06/B06034';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetHiramekiRegistered, _resetPendingHirameki, registerHiramekiListener } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const hiramekiDraw: AbilityDef = {
  id: 'hirameki', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Wave153 Hirameki draw.', ruleRefs: ['rules/10-action-event.md'],
};

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const HIR_DRAW = fixture('W153_HIR_DRAW', { traits: ['YAIBA'], abilities: [hiramekiDraw] });
const HIR_BLOCKED = fixture('W153_HIR_BLOCKED', {
  traits: ['YAIBA'], abilities: [{ ...hiramekiDraw, condition: { kind: 'partnerColor', color: '青' } }],
});
const TARGET = fixture('W153_TARGET');
const DRAW = fixture('W153_DRAW', { kind: 'event' });
const TAIL = fixture('W153_TAIL', { kind: 'event' });
const FILE_CARD = fixture('W153_FILE', { kind: 'event' });

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function evidence(cardId: string, faceUp = false) {
  return { cardId, faceUp, origin: { turn: 53, via: 'reasoning' as const } };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave153 state');
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave153-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function board(owner: Player, evidenceCardId: string): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 53, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.status = '解決編';
  state.players[owner].case.colors = ['緑'];
  state.players[owner].file = Array.from(
    { length: B06034.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: FILE_CARD.id }),
  );
  state.players[owner].hand = [B06034.id];
  state.players[owner].evidence = [evidence(evidenceCardId)];
  state.players[owner].deck = [DRAW.id, TAIL.id, TAIL.id];
  state.players[other(owner)].deck = [TAIL.id, TAIL.id, TAIL.id];
  return state;
}

function pendingPick(verb: string, sourceCardId = B06034.id) {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({ atomVerb: verb, source: { cardId: sourceCardId } });
  return pick!;
}

function choose(pick: ReturnType<typeof pendingPick>, uid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function useAndFlip(owner: Player, cardId: string): void {
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B06034.id }))
    .toEqual({ ok: true });
  const flip = pendingPick('evidenceFlip');
  const candidate = flip.candidates.find(item => item.cardId === cardId);
  expect(candidate).toMatchObject({ cardId, player: owner, area: 'evidence' });
  choose(flip, candidate!.uid);
  expect(current().players[owner].evidence.find(item => item.cardId === cardId)?.faceUp).toBe(true);

  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional).toMatchObject({ player: owner, source: { cardId: B06034.id, abilityId: 'a1' } });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetHiramekiRegistered();
  _resetPendingHirameki();
  _resetUidCounter();
  registerAll();
  for (const card of [HIR_DRAW, HIR_BLOCKED, TARGET, DRAW, TAIL, FILE_CARD]) register(card);
  registerTriggeredListener();
  registerHiramekiListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave153: B06034 invoked Hirameki movement', () => {
  it('moves Kerosuke from evidence according to its whole invoked effect', () => {
    const state = board('self', B06025.id);
    state.players.self.scene = [sceneChar(TARGET.id, 'target')];
    install(state, 'self', 'kerosuke');

    useAndFlip('self', B06025.id);
    const removal = pendingPick('sceneRemove', B06025.id);
    expect(removal.candidates.map(candidate => candidate.uid)).toEqual(['target']);
    choose(removal, 'target');

    expect(current().players.self.remove).toContain(TARGET.id);
    expect(current().players.self.scene.some(character => character.cardId === B06025.id)).toBe(true);
    expect(current().players.self.evidence.some(item => item.cardId === B06025.id)).toBe(false);
  });
});

describe('official QA Wave153: B06034 invocation exceptions', () => {
  it('bypasses an opponent Hirameki-suppression aura', () => {
    const owner = 'opp' as const;
    const state = board(owner, HIR_DRAW.id);
    state.players[other(owner)].scene = [sceneChar(B05079.id, 'sera')];
    install(state, owner, 'suppression');

    useAndFlip(owner, HIR_DRAW.id);
    expect(current().players[owner].hand).toEqual([DRAW.id]);
  });

  it('allows invocation of an icon-disabled Hirameki but applies no effect', () => {
    const state = board('self', HIR_BLOCKED.id);
    install(state, 'self', 'condition-disabled');

    useAndFlip('self', HIR_BLOCKED.id);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(current().players.self.hand).toEqual([]);
    expect(current().players.self.evidence[0]).toMatchObject({ cardId: HIR_BLOCKED.id, faceUp: true });
  });

  it('lets the invoked Batman turn its own occurrence face-down again', () => {
    const owner = 'opp' as const;
    const state = board(owner, B06026.id);
    install(state, owner, 'batman-self-flip');

    useAndFlip(owner, B06026.id);
    const flipDown = pendingPick('evidenceFlipDown', B06026.id);
    const source = flipDown.candidates.find(candidate => candidate.cardId === B06026.id);
    expect(source).toMatchObject({ cardId: B06026.id, player: owner, area: 'evidence', index: 0 });
    choose(flipDown, source!.uid);
    expect(current().players[owner].evidence[0]).toMatchObject({ cardId: B06026.id, faceUp: false });
  });
});
