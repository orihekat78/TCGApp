// CARD PHASE step12 batch2 probe — B09108/B09108P 工藤新一&服部平次 (MR) / B09003/B09003P 江戸川コナン /
// PR105 工藤有希子 (declareName family + DeclareCardNameModal 配線 commit)
//
// rules: 11 (レベル≤0 と level-read), 15 (「〜まで」=0可 / 「してもよい」), 16 (裏向きセット),
//        17 (【事件&】=全色 / 【ターン1】), 18 (MR PA 宣言), 19 (完全置換 name / レベル下限なし),
//        21 (コスト全部 / 一部不可=宣言不可), 24 (解決不可でも発動済カウント)
//
// 検証面: 第2gate 再certify (全句 engine 実測)。AI 経路 = 本 probe / human 経路 = 同 commit の
// playwright (DeclareCardNameModal 新 UI 部品型)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { char as charRead } from '@/engine/read/char';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import type { CardDef, FileCard, GameState, SceneCharacter } from '@/engine/types';

import { B09108 } from '@/cards/ct-p09/B09108';
import { B09108P } from '@/cards/ct-p09/B09108P';
import { B09003 } from '@/cards/ct-p09/B09003';
import { B09003P } from '@/cards/ct-p09/B09003P';
import { PR105 } from '@/cards/pr-01/PR105';

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = s; };

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});

const FIXTURES: CardDef[] = [
  mkChar('MOB'),
  mkChar('BLUE4', { colors: ['青'], level: 4 }),
  mkChar('GREEN7', { colors: ['緑'], level: 7 }),
  mkChar('BLUE8', { colors: ['青'], level: 8 }),
  mkChar('RED4', { colors: ['赤'], level: 4 }),
  mkChar('AP8K', { ap: 8000 }),
  mkChar('AP9K', { ap: 9000 }),
  mkChar('HATTORI', { names: ['服部平次'] }),
];
const ALL = [B09108, B09108P, B09003, B09003P, PR105, ...FIXTURES];

const fileBack = (cardId: string): FileCard => ({ type: 'card-back', cardId });

function baseState(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

function emitEnter(d: GameState, c: SceneCharacter, player: 'self' | 'opp'): void {
  event.emit(d, 'enter', { uid: c.uid, player, enterOrder: 1, enterOrderThisTurn: 1 }, { player, cardId: c.cardId, uid: c.uid });
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of ALL) registerCardDef(d);
  registerTriggeredListener();
});

// ============== B09003 a1 — 【自分ターン中】continuous lvlDelta -2 ==============
describe('B09003 a1 — 自分ターン中 レベル−2 (continuous lvlDelta)', () => {
  it('自分ターン中 = level 6 / 相手ターン中 = 印字 8 (rules/17 条件外は持たない扱い)', () => {
    const s = baseState();
    const conan = mutateAll.scene.enter(s, 'self', 'B09003', {});
    expect(charRead.level(s, conan.uid)).toBe(6);
    s.turn.player = 'opp';
    expect(charRead.level(s, conan.uid)).toBe(8);
  });
});

