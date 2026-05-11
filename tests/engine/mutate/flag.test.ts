// rules: 05-turn-phases.md, 12-next-hint.md, 13-keywords.md (アシスト), 21-declared-ability-cost.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { flag } from '@/engine/mutate/flag';
import type { GameState } from '@/engine/types';

function makeStateWithChar(): GameState {
  const s = createEmptyGameState();
  return {
    ...s,
    players: {
      self: {
        ...s.players.self,
        scene: [
          {
            cardId: 'C001',
            uid: 'uid-flag-test',
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
          },
        ],
      },
      opp: s.players.opp,
    },
  };
}

describe('engine.mutate.flag', () => {
  describe('setHandUseUsed', () => {
    it('手札の使用フラグを true に設定する (rules/05)', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        flag.setHandUseUsed(draft, 'self', true);
      });
      expect(result.turnState.self.handUseUsed).toBe(true);
    });

    it('手札の使用フラグを false に戻す', () => {
      const s = {
        ...createEmptyGameState(),
        turnState: {
          self: { handUseUsed: true, nextHintUsed: false, assistedThisTurn: false, declaredAbilityUseCount: {} },
          opp: { handUseUsed: false, nextHintUsed: false, assistedThisTurn: false, declaredAbilityUseCount: {} },
        },
      };
      const result = produce(s, draft => {
        flag.setHandUseUsed(draft, 'self', false);
      });
      expect(result.turnState.self.handUseUsed).toBe(false);
    });
  });

  describe('setNextHintUsed', () => {
    it('ネクストヒント使用フラグを設定する (rules/12)', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        flag.setNextHintUsed(draft, 'self', true);
      });
      expect(result.turnState.self.nextHintUsed).toBe(true);
    });
  });

  describe('setAssistedThisTurn', () => {
    it('アシスト済みフラグを設定する (rules/13)', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        flag.setAssistedThisTurn(draft, 'self', true);
      });
      expect(result.turnState.self.assistedThisTurn).toBe(true);
    });
  });

  describe('incrDeclaredUseCount', () => {
    it('宣言能力使用カウントをインクリメントする (rules/17 【ターン①】)', () => {
      const s = makeStateWithChar();
      const result = produce(s, draft => {
        flag.incrDeclaredUseCount(draft, 'uid-flag-test', 'ability-A');
      });
      expect(result.players.self.scene[0].declaredUseCount['ability-A']).toBe(1);
    });

    it('複数回インクリメントできる', () => {
      const s = makeStateWithChar();
      const result = produce(s, draft => {
        flag.incrDeclaredUseCount(draft, 'uid-flag-test', 'ability-A');
        flag.incrDeclaredUseCount(draft, 'uid-flag-test', 'ability-A');
      });
      expect(result.players.self.scene[0].declaredUseCount['ability-A']).toBe(2);
    });

    it('存在しない uid は no-op', () => {
      const s = makeStateWithChar();
      expect(() => produce(s, draft => {
        flag.incrDeclaredUseCount(draft, 'nonexistent-uid', 'ability-A');
      })).not.toThrow();
    });
  });

  describe('resetTurnFlags', () => {
    it('ターン終了時に全フラグをリセットする (rules/05 エンドフェイズ)', () => {
      const s = {
        ...createEmptyGameState(),
        turnState: {
          self: {
            handUseUsed: true,
            nextHintUsed: true,
            assistedThisTurn: true,
            declaredAbilityUseCount: { 'ability-A': 2 },
          },
          opp: { handUseUsed: false, nextHintUsed: false, assistedThisTurn: false, declaredAbilityUseCount: {} },
        },
      };
      const result = produce(s, draft => {
        flag.resetTurnFlags(draft, 'self');
      });
      expect(result.turnState.self.handUseUsed).toBe(false);
      expect(result.turnState.self.nextHintUsed).toBe(false);
      expect(result.turnState.self.assistedThisTurn).toBe(false);
      expect(result.turnState.self.declaredAbilityUseCount).toEqual({});
    });

    it('opp のフラグをリセットする', () => {
      const s = {
        ...createEmptyGameState(),
        turnState: {
          self: { handUseUsed: false, nextHintUsed: false, assistedThisTurn: false, declaredAbilityUseCount: {} },
          opp: {
            handUseUsed: true,
            nextHintUsed: false,
            assistedThisTurn: false,
            declaredAbilityUseCount: {},
          },
        },
      };
      const result = produce(s, draft => {
        flag.resetTurnFlags(draft, 'opp');
      });
      expect(result.turnState.opp.handUseUsed).toBe(false);
    });
  });
});
