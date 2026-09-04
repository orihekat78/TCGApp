// qa: card:D06015:4edfa42fd152dd43d08fd67f36ed96de6ed6daf323da7b0a6c8b4fa1084f3411
// qa: card:PR027:4edfa42fd152dd43d08fd67f36ed96de6ed6daf323da7b0a6c8b4fa1084f3411
// qa: card:PR031:4edfa42fd152dd43d08fd67f36ed96de6ed6daf323da7b0a6c8b4fa1084f3411

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { D06015 } from '@/cards/ct-d06/D06015';
import { PR027 } from '@/cards/pr-01/PR027';
import { PR031 } from '@/cards/pr-01/PR031';
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
import { char as readChar } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const SOURCES = [D06015, PR027, PR031] as const;
const REASONER_3 = fixture('W113_REASONER_3', { ap: 0, lp: 3 });
const REASONER_1 = fixture('W113_REASONER_1', { ap: 0, lp: 1 });
const PARTNER_3: CardDef = {
  ...fixture('W113_PARTNER_3', { ap: undefined, lp: 3 }),
  kind: 'partner',
};

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave113 state');
  return state;
}

function install(
  source: CardDef | null,
  owner: Player,
  reasonerDef: CardDef,
  options: { sourceState?: 'active' | 'sleep'; sameOwner?: boolean; partner?: boolean } = {},
): { reasoner: Player; uid: string } {
  const reasoner = options.sameOwner ? owner : other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 3, player: reasoner, phase: 'main', isFirstPlayerFirstTurn: false };
  if (source) {
    state.players[owner].scene = [sceneChar(source.id, 'source', { state: options.sourceState ?? 'active' })];
  }
  let uid = 'reasoner';
  if (options.partner) {
    uid = `partner:${reasoner}`;
    state.players[reasoner].partner = {
      cardId: reasonerDef.id, uid, state: 'active', colors: ['青'],
    } as GameState['players']['self']['partner'];
  } else {
    state.players[reasoner].scene.push(sceneChar(reasonerDef.id, uid));
  }
  state.players[reasoner].deck = Array.from({ length: 6 }, (_, index) => `W113_EVIDENCE_${index}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  return { reasoner, uid };
}

function beginReasoning(uid: string) {
  expect(dispatchEngineAction({ type: 'reasoning', uid })).toEqual({ ok: true });
  return useGameStateStore.getState().pendingMisread;
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
  for (const card of [REASONER_3, REASONER_1, PARTNER_3]) engine.cards.register(card);
  registerTriggeredListener();
  registerMisreadListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave113: Misread 1 public authority', () => {
  // Card-bound physical rows: D06015 PR027 PR031.
  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner sleeps to reduce an opposing character reasoning by exactly one',
    ({ source, owner }) => {
      const { reasoner, uid } = install(source, owner, REASONER_3);
      const pending = beginReasoning(uid)!;
      expect(pending.candidates).toEqual([{ uid: 'source', x: 1 }]);
      expect(dispatchEngineAction(bindPendingDecision(pending, {
        type: 'misreadResolve', picks: pending.candidates,
      }))).toEqual({ ok: true });
      expect(current().players[owner].scene[0]?.state).toBe('sleep');
      expect(current().players[reasoner].evidence).toHaveLength(2);
      expect(readChar.lp(current(), uid)).toBe(3);
      expect(useGameStateStore.getState().pendingMisread).toBeNull();
    },
  );

  it.each(SOURCES)('$id also reduces partner reasoning and then restores partner LP', source => {
    const { reasoner, uid } = install(source, 'self', PARTNER_3, { partner: true });
    const pending = beginReasoning(uid)!;
    expect(pending.candidates).toEqual([{ uid: 'source', x: 1 }]);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'misreadResolve', picks: pending.candidates,
    }))).toEqual({ ok: true });
    expect(current().players[reasoner].evidence).toHaveLength(2);
    expect(readChar.lp(current(), uid)).toBe(3);
  });

  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner may decline and preserve full reasoning LP',
    ({ source, owner }) => {
      const { reasoner, uid } = install(source, owner, REASONER_3);
      const pending = beginReasoning(uid)!;
      expect(dispatchEngineAction(bindPendingDecision(pending, {
        type: 'misreadResolve', picks: [],
      }))).toEqual({ ok: true });
      expect(current().players[owner].scene[0]?.state).toBe('active');
      expect(current().players[reasoner].evidence).toHaveLength(3);
      expect(readChar.lp(current(), uid)).toBe(3);
    },
  );

  it.each(SOURCES)('$id turns LP1 reasoning into zero evidence without retaining LP loss', source => {
    const { reasoner, uid } = install(source, 'self', REASONER_1);
    const pending = beginReasoning(uid)!;
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'misreadResolve', picks: pending.candidates,
    }))).toEqual({ ok: true });
    expect(current().players[reasoner].evidence).toEqual([]);
    expect(readChar.lp(current(), uid)).toBe(1);
  });

  it.each(SOURCES)('$id already asleep is absent from Misread candidates', source => {
    const { reasoner, uid } = install(source, 'self', REASONER_3, { sourceState: 'sleep' });
    expect(beginReasoning(uid)).toBeNull();
    expect(current().players[reasoner].evidence).toHaveLength(3);
  });

  it.each(SOURCES)('$id does not react to its owner reasoning', source => {
    const { reasoner, uid } = install(source, 'self', REASONER_3, { sameOwner: true });
    expect(beginReasoning(uid)).toBeNull();
    expect(current().players[reasoner].evidence).toHaveLength(3);
    expect(current().players.self.scene.find(card => card.uid === 'source')?.state).toBe('active');
  });

  it('opens no Misread decision when the source is absent from scene', () => {
    const { reasoner, uid } = install(null, 'self', REASONER_3);
    expect(beginReasoning(uid)).toBeNull();
    expect(current().players[reasoner].evidence).toHaveLength(3);
  });
});