// ============== B09003 a2 — 事件青&緑 enter observer → AP8000以下 1枚まで remove ==============
describe('B09003 a2 — 青/緑 lv7以下 登場 observer', () => {
  function board(caseColors: string[]) {
    const s = baseState();
    s.players.self.case.colors = caseColors;
    const conan = mutateAll.scene.enter(s, 'self', 'B09003', {});
    const ap9 = mutateAll.scene.enter(s, 'opp', 'AP9K', {});
    const ap8 = mutateAll.scene.enter(s, 'opp', 'AP8K', {});
    return { s, conan, ap9, ap8 };
  }
  function enterAndDrain(s0: GameState, cardId: string, player: 'self' | 'opp'): GameState {
    return produce(s0, (d) => {
      const c = mutateAll.scene.enter(d, player, cardId, {});
      emitEnter(d, c, player);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
  }
  it('事件 青&緑 + 自ターン + lv4青 が自現場に登場 → AP8000以下を 1枚 remove (AP9K decoy 残存)', () => {
    const { s } = board(['青', '緑']);
    const after = enterAndDrain(s, 'BLUE4', 'self');
    const removedTotal = after.players.self.remove.length + after.players.opp.remove.length;
    expect(removedTotal, 'AP8000以下が1枚リムーブされる').toBe(1);
    expect(after.players.opp.scene.some(c => c.cardId === 'AP9K'), 'AP9000 は対象外').toBe(true);
  });
  it('negative: lv8青 / 相手現場 / 事件が青のみ / 赤キャラ → 不発', () => {
    for (const [colors, cardId, side] of [
      [['青', '緑'], 'BLUE8', 'self'],
      [['青', '緑'], 'BLUE4', 'opp'],
      [['青'], 'BLUE4', 'self'],
      [['青', '緑'], 'RED4', 'self'],
    ] as const) {
      const { s } = board([...colors]);
      const after = enterAndDrain(s, cardId, side);
      const removedTotal = after.players.self.remove.length + after.players.opp.remove.length;
      expect(removedTotal, `${cardId}/${side}/case=${colors.join(',')}`).toBe(0);
    }
  });
  it('緑 lv7 は境界内で発火 / 【ターン1】= 同ターン2度目は不発 (rules/24 発動済カウント)', () => {
    const { s } = board(['青', '緑']);
    const after1 = enterAndDrain(s, 'GREEN7', 'self');
    const removed1 = after1.players.self.remove.length + after1.players.opp.remove.length;
    expect(removed1).toBe(1);
    const after2 = enterAndDrain(after1, 'BLUE4', 'self');
    const removed2 = after2.players.self.remove.length + after2.players.opp.remove.length;
    expect(removed2, '同ターン2度目は limit で不発').toBe(1);
  });
});

// ============== B09003 a3 — 絆服部平次 + declareName → FILE ops → conditional AP+2000 ==============
describe('B09003 a3 — 宣言 (declareName clone)', () => {
  function board(withBond = true) {
    const s = baseState();
    const conan = mutateAll.scene.enter(s, 'self', 'B09003', {});
    if (withBond) mutateAll.scene.enter(s, 'self', 'HATTORI', {});
    s.players.self.deck = ['MOB', 'MOB', 'MOB'];
    s.players.opp.deck = ['MOB', 'MOB'];
    s.players.opp.file = [fileBack('RED4'), fileBack('BLUE4')]; // 末尾が最上 → top = BLUE4
    return { s, conan };
  }
  it('canDeclaredAbility: 絆 服部平次 が現場に居るときのみ可 (rules/17 絆)', () => {
    const { s, conan } = board(true);
    expect(canDeclaredAbility(s, conan.uid, 'a3')).toBe(true);
    const { s: s2, conan: c2 } = board(false);
    expect(canDeclaredAbility(s2, c2.uid, 'a3')).toBe(false);
  });
  it('宣言名一致: cost deck-1 / opp FILE top → opp remove / opp deck→FILE 補充 / AP+2000 (turn)', () => {
    const { s, conan } = board();
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, conan.uid, 'a3', { declaredName: 'BLUE4' });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.deck.length, 'cost removeDeckTop 1').toBe(2);
    expect(after.players.opp.remove).toContain('BLUE4');
    expect(after.players.opp.file.length, '-1 +1 = 2').toBe(2);
    const buffed = [...after.players.self.scene, ...after.players.opp.scene]
      .filter(c => charRead.ap(after, c.uid) > (charRead.ap(s, c.uid) ?? 0));
    expect(buffed.length, 'キャラ1枚に AP+2000').toBe(1);
  });
  it('宣言名不一致 / AI 未供給 (空文字) → FILE ops は実行、AP+ は不発', () => {
    for (const costParams of [{ declaredName: 'MOB' }, undefined]) {
      const { s, conan } = board();
      const after = produce(s, (d) => {
        activateDeclaredAbility(d, conan.uid, 'a3', costParams);
        runAllUntilEmpty(d);
        drainAiEffectPicks(d);
        runAllUntilEmpty(d);
      });
      expect(after.players.opp.remove).toContain('BLUE4');
      expect(after.players.opp.file.length).toBe(2);
      const buffed = [...after.players.self.scene, ...after.players.opp.scene]
        .filter(c => charRead.ap(after, c.uid) > (charRead.ap(s, c.uid) ?? 0));
      expect(buffed.length, `AP+ 不発 (${JSON.stringify(costParams)})`).toBe(0);
    }
  });
  it('opp FILE 空 → fileRemoveTop chain break: 補充もされない (B09105 Q&A)', () => {
    const { s, conan } = board();
    s.players.opp.file = [];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, conan.uid, 'a3', { declaredName: 'BLUE4' });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    expect(after.players.opp.file.length, 'fileAdd も不実行 (chain break)').toBe(0);
    expect(after.players.opp.deck.length, 'opp deck 不変').toBe(2);
  });
});

