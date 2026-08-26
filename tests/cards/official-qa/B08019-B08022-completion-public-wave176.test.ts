// qa: card:B08019:c3e39b5f3aa8ed0eb6d3559b0878dcec5c606a324573fdbe79826a0a3408072f
// qa: card:B08021:a6add0dc4b2507c3e3f4be946dc8ef3c4bf8d0aec6a6ee16c494f969d2fcb7be
// qa: card:B08022:9571a8a6da4f245a23f4f79f11e752d4568bbfd2cb6d40989c21feb81da5c3b2
// qa: card:B08022:fcb6f507709093fc8d054bbcb630ffbb68ae8281d49c36c305050223560f39fa

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08019 } from '@/cards/ct-p08/B08019';
import { B08019P } from '@/cards/ct-p08/B08019P';
import { B08021 } from '@/cards/ct-p08/B08021';
import { B08022 } from '@/cards/ct-p08/B08022';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const GREEN_PARTNER = fixture('W176_GREEN_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1,
});
const WAZUHA = fixture('W176_WAZUHA', { names: ['遠山和葉'] });
const MARO = fixture('W176_MARO', { names: ['マロちゃん'] });
const NON_MARO = fixture('W176_NON_MARO', { names: ['大岡紅葉'] });
const AP_TARGET = fixture('W176_AP_TARGET', { ap: 8000, level: 8 });
const FILLER = fixture('W176_FILLER', { kind: 'event', ap: undefined, lp: undefined });
const FIXTURES = [GREEN_PARTNER, WAZUHA, MARO, NON_MARO, AP_TARGET, FILLER];
const B08019_PRINTS = [B08019, B08019P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave176 game state');
  return state;
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: FILLER.id }));
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave176-${label}`);
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

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
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

describe('official QA Wave176: B08019 MR replacement precedes same-name enter observers', () => {
  it.each(B08019_PRINTS.flatMap((entering, index) => (
    (['self', 'opp'] as const).map(owner => ({ entering, existing: B08019_PRINTS[1 - index]!, owner }))
  )))('$entering.id owner=$owner removes the old MR without firing its same-name observer',
    ({ entering, existing, owner }) => {
      const state = createEmptyGameState();
      state.turn = { number: 176, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].case.colors = ['緑'];
      state.players[owner].partner = { cardId: GREEN_PARTNER.id, state: 'active', location: 'partner-area' };
      state.players[owner].file = fileCards(entering.level ?? 0);
      state.players[owner].hand = [entering.id];
      state.players[owner].scene = [sceneChar(existing.id, 'old-mr')];
      state.players[other(owner)].scene = [sceneChar(AP_TARGET.id, 'removal-decoy', { state: 'sleep' })];
      state.players[owner].deck = Array.from({ length: 10 }, () => FILLER.id);
      state.players[other(owner)].deck = Array.from({ length: 10 }, () => FILLER.id);
      install(state, owner, `${entering.id}-${owner}-mr-replacement`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: entering.id }))
        .toEqual({ ok: true });

      expect(current().players[owner].remove, 'B08019 old MR is removed at entry time').toContain(existing.id);
      expect(current().players[owner].scene.some(character => character.cardId === entering.id)).toBe(true);
      expect(current().players[other(owner)].scene.some(character => character.uid === 'removal-decoy'),
        'B08019 removed observer cannot select after simultaneous MR replacement').toBe(true);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    });
});

describe('official QA Wave176: B08021 Bond AP is continuous', () => {
  it.each(['self', 'opp'] as const)('owner=%s gains AP only while Bond and owner turn remain true', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 176, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [sceneChar(B08021.id, 'source'), sceneChar(WAZUHA.id, 'bond')];
    state.players[owner].deck = Array.from({ length: 10 }, () => FILLER.id);
    state.players[other(owner)].deck = Array.from({ length: 10 }, () => FILLER.id);
    install(state, owner, `${owner}-bond-continuous`);

    expect(read.char.ap(current(), 'source'), 'B08021 continuous Bond AP during owner turn')
      .toBe((B08021.ap ?? 0) + 2000);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();

    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    expect(read.char.ap(current(), 'source'), 'B08021 AP reverts without an activation window')
      .toBe(B08021.ap);

    const withoutBond = createEmptyGameState();
    withoutBond.turn = { number: 176, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    withoutBond.players[owner].scene = [sceneChar(B08021.id, 'source')];
    install(withoutBond, owner, `${owner}-bond-absent`);
    expect(read.char.ap(current(), 'source')).toBe(B08021.ap);
  });
});

describe('official QA Wave176: B08022 recovery is independent of its optional scene removal', () => {
  it.each(['self', 'opp'] as const)('owner=%s recovers the just-discarded Maro-chan after declining removal', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 176, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['緑'];
    state.players[owner].file = fileCards(B08022.level ?? 0);
    state.players[owner].hand = [B08022.id, MARO.id];
    state.players[owner].remove = [NON_MARO.id];
    state.players[other(owner)].scene = [sceneChar(AP_TARGET.id, 'optional-target', { state: 'sleep' })];
    state.players[owner].deck = Array.from({ length: 10 }, () => FILLER.id);
    state.players[other(owner)].deck = Array.from({ length: 10 }, () => FILLER.id);
    install(state, owner, `${owner}-maro-recovery`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08022.id }))
      .toEqual({ ok: true });
    const discard = pendingPick(B08022.id, 'a1', 'discard');
    choose(discard, discard.candidates.find(candidate => candidate.cardId === MARO.id)!.uid);

    choose(pendingPick(B08022.id, 'a1', 'sceneRemove'), null);
    const recovery = pendingPick(B08022.id, 'a1', 'handAddFromRemove');
    expect(recovery.candidates.map(candidate => candidate.cardId),
      'B08022 filters out non-Maro remove cards and includes the just-discarded Maro-chan').toEqual([MARO.id]);
    choose(recovery, recovery.candidates.find(candidate => candidate.cardId === MARO.id)!.uid);

    expect(current().players[owner].hand).toContain(MARO.id);
    expect(current().players[owner].remove).not.toContain(MARO.id);
    expect(current().players[other(owner)].scene.some(character => character.uid === 'optional-target'),
      'B08022 recovery still resolves when the AP8000 removal is declined').toBe(true);
  });

  it.each(['self', 'opp'] as const)('owner=%s declining the initial hand removal opens no later effect', owner => {
    const state = createEmptyGameState();
    state.turn = { number: 176, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].case.colors = ['緑'];
    state.players[owner].file = fileCards(B08022.level ?? 0);
    state.players[owner].hand = [B08022.id, MARO.id];
    state.players[owner].remove = [NON_MARO.id];
    state.players[other(owner)].scene = [sceneChar(AP_TARGET.id, 'optional-target', { state: 'sleep' })];
    state.players[owner].deck = Array.from({ length: 10 }, () => FILLER.id);
    state.players[other(owner)].deck = Array.from({ length: 10 }, () => FILLER.id);
    install(state, owner, `${owner}-discard-decline`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B08022.id }))
      .toEqual({ ok: true });
    choose(pendingPick(B08022.id, 'a1', 'discard'), null);
    surfacePendingSideChannels();

    expect(current().players[owner].hand, 'B08022 initial decline keeps Maro-chan in hand').toEqual([MARO.id]);
    expect(current().players[owner].remove).toEqual([NON_MARO.id]);
    expect(current().players[other(owner)].scene.some(character => character.uid === 'optional-target')).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});
