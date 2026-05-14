// Phase 7 Task 7.13: LogPanel tests

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { LogEntry } from '@/engine/types/game-state.js';
import { LogPanel } from '@/ui/components/LogPanel';

function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

function makeEntry(overrides: Partial<LogEntry> & Pick<LogEntry, 'ts' | 'player' | 'turn' | 'action'>): LogEntry {
  return { ...overrides };
}

describe('LogPanel', () => {
  it('renders the .log-btn with LOG label and count (closed by default)', () => {
    const html = strip(renderToString(
      <LogPanel entries={[]} open={false} />,
    ));
    expect(html).toMatch(/class="log-panel"/);
    expect(html).not.toMatch(/log-panel open/);
    expect(html).toMatch(/aria-expanded="false"/);
    expect(html).toMatch(/class="log-btn"/);
    expect(html).toMatch(/aria-label="ログを開く"/);
    expect(html).toMatch(/class="log-btn-label">LOG/);
    expect(html).toMatch(/class="log-btn-count">0/);
    // 閉時は log-list を描画しない
    expect(html).not.toMatch(/class="log-list"/);
  });

  it('renders count badge reflecting entries length even when closed', () => {
    const entries: LogEntry[] = Array.from({ length: 5 }).map((_, i) => makeEntry({
      ts: 1_000_000 + i, player: 'self', turn: 1, action: 'reasoning',
    }));
    const html = strip(renderToString(
      <LogPanel entries={entries} open={false} />,
    ));
    expect(html).toMatch(/class="log-btn-count">5/);
  });

  it('renders log-list with "ログなし" when open and empty', () => {
    const html = strip(renderToString(
      <LogPanel entries={[]} open={true} />,
    ));
    expect(html).toMatch(/class="log-panel open"/);
    expect(html).toMatch(/aria-expanded="true"/);
    expect(html).toMatch(/class="log-list"/);
    expect(html).toMatch(/class="log-empty">ログなし/);
    expect(html).toMatch(/aria-label="ログを閉じる"/);
  });

  it('renders entries in reverse chronological order (newest first)', () => {
    const entries: LogEntry[] = [
      makeEntry({ ts: 1_000_001, player: 'self', turn: 1, action: 'reasoning' }),
      makeEntry({ ts: 1_000_002, player: 'opp',  turn: 2, action: 'action' }),
      makeEntry({ ts: 1_000_003, player: 'self', turn: 3, action: 'endTurn' }),
    ];
    const html = strip(renderToString(
      <LogPanel entries={entries} open={true} />,
    ));
    const idx1 = html.indexOf('推理');     // ts=001 (T1)
    const idx2 = html.indexOf('アクション'); // ts=002 (T2)
    const idx3 = html.indexOf('ターン終了'); // ts=003 (T3)
    // 新しい順: T3 → T2 → T1
    expect(idx3).toBeGreaterThan(0);
    expect(idx3).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx1);
  });

  it('renders side-self / side-opp classes per entry', () => {
    const entries: LogEntry[] = [
      makeEntry({ ts: 1, player: 'self', turn: 1, action: 'reasoning' }),
      makeEntry({ ts: 2, player: 'opp',  turn: 1, action: 'action' }),
    ];
    const html = strip(renderToString(
      <LogPanel entries={entries} open={true} />,
    ));
    expect(html).toMatch(/log-entry side-self/);
    expect(html).toMatch(/log-entry side-opp/);
  });

  it('limits displayed entries to maxEntries (defaults 30, picking last)', () => {
    const entries: LogEntry[] = Array.from({ length: 50 }).map((_, i) => makeEntry({
      ts: i + 1, player: 'self', turn: 1, action: 'reasoning', target: `t${i}`,
    }));
    const html = strip(renderToString(
      <LogPanel entries={entries} open={true} maxEntries={5} />,
    ));
    // maxEntries=5: 最後の 5 件 (t45..t49) のみ表示
    expect(html).toMatch(/t49/);
    expect(html).toMatch(/t45/);
    expect(html).not.toMatch(/t44/);
    expect(html).not.toMatch(/t0/);
    expect(html.match(/class="log-entry /g)?.length).toBe(5);
  });

  it('shows target and result when provided', () => {
    const entries: LogEntry[] = [
      makeEntry({
        ts: 1, player: 'self', turn: 1, action: 'action',
        target: 'opp.scene[0]', result: 'remove',
      }),
    ];
    const html = strip(renderToString(
      <LogPanel entries={entries} open={true} />,
    ));
    expect(html).toMatch(/→ opp.scene\[0\]/);
    expect(html).toMatch(/: remove/);
  });

  it('falls back to raw action string when not in ACTION_LABEL', () => {
    const entries: LogEntry[] = [
      makeEntry({ ts: 1, player: 'self', turn: 1, action: 'customAction' }),
    ];
    const html = strip(renderToString(
      <LogPanel entries={entries} open={true} />,
    ));
    expect(html).toMatch(/class="log-action">customAction/);
  });
});
