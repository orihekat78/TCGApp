// engine.effect.runAtom — Atom Verb dispatcher tests
// spec: .claude/specs/engine-api-effect-descriptor.md
// rules: 15-abilities-effects.md and others (see each verb)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAtom } from '@/engine/effect/atom-handlers';
import { deckOccurrenceAuthority } from '@/engine/effect/deck-occurrence-authority';
import { event } from '@/engine/event/index';
import { startCausalSession } from '@/engine/log/causal';
import type { GameState, SceneCharacter, Candidate } from '@/engine/types';
import { makeChar, makeCtx } from '../../helpers/fixtures';


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

    it('logs the actual draw count when deck exhaustion stops a larger request', () => {
      const state = createEmptyGameState();
      state.players.self.deck = ['ONLY'];

      const result = produce(state, draft => {
        runAtom(draft, 'draw', { player: 'self', n: 3 }, makeCtx());
      });

      expect(result.players.self.hand).toEqual(['ONLY']);
      expect(result.gameResult).toMatchObject({ winner: 'opp', reason: 'deck-out' });
      expect(result.log.find(entry => entry.action === 'effect:draw')).toMatchObject({ result: '1' });
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

    it('logs the actual mill count when fewer cards exist than requested', () => {
      const state = createEmptyGameState();
      state.players.self.deck = ['ONLY'];
      const ctx = makeCtx();

      const result = produce(state, draft => {
        runAtom(draft, 'mill', { player: 'self', n: 3, bind: 'milled' }, ctx);
      });

      expect((ctx.bindings.milled as unknown[])).toHaveLength(1);
      expect(result.log.find(entry => entry.action === 'effect:mill')).toMatchObject({ result: '1' });
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

    it('logs the actual FILE addition count when deck exhaustion stops a larger request', () => {
      const state = createEmptyGameState();
      state.players.self.deck = ['ONLY'];

      const result = produce(state, draft => {
        runAtom(draft, 'fileAdd', { player: 'self', n: 3 }, makeCtx());
      });

      expect(result.players.self.file).toHaveLength(1);
      expect(result.gameResult).toMatchObject({ winner: 'opp', reason: 'deck-out' });
      expect(result.log.find(entry => entry.action === 'effect:fileAdd')).toMatchObject({ result: '1' });
    });
  });

  describe('filePopToHand', () => {
    // BUG-128 (Task D E3, 2026-06-12): 旧実装は FILE_CARD_BACK_PLACEHOLDER ('card-back') を
    // 手札に push していた (next-hint.ts は Round 3 で実 cardId 化済なのに verb 側が stale)。
    // FileCard.card-back は cardId を保持しているので実 cardId を手札に加えるのが正。
    it('FILE 最上部 (card-back) を pop し実 cardId を手札に加える (BUG-128)', () => {
      let s = createEmptyGameState();
      s = {
        ...s,
        players: {
          ...s.players,
          self: { ...s.players.self, file: [{ type: 'card-back', cardId: 'F1' }, { type: 'card-back', cardId: 'F2' }] },
        },
      };
      const result = produce(s, draft => {
        runAtom(draft, 'filePopToHand', { player: 'self' }, makeCtx());
      });
      expect(result.players.self.file).toHaveLength(1);
      expect(result.players.self.hand[0], '最上部 (末尾) F2 の実 cardId が手札へ').toBe('F2');
    });

    it('FILE 空 (or アシストパートナーのみ) なら chainStepNoApply を立てる (PR100/B04068 Q&A「そうした場合」不成立)', () => {
      const ctx = makeCtx(); // Phase 3c: chain break 信号は ctx.dyn 経由 (旧 globalThis __chainStepNoApply)
      let s = createEmptyGameState();
      s = {
        ...s,
        players: {
          ...s.players,
          self: { ...s.players.self, file: [{ type: 'assisted-partner', cardId: 'P1' }] },
        },
      };
      const result = produce(s, draft => {
        runAtom(draft, 'filePopToHand', { player: 'self' }, ctx);
      });
      expect(result.players.self.hand).toHaveLength(0);
      // PR100: a FILE without a removable card stops the remaining chain.
      expect(result.players.self.file, 'アシストパートナーは pop されない (rules/12)').toHaveLength(1);
      expect(ctx.dyn?.chainStepNoApply, 'chain break 信号 (Phase 3c: ctx.dyn)').toBe(true);
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
      expect(result.log.at(-1)?.targetAudience).toBeUndefined();
    });

    it('裏向き証拠の cardId は所有者だけが読める log target にする', () => {
      const s = createEmptyGameState();
      s.players.self.evidence = [
        { cardId: 'PRIVATE-EVIDENCE', faceUp: false, origin: { turn: 1, via: 'opening' } },
      ];

      const result = produce(s, draft => {
        runAtom(draft, 'evidenceToHand', { player: 'self', target: 'PRIVATE-EVIDENCE' }, makeCtx());
      });

      expect(result.log.at(-1)).toMatchObject({
        action: 'effect:evidenceToHand',
        target: 'PRIVATE-EVIDENCE',
        targetAudience: 'self',
      });
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

    // BUG-068 (2026-05-28): resolveBindRef 配線 → bind ref が解決される
    it('BUG-068: $matched.uid bind ref が ctx.bindings から解決される', () => {
      const c = makeChar({ uid: 'rm-uid', cardId: 'C200' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const ctxWithBind = makeCtx({
        bindings: { matched: [{ kind: 'character', cardId: 'C200', uid: 'rm-uid' } as Candidate] },
      });
      const result = produce(s, draft => {
        runAtom(draft, 'sceneRemove', { uid: '$matched.uid', cause: 'effect' }, ctxWithBind);
      });
      expect(result.players.self.scene).toHaveLength(0);
      expect(result.players.self.remove).toContain('C200');
    });

    it('BUG-068: bind ref 未解決 ($ で始まる残り) は silent no-op', () => {
      const c = makeChar({ uid: 'rm-uid', cardId: 'C200' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        // bindings に matched なし → resolveBindRef は元 string をそのまま返す
        runAtom(draft, 'sceneRemove', { uid: '$matched.uid', cause: 'effect' }, makeCtx());
      });
      expect(result.players.self.scene).toHaveLength(1); // 未変化
      expect(result.players.self.remove).not.toContain('C200');
    });
  });

  // engine-extension #4 (2026-06-05): char→hand bounce
  describe('sceneToHand', () => {
    it('指定 uid のキャラを所有者の手札に戻す (self.scene → self.hand)', () => {
      const c = makeChar({ uid: 'bnc-uid', cardId: 'C300' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'sceneToHand', { uid: 'bnc-uid' }, makeCtx());
      });
      expect(result.players.self.scene).toHaveLength(0);
      expect(result.players.self.hand).toContain('C300');
    });

    it('opp の現場キャラは opp の手札に戻る (effect 発動側 self ではなく所有者 opp)', () => {
      const c = makeChar({ uid: 'bnc-opp', cardId: 'C301' });
      const s = withScene(createEmptyGameState(), 'opp', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'sceneToHand', { uid: 'bnc-opp' }, makeCtx());
      });
      expect(result.players.opp.scene).toHaveLength(0);
      expect(result.players.opp.hand, '所有者 opp の手札に戻る').toContain('C301');
      expect(result.players.self.hand, 'self の手札には入らない').not.toContain('C301');
    });

    it('rules/16: setCards はリムーブエリアへ (bounce 時)', () => {
      const c = makeChar({
        uid: 'bnc-set',
        cardId: 'C302',
        setCards: [{ kind: 'event', cardId: 'EV1' }],
      });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'sceneToHand', { uid: 'bnc-set' }, makeCtx());
      });
      expect(result.players.self.hand, 'キャラ本体は手札').toContain('C302');
      expect(result.players.self.remove, 'setCards はリムーブ').toContain('EV1');
    });

    it('leave:to-remove は emit されない (リムーブではない、rules/17)', () => {
      // ※ leave:to-remove は removeToRemove からのみ emit。toHand は別経路で emit しない。
      const c = makeChar({ uid: 'bnc-leave', cardId: 'C303' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'sceneToHand', { uid: 'bnc-leave' }, makeCtx());
      });
      expect(result.players.self.remove, '本体は remove へ行かない').not.toContain('C303');
      expect(result.players.self.hand).toContain('C303');
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
      expect(result.log.at(-1)).toMatchObject({
        action: 'effect:sceneDisguise', target: 'dg-uid', result: 'changed',
      });
    });

    it('does not log a new identity when the scene target is missing', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        runAtom(draft, 'sceneDisguise', { uid: 'missing', newCardId: 'PRIVATE-NEW' }, makeCtx());
      });

      expect(result.players.self.scene).toEqual([]);
      expect(JSON.stringify(result.log)).not.toContain('PRIVATE-NEW');
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

    // D11007 a3 driver fix: `uid: '$self'` リテラルが ctx.source.uid に解決される
    // (旧 BUG: silent no-op で AP+3000 が走らず、コンタクト AP 判定で勝てない問題)
    it('uid: $self → ctx.source.uid に解決され AP modifier が適用される', () => {
      const c = makeChar({ uid: 'self-uid-x' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'self-uid-x' } });
      const result = produce(s, draft => {
        runAtom(draft, 'charModifyAP', { uid: '$self', delta: 3000, scope: 'contact' }, ctx);
      });
      expect(result.players.self.scene[0].turnEffects['apMod_contact']).toBe(3000);
    });

    it('uid: $self で ctx.source.uid 未設定なら no-op (defensive)', () => {
      const c = makeChar({ uid: 'self-uid-y' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene' } }); // uid なし
      const result = produce(s, draft => {
        runAtom(draft, 'charModifyAP', { uid: '$self', delta: 3000, scope: 'contact' }, ctx);
      });
      expect(result.players.self.scene[0].turnEffects['apMod_contact']).toBeUndefined();
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

  // engine-extension #2 (2026-06-05): charModifyLevel verb
  describe('charModifyLevel', () => {
    it('Level modifier を turnEffects に積む (turn scope)', () => {
      const c = makeChar({ uid: 'lvl-uid' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charModifyLevel', { uid: 'lvl-uid', delta: -2, scope: 'turn' }, makeCtx());
      });
      expect(result.players.self.scene[0].turnEffects['lvlMod_turn']).toBe(-2);
    });

    it('permanent scope は lvlMod_permanent に積む', () => {
      const c = makeChar({ uid: 'lvl-p' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charModifyLevel', { uid: 'lvl-p', delta: 3, scope: 'permanent' }, makeCtx());
      });
      expect(result.players.self.scene[0].turnEffects['lvlMod_permanent']).toBe(3);
    });

    it('複数回の delta は加算される', () => {
      const c = makeChar({ uid: 'lvl-acc' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charModifyLevel', { uid: 'lvl-acc', delta: 1, scope: 'turn' }, makeCtx());
        runAtom(draft, 'charModifyLevel', { uid: 'lvl-acc', delta: 2, scope: 'turn' }, makeCtx());
      });
      expect(result.players.self.scene[0].turnEffects['lvlMod_turn']).toBe(3);
    });

    it('uid: $self → ctx.source.uid に解決される (charModifyAP/LP と同型)', () => {
      const c = makeChar({ uid: 'lvl-self' });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'lvl-self' } });
      const result = produce(s, draft => {
        runAtom(draft, 'charModifyLevel', { uid: '$self', delta: 4, scope: 'turn' }, ctx);
      });
      expect(result.players.self.scene[0].turnEffects['lvlMod_turn']).toBe(4);
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
      expect(result.players.self.scene[0].setCards).toEqual([{ cardId: 'ITEM', faceUp: true, instanceId: 'set:1' }]);
    });

    // engine-extension #5b (2026-06-05): fromDeckTop オプション
    it('fromDeckTop: 自分のデッキ上端を裏向きでセット (deck.shift + setCards.push)', () => {
      let s = createEmptyGameState();
      const c = makeChar({ uid: 'set-deck' });
      s = { ...s, players: { ...s.players, self: { ...s.players.self, scene: [c], deck: ['DECK_TOP', 'DECK_2', 'DECK_3'] } } };
      const result = produce(s, draft => {
        runAtom(draft, 'charSetCard', { uid: 'set-deck', fromDeckTop: true, faceUp: false, player: 'self' }, makeCtx());
      });
      expect(result.players.self.scene[0].setCards).toEqual([{ cardId: 'DECK_TOP', faceUp: false, instanceId: 'set:1' }]);
      expect(result.players.self.deck).toEqual(['DECK_2', 'DECK_3']);
      expect(JSON.stringify(result.log.at(-1))).not.toContain('DECK_TOP');
    });

    it('fromDeckTop: 空デッキでは silent no-op', () => {
      let s = createEmptyGameState();
      const c = makeChar({ uid: 'set-empty' });
      s = { ...s, players: { ...s.players, self: { ...s.players.self, scene: [c], deck: [] } } };
      const result = produce(s, draft => {
        runAtom(draft, 'charSetCard', { uid: 'set-empty', fromDeckTop: true, faceUp: false, player: 'self' }, makeCtx());
      });
      expect(result.players.self.scene[0].setCards).toEqual([]);
    });

    it('rules/16: setCards はリムーブ時に表向きでリムーブエリアへ (回帰)', () => {
      let s = createEmptyGameState();
      const c = makeChar({ uid: 'set-leave', setCards: [{ cardId: 'SET_X', faceUp: false }] });
      s = { ...s, players: { ...s.players, self: { ...s.players.self, scene: [c] } } };
      const result = produce(s, draft => {
        runAtom(draft, 'sceneRemove', { uid: 'set-leave', cause: 'effect' }, makeCtx());
      });
      expect(result.players.self.scene).toHaveLength(0);
      expect(result.players.self.remove, '裏向き set でもリムーブ時は cardId が見える').toContain('SET_X');
    });
  });

  describe('非公開領域のログ', () => {
    it('デッキから手札へ加えたカードIDを共有ログへ残さない', () => {
      const s = createEmptyGameState();
      s.players.self.deck = ['SECRET_HAND'];
      const result = produce(s, draft => {
        runAtom(draft, 'handAddFromDeck', { player: 'self', cardId: 'SECRET_HAND' }, makeCtx());
      });
      expect(result.players.self.hand).toEqual(['SECRET_HAND']);
      expect(JSON.stringify(result.log.at(-1))).not.toContain('SECRET_HAND');
    });

    it('FILEから手札へ加えたカードIDを共有ログへ残さない', () => {
      const s = createEmptyGameState();
      s.players.self.file = [{ cardId: 'SECRET_FILE', faceUp: false, type: 'card-back' }];
      const result = produce(s, draft => {
        runAtom(draft, 'filePopToHand', { player: 'self' }, makeCtx());
      });
      expect(result.players.self.hand).toEqual(['SECRET_FILE']);
      expect(JSON.stringify(result.log.at(-1))).not.toContain('SECRET_FILE');
    });
  });

  describe('charStackCard', () => {
    it('stackedCards に枚数を加算', () => {
      const c = makeChar({ uid: 'sk-uid', stackedCards: 1 });
      const s = withScene(createEmptyGameState(), 'self', [c]);
      const result = produce(s, draft => {
        runAtom(draft, 'charStackCard', { uid: 'sk-uid', n: 2 }, makeCtx());
      });
      expect(Array.isArray(result.players.self.scene[0].stackedCards) ? result.players.self.scene[0].stackedCards.length : result.players.self.scene[0].stackedCards).toBe(3);
    });

    it('gates a fromSelf continuation when the source left before the host choice resumed', () => {
      const host = makeChar({ uid: 'host' });
      const state = withScene(createEmptyGameState(), 'self', [host]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'stale-source', cardId: 'B06008' }, dyn: {} });

      const result = produce(state, draft => {
        runAtom(draft, 'charStackCard', { fromSelf: true, uid: 'host' }, ctx);
      });

      expect(ctx.dyn?.chainStepNoApply).toBe(true);
      expect(result.players.self.scene[0]?.stackedCards).toEqual(0);
      expect(result.log.some(entry => entry.action === 'effect:charStackCard:self-under')).toBe(false);
    });

    it('gates a fromScene continuation when the selected character left before resume', () => {
      const host = makeChar({ uid: 'host' });
      const state = withScene(createEmptyGameState(), 'self', [host]);
      const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'host', cardId: 'D10009' }, dyn: {} });

      const result = produce(state, draft => {
        runAtom(draft, 'charStackCard', { fromScene: true, uid: 'stale-selected', hostUid: 'host' }, ctx);
      });

      expect(ctx.dyn?.chainStepNoApply).toBe(true);
      expect(result.players.self.scene[0]?.stackedCards).toEqual(0);
      expect(result.log.some(entry => entry.action === 'effect:charStackCard:scene-under')).toBe(false);
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

    it('records the effect summary before the terminal causal event', () => {
      const state = createEmptyGameState();
      startCausalSession(state, 'solve-case-order');

      const result = produce(state, draft => {
        runAtom(draft, 'partnerSolveCase', { player: 'self' }, makeCtx());
      });

      expect(result.log.map((entry) => ('kind' in entry ? entry.kind : 'legacy'))).toEqual([
        'summary',
        'game-result',
      ]);
    });
  });

  describe('caseToResolved', () => {
    beforeEach(() => {
      event._resetRegistry();
    });

    it('事件編→解決編に移行', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        runAtom(draft, 'caseToResolved', { player: 'self' }, makeCtx());
      });
      expect(result.players.self.case.status).toBe('解決編');
    });

    it('case:to-resolved Hook を emit する (rules/01)', () => {
      const listener = vi.fn();
      event.on('case:to-resolved', listener);
      const s = createEmptyGameState();
      produce(s, draft => {
        runAtom(draft, 'caseToResolved', { player: 'self' }, makeCtx());
      });
      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][1]).toEqual({ player: 'self' });
    });
  });

  // --- フロー (W6 step9 で本実装 — 詳細 probe は tests/cards/engine-mega-w6b.test.ts §9) ---
  describe('startContact', () => {
    it('W6 step9: targetUid 未解決 / 対象不在は no-op (盤面・log 無変化)', () => {
      const s = createEmptyGameState();
      const result = produce(s, draft => {
        runAtom(draft, 'startContact', { targetUid: 'no-such-uid' }, makeCtx());
        runAtom(draft, 'startContact', { targetUid: '$target.uid' }, makeCtx());
      });
      expect(result.log.length).toBe(0); // fail-closed no-op (rules/15 0枚選択と同 posture)
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

    // engine-extension #5a (2026-06-05): maxN — 上から N 枚見る系
    it('maxN: 上から N 枚全件 reveal、match は 1 件抽出 / 残りを $revealed', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'TARGET', 'C', 'D'] } } };
      const ctx = makeCtx();
      produce(s, draft => {
        runAtom(
          draft,
          'deckRevealUntil',
          {
            player: 'self',
            filter: (id: string) => id === 'TARGET',
            maxN: 4,
            bind: 'revealed',
            bindMatch: 'matched',
          },
          ctx,
        );
      });
      expect(ctx.bindings['matched']).toHaveLength(1);
      expect((ctx.bindings['matched'][0] as { cardId: string }).cardId).toBe('TARGET');
      // 上から 4 枚 [A, B, TARGET, C] のうち TARGET を 1 件抽出 → 残り 3 枚
      const revealedIds = (ctx.bindings['revealed'] as Array<{ cardId: string }>).map(c => c.cardId);
      expect(revealedIds).toEqual(['A', 'B', 'C']);
    });

    it('maxN: 範囲内に match が無い場合 — $matched 空、$revealed=top N 全件', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'C', 'D', 'TARGET'] } } };
      const ctx = makeCtx();
      produce(s, draft => {
        runAtom(
          draft,
          'deckRevealUntil',
          {
            player: 'self',
            filter: (id: string) => id === 'TARGET',
            maxN: 4, // TARGET は 5 枚目にあるため maxN=4 では拾えない
            bind: 'revealed',
            bindMatch: 'matched',
          },
          ctx,
        );
      });
      expect(ctx.bindings['matched']).toHaveLength(0);
      const revealedIds = (ctx.bindings['revealed'] as Array<{ cardId: string }>).map(c => c.cardId);
      expect(revealedIds).toEqual(['A', 'B', 'C', 'D']);
    });

    it('maxN: デッキが maxN より短い場合は全 reveal (no match)', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B'] } } };
      const ctx = makeCtx();
      produce(s, draft => {
        runAtom(
          draft,
          'deckRevealUntil',
          { player: 'self', filter: () => false, maxN: 5, bind: 'all', bindMatch: 'hit' },
          ctx,
        );
      });
      expect(ctx.bindings['hit']).toHaveLength(0);
      expect(ctx.bindings['all']).toHaveLength(2);
    });

    it('maxN: 未指定なら従来動作 (filter match まで or デッキ末尾) を維持 (回帰)', () => {
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'TARGET', 'C'] } } };
      const ctx = makeCtx();
      produce(s, draft => {
        runAtom(draft, 'deckRevealUntil', { player: 'self', filter: (id: string) => id === 'TARGET', bind: 'r', bindMatch: 'm' }, ctx);
      });
      expect((ctx.bindings['m'][0] as { cardId: string }).cardId).toBe('TARGET');
      const ids = (ctx.bindings['r'] as Array<{ cardId: string }>).map(c => c.cardId);
      expect(ids).toEqual(['A', 'B']);
    });
  });

  describe('deckToBottomBound', () => {
    it('ctx.bindings[bindKey] の cardId 群をデッキ下に移動', () => {
      let s = createEmptyGameState();
      // 実フロー通り: bound カード (deckRevealUntil で公開された分) は **まだデッキにある** (rules/26)
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'B', 'BASE'] } } };
      // Candidate の card バリアントに適合する shape — 型キャスト不要
      const cards: Candidate[] = [
        deckOccurrenceAuthority(s, 'self', 0)!,
        deckOccurrenceAuthority(s, 'self', 1)!,
      ];
      const ctx = makeCtx({ bindings: { rest: cards } });
      const result = produce(s, draft => {
        runAtom(draft, 'deckToBottomBound', { player: 'self', bindKey: 'rest' }, ctx);
      });
      expect(result.players.self.deck).toEqual(['BASE', 'A', 'B']);
    });

    it('does not mint authority for a witnessless indexed deck binding', () => {
      const state = createEmptyGameState();
      state.players.self.deck = ['A', 'BASE'];
      const authority = deckOccurrenceAuthority(state, 'self', 0)!;
      const { occurrenceWitness: _discarded, ...witnessless } = authority;
      const ctx = makeCtx({ bindings: { rest: [witnessless] } });

      const result = produce(state, draft => {
        runAtom(
          draft,
          'deckToBottomBound',
          { player: 'self', bindKey: 'rest', order: 'preserve' },
          ctx,
        );
      });

      expect(result.players.self.deck).toEqual(['A', 'BASE']);
      expect(result.log.at(-1)).toMatchObject({
        action: 'effect:deckToBottomBound',
        result: 'stale-selection',
      });
    });

    it('BUG-132 GAP-1 防御: stale occurrence があれば bottom move 全体を fail closed にする', () => {
      // chooseMatch の pick await 中に他 entry が deck を消費した場合の window 侵食対策。
      // 旧実装は splice 失敗でも無条件 push し、手札に移ったカードが deck にも複製されていた。
      let s = createEmptyGameState();
      s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['A', 'BASE'] } } };
      const cards: Candidate[] = [
        deckOccurrenceAuthority(s, 'self', 0)!,
        { kind: 'card', cardId: 'GONE', area: 'deck', player: 'self' }, // deck に存在しない
      ];
      const ctx = makeCtx({ bindings: { rest: cards } });
      const result = produce(s, draft => {
        runAtom(draft, 'deckToBottomBound', { player: 'self', bindKey: 'rest' }, ctx);
      });
      expect(result.players.self.deck).toEqual(['A', 'BASE']);
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

