// Phase 8.10i: RefreshOverlay tests

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { RefreshOverlay } from '@/ui/components/RefreshOverlay';
import { useGameStateStore } from '@/ui/state/store';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import { produce } from '@/engine/produce';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import type { LogEntry } from '@/engine/types/game-state';

function pushRefresh(player: 'self' | 'opp'): void {
  const s = produce(createSampleGameState(), (d) => {
    const entry: LogEntry = {
      ts: 1,
      player,
      turn: d.turn.number,
      action: 'refresh',
      result: '3',
    };
    d.log.push(entry);
  });
  useGameStateStore.setState({ gameState: s });
}

function pushCausalRefresh(player: 'self' | 'opp'): void {
  const s = produce(createSampleGameState(), (d) => {
    startCausalSession(d, 'refresh-test');
    appendCausal(d, {
      actor: player,
      kind: 'summary',
      tags: ['refresh'],
      targets: [],
      outcome: { type: 'state', state: 'success' },
    });
  });
  useGameStateStore.setState({ gameState: s });
}

describe('RefreshOverlay', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
  });

  it('renders nothing when gameState is null', () => {
    const html = renderToString(<RefreshOverlay />);
    expect(html).toBe('');
  });

  it('renders nothing when last log entry is not refresh', () => {
    useGameStateStore.setState({ gameState: createSampleGameState() });
    const html = renderToString(<RefreshOverlay />);
    expect(html).toBe('');
  });

  it('renders self refresh overlay when last log is refresh by self', () => {
    pushRefresh('self');
    const html = renderToString(<RefreshOverlay />);
    expect(html).toContain('data-testid="refresh-overlay"');
    expect(html).toContain('リフレッシュ');
    expect(html).toContain('自分のデッキを再構築');
  });

  it('renders opp refresh overlay when last log is refresh by opp', () => {
    pushRefresh('opp');
    const html = renderToString(<RefreshOverlay />);
    expect(html).toContain('相手のデッキを再構築');
  });

  it('renders a causal tagged refresh without parsing the raw action', () => {
    pushCausalRefresh('self');
    expect(renderToString(<RefreshOverlay />)).toContain('data-testid="refresh-overlay"');
  });

  it('does not replay a past refresh presentation while replay is active', () => {
    pushCausalRefresh('self');
    expect(renderToString(<RefreshOverlay suppressed />)).toBe('');
    expect(renderToString(<RefreshOverlay />)).toContain('data-testid="refresh-overlay"');
  });

  it('removes refresh animation under reduced motion without hiding its content', () => {
    const css = readFileSync('src/ui/components/RefreshOverlay.css', 'utf8');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.refresh-overlay,[\s\S]*animation:\s*none;/);
  });
});
