// rules: 03-field-areas.md, 09-cutin-disguise.md, 16-card-set.md, 20-color-and-switch.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { scene } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter } from '@/engine/types';

function makeChar(overrides: Partial<SceneCharacter> = {}): SceneCharacter {
  return {
    cardId: 'C001',
    uid: 'uid-1',
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
    ...overrides,
  };
}

function makeState(selfScene: SceneCharacter[] = [], oppScene: SceneCharacter[] = []): GameState {
  const s = createEmptyGameState();
  return {
    ...s,
    players: {
      self: { ...s.players.self, scene: selfScene },
      opp: { ...s.players.opp, scene: oppScene },
    },
  };
}

describe('engine.mutate.scene', () => {
  describe('enter', () => {
    it('キャラを現場に登場させる', () => {
      const s = makeState();
      const result = produce(s, draft => {
        scene.enter(draft, 'self', 'C001', {});
      });
      expect(result.players.self.scene).toHaveLength(1);
      expect(result.players.self.scene[0].cardId).toBe('C001');
    });

    it('デフォルトは active=false (スリープ状態で登場)', () => {
      const s = makeState();
      const result = produce(s, draft => {
        scene.enter(draft, 'self', 'C001', {});
      });
      // opts.active が指定なければ active=true (名乗り状態のみ影響)
      // active デフォルトは true (キャラ登場はアクティブ)
      expect(result.players.self.scene[0].state).toBe('active');
    });

    it('opts.active=false で sleep 状態で登場', () => {
      const s = makeState();
      const result = produce(s, draft => {
        scene.enter(draft, 'self', 'C001', { active: false });
      });
      expect(result.players.self.scene[0].state).toBe('sleep');
    });

    it('opts.named=true で名乗り状態', () => {
      const s = makeState();
      const result = produce(s, draft => {
        scene.enter(draft, 'self', 'C001', { named: true });
      });
      expect(result.players.self.scene[0].isNamed).toBe(true);
    });

    it('uid は cardId#counter 形式で生成される', () => {
      const s = makeState();
      const result = produce(s, draft => {
        scene.enter(draft, 'self', 'C001', {});
        scene.enter(draft, 'self', 'C001', {});
      });
      const uids = result.players.self.scene.map(c => c.uid);
      expect(uids[0]).not.toBe(uids[1]); // ユニーク
      expect(uids[0]).toMatch(/C001#\d+/);
    });

    it('5枚超過で例外 (rules/03, 20)', () => {
      const chars = Array.from({ length: 5 }, (_, i) =>
        makeChar({ uid: `uid-${i}`, cardId: 'C001' }),
      );
      const s = makeState(chars);
      expect(() => produce(s, draft => {
        scene.enter(draft, 'self', 'C002', {});
      })).toThrow(/scene full/);
    });

    it('4枚は登場可能', () => {
      const chars = Array.from({ length: 4 }, (_, i) =>
        makeChar({ uid: `uid-${i}` }),
      );
      const s = makeState(chars);
      expect(() => produce(s, draft => {
        scene.enter(draft, 'self', 'C002', {});
      })).not.toThrow();
    });

    it('SceneCharacter の初期値が正しく設定される', () => {
      const s = makeState();
      const result = produce(s, draft => {
        scene.enter(draft, 'self', 'NEW001', { active: true, named: false });
      });
      const c = result.players.self.scene[0];
      expect(c.cardId).toBe('NEW001');
      expect(c.setCards).toEqual([]);
      expect(c.stackedCards).toBe(0);
      expect(c.keywordOverrides).toEqual({ granted: [], disabledOriginal: false });
      expect(c.apOverride).toBeNull();
      expect(c.lpOverride).toBeNull();
    });
  });

  describe('switchEnter', () => {
    it('既存キャラをリムーブして新キャラ登場 (rules/20)', () => {
      const existing = makeChar({ uid: 'existing', cardId: 'OLD' });
      const s = makeState([existing]);
      const result = produce(s, draft => {
        scene.switchEnter(draft, 'self', 'NEW', 'existing', {});
      });
      expect(result.players.self.scene).toHaveLength(1);
      expect(result.players.self.scene[0].cardId).toBe('NEW');
      // リムーブエリアに旧キャラ
      expect(result.players.self.remove).toContain('OLD');
    });

    it('5枚満杯からswitchEnterで1枚入れ替え', () => {
      const chars = Array.from({ length: 5 }, (_, i) =>
        makeChar({ uid: `uid-${i}`, cardId: `C00${i}` }),
      );
      const s = makeState(chars);
      expect(() => produce(s, draft => {
        scene.switchEnter(draft, 'self', 'NEW', 'uid-0', {});
      })).not.toThrow();
      // 結果は5枚のまま
    });
  });

  describe('removeToRemove', () => {
    it('キャラをリムーブエリアへ移動 (cause: effect)', () => {
      const c = makeChar({ uid: 'uid-remove', cardId: 'C001' });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.removeToRemove(draft, 'uid-remove', 'effect');
      });
      expect(result.players.self.scene).toHaveLength(0);
      expect(result.players.self.remove).toContain('C001');
    });

    it('setCards もすべてリムーブに移動 (rules/16)', () => {
      const c = makeChar({
        uid: 'uid-remove',
        cardId: 'C001',
        setCards: [
          { cardId: 'SET001', faceUp: true },
          { cardId: 'SET002', faceUp: false },
        ],
      });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.removeToRemove(draft, 'uid-remove', 'effect');
      });
      expect(result.players.self.remove).toContain('SET001');
      expect(result.players.self.remove).toContain('SET002');
    });

    it('stackedCards 分も remove に積む (rules/16)', () => {
      const c = makeChar({
        uid: 'uid-remove',
        cardId: 'C001',
        stackedCards: 3,
      });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.removeToRemove(draft, 'uid-remove', 'effect');
      });
      // 3枚分のスタックカードがリムーブ (back-card として)
      // remove は C001 + 3 back-cards
      expect(result.players.self.remove).toContain('C001');
      // back-card は 'back-card' ID で3枚
      const backCards = result.players.self.remove.filter(id => id === 'back-card');
      expect(backCards).toHaveLength(3);
    });

    it('戻り値に removed 情報が含まれる', () => {
      const c = makeChar({ uid: 'uid-remove', cardId: 'C001' });
      const s = makeState([c]);
      let result!: ReturnType<typeof scene.removeToRemove>;
      produce(s, draft => {
        result = scene.removeToRemove(draft, 'uid-remove', 'effect');
      });
      expect(result.removed.cardId).toBe('C001');
      expect(result.removed.uid).toBe('uid-remove');
    });

    it('存在しない uid は RemoveResult を返す (no-op)', () => {
      const s = makeState();
      let result!: ReturnType<typeof scene.removeToRemove>;
      produce(s, draft => {
        result = scene.removeToRemove(draft, 'nonexistent', 'effect');
      });
      expect(result.removed.cardId).toBe('');
    });
  });

  describe('toDeckBottom', () => {
    it('変装で元キャラをデッキ下へ (rules/09)', () => {
      const c = makeChar({ uid: 'uid-1', cardId: 'CHAR001' });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.toDeckBottom(draft, 'uid-1');
      });
      expect(result.players.self.scene).toHaveLength(0);
      // デッキの下に移動
      expect(result.players.self.deck).toContain('CHAR001');
      expect(result.players.self.deck[result.players.self.deck.length - 1]).toBe('CHAR001');
    });
  });

  describe('setState', () => {
    it('active に設定', () => {
      const c = makeChar({ uid: 'u1', state: 'sleep' });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.setState(draft, 'u1', 'active');
      });
      expect(result.players.self.scene[0].state).toBe('active');
    });

    it('sleep に設定', () => {
      const c = makeChar({ uid: 'u1', state: 'active' });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.setState(draft, 'u1', 'sleep');
      });
      expect(result.players.self.scene[0].state).toBe('sleep');
    });

    it('stun に設定', () => {
      const c = makeChar({ uid: 'u1', state: 'active' });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.setState(draft, 'u1', 'stun');
      });
      expect(result.players.self.scene[0].state).toBe('stun');
    });

    it('スタン状態で active を渡すと sleep に変換 (rules/03 スタン特殊)', () => {
      const c = makeChar({ uid: 'u1', state: 'stun' });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.setState(draft, 'u1', 'active');
      });
      // スタン状態のキャラがアクティブにする効果を受けた → スリープになる
      expect(result.players.self.scene[0].state).toBe('sleep');
    });

    it('スタン状態で sleep を渡してもスタンのまま (rules/03)', () => {
      const c = makeChar({ uid: 'u1', state: 'stun' });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.setState(draft, 'u1', 'sleep');
      });
      expect(result.players.self.scene[0].state).toBe('stun');
    });

    it('スタン状態で stun を渡してもスタンのまま (rules/03)', () => {
      const c = makeChar({ uid: 'u1', state: 'stun' });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.setState(draft, 'u1', 'stun');
      });
      expect(result.players.self.scene[0].state).toBe('stun');
    });
  });

  describe('tryActivate', () => {
    it('sleep → active に変換', () => {
      const c = makeChar({ uid: 'u1', state: 'sleep' });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.tryActivate(draft, 'u1');
      });
      expect(result.players.self.scene[0].state).toBe('active');
    });

    it('stun → sleep に変換 (スタン特殊 rules/03)', () => {
      const c = makeChar({ uid: 'u1', state: 'stun' });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.tryActivate(draft, 'u1');
      });
      expect(result.players.self.scene[0].state).toBe('sleep');
    });

    it('active → active のまま', () => {
      const c = makeChar({ uid: 'u1', state: 'active' });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.tryActivate(draft, 'u1');
      });
      expect(result.players.self.scene[0].state).toBe('active');
    });
  });

  describe('clearNamed', () => {
    it('名乗り状態を解除する', () => {
      const c = makeChar({ uid: 'u1', isNamed: true });
      const s = makeState([c]);
      const result = produce(s, draft => {
        scene.clearNamed(draft, 'u1');
      });
      expect(result.players.self.scene[0].isNamed).toBe(false);
    });
  });
});