// Task D E2 (2026-06-12): scene→deck verb
// rules: 09/23 (デッキ下移動はリムーブでない), 16 (set/stacked リムーブ), 03 (所有者帰属)
describe('sceneToDeck (Task D E2)', () => {
  it('指定 uid のキャラを所有者のデッキの下へ移す (既定 pos=bottom)', () => {
    const c = makeChar({ uid: 'std-uid', cardId: 'C400' });
    let s = withScene(createEmptyGameState(), 'self', [c]);
    s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['D1', 'D2'] } } };
    const result = produce(s, draft => {
      runAtom(draft, 'sceneToDeck', { uid: 'std-uid' }, makeCtx());
    });
    expect(result.players.self.scene).toHaveLength(0);
    expect(result.players.self.deck, 'デッキの下 (末尾) に入る').toEqual(['D1', 'D2', 'C400']);
  });

  it("pos:'top' でデッキの上へ移す (B05092 形)", () => {
    const c = makeChar({ uid: 'std-top', cardId: 'C401' });
    let s = withScene(createEmptyGameState(), 'self', [c]);
    s = { ...s, players: { ...s.players, self: { ...s.players.self, deck: ['D1'] } } };
    const result = produce(s, draft => {
      runAtom(draft, 'sceneToDeck', { uid: 'std-top', pos: 'top' }, makeCtx());
    });
    expect(result.players.self.deck, 'デッキの上 (先頭) に入る').toEqual(['C401', 'D1']);
  });

  it('opp の現場キャラは opp のデッキへ (effect 発動側 self ではなく所有者)', () => {
    const c = makeChar({ uid: 'std-opp', cardId: 'C402' });
    const s = withScene(createEmptyGameState(), 'opp', [c]);
    const result = produce(s, draft => {
      runAtom(draft, 'sceneToDeck', { uid: 'std-opp' }, makeCtx());
    });
    expect(result.players.opp.scene).toHaveLength(0);
    expect(result.players.opp.deck).toContain('C402');
    expect(result.players.self.deck).not.toContain('C402');
  });

  it('rules/16: setCards は表向きでリムーブエリアへ、本体はデッキへ', () => {
    const c = makeChar({
      uid: 'std-set',
      cardId: 'C403',
      setCards: [{ cardId: 'EV1', faceUp: false }],
      stackedCards: 2,
    });
    const s = withScene(createEmptyGameState(), 'self', [c]);
    const result = produce(s, draft => {
      runAtom(draft, 'sceneToDeck', { uid: 'std-set' }, makeCtx());
    });
    expect(result.players.self.deck, '本体はデッキ').toContain('C403');
    expect(result.players.self.remove, 'setCards はリムーブ').toContain('EV1');
    expect(result.players.self.remove.length, 'stackedCards 2 枚もリムーブ').toBeGreaterThanOrEqual(3);
  });

  it('leave:to-remove は emit されない (リムーブではない、rules/09/23)', () => {
    const c = makeChar({ uid: 'std-leave', cardId: 'C404' });
    const s = withScene(createEmptyGameState(), 'self', [c]);
    const result = produce(s, draft => {
      runAtom(draft, 'sceneToDeck', { uid: 'std-leave' }, makeCtx());
    });
    expect(result.players.self.remove, '本体は remove へ行かない').not.toContain('C404');
    expect(result.players.self.deck).toContain('C404');
  });

  it("'$pick' 未解決残存は silent no-op (skip)", () => {
    const c = makeChar({ uid: 'std-skip', cardId: 'C405' });
    const s = withScene(createEmptyGameState(), 'self', [c]);
    const result = produce(s, draft => {
      runAtom(draft, 'sceneToDeck', { uid: '$pick' }, makeCtx());
    });
    expect(result.players.self.scene).toHaveLength(1);
  });
});

