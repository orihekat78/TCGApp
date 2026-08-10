// Integration: Hook → Queue → Resolver round-trip
// spec: .claude/specs/engine-api-events.md
// spec: .claude/specs/engine-api-resolver.md
// rules: 15-abilities-effects.md, 17-icons.md
//
// シナリオ:
//   1. 'enter' フックで cardId === 'D08001' が登場したらキャラに AP+1000 (turn) を
//      かける Effect を返す listener を登録する。
//   2. produce() の中で mutate.scene.enter を呼び、続けて event.emit('enter', ...)
//      を呼ぶ。
//   3. emit によって pendingEffects に EffectStackEntry が1件積まれることを確認する。
//   4. resolve.runAllUntilEmpty で全消化する。
//   5. 該当キャラの turnEffects.apMod_turn が 1000 になっていることを確認する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import {
  _abortEventJournal,
  _beginEventJournal,
  _commitEventJournal,
} from '@/engine/event/registry';
import { mutate } from '@/engine/mutate/index';
import { resolve } from '@/engine/resolve/index';
import { appendCausal, startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { withStructuredCausalResolution } from '@/engine/log/effect-causal';
import type { CausalLogEntryV1, Effect, GameState } from '@/engine/types';

describe('integration: Hook → Queue → Resolver round-trip', () => {
  beforeEach(() => {
    event._resetRegistry();
  });

  it('D08001 enter → listener queues charModifyAP → resolver applies +1000', () => {
    // Register the listener.
    event.on('enter', (state, payload, _source) => {
      const p = payload as { uid: string; viaEffect: boolean; enterOrder: number } | undefined;
      if (!p) return;
      // Look up the entered char by uid in either side's scene.
      let cardId: string | undefined;
      for (const side of ['self', 'opp'] as const) {
        const c = state.players[side].scene.find(ch => ch.uid === p.uid);
        if (c) {
          cardId = c.cardId;
          break;
        }
      }
      if (cardId !== 'D08001') return;
      const eff: Effect = {
        kind: 'atom',
        verb: 'charModifyAP',
        args: { uid: p.uid, delta: 1000, scope: 'turn' },
      };
      return eff;
    });

    const initial = createEmptyGameState();

    // Step 1+2: enter the D08001 char and emit 'enter' inside the same produce.
    const afterEnter: GameState = produce(initial, draft => {
      const ch = mutate.scene.enter(draft, 'self', 'D08001', { named: true, viaEffect: false });
      event.emit(draft, 'enter', { uid: ch.uid, viaEffect: false, enterOrder: 1 }, { uid: ch.uid, cardId: 'D08001', player: 'self' });
    });

    // Step 3: confirm the listener queued exactly one EffectStackEntry whose Effect
    // is the expected charModifyAP atom.
    expect(afterEnter.pendingEffects).toHaveLength(1);
    expect(afterEnter.pendingEffects[0].effect.kind).toBe('atom');
    const queuedEff = afterEnter.pendingEffects[0].effect;
    if (queuedEff.kind === 'atom') {
      expect(queuedEff.verb).toBe('charModifyAP');
    }
    expect(afterEnter.pendingEffects[0].state).toBe('pending');
    expect(afterEnter.pendingEffects[0].triggeredBy.hook).toBe('enter');

    // Step 4: drain the stack.
    const afterResolve: GameState = produce(afterEnter, draft => {
      resolve.runAllUntilEmpty(draft);
    });

    // Step 5: verify the effect actually ran.
    const enteredChar = afterResolve.players.self.scene[0];
    expect(enteredChar.cardId).toBe('D08001');
    expect(enteredChar.turnEffects['apMod_turn']).toBe(1000);

    // pendingEffects is not removed but marked 'resolved'.
    expect(afterResolve.pendingEffects).toHaveLength(1);
    expect(afterResolve.pendingEffects[0].state).toBe('resolved');
  });

  it('non-matching cardId yields no queued effect', () => {
    event.on('enter', (state, payload) => {
      const p = payload as { uid: string };
      const c = state.players.self.scene.find(ch => ch.uid === p.uid);
      if (c?.cardId !== 'D08001') return; // only respond to D08001
      return { kind: 'atom', verb: 'noop', args: {} };
    });

    const initial = createEmptyGameState();
    const result = produce(initial, draft => {
      const ch = mutate.scene.enter(draft, 'self', 'OTHER_CARD', { named: true });
      event.emit(draft, 'enter', { uid: ch.uid, viaEffect: false, enterOrder: 1 });
    });
    expect(result.pendingEffects).toHaveLength(0);
  });

  it('connects every simultaneously triggered child effect to the parent causal branch', () => {
    event.on('enter', () => ({ kind: 'custom', fn: () => undefined }));
    event.on('enter', () => ({ kind: 'custom', fn: () => undefined }));

    const initial = createEmptyGameState();
    startCausalSession(initial, 'hook-child-lineage');
    const source = mutate.scene.enter(initial, 'self', 'PUBLIC-PARENT', { named: true });
    event.queue(initial, {
      kind: 'custom',
      fn: (state) => {
        const entered = mutate.scene.enter(state, 'self', 'PUBLIC-CHILD', { named: true });
        event.emit(
          state,
          'enter',
          { uid: entered.uid, viaEffect: true, enterOrder: entered.enterOrder },
          { player: 'self', uid: entered.uid, cardId: entered.cardId, area: 'scene' },
        );
      },
    }, {
      player: 'self',
      uid: source.uid,
      cardId: source.cardId,
      abilityId: 'a1',
      area: 'scene',
    });

    const resolved = produce(initial, (draft) => resolve.runAllUntilEmpty(draft));
    const graph = validateCausalLog(resolved.log as CausalLogEntryV1[]);
    const roots = graph.filter((entry) => (
      entry.outcome.type === 'state' && entry.outcome.state === 'active'
    ));

    expect(roots).toHaveLength(3);
    expect(roots[0]?.eventId).toBe('hook-child-lineage:1');
    expect(roots[0]).not.toHaveProperty('parentEventId');
    expect(roots[0]).not.toHaveProperty('correlationEventId');
    const childRoots = roots.slice(1);
    expect(new Set(childRoots.map((entry) => entry.eventId)).size).toBe(2);
    for (const childRoot of childRoots) {
      expect(childRoot).not.toHaveProperty('parentEventId');
      expect(childRoot.correlationEventId).toBe('hook-child-lineage:1');
    }
  });

  it('correlates a grandchild effect to its immediate child root', () => {
    event.on('enter', (state, payload) => {
      const uid = (payload as { uid?: string }).uid;
      const entered = state.players.self.scene.find((card) => card.uid === uid);
      if (entered?.cardId === 'PUBLIC-CHILD') {
        return {
          kind: 'custom',
          fn: (childState: GameState) => {
            const grandchild = mutate.scene.enter(childState, 'self', 'PUBLIC-GRANDCHILD', { named: true });
            event.emit(
              childState,
              'enter',
              { uid: grandchild.uid, viaEffect: true, enterOrder: grandchild.enterOrder },
              { player: 'self', uid: grandchild.uid, cardId: grandchild.cardId, area: 'scene' },
            );
          },
        } satisfies Effect;
      }
      if (entered?.cardId === 'PUBLIC-GRANDCHILD') {
        return { kind: 'custom', fn: () => undefined } satisfies Effect;
      }
    });

    const state = createEmptyGameState();
    startCausalSession(state, 'hook-grandchild-lineage');
    const parent = mutate.scene.enter(state, 'self', 'PUBLIC-PARENT', { named: true });
    event.queue(state, {
      kind: 'custom',
      fn: (parentState) => {
        const child = mutate.scene.enter(parentState, 'self', 'PUBLIC-CHILD', { named: true });
        event.emit(
          parentState,
          'enter',
          { uid: child.uid, viaEffect: true, enterOrder: child.enterOrder },
          { player: 'self', uid: child.uid, cardId: child.cardId, area: 'scene' },
        );
      },
    }, {
      player: 'self', uid: parent.uid, cardId: parent.cardId, abilityId: 'a1', area: 'scene',
    });

    resolve.runAllUntilEmpty(state);
    const roots = validateCausalLog(state.log as CausalLogEntryV1[]).filter((entry) => (
      entry.outcome.type === 'state' && entry.outcome.state === 'active'
    ));

    expect(roots.map((entry) => ({
      eventId: entry.eventId,
      parentEventId: entry.parentEventId,
      correlationEventId: entry.correlationEventId,
    }))).toEqual([
      { eventId: 'hook-grandchild-lineage:1', parentEventId: undefined, correlationEventId: undefined },
      { eventId: 'hook-grandchild-lineage:3', parentEventId: undefined, correlationEventId: 'hook-grandchild-lineage:1' },
      { eventId: 'hook-grandchild-lineage:5', parentEventId: undefined, correlationEventId: 'hook-grandchild-lineage:3' },
    ]);
  });

  it('preserves the original parent root when a journaled hook commits later', () => {
    event.on('enter', () => ({ kind: 'custom', fn: () => undefined }));
    const state = createEmptyGameState();
    startCausalSession(state, 'hook-journal-lineage');
    const parent = mutate.scene.enter(state, 'self', 'PUBLIC-PARENT', { named: true });
    let journal: ReturnType<typeof _beginEventJournal> | undefined;
    event.queue(state, {
      kind: 'custom',
      fn: (parentState) => {
        journal = _beginEventJournal();
        const child = mutate.scene.enter(parentState, 'self', 'PUBLIC-CHILD', { named: true });
        event.emit(
          parentState,
          'enter',
          { uid: child.uid, viaEffect: true, enterOrder: child.enterOrder },
          { player: 'self', uid: child.uid, cardId: child.cardId, area: 'scene' },
        );
      },
    }, {
      player: 'self', uid: parent.uid, cardId: parent.cardId, abilityId: 'a1', area: 'scene',
    });

    resolve.runOne(state, state.pendingEffects[0]!);
    expect(journal).toBeDefined();
    _commitEventJournal(journal!);
    resolve.runAllUntilEmpty(state);

    const roots = validateCausalLog(state.log as CausalLogEntryV1[]).filter((entry) => (
      entry.outcome.type === 'state' && entry.outcome.state === 'active'
    ));
    expect(roots).toHaveLength(2);
    expect(roots[1]).not.toHaveProperty('parentEventId');
    expect(roots[1]?.correlationEventId).toBe('hook-journal-lineage:1');
  });

  it('preserves an explicit journaled decision correlation over the ambient effect root', () => {
    event.on('enter', () => ({ kind: 'custom', fn: () => undefined }));
    const state = createEmptyGameState();
    startCausalSession(state, 'hook-journal-explicit-lineage');
    const outer = appendCausal(state, {
      actor: 'self',
      kind: 'declare',
      source: { kind: 'player', side: 'self' },
      targets: [],
      outcome: { type: 'state', state: 'active' },
    });
    const decision = appendCausal(state, {
      actor: 'self',
      kind: 'select',
      parentEventId: outer.eventId,
      source: { kind: 'player', side: 'self' },
      targets: [],
      outcome: { type: 'state', state: 'success' },
    });
    let journal: ReturnType<typeof _beginEventJournal> | undefined;

    withStructuredCausalResolution(state, () => {
      journal = _beginEventJournal();
      event.emit(
        state,
        'enter',
        { uid: 'public-child' },
        { player: 'self', area: 'scene' },
        { causalCorrelationEventId: decision.eventId },
      );
    }, { rootEventId: outer.eventId, tailEventId: outer.eventId });

    expect(journal).toBeDefined();
    _commitEventJournal(journal!);
    resolve.runAllUntilEmpty(state);

    const childRoot = validateCausalLog(state.log as CausalLogEntryV1[]).find((entry) => (
      entry.outcome.type === 'state'
      && entry.outcome.state === 'active'
      && entry.correlationEventId === decision.eventId
    ));
    expect(childRoot).toBeDefined();
    expect(childRoot).not.toHaveProperty('parentEventId');
    expect(childRoot?.correlationEventId).not.toBe(outer.eventId);
  });

  it('does not queue a child when its journal is aborted', () => {
    event.on('enter', () => ({ kind: 'custom', fn: () => undefined }));
    const state = createEmptyGameState();
    startCausalSession(state, 'hook-journal-abort');
    const parent = mutate.scene.enter(state, 'self', 'PUBLIC-PARENT', { named: true });
    let journal: ReturnType<typeof _beginEventJournal> | undefined;
    event.queue(state, {
      kind: 'custom',
      fn: (parentState) => {
        journal = _beginEventJournal();
        const child = mutate.scene.enter(parentState, 'self', 'PUBLIC-CHILD', { named: true });
        event.emit(parentState, 'enter', { uid: child.uid }, { player: 'self', area: 'scene' });
      },
    }, {
      player: 'self', uid: parent.uid, cardId: parent.cardId, abilityId: 'a1', area: 'scene',
    });

    resolve.runOne(state, state.pendingEffects[0]!);
    expect(journal).toBeDefined();
    _abortEventJournal(journal!);

    expect(state.pendingEffects).toHaveLength(1);
    expect(validateCausalLog(state.log as CausalLogEntryV1[]).filter((entry) => (
      entry.outcome.type === 'state' && entry.outcome.state === 'active'
    ))).toHaveLength(1);
  });

  it('rejects an entry that claims both a resumed trace and a child correlation', () => {
    const state = createEmptyGameState();
    expect(() => event.queue(
      state,
      { kind: 'custom', fn: () => undefined },
      { player: 'self', area: 'scene' },
      'manual',
      undefined,
      undefined,
      {
        causalTrace: { rootEventId: 'session:1', tailEventId: 'session:2' },
        causalCorrelationEventId: 'session:3',
      },
    )).toThrow('causal trace and child correlation are mutually exclusive');
    expect(state.pendingEffects).toHaveLength(0);
  });
});
