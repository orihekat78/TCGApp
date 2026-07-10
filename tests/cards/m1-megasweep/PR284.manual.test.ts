// tests/cards/m1-megasweep/PR284 諸伏高明 — manual probe (engine変更0)
// 印字テキスト (payloads/PR284.json fullTexts.effect):
//   【絆大和敢助】【自分ターン中】AP＋2000
//   自分のリムーブエリアに〚特徴［長野県警］〛のキャラが2枚以上ある場合、
//   このキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//
// novel 句:
//   a1 = continuous condition and[ bond 大和敢助, turn:self ] → apDelta +2000
//   a2 = continuous condition removeTraitAtLeast{self, 長野県警, 2} → grantKeywords ['突撃']
//
// production 経路: 両能力とも continuous。dispatch されず engine.read.char が
//   continuousModifier を走査・合算する (BUG-171 の declared/triggered dispatch は対象外)。
//   条件 owner は charRead が uid の所在 scene から自動解決 (read/char.ts:21-22)。
// rules: 13-keywords.md (突撃) / 15-abilities-effects.md / 17-icons.md (絆/自分ターン中)

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { char as charRead } from '@/engine/read/char';
import { PR284 } from '@/cards/pr-01/PR284';
import type { CardDef, GameState } from '@/engine/types';

// bond 対象 (現場に居れば【絆大和敢助】成立)
const YAMATO: CardDef = {
  id: 'YAMATO', no: 'YAMATO', kind: 'character', names: ['大和敢助'],
  colors: ['黄'], level: 5, ap: 4000, lp: 2, traits: ['警察', '長野県警'],
  rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
} as CardDef;
// remove エリアの〚特徴［長野県警］〛キャラ
const NAGANO: CardDef = {
  id: 'NAGANO', no: 'NAGANO', kind: 'character', names: ['長野の刑事'],
  colors: ['黄'], level: 3, ap: 3000, lp: 1, traits: ['警察', '長野県警'],
  rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
} as CardDef;
// decoy: 長野県警 でない (filter外・bond対象外の両用)
const DECOY: CardDef = {
  id: 'DECOY', no: 'DECOY', kind: 'character', names: ['ダミー'],
  colors: ['赤'], level: 1, ap: 1000, lp: 1, traits: ['探偵'],
  rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
} as CardDef;

function sceneChar(cardId: string, uid: string) {
  return {
    cardId, uid, state: 'active' as const, isNamed: false,
    enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

interface Opts {
  side?: 'self' | 'opp';
  turnPlayer: 'self' | 'opp';
  bond?: boolean;        // 大和敢助 を現場に置く
  bondDecoy?: boolean;   // 大和敢助 以外を現場に置く
  removeNagano?: number; // remove に置く 長野県警 キャラ枚数
  removeDecoy?: number;  // remove に置く 非長野県警 キャラ枚数
}

function makeState(o: Opts): GameState {
  const side = o.side ?? 'self';
  return produce(createEmptyGameState(), (d) => {
    d.turn.player = o.turnPlayer;
    d.players[side].scene.push(sceneChar('PR284', 'PR284#0'));
    if (o.bond) d.players[side].scene.push(sceneChar('YAMATO', 'YAMATO#0'));
    if (o.bondDecoy) d.players[side].scene.push(sceneChar('DECOY', 'DECOY#s'));
    for (let i = 0; i < (o.removeNagano ?? 0); i++) d.players[side].remove.push('NAGANO');
    for (let i = 0; i < (o.removeDecoy ?? 0); i++) d.players[side].remove.push('DECOY');
  });
}

describe('PR284 諸伏高明 — manual probe (continuous, engine変更0)', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    engine.cards.register(PR284);
    engine.cards.register(YAMATO);
    engine.cards.register(NAGANO);
    engine.cards.register(DECOY);
  });

  it('shape: a1 apDelta+2000 (bond∧turn) / a2 grantKeywords (removeTraitAtLeast 長野県警 2)', () => {
    expect(PR284.abilities.map(a => a.id)).toEqual(['a1', 'a2']);
    const a1 = PR284.abilities[0];
    expect(a1.type).toBe('continuous');
    expect(a1.continuousModifier?.apDelta).toBe(2000);
    expect(a1.condition).toEqual({
      kind: 'and',
      cs: [{ kind: 'bond', cardName: '大和敢助' }, { kind: 'turn', player: 'self' }],
    });
    const a2 = PR284.abilities[1];
    expect(a2.type).toBe('continuous');
    expect(a2.condition).toEqual({ kind: 'removeTraitAtLeast', player: 'self', trait: '長野県警', n: 2 });
    expect(a2.continuousModifier?.grantKeywords).toBeDefined();
  });

  // ── a1: AP+2000 ──────────────────────────────────────────────
  it('a1 成立: 絆大和敢助 ∧ 自分ターン → AP = 5000 + 2000 = 7000', () => {
    expect(charRead.ap(makeState({ turnPlayer: 'self', bond: true }), 'PR284#0')).toBe(7000);
  });

  it('a1 off (turn): 絆はあるが相手ターン → turn:self 不成立で AP = 5000', () => {
    expect(charRead.ap(makeState({ turnPlayer: 'opp', bond: true }), 'PR284#0')).toBe(5000);
  });

  it('a1 off (bond) + decoy: 自分ターンだが現場に大和敢助不在 (別キャラ居る) → bond 不成立で AP = 5000', () => {
    expect(charRead.ap(makeState({ turnPlayer: 'self', bond: false, bondDecoy: true }), 'PR284#0')).toBe(5000);
  });

  // ── a2: 突撃 grant ───────────────────────────────────────────
  it('a2 成立: remove に長野県警2枚 → 突撃 を持つ', () => {
    const kws = charRead.keywords(makeState({ turnPlayer: 'self', removeNagano: 2 }), 'PR284#0');
    expect(kws).toContain('突撃');
  });

  it('a2 off (threshold): remove に長野県警1枚 (2未満) → 突撃 を持たない', () => {
    const kws = charRead.keywords(makeState({ turnPlayer: 'self', removeNagano: 1 }), 'PR284#0');
    expect(kws).not.toContain('突撃');
  });

  it('a2 decoy: remove に非長野県警5枚 + 長野県警1枚 → 計数1で 突撃 なし (decoy 非計上)', () => {
    const kws = charRead.keywords(makeState({ turnPlayer: 'self', removeNagano: 1, removeDecoy: 5 }), 'PR284#0');
    expect(kws).not.toContain('突撃');
  });

  it('a2 decoy 混在で閾値到達: 長野県警2枚 + decoy3枚 → 突撃 あり (decoy が阻害しない)', () => {
    const kws = charRead.keywords(makeState({ turnPlayer: 'self', removeNagano: 2, removeDecoy: 3 }), 'PR284#0');
    expect(kws).toContain('突撃');
  });

  // ── BUG-174: owner='opp' で挙動が反転しない ─────────────────────
  it('owner=opp pin: 相手が所有 → opp の絆/ターン/remove で駆動、AP=7000 かつ 突撃', () => {
    const st = makeState({ side: 'opp', turnPlayer: 'opp', bond: true, removeNagano: 2 });
    expect(charRead.ap(st, 'PR284#0')).toBe(7000);
    expect(charRead.keywords(st, 'PR284#0')).toContain('突撃');
  });
});
