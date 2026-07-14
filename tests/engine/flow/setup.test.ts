// Phase 4 Task 4.1 — engine.flow.setup
// rules: 02-deck-construction.md, 04-game-setup.md, 01-victory-conditions.md
// spec: .claude/specs/engine-api-flow-setup.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { setup, type Deck, type DeckPair } from '@/engine/flow/setup';
import type { GameState } from '@/engine/types';
import { register as registerCardDef } from '@/engine/read/def';
import { B09100 } from '@/cards/ct-p09/B09100';

function makeMainDeck(prefix: string): string[] {
  // 40枚 (rules/02). 3枚x13セット + 1枚 = 40. すべて 3 枚以下になるよう構成。
  const out: string[] = [];
  for (let i = 0; i < 13; i++) {
    out.push(`${prefix}-c${i}`);
    out.push(`${prefix}-c${i}`);
    out.push(`${prefix}-c${i}`);
  }
  out.push(`${prefix}-c14`); // 1枚
  return out;
}

function makeDecks(): DeckPair {
  return {
    self: {
      partnerId: 'P-SELF',
      caseId: 'CASE-SELF',
      mainCards: makeMainDeck('s'),
    },
    opp: {
      partnerId: 'P-OPP',
      caseId: 'CASE-OPP',
      mainCards: makeMainDeck('o'),
    },
  };
}

