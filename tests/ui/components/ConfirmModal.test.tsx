// Phase 8 Task 8.5: ConfirmModal 描画スナップショット
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md
// 仕様:
//   - current=null → 何もレンダーしない
//   - current が在る場合: title / body / OK / Cancel ボタン
//   - kind=warning / victory で modifier class が付く

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import type { ResolvedConfirmRequest } from '@/ui/hooks/useConfirmation';

function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

const noop = (): void => {};

describe('ConfirmModal', () => {
  it('renders nothing when current is null', () => {
    const html = renderToString(
      <ConfirmModal current={null} onAccept={noop} onReject={noop} />,
    );
    expect(html).toBe('');
  });

  it('renders standard kind with default labels', () => {
    const req: ResolvedConfirmRequest = {
      kind: 'standard',
      title: '推理',
      body: '萩原千速で推理',
      okLabel: '実行',
      cancelLabel: 'キャンセル',
    };
    const html = strip(renderToString(
      <ConfirmModal current={req} onAccept={noop} onReject={noop} />,
    ));
    expect(html).toMatch(/class="[^"]*confirm-modal[^"]*standard/);
    expect(html).toContain('推理');
    expect(html).toContain('萩原千速で推理');
    expect(html).toMatch(/<button[^>]*class="[^"]*confirm-ok/);
    expect(html).toContain('実行');
    expect(html).toMatch(/<button[^>]*class="[^"]*confirm-cancel/);
    expect(html).toContain('キャンセル');
  });

  it('renders warning kind with modifier class', () => {
    const req: ResolvedConfirmRequest = {
      kind: 'warning',
      title: 'アシスト',
      body: 'パートナーが FILE へ移動します',
      okLabel: '実行',
      cancelLabel: '中止',
    };
    const html = strip(renderToString(
      <ConfirmModal current={req} onAccept={noop} onReject={noop} />,
    ));
    expect(html).toMatch(/class="[^"]*confirm-modal[^"]*warning/);
    expect(html).toContain('アシスト');
    expect(html).toContain('中止');
  });

  it('renders victory kind with modifier class', () => {
    const req: ResolvedConfirmRequest = {
      kind: 'victory',
      title: '事件解決',
      body: 'ゲーム勝利します',
      okLabel: '勝利',
      cancelLabel: 'キャンセル',
    };
    const html = strip(renderToString(
      <ConfirmModal current={req} onAccept={noop} onReject={noop} />,
    ));
    expect(html).toMatch(/class="[^"]*confirm-modal[^"]*victory/);
    expect(html).toContain('事件解決');
    expect(html).toContain('勝利');
  });

  it('uses role="dialog" with aria-modal', () => {
    const req: ResolvedConfirmRequest = {
      kind: 'standard',
      title: 't',
      body: 'b',
      okLabel: 'OK',
      cancelLabel: 'NG',
    };
    const html = strip(renderToString(
      <ConfirmModal current={req} onAccept={noop} onReject={noop} />,
    ));
    expect(html).toMatch(/role="dialog"/);
    expect(html).toMatch(/aria-modal="true"/);
  });
});
