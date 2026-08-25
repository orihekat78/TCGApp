// qa: card:B09109:87aa9ca394d3b7a7faa9cc64726031a8e157f606ad5c5fab6f9690c1e7ed7c45
// qa: card:B09109:62957e90ade0898f52e0d15e7ee97559e533abac9805a358a2e556d9d26c81be
// qa: card:B09109:d6aea3c6390f1bfa68a1f4f2d86390573e242c9a4c34e8efc3a234eea2ad0d91
// qa: card:B09109:212da49cce2aca6921fdb352e94b610cbdeeebd02d0ab5c66e8200c0164c3a0e
// qa: card:B09109:636d66e72f92b3a3945a9d5e3618003348be0080c29c488fa2626a46dd44a131
// qa: card:B09109:14ada03fa9ae7313cb5442dfa2d084a4581c09adcde928c7f50a92dcc281585c
// qa: card:B09109:c7a68e13ec1b5b8e1c7987fc1225f6ee61e19610f863268de62fed9a026bb022
// qa: card:B09109:80a2cfb16a87e5d0d4da8698cb86f47b173740616dd1af4e02537a5deb1ade52
// qa: card:B09109:c025e65ad44b177170cd1e72fe34f5e46384f4bce0578ac6a5b80321a66902f3

import { produce } from 'immer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09109 } from '@/cards/ct-p09/B09109';
import { B09109P } from '@/cards/ct-p09/B09109P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ROWS = [B09109, B09109P] as const;
const CASES = ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner })));
const EFFECTIVE_NAME = 'W128_EFFECTIVE_NAME';
const CHOSEN = fixture('W128_CHOSEN', { names: ['W128_ORIGINAL_NAME'], level: 3 });
const DECOY = fixture('W128_DECOY', { names: ['W128_OTHER_NAME'], level: 5 });
const NO_MATCH = fixture('W128_NO_MATCH', { names: ['W128_NO_MATCH_NAME'], level: 5 });
const DRAW = fixture('W128_DRAW', { kind: 'event', ap: undefined, lp: undefined });
const DISGUISE = fixture('W128_DISGUISE', { ap: 6000 });
const REVEAL = fixture('W128_REVEAL', { names: ['京極真'], level: 8 });
const NAME_TARGET = fixture('W128_NAME_TARGET', {
  names: ['毛利蘭'], level: 4, ap: 4000, traits: ['高校生'],
});
const enterDraw: AbilityDef = {
  id: 'enter-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Wave128 nested entry sentinel.', ruleRefs: ['rules/17-icons.md'],
};
const MATCH = fixture('W128_MATCH', { names: [EFFECTIVE_NAME], level: 5, abilities: [enterDraw] });

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave128 state');
  return state;
}

function base(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 9, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    sceneChar(card.id, 'source'),
    sceneChar(CHOSEN.id, 'chosen', {
      turnEffects: {
        contactImmune: false,
        removeOnTurnEnd: false,
        lvlMod_turn: 2,
        nameOverride: EFFECTIVE_NAME,
      },
    }),
  ];
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave128-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function dismissPresentation(): void {
  surfacePendingSideChannels();
  if (useGameStateStore.getState().pendingDeckReveal) {
    useGameStateStore.getState().setPendingDeckReveal(null);
  }
}

function declareAbility(card: CardDef, uid: string, abilityId: 'a1' | 'a2', abilityIndex: 0 | 1): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid, abilId: abilityId,
    abilityOrigin: 'printed', abilityIndex,
  })).toEqual({ ok: true });
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({
    ownerPlayer: pending?.ownerPlayer,
    atomVerb: 'bindPick',
    source: { uid, cardId: card.id, abilityId },
  });
}

function resolveCurrentPick(uid: string | null): void {
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
  dismissPresentation();
}

function runA1(card: CardDef, owner: Player, deck: string[], label: string): GameState {
  const state = base(card, owner);
  state.players[owner].deck = [...deck];
  install(state, owner, label);
  expect([B09109.id, B09109P.id]).toContain(card.id);
  expect(readChar.level(current(), 'chosen')).toBe(5);
  expect(readChar.names(current(), 'chosen')).toEqual([EFFECTIVE_NAME]);
  declareAbility(card, 'source', 'a1', 0);
  expect(useGameStateStore.getState().pendingEffectPick?.candidates.map(candidate => candidate.uid))
    .toContain('chosen');
  resolveCurrentPick('chosen');
  return current();
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [CHOSEN, DECOY, NO_MATCH, DRAW, DISGUISE, REVEAL, NAME_TARGET, MATCH]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave128: a1 uses effective values, enters the match, then resolves its enter hook', () => {
  it.each(CASES)('$card.id owner $owner', ({ card, owner }) => {
    const state = runA1(card, owner, [DECOY.id, MATCH.id, DRAW.id], `${card.id}-${owner}-match`);
    const entered = state.players[owner].scene.find(character => character.cardId === MATCH.id);
    expect(entered).toBeTruthy();
    expect(entered?.turnEffects.toDeckBottomOnTurnEnd).toBe(true);
    expect(state.players[owner].deck).not.toContain(MATCH.id);
    expect(state.players[owner].hand).toHaveLength(1);
    const nested = state.pendingEffects.filter(effect => (
      effect.source.cardId === MATCH.id && effect.source.abilityId === enterDraw.id
    ));
    expect(nested).toHaveLength(1);
    expect(nested[0]?.state).toBe('resolved');
    const shuffleIndex = state.log.findIndex(entry => entry.action === 'effect:deckShuffle');
    const drawIndex = state.log.findIndex(entry => entry.action === 'effect:draw');
    expect(shuffleIndex).toBeGreaterThanOrEqual(0);
    expect(drawIndex).toBeGreaterThan(shuffleIndex);
  });
});

