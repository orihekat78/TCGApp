// Phase 8 Task 8.3: useConfirmation (Q9 厳格モード モーダル)
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md
//   - 標準 ConfirmModal: 「○○で推理 (LP=X → 証拠X枚)。実行しますか?」
//   - アシスト強警告: 「アシストでパートナーが FILE へ移動し… 本当に実行しますか?」
//   - 事件解決勝利予告: 「事件解決 → ゲーム勝利」
//
// 仕様:
//   - 3 種 kind: 'standard' | 'warning' | 'victory'
//   - ask(req) → Promise<boolean> を返す。accept で true、reject で false。
//   - current は null か単一 request のみ。並行 ask は旧 Promise を false resolve。
//   - idle で accept/reject は no-op。

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useConfirmation,
  useConfirmationStore,
} from '@/ui/hooks/useConfirmation';

describe('useConfirmation', () => {
  beforeEach(() => {
    useConfirmationStore.getState()._reset();
  });

  describe('initial state', () => {
    it('current is null when idle', () => {
      const conf = useConfirmation();
      expect(conf.current).toBeNull();
    });
  });

  describe('ask → current populated', () => {
    it('sets current with the given request', () => {
      const conf = useConfirmation();
      void conf.ask({
        kind: 'standard',
        title: '推理',
        body: '萩原千速で推理 (LP=2 → 証拠2枚)',
      });
      const after = useConfirmation();
      expect(after.current).not.toBeNull();
      expect(after.current?.kind).toBe('standard');
      expect(after.current?.title).toBe('推理');
      expect(after.current?.body).toBe('萩原千速で推理 (LP=2 → 証拠2枚)');
    });

    it('default okLabel and cancelLabel are 実行 / キャンセル', () => {
      const conf = useConfirmation();
      void conf.ask({ kind: 'standard', title: 't', body: 'b' });
      const after = useConfirmation();
      expect(after.current?.okLabel).toBe('実行');
      expect(after.current?.cancelLabel).toBe('キャンセル');
    });

    it('custom labels are preserved', () => {
      const conf = useConfirmation();
      void conf.ask({
        kind: 'warning',
        title: 'アシスト',
        body: '...',
        okLabel: 'アシスト実行',
        cancelLabel: '中止',
      });
      const after = useConfirmation();
      expect(after.current?.okLabel).toBe('アシスト実行');
      expect(after.current?.cancelLabel).toBe('中止');
    });
  });

  describe('accept → resolves true', () => {
    it('resolves the ask Promise with true and clears current', async () => {
      const conf = useConfirmation();
      const p = conf.ask({ kind: 'standard', title: 't', body: 'b' });
      useConfirmation().accept();
      const result = await p;
      expect(result).toBe(true);
      expect(useConfirmation().current).toBeNull();
    });
  });

  describe('reject → resolves false', () => {
    it('resolves the ask Promise with false and clears current', async () => {
      const conf = useConfirmation();
      const p = conf.ask({ kind: 'warning', title: 't', body: 'b' });
      useConfirmation().reject();
      const result = await p;
      expect(result).toBe(false);
      expect(useConfirmation().current).toBeNull();
    });
  });

  describe('no-op when idle', () => {
    it('accept() in idle is a no-op', () => {
      useConfirmation().accept();
      expect(useConfirmation().current).toBeNull();
    });

    it('reject() in idle is a no-op', () => {
      useConfirmation().reject();
      expect(useConfirmation().current).toBeNull();
    });
  });

  describe('ask while another is open', () => {
    it('rejects the previous Promise (false) and shows the new request', async () => {
      const conf = useConfirmation();
      const p1 = conf.ask({ kind: 'standard', title: 't1', body: 'b1' });
      const p2 = conf.ask({ kind: 'victory', title: 't2', body: 'b2' });

      // p1 should have been rejected (resolved false)
      const r1 = await p1;
      expect(r1).toBe(false);

      // current should reflect the new request
      const after = useConfirmation();
      expect(after.current?.title).toBe('t2');
      expect(after.current?.kind).toBe('victory');

      // p2 finishes when accept()/reject() is called
      useConfirmation().accept();
      expect(await p2).toBe(true);
    });
  });

  describe('kind variants', () => {
    it('accepts kind=warning', () => {
      void useConfirmation().ask({ kind: 'warning', title: 't', body: 'b' });
      expect(useConfirmation().current?.kind).toBe('warning');
    });

    it('accepts kind=victory', () => {
      void useConfirmation().ask({ kind: 'victory', title: 't', body: 'b' });
      expect(useConfirmation().current?.kind).toBe('victory');
    });
  });
});
