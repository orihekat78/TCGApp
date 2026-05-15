// Phase 8 Task 8.2: useTargetPicker
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md (共通フロー骨格)
// rules: 17-icons.md §「〜まで」(0 枚選択可), 11-reasoning.md (推理対象選択)
//
// 仕様:
//   - 3 phase: idle / picking / confirming
//   - start({ candidates, purpose }) → 候補ハイライト開始、Promise<string|null> 返却
//   - pick(uid)  → uid が候補なら confirming に遷移、それ以外 no-op
//   - confirm() → 選択 uid を Promise resolve + idle に復帰
//   - cancel()  → null を Promise resolve + idle に復帰
//   - 0 候補で start() → 即 null resolve + idle のまま (rules/17 §「〜まで」)
//   - picking 中に再 start() → 旧 Promise は null resolve、新候補で picking 再開

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useTargetPicker,
  useTargetPickerStore,
} from '@/ui/hooks/useTargetPicker';

describe('useTargetPicker', () => {
  beforeEach(() => {
    useTargetPickerStore.getState()._reset();
  });

  describe('initial state', () => {
    it('starts in idle phase', () => {
      const picker = useTargetPicker();
      expect(picker.phase.phase).toBe('idle');
    });

    it('isCandidate returns false for any uid in idle', () => {
      const picker = useTargetPicker();
      expect(picker.isCandidate('any-uid')).toBe(false);
    });
  });

  describe('start → picking', () => {
    it('transitions to picking with given candidates and purpose', () => {
      const picker = useTargetPicker();
      void picker.start({ candidates: ['c-1', 'c-2'], purpose: 'reasoning' });

      const after = useTargetPicker();
      expect(after.phase.phase).toBe('picking');
      if (after.phase.phase === 'picking') {
        expect(after.phase.candidates).toEqual(['c-1', 'c-2']);
        expect(after.phase.purpose).toBe('reasoning');
      }
    });

    it('isCandidate returns true only for candidates during picking', () => {
      const picker = useTargetPicker();
      void picker.start({ candidates: ['c-1', 'c-2'] });

      const after = useTargetPicker();
      expect(after.isCandidate('c-1')).toBe(true);
      expect(after.isCandidate('c-2')).toBe(true);
      expect(after.isCandidate('c-3')).toBe(false);
    });

    it('purpose defaults to empty string when omitted', () => {
      const picker = useTargetPicker();
      void picker.start({ candidates: ['c-1'] });
      const after = useTargetPicker();
      if (after.phase.phase === 'picking') {
        expect(after.phase.purpose).toBe('');
      }
    });
  });

  describe('start with 0 candidates', () => {
    it('resolves with null immediately and stays idle', async () => {
      const picker = useTargetPicker();
      const result = await picker.start({ candidates: [] });
      expect(result).toBeNull();
      expect(useTargetPicker().phase.phase).toBe('idle');
    });
  });

  describe('pick → confirming', () => {
    it('moves to confirming when pick(uid) is in candidates', () => {
      const picker = useTargetPicker();
      void picker.start({ candidates: ['c-1', 'c-2'] });
      useTargetPicker().pick('c-1');

      const after = useTargetPicker();
      expect(after.phase.phase).toBe('confirming');
      if (after.phase.phase === 'confirming') {
        expect(after.phase.chosen).toBe('c-1');
        expect(after.phase.candidates).toEqual(['c-1', 'c-2']);
      }
    });

    it('ignores pick(uid) not in candidates (state unchanged)', () => {
      const picker = useTargetPicker();
      void picker.start({ candidates: ['c-1'] });
      useTargetPicker().pick('not-a-candidate');

      const after = useTargetPicker();
      expect(after.phase.phase).toBe('picking');
    });

    it('ignores pick() while idle', () => {
      const picker = useTargetPicker();
      picker.pick('c-1');
      expect(useTargetPicker().phase.phase).toBe('idle');
    });
  });

  describe('confirm', () => {
    it('resolves the start() Promise with the chosen uid and returns to idle', async () => {
      const picker = useTargetPicker();
      const p = picker.start({ candidates: ['c-1', 'c-2'] });
      useTargetPicker().pick('c-2');
      useTargetPicker().confirm();

      const result = await p;
      expect(result).toBe('c-2');
      expect(useTargetPicker().phase.phase).toBe('idle');
    });

    it('is a no-op when called in idle', () => {
      const picker = useTargetPicker();
      picker.confirm();
      expect(useTargetPicker().phase.phase).toBe('idle');
    });

    it('is a no-op when called in picking (must pick first)', () => {
      const picker = useTargetPicker();
      void picker.start({ candidates: ['c-1'] });
      useTargetPicker().confirm();
      expect(useTargetPicker().phase.phase).toBe('picking');
    });
  });

  describe('cancel', () => {
    it('resolves with null and returns to idle from picking', async () => {
      const picker = useTargetPicker();
      const p = picker.start({ candidates: ['c-1'] });
      useTargetPicker().cancel();

      const result = await p;
      expect(result).toBeNull();
      expect(useTargetPicker().phase.phase).toBe('idle');
    });

    it('resolves with null and returns to idle from confirming', async () => {
      const picker = useTargetPicker();
      const p = picker.start({ candidates: ['c-1'] });
      useTargetPicker().pick('c-1');
      useTargetPicker().cancel();

      const result = await p;
      expect(result).toBeNull();
      expect(useTargetPicker().phase.phase).toBe('idle');
    });

    it('is a no-op in idle', () => {
      const picker = useTargetPicker();
      picker.cancel();
      expect(useTargetPicker().phase.phase).toBe('idle');
    });
  });

  describe('start while already picking', () => {
    it('cancels the previous Promise (resolves null) and starts a new pick', async () => {
      const picker = useTargetPicker();
      const p1 = picker.start({ candidates: ['c-1'] });
      const p2 = picker.start({ candidates: ['c-9', 'c-10'], purpose: 'action' });

      // p1 should have been resolved with null
      const r1 = await p1;
      expect(r1).toBeNull();

      // state should reflect new picking session
      const after = useTargetPicker();
      expect(after.phase.phase).toBe('picking');
      if (after.phase.phase === 'picking') {
        expect(after.phase.candidates).toEqual(['c-9', 'c-10']);
        expect(after.phase.purpose).toBe('action');
      }

      // p2 still pending — finish it
      useTargetPicker().pick('c-9');
      useTargetPicker().confirm();
      expect(await p2).toBe('c-9');
    });
  });

  describe('isCandidate during confirming', () => {
    it('still returns true for candidates (so UI can keep highlighting)', () => {
      const picker = useTargetPicker();
      void picker.start({ candidates: ['c-1', 'c-2'] });
      useTargetPicker().pick('c-1');

      const after = useTargetPicker();
      expect(after.isCandidate('c-1')).toBe(true);
      expect(after.isCandidate('c-2')).toBe(true);
      expect(after.isCandidate('c-3')).toBe(false);
    });
  });
});
