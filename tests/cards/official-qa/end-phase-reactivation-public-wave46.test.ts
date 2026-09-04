// qa: card:B07023:e95274eddf61476e68accaf6348cb07eefb9d8074484ed06055f5022530a1706
// qa: card:B07045:5cd2136d7cd6a36fa7865674805d871f3b5a22a27b16725f41ce400225b941d1
// qa: card:B07072:e95274eddf61476e68accaf6348cb07eefb9d8074484ed06055f5022530a1706
// qa: card:B07088:5cd2136d7cd6a36fa7865674805d871f3b5a22a27b16725f41ce400225b941d1
// qa: card:B08015:5cd2136d7cd6a36fa7865674805d871f3b5a22a27b16725f41ce400225b941d1
// qa: card:B08073:5cd2136d7cd6a36fa7865674805d871f3b5a22a27b16725f41ce400225b941d1
// qa: card:B09002:5cd2136d7cd6a36fa7865674805d871f3b5a22a27b16725f41ce400225b941d1
// qa: card:B09049:5cd2136d7cd6a36fa7865674805d871f3b5a22a27b16725f41ce400225b941d1
// qa: card:B09065:5cd2136d7cd6a36fa7865674805d871f3b5a22a27b16725f41ce400225b941d1
// qa: card:B10036:5cd2136d7cd6a36fa7865674805d871f3b5a22a27b16725f41ce400225b941d1
// qa: card:B10045:03eff86c05f014fb09d0aa87673efa2e6279f4a4afd3e421581b8af04615f9d9
// qa: card:B10067:630449828c33e90c09ec2bc7f371af3e19ed0f237da608c4680e0f536e689b73
// Rules: 05-turn-phases.md — turn-end abilities resolve in end phase, after main actions.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07023 } from '@/cards/ct-p07/B07023';
import { B07045 } from '@/cards/ct-p07/B07045';
import { B07059 } from '@/cards/ct-p07/B07059';
import { B07072 } from '@/cards/ct-p07/B07072';
import { B07088 } from '@/cards/ct-p07/B07088';
import { B08015 } from '@/cards/ct-p08/B08015';
import { B08073 } from '@/cards/ct-p08/B08073';
import { B09002 } from '@/cards/ct-p09/B09002';
import { B09049 } from '@/cards/ct-p09/B09049';
import { B09065 } from '@/cards/ct-p09/B09065';
import { B10036 } from '@/cards/ct-p10/B10036';
import { B10045 } from '@/cards/ct-p10/B10045';
import { B10067 } from '@/cards/ct-p10/B10067';
import { D02015 } from '@/cards/ct-d02/D02015';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const HATTORI = 'W46_HATTORI';
const RED_TARGET = 'W46_RED_TARGET';
const HIROMITSU = 'W46_HIROMITSU';
const HAIBARA = 'W46_HAIBARA';
const SATO = 'W46_SATO';
const KUDO = 'W46_KUDO';
const RAN = 'W46_RAN';
const OTHER = 'W46_OTHER';
const FBI = 'W46_FBI';
const LEVEL8 = 'W46_LEVEL8';
const LEVEL7 = 'W46_LEVEL7';
const AOKO = 'W46_AOKO';
const DATE = 'W46_DATE';
const OPP_TARGET = 'W46_OPP_TARGET';
const WHITE_PARTNER = 'W46_WHITE_PARTNER';
const GREEN_PARTNER = 'W46_GREEN_PARTNER';
const DECK_FILLER = 'W46_DECK_FILLER';
const MAIN_EVENT = 'W46_MAIN_EVENT';
const DECLARED_CHAR = 'W46_DECLARED_CHAR';

type Decision =
  | { kind: 'optional'; run: boolean }
  | { kind: 'pick-uid'; uid: string }
  | { kind: 'pick-card'; cardId: string }
  | { kind: 'pick-zero' };

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['青'],
    level: 3,
    ap: 3000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...options,
  } as CardDef;
}

