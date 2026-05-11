import { describe, it, expect } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { game } from '@/engine/read/game';
import type { GameState } from '@/engine/types';

function withState(overrides: Partial<GameState>): GameState {
  return { ...createEmptyGameState(), ...overrides };
}

describe('engine.read.game', () => {
  describe('canWin', () => {
    it('事件編では勝利不可', () => {
      const s = createEmptyGameState();
      expect(game.canWin(s, 'self')).toBe(false);
    });

    it('解決編 + 証拠不足では勝利不可', () => {
      const s = createEmptyGameState();
      const s2: GameState = {
        ...s,
        players: {
          ...s.players,
          self: {
            ...s.players.self,
            case: { ...s.players.self.case, status: '解決編', requiredEvidence: 7 },
            evidence: [],
            partner: { cardId: 'P', state: 'active', location: 'partner-area' },
          },
        },
      };
      expect(game.canWin(s2, 'self')).toBe(false);
    });

    it('解決編 + 証拠達成 + アクティブパートナー = 勝利可能', () => {
      const s = createEmptyGameState();
      const evidence = Array.from({ length: 7 }, (_, i) => ({
        cardId: `E${i}`,
        faceUp: false,
        origin: { turn: 1, via: 'reasoning' as const },
      }));
      const s2: GameState = {
        ...s,
        players: {
          ...s.players,
          self: {
            ...s.players.self,
            case: { ...s.players.self.case, status: '解決編', requiredEvidence: 7 },
            evidence,
            partner: { cardId: 'P', state: 'active', location: 'partner-area' },
          },
        },
      };
      expect(game.canWin(s2, 'self')).toBe(true);
    });

    it('パートナーがスリープ状態では勝利不可', () => {
      const s = createEmptyGameState();
      const evidence = Array.from({ length: 7 }, (_, i) => ({
        cardId: `E${i}`,
        faceUp: false,
        origin: { turn: 1, via: 'reasoning' as const },
      }));
      const s2: GameState = {
        ...s,
        players: {
          ...s.players,
          self: {
            ...s.players.self,
            case: { ...s.players.self.case, status: '解決編', requiredEvidence: 7 },
            evidence,
            partner: { cardId: 'P', state: 'sleep', location: 'partner-area' },
          },
        },
      };
      expect(game.canWin(s2, 'self')).toBe(false);
    });

    it('パートナーがFILEエリアにある場合 (アシスト済み) は勝利不可 (rules/01)', () => {
      const s = createEmptyGameState();
      const evidence = Array.from({ length: 7 }, (_, i) => ({
        cardId: `E${i}`,
        faceUp: false,
        origin: { turn: 1, via: 'reasoning' as const },
      }));
      const s2: GameState = {
        ...s,
        players: {
          ...s.players,
          self: {
            ...s.players.self,
            case: { ...s.players.self.case, status: '解決編', requiredEvidence: 7 },
            evidence,
            partner: { cardId: 'P', state: 'sleep', location: 'file-area' },
          },
        },
      };
      expect(game.canWin(s2, 'self')).toBe(false);
    });

    it('アシストしたターンは事件解決できない (rules/01)', () => {
      const s = createEmptyGameState();
      const evidence = Array.from({ length: 7 }, (_, i) => ({
        cardId: `E${i}`,
        faceUp: false,
        origin: { turn: 1, via: 'reasoning' as const },
      }));
      const s2: GameState = {
        ...s,
        players: {
          ...s.players,
          self: {
            ...s.players.self,
            case: { ...s.players.self.case, status: '解決編', requiredEvidence: 7 },
            evidence,
            partner: { cardId: 'P', state: 'active', location: 'partner-area' },
          },
        },
        turnState: {
          ...s.turnState,
          self: { ...s.turnState.self, assistedThisTurn: true },
        },
      };
      expect(game.canWin(s2, 'self')).toBe(false);
    });

    it('opp側も判定できる', () => {
      const s = createEmptyGameState();
      expect(game.canWin(s, 'opp')).toBe(false);
    });
  });

  describe('evidenceShortfall', () => {
    it('証拠 0 枚で必要 7 枚 → 不足 7', () => {
      const s = createEmptyGameState();
      expect(game.evidenceShortfall(s, 'self')).toBe(7);
    });

    it('証拠達成済みなら負の値', () => {
      const s = createEmptyGameState();
      const evidence = Array.from({ length: 8 }, (_, i) => ({
        cardId: `E${i}`,
        faceUp: false,
        origin: { turn: 1, via: 'reasoning' as const },
      }));
      const s2: GameState = {
        ...s,
        players: {
          ...s.players,
          self: { ...s.players.self, evidence },
        },
      };
      expect(game.evidenceShortfall(s2, 'self')).toBe(-1);
    });

    it('opp は必要証拠 6 枚', () => {
      const s = createEmptyGameState();
      expect(game.evidenceShortfall(s, 'opp')).toBe(6);
    });
  });

  describe('refreshCount', () => {
    it('初期値 0', () => {
      const s = createEmptyGameState();
      expect(game.refreshCount(s, 'self')).toBe(0);
      expect(game.refreshCount(s, 'opp')).toBe(0);
    });

    it('リフレッシュ回数を返す', () => {
      const s = createEmptyGameState();
      const s2 = { ...s, refreshCount: { self: 2, opp: 1 } };
      expect(game.refreshCount(s2, 'self')).toBe(2);
      expect(game.refreshCount(s2, 'opp')).toBe(1);
    });
  });

  describe('result', () => {
    it('ゲーム中は null', () => {
      const s = createEmptyGameState();
      expect(game.result(s)).toBeNull();
    });

    it('勝利者が決まった場合', () => {
      const s = createEmptyGameState();
      const s2 = withState({ gameResult: { winner: 'self', reason: 'evidence' } });
      expect(game.result(s2)).toEqual({ winner: 'self', reason: 'evidence' });
    });

    it('デッキアウトによる敗北', () => {
      const s2 = withState({ gameResult: { winner: 'opp', reason: 'deck-out' } });
      expect(game.result(s2)?.reason).toBe('deck-out');
    });
  });
});
