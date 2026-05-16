// Phase 8.10j: VictoryOverlay tests

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { VictoryOverlay } from '@/ui/components/VictoryOverlay';
import { useGameStateStore } from '@/ui/state/store';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import { produce } from '@/engine/produce';

function setResult(
  winner: 'self' | 'opp',
  reason: 'evidence' | 'deck-out' | 'concede',
): void {
  const s = produce(createSampleGameState(), (d) => {
    d.gameResult = { winner, reason };
  });
  useGameStateStore.setState({ gameState: s });
}

describe('VictoryOverlay', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
  });

  it('renders nothing when gameResult is null', () => {
    useGameStateStore.setState({ gameState: createSampleGameState() });
    const html = renderToString(<VictoryOverlay />);
    expect(html).toBe('');
  });

  it('renders WIN with 事件解決 when self wins by evidence', () => {
    setResult('self', 'evidence');
    const html = renderToString(<VictoryOverlay />);
    expect(html).toContain('data-testid="victory-overlay"');
    expect(html).toContain('YOU WIN');
    expect(html).toContain('事件解決');
    expect(html).toContain('win');
  });

  it('renders LOSE with デッキ切れ when self loses by deck-out', () => {
    setResult('opp', 'deck-out');
    const html = renderToString(<VictoryOverlay />);
    expect(html).toContain('YOU LOSE');
    expect(html).toContain('デッキ切れ');
    expect(html).toContain('lose');
  });

  it('renders concede reason text', () => {
    setResult('self', 'concede');
    const html = renderToString(<VictoryOverlay />);
    expect(html).toContain('投了');
  });
});
