// Phase 8.10f: ContactFlash tests

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ContactFlash } from '@/ui/components/ContactFlash';
import { useGameStateStore } from '@/ui/state/store';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import { produce } from '@/engine/produce';
import type { LogEntry } from '@/engine/types/game-state';

function pushJudge(result: 'hit' | 'miss'): void {
  const s = produce(createSampleGameState(), (d) => {
    const entry: LogEntry = {
      ts: 1,
      player: 'self',
      turn: d.turn.number,
      action: 'contact-judge',
      result,
    };
    d.log.push(entry);
  });
  useGameStateStore.setState({ gameState: s });
}

describe('ContactFlash', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
  });

  it('renders nothing when gameState is null', () => {
    const html = renderToString(<ContactFlash />);
    expect(html).toBe('');
  });

  it('renders nothing when last log entry is not contact-judge', () => {
    useGameStateStore.setState({ gameState: createSampleGameState() });
    const html = renderToString(<ContactFlash />);
    expect(html).toBe('');
  });

  it('renders hit flash when last log entry is contact-judge with result=hit', () => {
    pushJudge('hit');
    const html = renderToString(<ContactFlash />);
    expect(html).toContain('contact-flash');
    expect(html).toContain('contact-flash-hit');
    expect(html).toContain('data-testid="contact-flash"');
  });

  it('renders miss flash when last log entry is contact-judge with result=miss', () => {
    pushJudge('miss');
    const html = renderToString(<ContactFlash />);
    expect(html).toContain('contact-flash-miss');
  });
});
