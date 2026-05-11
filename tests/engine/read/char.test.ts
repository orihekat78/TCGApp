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
