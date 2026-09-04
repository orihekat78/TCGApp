// qa: card:B07030:dc07d737cba65ebccfc43e14a2de345262a316223691c7ff5eba2a0c7906bcc0
// qa: card:B07059:a97d46d3ab0116f37821991f7d72e241ecfa6e2ff8a5930e1ce47aea3939bad7
// qa: card:B07061:b741226e5112f1cb5900d424bf2714a1064c6f2748d3a65cbf03d6c1e9cfdd91
// qa: card:B10046:a97d46d3ab0116f37821991f7d72e241ecfa6e2ff8a5930e1ce47aea3939bad7
// qa: card:PR196:a97d46d3ab0116f37821991f7d72e241ecfa6e2ff8a5930e1ce47aea3939bad7
// qa: card:PR297:a97d46d3ab0116f37821991f7d72e241ecfa6e2ff8a5930e1ce47aea3939bad7
// Rules: 03-field-areas. Partner-area cards have no count limit.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectChoiceSide,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/pending-state';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { registerAll } from '@/cards';
import { sceneChar } from '../../helpers/fixtures';
import { startCausalSession } from '@/engine/log/causal';
import { getPresentationQueue, resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';

type Route = 'declared-scene' | 'event-use' | 'declared-case' | 'phase-end';
type Row = { cardId: string; route: Route; movedCardId: string };

const GEM = 'W72-GEM';
const DECOY = 'W72-DECOY';
const OTHER_GEM = 'W72-OTHER-GEM';
const KAITO = 'W72-KAITO';
const AOKO = 'W72-AOKO';
const TAIL = 'W72-TAIL';
const PARTNER = 'W72-PARTNER';
const SEED = Array.from({ length: 8 }, (_, index) => `W72-PA-${index + 1}`);

const PRINTINGS: Row[] = [
  { cardId: 'B07030', route: 'declared-scene', movedCardId: GEM },
  { cardId: 'B07030P', route: 'declared-scene', movedCardId: GEM },
  { cardId: 'B07030P2', route: 'declared-scene', movedCardId: GEM },
  { cardId: 'B07059', route: 'event-use', movedCardId: 'B07059' },
  { cardId: 'B07059P', route: 'event-use', movedCardId: 'B07059P' },
  { cardId: 'B07061', route: 'declared-case', movedCardId: GEM },
  { cardId: 'B07061P', route: 'declared-case', movedCardId: GEM },
  { cardId: 'B10046', route: 'phase-end', movedCardId: GEM },
  { cardId: 'PR196', route: 'event-use', movedCardId: 'PR196' },
  { cardId: 'PR297', route: 'event-use', movedCardId: 'PR297' },
];

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: id, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

const FIXTURES: CardDef[] = [
  fixture(GEM, { kind: 'event', traits: ['ビッグジュエル'] }),
  fixture(DECOY, { kind: 'event', traits: ['別特徴'] }),
  fixture(OTHER_GEM, { kind: 'event', traits: ['ビッグジュエル'] }),
  fixture(KAITO, { names: ['怪盗キッド'] }),
  fixture(AOKO, { names: ['中森青子'] }),
  fixture(TAIL),
  fixture(PARTNER, { kind: 'partner', lp: 5 }),
  ...SEED.map(id => fixture(id, { kind: 'event' })),
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function resetRuntime(): void {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  _clearPendingEffectChoiceSide();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
}

function baseState(owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
  state.players[owner].case = { ...state.players[owner].case, colors: ['白'], status: '解決編' };
  state.players[owner].file = Array.from({ length: 7 }, () => ({ type: 'card-back' as const, cardId: TAIL }));
  state.players[owner].partnerAreaCards = [...SEED];
  state.players[owner].remove = [DECOY];
  state.players[other(owner)].partnerAreaCards = ['W72-OTHER-PA'];
  state.players[other(owner)].remove = [OTHER_GEM];
  state.players.self.deck = [TAIL, TAIL, TAIL, TAIL];
  state.players.opp.deck = [TAIL, TAIL, TAIL, TAIL];
  return state;
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave72 state');
  return state;
}

function install(state: GameState, label: string, owner: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function sourceUid(row: Row, owner: Player): string {
  return row.route === 'declared-case' ? `case:${owner}` : `${owner}-source`;
}

function resolvePublicPick(row: Row, owner: Player, verb: string, cardId: string): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending?.atomVerb).toBe(verb);
  expect(pending?.source).toMatchObject({
    cardId: row.cardId, uid: sourceUid(row, owner), abilityId: row.route === 'declared-case' ? 'a2' : 'a1',
  });
  const target = pending?.candidates.find(candidate => candidate.cardId === cardId);
  expect(target, `${verb}: ${cardId} candidate`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: target!.uid,
  }))).toEqual({ ok: true });
}

function resolvePublicChoice(optionIndex: number): void {
  surfacePendingSideChannels();
  const choice = useGameStateStore.getState().pendingEffectChoice;
  expect(choice?.options).toHaveLength(2);
  expect(dispatchEngineAction(bindPendingDecision(choice!, {
    type: 'choiceResolve', choiceIndex: optionIndex,
  }))).toEqual({ ok: true });
}

