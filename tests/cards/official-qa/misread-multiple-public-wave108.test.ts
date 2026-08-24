// qa: card:PR247:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:PR262:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:PR268:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { PR247 } from '@/cards/pr-01/PR247';
import { PR262 } from '@/cards/pr-01/PR262';
import { PR268 } from '@/cards/pr-01/PR268';
import { engine } from '@/engine';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import {
  _resetMisreadRegistered,
  _resetPendingMisread,
  registerMisreadListener,
} from '@/engine/listeners/misread';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const REASONER = fixture('W108_REASONER', { ap: 0, lp: 5 });
const POLICE = fixture('W108_POLICE', { traits: ['警察'] });
const NON_POLICE = fixture('W108_NON_POLICE');
const OPP_POLICE = fixture('W108_OPP_POLICE', { traits: ['警察'] });
const SET_TOP = fixture('W108_SET_TOP');
const SET_TAIL = fixture('W108_SET_TAIL');
const EXISTING_SETS = Array.from({ length: 6 }, (_, index) => fixture(`W108_SET_${index}`));
const MISREAD_TWO = 'B06093';
const SET_SOURCES = [PR262, PR268] as const;

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave108 state');
  return state;
}

function installMisread(owner: Player, cardIds: readonly string[]): Player {
  const reasoner = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 2, player: reasoner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[reasoner].scene = [sceneChar(REASONER.id, 'reasoner')];
  state.players[reasoner].deck = Array.from({ length: 8 }, (_, index) => `W108_EVIDENCE_${index}`);
  state.players[owner].scene = cardIds.map((cardId, index) => sceneChar(cardId, `misread-${index}`));
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  return reasoner;
}

function beginReasoning(reasoner: Player) {
  expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingMisread;
  expect(pending).not.toBeNull();
  expect(pending?.reasoningPlayer).toBe(reasoner);
  return pending!;
}

function existingSetCards() {
  return EXISTING_SETS.map((card, index) => ({
    cardId: card.id,
    faceUp: false,
    instanceId: `wave108:set:${index}`,
  }));
}

function installSet(owner: Player, source: CardDef): void {
  const opponent = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 3, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['緑'];
  state.players[owner].file = Array.from(
    { length: source.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: SET_TAIL.id }),
  );
  state.players[owner].hand = [source.id];
  state.players[owner].deck = [SET_TOP.id, SET_TAIL.id];
  state.players[owner].scene = [
    sceneChar(POLICE.id, 'police-host', { setCards: existingSetCards() }),
    sceneChar(NON_POLICE.id, 'non-police'),
  ];
  state.players[opponent].scene = [sceneChar(OPP_POLICE.id, 'opponent-police')];
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: source.id }))
    .toEqual({ ok: true });
}

beforeEach(() => {
  endMatchSession();
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  _resetPendingMisread();
  _resetMisreadRegistered();
  _resetTriggeredRegistered();
  registerAll();
  for (const card of [REASONER, POLICE, NON_POLICE, OPP_POLICE, SET_TOP, SET_TAIL, ...EXISTING_SETS]) {
    engine.cards.register(card);
  }
  registerTriggeredListener();
  registerMisreadListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave108: multiple Misread commitments combine in one reasoning', () => {
  // Card-bound physical rows: PR262 PR268.
  it.each(SET_SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner combines Misread 1 with a second eligible source',
    ({ source, owner }) => {
      const reasoner = installMisread(owner, [source.id, MISREAD_TWO]);
      const pending = beginReasoning(reasoner);
      expect(pending.candidates).toEqual([{ uid: 'misread-0', x: 1 }, { uid: 'misread-1', x: 2 }]);
      expect(dispatchEngineAction(bindPendingDecision(pending, {
        type: 'misreadResolve', picks: pending.candidates,
      }))).toEqual({ ok: true });
      expect(current().players[owner].scene.map(card => card.state)).toEqual(['sleep', 'sleep']);
      expect(current().players[reasoner].evidence).toHaveLength(2);
    },
  );

  it.each(['self', 'opp'] as const)('PR247 owner %s stays ineligible while real Misread remains usable', owner => {
    const reasoner = installMisread(owner, [PR247.id, MISREAD_TWO]);
    const pending = beginReasoning(reasoner);
    expect(pending.candidates).toEqual([{ uid: 'misread-1', x: 2 }]);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'misreadResolve', picks: pending.candidates,
    }))).toEqual({ ok: true });
    expect(current().players[owner].scene.map(card => card.state)).toEqual(['active', 'sleep']);
    expect(current().players[reasoner].evidence).toHaveLength(3);
  });
});

describe('official QA Wave108: generic set guidance remains uncapped and optional', () => {
  it.each(SET_SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner can add a seventh face-down set to a self police host',
    ({ source, owner }) => {
      installSet(owner, source);
      const pending = useGameStateStore.getState().pendingEffectPick;
      const enteredUid = current().players[owner].scene.find(card => card.cardId === source.id)?.uid;
      if (!enteredUid) throw new Error(`${source.id}: entered source is missing`);
      expect(pending).toMatchObject({
        atomVerb: 'charSetCard', player: owner, nMin: 0, nMax: 1,
        source: { cardId: source.id, abilityId: 'a2' },
      });
      expect(pending?.candidates.map(candidate => candidate.uid).sort())
        .toEqual(['police-host', enteredUid].sort());
      expect(dispatchEngineAction(bindPendingDecision(pending!, {
        type: 'effectPickResolve', pickedUid: 'police-host',
      }))).toEqual({ ok: true });

      const host = current().players[owner].scene.find(card => card.uid === 'police-host')!;
      expect(host.setCards).toHaveLength(7);
      expect(host.setCards).toContainEqual(expect.objectContaining({ cardId: SET_TOP.id, faceUp: false }));
      expect(current().players[owner].deck).toEqual([SET_TAIL.id]);
      const projected = projectReplayStateForViewer(current(), 'spectator');
      expect(JSON.stringify(projected)).not.toContain(SET_TOP.id);
    },
  );

  it.each(SET_SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner may decline without consuming the deck top',
    ({ source, owner }) => {
      installSet(owner, source);
      const pending = useGameStateStore.getState().pendingEffectPick;
      expect(dispatchEngineAction(bindPendingDecision(pending!, {
        type: 'effectPickResolve', pickedUid: null,
      }))).toEqual({ ok: true });
      expect(current().players[owner].scene.find(card => card.uid === 'police-host')?.setCards)
        .toHaveLength(6);
      expect(current().players[owner].deck).toEqual([SET_TOP.id, SET_TAIL.id]);
    },
  );
});
