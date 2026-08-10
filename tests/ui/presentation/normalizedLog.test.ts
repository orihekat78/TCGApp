import { describe, expect, it } from 'vitest';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { createEmptyGameState } from '@/engine/state-factory';
import { normalizedGameLogForUi } from '@/ui/presentation/normalizedLog';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';

describe('normalized public UI log', () => {
  it('downgrades a face-down evidence card reference to a public zone reference', () => {
    const state = createEmptyGameState();
    state.players.opp.evidence = [{
      cardId: 'SECRET-EVIDENCE',
      faceUp: false,
      origin: { turn: 1, via: 'reasoning' },
    }];
    startCausalSession(state, 'normalized-hidden-evidence');
    appendCausal(state, {
      actor: 'opp', kind: 'select', targets: [], outcome: { type: 'none' },
    });
    (state.log[0] as { target?: string; targets: unknown[] }).target = 'SECRET-EVIDENCE';
    (state.log[0] as { targets: unknown[] }).targets = [{
      visibility: 'public', kind: 'card', label: 'SECRET-EVIDENCE',
      side: 'opp', zone: 'evidence', cardNumber: 'SECRET-EVIDENCE',
    }];
    resetPresentationQueue('normalized-hidden-evidence');

    const graph = normalizedGameLogForUi(state);

    expect(JSON.stringify(graph)).not.toContain('SECRET-EVIDENCE');
    expect(graph.nodes[0]?.targets).toEqual([{
      visibility: 'public', kind: 'zone', label: '相手の証拠', side: 'opp', zone: 'evidence',
    }]);
  });
});
