import { describe, it, expect } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { player } from '@/engine/read/player';
import type { GameState } from '@/engine/types';

function withPlayer(overrides: Partial<GameState['players']['self']>, side: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  return {
    ...s,
    players: {
      ...s.players,
      [side]: { ...s.players[side], ...overrides },
    },
  };
}

describe('engine.read.player', () => {
  it('partner: パートナー情報を返す', () => {
    const s = withPlayer({ partner: { cardId: 'P001', state: 'active', location: 'partner-area' } });
    expect(player.partner(s, 'self').cardId).toBe('P001');
  });

  it('case: 事件情報を返す', () => {
    const s = withPlayer({ case: { cardId: 'C001', status: '解決編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} } });
    expect(player.case(s, 'self').status).toBe('解決編');
    expect(player.case(s, 'self').colors).toContain('青');
  });

  it('requiredEvidence: 必要証拠数 (self=7, opp=6)', () => {
    const s = createEmptyGameState();
    expect(player.requiredEvidence(s, 'self')).toBe(7);
    expect(player.requiredEvidence(s, 'opp')).toBe(6);
  });

  it('hand / handCount: 手札', () => {
    const s = withPlayer({ hand: ['A', 'B', 'C'] });
    expect(player.hand(s, 'self')).toEqual(['A', 'B', 'C']);
    expect(player.handCount(s, 'self')).toBe(3);
  });

  it('handCount: 空手札は 0', () => {
    const s = createEmptyGameState();
    expect(player.handCount(s, 'self')).toBe(0);
  });

  it('deck / deckCount: デッキ', () => {
    const s = withPlayer({ deck: ['D1', 'D2'] });
    expect(player.deck(s, 'self')).toHaveLength(2);
    expect(player.deckCount(s, 'self')).toBe(2);
  });

  it('evidence / evidenceCount: 証拠エリア', () => {
    const s = withPlayer({
      evidence: [{ cardId: 'E1', faceUp: false, origin: { turn: 1, via: 'reasoning' } }],
    });
    expect(player.evidenceCount(s, 'self')).toBe(1);
    expect(player.evidence(s, 'self')[0].cardId).toBe('E1');
  });

  it('remove / removeCount: リムーブエリア', () => {
    const s = withPlayer({ remove: ['R1', 'R2', 'R3'] });
    expect(player.removeCount(s, 'self')).toBe(3);
    expect(player.remove(s, 'self')).toContain('R1');
  });

  it('file / fileCount: FILEエリア (カード裏向き)', () => {
    const s = withPlayer({
      file: [{ type: 'card-back' }, { type: 'card-back' }],
    });
    expect(player.fileCount(s, 'self')).toBe(2);
    expect(player.file(s, 'self')[0].type).toBe('card-back');
  });

  it('fileCount: アシスト中パートナー込みでカウント (rules/17 FILE(X))', () => {
    const s = withPlayer({
      file: [
        { type: 'card-back' },
        { type: 'assisted-partner', cardId: 'P001' },
      ],
    });
    // アシスト中のパートナーを含む 2 枚
    expect(player.fileCount(s, 'self')).toBe(2);
  });

  it('scratchTrace: 痕跡状態 (初期値 未発見)', () => {
    const s = createEmptyGameState();
    expect(player.scratchTrace(s, 'self')).toBe('未発見');
    expect(player.scratchTrace(s, 'opp')).toBe('未発見');
  });

  it('scratchTrace: 発見済み状態', () => {
    const s = createEmptyGameState();
    const s2 = { ...s, scratchTrace: { ...s.scratchTrace, self: '発見済' as const } };
    expect(player.scratchTrace(s2, 'self')).toBe('発見済');
  });

  it('opp側の情報も独立して取得できる', () => {
    const s = createEmptyGameState();
    const s2 = {
      ...s,
      players: {
        ...s.players,
        opp: { ...s.players.opp, hand: ['X1', 'X2', 'X3', 'X4'] },
      },
    };
    expect(player.handCount(s2, 'opp')).toBe(4);
    expect(player.handCount(s2, 'self')).toBe(0);
  });
});
