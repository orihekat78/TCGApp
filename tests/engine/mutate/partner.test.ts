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

  // MR能力①② は real partner singleton を破壊しない別 slot 設計 (partnerAreaMR) へ再実装された
  // (engine/mr-partner-area-core, 2026-06-23)。旧 dead stub (toRemovedByMR/toPartnerAreaFromScene、
  // real partner 上書き) は削除。新 spec test: tests/engine/mr-partner-area/。
});
