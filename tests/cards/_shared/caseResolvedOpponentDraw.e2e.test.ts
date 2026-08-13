// Case-resolved opponent-draw semantic cluster.
// Grounding: B02089/B02090/B02091/B03136/B03137/B03138 all print an
// opponent draw when their case changes from 事件編 to 解決編.

import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { createEmptyGameState } from '@/engine/state-factory';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import type { GameState } from '@/engine/types';

const caseIds = ['B02089', 'B02090', 'B02091', 'B03136', 'B03137', 'B03138'] as const;
const players = ['self', 'opp'] as const;
const opponentOf = (player: 'self' | 'opp') => player === 'self' ? 'opp' : 'self';

function prepare(caseId: typeof caseIds[number], owner: 'self' | 'opp'): GameState {
  const state = createEmptyGameState();
  const opponent = opponentOf(owner);
  const fileCard = { type: 'card-back' as const, cardId: 'D08017' };

  state.turn = { number: 3, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    cardId: caseId,
    status: '事件編',
    requiredEvidence: 7,
    colors: ['青'],
    declaredUseCount: {},
  };
  state.players[owner].partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  state.players[owner].file = [fileCard, fileCard, fileCard, fileCard, fileCard, fileCard];
  state.players[owner].hand = ['owner-hand'];
  state.players[opponent].deck = ['opponent-draw-1', 'opponent-draw-2'];
  state.players[opponent].hand = ['opponent-hand'];
  return state;
}

describe('case:to-resolved opponent draw runtime cluster', () => {
  beforeEach(() => {
    registerAll();
    useGameStateStore.setState({
      gameState: null,
      pendingEffectPick: null,
      pendingEffectChoice: null,
      pendingEffectOptional: null,
      pendingDeckReorder: null,
    });
  });

  it.each(caseIds.flatMap((caseId) => players.map((owner) => ({ caseId, owner }))))(
    '$caseId: canonical Assist resolves $owner case at six FILE, mandates the transition, and draws its opponent exactly one', ({ caseId, owner }) => {
      const state = prepare(caseId, owner);
      const opponent = opponentOf(owner);
      const ownerHandBefore = state.players[owner].hand.length;
      const opponentHandBefore = state.players[opponent].hand.length;
      expect(state.players[owner].file).toHaveLength(6);
      useGameStateStore.setState({ gameState: state });

      expect(dispatchEngineAction({ type: 'assist', player: owner })).toEqual({ ok: true });
      const resolved = useGameStateStore.getState();
      const after = resolved.gameState!;

      // Q&A cluster: B02089/B02090/B02091/B03136/B03137/B03138.
      expect(after.players[owner].case.status, `${caseId} reaches 解決編`).toBe('解決編');
      expect(after.players[owner].hand.length, `${caseId} owner does not draw`).toBe(ownerHandBefore);
      expect(after.players[opponent].hand).toEqual(['opponent-hand', 'opponent-draw-1']);
      expect(after.players[opponent].hand.length, `${caseId} opponent draws exactly one`).toBe(opponentHandBefore + 1);
      expect(after.pendingEffects, `${caseId} mandatory trigger resolves without a queued decision`).toEqual([
        expect.objectContaining({
          effect: { kind: 'atom', verb: 'draw', args: { player: 'opp', n: 1 } },
          source: expect.objectContaining({ cardId: caseId, player: owner, uid: `case:${owner}` }),
          state: 'resolved',
          triggeredBy: { hook: 'case:to-resolved', payload: { player: owner } },
        }),
      ]);
      // B02089/B02090/B02091/B03136/B03137/B03138 must not surface an optional decision.
      expect(resolved.pendingEffectPick).toBeNull();
      expect(resolved.pendingEffectChoice).toBeNull();
      expect(resolved.pendingEffectOptional).toBeNull();
      expect(resolved.pendingDeckReorder).toBeNull();
    },
  );
});
