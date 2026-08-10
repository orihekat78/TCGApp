import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { useDeclaredAbility as activateDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { runAllUntilEmpty } from '@/engine/resolve';
import {
  _drainPendingEffectPickSide,
  _drainPendingSetCardReplacementSide,
  _drainPendingSetCardChoiceSide,
  resetPendingEffectSession,
} from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { mutate } from '@/engine/mutate';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { register as registerCardDef } from '@/engine/read/def';
import type { CardDef } from '@/engine/types';
import { produce } from '@/engine/produce';
import { sceneChar } from '../../helpers/fixtures';

const KAITOU: CardDef = {
  id: 'TEST-KAITOU',
  no: 'test/TEST-KAITOU',
  kind: 'character',
  names: ['怪盗'],
  colors: ['白'],
  level: 5,
  ap: 0,
  lp: 1,
  traits: ['怪盗'],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

const DECOY: CardDef = {
  ...KAITOU,
  id: 'TEST-DECOY',
  no: 'test/TEST-DECOY',
  names: ['Decoy'],
  traits: [],
};

function surfaceRealSetCardChoice() {
  const state = createEmptyGameState();
  const source = sceneChar('B02039', 'source');
  const host = sceneChar('HOST', 'host');
  host.setCards = [
    { cardId: 'SECRET_A', faceUp: false },
    { cardId: 'SECRET_B', faceUp: false },
  ];
  state.players.self.scene = [source];
  state.players.opp.scene = [host];

  activateDeclaredAbility(state, 'source', 'a1');
  runAllUntilEmpty(state);
  const hostPick = _drainPendingEffectPickSide()!;
  applyPickAndContinuation(state, hostPick, 'host');
  runAllUntilEmpty(state);
  const enginePending = _drainPendingSetCardChoiceSide()!;

  useGameStateStore.setState({ gameState: state });
  useGameStateStore.getState().setPendingSetCardChoice(enginePending);
  return enginePending;
}

function surfaceRealSetCardReplacement() {
  registerCardDef(KAITOU);
  registerCardDef(DECOY);
  const state = createEmptyGameState();
  state.turn.player = 'opp';
  const from = mutate.scene.enter(state, 'self', KAITOU.id, {});
  const to = mutate.scene.enter(state, 'self', KAITOU.id, {});
  const decoy = mutate.scene.enter(state, 'self', DECOY.id, {});
  mutate.char.setCard(state, from.uid, 'B02052', true);
  const removal = mutate.scene.removeToRemove(state, from.uid, 'effect');
  const enginePending = _drainPendingSetCardReplacementSide()!;

  expect(removal.deferred).toBe(true);
  useGameStateStore.setState({ gameState: state });
  useGameStateStore.getState().setPendingSetCardReplacement(enginePending);
  return { enginePending, fromUid: from.uid, toUid: to.uid, decoyUid: decoy.uid };
}

describe('set-card choice dispatch boundary', () => {
  beforeEach(() => {
    resetDefRegistry();
    registerAll();
    resetPendingEffectSession();
    useGameStateStore.getState().resetMatchSessionState();
    useGameStateStore.setState({ pendingDecisionSeq: 0 });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });

  afterEach(() => {
    resetPendingEffectSession();
    useGameStateStore.getState().resetMatchSessionState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('removes UI-only identity before resolving the exact opaque occurrence', () => {
    const enginePending = surfaceRealSetCardChoice();
    const pending = useGameStateStore.getState().pendingSetCardChoice!;
    expect(pending.decisionId).toBe('decision:1');

    const result = dispatchEngineAction(bindPendingDecision(pending, {
      type: 'setCardChoiceResolve',
      instanceId: enginePending.entries[1]!.instanceId,
    }));

    expect(result).toEqual({ ok: true });
    const store = useGameStateStore.getState();
    expect(store.pendingSetCardChoice).toBeNull();
    expect(store.gameState?.players.opp.evidence).toEqual([{
      cardId: 'SECRET_B',
      faceUp: true,
      origin: { turn: 0, via: 'effect', sourceCardId: 'B02039' },
    }]);
    expect(store.gameState?.players.opp.scene[0]?.setCards).toMatchObject([
      { cardId: 'SECRET_A' },
    ]);
    expect(store.pendingEffectPick?.candidates.map((candidate) => candidate.uid)).toContain('host');
  });

  it('still rejects a stale rendered identity before normalization', () => {
    const enginePending = surfaceRealSetCardChoice();
    const stale = useGameStateStore.getState().pendingSetCardChoice!;
    useGameStateStore.getState().setPendingSetCardChoice(enginePending);
    const current = useGameStateStore.getState().pendingSetCardChoice!;
    const before = useGameStateStore.getState().gameState;

    expect(dispatchEngineAction(bindPendingDecision(stale, {
      type: 'setCardChoiceResolve',
      instanceId: enginePending.entries[1]!.instanceId,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(before);

    expect(dispatchEngineAction(bindPendingDecision(current, {
      type: 'setCardChoiceResolve',
      instanceId: enginePending.entries[1]!.instanceId,
    }))).toEqual({ ok: true });
  });

  it('rejects an unknown choice occurrence without consuming the live decision', () => {
    const enginePending = surfaceRealSetCardChoice();
    const pending = useGameStateStore.getState().pendingSetCardChoice!;
    const before = useGameStateStore.getState().gameState;

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'setCardChoiceResolve',
      instanceId: 'set:unknown',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(before);
    expect(useGameStateStore.getState().pendingSetCardChoice).toBe(pending);

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'setCardChoiceResolve',
      instanceId: enginePending.entries[1]!.instanceId,
    }))).toEqual({ ok: true });
  });

  it('rejects a forged choice occurrence added to the mutable UI prompt', () => {
    const enginePending = surfaceRealSetCardChoice();
    const canonical = useGameStateStore.getState().pendingSetCardChoice!;
    const forged = {
      ...canonical,
      entries: [
        ...canonical.entries,
        { instanceId: 'set:forged', ordinal: 999, hidden: true },
      ],
    };
    useGameStateStore.setState({ pendingSetCardChoice: forged });
    const before = useGameStateStore.getState().gameState;

    expect(dispatchEngineAction(bindPendingDecision(forged, {
      type: 'setCardChoiceResolve',
      instanceId: 'set:forged',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(before);
    expect(useGameStateStore.getState().pendingSetCardChoice).toBe(forged);

    useGameStateStore.setState({ pendingSetCardChoice: canonical });
    expect(dispatchEngineAction(bindPendingDecision(canonical, {
      type: 'setCardChoiceResolve',
      instanceId: enginePending.entries[1]!.instanceId,
    }))).toEqual({ ok: true });
  });

  it('rejects an unknown replacement target without removing the source occurrence', () => {
    const { fromUid, toUid } = surfaceRealSetCardReplacement();
    const pending = useGameStateStore.getState().pendingSetCardReplacement!;
    const before = useGameStateStore.getState().gameState;

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'setCardReplacementResolve',
      targetUid: 'unknown-target',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(before);
    expect(useGameStateStore.getState().pendingSetCardReplacement).toBe(pending);
    expect(before?.players.self.scene.find((card) => card.uid === fromUid)?.setCards)
      .toMatchObject([{ cardId: 'B02052' }]);

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'setCardReplacementResolve',
      targetUid: toUid,
    }))).toEqual({ ok: true });
    const after = useGameStateStore.getState();
    expect(after.pendingSetCardReplacement).toBeNull();
    expect(after.gameState?.players.self.scene.some((card) => card.uid === fromUid)).toBe(false);
    expect(after.gameState?.players.self.scene.find((card) => card.uid === toUid)?.setCards)
      .toMatchObject([{ cardId: 'B02052' }]);
  });

  it('rejects a real but ineligible replacement target added to the mutable UI prompt', () => {
    const { fromUid, toUid, decoyUid } = surfaceRealSetCardReplacement();
    const canonical = useGameStateStore.getState().pendingSetCardReplacement!;
    const forged = {
      ...canonical,
      candidates: [...canonical.candidates, { uid: decoyUid, cardId: DECOY.id }],
    };
    useGameStateStore.setState({ pendingSetCardReplacement: forged });
    const before = useGameStateStore.getState().gameState;

    expect(dispatchEngineAction(bindPendingDecision(forged, {
      type: 'setCardReplacementResolve',
      targetUid: decoyUid,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(before);
    expect(useGameStateStore.getState().pendingSetCardReplacement).toBe(forged);
    expect(before?.players.self.scene.find((card) => card.uid === fromUid)?.setCards)
      .toMatchObject([{ cardId: 'B02052' }]);

    useGameStateStore.setState({ pendingSetCardReplacement: canonical });
    expect(dispatchEngineAction(bindPendingDecision(canonical, {
      type: 'setCardReplacementResolve',
      targetUid: toUid,
    }))).toEqual({ ok: true });
  });

  it('rejects a listed replacement target that left the current state', () => {
    const { fromUid, toUid } = surfaceRealSetCardReplacement();
    const pending = useGameStateStore.getState().pendingSetCardReplacement!;
    const before = useGameStateStore.getState().gameState!;
    const stale = produce(before, (draft) => {
      draft.players.self.scene = draft.players.self.scene.filter((card) => card.uid !== toUid);
    });
    useGameStateStore.setState({ gameState: stale });

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'setCardReplacementResolve',
      targetUid: toUid,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(stale);
    expect(useGameStateStore.getState().pendingSetCardReplacement).toBe(pending);
    expect(stale.players.self.scene.find((card) => card.uid === fromUid)?.setCards)
      .toMatchObject([{ cardId: 'B02052' }]);

    useGameStateStore.setState({ gameState: before });
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'setCardReplacementResolve',
      targetUid: toUid,
    }))).toEqual({ ok: true });
  });

  it('rejects a replacement after its exact source occurrence becomes stale', () => {
    const { fromUid, toUid } = surfaceRealSetCardReplacement();
    const pending = useGameStateStore.getState().pendingSetCardReplacement!;
    const before = useGameStateStore.getState().gameState!;
    const stale = produce(before, (draft) => {
      const source = draft.players.self.scene.find((card) => card.uid === fromUid)!;
      source.setCards = [];
    });
    useGameStateStore.setState({ gameState: stale });

    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'setCardReplacementResolve',
      targetUid: toUid,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(stale);
    expect(useGameStateStore.getState().pendingSetCardReplacement).toBe(pending);

    useGameStateStore.setState({ gameState: before });
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'setCardReplacementResolve',
      targetUid: toUid,
    }))).toEqual({ ok: true });
  });
});
