// qa: card:D06015:7917a528ebb99edb4efb1d6ed72558b874851a0c65d93d121901eb7488a29e03
// qa: card:PR027:7917a528ebb99edb4efb1d6ed72558b874851a0c65d93d121901eb7488a29e03
// qa: card:PR031:7917a528ebb99edb4efb1d6ed72558b874851a0c65d93d121901eb7488a29e03

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { D06015 } from '@/cards/ct-d06/D06015';
import { B06093 } from '@/cards/ct-p06/B06093';
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
import type { CardDef, GameState, Player, SceneCharacter } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const SOURCES = [D06015, PR027, PR031] as const;
const REASONER_6 = fixture('W116_REASONER_6', { ap: 0, lp: 6 });
const PARTNER_3: CardDef = {
  ...fixture('W116_PARTNER_3', { ap: undefined, lp: 3 }),
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
  if (!state) throw new Error('missing Wave116 state');
  return state;
}

function install(
  source: CardDef,
  owner: Player,
  options: {
    extraCount?: number;
    includeSubject?: boolean;
    partner?: boolean;
    sameOwner?: boolean;
    subjectState?: SceneCharacter['state'];
  } = {},
): { reasoner: Player; uid: string } {
  const reasoner = options.sameOwner ? owner : other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 4, player: reasoner, phase: 'main', isFirstPlayerFirstTurn: false };
  if (options.includeSubject !== false) {
    state.players[owner].scene.push(sceneChar(source.id, 'subject', {
      state: options.subjectState ?? 'active',
    }));
  } else {
    state.players[owner].hand = [source.id];
  }
  for (let index = 0; index < (options.extraCount ?? 1); index += 1) {
    state.players[owner].scene.push(sceneChar(B06093.id, `extra-${index}`));
  }
  let uid = 'reasoner';
  if (options.partner) {
    uid = `partner:${reasoner}`;
    state.players[reasoner].partner = {
      cardId: PARTNER_3.id, uid, state: 'active', colors: ['青'],
    } as GameState['players']['self']['partner'];
  } else {
    state.players[reasoner].scene.push(sceneChar(REASONER_6.id, uid));
  }
  state.players[reasoner].deck = Array.from({ length: 10 }, (_, index) => `W116_EVIDENCE_${index}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  return { reasoner, uid };
}

function beginReasoning(uid: string) {
  expect(dispatchEngineAction({ type: 'reasoning', uid })).toEqual({ ok: true });
  return useGameStateStore.getState().pendingMisread;
}

function resolve(
  pending: NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingMisread']>,
  uids: readonly string[],
) {
  const picks = uids.map(uid => {
    const candidate = pending.candidates.find(item => item.uid === uid);
    if (!candidate) throw new Error(`missing Misread candidate: ${uid}`);
    return candidate;
  });
  return dispatchEngineAction(bindPendingDecision(pending, { type: 'misreadResolve', picks }));
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
  for (const card of [REASONER_6, PARTNER_3]) engine.cards.register(card);
  registerTriggeredListener();
  registerMisreadListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave116: one reasoning may combine multiple Misread sources', () => {
  // Card-bound physical rows: D06015 PR027 PR031.
  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner combines its Misread 1 with Misread 2',
    ({ source, owner }) => {
      const { reasoner, uid } = install(source, owner);
      const pending = beginReasoning(uid)!;
      expect(pending.candidates).toEqual([{ uid: 'subject', x: 1 }, { uid: 'extra-0', x: 2 }]);
      expect(resolve(pending, ['subject', 'extra-0'])).toEqual({ ok: true });
      expect(current().players[owner].scene.map(card => card.state)).toEqual(['sleep', 'sleep']);
      expect(current().players[reasoner].evidence).toHaveLength(3);
      expect(readChar.lp(current(), uid)).toBe(6);
      expect(useGameStateStore.getState().pendingMisread).toBeNull();
    },
  );

  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner may commit only one of two eligible sources',
    ({ source, owner }) => {
      const { reasoner, uid } = install(source, owner);
      const pending = beginReasoning(uid)!;
      expect(resolve(pending, ['subject'])).toEqual({ ok: true });
      expect(current().players[owner].scene.map(card => card.state)).toEqual(['sleep', 'active']);
      expect(current().players[reasoner].evidence).toHaveLength(5);
      expect(readChar.lp(current(), uid)).toBe(6);
    },
  );

  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner may commit none despite multiple candidates',
    ({ source, owner }) => {
      const { reasoner, uid } = install(source, owner);
      const pending = beginReasoning(uid)!;
      expect(resolve(pending, [])).toEqual({ ok: true });
      expect(current().players[owner].scene.map(card => card.state)).toEqual(['active', 'active']);
      expect(current().players[reasoner].evidence).toHaveLength(6);
      expect(readChar.lp(current(), uid)).toBe(6);
    },
  );

  it.each(SOURCES)('$id has no implicit two-source cap', source => {
    const { uid } = install(source, 'self', { extraCount: 2 });
    const pending = beginReasoning(uid)!;
    expect(pending.candidates).toEqual([
      { uid: 'subject', x: 1 }, { uid: 'extra-0', x: 2 }, { uid: 'extra-1', x: 2 },
    ]);
    expect(resolve(pending, ['subject', 'extra-0', 'extra-1'])).toEqual({ ok: true });
    expect(current().players.self.scene.map(card => card.state)).toEqual(['sleep', 'sleep', 'sleep']);
    expect(current().players.opp.evidence).toHaveLength(1);
  });

  it.each(SOURCES)('$id combines against partner reasoning down to zero evidence', source => {
    const { reasoner, uid } = install(source, 'self', { partner: true });
    const pending = beginReasoning(uid)!;
    expect(resolve(pending, ['subject', 'extra-0'])).toEqual({ ok: true });
    expect(current().players[reasoner].evidence).toEqual([]);
    expect(readChar.lp(current(), uid)).toBe(3);
  });

  it.each(SOURCES)('$id sleeping source is excluded while another Misread stays eligible', source => {
    const { reasoner, uid } = install(source, 'self', { subjectState: 'sleep' });
    const pending = beginReasoning(uid)!;
    expect(pending.candidates).toEqual([{ uid: 'extra-0', x: 2 }]);
    expect(resolve(pending, [])).toEqual({ ok: true });
    expect(current().players[reasoner].evidence).toHaveLength(6);
  });

  it.each(SOURCES)('$id outside scene cannot join the reasoning', source => {
    const { reasoner, uid } = install(source, 'self', { includeSubject: false, extraCount: 0 });
    expect(beginReasoning(uid)).toBeNull();
    expect(current().players[reasoner].evidence).toHaveLength(6);
    expect(current().players.self.hand).toEqual([source.id]);
  });

  it.each(SOURCES)('$id does not react to its owner reasoning', source => {
    const { reasoner, uid } = install(source, 'self', { sameOwner: true });
    expect(beginReasoning(uid)).toBeNull();
    expect(current().players[reasoner].evidence).toHaveLength(6);
    expect(current().players.self.scene.slice(0, 2).map(card => card.state)).toEqual(['active', 'active']);
  });
});
