// rules: 03-field-areas.md, 09-cutin-disguise.md, 13-keywords.md, 19-special-rules.md, 23-qa-disguise-cutin.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { char } from '@/engine/mutate/char';
import type { GameState, SceneCharacter } from '@/engine/types';

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

function makeState(c: SceneCharacter): GameState {
  const s = createEmptyGameState();
  return {
    ...s,
    players: {
      ...s.players,
      self: { ...s.players.self, scene: [c] },
    },
  };
}

describe('engine.mutate.char', () => {
  describe('modifyAP', () => {
    it('scope=permanent: apBase modifier に積む (apOverride は null のまま変わらない)', () => {
      const c = makeChar({ apOverride: null });
      const s = makeState(c);
      // permanent は apOverride を直接変更する (base 修正相当)
      const result = produce(s, draft => {
        char.modifyAP(draft, 'uid-1', 1000, 'permanent');
      });
      // turnEffects.apMod.permanent に積む OR apOverride を変更
      // 設計: permanent は turnEffects['apMod_permanent'] に差分を積む
      const ch = result.players.self.scene[0];
      // 確認方法: turnEffects の apMod_permanent か、apOverride の変化
      const modPerm = ch.turnEffects['apMod_permanent'] as number | undefined;
      expect(modPerm).toBe(1000);
    });

    it('scope=turn: turnEffects.apMod_turn に積む', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyAP(draft, 'uid-1', 500, 'turn');
      });
      const ch = result.players.self.scene[0];
      expect(ch.turnEffects['apMod_turn']).toBe(500);
    });

    it('scope=contact: turnEffects.apMod_contact に積む', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyAP(draft, 'uid-1', -2000, 'contact');
      });
      const ch = result.players.self.scene[0];
      expect(ch.turnEffects['apMod_contact']).toBe(-2000);
    });

    it('複数回の累積: same scope は加算される', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyAP(draft, 'uid-1', 1000, 'turn');
        char.modifyAP(draft, 'uid-1', 500, 'turn');
      });
      const ch = result.players.self.scene[0];
      expect(ch.turnEffects['apMod_turn']).toBe(1500);
    });

    it('AP がマイナスになっても OK (rules/19 下限なし)', () => {
      const c = makeChar({ apOverride: null });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyAP(draft, 'uid-1', -99999, 'permanent');
      });
      const ch = result.players.self.scene[0];
      expect(ch.turnEffects['apMod_permanent']).toBe(-99999);
    });
  });

  describe('modifyLP', () => {
    it('scope=permanent: turnEffects.lpMod_permanent に積む', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyLP(draft, 'uid-1', -1, 'permanent');
      });
      expect(result.players.self.scene[0].turnEffects['lpMod_permanent']).toBe(-1);
    });

    it('scope=turn: turnEffects.lpMod_turn に積む', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyLP(draft, 'uid-1', 2, 'turn');
      });
      expect(result.players.self.scene[0].turnEffects['lpMod_turn']).toBe(2);
    });
  });

  describe('setOverrideAP', () => {
    it('apOverride を設定する', () => {
      const c = makeChar({ apOverride: null });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setOverrideAP(draft, 'uid-1', 5000);
      });
      expect(result.players.self.scene[0].apOverride).toBe(5000);
    });

    it('null で解除できる', () => {
      const c = makeChar({ apOverride: 3000 });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setOverrideAP(draft, 'uid-1', null);
      });
      expect(result.players.self.scene[0].apOverride).toBeNull();
    });
  });

  describe('setOverrideLP', () => {
    it('lpOverride を設定する', () => {
      const c = makeChar({ lpOverride: null });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setOverrideLP(draft, 'uid-1', -1);
      });
      expect(result.players.self.scene[0].lpOverride).toBe(-1);
    });
  });

  describe('grantKeyword', () => {
    it('scope=permanent でキーワードを付与する', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.grantKeyword(draft, 'uid-1', '迅速', 'permanent');
      });
      expect(result.players.self.scene[0].keywordOverrides.granted).toContain('迅速');
    });

    it('scope=turn で turnEffects.grantedKeywords に積む', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.grantKeyword(draft, 'uid-1', '突撃', 'turn');
      });
      const kws = result.players.self.scene[0].turnEffects['grantedKeywords'] as string[];
      expect(kws).toContain('突撃');
    });

    it('同じキーワードを2回 granted しても重複しない (permanent)', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.grantKeyword(draft, 'uid-1', '迅速', 'permanent');
        char.grantKeyword(draft, 'uid-1', '迅速', 'permanent');
      });
      const granted = result.players.self.scene[0].keywordOverrides.granted;
      expect(granted.filter(k => k === '迅速')).toHaveLength(1);
    });
  });

  describe('revokeKeyword', () => {
    it('granted からキーワードを取り除く', () => {
      const c = makeChar({
        keywordOverrides: { granted: ['迅速', 'ブレット'], disabledOriginal: false },
      });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.revokeKeyword(draft, 'uid-1', '迅速');
      });
      const granted = result.players.self.scene[0].keywordOverrides.granted;
      expect(granted).not.toContain('迅速');
      expect(granted).toContain('ブレット');
    });
  });

  describe('disableOriginalAbilities', () => {
    it('disabledOriginal を true にする (rules/19)', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.disableOriginalAbilities(draft, 'uid-1');
      });
      expect(result.players.self.scene[0].keywordOverrides.disabledOriginal).toBe(true);
    });
  });

  describe('setTurnEffect', () => {
    it('turnEffects に任意のキー/値を設定', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setTurnEffect(draft, 'uid-1', 'contactImmune', true);
      });
      expect(result.players.self.scene[0].turnEffects['contactImmune']).toBe(true);
    });

    it('removeOnTurnEnd を設定', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setTurnEffect(draft, 'uid-1', 'removeOnTurnEnd', true);
      });
      expect(result.players.self.scene[0].turnEffects['removeOnTurnEnd']).toBe(true);
    });
  });

  describe('clearTurnEffects', () => {
    it('scope=turn で turn 系エフェクトをクリア', () => {
      const c = makeChar({
        turnEffects: {
          contactImmune: false,
          removeOnTurnEnd: false,
          apMod_turn: 1000,
          lpMod_turn: 2,
          grantedKeywords: ['突撃'],
        },
      });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.clearTurnEffects(draft, 'uid-1', 'turn');
      });
      const te = result.players.self.scene[0].turnEffects;
      expect(te['apMod_turn']).toBeUndefined();
      expect(te['lpMod_turn']).toBeUndefined();
      expect(te['grantedKeywords']).toBeUndefined();
      // contactImmune と removeOnTurnEnd は維持
      expect(te['contactImmune']).toBe(false);
    });
  });

  describe('setCard', () => {
    it('setCards にカードを追加する (faceUp 付き)', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setCard(draft, 'uid-1', 'EV001', true);
      });
      expect(result.players.self.scene[0].setCards).toEqual([
        { cardId: 'EV001', faceUp: true },
      ]);
    });

    it('裏向きセット (faceUp=false)', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setCard(draft, 'uid-1', 'EV002', false);
      });
      expect(result.players.self.scene[0].setCards).toEqual([
        { cardId: 'EV002', faceUp: false },
      ]);
    });

    it('複数枚セット可能', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setCard(draft, 'uid-1', 'EV001', true);
        char.setCard(draft, 'uid-1', 'EV002', false);
      });
      expect(result.players.self.scene[0].setCards).toHaveLength(2);
    });
  });

  describe('stackCard', () => {
    it('stackedCards に count を加算', () => {
      const c = makeChar({ stackedCards: 2 });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.stackCard(draft, 'uid-1', 3);
      });
      expect(result.players.self.scene[0].stackedCards).toBe(5);
    });
  });

  describe('removeAllSetAndStacked', () => {
    it('setCards を全部リムーブに移動し、stackedCards をクリア', () => {
      const c = makeChar({
        setCards: [
          { cardId: 'SET001', faceUp: true },
          { cardId: 'SET002', faceUp: false },
        ],
        stackedCards: 2,
      });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.removeAllSetAndStacked(draft, 'uid-1');
      });
      expect(result.players.self.scene[0].setCards).toHaveLength(0);
      expect(result.players.self.scene[0].stackedCards).toBe(0);
      expect(result.players.self.remove).toContain('SET001');
      expect(result.players.self.remove).toContain('SET002');
      // 2枚分の back-card
      const backCards = result.players.self.remove.filter(id => id === 'back-card');
      expect(backCards).toHaveLength(2);
    });
  });

  describe('disguiseInto', () => {
    it('cardId のみを新カードに変更する (rules/09)', () => {
      const c = makeChar({
        uid: 'uid-1',
        cardId: 'OLD001',
        state: 'sleep',
        turnEffects: {
          contactImmune: true,
          removeOnTurnEnd: true,
          apMod_turn: 500,
        },
        isNamed: true,
        enterOrder: 3,
      });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.disguiseInto(draft, 'uid-1', 'NEW001');
      });
      const ch = result.players.self.scene[0];
      // cardId が変わる
      expect(ch.cardId).toBe('NEW001');
      // state は引き継ぐ (rules/23)
      expect(ch.state).toBe('sleep');
      // turnEffects は引き継ぐ
      expect(ch.turnEffects['contactImmune']).toBe(true);
      expect(ch.turnEffects['removeOnTurnEnd']).toBe(true);
      expect(ch.turnEffects['apMod_turn']).toBe(500);
      // enterOrder は保持
      expect(ch.enterOrder).toBe(3);
      // isNamed は保持
      expect(ch.isNamed).toBe(true);
    });

    it('元カードの名前・色は新カードのものに変わる (uid は保持)', () => {
      const c = makeChar({ uid: 'uid-1', cardId: 'OLD001' });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.disguiseInto(draft, 'uid-1', 'NEW001');
      });
      expect(result.players.self.scene[0].uid).toBe('uid-1');
      expect(result.players.self.scene[0].cardId).toBe('NEW001');
    });
  });
});