const fixtures = [
  fixture(HATTORI, { names: ['服部平次'] }),
  fixture(RED_TARGET, { colors: ['赤'] }),
  fixture(HIROMITSU, { names: ['諸伏景光'] }),
  fixture(HAIBARA, { names: ['灰原哀'] }),
  fixture(SATO, { names: ['佐藤美和子'] }),
  fixture(KUDO, { names: ['工藤新一'], level: 8 }),
  fixture(RAN, { names: ['毛利蘭'], level: 8, ap: 9000 }),
  fixture(OTHER),
  fixture(FBI, { traits: ['FBI'] }),
  fixture(LEVEL8, { level: 8 }),
  fixture(LEVEL7, { level: 7 }),
  fixture(AOKO, { names: ['中森青子'] }),
  fixture(DATE, { names: ['伊達航'] }),
  fixture(OPP_TARGET, { ap: 9000 }),
  fixture(WHITE_PARTNER, { kind: 'partner', colors: ['白'], level: 0, lp: 5 }),
  fixture(GREEN_PARTNER, { kind: 'partner', colors: ['緑'], level: 0, lp: 5 }),
  fixture(DECK_FILLER),
  fixture(MAIN_EVENT, { kind: 'event', level: 1 }),
  fixture(DECLARED_CHAR, {
    abilities: [{
      id: 'a1', type: 'declared', scope: 'on-scene',
      effect: { kind: 'atom', verb: 'noop', args: {} },
      description: 'Wave46 main-action admission fixture', ruleRefs: [],
    }],
  }),
];

function base(turnPlayer: Player = 'self'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.deck = Array.from({ length: 12 }, () => DECK_FILLER);
  state.players.opp.deck = Array.from({ length: 12 }, () => DECK_FILLER);
  state.players.opp.scene = [sceneChar(OPP_TARGET, 'opp-target')];
  state.players.self.partner = { cardId: WHITE_PARTNER, state: 'active', location: 'partner-area' };
  state.players.opp.partner = { cardId: GREEN_PARTNER, state: 'active', location: 'partner-area' };
  return state;
}

function install(state: GameState, label: string, human: Player = 'self'): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  resetPresentationQueue(label);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave46 state');
  return state;
}

function resolveEndTurn(decisions: readonly Decision[]): void {
  const queue = [...decisions];
  expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
  for (let step = 0; step < 24; step += 1) {
    surfacePendingSideChannels();
    const store = useGameStateStore.getState();
    if (store.pendingPublicHandReveal) {
      store.setPendingPublicHandReveal(null);
      continue;
    }
    if (store.pendingEffectOptional) {
      const decision = queue.shift();
      expect(decision?.kind).toBe('optional');
      expect(dispatchEngineAction(bindPendingDecision(store.pendingEffectOptional, {
        type: 'optionalResolve', run: decision?.kind === 'optional' ? decision.run : false,
      }))).toEqual({ ok: true });
      continue;
    }
    if (store.pendingEffectPick) {
      const decision = queue.shift();
      expect(['pick-uid', 'pick-card', 'pick-zero']).toContain(decision?.kind);
      const pickedUid = decision?.kind === 'pick-zero'
        ? null
        : decision?.kind === 'pick-uid'
          ? decision.uid
          : store.pendingEffectPick.candidates.find((candidate) => candidate.cardId === decision?.cardId)?.uid ?? null;
      if (decision?.kind !== 'pick-zero') expect(pickedUid, 'expected public pick candidate').toBeTruthy();
      expect(dispatchEngineAction(bindPendingDecision(store.pendingEffectPick, {
        type: 'effectPickResolve', pickedUid,
      }))).toEqual({ ok: true });
      continue;
    }
    if (store.pendingEffectChoice) {
      throw new Error('unexpected Wave46 choice decision');
    }
    if (!current().pendingTurnTransition) break;
  }
  expect(queue, 'all scripted end-turn decisions consumed').toEqual([]);
  expect(current().pendingTurnTransition).toBeUndefined();
  expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
}

