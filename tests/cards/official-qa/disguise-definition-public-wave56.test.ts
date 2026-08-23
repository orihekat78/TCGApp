// qa: card:B02041:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// qa: card:B02043:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// qa: card:B02044:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// qa: card:B02045:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// qa: card:B02047:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// qa: card:B02086:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// qa: card:B05047:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// qa: card:B06017:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// Rules: 08-contact, 09-cutin-disguise, 16-card-set, 17-icons, 23-qa-disguise-cutin.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow/index.js';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player, SceneCharacter } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const OLD_FACE = 'W56_OLD_FACE';
const TARGET = 'W56_TARGET';
const WHITE_PARTNER = 'W56_WHITE_PARTNER';
const WHITE_CASE = 'W56_WHITE_CASE';
const BLACK_CASE = 'W56_BLACK_CASE';
const YAIBA_CASE = 'W56_YAIBA_CASE';
const PLAIN_CASE = 'W56_PLAIN_CASE';
const SET_A = 'W56_SET_A';
const SET_B = 'W56_SET_B';
const STACK_A = 'W56_STACK_A';
const STACK_B = 'W56_STACK_B';
const CUTIN = 'W56_CUTIN';
const ACTOR_UID = 'wave56-actor';
const TARGET_UID = 'wave56-target';

type Row = {
  cardId: 'B02041' | 'B02043' | 'B02044' | 'B02045' | 'B02047' | 'B02086' | 'B05047' | 'B06017';
  file: number;
  caseId: string;
  rider: boolean;
};

const ROWS: Row[] = [
  { cardId: 'B02041', file: 6, caseId: WHITE_CASE, rider: true },
  { cardId: 'B02043', file: 5, caseId: WHITE_CASE, rider: false },
  { cardId: 'B02044', file: 4, caseId: WHITE_CASE, rider: true },
  { cardId: 'B02045', file: 4, caseId: WHITE_CASE, rider: true },
  { cardId: 'B02047', file: 6, caseId: WHITE_CASE, rider: true },
  { cardId: 'B02086', file: 5, caseId: BLACK_CASE, rider: true },
  { cardId: 'B05047', file: 6, caseId: WHITE_CASE, rider: true },
  { cardId: 'B06017', file: 5, caseId: YAIBA_CASE, rider: false },
];

function card(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['白'], traits: [],
    level: 1, ap: 1000, lp: 2, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

const noopCutin = {
  id: 'cutin',
  type: 'triggered' as const,
  scope: 'on-hand' as const,
  trigger: { hook: 'effect:declared' as const, optional: true },
  effect: { kind: 'atom' as const, verb: 'noop' as const, args: {} },
  description: 'カットイン。',
  ruleRefs: ['rules/09-cutin-disguise.md'],
};

const fixtures: CardDef[] = [
  card(OLD_FACE, { names: ['変装元'], keywords: ['迅速'], ap: 1000, lp: 2 }),
  card(TARGET, { names: ['コンタクト相手'], colors: ['青'], ap: 9000, lp: 2 }),
  card(WHITE_PARTNER, { kind: 'partner', level: 0, lp: 5, colors: ['白'] }),
  card(WHITE_CASE, { kind: 'case', colors: ['白'], caseLevel: 7, caseTraits: [] }),
  card(BLACK_CASE, { kind: 'case', colors: ['黒'], caseLevel: 7, caseTraits: [] }),
  card(YAIBA_CASE, { kind: 'case', colors: ['緑'], caseLevel: 7, caseTraits: ['YAIBA'] }),
  card(PLAIN_CASE, { kind: 'case', colors: ['緑'], caseLevel: 7, caseTraits: [] }),
  card(SET_A, { kind: 'event' }),
  card(SET_B, { kind: 'event' }),
  card(STACK_A),
  card(STACK_B),
  card(CUTIN, { kind: 'event', abilities: [noopCutin] }),
];

function fileCards(count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `W56_FILE_${index}`,
  }));
}

