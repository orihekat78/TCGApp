// qa: card:B06074:2e622a225c9c5743d9f4eba3865e40ddb799ad15a2800aca084ac672a33c6b74
// qa: card:B06074:ae7f52880f245b79ea26502eaca624f082c7777854d029f9cd6ca7c88b4fb8b4
// qa: card:B06074:b62596e6ff613c1c30c1e092ac56acbc9b611d0d1fc15172d89829fe1241e765
// qa: card:B06074:d3026efd67f9c4e87f3a732bbbf9f3314a413f135e7b6f725d3d129dc7046b94
// qa: card:B06074:e6ce2b727de130ad39777e7e31ada341fdac65e6c96f16755b304794c642328e
// qa: card:B06074:4bcf1ca2a52482ef58f2a9bbf780fb11cb5c7446289c8c9e24f7d63bb485e566

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06074 } from '@/cards/ct-p06/B06074';
import { B06074P } from '@/cards/ct-p06/B06074P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetReservedEffectsRegistered, registerReservedEffectListener } from '@/engine/listeners/reserved-effects';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ROWS = [B06074, B06074P] as const;
const CASES = ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner })));
const enterDraw: AbilityDef = {
  id: 'enter-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Wave131 nested entry sentinel.', ruleRefs: ['rules/17-icons.md'],
};
const AKAI = fixture('W131_AKAI', { names: ['赤井家の新人'], level: 7, traits: ['赤井家'], abilities: [enterDraw] });
const FILLER = fixture('W131_FILLER');
const DRAWS = [
  fixture('W131_DRAW_1', { kind: 'event', ap: undefined, lp: undefined }),
  fixture('W131_DRAW_2', { kind: 'event', ap: undefined, lp: undefined }),
  fixture('W131_DRAW_3', { kind: 'event', ap: undefined, lp: undefined }),
  fixture('W131_DRAW_4', { kind: 'event', ap: undefined, lp: undefined }),
  fixture('W131_DRAW_5', { kind: 'event', ap: undefined, lp: undefined }),
  fixture('W131_DRAW_6', { kind: 'event', ap: undefined, lp: undefined }),
] as const;

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave131 state');
  return state;
}

function fileCards(prefix: string, count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `${prefix}-${index + 1}`,
  }));
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave131-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function declare(uid: string): ReturnType<typeof dispatchEngineAction> {
  return dispatchEngineAction({
    type: 'declaredAbility', uid, abilId: 'a2',
    abilityOrigin: 'printed', abilityIndex: 1,
  });
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetReservedEffectsRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [AKAI, FILLER, ...DRAWS]) register(card);
  registerTriggeredListener();
  registerReservedEffectListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave131: the source draw may be the entry card at a full scene', () => {
  it.each(CASES)('$card.id owner $owner', ({ card, owner }) => {
    const state = createEmptyGameState();
    state.turn = { number: 15, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['赤'];
    state.players[owner].file = fileCards('level', 9);
    state.players[owner].scene = Array.from(
      { length: 4 },
      (_value, index) => sceneChar(FILLER.id, `filler-${index + 1}`),
    );
    state.players[owner].hand = [card.id];
    state.players[owner].deck = [AKAI.id, DRAWS[0].id, DRAWS[1].id];
    install(state, owner, `${card.id}-${owner}-drawn-entry`);
    expect([B06074.id, B06074P.id]).toContain(card.id);
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
      .toEqual({ ok: true });
    surfacePendingSideChannels();
    const source = current().players[owner].scene.find(character => character.cardId === card.id)!;
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({
      player: owner, ownerPlayer: owner, atomVerb: 'sceneEnter',
      source: { uid: source.uid, cardId: card.id, abilityId: 'a1' },
    });
    const entry = pending?.candidates.find(candidate => candidate.cardId === AKAI.id);
    expect(entry).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: entry!.uid, switchRemoveUid: source.uid,
    }))).toEqual({ ok: true });

    expect(current().players[owner].scene).toHaveLength(5);
    expect(current().players[owner].scene.some(character => character.cardId === AKAI.id)).toBe(true);
    expect(current().players[owner].scene.some(character => character.uid === source.uid)).toBe(false);
    expect(current().players[owner].remove).toContain(card.id);
  });
});

