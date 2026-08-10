// Phase 8.10f: ContactFlash tests

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ContactFlash } from '@/ui/components/ContactFlash';
import { useGameStateStore } from '@/ui/state/store';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import { produce } from '@/engine/produce';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import type { LogEntry } from '@/engine/types/game-state';

function pushJudge(result: string): void {
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

function pushCausalJudge(state: 'success' | 'failed'): void {
  const s = produce(createSampleGameState(), (d) => {
    startCausalSession(d, 'contact-test');
    appendCausal(d, {
      actor: 'self',
      kind: 'declare',
      tags: ['contact'],
      targets: [],
      outcome: { type: 'state', state },
    });
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

  it('renders hit flash from the real legacy contact result format', () => {
    pushJudge('6000 VS 4000 -> HIT');
    const html = renderToString(<ContactFlash />);
    expect(html).toContain('contact-flash');
    expect(html).toContain('contact-flash-hit');
    expect(html).toContain('data-testid="contact-flash"');
  });

  it('renders miss flash from the real legacy contact result format', () => {
    pushJudge('2000 VS 4000 -> MISS');
    const html = renderToString(<ContactFlash />);
    expect(html).toContain('contact-flash-miss');
  });

  it.each([
    ['success', 'contact-flash-hit'],
    ['failed', 'contact-flash-miss'],
  ] as const)('renders a causal tagged %s contact result', (state, className) => {
    pushCausalJudge(state);
    expect(renderToString(<ContactFlash />)).toContain(className);
  });

  it('fails closed when a legacy contact result has no public verdict', () => {
    pushJudge('private resolution detail');
    expect(renderToString(<ContactFlash />)).toBe('');
  });

  it('does not replay a past contact presentation while replay is active', () => {
    pushCausalJudge('success');
    expect(renderToString(<ContactFlash suppressed />)).toBe('');
    expect(renderToString(<ContactFlash />)).toContain('contact-flash-hit');
  });
});