function actor(): SceneCharacter {
  return sceneChar(OLD_FACE, ACTOR_UID, {
    state: 'active',
    isNamed: true,
    setCards: [
      { cardId: SET_A, faceUp: false, instanceId: 'wave56-set-a' },
      { cardId: SET_B, faceUp: true, instanceId: 'wave56-set-b' },
    ],
    stackedCards: [
      { cardId: STACK_A, instanceId: 'wave56-stack-a' },
      { cardId: STACK_B, instanceId: 'wave56-stack-b' },
    ],
    keywordOverrides: { granted: ['突撃'], disabledOriginal: false },
    apOverride: 2300,
    lpOverride: 3,
    turnEffects: {
      contactImmune: true,
      removeOnTurnEnd: true,
      apMod_wave56: 400,
      lpMod_wave56: 1,
      grantedTraits_turn: ['Wave56Trait'],
      nameOverride: '継承名',
    },
  });
}

function prepared(row: Row, options: { file?: number; caseId?: string } = {}): GameState {
  const state = createEmptyGameState();
  const caseId = options.caseId ?? row.caseId;
  const caseDef = fixtures.find(entry => entry.id === caseId)!;
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: WHITE_PARTNER, state: 'active', location: 'partner-area' };
  state.players.self.case = {
    ...state.players.self.case,
    cardId: caseId,
    colors: [...caseDef.colors],
  };
  state.players.self.file = fileCards(options.file ?? row.file);
  state.players.self.scene = [actor()];
  state.players.self.hand = [row.cardId];
  state.players.self.deck = ['W56_DECK_TOP', 'W56_DECK_SECOND'];
  state.players.self.remove = [];
  state.players.opp.scene = [sceneChar(TARGET, TARGET_UID, { state: 'sleep' })];
  return state;
}

function install(state: GameState, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave56 state');
  return state;
}

function ownerOf(uid: string): Player {
  return current().players.self.scene.some(character => character.uid === uid) ? 'self' : 'opp';
}

function cloneCharacter(character: SceneCharacter): SceneCharacter {
  return JSON.parse(JSON.stringify(character)) as SceneCharacter;
}

function reachActorWindow(): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: ACTOR_UID, targetUid: TARGET_UID,
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });

  for (let step = 0; step < 12; step += 1) {
    const context = flow.action._getContext(current(), actionId);
    if (!context) throw new Error('Wave56 contact ended before actor window');
    if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
      const actingUid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      const player = ownerOf(actingUid!);
      if (player === 'self' && actingUid === ACTOR_UID) {
        return actionId;
      }
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave56 actor contact window not reached');
}

