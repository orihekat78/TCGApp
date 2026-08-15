// rules: 01-victory-conditions.md, 14-refresh.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { gameResult } from '@/engine/mutate/gameResult';
import { startCausalSession } from '@/engine/log/causal';

describe('engine.mutate.gameResult', () => {
  describe('set', () => {
    it('self の事件解決勝利を設定する (rules/01)', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        gameResult.set(draft, 'self', 'evidence');
      });
      expect(result.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
    });

    it('opp のデッキアウト勝利を設定する (rules/14)', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        gameResult.set(draft, 'opp', 'deck-out');
      });
      expect(result.gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
    });

    it('投了を設定する', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        gameResult.set(draft, 'self', 'concede');
      });
      expect(result.gameResult).toEqual({ winner: 'self', reason: 'concede' });
    });

    it('direct terminal write clears resumable action/contact state before its causal result', () => {
      const s = createEmptyGameState();
      s.actionContexts = {
        pending: {
          id: 'pending',
          byUid: 'ACTOR#1',
          byPlayer: 'self',
          target: { kind: 'case', player: 'opp' },
          phase: 'judge',
          judgeResolved: true,
          pendingHiramekiEvidenceRemoval: {
            token: 'hirameki:pending:opp',
            player: 'opp',
            abilityId: 'a1',
           effectValid: true,
            decisionResolved: false,
            evidence: {
              cardId: 'HELD-HIRAMEKI',
              faceUp: true,
              origin: { turn: 1, via: 'action-case' },
            },
          },
          startedAt: { turn: 1, nano: 1 },
        },
      };
      s.pendingRuntimeState = {
        token: 1,
        snapshot: [{
          key: '__pendingHirameki',
          present: true,
          value: {
            player: 'opp',
            cardId: 'HELD-HIRAMEKI',
            abilityId: 'a1',
            effectValid: true,
            actorUid: 'ACTOR#1',
            actionId: 'pending',
            heldEvidence: {
              token: 'hirameki:pending:opp',
              player: 'opp',
              cardId: 'HELD-HIRAMEKI',
            },
            gainDeferred: true,
          },
        }],
      };
      s.pendingTurnTransition = {
        endingPlayer: 'self',
        stage: 'after-end-start',
        startNextTurn: true,
      };
      s.pendingReasoningContinuation = { token: 7, uid: 'ACTOR#1', player: 'self' };
      s.pendingEffects = (['pending', 'resolving'] as const).map((state, index) => ({
        id: `terminal-${state}`,
        source: { player: 'self' as const, cardId: 'SOURCE', abilityId: 'a1' },
        triggeredBy: { hook: 'manual' },
        triggeredAt: { turn: 1, phase: 'main', nano: index + 1 },
        effect: { kind: 'atom' as const, verb: 'noop' as const, args: {} },
        state,
      }));
      s.reservedEffects = (['next-match', 'turn-end'] as const).map((mode, index) => ({
        id: `reserved-${mode}`,
        trigger: { hook: `reserved:${mode}`, mode, player: 'self', armedTurn: 1 },
        effect: { kind: 'atom' as const, verb: 'noop' as const, args: {} },
        source: { player: 'self' as const, cardId: `RESERVED-${index}` },
      }));
      s.players.self.partner.turnEffects = { apMod_contact: 2, granted_action: true };
      s.turnState.self.hiramekiSuppressed = true;
      startCausalSession(s, 'terminal-scopes');

      gameResult.set(s, 'opp', 'deck-out');

      expect(s.actionContexts).toEqual({});
      expect(s.players.opp.remove).toEqual(['HELD-HIRAMEKI']);
      expect(s.indexedZoneEpochs?.opp.remove).toBe(1);
      expect(s.pendingRuntimeState).toBeUndefined();
      expect(s.pendingTurnTransition).toBeUndefined();
      expect(s.pendingReasoningContinuation).toBeUndefined();
      expect(s.pendingEffects.map(entry => entry.state)).toEqual(['cancelled', 'cancelled']);
      expect(s.reservedEffects).toEqual([]);
      expect(s.players.self.partner.turnEffects).toEqual({});
      expect(s.turnState.self.hiramekiSuppressed).toBe(false);
      expect(s.log.at(-1)).toMatchObject({ kind: 'game-result', actor: 'opp' });
    });
  });

  describe('clear', () => {
    it('ゲーム結果をクリアする', () => {
      const s = {
        ...createEmptyGameState(),
        gameResult: { winner: 'self' as const, reason: 'evidence' as const },
      };
      const result = produce(s, draft => {
        gameResult.clear(draft);
      });
      expect(result.gameResult).toBeUndefined();
    });
  });
});
