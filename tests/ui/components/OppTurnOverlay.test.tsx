// Phase 8.10a: OppTurnOverlay tests

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OppTurnOverlay } from '@/ui/components/OppTurnOverlay';
import { useGameStateStore } from '@/ui/state/store';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import { produce } from '@/engine/produce';

describe('OppTurnOverlay', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
  });

  it('renders nothing when gameState is null', () => {
    const html = renderToString(<OppTurnOverlay />);
    expect(html).toBe('');
  });

  it('renders nothing when turn.player === "self"', () => {
    const s = produce(createSampleGameState(), (d) => {
      d.turn.player = 'self';
    });
    useGameStateStore.setState({ gameState: s });
    const html = renderToString(<OppTurnOverlay />);
    expect(html).not.toContain('opp-turn-overlay');
  });

  it('renders overlay when turn.player === "opp"', () => {
    const s = produce(createSampleGameState(), (d) => {
      d.turn.player = 'opp';
    });
    useGameStateStore.setState({ gameState: s });
    const html = renderToString(<OppTurnOverlay />);
    expect(html).toContain('opp-turn-overlay');
    expect(html).toContain('相手のターン処理中');
    expect(html).toContain('data-testid="opp-turn-overlay"');
  });
});