function dispatchPublicDisguise(cardId: string) {
  const actionId = reachActorWindow();
  const before = cloneCharacter(current().players.self.scene.find(character => character.uid === ACTOR_UID)!);
  const beforeStateJson = JSON.stringify(current());
  const result = dispatchEngineAction({
    type: 'actionContact', actionId, player: 'self', choice: { kind: 'disguise', cardId },
  });
  return { before, beforeStateJson, result };
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});
describe('official QA Wave56: disguise swaps the contacting character and inherits its state', () => {
  // Card-bound physical rows: B02041 B02043 B02044 B02045 B02047 B02086 B05047 B06017.
  it.each(ROWS)('$cardId uses its physical hand source through the public contact window', row => {
    install(prepared(row), `${row.cardId}:wave56-positive`);
    const { before, result } = dispatchPublicDisguise(row.cardId);
    expect(result, `${row.cardId}: public disguise accepted`).toEqual({ ok: true });

    const after = current();
    const disguised = after.players.self.scene.find(character => character.uid === ACTOR_UID)!;
    expect(disguised.cardId, `${row.cardId}: same scene slot receives physical source`).toBe(row.cardId);
    expect(disguised.uid, `${row.cardId}: uid inherited`).toBe(before.uid);
    expect(disguised.state, `${row.cardId}: contact posture inherited`).toBe(before.state);
    expect(disguised.isNamed, `${row.cardId}: named state inherited`).toBe(before.isNamed);
    expect(disguised.setCards, `${row.cardId}: set occurrence identity/order/face inherited`).toEqual(before.setCards);
    expect(disguised.stackedCards, `${row.cardId}: stack occurrence identity/order inherited`).toEqual(before.stackedCards);
    expect(disguised.keywordOverrides, `${row.cardId}: gained keyword state inherited`).toEqual(before.keywordOverrides);
    expect(disguised.apOverride, `${row.cardId}: AP override inherited`).toBe(before.apOverride);
    expect(disguised.lpOverride, `${row.cardId}: LP override inherited`).toBe(before.lpOverride);
    expect(disguised.turnEffects, `${row.cardId}: prior modifiers/effects/name inherited`).toMatchObject(before.turnEffects);

    expect(after.players.self.hand, `${row.cardId}: disguise source leaves hand`).not.toContain(row.cardId);
    expect(after.players.self.deck, `${row.cardId}: replaced physical card reaches deck`).toContain(OLD_FACE);
    expect(after.players.self.deck.at(-1), `${row.cardId}: replaced physical card initially reaches exact bottom`).toBe(OLD_FACE);
    expect(after.players.self.remove, `${row.cardId}: replacement is not removal`).not.toContain(OLD_FACE);
    expect(after.players.self.remove, `${row.cardId}: attached cards remain attached`).not.toEqual(
      expect.arrayContaining([SET_A, SET_B, STACK_A, STACK_B]),
    );

    const sourceHooks = after.pendingEffects
      .filter(entry => entry.source.cardId === row.cardId)
      .map(entry => ({ hook: entry.triggeredBy.hook, abilityId: entry.source.abilityId }));
    expect(sourceHooks, `${row.cardId}: exact printed disguise rider set`).toEqual(
      row.rider ? [{ hook: 'disguise:into', abilityId: 'a2' }] : [],
    );
    expect(after.pendingEffects.some(entry => entry.triggeredBy.hook === 'enter'),
      `${row.cardId}: disguise is not entry`).toBe(false);
    expect(after.pendingEffects.some(entry => entry.triggeredBy.hook === 'leave:to-remove'),
      `${row.cardId}: old face is not removed`).toBe(false);
  });

  it.each(ROWS)('$cardId rejects FILE below its printed threshold without moving either card', row => {
    install(prepared(row, { file: row.file - 1 }), `${row.cardId}:wave56-file-negative`);
    const { beforeStateJson, result } = dispatchPublicDisguise(row.cardId);
    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current()), `${row.cardId}: rejected disguise is transactional`).toBe(beforeStateJson);
  });

  it.each(ROWS.filter(row => row.caseId === WHITE_CASE))(
    '$cardId rejects a non-white case through the public contact window',
    row => {
      install(prepared(row, { caseId: BLACK_CASE }), `${row.cardId}:wave56-color-negative`);
      const { beforeStateJson, result } = dispatchPublicDisguise(row.cardId);
      expect(result).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(current()), `${row.cardId}: case-color rejection is transactional`).toBe(beforeStateJson);
    },
  );

  it('B06017 rejects an事件 without YAIBA while preserving the contact state', () => {
    const row = ROWS.find(entry => entry.cardId === 'B06017')!;
    install(prepared(row, { caseId: PLAIN_CASE }), 'B06017:wave56-trait-negative');
    const { beforeStateJson, result } = dispatchPublicDisguise(row.cardId);
    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current()), 'B06017: case-trait rejection is transactional').toBe(beforeStateJson);
  });

  it('one contact opportunity accepts exactly one of cut-in and disguise in either order', () => {
    const row = ROWS.find(entry => entry.cardId === 'B02043')!;
    const state = prepared(row);
    state.players.self.hand.push(CUTIN);
    install(state, 'B02043:wave56-cutin-disguise-exclusive');
    const actionId = reachActorWindow();

    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'self', choice: { kind: 'cutin', cardId: CUTIN },
    })).toEqual({ ok: true });
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'self', choice: { kind: 'disguise', cardId: row.cardId },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players.self.hand).toContain(row.cardId);
    expect(current().players.self.scene.find(character => character.uid === ACTOR_UID)?.cardId).toBe(OLD_FACE);

    const reverse = prepared(row);
    reverse.players.self.hand.push(CUTIN);
    install(reverse, 'B02043:wave56-disguise-cutin-exclusive');
    const reverseActionId = reachActorWindow();
    expect(dispatchEngineAction({
      type: 'actionContact', actionId: reverseActionId, player: 'self',
      choice: { kind: 'disguise', cardId: row.cardId },
    })).toEqual({ ok: true });
    expect(dispatchEngineAction({
      type: 'actionContact', actionId: reverseActionId, player: 'self',
      choice: { kind: 'cutin', cardId: CUTIN },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players.self.hand).toContain(CUTIN);
    expect(current().players.self.scene.find(character => character.uid === ACTOR_UID)?.cardId).toBe(row.cardId);
  });
});