describe('official QA Wave128: a1 no-match returns the full reveal and shuffles without entry', () => {
  it.each(CASES)('$card.id owner $owner', ({ card, owner }) => {
    const initialDeck = [DECOY.id, NO_MATCH.id, DRAW.id];
    const state = runA1(card, owner, initialDeck, `${card.id}-${owner}-no-match`);
    expect(state.players[owner].scene.map(character => character.cardId))
      .toEqual([card.id, CHOSEN.id]);
    expect([...state.players[owner].deck].sort()).toEqual([...initialDeck].sort());
    expect(state.players[owner].hand).toEqual([]);
    expect(state.log.some(entry => entry.action === 'effect:deckShuffle')).toBe(true);
  });
});

describe('official QA Wave128: disguise inherits the rider and leave-before-end discards it', () => {
  it.each(CASES.flatMap(item => (
    ['disguise', 'leave'] as const
  ).map(mode => ({ ...item, mode }))))('$card.id owner $owner mode $mode', ({ card, owner, mode }) => {
    runA1(card, owner, [MATCH.id, DRAW.id, DECOY.id], `${card.id}-${owner}-${mode}`);
    const entered = current().players[owner].scene.find(character => character.cardId === MATCH.id)!;
    const changed = produce(current(), draft => {
      if (mode === 'disguise') mutate.char.disguiseInto(draft, entered.uid, DISGUISE.id);
      else mutate.scene.removeToRemove(draft, entered.uid, 'effect');
    });
    expect(useGameStateStore.getState().setGameState(changed)).toBe(true);

    if (mode === 'disguise') {
      const disguised = current().players[owner].scene.find(character => character.uid === entered.uid)!;
      expect(disguised).toMatchObject({
        cardId: DISGUISE.id,
        turnEffects: { toDeckBottomOnTurnEnd: true },
      });
    } else {
      expect(current().players[owner].scene.some(character => character.uid === entered.uid)).toBe(false);
      expect(current().players[owner].remove).toContain(MATCH.id);
    }

    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    if (mode === 'disguise') {
      expect(current().players[owner].deck.at(-1)).toBe(DISGUISE.id);
    } else {
      expect(current().players[owner].deck).not.toContain(MATCH.id);
      expect(current().players[owner].remove).toContain(MATCH.id);
    }
  });
});

describe('official QA Wave128: a2 reveal cost is transient and name replacement is complete', () => {
  it.each(CASES)('$card.id owner $owner', ({ card, owner }) => {
    const sceneState = createEmptyGameState();
    sceneState.turn = { number: 9, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    sceneState.players[owner].scene = [
      sceneChar(card.id, 'source'),
      sceneChar(NAME_TARGET.id, 'target'),
    ];
    sceneState.players[owner].hand = [REVEAL.id];
    install(sceneState, owner, `${card.id}-${owner}-a2-scene`);
    expect([B09109.id, B09109P.id]).toContain(card.id);
    declareAbility(card, 'source', 'a2', 1);
    expect(current().players[owner].hand).toEqual([REVEAL.id]);
    expect(useGameStateStore.getState().pendingEffectPick?.candidates.map(candidate => candidate.uid))
      .toEqual(expect.arrayContaining(['source', 'target']));
    const original = {
      level: readChar.level(current(), 'source'),
      ap: readChar.ap(current(), 'source'),
      traits: [...card.traits],
    };
    resolveCurrentPick('source');
    expect(readChar.names(current(), 'source')).toEqual(['京極真']);
    expect(readChar.names(current(), 'source')).not.toContain('怪盗キッド&安室透');
    expect({
      level: readChar.level(current(), 'source'),
      ap: readChar.ap(current(), 'source'),
      traits: card.traits,
    }).toEqual(original);
    expect(current().players[owner].hand).toEqual([REVEAL.id]);
    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    expect(readChar.names(current(), 'source')).toEqual(card.names);

    const paState = createEmptyGameState();
    paState.turn = { number: 9, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    const partnerUid = 'partnerMR:' + owner;
    paState.players[owner].partnerAreaMR = sceneChar(card.id, partnerUid);
    paState.players[owner].scene = [sceneChar(NAME_TARGET.id, 'target')];
    paState.players[owner].hand = [REVEAL.id];
    install(paState, owner, `${card.id}-${owner}-a2-pa`);
    declareAbility(card, partnerUid, 'a2', 1);
    expect(useGameStateStore.getState().pendingEffectPick?.candidates.map(candidate => candidate.uid))
      .toEqual(['target']);
    expect(current().players[owner].hand).toEqual([REVEAL.id]);
    resolveCurrentPick('target');
    expect(readChar.names(current(), 'target')).toEqual(['京極真']);
  });
});