// ============== B09108 a1 — 相手現場キャラ→デッキ下 + opp FILE flip ==============
describe('B09108 a1 — 宣言 (sceneToDeck opp + fileFlipTop)', () => {
  function board(oppChars: string[]) {
    const s = baseState();
    const shin = mutateAll.scene.enter(s, 'self', 'B09108', {});
    const opps = oppChars.map(id => mutateAll.scene.enter(s, 'opp', id, {}));
    s.players.opp.deck = ['MOB'];
    s.players.opp.file = [fileBack('RED4')];
    return { s, shin, opps };
  }
  it('相手キャラ1枚を相手デッキの下へ + opp FILE top 表向き化', () => {
    const { s, shin } = board(['BLUE4']);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, shin.uid, 'a1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    expect(after.players.opp.scene.length, '相手現場 -1').toBe(0);
    expect(after.players.opp.deck[after.players.opp.deck.length - 1], 'デッキ最下部へ').toBe('BLUE4');
    expect(after.players.opp.remove.length, 'リムーブではない (rules/23)').toBe(0);
    const top = after.players.opp.file[after.players.opp.file.length - 1];
    expect(top && top.type === 'card-back' && top.faceUp === true, 'FILE top faceUp').toBe(true);
  });
  it('相手現場 0 枚 (「〜まで」=0可) でも fileFlipTop は実行 (plain sequence)', () => {
    const { s, shin } = board([]);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, shin.uid, 'a1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    const top = after.players.opp.file[after.players.opp.file.length - 1];
    expect(top && top.type === 'card-back' && top.faceUp === true).toBe(true);
  });
});

// ============== B09108 a2 — declareName → FILE ops → draw2 + discard2 / PA 宣言 ==============
describe('B09108 a2 — 宣言 (declareName + PA scope)', () => {
  function board() {
    const s = baseState();
    const shin = mutateAll.scene.enter(s, 'self', 'B09108', {});
    s.players.self.deck = ['MOB', 'MOB', 'MOB', 'MOB'];
    s.players.self.hand = ['RED4'];
    s.players.opp.deck = ['MOB', 'MOB'];
    s.players.opp.file = [fileBack('BLUE4')];
    return { s, shin };
  }
  it('宣言名一致 → 2枚引き手札2枚リムーブ (draw2 + discard2)', () => {
    const { s, shin } = board();
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, shin.uid, 'a2', { declaredName: 'BLUE4' });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    expect(after.players.opp.remove).toContain('BLUE4');
    expect(after.players.opp.file.length, '-1 +1 = 1').toBe(1);
    expect(after.players.self.deck.length, 'draw 2').toBe(2);
    // hand: 1 + 2(draw) - 2(discard) = 1 / self remove: +2
    expect(after.players.self.hand.length).toBe(1);
    expect(after.players.self.remove.length, '手札から2枚リムーブ').toBe(2);
  });
  it('宣言名不一致 → draw/discard 不発 (FILE ops のみ)', () => {
    const { s, shin } = board();
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, shin.uid, 'a2', { declaredName: 'MOB' });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.deck.length, 'draw なし').toBe(4);
    expect(after.players.self.hand.length).toBe(1);
    expect(after.players.self.remove.length).toBe(0);
  });
  it('PA-MR 常駐から a2 宣言可 (scope on-partner-area) / a1 は on-scene ゆえ不可 (rules/18)', () => {
    const s = baseState();
    s.players.self.partnerAreaMR = {
      uid: 'partnerMR:self', cardId: 'B09108', state: 'active', isNamed: false,
      turnEffects: {}, setCards: [], stackedCards: [],
    } as unknown as SceneCharacter;
    expect(canDeclaredAbility(s, 'partnerMR:self', 'a2'), 'PA から宣言できる').toBe(true);
    expect(canDeclaredAbility(s, 'partnerMR:self', 'a1'), 'on-scene 能力は PA から不可').toBe(false);
  });
});

