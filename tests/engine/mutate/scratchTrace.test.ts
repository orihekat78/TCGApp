// rules: 13-keywords.md (痕跡), 26-qa-deck-refresh.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { scratchTrace } from '@/engine/mutate/scratchTrace';

describe('engine.mutate.scratchTrace', () => {
  describe('set', () => {
    it('痕跡状態を未発見→発見済に設定する (rules/13)', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        scratchTrace.set(draft, 'self', '発見済');
      });
      expect(result.scratchTrace.self).toBe('発見済');
    });

    it('opp の痕跡状態も設定できる', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        scratchTrace.set(draft, 'opp', '発見済');
      });
      expect(result.scratchTrace.opp).toBe('発見済');
    });

    it('初期値は未発見', () => {
      const s = createEmptyGameState();
      expect(s.scratchTrace.self).toBe('未発見');
      expect(s.scratchTrace.opp).toBe('未発見');
    });

    it('発見済→未発見も操作上は可能 (invariant で保護)', () => {
      const s = { ...createEmptyGameState(), scratchTrace: { self: '発見済' as const, opp: '未発見' as const } };
      // mutate 自体は許容 (invariant でチェック)
      const result = produce(s, draft => {
        scratchTrace.set(draft, 'self', '未発見');
      });
      expect(result.scratchTrace.self).toBe('未発見');
    });
  });
});