function runPrinting(row: Row, owner: Player): GameState {
  const state = baseState(owner);

  if (row.route === 'declared-scene') {
    state.players[owner].scene = [sceneChar(row.cardId, `${owner}-source`)];
    state.players[owner].remove.push(GEM);
  } else if (row.route === 'declared-case') {
    state.players[owner].case = { ...state.players[owner].case, cardId: row.cardId };
    state.players[owner].evidence = [{ cardId: TAIL, faceUp: false, origin: { turn: 1, via: 'effect' } }];
    state.players[owner].remove.push(GEM);
  } else if (row.route === 'phase-end') {
    state.players[owner].scene = [
      sceneChar(row.cardId, `${owner}-source`),
      sceneChar(KAITO, `${owner}-kaito`),
    ];
    state.players[owner].remove.push(GEM);
  } else {
    state.players[owner].hand = [row.cardId];
    state.players[owner].deck = row.cardId === 'PR196' ? [AOKO, TAIL] : [TAIL];
  }
  // Public route sources: B07030 B07059 B07061 B10046 PR196 PR297.
  install(state, `${row.cardId}:wave72-${owner}`, owner);
  if (row.route === 'declared-scene') {
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: sourceUid(row, owner), abilId: 'a1',
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    resolvePublicPick(row, owner, 'toPartnerArea', GEM);
  } else if (row.route === 'declared-case') {
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: sourceUid(row, owner), abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { flipFaceUpEvidence: { indices: [0] } },
    })).toEqual({ ok: true });
    resolvePublicPick(row, owner, 'toPartnerArea', GEM);
  } else if (row.route === 'phase-end') {
    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    resolvePublicPick(row, owner, 'bindPick', GEM);
    resolvePublicChoice(0);
  } else {
    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: row.cardId }))
      .toEqual({ ok: true });
  }

  return current();
}

beforeEach(() => {
  resetRuntime();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});
// Card-bound physical rows: B07030/P/P2 B07059/P B07061/P B10046 PR196 PR297.
describe('official QA Wave72: partner-area cards have no upper count limit', () => {
  it.each(PRINTINGS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$cardId moves through its physical $route route for owner $owner above ordinary board counts',
    ({ owner, ...row }) => {
      const state = runPrinting(row, owner);
      expect(state.players[owner].partnerAreaCards).toEqual([...SEED, row.movedCardId]);
      expect(state.players[owner].remove).toEqual([DECOY]);
      expect(state.players[other(owner)].partnerAreaCards).toEqual(['W72-OTHER-PA']);
      expect(state.players[other(owner)].remove).toEqual([OTHER_GEM]);
      surfacePendingSideChannels();
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
    },
  );

  it.each([
    PRINTINGS.find(row => row.cardId === 'B07030P2')!,
    PRINTINGS.find(row => row.cardId === 'PR297')!,
  ])('$cardId accumulated order survives save hydration', row => {
    const state = runPrinting(row, 'self');
    const saved = JSON.parse(JSON.stringify(state)) as GameState;

    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    expect(useGameStateStore.getState().gameState?.players.self.partnerAreaCards)
      .toEqual([...SEED, row.movedCardId]);
  });

  it('rejects forged and stale public occurrence decisions without state, runtime, or presentation changes', () => {
    const row = PRINTINGS.find(entry => entry.cardId === 'B07030')!;
    const state = baseState('self');
    state.players.self.scene = [sceneChar(row.cardId, 'self-source')];
    state.players.self.remove.push(GEM);
    install(state, 'B07030:wave72-occurrence-authority', 'self');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'self-source', abilId: 'a1',
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick!;
    const selected = pending.candidates.find(candidate => candidate.cardId === GEM)!;

    const assertRejectedWithoutMutation = (action: ReturnType<typeof bindPendingDecision>) => {
      const stateRef = current();
      const stateJson = JSON.stringify(stateRef);
      const runtimeJson = JSON.stringify(stateRef.pendingRuntimeState);
      const pickRef = useGameStateStore.getState().pendingEffectPick;
      const presentation = {
        revision: getPresentationQueue().revision(),
        epoch: getPresentationQueue().currentEpoch(),
        items: getPresentationQueue().items(),
      };
      expect(dispatchEngineAction(action)).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(stateRef);
      expect(JSON.stringify(current())).toBe(stateJson);
      expect(JSON.stringify(current().pendingRuntimeState)).toBe(runtimeJson);
      expect(useGameStateStore.getState().pendingEffectPick).toBe(pickRef);
      expect({
        revision: getPresentationQueue().revision(),
        epoch: getPresentationQueue().currentEpoch(),
        items: getPresentationQueue().items(),
      }).toEqual(presentation);
    };

    assertRejectedWithoutMutation(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: 'remove:self:forged',
    }));
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: selected.uid,
    }))).toEqual({ ok: true });
    assertRejectedWithoutMutation(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: selected.uid,
    }));
    expect(current().players.self.partnerAreaCards).toEqual([...SEED, GEM]);
    expect(current().players.self.remove).toEqual([DECOY]);
  });

  it('CPU selects the physical B10046 target and appends beyond eight existing cards', () => {
    const row = PRINTINGS.find(entry => entry.cardId === 'B10046')!;
    const state = baseState('opp');
    state.turn.phase = 'end';
    state.players.opp.scene = [sceneChar(row.cardId, 'opp-source'), sceneChar(KAITO, 'opp-kaito')];
    state.players.opp.remove.push(GEM);
    (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;

    event.emit(state, 'phase:end:start', { player: 'opp' }, undefined);
    for (let index = 0; index < 4; index += 1) {
      runAllUntilEmpty(state);
      drainAiEffectPicks(state);
    }

    expect(state.players.opp.partnerAreaCards).toEqual([...SEED, GEM]);
    expect(state.players.opp.remove).toEqual([DECOY]);
    expect(state.players.self.partnerAreaCards).toEqual(['W72-OTHER-PA']);
    expect(state.players.self.remove).toEqual([OTHER_GEM]);
  });
});
