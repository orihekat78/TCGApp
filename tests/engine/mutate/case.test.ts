// rules: 01-victory-conditions.md, 06-card-types.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { caseOp } from '@/engine/mutate/case';
import type { GameState } from '@/engine/types';

function makeState(status: '事件編' | '解決編' = '事件編'): GameState {
  const s = createEmptyGameState();
  return {
    ...s,
    players: {
      self: {
        ...s.players.self,
        case: { cardId: 'CASE001', status, requiredEvidence: 7, colors: ['青'], declaredUseCount: {} },
      },
      opp: s.players.opp,
    },
  };
}

describe('engine.mutate.case', () => {
  describe('toResolved', () => {
    it('事件編→解決編に移行する (rules/01)', () => {
      const s = makeState('事件編');
      const result = produce(s, draft => {
        caseOp.toResolved(draft, 'self');
      });
      expect(result.players.self.case.status).toBe('解決編');
    });

    it('既に解決編なら no-op (rules/01 一方通行)', () => {
      const s = makeState('解決編');
      const result = produce(s, draft => {
        caseOp.toResolved(draft, 'self');
      });
      expect(result.players.self.case.status).toBe('解決編');
    });

    it('opp プレイヤーの事件も解決編へ移行できる', () => {
      const s = createEmptyGameState();
      const withCase = {
        ...s,
        players: {
          self: s.players.self,
          opp: {
            ...s.players.opp,
            case: { cardId: 'CASE002', status: '事件編' as const, requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} },
          },
        },
      };
      const result = produce(withCase, draft => {
        caseOp.toResolved(draft, 'opp');
      });
      expect(result.players.opp.case.status).toBe('解決編');
    });
  });
});
