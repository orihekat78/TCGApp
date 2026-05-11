import { describe, it, expect } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { turn } from '@/engine/read/turn';

describe('engine.read.turn', () => {
  it('current: ターンスナップショットを返す', () => {
    const s = createEmptyGameState();
    const snap = turn.current(s);
    expect(snap.number).toBe(0);
    expect(snap.player).toBe('self');
    expect(snap.phase).toBe('auto');
    expect(snap.isFirstPlayerFirstTurn).toBe(true);
  });

  it('player: 現在のターンプレイヤー', () => {
    const s = createEmptyGameState();
    expect(turn.player(s)).toBe('self');
  });

  it('opponent: ターンプレイヤーの相手', () => {
    const s = createEmptyGameState();
    expect(turn.opponent(s)).toBe('opp');
    const s2 = { ...s, turn: { ...s.turn, player: 'opp' as const } };
    expect(turn.opponent(s2)).toBe('self');
  });

  it('phase: 現在フェイズ', () => {
    const s = createEmptyGameState();
    expect(turn.phase(s)).toBe('auto');
    const s2 = { ...s, turn: { ...s.turn, phase: 'main' as const } };
    expect(turn.phase(s2)).toBe('main');
  });

  it('number: ターン番号', () => {
    const s = createEmptyGameState();
    expect(turn.number(s)).toBe(0);
    const s2 = { ...s, turn: { ...s.turn, number: 5 } };
    expect(turn.number(s2)).toBe(5);
  });

  it('isFirstPlayerFirstTurn: 先攻1ターン目フラグ', () => {
    const s = createEmptyGameState();
    expect(turn.isFirstPlayerFirstTurn(s)).toBe(true);
    const s2 = { ...s, turn: { ...s.turn, isFirstPlayerFirstTurn: false } };
    expect(turn.isFirstPlayerFirstTurn(s2)).toBe(false);
  });

  it('flags: ターンフラグを返す', () => {
    const s = createEmptyGameState();
    const f = turn.flags(s, 'self');
    expect(f.handUseUsed).toBe(false);
    expect(f.assistedThisTurn).toBe(false);
    expect(f.nextHintUsed).toBe(false);
  });

  it('flags: oppのフラグも取得できる', () => {
    const s = createEmptyGameState();
    const f = turn.flags(s, 'opp');
    expect(f.handUseUsed).toBe(false);
  });

  it('current: 参照は読み取り専用スナップショット', () => {
    const s = createEmptyGameState();
    const snap = turn.current(s);
    // スナップショットは gameState.turn を参照するが変更しない
    expect(snap).toBe(s.turn);
  });
});
