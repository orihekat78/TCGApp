// rules: 01-victory-conditions.md, 13-keywords.md (アシスト・事件解決), 18-mr.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { partner } from '@/engine/mutate/partner';
import { register, _resetRegistry } from '@/engine/read/def';
import { GENERATED_PARTNERS } from '@/cards';
import type { GameState } from '@/engine/types';

const PR022 = GENERATED_PARTNERS.find(({ id }) => id === 'PR022');
if (!PR022) throw new Error('production PR022 is not registered in GENERATED_PARTNERS');

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
    it('PR022 resolves at FILE 8, not FILE 7', () => {
      _resetRegistry();
      register(PR022);
      const base = makeState({
        partner: { cardId: 'PR022', state: 'active', location: 'partner-area' },
        case: { ...createEmptyGameState().players.self.case, status: '事件編' },
        file: Array.from({ length: 6 }, (_, index) => ({ type: 'card-back' as const, cardId: `F${index}` })),
      });
      const pre7 = produce(base, draft => { partner.assist(draft, 'self'); });
      expect(pre7.players.self.case.status).toBe('事件編');
      const at8 = produce({ ...base, players: { ...base.players, self: { ...base.players.self, file: [...base.players.self.file, { type: 'card-back', cardId: 'F6' }] } } }, draft => { partner.assist(draft, 'self'); });
      expect(at8.players.self.case.status).toBe('解決編');
      _resetRegistry();
    });
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

    it('終局後は通常事件解決で盤面を一切変更しない', () => {
      const terminal = produce(
        makeState({ partner: { cardId: 'P001', state: 'active', location: 'partner-area' } }),
        draft => { draft.gameResult = { winner: 'opp', reason: 'deck-out' }; },
      );

      const result = produce(terminal, draft => {
        partner.solveCase(draft, 'self');
      });

      expect(result).toBe(terminal);
    });
  });

  // MR能力①② は real partner singleton を破壊しない別 slot 設計 (partnerAreaMR) へ再実装された
  // (engine/mr-partner-area-core, 2026-06-23)。旧 dead stub (toRemovedByMR/toPartnerAreaFromScene、
  // real partner 上書き) は削除。新 spec test: tests/engine/mr-partner-area/。
});
