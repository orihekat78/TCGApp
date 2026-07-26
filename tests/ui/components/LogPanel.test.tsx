// Phase 7 Task 7.13: LogPanel tests
// Round 3b 追加: role/aria + backdrop click filter (HandZone パターン統一)
// BUG-069 (2026-05-28): scene char uid / partner uid の表示名解決テスト追加

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { LogEntry } from '@/engine/types/game-state.js';
import { LogPanel } from '@/ui/components/LogPanel';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import { registerAll } from '@/cards';

function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

function makeEntry(overrides: Partial<LogEntry> & Pick<LogEntry, 'ts' | 'player' | 'turn' | 'action'>): LogEntry {
  return { ...overrides };
}

describe('LogPanel', () => {
  it('renders nothing when closed (Phase 8.5: LOG ボタンは ActionsPanel に移動)', () => {
    const html = strip(renderToString(
      <LogPanel entries={[]} open={false} />,
    ));
    expect(html).toBe('');
  });

  it('still renders nothing when closed even with entries', () => {
    const entries: LogEntry[] = Array.from({ length: 5 }).map((_, i) => makeEntry({
      ts: 1_000_000 + i, player: 'self', turn: 1, action: 'reasoning',
    }));
    const html = strip(renderToString(
      <LogPanel entries={entries} open={false} />,
    ));
    expect(html).toBe('');
  });

  it('renders log-list with "ログなし" when open and empty', () => {
    const html = strip(renderToString(
      <LogPanel entries={[]} open={true} />,
    ));
    expect(html).toMatch(/class="log-panel open"/);
    expect(html).toMatch(/aria-expanded="true"/);
    expect(html).toMatch(/class="log-list"/);
    expect(html).toMatch(/class="log-empty">ログなし/);
    // Phase 8.5: 閉じるボタンは LogPanel から削除済 (open=false で何も描画しない設計に変更)
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

  // BUG-069 (2026-05-28): scene char uid / partner uid を表示名に解決する
  describe('uid resolution (BUG-069)', () => {
    beforeAll(() => {
      registerAll();
    });

    it('resolves scene char uid (self-N) to card name when gameState provided', () => {
      // sampleGameState: self.scene[0] = D11004 (萩原千速) at uid='self-1'
      const state = createSampleGameState();
      const entries: LogEntry[] = [
        makeEntry({ ts: 1, player: 'self', turn: 1, action: 'reasoning', target: 'self-1' }),
      ];
      const html = strip(renderToString(
        <LogPanel entries={entries} open={true} gameState={state} />,
      ));
      // 名前 + (uid) の形式で表示される
      expect(html).toMatch(/萩原千速/);
      expect(html).toMatch(/self-1/);
    });

    it('resolves partner uid (partner:self) to partner card name', () => {
      // sampleGameState: self.partner = D11001 (毛利蘭)
      const state = createSampleGameState();
      const entries: LogEntry[] = [
        makeEntry({ ts: 1, player: 'self', turn: 1, action: 'reasoning', target: 'partner:self' }),
      ];
      const html = strip(renderToString(
        <LogPanel entries={entries} open={true} gameState={state} />,
      ));
      expect(html).toMatch(/partner:self/);
      // partner cardId が registry で resolve されれば名前が含まれる
      // (cardIdToDisplayName と同じ helper で逆引き、未登録なら uid 素通し)
    });

    it('falls back to raw uid when gameState absent', () => {
      const entries: LogEntry[] = [
        makeEntry({ ts: 1, player: 'self', turn: 1, action: 'reasoning', target: 'self-1' }),
      ];
      const html = strip(renderToString(
        <LogPanel entries={entries} open={true} />,
      ));
      expect(html).toMatch(/→ self-1/);
      expect(html).not.toMatch(/萩原千速/);
    });

    it('falls back to raw uid when uid not present in state scene', () => {
      const state = createSampleGameState();
      const entries: LogEntry[] = [
        makeEntry({ ts: 1, player: 'self', turn: 1, action: 'reasoning', target: 'self-99' }),
      ];
      const html = strip(renderToString(
        <LogPanel entries={entries} open={true} gameState={state} />,
      ));
      expect(html).toMatch(/→ self-99/);
    });
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

  // Round 3b: HandZone パターン統一に伴う accessibility 属性
  it('exposes role="dialog" and aria-label="ゲームログ" when open (Round 3b)', () => {
    const html = strip(renderToString(
      <LogPanel entries={[]} open={true} />,
    ));
    expect(html).toMatch(/role="dialog"/);
    expect(html).toMatch(/aria-label="ゲームログ"/);
    expect(html).toMatch(/aria-modal="true"/);
  });
});

// Round 3b: HandZone と同じ backdrop click 閉じパターンの interaction tests
describe('LogPanel — interaction (Round 3b)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    registerAll();
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('keeps known target card IDs as log text without a detail control', () => {
    const onCardExpand = vi.fn();
    const entries: LogEntry[] = [
      { ts: 1, player: 'self', turn: 1, action: 'handUseCard', target: 'D08015' },
    ];
    act(() => {
      root.render(<LogPanel entries={entries} open={true} onCardExpand={onCardExpand} />);
    });

    expect(container.textContent).toContain('D08015');
    expect(container.querySelector('button[aria-label*="D08015"]')).toBeNull();
    expect(onCardExpand).not.toHaveBeenCalled();
  });

  it('does not create a competing detail button for a target card', () => {
    const entries: LogEntry[] = [
      { ts: 1, player: 'self', turn: 1, action: 'handUseCard', target: 'D08015' },
    ];
    act(() => {
      root.render(<LogPanel entries={entries} open={true} onCardExpand={vi.fn()} />);
    });

    expect(container.querySelector('button[aria-label*="D08015"]')).toBeNull();
  });

  it('keeps known card IDs embedded in results as text', () => {
    const onCardExpand = vi.fn();
    const entries: LogEntry[] = [
      {
        ts: 1,
        player: 'self',
        turn: 1,
        action: 'effect:deckRevealUntil',
        result: 'revealed=3 matched=B04018P',
      },
    ];
    act(() => {
      root.render(<LogPanel entries={entries} open={true} onCardExpand={onCardExpand} />);
    });

    expect(container.querySelector('button[aria-label*="B04018P"]')).toBeNull();
    expect(onCardExpand).not.toHaveBeenCalled();
    expect(container.querySelector('.log-result')?.textContent).toContain('revealed=3 matched=B04018P');
  });

  it('does not make multiple result card IDs competing detail controls', () => {
    const onCardExpand = vi.fn();
    const entries: LogEntry[] = [
      {
        ts: 1,
        player: 'self',
        turn: 1,
        action: 'customAction',
        result: 'cards=B04018P,D08015,PR220',
      },
    ];
    act(() => {
      root.render(<LogPanel entries={entries} open={true} onCardExpand={onCardExpand} />);
    });

    expect(container.querySelectorAll('.log-result button')).toHaveLength(0);
    expect(onCardExpand).not.toHaveBeenCalled();
  });

  it('unknown IDs, scene UIDs, and partner:self remain non-clickable text', () => {
    const onCardExpand = vi.fn();
    const entries: LogEntry[] = [
      {
        ts: 1,
        player: 'self',
        turn: 1,
        action: 'customAction',
        target: 'partner:self',
        result: 'unknown=B99999P02 scene=self-123 partner=partner:self',
      },
    ];
    act(() => {
      root.render(<LogPanel entries={entries} open={true} onCardExpand={onCardExpand} />);
    });

    expect(container.querySelectorAll('.log-entry button')).toHaveLength(0);
    expect(container.querySelector('.log-entry')?.textContent).toContain('B99999P02');
    expect(container.querySelector('.log-entry')?.textContent).toContain('self-123');
    expect(container.querySelector('.log-entry')?.textContent).toContain('partner:self');
  });

  it('renders known card IDs without interactive controls when callback is omitted', () => {
    const entries: LogEntry[] = [
      {
        ts: 1,
        player: 'self',
        turn: 1,
        action: 'handUseCard',
        target: 'D08015',
        result: 'matched=B04018P',
      },
    ];
    act(() => {
      root.render(<LogPanel entries={entries} open={true} />);
    });

    expect(container.querySelectorAll('.log-entry button')).toHaveLength(0);
    expect(container.querySelector('.log-target')?.textContent).toContain('D08015');
    expect(container.querySelector('.log-result')?.textContent).toContain('B04018P');
  });

  it('close × button click invokes onClose', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<LogPanel entries={[]} open={true} onClose={onClose} />);
    });
    const closeBtn = container.querySelector('.log-panel-close') as HTMLButtonElement | null;
    expect(closeBtn).not.toBeNull();
    act(() => {
      closeBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop layer (.log-panel-backdrop) click invokes onClose', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<LogPanel entries={[]} open={true} onClose={onClose} />);
    });
    // Round 3b: 透明 backdrop layer が panel の外側 click を捕捉する。
    const backdrop = container.querySelector('.log-panel-backdrop') as HTMLDivElement | null;
    expect(backdrop).not.toBeNull();
    act(() => {
      backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('panel root click (target === currentTarget) invokes onClose (fallback)', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<LogPanel entries={[]} open={true} onClose={onClose} />);
    });
    const panel = container.querySelector('.log-panel') as HTMLDivElement | null;
    expect(panel).not.toBeNull();
    // panel 内部余白 click 想定: target === currentTarget で filter pass
    act(() => {
      panel!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT render backdrop layer when onClose is undefined', () => {
    act(() => {
      root.render(<LogPanel entries={[]} open={true} />);
    });
    const backdrop = container.querySelector('.log-panel-backdrop');
    expect(backdrop).toBeNull();
  });

  it('entry click does NOT invoke onClose (target !== currentTarget filter)', () => {
    const onClose = vi.fn();
    const entries: LogEntry[] = [
      { ts: 1, player: 'self', turn: 1, action: 'reasoning' },
    ];
    act(() => {
      root.render(<LogPanel entries={entries} open={true} onClose={onClose} />);
    });
    const entry = container.querySelector('.log-entry') as HTMLDivElement | null;
    expect(entry).not.toBeNull();
    // dispatch on a child entry: bubbles to panel but target !== currentTarget on handler
    act(() => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape closes the log modal itself', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<LogPanel entries={[]} open={true} onClose={onClose} />);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