function timingResult(cardId: string, activatedUid: string) {
  const afterEnd = current();
  const activatedState = afterEnd.players.self.scene.find((character) => character.uid === activatedUid)?.state;
  const opponentTurn = afterEnd.turn.player;

  expect(dispatchEngineAction({ type: 'reasoning', uid: 'opp-target' })).toEqual({ ok: true });
  expect(current().players.opp.scene.find((character) => character.uid === 'opp-target')?.state).toBe('sleep');
  const opponentMain = structuredClone(current());

  install(structuredClone(opponentMain), `w46-${cardId}-opp-reason`);
  const reasoningBefore = JSON.stringify(current().players.self);
  const reasoningDuringOpponentTurn = dispatchEngineAction({ type: 'reasoning', uid: activatedUid });
  const reasoningUnchanged = JSON.stringify(current().players.self) === reasoningBefore;

  install(structuredClone(opponentMain), `w46-${cardId}-opp-action`);
  const actionBefore = JSON.stringify(current().players.self);
  const actionDuringOpponentTurn = dispatchEngineAction({
    type: 'actionDeclareChar', byUid: activatedUid, targetUid: 'opp-target',
  });
  const actionUnchanged = JSON.stringify(current().players.self) === actionBefore;

  install(structuredClone(opponentMain), `w46-${cardId}-opp-end`);
  expect(dispatchEngineAction({ type: 'endTurn', player: 'opp' })).toEqual({ ok: true });
  const nextSelfTurn = structuredClone(current());
  install(structuredClone(nextSelfTurn), `w46-${cardId}-next-reason`);
  const reasoningNextSelfTurn = dispatchEngineAction({ type: 'reasoning', uid: activatedUid });
  install(structuredClone(nextSelfTurn), `w46-${cardId}-next-action`);
  const actionNextSelfTurn = dispatchEngineAction({
    type: 'actionDeclareChar', byUid: activatedUid, targetUid: 'opp-target',
  });
  return {
    activatedState,
    opponentTurn,
    reasoningDuringOpponentTurn,
    actionDuringOpponentTurn,
    selfUnchanged: reasoningUnchanged && actionUnchanged,
    reasoningNextSelfTurn,
    actionNextSelfTurn,
  };
}

function runStandard(
  card: CardDef,
  selfScene: GameState['players']['self']['scene'],
  activatedUid: string,
  decisions: readonly Decision[] = [],
  configure?: (state: GameState) => void,
) {
  const state = base();
  state.players.self.scene = selfScene;
  configure?.(state);
  install(state, `w46-${card.id}`);
  resolveEndTurn(decisions);
  return timingResult(card.id, activatedUid);
}

const expectedTiming = {
  activatedState: 'active',
  opponentTurn: 'opp',
  reasoningDuringOpponentTurn: { ok: false, reason: 'not-allowed' },
  actionDuringOpponentTurn: { ok: false, reason: 'not-allowed' },
  selfUnchanged: true,
  reasoningNextSelfTurn: { ok: true },
  actionNextSelfTurn: { ok: true },
} as const;

