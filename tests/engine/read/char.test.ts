import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { char } from '@/engine/read/char';
import { register, _resetRegistry } from '@/engine/read/def';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';

function makeChar(overrides: Partial<SceneCharacter> = {}): SceneCharacter {
  return {
    cardId: 'CONAN001',
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

function withChar(c: SceneCharacter): GameState {
  const s = createEmptyGameState();
  return {
    ...s,
    players: {
      ...s.players,
      self: { ...s.players.self, scene: [c] },
    },
  };
}

function makeDef(overrides: Partial<CardDef> = {}): CardDef {
  return {
    id: 'CONAN001',
    no: 'B01001',
    kind: 'character',
    names: ['江戸川コナン'],
    colors: ['青'],
    level: 3,
    ap: 3000,
    lp: 2,
    traits: ['少年探偵団'],
    rarity: 'U',
    isMR: false,
    imageUrl: 'https://example.com/conan.jpg',
    abilities: [],
    ruleRefs: [],
    ...overrides,
  };
}

describe('engine.read.char', () => {
  beforeEach(() => { _resetRegistry(); });
  afterEach(() => { _resetRegistry(); });

  describe('ap', () => {
    it('apOverride が null でなければ override を返す', () => {
      const s = withChar(makeChar({ apOverride: 5000 }));
      expect(char.ap(s, 'uid-1')).toBe(5000);
    });

    it('apOverride null で CardDef があれば CardDef.ap を返す', () => {
      register(makeDef({ ap: 3000 }));
      const s = withChar(makeChar({ apOverride: null }));
      expect(char.ap(s, 'uid-1')).toBe(3000);
    });

    it('apOverride null で CardDef なければ 0 を返す', () => {
      const s = withChar(makeChar({ apOverride: null }));
      expect(char.ap(s, 'uid-1')).toBe(0);
    });

    it('apOverride 0 は 0 として扱う (null ではない)', () => {
      register(makeDef({ ap: 3000 }));
      const s = withChar(makeChar({ apOverride: 0 }));
      expect(char.ap(s, 'uid-1')).toBe(0);
    });

    it('存在しない uid は 0', () => {
      const s = createEmptyGameState();
      expect(char.ap(s, 'nonexistent')).toBe(0);
    });

    // 2026-05-25 fix: charModifyAP は turnEffects['apMod_*'] に蓄積する。
    // 旧コードはこれを合算せず、D11007 a3 +3000/contact 等の AP 修正が
    // 実 AP 判定に反映されない silent bug があった。
    it('turnEffects[apMod_contact] が base AP に加算される (D11007 a3 driver)', () => {
      register(makeDef({ ap: 5000 }));
      const s = withChar(makeChar({
        apOverride: null,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false, apMod_contact: 3000 },
      }));
      expect(char.ap(s, 'uid-1')).toBe(8000); // 5000 + 3000
    });

    it('turnEffects[apMod_turn] が base AP に加算される', () => {
      register(makeDef({ ap: 5000 }));
      const s = withChar(makeChar({
        apOverride: null,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false, apMod_turn: 1000 },
      }));
      expect(char.ap(s, 'uid-1')).toBe(6000);
    });

    it('apMod_permanent / turn / contact 全て合算される', () => {
      register(makeDef({ ap: 5000 }));
      const s = withChar(makeChar({
        apOverride: null,
        turnEffects: {
          contactImmune: false,
          removeOnTurnEnd: false,
          apMod_permanent: 500,
          apMod_turn: 1000,
          apMod_contact: 3000,
        },
      }));
      expect(char.ap(s, 'uid-1')).toBe(9500); // 5000 + 500 + 1000 + 3000
    });

    it('apOverride が set されていても apMod_* は加算される', () => {
      const s = withChar(makeChar({
        apOverride: 6000,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false, apMod_contact: 2000 },
      }));
      expect(char.ap(s, 'uid-1')).toBe(8000); // 6000 (override) + 2000 (contact mod)
    });

    it('負の delta (apMod < 0) も合算される (rules/19 下限なし)', () => {
      register(makeDef({ ap: 3000 }));
      const s = withChar(makeChar({
        apOverride: null,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false, apMod_turn: -5000 },
      }));
      expect(char.ap(s, 'uid-1')).toBe(-2000); // 3000 - 5000 = -2000 (rules/19)
    });
  });

  describe('lp', () => {
    it('lpOverride が null でなければ override を返す', () => {
      const s = withChar(makeChar({ lpOverride: -1 }));
      expect(char.lp(s, 'uid-1')).toBe(-1); // 下限なし (rules/19)
    });

    it('lpOverride null で CardDef があれば CardDef.lp を返す', () => {
      register(makeDef({ lp: 2 }));
      const s = withChar(makeChar({ lpOverride: null }));
      expect(char.lp(s, 'uid-1')).toBe(2);
    });

    it('lpOverride null で CardDef なければ 0', () => {
      const s = withChar(makeChar({ lpOverride: null }));
      expect(char.lp(s, 'uid-1')).toBe(0);
    });
  });

  describe('level', () => {
    it('CardDef がある場合', () => {
      register(makeDef({ level: 3 }));
      const s = withChar(makeChar());
      expect(char.level(s, 'uid-1')).toBe(3);
    });

    it('CardDef がない場合は 0', () => {
      const s = withChar(makeChar());
      expect(char.level(s, 'uid-1')).toBe(0);
    });

    // engine-extension #2 (2026-06-05): charModifyLevel に伴い 3 scope 合算へ拡張
    it('lvlMod_turn を合算する (+2 turn delta)', () => {
      register(makeDef({ level: 3 }));
      const s = withChar(makeChar({ turnEffects: { contactImmune: false, removeOnTurnEnd: false, lvlMod_turn: 2 } }));
      expect(char.level(s, 'uid-1')).toBe(5);
    });

    it('lvlMod_permanent + lvlMod_turn + lvlMod_contact を合算する (rules/19 下限なし)', () => {
      register(makeDef({ level: 4 }));
      const s = withChar(makeChar({ turnEffects: { contactImmune: false, removeOnTurnEnd: false, lvlMod_permanent: -1, lvlMod_turn: -3, lvlMod_contact: -2 } }));
      expect(char.level(s, 'uid-1')).toBe(-2);
    });
  });

  describe('colors', () => {
    it('CardDef がある場合', () => {
      register(makeDef({ colors: ['青', '赤'] }));
      const s = withChar(makeChar());
      expect(char.colors(s, 'uid-1')).toContain('青');
      expect(char.colors(s, 'uid-1')).toContain('赤');
    });

    it('CardDef がない場合は空配列', () => {
      const s = withChar(makeChar());
      expect(char.colors(s, 'uid-1')).toEqual([]);
    });
  });

  describe('names (複数名カード対応)', () => {
    it('複数名カードの全名を返す (rules/19)', () => {
      register(makeDef({ names: ['江戸川コナン&工藤新一', '江戸川コナン', '工藤新一'] }));
      const s = withChar(makeChar());
      const n = char.names(s, 'uid-1');
      expect(n).toContain('江戸川コナン');
      expect(n).toContain('工藤新一');
    });

    it('CardDef がない場合は空配列', () => {
      const s = withChar(makeChar());
      expect(char.names(s, 'uid-1')).toEqual([]);
    });
  });

  describe('traits', () => {
    it('CardDef から特徴を返す', () => {
      register(makeDef({ traits: ['少年探偵団', '警察'] }));
      const s = withChar(makeChar());
      expect(char.traits(s, 'uid-1')).toContain('少年探偵団');
    });

    it('CardDef がない場合は空配列', () => {
      const s = withChar(makeChar());
      expect(char.traits(s, 'uid-1')).toEqual([]);
    });
  });

  describe('keywords', () => {
    it('disabledOriginal=false: granted のみ (CardDef.keywords なければ)', () => {
      const s = withChar(makeChar({ keywordOverrides: { granted: ['迅速'], disabledOriginal: false } }));
      expect(char.keywords(s, 'uid-1')).toContain('迅速');
    });

    it('disabledOriginal=true: granted のみ (元キーワード除外) (rules/19)', () => {
      // CardDef に keywords があっても除外される
      const d: CardDef & { keywords: string[] } = { ...makeDef(), keywords: ['突撃'] };
      register(d);
      const s = withChar(makeChar({
        keywordOverrides: { granted: ['迅速'], disabledOriginal: true },
      }));
      const kws = char.keywords(s, 'uid-1');
      expect(kws).toContain('迅速');
      expect(kws).not.toContain('突撃');
    });

    it('granted が空で CardDef なければ空配列', () => {
      const s = withChar(makeChar());
      expect(char.keywords(s, 'uid-1')).toEqual([]);
    });

    // BUG-030: continuous + grantKeywords ability の resolve
    describe('continuous modifier resolver (BUG-030)', () => {
      it('continuous ability で condition 満たせば grantKeywords が反映', () => {
        const d: CardDef = {
          ...makeDef(),
          abilities: [{
            id: 'a_test_pck',
            type: 'continuous',
            scope: 'on-scene',
            condition: { kind: 'true' },
            continuousModifier: { grantKeywords: () => ['突撃'] },
            description: 'test',
          }],
        };
        register(d);
        const s = withChar(makeChar());
        expect(char.keywords(s, 'uid-1')).toContain('突撃');
      });

      it('continuous ability で condition 満たさなければ grantKeywords 反映なし', () => {
        const d: CardDef = {
          ...makeDef(),
          abilities: [{
            id: 'a_test_pck',
            type: 'continuous',
            scope: 'on-scene',
            condition: { kind: 'false' },
            continuousModifier: { grantKeywords: () => ['突撃'] },
            description: 'test',
          }],
        };
        register(d);
        const s = withChar(makeChar());
        expect(char.keywords(s, 'uid-1')).not.toContain('突撃');
      });

      it('disabledOriginal=true なら continuous ability の grantKeywords も無効 (rules/19)', () => {
        const d: CardDef = {
          ...makeDef(),
          abilities: [{
            id: 'a_test_pck',
            type: 'continuous',
            scope: 'on-scene',
            condition: { kind: 'true' },
            continuousModifier: { grantKeywords: () => ['突撃'] },
            description: 'test',
          }],
        };
        register(d);
        const s = withChar(makeChar({
          keywordOverrides: { granted: ['迅速'], disabledOriginal: true },
        }));
        const kws = char.keywords(s, 'uid-1');
        expect(kws).toContain('迅速');
        expect(kws).not.toContain('突撃');
      });

      it('partnerColor 条件: partner が指定色なら grant', () => {
        const partnerDef: CardDef = { ...makeDef(), id: 'PARTNER_BLUE', colors: ['青'] };
        register(partnerDef);
        const charDef: CardDef = {
          ...makeDef(),
          id: 'TEST_CHAR',
          abilities: [{
            id: 'a_pck_突撃',
            type: 'continuous',
            scope: 'on-scene',
            condition: { kind: 'partnerColor', color: '青' },
            continuousModifier: { grantKeywords: () => ['突撃'] },
            description: 'test',
          }],
        };
        register(charDef);
        const s = withChar(makeChar({ cardId: 'TEST_CHAR' }));
        // self.partner cardId を青のものに
        s.players.self.partner = { cardId: 'PARTNER_BLUE', state: 'sleep', location: 'partner-area' };
        expect(char.keywords(s, 'uid-1')).toContain('突撃');
      });

      it('partnerColor 条件: partner が異なる色なら grant されない', () => {
        const partnerDef: CardDef = { ...makeDef(), id: 'PARTNER_YELLOW', colors: ['黄'] };
        register(partnerDef);
        const charDef: CardDef = {
          ...makeDef(),
          id: 'TEST_CHAR',
          abilities: [{
            id: 'a_pck_突撃',
            type: 'continuous',
            scope: 'on-scene',
            condition: { kind: 'partnerColor', color: '青' },
            continuousModifier: { grantKeywords: () => ['突撃'] },
            description: 'test',
          }],
        };
        register(charDef);
        const s = withChar(makeChar({ cardId: 'TEST_CHAR' }));
        s.players.self.partner = { cardId: 'PARTNER_YELLOW', state: 'sleep', location: 'partner-area' };
        expect(char.keywords(s, 'uid-1')).not.toContain('突撃');
      });
    });
  });

  describe('hasKeyword', () => {
    it('キーワードを持つ場合 true', () => {
      const s = withChar(makeChar({ keywordOverrides: { granted: ['ブレット'], disabledOriginal: false } }));
      expect(char.hasKeyword(s, 'uid-1', 'ブレット')).toBe(true);
    });

    it('持たない場合 false', () => {
      const s = withChar(makeChar());
      expect(char.hasKeyword(s, 'uid-1', '迅速')).toBe(false);
    });
  });

  describe('state', () => {
    it('アクティブ状態', () => {
      const s = withChar(makeChar({ state: 'active' }));
      expect(char.state(s, 'uid-1')).toBe('active');
    });

    it('スリープ状態', () => {
      const s = withChar(makeChar({ state: 'sleep' }));
      expect(char.state(s, 'uid-1')).toBe('sleep');
    });

    it('スタン状態', () => {
      const s = withChar(makeChar({ state: 'stun' }));
      expect(char.state(s, 'uid-1')).toBe('stun');
    });

    it('存在しない uid は sleep を返す', () => {
      const s = createEmptyGameState();
      expect(char.state(s, 'nonexistent')).toBe('sleep');
    });
  });

  describe('isNamed', () => {
    it('名乗り状態のキャラ', () => {
      const s = withChar(makeChar({ isNamed: true }));
      expect(char.isNamed(s, 'uid-1')).toBe(true);
    });

    it('非名乗り状態', () => {
      const s = withChar(makeChar({ isNamed: false }));
      expect(char.isNamed(s, 'uid-1')).toBe(false);
    });
  });

  describe('setCards', () => {
    it('セットされたカードを返す (cardId[] 互換)', () => {
      const s = withChar(makeChar({
        setCards: [
          { cardId: 'EV001', faceUp: true },
          { cardId: 'EV002', faceUp: false },
        ],
      }));
      expect(char.setCards(s, 'uid-1')).toEqual(['EV001', 'EV002']);
    });

    it('存在しない uid は空配列', () => {
      const s = createEmptyGameState();
      expect(char.setCards(s, 'nonexistent')).toEqual([]);
    });
  });

  describe('stackedCount', () => {
    it('重なっているカード枚数', () => {
      const s = withChar(makeChar({ stackedCards: 3 }));
      expect(char.stackedCount(s, 'uid-1')).toBe(3);
    });

    it('存在しない uid は 0', () => {
      const s = createEmptyGameState();
      expect(char.stackedCount(s, 'nonexistent')).toBe(0);
    });
  });

  describe('turnEffect', () => {
    it('contactImmune を取得', () => {
      const s = withChar(makeChar({
        turnEffects: { contactImmune: true, removeOnTurnEnd: false },
      }));
      expect(char.turnEffect(s, 'uid-1', 'contactImmune')).toBe(true);
    });

    it('任意キーを取得', () => {
      const s = withChar(makeChar({
        turnEffects: { contactImmune: false, removeOnTurnEnd: false, customEffect: 'hello' },
      }));
      expect(char.turnEffect(s, 'uid-1', 'customEffect')).toBe('hello');
    });

    it('存在しないキーは undefined', () => {
      const s = withChar(makeChar());
      expect(char.turnEffect(s, 'uid-1', 'noSuchKey')).toBeUndefined();
    });

    it('存在しない uid は undefined', () => {
      const s = createEmptyGameState();
      expect(char.turnEffect(s, 'nonexistent', 'anyKey')).toBeUndefined();
    });
  });

  describe('declaredUseCount', () => {
    it('宣言能力の使用回数を返す', () => {
      const s = withChar(makeChar({ declaredUseCount: { 'ability-a': 2 } }));
      expect(char.declaredUseCount(s, 'uid-1', 'ability-a')).toBe(2);
    });

    it('未使用の能力 ID は 0', () => {
      const s = withChar(makeChar());
      expect(char.declaredUseCount(s, 'uid-1', 'ability-x')).toBe(0);
    });

    it('存在しない uid は 0', () => {
      const s = createEmptyGameState();
      expect(char.declaredUseCount(s, 'nonexistent', 'any')).toBe(0);
    });
  });
});
