// engine.effect.runAtom — Atom Verb dispatcher tests
// spec: .claude/specs/engine-api-effect-descriptor.md
// rules: 15-abilities-effects.md and others (see each verb)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAtom } from '@/engine/effect/atom-handlers';
import { event } from '@/engine/event/index';
import type { EffectCtx } from '@/engine/types';
import type { GameState, SceneCharacter, Candidate } from '@/engine/types';

function makeCtx(overrides: Partial<EffectCtx> = {}): EffectCtx {
  return {
    source: { player: 'self', area: 'scene' },
    bindings: {},
    ...overrides,
  };
}

function makeChar(overrides: Partial<SceneCharacter> = {}): SceneCharacter {
  return {
    cardId: 'C001',
    uid: 'uid-1',
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
    ...overrides,
  };
}

function withScene(s: GameState, p: 'self' | 'opp', chars: SceneCharacter[]): GameState {
  return {
    ...s,
    players: {
      ...s.players,
      [p]: { ...s.players[p], scene: chars },
    },
  };
}

describe('engine.effect.runAtom', () => {
  // --- ドロー / FILE / 証拠 ---
  describe('draw', () => {
    it('デッキ上から n 枚を手札に加える', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'C'] } } };
      const result = produce(s, draft => {
        runAtom(draft, 'draw', { player: 'self', n: 2 }, makeCtx());
      });
      expect(result.players.self.hand).toEqual(['A', 'B']);
      expect(result.players.self.deck).toEqual(['C']);
    });
  });

  describe('discard', () => {
    it('手札の指定カードをリムーブエリアへ移動', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, hand: ['X', 'Y', 'Z'] } } };
      const result = produce(s, draft => {
        runAtom(draft, 'discard', { player: 'self', target: ['Y'] }, makeCtx());
      });
      expect(result.players.self.hand).toEqual(['X', 'Z']);
      expect(result.players.self.remove).toEqual(['Y']);
    });
  });

  describe('mill', () => {
    it('デッキ上から n 枚をリムーブエリアへ', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'C'] } } };
      const result = produce(s, draft => {
        runAtom(draft, 'mill', { player: 'self', n: 2 }, makeCtx());
      });
      expect(result.players.self.remove).toEqual(['A', 'B']);
      expect(result.players.self.deck).toEqual(['C']);
    });
  });

  describe('fileAdd', () => {
    it('デッキ上から n 枚を FILE に裏向きで追加', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'C'] } } };
      const result = produce(s, draft => {
        runAtom(draft, 'fileAdd', { player: 'self', n: 2 }, makeCtx());
      });
      expect(result.players.self.file).toHaveLength(2);
      expect(result.players.self.deck).toEqual(['C']);
    });
  });

  describe('filePopToHand', () => {
    it('FILE 最上部 (card-back) を pop し手札に "card-back" として加える', () => {
      let s = createEmptyGameState();
      s = {
        ...s,
        players: {
          ...s.players,
          self: { ...s.players.self, file: [{ type: 'card-back' }, { type: 'card-back' }] },
        },
      };
      const result = produce(s, draft => {
        runAtom(draft, 'filePopToHand', { player: 'self' }, makeCtx());
      });
      expect(result.players.self.file).toHaveLength(1);
      // card-back カードは手札に 'card-back' 文字列として加えられる
      expect(result.players.self.hand[0]).toBe('card-back');
    });
  });

  describe('evidenceGain', () => {
    it('デッキから n 枚を証拠エリアに追加', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['E1', 'E2'] } } };
      const result = produce(s, draft => {
        runAtom(draft, 'evidenceGain', { player: 'self', n: 2 }, makeCtx());
      });
      expect(result.players.self.evidence).toHaveLength(2);
      expect(result.players.self.deck).toEqual([]);
    });
  });

  describe('evidenceLose', () => {
    it('証拠上から n 枚を removeTop でリムーブ', () => {
      let s = createEmptyGameState();
      s = {
        ...s,
        players: {
          ...s.players,
          self: {
            ...s.players.self,
            evidence: [
              { cardId: 'E1', faceUp: false, origin: { turn: 1, via: 'opening' } },
              { cardId: 'E2', faceUp: false, origin: { turn: 1, via: 'opening' } },
            ],
          },
        },
      };
      const result = produce(s, draft => {
        runAtom(draft, 'evidenceLose', { player: 'self', n: 2 }, makeCtx());
      });
      expect(result.players.self.evidence).toHaveLength(0);
      expect(result.players.self.remove).toHaveLength(2);
    });
  });

  describe('evidenceFlip', () => {
    it('指定 idx の証拠を表向きにする', () => {
      let s = createEmptyGameState();
      s = {
        ...s,
        players: {
          ...s.players,
          self: {
            ...s.players.self,
            evidence: [{ cardId: 'E1', faceUp: false, origin: { turn: 1, via: 'opening' } }],
          },
        },
      };
      const result = produce(s, draft => {
        runAtom(draft, 'evidenceFlip', { player: 'self', idx: 0 }, makeCtx());
      });
      expect(result.players.self.evidence[0].faceUp).toBe(true);
    });
  });

  describe('evidenceToHand', () => {
    it('自証拠1枚をリムーブし対応する cardId を手札へ', () => {
      let s = createEmptyGameState();
      s = {
        ...s,
        players: {
          ...s.players,
          self: {
            ...s.players.self,
            evidence: [{ cardId: 'D08013', faceUp: true, origin: { turn: 1, via: 'opening' } }],
          },
        },
      };
      const result = produce(s, draft => {
        runAtom(draft, 'evidenceToHand', { player: 'self', target: 'D08013' }, makeCtx());
      });
      expect(result.players.self.evidence).toHaveLength(0);
      expect(result.players.self.hand).toContain('D08013');
    });
  });

  describe('handAddFromRemove', () => {
    it('リムーブから指定 cardId を手札に追加', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, remove: ['D11012', 'X'] } } };
      const result = produce(s, draft => {
        runAtom(draft, 'handAddFromRemove', { player: 'self', target: 'D11012' }, makeCtx());
      });
      expect(result.players.self.hand).toContain('D11012');
      expect(result.players.self.remove).toEqual(['X']);
    });
  });

  // --- 現場 ---
  describe('sceneEnter', () => {
    beforeEach(() => {
      event._resetRegistry();
    });

    it('現場にキャラを登場させる', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        runAtom(draft, 'sceneEnter', { player: 'self', cardId: 'C100' }, makeCtx());
      });
      expect(result.players.self.scene).toHaveLength(1);
      expect(result.players.self.scene[0].cardId).toBe('C100');
    });

    it('enter Hook を emit する (viaEffect デフォルト true)', () => {
      const listener = vi.fn();
      event.on('enter', listener);
      const s = createEmptyGameState();
      produce(s, draft => {
        runAtom(draft, 'sceneEnter', { player: 'self', cardId: 'X1' }, makeCtx());
      });
      expect(listener).toHaveBeenCalledOnce();
      const payload = listener.mock.calls[0][1] as { uid: string; viaEffect: boolean; enterOrder: number };
      expect(payload).toMatchObject({ viaEffect: true, enterOrder: 1 });
      expect(payload.uid).toMatch(/^X1#\d+$/);
    });

    it('args.viaEffect=false が emit に反映される', () => {
      const listener = vi.fn();
      event.on('enter', listener);
      const s = createEmptyGameState();
      produce(s, draft => {
        runAtom(draft, 'sceneEnter', { player: 'self', cardId: 'X2', viaEffect: false }, makeCtx());
      });
      const payload = listener.mock.calls[0][1] as { viaEffect: boolean };
      expect(payload.viaEffect).toBe(false);
    });
  });

  describe('sceneSwitch', () => {
    beforeEach(() => {
      event._resetRegistry();
    });

    it('既存キャラをリムーブして新キャラ登場 (スイッチ)', () => {
      const c = makeChar({ uid: 'old-uid', cardId: 'OLD' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'sceneSwitch', { player: 'self', cardId: 'NEW', removeUid: 'old-uid' }, makeCtx());
      });
      expect(result.players.self.scene).toHaveLength(1);
      expect(result.players.self.scene[0].cardId).toBe('NEW');
      expect(result.players.self.remove).toContain('OLD');
    });

    it('スイッチ登場でも enter Hook を emit する (rules/17)', () => {
      const listener = vi.fn();
      event.on('enter', listener);
      const c = makeChar({ uid: 'old-uid', cardId: 'OLD' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      produce(s, draft => {
        runAtom(draft, 'sceneSwitch', { player: 'self', cardId: 'NEW', removeUid: 'old-uid' }, makeCtx());
      });
      expect(listener).toHaveBeenCalledOnce();
      const payload = listener.mock.calls[0][1] as { uid: string; viaEffect: boolean };
      expect(payload).toMatchObject({ viaEffect: true });
      expect(payload.uid).toMatch(/^NEW#\d+$/);
    });
  });

  describe('sceneRemove', () => {
    it('指定 uid のキャラをリムーブ', () => {
      const c = makeChar({ uid: 'rm-uid', cardId: 'C200' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'sceneRemove', { uid: 'rm-uid', cause: 'effect' }, makeCtx());
      });
      expect(result.players.self.scene).toHaveLength(0);
      expect(result.players.self.remove).toContain('C200');
    });
  });

  describe('sceneSetState', () => {
    it('キャラの状態を sleep にする', () => {
      const c = makeChar({ uid: 'st-uid', state: 'active' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'sceneSetState', { uid: 'st-uid', state: 'sleep' }, makeCtx());
      });
      expect(result.players.self.scene[0].state).toBe('sleep');
    });
  });

  describe('sceneDisguise', () => {
    it('cardId を新キャラに変更', () => {
      const c = makeChar({ uid: 'dg-uid', cardId: 'OLD' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'sceneDisguise', { uid: 'dg-uid', newCardId: 'NEW' }, makeCtx());
      });
      expect(result.players.self.scene[0].cardId).toBe('NEW');
    });
  });

  // --- キャラ修正 ---
  describe('charModifyAP', () => {
    it('AP modifier を turnEffects に積む', () => {
      const c = makeChar({ uid: 'ap-uid' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charModifyAP', { uid: 'ap-uid', delta: 1000, scope: 'turn' }, makeCtx());
      });
      expect(result.players.self.scene[0].turnEffects['apMod_turn']).toBe(1000);
    });
  });

  describe('charModifyLP', () => {
    it('LP modifier を turnEffects に積む', () => {
      const c = makeChar({ uid: 'lp-uid' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charModifyLP', { uid: 'lp-uid', delta: -500, scope: 'turn' }, makeCtx());
      });
      expect(result.players.self.scene[0].turnEffects['lpMod_turn']).toBe(-500);
    });
  });

  describe('charSetAP', () => {
    it('Phase 5 未実装のため Error を投げる', () => {
      const c = makeChar({ uid: 'sap-uid' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      expect(() => {
        produce(s, draft => {
          runAtom(draft, 'charSetAP', { uid: 'sap-uid', val: 3000 }, makeCtx());
        });
      }).toThrow(/charSetAP: not yet supported/);
    });
  });

  describe('charSetLP', () => {
    it('Phase 5 未実装のため Error を投げる', () => {
      const c = makeChar({ uid: 'slp-uid' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      expect(() => {
        produce(s, draft => {
          runAtom(draft, 'charSetLP', { uid: 'slp-uid', val: 2 }, makeCtx());
        });
      }).toThrow(/charSetLP: not yet supported/);
    });
  });

  describe('charOverrideAP', () => {
    it('apOverride を 0 に設定 (元のAP無効化)', () => {
      const c = makeChar({ uid: 'oap-uid' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charOverrideAP', { uid: 'oap-uid', val: 0 }, makeCtx());
      });
      expect(result.players.self.scene[0].apOverride).toBe(0);
    });
    it('null を渡せばクリア', () => {
      const c = makeChar({ uid: 'oap-uid', apOverride: 1000 });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charOverrideAP', { uid: 'oap-uid', val: null }, makeCtx());
      });
      expect(result.players.self.scene[0].apOverride).toBe(null);
    });
  });

  describe('charOverrideLP', () => {
    it('lpOverride を 0 に設定', () => {
      const c = makeChar({ uid: 'olp-uid' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charOverrideLP', { uid: 'olp-uid', val: 0 }, makeCtx());
      });
      expect(result.players.self.scene[0].lpOverride).toBe(0);
    });
  });

  describe('charGrantKeyword', () => {
    it('指定キーワードを permanent で付与', () => {
      const c = makeChar({ uid: 'kw-uid' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charGrantKeyword', { uid: 'kw-uid', kw: '迅速', scope: 'permanent' }, makeCtx());
      });
      expect(result.players.self.scene[0].keywordOverrides.granted).toContain('迅速');
    });
  });

  describe('charRevokeKeyword', () => {
    it('granted キーワードから削除', () => {
      const c = makeChar({ uid: 'rk-uid', keywordOverrides: { granted: ['迅速'], disabledOriginal: false } });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charRevokeKeyword', { uid: 'rk-uid', kw: '迅速' }, makeCtx());
      });
      expect(result.players.self.scene[0].keywordOverrides.granted).not.toContain('迅速');
    });
  });

  describe('charDisableOriginal', () => {
    it('元の能力を無効化', () => {
      const c = makeChar({ uid: 'do-uid' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charDisableOriginal', { uid: 'do-uid' }, makeCtx());
      });
      expect(result.players.self.scene[0].keywordOverrides.disabledOriginal).toBe(true);
    });
  });

  describe('charSetTurnEffect', () => {
    it('任意の turnEffect key を設定', () => {
      const c = makeChar({ uid: 'te-uid' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charSetTurnEffect', { uid: 'te-uid', key: 'contactImmune', val: true }, makeCtx());
      });
      expect(result.players.self.scene[0].turnEffects['contactImmune']).toBe(true);
    });
  });

  describe('charSetCard', () => {
    it('キャラにカードをセット', () => {
      const c = makeChar({ uid: 'sc-uid' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charSetCard', { uid: 'sc-uid', cardId: 'ITEM', faceUp: true }, makeCtx());
      });
      expect(result.players.self.scene[0].setCards).toEqual([{ cardId: 'ITEM', faceUp: true }]);
    });
  });

  describe('charStackCard', () => {
    it('stackedCards に枚数を加算', () => {
      const c = makeChar({ uid: 'sk-uid', stackedCards: 1 });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charStackCard', { uid: 'sk-uid', n: 2 }, makeCtx());
      });
      expect(result.players.self.scene[0].stackedCards).toBe(3);
    });
  });

  // --- パートナー / 事件 ---
  describe('partnerAssist', () => {
    it('パートナーをアシスト (sleep + FILE)', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, partner: { cardId: 'P001', state: 'active', location: 'partner-area' } } } };
      const result = produce(s, draft => {
        runAtom(draft, 'partnerAssist', { player: 'self' }, makeCtx());
      });
      expect(result.players.self.partner.state).toBe('sleep');
      expect(result.players.self.partner.location).toBe('file-area');
      expect(result.players.self.file).toHaveLength(1);
      expect(result.turnState.self.assistedThisTurn).toBe(true);
    });
  });

  describe('partnerSetState', () => {
    it('パートナーの状態を設定', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, partner: { cardId: 'P001', state: 'active', location: 'partner-area' } } } };
      const result = produce(s, draft => {
        runAtom(draft, 'partnerSetState', { player: 'self', state: 'sleep' }, makeCtx());
      });
      expect(result.players.self.partner.state).toBe('sleep');
    });
  });

  describe('partnerSolveCase', () => {
    it('事件解決でゲーム勝利', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, partner: { cardId: 'P001', state: 'active', location: 'partner-area' } } } };
      const result = produce(s, draft => {
        runAtom(draft, 'partnerSolveCase', { player: 'self' }, makeCtx());
      });
      expect(result.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
    });
  });

  describe('caseToResolved', () => {
    it('事件編→解決編に移行', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        runAtom(draft, 'caseToResolved', { player: 'self' }, makeCtx());
      });
      expect(result.players.self.case.status).toBe('解決編');
    });
  });

  // --- フロー (Phase 3 では noop+log) ---
  describe('startContact', () => {
    it('Phase 3: noop + log のみ', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        runAtom(draft, 'startContact', { aUid: 'A', bUid: 'B' }, makeCtx());
      });
      expect(result.log.length).toBeGreaterThan(0);
    });
  });

  describe('endActionEarly', () => {
    it('Phase 3: noop + log のみ', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        runAtom(draft, 'endActionEarly', {}, makeCtx());
      });
      expect(result.log.length).toBeGreaterThan(0);
    });
  });

  // --- デッキ操作 (新規 G18/G22) ---
  describe('deckRevealUntil', () => {
    it('filter にマッチするカードを bindings[bindMatch] に、その手前を bindings[bind] に格納', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'TARGET', 'C'] } } };
      const ctx = makeCtx();
      produce(s, draft => {
        runAtom(
          draft,
          'deckRevealUntil',
          {
            player: 'self',
            filter: (id: string) => id === 'TARGET',
            bind: 'revealed',
            bindMatch: 'matched',
          },
          ctx,
        );
      });
      // bindMatch には TARGET のみ (kind:'card', cardId:'TARGET')
      expect(ctx.bindings['matched']).toHaveLength(1);
      expect((ctx.bindings['matched'][0] as { cardId: string }).cardId).toBe('TARGET');
      // bind には TARGET 手前の A, B
      expect(ctx.bindings['revealed']).toHaveLength(2);
      const revealedIds = (ctx.bindings['revealed'] as Array<{ cardId: string }>).map(c => c.cardId);
      expect(revealedIds).toEqual(['A', 'B']);
    });

    it('filter にマッチしない場合: bindMatch は空、bind は全公開カード', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B'] } } };
      const ctx = makeCtx();
      produce(s, draft => {
        runAtom(draft, 'deckRevealUntil', { player: 'self', filter: () => false, bind: 'all', bindMatch: 'hit' }, ctx);
      });
      expect(ctx.bindings['hit']).toHaveLength(0);
      expect(ctx.bindings['all']).toHaveLength(2);
    });
  });

  describe('deckToBottomBound', () => {
    it('ctx.bindings[bindKey] の cardId 群をデッキ下に移動', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['BASE'] } } };
      // Candidate の card バリアントに適合する shape — 型キャスト不要
      const cards: Candidate[] = [
        { kind: 'card', cardId: 'A', area: 'deck', player: 'self' },
        { kind: 'card', cardId: 'B', area: 'deck', player: 'self' },
      ];
      const ctx = makeCtx({ bindings: { rest: cards } });
      const result = produce(s, draft => {
        runAtom(draft, 'deckToBottomBound', { player: 'self', bindKey: 'rest' }, ctx);
      });
      expect(result.players.self.deck).toEqual(['BASE', 'A', 'B']);
    });
  });

  describe('deckShuffle', () => {
    it('デッキを RNG でシャッフル (要素は保持)', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'C', 'D', 'E'] } } };
      const ctx = makeCtx({ rng: () => 0.5 });
      const result = produce(s, draft => {
        runAtom(draft, 'deckShuffle', { player: 'self' }, ctx);
      });
      expect(result.players.self.deck).toHaveLength(5);
      expect([...result.players.self.deck].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('相手プレイヤーの deck shuffle も可', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, opp: { ...s.players.opp, deck: ['X', 'Y'] } } };
      const ctx = makeCtx({ rng: () => 0.5 });
      const result = produce(s, draft => {
        runAtom(draft, 'deckShuffle', { player: 'opp' }, ctx);
      });
      expect(result.players.opp.deck).toHaveLength(2);
    });
  });

  // --- メタ ---
  describe('log', () => {
    it('ログにエントリ追加', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        runAtom(draft, 'log', { ts: 1, player: 'self', turn: 1, action: 'test' }, makeCtx());
      });
      expect(result.log).toHaveLength(1);
      expect(result.log[0].action).toBe('test');
    });
  });

  describe('noop', () => {
    it('何もしない', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        runAtom(draft, 'noop', {}, makeCtx());
      });
      expect(result).toEqual(s);
    });
  });

  // --- defensive / arg validation ---
  describe('requireField — missing required args', () => {
    it('draw に player が無ければ明確なエラーを投げる', () => {
      const s = createEmptyGameState();
      expect(() => {
        produce(s, draft => {
          runAtom(draft, 'draw', { n: 1 }, makeCtx()); // player 欠落
        });
      }).toThrow(/atom args missing string field "player"/);
    });

    it('sceneEnter に cardId が無ければ明確なエラーを投げる', () => {
      const s = createEmptyGameState();
      expect(() => {
        produce(s, draft => {
          runAtom(draft, 'sceneEnter', { player: 'self' }, makeCtx()); // cardId 欠落
        });
      }).toThrow(/atom args missing string field "cardId"/);
    });
  });

  describe('unknown verb', () => {
    it('未知の verb はエラーを投げる', () => {
      const s = createEmptyGameState();
      expect(() => {
        produce(s, draft => {
          // @ts-expect-error 意図的に未知の verb を渡す
          runAtom(draft, 'unknownVerb', {}, makeCtx());
        });
      }).toThrow(/unknown atom verb/i);
    });
  });
});
