// Phase 4 Task 4.3 — flow.main.useDeclaredAbility
// rules: 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
// BUG-067 (2026-05-28): 事件カード declared ability の ターン① enforcement + 全カード turn limit enforcement

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { GameState, CardDef } from '@/engine/types';

function makeStateWithChar(opts: { named?: boolean; state?: 'active' | 'sleep' | 'stun' } = {}): { s: GameState; uid: string } {
  _resetUidCounter();
  const initial = createEmptyGameState();
  let uid = '';
  const s = produce(initial, draft => {
    const c = mutate.scene.enter(draft, 'self', 'C1', { named: opts.named, active: opts.state !== 'sleep' });
    uid = c.uid;
    if (opts.state === 'stun') {
      mutate.scene.setState(draft, c.uid, 'stun');
    } else if (opts.state === 'sleep') {
      mutate.scene.setState(draft, c.uid, 'sleep');
    }
  });
  return { s, uid };
}

describe('engine.flow.main.useDeclaredAbility', () => {
  beforeEach(() => {
    event._resetRegistry();
  });

  it('場にキャラがいる → canDeclaredAbility=true', () => {
    const { s, uid } = makeStateWithChar();
    expect(canDeclaredAbility(s, uid, 'A')).toBe(true);
  });

  it('場にキャラがいない uid → false', () => {
    const initial = createEmptyGameState();
    expect(canDeclaredAbility(initial, 'nonexistent', 'A')).toBe(false);
  });

  it('名乗り状態でも canDeclaredAbility=true (rules/24)', () => {
    const { s, uid } = makeStateWithChar({ named: true });
    expect(canDeclaredAbility(s, uid, 'A')).toBe(true);
  });

  it('スリープ状態でも canDeclaredAbility=true (cost 別判定 rules/21)', () => {
    const { s, uid } = makeStateWithChar({ state: 'sleep' });
    expect(canDeclaredAbility(s, uid, 'A')).toBe(true);
  });

  it('useDeclaredAbility で declaredUseCount がインクリメント', () => {
    const { s, uid } = makeStateWithChar();
    const after = produce(s, draft => {
      useDeclaredAbility(draft, uid, 'A');
    });
    const c = after.players.self.scene.find(c => c.uid === uid)!;
    expect(c.declaredUseCount['A']).toBe(1);
  });

  it('useDeclaredAbility で effect:declared が emit される', () => {
    const { s, uid } = makeStateWithChar();
    let fired = false;
    event.on('effect:declared', (_st, payload) => {
      const p = payload as { kind?: string };
      if (p && p.kind === 'declaredAbility') fired = true;
    });
    produce(s, draft => {
      useDeclaredAbility(draft, uid, 'A');
    });
    expect(fired).toBe(true);
  });

  it('場にいない uid に対して useDeclaredAbility → throw', () => {
    expect(() =>
      produce(createEmptyGameState(), draft => {
        useDeclaredAbility(draft, 'nonexistent', 'A');
      }),
    ).toThrow(/not on board/);
  });

  // BUG-067 (2026-05-28): 事件カード declared ability の ターン① enforcement + case 対応
  describe('BUG-067: case + ability.limit enforcement', () => {
    afterEach(() => {
      resetDefRegistry();
    });

    function makeStateWithCase(cardId: string): GameState {
      const s = createEmptyGameState();
      return produce(s, draft => {
        draft.players.self.case.cardId = cardId;
      });
    }

    it('useDeclaredAbility が case:self に対して動作 (case.declaredUseCount を increment)', () => {
      const s = makeStateWithCase('TEST_CASE_A');
      const after = produce(s, draft => {
        useDeclaredAbility(draft, 'case:self', 'A');
      });
      expect(after.players.self.case.declaredUseCount['A']).toBe(1);
    });

    it('case ability の limit:turn:1 を canDeclaredAbility が enforce', () => {
      const def: CardDef = {
        id: 'TEST_CASE_LIMIT',
        no: 'TEST',
        kind: 'case',
        names: ['テスト事件'],
        colors: ['青'],
        level: 0,
        traits: [],
        abilities: [{
          id: 'A',
          type: 'declared',
          scope: 'always',
          limit: { kind: 'turn', n: 1 },
          effect: { kind: 'atom', verb: 'noop', args: {} },
          description: 'test',
          ruleRefs: [],
        }],
      } as unknown as CardDef;
      registerCardDef(def);

      const s = makeStateWithCase('TEST_CASE_LIMIT');
      // 1 回目: 使用可能
      expect(canDeclaredAbility(s, 'case:self', 'A')).toBe(true);
      // 1 回 use 後: 使用不可
      const after = produce(s, draft => {
        useDeclaredAbility(draft, 'case:self', 'A');
      });
      expect(canDeclaredAbility(after, 'case:self', 'A')).toBe(false);
    });

    it('resetTurnFlags 後は case の declaredUseCount がリセットされ再使用可能', () => {
      const def: CardDef = {
        id: 'TEST_CASE_RESET',
        no: 'TEST',
        kind: 'case',
        names: ['テスト事件'],
        colors: ['青'],
        level: 0,
        traits: [],
        abilities: [{
          id: 'A',
          type: 'declared',
          scope: 'always',
          limit: { kind: 'turn', n: 1 },
          effect: { kind: 'atom', verb: 'noop', args: {} },
          description: 'test',
          ruleRefs: [],
        }],
      } as unknown as CardDef;
      registerCardDef(def);

      const s = makeStateWithCase('TEST_CASE_RESET');
      const used = produce(s, draft => {
        useDeclaredAbility(draft, 'case:self', 'A');
      });
      expect(canDeclaredAbility(used, 'case:self', 'A')).toBe(false);
      const afterTurn = produce(used, draft => {
        mutate.flag.resetTurnFlags(draft, 'self');
      });
      expect(afterTurn.players.self.case.declaredUseCount['A']).toBeUndefined();
      expect(canDeclaredAbility(afterTurn, 'case:self', 'A')).toBe(true);
    });

    it('scene char ability の limit:turn:1 も canDeclaredAbility が enforce', () => {
      const def: CardDef = {
        id: 'TEST_CHAR_LIMIT',
        no: 'TEST',
        kind: 'character',
        names: ['テストキャラ'],
        colors: ['青'],
        level: 1,
        ap: 1000, lp: 1,
        traits: [],
        abilities: [{
          id: 'A',
          type: 'declared',
          scope: 'on-scene',
          limit: { kind: 'turn', n: 1 },
          effect: { kind: 'atom', verb: 'noop', args: {} },
          description: 'test',
          ruleRefs: [],
        }],
      } as unknown as CardDef;
      registerCardDef(def);

      _resetUidCounter();
      let uid = '';
      const s = produce(createEmptyGameState(), draft => {
        const c = mutate.scene.enter(draft, 'self', 'TEST_CHAR_LIMIT', {});
        uid = c.uid;
      });
      expect(canDeclaredAbility(s, uid, 'A')).toBe(true);
      const after = produce(s, draft => {
        useDeclaredAbility(draft, uid, 'A');
      });
      expect(canDeclaredAbility(after, uid, 'A')).toBe(false);
      // resetTurnFlags 後は再度使用可能 (scene 側も reset)
      const afterTurn = produce(after, draft => {
        mutate.flag.resetTurnFlags(draft, 'self');
      });
      expect(canDeclaredAbility(afterTurn, uid, 'A')).toBe(true);
    });

    it('limit 無しの ability は何度でも使用可能 (regression check)', () => {
      const def: CardDef = {
        id: 'TEST_NO_LIMIT',
        no: 'TEST',
        kind: 'case',
        names: ['テスト事件'],
        colors: ['青'],
        level: 0,
        traits: [],
        abilities: [{
          id: 'A',
          type: 'declared',
          scope: 'always',
          // no limit field
          effect: { kind: 'atom', verb: 'noop', args: {} },
          description: 'test',
          ruleRefs: [],
        }],
      } as unknown as CardDef;
      registerCardDef(def);

      const s = makeStateWithCase('TEST_NO_LIMIT');
      const after = produce(s, draft => {
        useDeclaredAbility(draft, 'case:self', 'A');
        useDeclaredAbility(draft, 'case:self', 'A');
      });
      expect(after.players.self.case.declaredUseCount['A']).toBe(2);
      expect(canDeclaredAbility(after, 'case:self', 'A')).toBe(true);
    });
  });
});