const expectedStunTiming = { ...expectedTiming, activatedState: 'sleep' } as const;

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.getState().setGameState(null);
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetActionContexts();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave46: end-phase activation cannot reopen main actions', () => {
  it('B07023 removes itself, activates Hattori, and cannot reuse that character until next self turn', () => {
    expect(runStandard(B07023, [
      sceneChar(B07023.id, 'source'),
      sceneChar(HATTORI, 'activated', { state: 'sleep' }),
    ], 'activated', [
      { kind: 'optional', run: true },
      { kind: 'pick-uid', uid: 'activated' },
    ])).toEqual(expectedTiming);
  });

  it('B07072 removes itself, activates a red character, and cannot reopen main actions', () => {
    expect(runStandard(B07072, [
      sceneChar(B07072.id, 'source'),
      sceneChar(RED_TARGET, 'activated', { state: 'sleep' }),
    ], 'activated', [
      { kind: 'optional', run: true },
      { kind: 'pick-uid', uid: 'activated' },
    ])).toEqual(expectedTiming);
  });

  it('B07088 activates itself with Hiromitsu present but remains outside main phase', () => {
    expect(runStandard(B07088, [
      sceneChar(B07088.id, 'source', { state: 'sleep' }),
      sceneChar(HIROMITSU, 'hiromitsu'),
    ], 'source')).toEqual(expectedTiming);
  });

  it('B08015 activates itself with Haibara present but remains outside main phase', () => {
    expect(runStandard(B08015, [
      sceneChar(B08015.id, 'source', { state: 'sleep' }),
      sceneChar(HAIBARA, 'haibara'),
    ], 'source')).toEqual(expectedTiming);
  });

  it('B08073 satisfies Bond/all-name gates, activates itself, and cannot reopen main actions', () => {
    expect(runStandard(B08073, [
      sceneChar(B08073.id, 'source', { state: 'sleep' }),
      sceneChar(SATO, 'sato'),
    ], 'source')).toEqual(expectedTiming);
  });

  it('B09049 sleeps another character, activates itself, and remains in end-phase timing', () => {
    expect(runStandard(B09049, [
      sceneChar(B09049.id, 'source', { state: 'sleep' }),
      sceneChar(OTHER, 'other'),
    ], 'source', [{ kind: 'pick-uid', uid: 'other' }])).toEqual(expectedTiming);
  });

  it('B09065 sleeps itself, activates an FBI character, and cannot reopen main actions', () => {
    expect(runStandard(B09065, [
      sceneChar(B09065.id, 'source'),
      sceneChar(FBI, 'activated', { state: 'sleep' }),
    ], 'activated', [
      { kind: 'optional', run: true },
      { kind: 'pick-uid', uid: 'activated' },
    ])).toEqual(expectedTiming);
  });

  it('B10036 activates only the level-8 target and cannot reopen main actions', () => {
    expect(runStandard(B10036, [
      sceneChar(B10036.id, 'source'),
      sceneChar(LEVEL8, 'activated', { state: 'sleep' }),
      sceneChar(LEVEL7, 'decoy', { state: 'sleep' }),
    ], 'activated', [{ kind: 'pick-uid', uid: 'activated' }])).toEqual(expectedTiming);
  });

  it('B10045 satisfies Bond/resolved-case gates, activates itself, and remains outside main phase', () => {
    expect(runStandard(B10045, [
      sceneChar(B10045.id, 'source', { state: 'sleep' }),
      sceneChar(AOKO, 'aoko'),
    ], 'source', [], (state) => { state.players.self.case.status = '解決編'; })).toEqual(expectedTiming);
  });

  it('B10067 satisfies Date Bond, activates itself, and cannot reopen main actions', () => {
    expect(runStandard(B10067, [
      sceneChar(B10067.id, 'source', { state: 'sleep' }),
      sceneChar(DATE, 'date'),
    ], 'source')).toEqual(expectedTiming);
  });

  it('applies the stun replacement on direct-self and picked-target activation routes', () => {
    expect(runStandard(B07088, [
      sceneChar(B07088.id, 'source', { state: 'stun' }),
      sceneChar(HIROMITSU, 'hiromitsu'),
    ], 'source')).toEqual(expectedStunTiming);

    expect(runStandard(B10036, [
      sceneChar(B10036.id, 'source'),
      sceneChar(LEVEL8, 'activated', { state: 'stun' }),
    ], 'activated', [{ kind: 'pick-uid', uid: 'activated' }])).toEqual(expectedStunTiming);
  });

  it('B07045 publicly places Red Tear in partner area before its end-turn activation', () => {
    const state = base();
    state.players.self.scene = [sceneChar(B07045.id, 'source', { state: 'sleep' })];
    state.players.self.hand = [B07059.id];
    state.players.self.file = Array.from({ length: 5 }, (_value, index) => ({
      type: 'card-back' as const, cardId: `W46_FILE_${index}`,
    }));
    state.players.self.case.colors = ['白'];
    state.players.self.partner = { cardId: WHITE_PARTNER, state: 'active', location: 'partner-area' };
    install(state, 'w46-B07045-public-pa');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B07059.id })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const removal = useGameStateStore.getState().pendingEffectPick!;
    expect(removal.source.cardId).toBe(B07059.id);
    expect(dispatchEngineAction(bindPendingDecision(removal, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(current().players.self.partnerAreaCards).toContain(B07059.id);
    resolveEndTurn([]);
    expect(timingResult(B07045.id, 'source')).toEqual(expectedTiming);
  });

  it('B09002 publicly reaches PA by opponent-turn MR removal, then activates Ran at self end', () => {
    const state = base('opp');
    state.players.self.scene = [
      sceneChar(B09002.id, 'mr-source'),
      sceneChar(RAN, 'activated'),
    ];
    state.players.self.hand = [KUDO];
    state.players.opp.hand = [D02015.id];
    state.players.opp.case.colors = ['緑'];
    state.players.opp.file = Array.from({ length: 5 }, (_value, index) => ({
      type: 'card-back' as const, cardId: `W46_OPP_FILE_${index}`,
    }));
    state.players.opp.partner = { cardId: GREEN_PARTNER, state: 'active', location: 'partner-area' };
    install(state, 'w46-B09002-public-pa');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'opp', cardId: D02015.id })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const eventPick = useGameStateStore.getState().pendingEffectPick;
    if (eventPick) {
      const mr = eventPick.candidates.find((candidate) => candidate.cardId === B09002.id);
      expect(mr).toBeTruthy();
      expect(dispatchEngineAction(bindPendingDecision(eventPick, {
        type: 'effectPickResolve', pickedUid: mr!.uid,
      }))).toEqual({ ok: true });
    }
    expect(current().players.self.partnerAreaMR?.cardId).toBe(B09002.id);
    expect(dispatchEngineAction({ type: 'endTurn', player: 'opp' })).toEqual({ ok: true });
    expect(current().turn.player).toBe('self');
    expect(dispatchEngineAction({ type: 'reasoning', uid: 'activated' })).toEqual({ ok: true });
    resolveEndTurn([
      { kind: 'pick-card', cardId: KUDO },
      { kind: 'pick-uid', uid: 'activated' },
    ]);
    expect(timingResult(B09002.id, 'activated')).toEqual(expectedTiming);
  });
});

