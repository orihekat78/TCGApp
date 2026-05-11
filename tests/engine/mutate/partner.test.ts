// rules: 01-victory-conditions.md, 13-keywords.md (アシスト・事件解決), 18-mr.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { partner } from '@/engine/mutate/partner';
import type { GameState } from '@/engine/types';

function makeState(selfOverrides?: Partial<GameState['players']['self']>): GameState {
  const s = createEmptyGameState();
  if (!selfOverrides) return s;
  return {
    ...s,
    players: {
      self: { ...s.players.self, ...selfOverrides },
      opp: s.players.opp,
    },
  };
}

describe('engine.mutate.partner', () => {
  describe('setState', () => {
    it('パートナーの状態を設定する', () => {
      const s = makeState({ partner: { cardId: 'P001', state: 'active', location: 'partner-area' } });
      const result = produce(s, draft => {
        partner.setState(draft, 'self', 'sleep');
      });
      expect(result.players.self.partner.state).toBe('sleep');
    });

    it('stun に設定', () => {
      const s = makeState({ partner: { cardId: 'P001', state: 'active', location: 'partner-area' } });
      const result = produce(s, draft => {
        partner.setState(draft, 'self', 'stun');
      });
      expect(result.players.self.partner.state).toBe('stun');
    });
  });

  describe('setLocation', () => {
    it('パートナーの location を設定する', () => {
      const s = makeState({ partner: { cardId: 'P001', state: 'active', location: 'partner-area' } });
      const result = produce(s, draft => {
        partner.setLocation(draft, 'self', 'file-area');
      });
      expect(result.players.self.partner.location).toBe('file-area');
    });
  });

  describe('assist', () => {
    it('アシスト: パートナーをスリープ化 + FILE へ移動 (rules/13)', () => {
      const s = makeState({ partner: { cardId: 'P001', state: 'active', location: 'partner-area' } });
      const result = produce(s, draft => {
        partner.assist(draft, 'self');
      });
      expect(result.players.self.partner.state).toBe('sleep');
      expect(result.players.self.partner.location).toBe('file-area');
    });

    it('アシスト: FILE に assisted-partner エントリを追加する', () => {
      const s = makeState({ partner: { cardId: 'P001', state: 'active', location: 'partner-area' } });
      const result = produce(s, draft => {
        partner.assist(draft, 'self');
      });
      const assistedEntry = result.players.self.file.find(f => f.type === 'assisted-partner');
      expect(assistedEntry).toBeDefined();
      expect(assistedEntry).toEqual({ type: 'assisted-partner', cardId: 'P001' });
    });

    it('アシスト: assistedThisTurn = true に設定', () => {
      const s = makeState({ partner: { cardId: 'P001', state: 'active', location: 'partner-area' } });
      const result = produce(s, draft => {
        partner.assist(draft, 'self');
      });
      expect(result.turnState.self.assistedThisTurn).toBe(true);
    });
  });

  describe('returnFromFile', () => {
    it('オートフェイズ: FILE からパートナーエリアへ戻す + アクティブ化 (rules/05)', () => {
      const s = makeState({
        partner: { cardId: 'P001', state: 'sleep', location: 'file-area' },
        file: [{ type: 'assisted-partner', cardId: 'P001' }],
      });
      const result = produce(s, draft => {
        partner.returnFromFile(draft, 'self');
      });
      expect(result.players.self.partner.location).toBe('partner-area');
      expect(result.players.self.partner.state).toBe('active');
      // FILE から assisted-partner エントリが削除される
      const assistedEntry = result.players.self.file.find(f => f.type === 'assisted-partner');
      expect(assistedEntry).toBeUndefined();
    });
  });

  describe('solveCase', () => {
    it('事件解決: パートナーをスリープ化してゲーム勝利 (rules/01)', () => {
      const s = makeState({ partner: { cardId: 'P001', state: 'active', location: 'partner-area' } });
      const result = produce(s, draft => {
        partner.solveCase(draft, 'self');
      });
      expect(result.players.self.partner.state).toBe('sleep');
      expect(result.gameResult).toBeDefined();
      expect(result.gameResult!.winner).toBe('self');
      expect(result.gameResult!.reason).toBe('evidence');
    });

    it('opp でも事件解決できる', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        partner.solveCase(draft, 'opp');
      });
      expect(result.gameResult!.winner).toBe('opp');
    });
  });

  describe('toRemovedByMR', () => {
    it('MR能力②: パートナーを mr-removed 状態へ (rules/18)', () => {
      const s = makeState({ partner: { cardId: 'P001', state: 'active', location: 'partner-area' } });
      const result = produce(s, draft => {
        partner.toRemovedByMR(draft, 'self');
      });
      expect(result.players.self.partner.location).toBe('mr-removed');
      expect(result.players.self.partner.state).toBe('sleep');
    });
  });

  describe('toPartnerAreaFromScene', () => {
    it('MR能力①: 現場からパートナーエリアへ移動 (rules/18)', () => {
      const char = {
        cardId: 'MR001',
        uid: 'mr-uid-1',
        state: 'active' as const,
        isNamed: false,
        enterOrder: 1,
        setCards: [],
        stackedCards: 0,
        keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: null,
        lpOverride: null,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false },
        declaredUseCount: {},
      };
      const s = makeState({ scene: [char] });
      const result = produce(s, draft => {
        partner.toPartnerAreaFromScene(draft, 'mr-uid-1');
      });
      expect(result.players.self.partner.cardId).toBe('MR001');
      expect(result.players.self.partner.location).toBe('partner-area');
    });
  });
});
