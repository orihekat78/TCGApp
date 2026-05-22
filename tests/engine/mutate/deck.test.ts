// rules: 14-refresh.md, 26-qa-deck-refresh.md, 13-keywords.md (痕跡)
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { deck } from '@/engine/mutate/deck';
import type { GameState } from '@/engine/types';

function makeState(overrides: Partial<{
  selfDeck: string[];
  selfRemove: string[];
  oppEvidence: number;
  selfEvidence: number;
  selfTrace: '未発見' | '発見済';
  oppTrace: '未発見' | '発見済';
}>  = {}): GameState {
  const s = createEmptyGameState();
  const selfDeck = overrides.selfDeck ?? [];
  const selfRemove = overrides.selfRemove ?? [];
  const oppEvidenceCount = overrides.oppEvidence ?? 0;
  const selfEvidenceCount = overrides.selfEvidence ?? 0;

  const oppEvidence = Array.from({ length: oppEvidenceCount }, (_, i) => ({
    cardId: `opp-ev-${i}`,
    faceUp: false,
    origin: { turn: 1, via: 'reasoning' as const },
  }));
  const selfEvidence = Array.from({ length: selfEvidenceCount }, (_, i) => ({
    cardId: `self-ev-${i}`,
    faceUp: false,
    origin: { turn: 1, via: 'reasoning' as const },
  }));

  return {
    ...s,
    scratchTrace: {
      self: overrides.selfTrace ?? '未発見',
      opp: overrides.oppTrace ?? '未発見',
    },
    players: {
      ...s.players,
      self: {
        ...s.players.self,
        deck: selfDeck,
        remove: selfRemove,
        evidence: selfEvidence,
      },
      opp: {
        ...s.players.opp,
        evidence: oppEvidence,
      },
    },
  };
}

