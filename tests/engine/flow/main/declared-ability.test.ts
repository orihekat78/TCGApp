// Phase 4 Task 4.3 — flow.main.useDeclaredAbility
// rules: 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
// BUG-067 (2026-05-28): 事件カード declared ability の ターン① enforcement + 全カード turn limit enforcement

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { GameState, CardDef } from '@/engine/types';

function makeStateWithChar(opts: { named?: boolean; state?: 'active' | 'sleep' | 'stun' } = {}): { s: GameState; uid: string } {
  _resetUidCounter();
  // W6 step11 (row999 item4): canDeclaredAbility は不明 abilId を fail-closed (false) 化。
  // 旧「def 未登録でも true 素通り」pin を、実カード同様 declared ability 'A' を持つ def 登録に更新。
  registerCardDef({
    id: 'C1', no: 'C1', kind: 'character', names: ['C1'], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
    abilities: [{ id: 'A', type: 'declared', scope: 'on-scene', effect: { kind: 'atom', verb: 'noop', args: {} }, description: 'test', ruleRefs: [] }],
  } as unknown as CardDef);
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
  it('activateDeclaredAbility preserves the canonical invalid-uid throw', () => {
    expect(() =>
      produce(createEmptyGameState(), draft => {
        activateDeclaredAbility(draft, 'nonexistent', 'A');
      }),
    ).toThrow(/not on board/);
  });

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

  // BUG-116 (2026-06-05): cost が定義されているのに ctx.costPaid 不在の場合に warning log を出す
  describe('BUG-116: cost-not-paid warning log', () => {
    beforeEach(() => resetDefRegistry());
    afterEach(() => resetDefRegistry());

    it('ability.cost あり + ctx.costPaid 不在 → declaredAbility:cost-not-paid log', () => {
      const cardDef: CardDef = {
        id: 'COST_CARD',
        no: '0000/COST_CARD',
        kind: 'character',
        names: ['コスト持ち'],
        colors: ['赤'],
        level: 1, ap: 1000, lp: 1,
        traits: [], rarity: 'C', imageUrl: 't.jpg',
        abilities: [{
          id: 'a1',
          type: 'declared',
          scope: 'on-scene',
          cost: { kind: 'sleepSelf' },
          effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          description: '【宣言】【スリープ】: 1ドロー',
          ruleRefs: [],
        }],
        ruleRefs: [],
      };
      registerCardDef(cardDef);

      _resetUidCounter();
      const initial = createEmptyGameState();
      let uid = '';
      const s = produce(initial, draft => {
        const c = mutate.scene.enter(draft, 'self', 'COST_CARD', {});
        uid = c.uid;
      });

      // ctx 未指定で dispatch → costPaid 不在
      const after = produce(s, draft => {
        useDeclaredAbility(draft, uid, 'a1');
      });

      // log に cost-not-paid エントリがある
      const hasWarning = after.log.some((e) => e.action === 'declaredAbility:cost-not-paid' && e.target === `${uid}:a1`);
      expect(hasWarning, 'cost-not-paid warning log が記録される').toBe(true);
    });

    it('ability.cost あり + ctx.costPaid 提供 → warning log なし (cost.pay 完了後の正常 dispatch)', () => {
      const cardDef: CardDef = {
        id: 'COST_CARD2',
        no: '0000/COST_CARD2',
        kind: 'character',
        names: ['コスト持ち2'],
        colors: ['赤'],
        level: 1, ap: 1000, lp: 1,
        traits: [], rarity: 'C', imageUrl: 't.jpg',
        abilities: [{
          id: 'a1',
          type: 'declared',
          scope: 'on-scene',
          cost: { kind: 'sleepSelf' },
          effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          description: '【宣言】【スリープ】: 1ドロー',
          ruleRefs: [],
        }],
        ruleRefs: [],
      };
      registerCardDef(cardDef);

      _resetUidCounter();
      const initial = createEmptyGameState();
      let uid = '';
      const s = produce(initial, draft => {
        const c = mutate.scene.enter(draft, 'self', 'COST_CARD2', {});
        uid = c.uid;
      });

      // ctx.costPaid を渡す (cost.pay 完了済を模す)
      const after = produce(s, draft => {
        useDeclaredAbility(draft, uid, 'a1', {
          costPaid: { sleepSelf: { uid } },
          source: { cardId: 'COST_CARD2', uid, abilityId: 'a1', player: 'self', area: 'scene' },
        });
      });

      const hasWarning = after.log.some((e) => e.action === 'declaredAbility:cost-not-paid');
      expect(hasWarning, 'costPaid 提供時は warning なし').toBe(false);
    });

    it('ability.cost 未定義 → warning log なし (cost 不要な declared ability)', () => {
      const cardDef: CardDef = {
        id: 'NO_COST',
        no: '0000/NO_COST',
        kind: 'character',
        names: ['コスト無し'],
        colors: ['赤'],
        level: 1, ap: 1000, lp: 1,
        traits: [], rarity: 'C', imageUrl: 't.jpg',
        abilities: [{
          id: 'a1',
          type: 'declared',
          scope: 'on-scene',
          effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          description: '【宣言】: 1ドロー',
          ruleRefs: [],
        }],
        ruleRefs: [],
      };
      registerCardDef(cardDef);

      _resetUidCounter();
      const initial = createEmptyGameState();
      let uid = '';
      const s = produce(initial, draft => {
        const c = mutate.scene.enter(draft, 'self', 'NO_COST', {});
        uid = c.uid;
      });

      const after = produce(s, draft => {
        useDeclaredAbility(draft, uid, 'a1');
      });

      const hasWarning = after.log.some((e) => e.action === 'declaredAbility:cost-not-paid');
      expect(hasWarning, 'cost 未定義 ability は warning なし').toBe(false);
    });
  });
});