describe('Wave46 optional and zero-candidate controls', () => {
  it('B07023 decline keeps source/target, while B07072 accept+zero removes only source', () => {
    const decline = base();
    decline.players.self.scene = [
      sceneChar(B07023.id, 'source'),
      sceneChar(HATTORI, 'target', { state: 'sleep' }),
    ];
    install(decline, 'w46-B07023-decline');
    resolveEndTurn([{ kind: 'optional', run: false }]);
    expect(current().players.self.scene.find((character) => character.uid === 'source')).toBeTruthy();
    expect(current().players.self.scene.find((character) => character.uid === 'target')?.state).toBe('sleep');

    const zero = base();
    zero.players.self.scene = [sceneChar(B07072.id, 'source')];
    install(zero, 'w46-B07072-zero');
    resolveEndTurn([{ kind: 'optional', run: true }]);
    expect(current().players.self.remove).toContain(B07072.id);
    expect(current().turn.player).toBe('opp');
  });

  it('B09049 zero pick breaks its chain; B09065 decline or zero preserves exact paid state', () => {
    const b09049 = base();
    b09049.players.self.scene = [
      sceneChar(B09049.id, 'source', { state: 'sleep' }),
      sceneChar(OTHER, 'other'),
    ];
    install(b09049, 'w46-B09049-zero');
    resolveEndTurn([{ kind: 'pick-zero' }]);
    expect(current().players.self.scene.find((character) => character.uid === 'source')?.state).toBe('sleep');
    expect(current().players.self.scene.find((character) => character.uid === 'other')?.state).toBe('active');

    const decline = base();
    decline.players.self.scene = [
      sceneChar(B09065.id, 'source'),
      sceneChar(FBI, 'target', { state: 'sleep' }),
    ];
    install(decline, 'w46-B09065-decline');
    resolveEndTurn([{ kind: 'optional', run: false }]);
    expect(current().players.self.scene.find((character) => character.uid === 'source')?.state).toBe('active');
    expect(current().players.self.scene.find((character) => character.uid === 'target')?.state).toBe('sleep');

    const zero = base();
    zero.players.self.scene = [sceneChar(B09065.id, 'source')];
    install(zero, 'w46-B09065-zero');
    resolveEndTurn([{ kind: 'optional', run: true }]);
    expect(current().players.self.scene.find((character) => character.uid === 'source')?.state).toBe('sleep');
  });

  it('B10036 with only a level-7 decoy settles without a pick or activation', () => {
    const state = base();
    state.players.self.scene = [
      sceneChar(B10036.id, 'source'),
      sceneChar(LEVEL7, 'decoy', { state: 'sleep' }),
    ];
    install(state, 'w46-B10036-zero');
    resolveEndTurn([]);
    expect(current().players.self.scene.find((character) => character.uid === 'decoy')?.state).toBe('sleep');
    expect(current().turn.player).toBe('opp');
  });
});