// Task D E3 (2026-06-12): FILE-zone verbs
// rules: 03 (リムーブエリア), 05 (FILE 積順=末尾が最上), 12 (アシストパートナー除外),
//        14/26 (デッキ0→リフレッシュ後残り解決), 15 (可能な限り行う)
describe('fileRemoveTop (Task D E3)', () => {
  function withFile(s: ReturnType<typeof createEmptyGameState>, p: 'self' | 'opp', file: unknown[]) {
    return { ...s, players: { ...s.players, [p]: { ...s.players[p], file } } } as typeof s;
  }

  it('FILE 上から n 枚を FILE 所有者のリムーブエリアへ (実 cardId)', () => {
    let s = createEmptyGameState();
    s = withFile(s, 'self', [
      { type: 'card-back', cardId: 'F1' },
      { type: 'card-back', cardId: 'F2' },
      { type: 'card-back', cardId: 'F3' },
    ]);
    const result = produce(s, draft => {
      runAtom(draft, 'fileRemoveTop', { player: 'self', n: 2 }, makeCtx());
    });
    expect(result.players.self.file).toHaveLength(1);
    expect(result.players.self.remove, '上 (末尾) から F3, F2 がリムーブへ').toEqual(expect.arrayContaining(['F3', 'F2']));
    expect(result.players.self.remove).not.toContain('F1');
  });

  it('相手の FILE をリムーブ → 相手のリムーブエリアへ (B09003/B09108 形)', () => {
    let s = createEmptyGameState();
    s = withFile(s, 'opp', [{ type: 'card-back', cardId: 'OF1' }]);
    const result = produce(s, draft => {
      runAtom(draft, 'fileRemoveTop', { player: 'opp', n: 1 }, makeCtx());
    });
    expect(result.players.opp.file).toHaveLength(0);
    expect(result.players.opp.remove).toContain('OF1');
    expect(result.players.self.remove).not.toContain('OF1');
  });

  it('アシストパートナーは skip される (B09010/B09108 Q&A「パートナーカードを除いて」)', () => {
    let s = createEmptyGameState();
    s = withFile(s, 'self', [
      { type: 'card-back', cardId: 'F1' },
      { type: 'assisted-partner', cardId: 'P1' },
    ]);
    const result = produce(s, draft => {
      runAtom(draft, 'fileRemoveTop', { player: 'self', n: 1 }, makeCtx());
    });
    expect(result.players.self.remove, '最上はパートナーだが除いて F1 がリムーブ').toContain('F1');
    expect(result.players.self.file.map(f => (f as { type: string }).type), 'パートナーは FILE に残る').toEqual(['assisted-partner']);
  });

  it('1枚もリムーブできなければ chainStepNoApply (B09105 Q&A「以降解決不可」)', () => {
    const ctx = makeCtx();
    const s = createEmptyGameState();
    produce(s, draft => {
      runAtom(draft, 'fileRemoveTop', { player: 'self', n: 1 }, ctx);
    });
    expect(ctx.dyn?.chainStepNoApply).toBe(true);
  });

  it('bind 指定でリムーブした cardId 群を ctx.bindings に書く (カード名指定系の布石)', () => {
    let s = createEmptyGameState();
    s = withFile(s, 'opp', [{ type: 'card-back', cardId: 'OF9' }]);
    const ctx = makeCtx();
    produce(s, draft => {
      runAtom(draft, 'fileRemoveTop', { player: 'opp', n: 1, bind: '$fileRemoved' }, ctx);
    });
    const bound = (ctx.bindings as Record<string, { cardId?: string }[]>)['$fileRemoved'];
    expect(bound).toHaveLength(1);
    expect(bound![0]!.cardId).toBe('OF9');
  });
});

