import { describe, it, expectTypeOf } from 'vitest';
import type { GameState, Effect, Condition, Candidate, EffectCtx, HookName } from '@/engine/types';

describe('engine types', () => {
  it('GameState 型が組める', () => {
    const s: GameState = {
      turn: { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: true },
      players: {
        self: {
          partner: { cardId: 'P1', state: 'active', location: 'partner-area' },
          case: { cardId: 'C1', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} },
          scene: [],
          hand: [],
          deck: [],
          evidence: [],
          remove: [],
          file: [],
        },
        opp: {
          partner: { cardId: 'P2', state: 'active', location: 'partner-area' },
          case: { cardId: 'C2', status: '事件編', requiredEvidence: 6, colors: ['黄'], declaredUseCount: {} },
          scene: [],
          hand: [],
          deck: [],
          evidence: [],
          remove: [],
          file: [],
        },
      },
      pendingEffects: [],
      scratchTrace: { self: '未発見', opp: '未発見' },
      turnState: {
        self: { handUseUsed: false, nextHintUsed: false, assistedThisTurn: false, declaredAbilityUseCount: {} },
        opp: { handUseUsed: false, nextHintUsed: false, assistedThisTurn: false, declaredAbilityUseCount: {} },
      },
      refreshCount: { self: 0, opp: 0 },
      log: [],
    };
    expectTypeOf(s).toMatchTypeOf<GameState>();
  });

  it('HookName が string union', () => {
    const h: HookName = 'turn:start';
    expectTypeOf(h).toMatchTypeOf<string>();
  });

  it('Effect の kind union が組める', () => {
    const e: Effect = { kind: 'atom', verb: 'draw', args: { n: 1 } };
    expectTypeOf(e).toMatchTypeOf<Effect>();
  });

  it('Condition の kind union が組める', () => {
    const c: Condition = { kind: 'turn', player: 'self' };
    expectTypeOf(c).toMatchTypeOf<Condition>();
  });

  it('Candidate の kind union が組める', () => {
    const c: Candidate = { kind: 'char', uid: 'u1', cardId: 'card1', player: 'self' };
    expectTypeOf(c).toMatchTypeOf<Candidate>();
  });

  it('EffectCtx が組める', () => {
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene' },
      bindings: {},
    };
    expectTypeOf(ctx).toMatchTypeOf<EffectCtx>();
  });

  it('GameState with gameResult', () => {
    const s: GameState = {
      turn: { number: 5, player: 'opp', phase: 'end', isFirstPlayerFirstTurn: true },
      players: {
        self: {
          partner: { cardId: 'P1', state: 'sleep', location: 'partner-area' },
          case: { cardId: 'C1', status: '解決編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} },
          scene: [],
          hand: [],
          deck: [],
          evidence: [],
          remove: [],
          file: [],
        },
        opp: {
          partner: { cardId: 'P2', state: 'active', location: 'file-area' },
          case: { cardId: 'C2', status: '事件編', requiredEvidence: 6, colors: ['黄'], declaredUseCount: {} },
          scene: [],
          hand: [],
          deck: [],
          evidence: [],
          remove: [],
          file: [],
        },
      },
      pendingEffects: [],
      scratchTrace: { self: '発見済', opp: '未発見' },
      turnState: {
        self: { handUseUsed: true, nextHintUsed: false, assistedThisTurn: false, declaredAbilityUseCount: {} },
        opp: { handUseUsed: false, nextHintUsed: false, assistedThisTurn: false, declaredAbilityUseCount: {} },
      },
      refreshCount: { self: 1, opp: 0 },
      log: [{ ts: Date.now(), player: 'self', turn: 5, action: 'reasoning', target: 'P1', result: '+3' }],
      gameResult: { winner: 'self', reason: 'evidence' },
    };
    expectTypeOf(s).toMatchTypeOf<GameState>();
  });
});
