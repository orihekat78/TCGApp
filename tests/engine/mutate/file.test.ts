// rules: 05-turn-phases.md, 12-next-hint.md, 13-keywords.md (アシスト)
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { file } from '@/engine/mutate/file';
import type { GameState } from '@/engine/types';

function makeState(selfOverrides?: Partial<GameState['players']['self']>): GameState {
  const s = createEmptyGameState();
  if (!selfOverrides) return s;
  return {
    ...s,
    players: {
      self: { ...s.players.self, ...selfOverrides },
      opp: s.players.opp,
    },
  };
}

describe('engine.mutate.file', () => {
  describe('addFromDeckTop', () => {
    it('デッキ上から n 枚を裏向きで FILE に push する (rules/05)', () => {
      const s = makeState({ deck: ['C001', 'C002', 'C003'] });
      const result = produce(s, draft => {
        file.addFromDeckTop(draft, 'self', 2);
      });
      expect(result.players.self.file).toHaveLength(2);
      // Round 3: FileCard.card-back に cardId 保持 (ネクストヒント時に表向きで手札に渡すため)
      expect(result.players.self.file[0]).toEqual({ type: 'card-back', cardId: 'C001' });
      expect(result.players.self.file[1]).toEqual({ type: 'card-back', cardId: 'C002' });
      expect(result.players.self.deck).toEqual(['C003']);
    });

    it('先攻初手は n=1 (呼出元が判定)', () => {
      const s = makeState({ deck: ['C001', 'C002'] });
      const result = produce(s, draft => {
        file.addFromDeckTop(draft, 'self', 1);
      });
      expect(result.players.self.file).toHaveLength(1);
      expect(result.players.self.deck).toEqual(['C002']);
    });

    it('デッキが空の場合は追加しない', () => {
      const s = makeState({ deck: [] });
      const result = produce(s, draft => {
        file.addFromDeckTop(draft, 'self', 2);
      });
      expect(result.players.self.file).toHaveLength(0);
    });

    it('カードには順番がある: 最新が末尾 (上端)', () => {
      const s = makeState({ deck: ['C001', 'C002'] });
      const result = produce(s, draft => {
        file.addFromDeckTop(draft, 'self', 2);
      });
      // push した順 = 配列の順。C001 が先に取られて最初に push
      expect(result.players.self.file).toHaveLength(2);
    });
  });

  describe('popTop', () => {
    it('FILEエリア最上部のカードを返す (rules/12 ネクストヒント)', () => {
      const s = makeState({
        file: [{ type: 'card-back' }, { type: 'card-back' }],
      });
      let popped: ReturnType<typeof file.popTop>;
      const result = produce(s, draft => {
        popped = file.popTop(draft, 'self');
      });
      expect(result.players.self.file).toHaveLength(1);
      expect(popped).toEqual({ type: 'card-back' });
    });

    it('アシストしているパートナーを除外して最上部を返す (rules/12)', () => {
      const s = makeState({
        file: [
          { type: 'card-back' },
          { type: 'assisted-partner', cardId: 'P001' },
        ],
      });
      let popped: ReturnType<typeof file.popTop>;
      const result = produce(s, draft => {
        popped = file.popTop(draft, 'self');
      });
      // assisted-partner は除外されて card-back が返る
      expect(popped!.type).toBe('card-back');
      // FILE には assisted-partner のみ残る
      expect(result.players.self.file).toHaveLength(1);
      expect(result.players.self.file[0]).toEqual({ type: 'assisted-partner', cardId: 'P001' });
    });

    it('FILEが空の場合は undefined を返す', () => {
      const s = makeState({ file: [] });
      let popped: ReturnType<typeof file.popTop>;
      produce(s, draft => {
        popped = file.popTop(draft, 'self');
      });
      expect(popped!).toBeUndefined();
    });

    it('assisted-partner のみの場合は undefined を返す', () => {
      const s = makeState({
        file: [{ type: 'assisted-partner', cardId: 'P001' }],
      });
      let popped: ReturnType<typeof file.popTop>;
      produce(s, draft => {
        popped = file.popTop(draft, 'self');
      });
      expect(popped!).toBeUndefined();
    });
  });

  describe('insertAssistedPartner', () => {
    it('アシスト時にパートナーを FILE に追加する (rules/13 アシスト)', () => {
      const s = makeState({ partner: { cardId: 'P001', state: 'active', location: 'partner-area' } });
      const result = produce(s, draft => {
        file.insertAssistedPartner(draft, 'self');
      });
      const assistedEntry = result.players.self.file.find(f => f.type === 'assisted-partner');
      expect(assistedEntry).toBeDefined();
      expect(assistedEntry).toEqual({ type: 'assisted-partner', cardId: 'P001' });
    });
  });

  describe('removeAssistedPartner', () => {
    it('オートフェイズ時に assisted-partner を FILE から取り除く', () => {
      const s = makeState({
        file: [
          { type: 'card-back' },
          { type: 'assisted-partner', cardId: 'P001' },
        ],
      });
      const result = produce(s, draft => {
        file.removeAssistedPartner(draft, 'self');
      });
      expect(result.players.self.file).toHaveLength(1);
      expect(result.players.self.file[0]).toEqual({ type: 'card-back' });
    });

    it('assisted-partner がいない場合は no-op', () => {
      const s = makeState({
        file: [{ type: 'card-back' }],
      });
      const result = produce(s, draft => {
        file.removeAssistedPartner(draft, 'self');
      });
      expect(result.players.self.file).toHaveLength(1);
    });
  });

  // user_request 20260522_01 #4/#16 fix
  describe('addFromDeckTop — FILE 7+ で 解決編 自動遷移 (rules/01 + rules/13 + rules/25)', () => {
    it('FILE 5 → addFromDeckTop(2) で 7 到達 → 事件編→解決編', () => {
      const s = makeState({
        deck: ['C001', 'C002'],
        file: Array.from({ length: 5 }, () => ({ type: 'card-back' as const })),
        case: { cardId: 'CASE', status: '事件編' as const, requiredEvidence: 7, colors: [], declaredUseCount: {} },
      });
      const result = produce(s, draft => {
        file.addFromDeckTop(draft, 'self', 2);
      });
      expect(result.players.self.file).toHaveLength(7);
      expect(result.players.self.case.status).toBe('解決編');
    });

    it('FILE 5 → addFromDeckTop(1) で 6 のみ → 事件編 維持', () => {
      const s = makeState({
        deck: ['C001'],
        file: Array.from({ length: 5 }, () => ({ type: 'card-back' as const })),
        case: { cardId: 'CASE', status: '事件編' as const, requiredEvidence: 7, colors: [], declaredUseCount: {} },
      });
      const result = produce(s, draft => {
        file.addFromDeckTop(draft, 'self', 1);
      });
      expect(result.players.self.file).toHaveLength(6);
      expect(result.players.self.case.status).toBe('事件編');
    });

    it('解決編 既に到達済なら変化なし', () => {
      const s = makeState({
        deck: ['C001'],
        file: Array.from({ length: 8 }, () => ({ type: 'card-back' as const })),
        case: { cardId: 'CASE', status: '解決編' as const, requiredEvidence: 7, colors: [], declaredUseCount: {} },
      });
      const result = produce(s, draft => {
        file.addFromDeckTop(draft, 'self', 1);
      });
      expect(result.players.self.case.status).toBe('解決編');
    });
  });
});
