// Phase 8.10b: actionLabel pure 関数テスト

import { describe, it, expect } from 'vitest';
import { actionLabel } from '@/ui/services/actionLabel';
import type { LogEntry } from '@/engine/types/game-state';

function entry(action: string): LogEntry {
  return { ts: 0, player: 'self', turn: 1, action };
}

describe('actionLabel', () => {
  it('maps "reasoning" → "推理"', () => {
    expect(actionLabel(entry('reasoning'))).toBe('推理');
  });

  it('maps "actionAgainstChar" → "アクション(キャラ)"', () => {
    expect(actionLabel(entry('actionAgainstChar'))).toBe('アクション(キャラ)');
  });

  it('maps "handUseCard" → "手札の使用"', () => {
    expect(actionLabel(entry('handUseCard'))).toBe('手札の使用');
  });

  it('returns raw action string for unknown action (fallback)', () => {
    expect(actionLabel(entry('unknownCustomAction'))).toBe('unknownCustomAction');
  });

  it('maps "contact-judge" → "判定" (Phase 8.10e)', () => {
    expect(actionLabel(entry('contact-judge'))).toBe('判定');
  });

  it('never exposes internal causal action identifiers', () => {
    const causalActions = [
      'use', 'declare', 'select', 'draw', 'discard', 'zone-move', 'sleep', 'stun',
      'activate', 'face-change', 'value-change', 'evidence', 'case-status-change', 'case-resolve', 'negate', 'fizzle', 'cancel',
      'game-result', 'summary',
    ].map((kind) => `causal.${kind}`);

    for (const action of causalActions) {
      expect(actionLabel(entry(action))).not.toContain('causal.');
    }
  });

  it('labels activation and face changes in player-facing Japanese', () => {
    expect(actionLabel(entry('causal.activate'))).toBe('アクティブにする');
    expect(actionLabel(entry('causal.face-change'))).toBe('カードの向きを変更');
  });
});
