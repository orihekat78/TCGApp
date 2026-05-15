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
});