describe('engine.flow.setup', () => {
  describe('init', () => {
    it('両プレイヤーのパートナー/事件/デッキを配置する', () => {
      const initial = createEmptyGameState();
      const decks = makeDecks();
      const after: GameState = produce(initial, draft => {
        setup.init(draft, decks);
      });
      expect(after.players.self.partner.cardId).toBe('P-SELF');
      expect(after.players.self.partner.state).toBe('active');
      expect(after.players.self.partner.location).toBe('partner-area');
      expect(after.players.self.case.cardId).toBe('CASE-SELF');
      expect(after.players.self.case.status).toBe('事件編');
      expect(after.players.self.deck).toHaveLength(40);
      expect(after.players.opp.deck).toHaveLength(40);
    });

    it('デッキ 39 枚なら throw する (rules/02)', () => {
      const decks = makeDecks();
      decks.self.mainCards = decks.self.mainCards.slice(0, 39);
      expect(() =>
        produce(createEmptyGameState(), draft => {
          setup.init(draft, decks);
        }),
      ).toThrow(/main deck size/);
    });

    it('デッキ 41 枚なら throw する (rules/02)', () => {
      const decks = makeDecks();
      decks.self.mainCards.push('extra');
      expect(() =>
        produce(createEmptyGameState(), draft => {
          setup.init(draft, decks);
        }),
      ).toThrow(/main deck size/);
    });

    it('同IDカードが 4 枚以上なら throw する (rules/02)', () => {
      const decks = makeDecks();
      // c0 を 1 枚 → c10 に上書き ⇒ c10 が 4 枚
      decks.self.mainCards[0] = 's-c10';
      expect(() =>
        produce(createEmptyGameState(), draft => {
          setup.init(draft, decks);
        }),
      ).toThrow(/copies of/);
    });

    it('allows B09100 above the normal copy limit', () => {
      registerCardDef(B09100);
      const decks = makeDecks();
      decks.self.mainCards = Array(40).fill('B09100');
      expect(() => produce(createEmptyGameState(), draft => {
        setup.init(draft, decks);
      })).not.toThrow();
    });

    it('partnerId が空なら throw する', () => {
      const decks = makeDecks();
      decks.self.partnerId = '';
      expect(() =>
        produce(createEmptyGameState(), draft => {
          setup.init(draft, decks);
        }),
      ).toThrow(/partnerId missing/);
    });

    it('caseId が空なら throw する', () => {
      const decks = makeDecks();
      decks.self.caseId = '';
      expect(() =>
        produce(createEmptyGameState(), draft => {
          setup.init(draft, decks);
        }),
      ).toThrow(/caseId missing/);
    });
  });

  describe('decideFirstPlayer', () => {
    it("'manual' で指定された chosen を先攻にする", () => {
      const initial = createEmptyGameState();
      let first: 'self' | 'opp' = 'self';
      const after = produce(initial, draft => {
        first = setup.decideFirstPlayer(draft, 'manual', 'opp');
      });
      expect(first).toBe('opp');
      expect(after.turn.player).toBe('opp');
      expect(after.turn.number).toBe(1);
      expect(after.turn.phase).toBe('auto');
      expect(after.turn.isFirstPlayerFirstTurn).toBe(true);
    });

    it("'manual' で chosen 未指定なら throw する", () => {
      expect(() =>
        produce(createEmptyGameState(), draft => {
          setup.decideFirstPlayer(draft, 'manual');
        }),
      ).toThrow(/chosen required/);
    });

    it('先攻 7 / 後攻 6 で requiredEvidence を設定する (rules/01)', () => {
      const after = produce(createEmptyGameState(), draft => {
        setup.decideFirstPlayer(draft, 'manual', 'self');
      });
      expect(after.players.self.case.requiredEvidence).toBe(7);
      expect(after.players.opp.case.requiredEvidence).toBe(6);
    });

    it('後攻=self の場合 self=6, opp=7', () => {
      const after = produce(createEmptyGameState(), draft => {
        setup.decideFirstPlayer(draft, 'manual', 'opp');
      });
      expect(after.players.self.case.requiredEvidence).toBe(6);
      expect(after.players.opp.case.requiredEvidence).toBe(7);
    });

    it("'random' で 'self' か 'opp' を返す", () => {
      let first: 'self' | 'opp' = 'self';
      produce(createEmptyGameState(), draft => {
        first = setup.decideFirstPlayer(draft, 'random');
      });
      expect(['self', 'opp']).toContain(first);
    });

    it("rng=()=>0.1 (< 0.5) → 'self' (seeded determinism)", () => {
      let first: 'self' | 'opp' = 'opp';
      produce(createEmptyGameState(), draft => {
        first = setup.decideFirstPlayer(draft, 'random', undefined, () => 0.1);
      });
      expect(first).toBe('self');
    });

    it("rng=()=>0.9 (>= 0.5) → 'opp' (seeded determinism)", () => {
      let first: 'self' | 'opp' = 'self';
      produce(createEmptyGameState(), draft => {
        first = setup.decideFirstPlayer(draft, 'random', undefined, () => 0.9);
      });
      expect(first).toBe('opp');
    });
  });

  describe('dealOpeningHand', () => {
    it('デッキから 5 枚を手札に加える', () => {
      const decks = makeDecks();
      const after = produce(createEmptyGameState(), draft => {
        setup.init(draft, decks);
        setup.dealOpeningHand(draft, 'self');
      });
      expect(after.players.self.hand).toHaveLength(5);
      expect(after.players.self.deck).toHaveLength(35);
    });

    it('戻り値は引いたカード ID 配列', () => {
      const decks = makeDecks();
      let drawn: string[] = [];
      produce(createEmptyGameState(), draft => {
        setup.init(draft, decks);
        drawn = setup.dealOpeningHand(draft, 'self');
      });
      expect(drawn).toHaveLength(5);
    });
  });

  describe('canMulligan / mulligan', () => {
    it('初期状態では canMulligan=true', () => {
      const s = createEmptyGameState();
      expect(setup.canMulligan(s, 'self')).toBe(true);
    });

    it('1 回マリガン後 canMulligan=false', () => {
      const decks = makeDecks();
      const after = produce(createEmptyGameState(), draft => {
        setup.init(draft, decks);
        setup.dealOpeningHand(draft, 'self');
        const hand = draft.players.self.hand.slice();
        setup.mulligan(draft, 'self', [hand[0]]);
      });
      expect(setup.canMulligan(after, 'self')).toBe(false);
    });

    it('2 回目のマリガン試行で throw する', () => {
      const decks = makeDecks();
      expect(() =>
        produce(createEmptyGameState(), draft => {
          setup.init(draft, decks);
          setup.dealOpeningHand(draft, 'self');
          const hand0 = draft.players.self.hand.slice();
          setup.mulligan(draft, 'self', [hand0[0]]);
          // 2 回目: 失敗
          const hand1 = draft.players.self.hand.slice();
          setup.mulligan(draft, 'self', [hand1[0]]);
        }),
      ).toThrow(/already used/);
    });

    it('idsToReturn が空でも mulliganUsed=true になる', () => {
      const decks = makeDecks();
      const after = produce(createEmptyGameState(), draft => {
        setup.init(draft, decks);
        setup.dealOpeningHand(draft, 'self');
        setup.mulligan(draft, 'self', []);
      });
      expect(after.players.self.mulliganUsed).toBe(true);
      expect(after.players.self.hand).toHaveLength(5);
    });

    it('手札 5 枚すべて戻して 5 枚引き直す', () => {
      const decks = makeDecks();
      let drawn: string[] = [];
      const after = produce(createEmptyGameState(), draft => {
        setup.init(draft, decks);
        setup.dealOpeningHand(draft, 'self');
        const hand0 = draft.players.self.hand.slice();
        drawn = setup.mulligan(draft, 'self', hand0);
      });
      expect(drawn).toHaveLength(5);
      expect(after.players.self.hand).toHaveLength(5);
      expect(after.players.self.deck).toHaveLength(35);
    });

    it('手札にない ID を渡したら throw する', () => {
      const decks = makeDecks();
      expect(() =>
        produce(createEmptyGameState(), draft => {
          setup.init(draft, decks);
          setup.dealOpeningHand(draft, 'self');
          setup.mulligan(draft, 'self', ['nonexistent-card']);
        }),
      ).toThrow(/not in self hand/);
    });
  });

  describe('reveal / startGame', () => {
    it('reveal はログを追加する', () => {
      const after = produce(createEmptyGameState(), draft => {
        setup.reveal(draft);
      });
      expect(after.log.length).toBeGreaterThan(0);
      expect(after.log[after.log.length - 1].action).toBe('setup.reveal');
    });

    it('startGame は "Game Start!" ログを追加する', () => {
      const after = produce(createEmptyGameState(), draft => {
        setup.startGame(draft);
      });
      const last = after.log[after.log.length - 1];
      expect(last.action).toBe('setup.startGame');
      expect(last.result).toBe('Game Start!');
    });
  });

  describe('integration: 完全な setup シーケンス', () => {
    beforeEach(() => {
      // No side effects to reset for setup
    });

    it('init → decideFirstPlayer → dealOpeningHand 両者 → mulligan → reveal → startGame', () => {
      const decks = makeDecks();
      const after = produce(createEmptyGameState(), draft => {
        setup.init(draft, decks);
        setup.decideFirstPlayer(draft, 'manual', 'self');
        setup.dealOpeningHand(draft, 'self');
        setup.dealOpeningHand(draft, 'opp');
        setup.mulligan(draft, 'self', []);
        setup.mulligan(draft, 'opp', []);
        setup.reveal(draft);
        setup.startGame(draft);
      });
      expect(after.turn.player).toBe('self');
      expect(after.players.self.case.requiredEvidence).toBe(7);
      expect(after.players.opp.case.requiredEvidence).toBe(6);
      expect(after.players.self.hand).toHaveLength(5);
      expect(after.players.opp.hand).toHaveLength(5);
      expect(after.players.self.deck).toHaveLength(35);
      expect(after.players.opp.deck).toHaveLength(35);
      expect(after.players.self.mulliganUsed).toBe(true);
      expect(after.players.opp.mulliganUsed).toBe(true);
    });
  });
});

// Suppress unused import lint (Deck used in helpers)
void ({} as Deck);