describe('official QA Wave131: two physical declarations reserve two independently checked effects', () => {
  it.each(['self', 'opp'] as const)('owner %s', owner => {
    const run = (ordinary: number) => {
      const state = createEmptyGameState();
      state.turn = { number: 15, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [
        sceneChar(B06074.id, 'source-1'),
        sceneChar(B06074P.id, 'source-2'),
      ];
      state.players[owner].file = fileCards('ordinary', ordinary);
      state.players[owner].deck = DRAWS.map(card => card.id);
      state.players[other(owner)].deck = DRAWS.map(card => card.id);
      install(state, owner, `double-${owner}-${ordinary}`);
      expect(declare('source-1')).toEqual({ ok: true });
      expect(declare('source-2')).toEqual({ ok: true });
      expect(current().reservedEffects).toHaveLength(2);
      expect(current().reservedEffects.map(effect => effect.source.cardId).sort())
        .toEqual([B06074.id, B06074P.id].sort());
      expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
      const group = pendingOwnerOrderGroup(current(), owner);
      expect(group).toHaveLength(2);
      expect(dispatchEngineAction({
        type: 'setEffectOrder', entryId: group[1]!.id, order: 0, player: owner,
      })).toEqual({ ok: true });
      const ordered = pendingOwnerOrderGroup(current(), owner);
      expect(dispatchEngineAction({
        type: 'resolveEffectOrder', player: owner, entryIds: ordered.map(effect => effect.id),
      })).toEqual({ ok: true });
      return {
        file: current().players[owner].file.length,
        reserved: current().reservedEffects.length,
      };
    };

    expect(run(7)).toEqual({ file: 7, reserved: 0 });
    expect(run(8)).toEqual({ file: 6, reserved: 0 });
  });
});

describe('official QA Wave131: file cost is owner-only, exact-two, and refresh-safe', () => {
  it.each(CASES)('$card.id owner $owner', ({ card, owner }) => {
    const opponent = other(owner);
    const payable = createEmptyGameState();
    payable.turn = { number: 15, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    payable.players[owner].scene = [sceneChar(card.id, 'source')];
    payable.players[owner].file = fileCards('owner-file', 2);
    payable.players[opponent].file = fileCards('opponent-file', 2);
    payable.players[owner].deck = [DRAWS[0].id];
    payable.players[owner].remove = [DRAWS[1].id, DRAWS[2].id];
    payable.players[opponent].deck = DRAWS.map(card => card.id);
    install(payable, owner, `${card.id}-${owner}-refresh`);
    expect([B06074.id, B06074P.id]).toContain(card.id);
    expect(declare('source')).toEqual({ ok: true });
    expect(current().players[owner].file).toEqual([]);
    expect(current().players[owner].remove).toEqual(expect.arrayContaining([
      'owner-file-1', 'owner-file-2',
    ]));
    expect(current().players[opponent].file).toEqual(fileCards('opponent-file', 2));
    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    expect(current().players[owner].file).toHaveLength(2);
    expect(current().gameResult).toBeUndefined();
    expect(current().log.some(entry => entry.action === 'refresh')).toBe(true);

    const short = createEmptyGameState();
    short.turn = { number: 15, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    short.players[owner].scene = [sceneChar(card.id, 'source')];
    short.players[owner].file = fileCards('short', 1);
    short.players[opponent].file = fileCards('opponent-short', 2);
    short.players[owner].deck = DRAWS.map(item => item.id);
    install(short, owner, `${card.id}-${owner}-short`);
    const before = current();
    expect(declare('source')).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(current().reservedEffects).toEqual([]);
    expect(current().players[opponent].file).toEqual(fileCards('opponent-short', 2));
  });
});
