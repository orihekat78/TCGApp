// engine.effect.run — Resolver tests
// spec: .claude/specs/engine-api-effect-descriptor.md
// spec: .claude/specs/engine-api-resolver.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { run } from '@/engine/effect/resolver';
import { event } from '@/engine/event/index';
import type { Effect, EffectCtx, GameState } from '@/engine/types';

function newCtx(overrides: Partial<EffectCtx> = {}): EffectCtx {
  return {
    source: { player: 'self', area: 'scene' },
    bindings: {},
    ...overrides,
  };
}

function newStateWithChar(uid = 'A#1', cardId = 'D08001'): GameState {
  const s = createEmptyGameState();
  s.players.self.scene.push({
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
    turnEffects: {
      contactImmune: false,
      removeOnTurnEnd: false,
    },
    declaredUseCount: {},
  });
  return s;
}

describe('engine.effect.run', () => {
  beforeEach(() => {
    event._resetRegistry();
  });

  describe('sequence', () => {
    it('runs steps in order', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 100, scope: 'turn' } },
          { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 50, scope: 'turn' } },
        ],
      };
      const result = produce(s, draft => {
        run(draft, eff, newCtx());
      });
      const apMod = result.players.self.scene[0].turnEffects['apMod_turn'];
      expect(apMod).toBe(150);
    });
  });

  describe('parallel', () => {
    it('runs all steps (same as sequence for now)', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'parallel',
        steps: [
          { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 200, scope: 'turn' } },
          { kind: 'atom', verb: 'charModifyLP', args: { uid: 'A#1', delta: 1, scope: 'turn' } },
        ],
      };
      const result = produce(s, draft => {
        run(draft, eff, newCtx());
      });
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(200);
      expect(result.players.self.scene[0].turnEffects['lpMod_turn']).toBe(1);
    });
  });

  describe('choice', () => {
    it('uses ctx.dyn.choiceIndex when provided', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'choice',
        chooser: 'owner',
        options: [
          { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 100, scope: 'turn' } },
          { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 999, scope: 'turn' } },
        ],
      };
      const result = produce(s, draft => {
        run(draft, eff, newCtx({ dyn: { choiceIndex: 1 } }));
      });
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(999);
    });

    it('defaults to index 0 when choiceIndex not provided', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'choice',
        chooser: 'owner',
        options: [
          { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 7, scope: 'turn' } },
          { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 99, scope: 'turn' } },
        ],
      };
      const result = produce(s, draft => {
        run(draft, eff, newCtx());
      });
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(7);
    });

    it('keeps option 0 when its false conditional has a meaningful else branch', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'choice', chooser: 'owner', options: [
          {
            kind: 'conditional', if: { kind: 'false' },
            then: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 1, scope: 'turn' } },
            else: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 7, scope: 'turn' } },
          },
          { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 99, scope: 'turn' } },
        ],
      };
      const result = produce(s, draft => run(draft, eff, newCtx()));
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(7);
    });

    it('falls back to option 0 when every conditional option is false', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'choice', chooser: 'owner', options: [
          { kind: 'conditional', if: { kind: 'false' }, then: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 1, scope: 'turn' } } },
          { kind: 'conditional', if: { kind: 'false' }, then: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 99, scope: 'turn' } } },
        ],
      };
      const result = produce(s, draft => run(draft, eff, newCtx()));
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBeUndefined();
    });

    it('throws on out-of-range choiceIndex', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'choice',
        chooser: 'owner',
        options: [{ kind: 'atom', verb: 'noop', args: {} }],
      };
      expect(() => {
        produce(s, draft => {
          run(draft, eff, newCtx({ dyn: { choiceIndex: 5 } }));
        });
      }).toThrow(/choice index/);
    });
  });

  describe('optional', () => {
    it('runs effect when ctx.dyn.optionalRun === true', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'optional',
        effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 333, scope: 'turn' } },
      };
      const result = produce(s, draft => {
        run(draft, eff, newCtx({ dyn: { optionalRun: true } }));
      });
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(333);
    });

    it('skips when ctx.dyn.optionalRun === false', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'optional',
        effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 333, scope: 'turn' } },
      };
      const result = produce(s, draft => {
        run(draft, eff, newCtx({ dyn: { optionalRun: false } }));
      });
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBeUndefined();
    });

    it('skips by default (no optionalRun)', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'optional',
        effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 333, scope: 'turn' } },
      };
      const result = produce(s, draft => {
        run(draft, eff, newCtx());
      });
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBeUndefined();
    });
  });

  describe('conditional', () => {
    it('runs then-branch when condition is true', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'conditional',
        if: { kind: 'true' },
        then: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 10, scope: 'turn' } },
        else: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 99, scope: 'turn' } },
      };
      const result = produce(s, draft => {
        run(draft, eff, newCtx());
      });
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(10);
    });

    it('runs else-branch when condition is false', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'conditional',
        if: { kind: 'false' },
        then: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 10, scope: 'turn' } },
        else: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 99, scope: 'turn' } },
      };
      const result = produce(s, draft => {
        run(draft, eff, newCtx());
      });
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(99);
    });

    it('skips when condition false and no else', () => {
      const s = newStateWithChar();
      const eff: Effect = {
        kind: 'conditional',
        if: { kind: 'false' },
        then: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 10, scope: 'turn' } },
      };
      const result = produce(s, draft => {
        run(draft, eff, newCtx());
      });
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBeUndefined();
    });
  });

  describe('forEach', () => {
    it('iterates each candidate and sets $each binding', () => {
      const s = createEmptyGameState();
      // 2 own chars
      for (let i = 1; i <= 2; i++) {
        s.players.self.scene.push({
          cardId: `C${i}`,
          uid: `A#${i}`,
          state: 'active',
          isNamed: false,
          enterOrder: i,
          setCards: [],
          stackedCards: 0,
          keywordOverrides: { granted: [], disabledOriginal: false },
          apOverride: null,
          lpOverride: null,
          turnEffects: { contactImmune: false, removeOnTurnEnd: false },
          declaredUseCount: {},
        });
      }
      // Track $each per iteration using a custom step.
      const seenUids: string[] = [];
      const eff: Effect = {
        kind: 'forEach',
        over: { kind: 'all', query: { area: 'scene', side: 'self' } },
        do: {
          kind: 'custom',
          fn: (_st, ctx) => {
            const each = ctx.bindings['$each'];
            if (each && each.length === 1 && each[0].kind === 'char') {
              seenUids.push(each[0].uid);
            }
          },
        },
      };
      produce(s, draft => {
        run(draft, eff, newCtx());
      });
      expect(seenUids.sort()).toEqual(['A#1', 'A#2']);
    });

    it('restores prior $each binding after forEach completes', () => {
      const s = newStateWithChar();
      const ctx = newCtx();
      ctx.bindings['$each'] = [{ kind: 'partner', player: 'self' }];
      const eff: Effect = {
        kind: 'forEach',
        over: { kind: 'all', query: { area: 'scene', side: 'self' } },
        do: { kind: 'atom', verb: 'noop', args: {} },
      };
      produce(s, draft => {
        run(draft, eff, ctx);
      });
      expect(ctx.bindings['$each']).toEqual([{ kind: 'partner', player: 'self' }]);
    });
  });

  describe('atom', () => {
    it('delegates to runAtom', () => {
      const s = newStateWithChar();
      const eff: Effect = { kind: 'atom', verb: 'charModifyAP', args: { uid: 'A#1', delta: 25, scope: 'turn' } };
      const result = produce(s, draft => {
        run(draft, eff, newCtx());
      });
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(25);
    });
  });

  describe('custom', () => {
    it('invokes fn directly', () => {
      const s = createEmptyGameState();
      let called = false;
      let receivedCtxSource: unknown = null;
      const eff: Effect = {
        kind: 'custom',
        fn: (_st, ctx) => {
          called = true;
          receivedCtxSource = ctx.source;
        },
      };
      produce(s, draft => {
        run(draft, eff, newCtx());
      });
      expect(called).toBe(true);
      expect(receivedCtxSource).toEqual({ player: 'self', area: 'scene' });
    });
  });

  describe('replace / negate immediate-resolution boundaries', () => {
    it('throws when run is called on replace', () => {
      const s = createEmptyGameState();
      const eff: Effect = {
        kind: 'replace',
        trigger: { on: 'reasoning' },
        with: { kind: 'atom', verb: 'noop', args: {} },
      };
      expect(() => {
        produce(s, draft => {
          run(draft, eff, newCtx());
        });
      }).toThrow(/replace is immediate-resolution/);
    });

    it('rejects an unsupported negate descriptor', () => {
      const s = createEmptyGameState();
      const eff: Effect = {
        kind: 'negate',
        trigger: { on: 'reasoning' },
      };
      expect(() => {
        produce(s, draft => {
          run(draft, eff, newCtx());
        });
      }).toThrow(/unsupported negate descriptor/);
    });

    it('cancels only the matching pending Cut-In declaration batch', () => {
      const s = createEmptyGameState();
      s.pendingEffects = [{
        id: 'cutin-own',
        source: {
          player: 'opp', cardId: 'CUTIN', abilityId: 'cutin-a1',
          area: 'hand', resolutionKind: 'cutin',
        },
        triggeredBy: { hook: 'effect:declared' },
        triggeredAt: { turn: 1, phase: 'main', nano: 1 },
        effect: { kind: 'atom', verb: 'noop', args: {} },
        state: 'pending',
        declaredBatch: 7,
      }];
      const eff: Effect = {
        kind: 'negate',
        trigger: {
          on: 'effect-resolution',
          matcher: { resolutionKind: 'cutin', declaredBatch: '$trigger.declaredBatch' },
        },
      };
      const after = produce(s, draft => {
        run(draft, eff, {
          ...newCtx(),
          triggerPayload: {
            player: 'opp', cardId: 'CUTIN', declaredBatch: 7,
          },
        });
      });
      expect(after.pendingEffects[0]?.state).toBe('cancelled');
    });
  });
});
