// engine.resolve.* — Effect Stack tests
// spec: .claude/specs/engine-api-resolver.md
// rules: 15-abilities-effects.md, 25-qa-effects-resolution.md

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { resolve } from '@/engine/resolve/index';
import { event } from '@/engine/event/index';
import type { Effect, EffectStackEntry, GameState } from '@/engine/types';

function makeEntry(
  state: GameState,
  effect: Effect,
  opts: Partial<EffectStackEntry> & { player?: 'self' | 'opp' } = {},
): EffectStackEntry {
  return {
    id: opts.id ?? `e_${Math.random()}`,
    source: opts.source ?? { player: opts.player ?? 'self' },
    triggeredBy: opts.triggeredBy ?? { hook: 'manual' },
    triggeredAt: opts.triggeredAt ?? { turn: state.turn.number, phase: state.turn.phase, nano: Date.now() },
    effect,
    resolveGuard: opts.resolveGuard,
    ownerChosenOrder: opts.ownerChosenOrder,
    state: opts.state ?? 'pending',
  };
}

function newStateWithChar(uid = 'A#1', cardId = 'D08001', player: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.players[player].scene.push({
    cardId,
    uid,
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  });
  return s;
}

describe('engine.resolve.stack', () => {
  beforeEach(() => {
    event._resetRegistry();
  });

  describe('queue + next + runOne', () => {
    it('happy path: queue an entry, next picks it, runOne marks resolved', () => {
      const s = newStateWithChar();
      const e = makeEntry(s, {
        kind: 'atom',
        verb: 'charModifyAP',
        args: { uid: 'A#1', delta: 100, scope: 'turn' },
      });
      const result = produce(s, draft => {
        resolve.queue(draft, e);
        const got = resolve.next(draft);
        expect(got).not.toBeNull();
        if (got) resolve.runOne(draft, got);
      });
      expect(result.pendingEffects[0].state).toBe('resolved');
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(100);
    });
  });

  describe('ordering', () => {
    it('turn player entries come before non-turn player entries', () => {
      const s = createEmptyGameState();
      s.turn.player = 'self';
      const eOpp = makeEntry(s, { kind: 'atom', verb: 'noop', args: {} }, { player: 'opp', id: 'opp1' });
      const eSelf = makeEntry(s, { kind: 'atom', verb: 'noop', args: {} }, { player: 'self', id: 'self1' });
      // queue opp first to make sure ordering re-sorts.
      const result = produce(s, draft => {
        resolve.queue(draft, eOpp);
        resolve.queue(draft, eSelf);
      });
      const first = resolve.next(result);
      expect(first?.id).toBe('self1');
    });

    it('within same player, ownerChosenOrder ascending', () => {
      const s = createEmptyGameState();
      const a = makeEntry(s, { kind: 'atom', verb: 'noop', args: {} }, { player: 'self', id: 'a', ownerChosenOrder: 2 });
      const b = makeEntry(s, { kind: 'atom', verb: 'noop', args: {} }, { player: 'self', id: 'b', ownerChosenOrder: 1 });
      const c = makeEntry(s, { kind: 'atom', verb: 'noop', args: {} }, { player: 'self', id: 'c' /* no order */ });
      const result = produce(s, draft => {
        resolve.queue(draft, a);
        resolve.queue(draft, b);
        resolve.queue(draft, c);
      });
      expect(resolve.next(result)?.id).toBe('b');
    });
  });

  describe('resolveGuard', () => {
    it('false guard marks cancelled, not resolved', () => {
      const s = newStateWithChar();
      const e = makeEntry(
        s,
        { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 100, scope: 'turn' } },
        { resolveGuard: { kind: 'false' } },
      );
      const result = produce(s, draft => {
        resolve.queue(draft, e);
        const got = resolve.next(draft);
        if (got) resolve.runOne(draft, got);
      });
      expect(result.pendingEffects[0].state).toBe('cancelled');
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBeUndefined();
    });

    it('true guard resolves normally', () => {
      const s = newStateWithChar();
      const e = makeEntry(
        s,
        { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 50, scope: 'turn' } },
        { resolveGuard: { kind: 'true' } },
      );
      const result = produce(s, draft => {
        resolve.queue(draft, e);
        const got = resolve.next(draft);
        if (got) resolve.runOne(draft, got);
      });
      expect(result.pendingEffects[0].state).toBe('resolved');
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(50);
    });
  });

  describe('runAllUntilEmpty', () => {
    it('drains the stack including entries queued during resolution', () => {
      const s = newStateWithChar();
      // Define a custom Effect that queues another entry during its run.
      const subEntry: Effect = {
        kind: 'atom',
        verb: 'charModifyAP',
        args: { uid: 'A#1', delta: 7, scope: 'turn' },
      };
      const seeder: Effect = {
        kind: 'custom',
        fn: (st, _ctx) => {
          // Push another pending entry mid-resolution.
          st.pendingEffects.push({
            id: 'child',
            source: { player: 'self' },
            triggeredBy: { hook: 'manual' },
            triggeredAt: { turn: st.turn.number, phase: st.turn.phase, nano: 0 },
            effect: subEntry,
            state: 'pending',
          });
        },
      };
      const e = makeEntry(s, seeder, { id: 'seed' });
      const result = produce(s, draft => {
        resolve.queue(draft, e);
        resolve.runAllUntilEmpty(draft);
      });
      expect(result.pendingEffects).toHaveLength(2);
      expect(result.pendingEffects[0].state).toBe('resolved'); // seed
      expect(result.pendingEffects[1].state).toBe('resolved'); // child
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(7);
    });

    it('safety cap throws after 1000 iterations with entry context in message', () => {
      const s = createEmptyGameState();
      // Self-replicating: each entry queues another pending entry.
      const recursive: Effect = {
        kind: 'custom',
        fn: (st, _ctx) => {
          st.pendingEffects.push({
            id: `r_${st.pendingEffects.length}`,
            source: { player: 'self', cardId: 'D08001' },
            triggeredBy: { hook: 'manual' },
            triggeredAt: { turn: 0, phase: 'main', nano: 0 },
            effect: recursive,
            state: 'pending',
          });
        },
      };
      const e0 = makeEntry(s, recursive, { id: 'root' });
      expect(() => {
        produce(s, draft => {
          resolve.queue(draft, e0);
          resolve.runAllUntilEmpty(draft);
        });
      }).toThrow(/1000-iter safety cap exceeded/);
    });

    it('safety cap error message includes id, cardId, and hook', () => {
      const s = createEmptyGameState();
      const recursive: Effect = {
        kind: 'custom',
        fn: (st, _ctx) => {
          st.pendingEffects.push({
            id: `loop_${st.pendingEffects.length}`,
            source: { player: 'self', cardId: 'LOOPCARD' },
            triggeredBy: { hook: 'onSceneEnter' },
            triggeredAt: { turn: 0, phase: 'main', nano: 0 },
            effect: recursive,
            state: 'pending',
          });
        },
      };
      const e0 = makeEntry(s, recursive, { id: 'root' });
      let caught: Error | null = null;
      try {
        produce(s, draft => {
          resolve.queue(draft, e0);
          resolve.runAllUntilEmpty(draft);
        });
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).not.toBeNull();
      expect(caught?.message).toMatch(/1000-iter safety cap exceeded/);
      expect(caught?.message).toMatch(/id=/);
      expect(caught?.message).toMatch(/cardId=/);
      expect(caught?.message).toMatch(/hook=/);
    });
  });

  describe('cancel + replace', () => {
    it('cancel marks pending entry as cancelled; next() skips it', () => {
      const s = newStateWithChar();
      const e = makeEntry(s, { kind: 'atom', verb: 'noop', args: {} }, { id: 'x' });
      const result = produce(s, draft => {
        resolve.queue(draft, e);
        resolve.cancel(draft, 'x');
      });
      expect(result.pendingEffects[0].state).toBe('cancelled');
      expect(resolve.next(result)).toBeNull();
    });

    it('replace swaps the Effect on a pending entry', () => {
      const s = newStateWithChar();
      const e = makeEntry(s, { kind: 'atom', verb: 'noop', args: {} }, { id: 'y' });
      const replacement: Effect = { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 88, scope: 'turn' } };
      const result = produce(s, draft => {
        resolve.queue(draft, e);
        resolve.replace(draft, 'y', replacement);
        resolve.runAllUntilEmpty(draft);
      });
      expect(result.pendingEffects[0].effect).toEqual(replacement);
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(88);
    });
  });

  describe('peek', () => {
    it('returns shallow copy of pendingEffects regardless of state', () => {
      const s = createEmptyGameState();
      const e1 = makeEntry(s, { kind: 'atom', verb: 'noop', args: {} }, { id: '1' });
      const e2 = makeEntry(s, { kind: 'atom', verb: 'noop', args: {} }, { id: '2', state: 'resolved' });
      const result = produce(s, draft => {
        resolve.queue(draft, e1);
        resolve.queue(draft, e2);
      });
      const peeked = resolve.peek(result);
      expect(peeked).toHaveLength(2);
      expect(peeked.map(p => p.id)).toEqual(['1', '2']);
    });
  });

  describe('lock / unlock / isLocked', () => {
    afterEach(() => {
      // Defensive: ensure lock is always cleared after each test in this block.
      const s = createEmptyGameState();
      resolve.unlock(s);
    });

    it('lock sets, unlock clears, isLocked reports', () => {
      const s = createEmptyGameState();
      expect(resolve.isLocked(s)).toBe(false);
      resolve.lock(s, 'resolving-stack');
      expect(resolve.isLocked(s)).toBe(true);
      resolve.unlock(s);
      expect(resolve.isLocked(s)).toBe(false);
    });
  });

  describe('effect:resolve:start/end Hook emit (spec: engine-api-events.md)', () => {
    it('runOne は effect:resolve:start → effect:resolve:end の順に Hook を emit する', () => {
      const fired: { name: string; effectId: unknown }[] = [];
      event.on('effect:resolve:start', (_s, payload) => {
        fired.push({ name: 'start', effectId: (payload as { effectId: string }).effectId });
      });
      event.on('effect:resolve:end', (_s, payload) => {
        fired.push({ name: 'end', effectId: (payload as { effectId: string }).effectId });
      });
      const s = newStateWithChar();
      const entry = makeEntry(s, {
        kind: 'atom',
        verb: 'charModifyAP',
        args: { uid: 'A#1', delta: 100, scope: 'turn' },
      }, { id: 'resolve-id-1' });
      produce(s, draft => {
        resolve.queue(draft, entry);
        const got = resolve.next(draft);
        if (got) resolve.runOne(draft, got);
      });
      expect(fired).toEqual([
        { name: 'start', effectId: 'resolve-id-1' },
        { name: 'end', effectId: 'resolve-id-1' },
      ]);
    });

    it('resolveGuard false で cancelled になった場合は effect:resolve:end を emit しない', () => {
      let endFired = false;
      let startFired = false;
      event.on('effect:resolve:start', () => { startFired = true; });
      event.on('effect:resolve:end', () => { endFired = true; });
      const s = newStateWithChar();
      const entry = makeEntry(s, {
        kind: 'atom',
        verb: 'noop',
        args: {},
      }, {
        id: 'cancelled-id',
        resolveGuard: { kind: 'false' },
      });
      const result = produce(s, draft => {
        resolve.queue(draft, entry);
        const got = resolve.next(draft);
        if (got) resolve.runOne(draft, got);
      });
      expect(startFired).toBe(true);
      expect(endFired).toBe(false);
      expect(result.pendingEffects[0].state).toBe('cancelled');
    });
  });
});