describe('fileFlipTop (Task D E3)', () => {
  function withFile(s: ReturnType<typeof createEmptyGameState>, p: 'self' | 'opp', file: unknown[]) {
    return { ...s, players: { ...s.players, [p]: { ...s.players[p], file } } } as typeof s;
  }

  it('相手 FILE の最上位 (非パートナー) を表向きにする (B09021 形)', () => {
    let s = createEmptyGameState();
    s = withFile(s, 'opp', [
      { type: 'card-back', cardId: 'OF1' },
      { type: 'card-back', cardId: 'OF2' },
    ]);
    const result = produce(s, draft => {
      runAtom(draft, 'fileFlipTop', { player: 'opp' }, makeCtx());
    });
    const file = result.players.opp.file as { cardId: string; faceUp?: boolean }[];
    expect(file[1]!.faceUp, '最上 (末尾) OF2 が表向き').toBe(true);
    expect(file[0]!.faceUp ?? false, 'OF1 は裏のまま').toBe(false);
  });

  it('最上位が既に表向きなら何も起こらない — 下のカードへ降りない (B09021/B09108/B09023/B09005 Q&A)', () => {
    let s = createEmptyGameState();
    s = withFile(s, 'opp', [
      { type: 'card-back', cardId: 'OF1' },
      { type: 'card-back', cardId: 'OF2', faceUp: true },
    ]);
    const result = produce(s, draft => {
      runAtom(draft, 'fileFlipTop', { player: 'opp' }, makeCtx());
    });
    const file = result.players.opp.file as { cardId: string; faceUp?: boolean }[];
    expect(file[0]!.faceUp ?? false, 'OF1 は裏のまま (降りて表向きにしない)').toBe(false);
  });

  it('flip 不発でも chainStepNoApply は立てない (B09021 Q&A: 後続効果は実行可、fileRemoveTop と非対称)', () => {
    const ctx = makeCtx({ dyn: { chainStepNoApply: false } }); // Phase 3c: 書込み無し → pre-init false で .toBe(false) 維持
    const s = createEmptyGameState();
    produce(s, draft => {
      runAtom(draft, 'fileFlipTop', { player: 'opp' }, ctx);
    });
    expect(ctx.dyn?.chainStepNoApply).toBe(false);
  });
});

describe('fileAdd デッキ0リフレッシュ (Task D E3)', () => {
  it('デッキ不足時はリフレッシュして残りを FILE に置く (rules/14「FILEに置く」)', () => {
    let s = createEmptyGameState();
    s = {
      ...s,
      players: {
        ...s.players,
        opp: { ...s.players.opp, deck: ['D1'], remove: ['R1', 'R2'] },
      },
    };
    const result = produce(s, draft => {
      runAtom(draft, 'fileAdd', { player: 'opp', n: 2 }, makeCtx());
    });
    expect(result.players.opp.file, '1枚目=D1、リフレッシュ後に2枚目').toHaveLength(2);
    expect(result.players.opp.remove, 'リムーブはデッキへシャッフルされ空').toHaveLength(0);
  });
});
