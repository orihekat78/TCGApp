// Phase 7 Task 7.14: EffectStackPanel tests

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { EffectStackEntry } from '@/engine/types/effect-stack.js';
import { EffectStackPanel } from '@/ui/components/EffectStackPanel';

function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

function makeEntry(overrides: Partial<EffectStackEntry> & Pick<EffectStackEntry, 'id'>): EffectStackEntry {
  return {
    source: { player: 'self' },
    triggeredBy: { hook: 'OnEnter' },
    triggeredAt: { turn: 1, phase: 'main', nano: 0 },

    effect: { kind: 'noop' } as any,
    state: 'pending',
    ...overrides,
  };
}

describe('EffectStackPanel', () => {
  it('renders nothing when closed and no entries', () => {
    const html = strip(renderToString(
      <EffectStackPanel entries={[]} open={false} />,
    ));
    expect(html).toBe('');
  });

  it('renders nothing when closed even if pending entries exist', () => {
    const entries: EffectStackEntry[] = [
      makeEntry({ id: 'e1' }),
      makeEntry({ id: 'e2' }),
      makeEntry({ id: 'e3' }),
    ];
    const html = strip(renderToString(
      <EffectStackPanel entries={entries} open={false} />,
    ));
    expect(html).toBe('');
  });

  it('renders empty-list message when open + no entries', () => {
    const html = strip(renderToString(
      <EffectStackPanel entries={[]} open={true} />,
    ));
    expect(html).toMatch(/effect-stack-panel open/);
    expect(html).toMatch(/aria-expanded="true"/);
    expect(html).toMatch(/effect-stack-list/);
    expect(html).toMatch(/effect-stack-empty-list">スタックは空です/);
  });

  it('renders entries with state / player / hook when open', () => {
    const entries: EffectStackEntry[] = [
      makeEntry({
        id: 'e1',
        source: { player: 'self', cardId: 'D08010' },
        triggeredBy: { hook: 'OnReasoning' },
        triggeredAt: { turn: 3, phase: 'main', nano: 1 },
        state: 'pending',
      }),
    ];
    const html = strip(renderToString(
      <EffectStackPanel entries={entries} open={true} />,
    ));
    expect(html).toMatch(/data-effect-id="e1"/);
    expect(html).toMatch(/effect-stack-entry side-self state-pending/);
    expect(html).toMatch(/entry-state">待機中</);
    expect(html).toMatch(/entry-player">自</);
    expect(html).toMatch(/entry-hook">OnReasoning</);
    expect(html).toMatch(/entry-source">\[D08010\]/);
    expect(html).toMatch(/entry-turn">T3</);
  });

  it('shows only pending decisions and excludes resolved history', () => {
    const entries: EffectStackEntry[] = [
      makeEntry({ id: 'e1', state: 'pending' }),
      makeEntry({ id: 'e2', state: 'resolving' }),
      makeEntry({ id: 'e3', state: 'resolved' }),
      makeEntry({ id: 'e4', state: 'cancelled' }),
    ];
    const html = strip(renderToString(
      <EffectStackPanel entries={entries} open={true} />,
    ));
    expect(html).toMatch(/state-pending/);
    expect(html).not.toMatch(/state-resolving/);
    expect(html).not.toMatch(/state-resolved/);
    expect(html).not.toMatch(/state-cancelled/);
    expect(html).toMatch(/待機中/);
  });

  it('renders entries in the received canonical engine order', () => {
    const entries: EffectStackEntry[] = [
      makeEntry({ id: 'late',  triggeredAt: { turn: 1, phase: 'main', nano: 5 } }),
      makeEntry({ id: 'first', triggeredAt: { turn: 1, phase: 'main', nano: 1 } }),
      makeEntry({ id: 'mid',   triggeredAt: { turn: 1, phase: 'main', nano: 3 } }),
    ];
    const html = strip(renderToString(
      <EffectStackPanel entries={entries} open={true} />,
    ));
    const lateIdx  = html.indexOf('data-effect-id="late"');
    const firstIdx = html.indexOf('data-effect-id="first"');
    const midIdx   = html.indexOf('data-effect-id="mid"');
    expect(lateIdx).toBeLessThan(firstIdx);
    expect(firstIdx).toBeLessThan(midIdx);
  });

  it('does not replace canonical owner order with timestamp ordering', () => {
    const entries: EffectStackEntry[] = [
      makeEntry({
        id: 'second', ownerChosenOrder: 1,
        triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      }),
      makeEntry({
        id: 'first',  ownerChosenOrder: 0,
        triggeredAt: { turn: 1, phase: 'main', nano: 100 },
      }),
    ];
    const html = strip(renderToString(
      <EffectStackPanel entries={entries} open={true} />,
    ));
    const secondIdx = html.indexOf('data-effect-id="second"');
    const firstIdx  = html.indexOf('data-effect-id="first"');
    expect(secondIdx).toBeLessThan(firstIdx);
    expect(html).toMatch(/entry-order">#1</);  // 0-based → display 1
    expect(html).toMatch(/entry-order">#2</);  // 1-based → display 2
  });

  it('renders side-opp for opponent-owned entries', () => {
    const entries: EffectStackEntry[] = [
      makeEntry({ id: 'e1', source: { player: 'opp' } }),
    ];
    const html = strip(renderToString(
      <EffectStackPanel entries={entries} open={true} />,
    ));
    expect(html).toMatch(/effect-stack-entry side-opp/);
    expect(html).toMatch(/entry-player">相</);
  });
});
