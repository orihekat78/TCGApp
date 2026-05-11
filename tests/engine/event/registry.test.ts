// engine.event.* — Hook Registry tests
// rules: 15-abilities-effects.md
// spec: .claude/specs/engine-api-events.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import type { Effect, GameState } from '@/engine/types';

describe('engine.event.registry', () => {
  beforeEach(() => {
    event._resetRegistry();
  });

  describe('on / emit', () => {
    it('on で登録した listener が emit で発火する', () => {
      let called = 0;
      let receivedPayload: unknown = null;
      event.on('turn:start', (_s, payload) => {
        called++;
        receivedPayload = payload;
      });
      const s = createEmptyGameState();
      produce(s, draft => {
        event.emit(draft, 'turn:start', { player: 'self', turnNo: 1 });
      });
      expect(called).toBe(1);
      expect(receivedPayload).toEqual({ player: 'self', turnNo: 1 });
    });

    it('同じ name に複数 listener を登録 → 全部発火する', () => {
      let a = 0;
      let b = 0;
      event.on('turn:start', () => { a++; });
      event.on('turn:start', () => { b++; });
      const s = createEmptyGameState();
      produce(s, draft => {
        event.emit(draft, 'turn:start', {});
      });
      expect(a).toBe(1);
      expect(b).toBe(1);
    });

    it('別 name の listener は発火しない', () => {
      let called = 0;
      event.on('turn:end', () => { called++; });
      const s = createEmptyGameState();
      produce(s, draft => {
        event.emit(draft, 'turn:start', {});
      });
      expect(called).toBe(0);
    });

    it('listener が Effect を返したら pendingEffects に積まれる', () => {
      const eff: Effect = { kind: 'atom', verb: 'noop', args: {} };
      event.on('turn:start', () => eff);
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        event.emit(draft, 'turn:start', { player: 'self', turnNo: 1 });
      });
      expect(result.pendingEffects).toHaveLength(1);
      // pendingEffects は EffectStackEntry にラップされる
      expect(result.pendingEffects[0].effect).toEqual(eff);
      expect(result.pendingEffects[0].state).toBe('pending');
      expect(result.pendingEffects[0].triggeredBy.hook).toBe('turn:start');
      expect(result.pendingEffects[0].triggeredBy.payload).toEqual({ player: 'self', turnNo: 1 });
      expect(typeof result.pendingEffects[0].id).toBe('string');
    });

    it('listener が void (undefined) を返したら pendingEffects に何も積まれない', () => {
      event.on('turn:start', () => undefined);
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        event.emit(draft, 'turn:start', {});
      });
      expect(result.pendingEffects).toHaveLength(0);
    });

    it('複数 listener で Effect 返却するものは順番に pendingEffects に積まれる', () => {
      const e1: Effect = { kind: 'atom', verb: 'log', args: { msg: 'first' } };
      const e2: Effect = { kind: 'atom', verb: 'log', args: { msg: 'second' } };
      event.on('turn:start', () => e1);
      event.on('turn:start', () => undefined);
      event.on('turn:start', () => e2);
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        event.emit(draft, 'turn:start', {});
      });
      expect(result.pendingEffects).toHaveLength(2);
      expect(result.pendingEffects[0].effect).toEqual(e1);
      expect(result.pendingEffects[1].effect).toEqual(e2);
    });

    it('emit は source を listener に渡す', () => {
      let receivedSource: unknown = null;
      event.on('enter', (_s, _payload, source) => {
        receivedSource = source;
      });
      const s = createEmptyGameState();
      const source = { uid: 'A#1', cardId: 'C001' };
      produce(s, draft => {
        event.emit(draft, 'enter', { uid: 'A#1' }, source);
      });
      expect(receivedSource).toEqual(source);
    });
  });

  describe('Unsubscribe', () => {
    it('on の戻り値を呼ぶと listener が解除される', () => {
      let called = 0;
      const unsub = event.on('turn:start', () => { called++; });
      const s = createEmptyGameState();
      produce(s, draft => {
        event.emit(draft, 'turn:start', {});
      });
      expect(called).toBe(1);
      unsub();
      produce(s, draft => {
        event.emit(draft, 'turn:start', {});
      });
      expect(called).toBe(1); // 解除後は増えない
    });

    it('同 name 複数 listener のうち1つだけ unsubscribe しても他は残る', () => {
      let a = 0;
      let b = 0;
      const unsubA = event.on('turn:start', () => { a++; });
      event.on('turn:start', () => { b++; });
      unsubA();
      const s = createEmptyGameState();
      produce(s, draft => {
        event.emit(draft, 'turn:start', {});
      });
      expect(a).toBe(0);
      expect(b).toBe(1);
    });

    it('Unsubscribe を2回呼んでもエラーにならない', () => {
      const unsub = event.on('turn:start', () => undefined);
      unsub();
      expect(() => unsub()).not.toThrow();
    });
  });

  describe('queue', () => {
    it('queue で直接 pendingEffects に Effect を追加できる', () => {
      const eff: Effect = { kind: 'atom', verb: 'noop', args: {} };
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        event.queue(draft, eff);
      });
      expect(result.pendingEffects).toHaveLength(1);
      expect(result.pendingEffects[0].effect).toEqual(eff);
      expect(result.pendingEffects[0].state).toBe('pending');
    });

    it('queue で複数回呼ぶと順番に積まれる', () => {
      const e1: Effect = { kind: 'atom', verb: 'log', args: { id: 1 } };
      const e2: Effect = { kind: 'atom', verb: 'log', args: { id: 2 } };
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        event.queue(draft, e1);
        event.queue(draft, e2);
      });
      expect(result.pendingEffects).toHaveLength(2);
      expect(result.pendingEffects[0].effect).toEqual(e1);
      expect(result.pendingEffects[1].effect).toEqual(e2);
    });
  });

  describe('_resetRegistry', () => {
    it('_resetRegistry で全 listener が消える', () => {
      let called = 0;
      event.on('turn:start', () => { called++; });
      event._resetRegistry();
      const s: GameState = createEmptyGameState();
      produce(s, draft => {
        event.emit(draft, 'turn:start', {});
      });
      expect(called).toBe(0);
    });
  });
});