describe('main-action admission boundary exposed by Wave46', () => {
  it('rejects every ending-player main action after transfer, while the next self turn admits them', () => {
    const state = base();
    state.players.self.scene = [
      sceneChar(B07088.id, 'source', { state: 'sleep' }),
      sceneChar(HIROMITSU, 'hiromitsu'),
    ];
    state.players.self.hand = [MAIN_EVENT];
    state.players.self.file = [
      { type: 'card-back', cardId: DECK_FILLER },
      { type: 'card-back', cardId: DECK_FILLER },
    ];
    state.players.self.case.colors = ['青'];
    install(state, 'w46-main-admission-opponent-turn');
    resolveEndTurn([]);
    expect(current().turn.player).toBe('opp');
    expect(dispatchEngineAction({ type: 'reasoning', uid: 'opp-target' })).toEqual({ ok: true });
    const opponentMain = structuredClone(current());

    const onClone = (label: string, action: Parameters<typeof dispatchEngineAction>[0]) => {
      install(structuredClone(opponentMain), `w46-main-${label}`);
      const before = JSON.stringify(current());
      const result = dispatchEngineAction(action);
      return { result, unchanged: JSON.stringify(current()) === before };
    };
    expect(onClone('reason', { type: 'reasoning', uid: 'source' })).toEqual({
      result: { ok: false, reason: 'not-allowed' }, unchanged: true,
    });
    expect(onClone('action', { type: 'actionDeclareChar', byUid: 'source', targetUid: 'opp-target' })).toEqual({
      result: { ok: false, reason: 'not-allowed' }, unchanged: true,
    });
    expect(onClone('hand', { type: 'handUseCard', player: 'self', cardId: MAIN_EVENT })).toEqual({
      result: { ok: false, reason: 'not-allowed' }, unchanged: true,
    });
    expect(onClone('hint', { type: 'nextHint', player: 'self' })).toEqual({
      result: { ok: false, reason: 'not-allowed' }, unchanged: true,
    });
    expect(onClone('declared', { type: 'declaredAbility', uid: 'source', abilId: 'a2' })).toEqual({
      result: { ok: false, reason: 'not-allowed' }, unchanged: true,
    });
    expect(onClone('assist', { type: 'assist', player: 'self' })).toEqual({
      result: { ok: false, reason: 'not-allowed' }, unchanged: true,
    });
    expect(onClone('partner', { type: 'partnerAbility', player: 'self', abilId: 'a1' })).toEqual({
      result: { ok: false, reason: 'not-allowed' }, unchanged: true,
    });

    install(structuredClone(opponentMain), 'w46-main-next-turn');
    expect(dispatchEngineAction({ type: 'endTurn', player: 'opp' })).toEqual({ ok: true });
    const nextSelfMain = structuredClone(current());
    install(structuredClone(nextSelfMain), 'w46-main-next-hand');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: MAIN_EVENT })).toEqual({ ok: true });
    install(structuredClone(nextSelfMain), 'w46-main-next-hint');
    expect(dispatchEngineAction({ type: 'nextHint', player: 'self' })).toEqual({ ok: true });
  });

  it('rejects all main actions while an end-phase optional decision still owns the turn transition', () => {
    const state = base();
    state.players.self.scene = [
      sceneChar(B07023.id, 'source'),
      sceneChar(HATTORI, 'target', { state: 'sleep' }),
      sceneChar(DECLARED_CHAR, 'declarer'),
    ];
    state.players.self.hand = [MAIN_EVENT];
    state.players.self.file = [{ type: 'card-back', cardId: DECK_FILLER }];
    state.players.self.case.colors = ['青'];
    install(state, 'w46-main-end-phase-lock');
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional).toBeTruthy();
    const before = JSON.stringify(current());
    expect(dispatchEngineAction({ type: 'reasoning', uid: 'source' })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'opp-target' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: MAIN_EVENT }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'nextHint', player: 'self' })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'declarer', abilId: 'a1' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'partnerAbility', player: 'self', abilId: 'a1' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
    expect(dispatchEngineAction(bindPendingDecision(optional!, {
      type: 'optionalResolve', run: false,
    }))).toEqual({ ok: true });
    expect(current().turn.player).toBe('opp');
  });
});