describe('engine.mutate.deck', () => {
  describe('draw', () => {
    it('指定枚数を手札に移動する', () => {
      const s = makeState({ selfDeck: ['c1', 'c2', 'c3', 'c4'] });
      const result = produce(s, draft => {
        const drawn = deck.draw(draft, 'self', 3);
        expect(drawn).toHaveLength(3);
        expect(drawn).toContain('c1');
        expect(drawn).toContain('c2');
        expect(drawn).toContain('c3');
      });
      expect(result.players.self.deck).toHaveLength(1);
      expect(result.players.self.hand).toHaveLength(3);
    });

    it('デッキ上から順に引く (先頭が最初に引かれる)', () => {
      const s = makeState({ selfDeck: ['first', 'second', 'third'] });
      const drawn: string[] = [];
      produce(s, draft => {
        drawn.push(...deck.draw(draft, 'self', 2));
      });
      expect(drawn[0]).toBe('first');
      expect(drawn[1]).toBe('second');
    });

    it('デッキ < n でリフレッシュ自動発火し全枚数引く (rules/14)', () => {
      const s = makeState({
        selfDeck: ['d1', 'd2'],
        selfRemove: ['r1', 'r2', 'r3'],
      });
      const result = produce(s, draft => {
        const drawn = deck.draw(draft, 'self', 5);
        // 2枚引いてリフレッシュ、その後 3枚引く
        expect(drawn).toHaveLength(5);
      });
      // 相手の evidence が +1 (リフレッシュペナルティ)
      expect(result.players.opp.evidence).toHaveLength(1);
    });

    it('デッキとリムーブ両方 0 でリフレッシュ失敗 → 引ける分だけ返す', () => {
      const s = makeState({ selfDeck: ['d1'], selfRemove: [] });
      const drawn: string[] = [];
      produce(s, draft => {
        drawn.push(...deck.draw(draft, 'self', 5));
      });
      // deck 1枚引いてリフレッシュ失敗 (remove 0枚) → 1枚のみ
      expect(drawn).toHaveLength(1);
    });

    // BUG-036 (rules/04 + rules/14): refresh 失敗で gameResult が deck-out で
    // set される。修正前は break のみで gameResult 未設定だった。
    it('リフレッシュ失敗 (remove 0 枚) → gameResult={winner:opp, reason:"deck-out"} が設定', () => {
      const s = makeState({ selfDeck: [], selfRemove: [] });
      const result = produce(s, draft => {
        deck.draw(draft, 'self', 1);
      });
      expect(result.gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
    });

    it('opp の refresh 失敗で gameResult={winner:self}', () => {
      // makeState は selfXxx を受けるため opp 側を直接編集
      const s = makeState({});
      s.players.opp.deck = [];
      s.players.opp.remove = [];
      const result = produce(s, draft => {
        deck.draw(draft, 'opp', 1);
      });
      expect(result.gameResult).toEqual({ winner: 'self', reason: 'deck-out' });
    });

    it('既に gameResult が設定済の場合は上書きしない', () => {
      const s = makeState({ selfDeck: [], selfRemove: [] });
      // 既に evidence 勝利が確定している状態を再現
      s.gameResult = { winner: 'self', reason: 'evidence' };
      const result = produce(s, draft => {
        deck.draw(draft, 'self', 1);
      });
      // deck-out で上書きされず、evidence 勝利のまま
      expect(result.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
    });

    it('n=0 で空配列を返す', () => {
      const s = makeState({ selfDeck: ['c1', 'c2'] });
      const drawn: string[] = [];
      produce(s, draft => {
        drawn.push(...deck.draw(draft, 'self', 0));
      });
      expect(drawn).toHaveLength(0);
    });

    it('opp プレイヤーからも引ける', () => {
      const s = createEmptyGameState();
      const s2 = {
        ...s,
        players: {
          ...s.players,
          opp: { ...s.players.opp, deck: ['o1', 'o2'] },
        },
      };
      const result = produce(s2, draft => {
        deck.draw(draft, 'opp', 1);
      });
      expect(result.players.opp.deck).toHaveLength(1);
      expect(result.players.opp.hand).toHaveLength(1);
    });
  });

  describe('peek', () => {
    it('上から n 枚を返すがデッキから取らない', () => {
      const s = makeState({ selfDeck: ['a', 'b', 'c'] });
      const peeked: string[] = [];
      const result = produce(s, draft => {
        peeked.push(...deck.peek(draft, 'self', 2));
      });
      expect(peeked).toEqual(['a', 'b']);
      expect(result.players.self.deck).toEqual(['a', 'b', 'c']);
    });

    it('デッキ < n でも可能な分だけ返す (リフレッシュなし)', () => {
      const s = makeState({ selfDeck: ['x', 'y'], selfRemove: ['z'] });
      const peeked: string[] = [];
      produce(s, draft => {
        peeked.push(...deck.peek(draft, 'self', 5));
      });
      expect(peeked).toHaveLength(2);
    });
  });

  describe('reveal', () => {
    it('上から n 枚を公開 (まだ deck 扱い) (rules/26)', () => {
      const s = makeState({ selfDeck: ['a', 'b', 'c'] });
      const revealed: string[] = [];
      const result = produce(s, draft => {
        revealed.push(...deck.reveal(draft, 'self', 2));
      });
      expect(revealed).toEqual(['a', 'b']);
      // デッキ枚数は変わらない (rules/26)
      expect(result.players.self.deck).toEqual(['a', 'b', 'c']);
    });
  });

  describe('toBottom', () => {
    it('指定カードをデッキ最下部に追加 (order は追加順)', () => {
      const s = makeState({ selfDeck: ['d1'] });
      const result = produce(s, draft => {
        deck.toBottom(draft, 'self', ['b1', 'b2'], 'given');
      });
      // d1 は上部に残り、b1, b2 が下に追加される
      expect(result.players.self.deck).toEqual(['d1', 'b1', 'b2']);
    });
  });

  describe('toTop', () => {
    it('指定カードをデッキ最上部に追加', () => {
      const s = makeState({ selfDeck: ['d1'] });
      const result = produce(s, draft => {
        deck.toTop(draft, 'self', ['t1', 't2'], 'given');
      });
      expect(result.players.self.deck).toEqual(['t1', 't2', 'd1']);
    });
  });

  describe('removeFromTop', () => {
    it('上から n 枚をリムーブエリアへ', () => {
      const s = makeState({ selfDeck: ['r1', 'r2', 'r3', 'r4'] });
      const result = produce(s, draft => {
        const removed = deck.removeFromTop(draft, 'self', 2);
        expect(removed).toEqual(['r1', 'r2']);
      });
      expect(result.players.self.deck).toHaveLength(2);
      expect(result.players.self.remove).toContain('r1');
      expect(result.players.self.remove).toContain('r2');
    });

    it('デッキ不足時は可能な分のみリムーブ (rules/26)', () => {
      const s = makeState({ selfDeck: ['x'] });
      const removed: string[] = [];
      const result = produce(s, draft => {
        removed.push(...deck.removeFromTop(draft, 'self', 5));
      });
      expect(removed).toHaveLength(1);
      expect(removed[0]).toBe('x');
      expect(result.players.self.deck).toHaveLength(0);
    });

    it('デッキ 0 枚は空配列を返す', () => {
      const s = makeState({ selfDeck: [] });
      const removed: string[] = [];
      produce(s, draft => {
        removed.push(...deck.removeFromTop(draft, 'self', 3));
      });
      expect(removed).toHaveLength(0);
    });
  });

  describe('shuffle', () => {
    it('デッキの枚数は変わらない', () => {
      const cards = ['a', 'b', 'c', 'd', 'e'];
      const s = makeState({ selfDeck: cards });
      const result = produce(s, draft => {
        deck.shuffle(draft, 'self');
      });
      expect(result.players.self.deck).toHaveLength(cards.length);
      expect(result.players.self.deck).toEqual(expect.arrayContaining(cards));
    });

    it('空デッキでもエラーにならない', () => {
      const s = makeState({ selfDeck: [] });
      expect(() => produce(s, draft => deck.shuffle(draft, 'self'))).not.toThrow();
    });
  });

  describe('refresh', () => {
    it('リムーブエリア→デッキシャッフル+相手 evidence+1 (rules/14)', () => {
      const s = makeState({
        selfDeck: [],
        selfRemove: ['r1', 'r2', 'r3'],
        oppEvidence: 2,
      });
      let result!: ReturnType<typeof deck.refresh>;
      const nextState = produce(s, draft => {
        result = deck.refresh(draft, 'self');
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.reshuffled).toBe(3);
        expect(result.opponentEvidenceGained).toBe(1);
      }
      expect(nextState.players.self.deck).toHaveLength(3);
      expect(nextState.players.self.remove).toHaveLength(0);
      expect(nextState.players.opp.evidence).toHaveLength(3); // 2 + 1
    });

    it('リフレッシュ後 相手 scratchTrace = 発見済 (rules/13, 26)', () => {
      const s = makeState({
        selfDeck: [],
        selfRemove: ['r1'],
        oppTrace: '未発見',
      });
      const nextState = produce(s, draft => {
        deck.refresh(draft, 'self');
      });
      // self がリフレッシュ → opp の scratchTrace が発見済
      expect(nextState.scratchTrace.opp).toBe('発見済');
    });

    it('opp がリフレッシュ → self の scratchTrace が発見済', () => {
      const s = createEmptyGameState();
      const s2 = {
        ...s,
        players: {
          ...s.players,
          opp: { ...s.players.opp, deck: [], remove: ['r1'] },
        },
      };
      const nextState = produce(s2, draft => {
        deck.refresh(draft, 'opp');
      });
      expect(nextState.scratchTrace.self).toBe('発見済');
    });

    it('リムーブエリア 0 枚で敗北 ok:false (rules/14)', () => {
      const s = makeState({
        selfDeck: [],
        selfRemove: [],
      });
      let result!: ReturnType<typeof deck.refresh>;
      produce(s, draft => {
        result = deck.refresh(draft, 'self');
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.loserPlayer).toBe('self');
        expect(result.reason).toBe('remove-empty');
      }
    });

    it('refreshCount がインクリメントされる', () => {
      const s = makeState({ selfDeck: [], selfRemove: ['r1'] });
      const result = produce(s, draft => {
        deck.refresh(draft, 'self');
      });
      expect(result.refreshCount.self).toBe(1);
    });

    it('既に 発見済 でもリフレッシュで再設定される (状態保持)', () => {
      const s = makeState({
        selfDeck: [],
        selfRemove: ['r1'],
        oppTrace: '発見済',
      });
      const nextState = produce(s, draft => {
        deck.refresh(draft, 'self');
      });
      expect(nextState.scratchTrace.opp).toBe('発見済');
    });
  });
});
