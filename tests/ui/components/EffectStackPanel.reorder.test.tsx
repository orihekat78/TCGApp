// Phase 8 完全クローズ Commit 5: EffectStackPanel reorder UI SSR test
//
// rules: 15-abilities-effects.md
// spec: 計画 — Commit 5

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { EffectStackPanel } from '@/ui/components/EffectStackPanel';
import type { EffectStackEntry } from '@/engine/types/effect-stack';

function makeEntry(id: string, player: 'self' | 'opp', nano: number, state: EffectStackEntry['state'] = 'pending'): EffectStackEntry {
  return {
    id,
    source: { player },
    triggeredBy: { hook: 'test' },
    triggeredAt: { turn: 1, phase: 'main', nano },
    effect: { kind: 'atom', verb: 'noop', args: {} } as never,
    state,
  };
}

describe('EffectStackPanel reorder UI (Commit 5)', () => {
  it('同 owner 2 件以上で onReorder 指定 → ▲▼ ボタンを描画', () => {
    const entries = [
      { ...makeEntry('e1', 'self', 1), triggerBatch: 1 },
      { ...makeEntry('e2', 'self', 2), triggerBatch: 1 },
    ];
    const html = renderToString(
      <EffectStackPanel entries={entries} open={true} onReorder={() => {}} />,
    );
    expect(html).toMatch(/data-testid="reorder-up-e1"/);
    expect(html).toMatch(/data-testid="reorder-down-e1"/);
    expect(html).toMatch(/data-testid="reorder-up-e2"/);
    expect(html).toMatch(/data-testid="reorder-down-e2"/);
  });

  it('onReorder 未指定 → ▲▼ 非表示', () => {
    const entries = [
      { ...makeEntry('e1', 'self', 1), triggerBatch: 1 },
      { ...makeEntry('e2', 'self', 2), triggerBatch: 1 },
    ];
    const html = renderToString(
      <EffectStackPanel entries={entries} open={true} />,
    );
    expect(html).not.toMatch(/data-testid="reorder-/);
  });

  it('同 owner 1 件のみ → ▲▼ 非表示 (UI ノイズ削減)', () => {
    const entries = [makeEntry('e1', 'self', 1)];
    const html = renderToString(
      <EffectStackPanel entries={entries} open={true} onReorder={() => {}} />,
    );
    expect(html).not.toMatch(/data-testid="reorder-/);
  });

  it('異 owner 混在 → 同 owner 内のみ ▲▼ 表示 (この例では片側 1 件しかないので非表示)', () => {
    const entries = [
      makeEntry('e1', 'self', 1),
      makeEntry('e2', 'opp', 2),
    ];
    const html = renderToString(
      <EffectStackPanel entries={entries} open={true} onReorder={() => {}} />,
    );
    // self も opp も 1 件ずつ → reorder UI なし
    expect(html).not.toMatch(/data-testid="reorder-/);
  });

  it('resolving 状態の entry は reorder 対象外 (state pending のみ)', () => {
    const entries = [
      makeEntry('e1', 'self', 1, 'resolving'),
      makeEntry('e2', 'self', 2, 'resolving'),
    ];
    const html = renderToString(
      <EffectStackPanel entries={entries} open={true} onReorder={() => {}} />,
    );
    // 両方 resolving → reorder 不可
    expect(html).not.toMatch(/data-testid="reorder-/);
  });
  it('uses the priority-owner entry snapshot across batches and legacy entries', () => {
    const resolved = { ...makeEntry('old', 'self', 1, 'resolved'), triggerBatch: 4 };
    const a = { ...makeEntry('a3', 'self', 2), triggerBatch: 7 };
    const b = { ...makeEntry('a4', 'self', 3), triggerBatch: 8 };
    const legacy = makeEntry('legacy', 'self', 4);
    const other = { ...makeEntry('opp', 'opp', 5), triggerBatch: 7 };
    const html = renderToString(
      <EffectStackPanel entries={[resolved, a, b, legacy, other]} open reorderPlayer="self" onReorder={() => {}} onConfirmOrder={() => {}} />,
    );
    expect(html).toMatch(/data-testid="reorder-up-a3"/);
    expect(html).toMatch(/data-testid="reorder-up-a4"/);
    expect(html).toMatch(/data-testid="reorder-up-legacy"/);
    expect(html).not.toMatch(/reorder-up-old/);
    expect(html).not.toMatch(/data-effect-id="opp"/);
    expect(html).toMatch(/data-testid="confirm-effect-order-self-a3-a4-legacy"/);
  });

  it('submits the canonical engine order when timestamps diverge', () => {
    const canonicalFirst = makeEntry('canonical-first', 'self', 99);
    const canonicalSecond = makeEntry('canonical-second', 'self', 1);
    const html = renderToString(
      <EffectStackPanel
        entries={[canonicalFirst, canonicalSecond]}
        open
        reorderPlayer="self"
        onReorder={() => {}}
        onConfirmOrder={() => {}}
      />,
    );
    expect(html.indexOf('data-effect-id="canonical-first"'))
      .toBeLessThan(html.indexOf('data-effect-id="canonical-second"'));
    expect(html).toMatch(/data-testid="confirm-effect-order-self-canonical-first-canonical-second"/);
  });
});