// ============== PR105 — 登場時セット+突撃[キャラ] / 宣言 AP+1000 + nameOverride ==============
describe('PR105 工藤有希子', () => {
  function enterYukiko() {
    const s = baseState();
    s.players.self.deck = ['BLUE4', 'MOB'];
    let uid = '';
    const after = produce(s, (d) => {
      const c = mutateAll.scene.enter(d, 'self', 'PR105', {});
      uid = c.uid;
      emitEnter(d, c, 'self');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    return { s0: s, after, uid };
  }
  it('a1: デッキ上1枚を裏向きセット + ターン終了時まで 突撃[キャラ] (rules/16)', () => {
    const { after, uid } = enterYukiko();
    const me = after.players.self.scene.find(c => c.uid === uid)!;
    expect(me.setCards.length, 'デッキ上端を裏向きセット').toBe(1);
    expect(me.setCards[0]!.faceUp, '裏向き').toBe(false);
    expect(after.players.self.deck.length).toBe(1);
    expect(charRead.keywords(after, uid), '突撃[キャラ] 付与').toContain('突撃[キャラ]');
    // ターン終了で失効 (clearTurnEffects('turn'))
    const next = produce(after, (d) => { mutateAll.char.clearTurnEffects(d, uid, 'turn'); });
    expect(charRead.keywords(next, uid)).not.toContain('突撃[キャラ]');
  });
  it('a2: 宣言名供給 → AP+1000 + カード名 完全置換 (rules/19) / ターン失効で復帰', () => {
    const { after, uid } = enterYukiko();
    const done = produce(after, (d) => {
      activateDeclaredAbility(d, uid, 'a2', { declaredName: '毛利小五郎' });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    expect(charRead.ap(done, uid), 'AP+1000').toBe(6000);
    expect(charRead.names(done, uid), '完全置換 = 印字名を含まない').toEqual(['毛利小五郎']);
    const cleared = produce(done, (d) => { mutateAll.char.clearTurnEffects(d, uid, 'turn'); });
    expect(charRead.names(cleared, uid)).toEqual(['工藤有希子']);
    expect(charRead.ap(cleared, uid)).toBe(5000);
  });
  it('a2: skip (「してもよい」decline = declaredName 未供給) → AP+1000 のみ、名前不変', () => {
    const { after, uid } = enterYukiko();
    const done = produce(after, (d) => {
      activateDeclaredAbility(d, uid, 'a2');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    expect(charRead.ap(done, uid)).toBe(6000);
    expect(charRead.names(done, uid), '空宣言 = 書き換え不発 (engine 空文字防御)').toEqual(['工藤有希子']);
  });
});

// ============== parallels — descriptor 同一性 ==============
describe('batch2 parallels', () => {
  it('B09108P/B09003P は本体と abilities 参照同一 + id/no/imageUrl/rarity のみ差分', () => {
    expect(B09108P.abilities).toBe(B09108.abilities);
    expect(B09003P.abilities).toBe(B09003.abilities);
    expect(B09108P.rarity).toBe('MRP');
    expect(B09003P.rarity).toBe('SRP');
  });
});
