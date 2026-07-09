// hybrid-batch3 manual probes — auto-generator が "no supported ability" で扱えなかった
// 4 枚を **production dispatch 経路** で駆動して novel ability を実測する
// (BUG-171 慣行: engine 内部を bypass しない)。engine / src/cards は変更しない (probe のみ)。
//
// 対象 / 駆動:
//   B01047 黒羽快斗 — triggered action:end selfOnly (optional→sequence: 自身デッキ下 + 手札から
//     【白】lv6以下・[黒羽快斗]以外を1枚登場 + 突撃 grant)。実 emit 形 (cluster3 PR086 idiom)。
//   B01081 安室透   — triggered action:declare (partnerColor黄 / 【ターン1】: choice 上下 →
//     lv7以下1枚まで選びデッキ上/下)。実 emit 形 (hybrid-pilot B02049 idiom)。
//   B05022 「オレがついてる!!」 — event effect:declared event-use (bindPick opp 好きな数 →
//     forEach charOverrideAP 0/turn)。handUseCard 経路。
//   B06104 カッ     — event (partnerColor黒 & 解決編: 全キャラremove + FILE2枚手札 + 【黒】lv7以下登場 +
//     ネクストヒント禁止) + 【ヒラメキ】draw1。handUseCard + evidence:remove-by-action 経路。
//
// rules: 03/07/09/10/12/13/14/15/17/19/20/22

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  _drainPendingEffectPickSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectChoiceSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import {
  applyPickAndContinuation,
  applyOptionalAndContinuation,
  applyChoiceAndContinuation,
} from '@/engine/effect/apply-pick';
import { _peekPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';

import { B01047 } from '@/cards/ct-p01/B01047';
import { B01081 } from '@/cards/ct-p01/B01081';
import { B05022 } from '@/cards/ct-p05/B05022';
import { B06104 } from '@/cards/ct-p06/B06104';

// ---- helpers ----
const setHuman = (s: 'self' | 'opp' | null) =>
  ((globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s);

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  sceneChar(cardId, uid, { state });

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

// fixtures 共通
const FILL = def('FILL');
const FB = { type: 'card-back' as const, cardId: 'FILL' };

// B01047 手札候補 / decoy
const WLOW = def('WLOW', { names: ['白助'], colors: ['白'], level: 6 });      // 有効: 白 lv6 [黒羽快斗]以外
const WHIGH = def('WHIGH', { names: ['白高'], colors: ['白'], level: 7 });     // decoy: lv7 (levelMax6 外)
const KAITODUP = def('KAITODUP', { names: ['黒羽快斗'], colors: ['白'], level: 3 }); // decoy: cardNameNot
const BLOW = def('BLOW', { names: ['青助'], colors: ['青'], level: 3 });       // decoy: 白でない
const WEVENT = { ...def('WEVENT', { names: ['白事件'], colors: ['白'], level: 3 }), kind: 'event' as const }; // decoy: character でない

// B01081 partner
const YPART = def('YPART', { colors: ['黄'] });
const BPART = def('BPART', { colors: ['青'] });
const BPARTK = def('BPARTK', { colors: ['黒'] });

// B05022 / B06104 scene・手札 fixtures
const OPP1 = def('OPP1', { ap: 5000 });
const OPP2 = def('OPP2', { ap: 3000 });
const SELF1 = def('SELF1', { ap: 4000 });
const BCHAR = def('BCHAR', { names: ['黒助'], colors: ['黒'], level: 5 }); // B06104 sceneEnter 候補
const BHIGH = def('BHIGH', { names: ['黒高'], colors: ['黒'], level: 8 }); // decoy: lv8
const RCHAR = def('RCHAR', { names: ['赤助'], colors: ['赤'], level: 3 }); // decoy: 黒でない

const ALL_DEFS: CardDef[] = [
  B01047, B01081, B05022, B06104,
  FILL, WLOW, WHIGH, KAITODUP, BLOW, WEVENT, YPART, BPART, BPARTK,
  OPP1, OPP2, SELF1, BCHAR, BHIGH, RCHAR,
];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK1', 'DK2', 'DK3', 'DK4'];
  s.players.opp.deck = ['ODK1', 'ODK2', 'ODK3', 'ODK4'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  _resetPendingHirameki();
  setHuman('self');
  for (const d of ALL_DEFS) registerCardDef(d);
  registerTriggeredListener();
});

// ============================================================
// B01047 黒羽快斗 — action:end selfOnly → optional[自デッキ下 + 白lv6以下登場 + 突撃]
// ============================================================
describe('B01047 — action:end selfOnly optional 登場+突撃 grant', () => {
  function board() {
    const s = base();
    s.players.self.scene = [sc('B01047', 'kaito')];
    s.players.self.hand = ['WLOW', 'WHIGH', 'KAITODUP', 'BLOW', 'WEVENT'];
    return s;
  }
  const fire = (s: GameState) =>
    event.emit(s, 'action:end', { byUid: 'kaito', result: 'completed' },
      { player: 'self', uid: 'kaito', cardId: 'B01047' });

  it('positive: optional take → 自身デッキ下 + WLOW 登場 (突撃付与) / decoy 4種は候補外', () => {
    const s = board();
    fire(s);
    runAllUntilEmpty(s);

    const opt = _drainPendingEffectOptionalSide();
    expect(opt, 'action:end selfOnly で optional surface').not.toBeNull();
    applyOptionalAndContinuation(s, opt!, true);
    runAllUntilEmpty(s);

    const pick = _drainPendingEffectPickSide();
    expect(pick?.atomVerb, 'sceneEnter pick surface').toBe('sceneEnter');
    const cands = (pick!.candidates as Array<{ cardId: string; uid: string }>).map((c) => c.cardId);
    expect(cands, 'WLOW (白lv6) が候補').toContain('WLOW');
    expect(cands, 'WHIGH (lv7) は levelMax6 で除外').not.toContain('WHIGH');
    expect(cands, 'KAITODUP ([黒羽快斗]) は cardNameNot で除外').not.toContain('KAITODUP');
    expect(cands, 'BLOW (青) は color白 で除外').not.toContain('BLOW');
    expect(cands, 'WEVENT (event) は kind:character で除外').not.toContain('WEVENT');

    const wlow = (pick!.candidates as Array<{ cardId: string; uid: string }>).find((c) => c.cardId === 'WLOW')!;
    applyPickAndContinuation(s, pick!, wlow.uid);
    runAllUntilEmpty(s);

    expect(s.players.self.scene.some((c) => c.cardId === 'B01047'), 'B01047 は現場を離れる').toBe(false);
    expect(s.players.self.deck[s.players.self.deck.length - 1], 'B01047 はデッキの下へ').toBe('B01047');
    expect(s.players.self.scene.some((c) => c.cardId === 'WLOW'), 'WLOW が登場').toBe(true);
    const wlowUid = s.players.self.scene.find((c) => c.cardId === 'WLOW')!.uid;
    expect(readChar.hasKeyword(s, wlowUid, '突撃'), '登場した WLOW に突撃 grant').toBe(true);
  });

  it('negative: optional decline → 自身残存・登場なし', () => {
    const s = board();
    fire(s);
    runAllUntilEmpty(s);
    const opt = _drainPendingEffectOptionalSide();
    expect(opt).not.toBeNull();
    applyOptionalAndContinuation(s, opt!, false);
    runAllUntilEmpty(s);

    expect(s.players.self.scene.some((c) => c.cardId === 'B01047'), 'B01047 は現場に残る').toBe(true);
    expect(s.players.self.scene.some((c) => c.cardId === 'WLOW'), '登場していない').toBe(false);
    expect(_drainPendingEffectPickSide(), '登場 pick は出ない').toBeNull();
  });

  it('negative: 別キャラの action:end (selfOnly) → 不発', () => {
    const s = board();
    s.players.self.scene.push(sc('SELF1', 'other'));
    event.emit(s, 'action:end', { byUid: 'other', result: 'completed' },
      { player: 'self', uid: 'other', cardId: 'SELF1' });
    runAllUntilEmpty(s);
    expect(_drainPendingEffectOptionalSide(), '他キャラの action:end では optional 出ない').toBeNull();
  });
});

// ============================================================
// B01081 安室透 — action:declare (partnerColor黄 / turn1) → choice 上下 → lv7以下1枚まで deck
// ============================================================
describe('B01081 — action:declare 観測 → choice deck 上下', () => {
  function board(partner = 'YPART') {
    const s = base();
    s.players.self.partner.cardId = partner;
    s.players.self.scene = [sc('B01081', 'amuro'), sc('SELF1', 'act')];
    s.players.opp.scene = [sc('OPP1', 'tgt'), sc('BHIGH', 'hi')]; // tgt lv3 / hi lv8(decoy)
    return s;
  }
  const declare = (s: GameState, byUid: string) =>
    event.emit(s, 'action:declare',
      { byUid, target: { kind: 'case', player: 'opp' }, uid: byUid, player: 'self', targetUid: undefined },
      { player: 'self', uid: byUid });

  it('positive: 黄P → choice(上) → lv7以下 tgt を選びデッキ上 / lv8 decoy は候補外', () => {
    const s = board();
    declare(s, 'act');
    runAllUntilEmpty(s);

    const cside = _drainPendingEffectChoiceSide();
    expect(cside, 'partner黄 → choice surface').not.toBeNull();
    applyChoiceAndContinuation(s, cside!, 0); // option0 = デッキ上
    runAllUntilEmpty(s);

    const pick = _drainPendingEffectPickSide();
    expect(pick?.atomVerb, 'sceneToDeck pick surface').toBe('sceneToDeck');
    const cands = (pick!.candidates as Array<{ cardId: string; uid: string }>).map((c) => c.cardId);
    expect(cands, 'lv7以下の tgt/act/amuro が候補').toContain('OPP1');
    expect(cands, 'BHIGH (lv8) は levelMax7 で除外').not.toContain('BHIGH');

    const tgt = (pick!.candidates as Array<{ cardId: string; uid: string }>).find((c) => c.cardId === 'OPP1')!;
    applyPickAndContinuation(s, pick!, tgt.uid);
    runAllUntilEmpty(s);

    expect(s.players.opp.scene.some((c) => c.uid === 'tgt'), 'tgt は現場を離れる').toBe(false);
    expect(s.players.opp.deck[0], 'tgt(OPP1) は所有者(相手)デッキ上へ').toBe('OPP1');
  });

  it('negative: 青P → condition 不成立で choice 出ない', () => {
    const s = board('BPART');
    declare(s, 'act');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectChoiceSide(), 'partnerColor黄 不成立').toBeNull();
    expect(_drainPendingEffectPickSide(), 'pick も無し').toBeNull();
  });

  it('negative: 【ターン1】→ 2回目の action:declare は不発', () => {
    const s = board();
    // 1回目 fire (limit を消費) — choice を解決まで通す
    declare(s, 'act');
    runAllUntilEmpty(s);
    const c1 = _drainPendingEffectChoiceSide();
    expect(c1, '1回目は fire').not.toBeNull();
    applyChoiceAndContinuation(s, c1!, 0);
    runAllUntilEmpty(s);
    const p1 = _drainPendingEffectPickSide();
    if (p1) { applyPickAndContinuation(s, p1, (p1.candidates as Array<{ uid: string }>)[0]!.uid); runAllUntilEmpty(s); }
    _clearPendingEffectPickQueue();
    _clearPendingEffectOptionalSide();

    // 2回目 fire → limit 消費済で不発
    declare(s, 'act');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectChoiceSide(), '2回目は【ターン1】で不発').toBeNull();
  });
});

// ============================================================
// B05022 「オレがついてる!!」 — event-use → bindPick opp 好きな数 → charOverrideAP 0/turn
// ============================================================
describe('B05022 — event-use → 相手キャラ 元AP0 (turn)', () => {
  function board() {
    const s = base();
    s.players.self.hand = ['B05022'];
    s.players.self.case.colors = ['青'];
    s.players.self.file = Array.from({ length: 4 }, () => ({ ...FB })); // level4 ≤ FILE
    s.players.self.scene = [sc('SELF1', 'sc1')]; // side:opp なので候補外 (decoy)
    s.players.opp.scene = [sc('OPP1', 'o1'), sc('OPP2', 'o2')];
    return s;
  }

  it('positive: 相手2体を選択 → 両者 元AP0 / 自陣キャラは候補外', () => {
    const s = board();
    expect(readChar.ap(s, 'o1'), 'baseline OPP1').toBe(5000);
    expect(readChar.ap(s, 'o2'), 'baseline OPP2').toBe(3000);

    handUseCard(s, 'self', 'B05022');
    runAllUntilEmpty(s);
    expect(s.players.self.remove, 'イベントは使用済 (rules/06)').toContain('B05022');

    const pick = _drainPendingEffectPickSide();
    expect(pick?.atomVerb, 'bindPick surface').toBe('bindPick');
    const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
    const cids = cands.map((c) => c.cardId).sort();
    expect(cids, 'side:opp → 相手2体のみ (自陣 SELF1 は候補外)').toEqual(['OPP1', 'OPP2']);
    expect(cands.some((c) => c.cardId === 'SELF1'), '自陣キャラは候補に無い').toBe(false);

    const uids = cands.map((c) => c.uid);
    applyPickAndContinuation(s, pick!, uids[0]!, uids);
    runAllUntilEmpty(s);

    expect(readChar.ap(s, 'o1'), 'OPP1 元AP0').toBe(0);
    expect(readChar.ap(s, 'o2'), 'OPP2 元AP0').toBe(0);
  });

  it('negative: 1体のみ選択 → 選んだ側のみ0 / 非選択キャラは不変', () => {
    const s = board();
    handUseCard(s, 'self', 'B05022');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    const o1 = (pick!.candidates as Array<{ uid: string; cardId: string }>).find((c) => c.cardId === 'OPP1')!;
    applyPickAndContinuation(s, pick!, o1.uid, [o1.uid]);
    runAllUntilEmpty(s);

    expect(readChar.ap(s, 'o1'), '選んだ OPP1 は 0').toBe(0);
    expect(readChar.ap(s, 'o2'), '非選択 OPP2 は 3000 のまま').toBe(3000);
  });
});

// ============================================================
// B06104 カッ — event (partner黒 & 解決編) 全remove + FILE2手札 + 黒lv7以下登場 + NH禁止 / 【ヒラメキ】
// ============================================================
describe('B06104 a1 — event-use (partner黒 & 解決編)', () => {
  function board(status: '事件編' | '解決編' = '解決編', partner = 'BPARTK') {
    const s = base();
    s.players.self.hand = ['B06104', 'BCHAR', 'BHIGH', 'RCHAR'];
    s.players.self.partner.cardId = partner;
    s.players.self.case.colors = ['黒'];
    s.players.self.case.status = status as GameState['players']['self']['case']['status'];
    s.players.self.file = Array.from({ length: 7 }, () => ({ ...FB })); // level7 ≤ FILE
    s.players.self.scene = [sc('SELF1', 'sc1')];
    s.players.opp.scene = [sc('OPP1', 'o1')];
    return s;
  }

  it('positive: 全キャラremove + FILE2枚手札 + 黒lv7以下登場 (decoy除外) + ネクストヒント禁止', () => {
    // filePopToHand が Immer current() を呼ぶため produce 内で駆動する
    const after = produce(board('解決編', 'BPARTK'), (d) => {
      handUseCard(d, 'self', 'B06104');
      runAllUntilEmpty(d);

      expect(d.players.opp.scene.some((c) => c.uid === 'o1'), '相手キャラ remove').toBe(false);
      expect(d.players.self.hand.filter((c) => c === 'FILL').length, 'FILE 2枚が手札へ').toBe(2);

      const pick = _drainPendingEffectPickSide();
      expect(pick?.atomVerb, 'sceneEnter pick surface').toBe('sceneEnter');
      const cands = (pick!.candidates as Array<{ cardId: string; uid: string }>).map((c) => c.cardId);
      expect(cands, 'BCHAR (黒lv5) が候補').toContain('BCHAR');
      expect(cands, 'BHIGH (lv8) は levelMax7 で除外').not.toContain('BHIGH');
      expect(cands, 'RCHAR (赤) は color黒 で除外').not.toContain('RCHAR');

      const bchar = (pick!.candidates as Array<{ cardId: string; uid: string }>).find((c) => c.cardId === 'BCHAR')!;
      applyPickAndContinuation(d, pick!, bchar.uid);
      runAllUntilEmpty(d);
    });

    expect(after.players.self.scene.some((c) => c.cardId === 'BCHAR'), 'BCHAR 登場').toBe(true);
    expect(after.players.self.scene.some((c) => c.cardId === 'SELF1'), '元の自陣キャラも remove 済').toBe(false);
    expect(after.turnState.self.nextHintBanned, 'このターン ネクストヒント禁止').toBe(true);
  });

  it('negative: 事件編 → condition 不成立で不発 (キャラ残存・pick なし)', () => {
    const s = board('事件編', 'BPARTK');
    handUseCard(s, 'self', 'B06104');
    runAllUntilEmpty(s);

    expect(s.players.opp.scene.some((c) => c.uid === 'o1'), '事件編では remove しない').toBe(true);
    expect(s.players.self.scene.some((c) => c.uid === 'sc1'), '自陣も不変').toBe(true);
    expect(_drainPendingEffectPickSide(), 'sceneEnter pick も出ない').toBeNull();
    expect(s.turnState.self.nextHintBanned ?? false, 'NH禁止も立たない').toBe(false);
    expect(s.players.self.remove, 'イベント自体は使用済').toContain('B06104');
  });

  it('negative: 青P → condition 不成立で不発', () => {
    const s = board('解決編', 'BPART'); // 青 partner
    handUseCard(s, 'self', 'B06104');
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.some((c) => c.uid === 'o1'), 'partner黒 不成立で remove しない').toBe(true);
    expect(_drainPendingEffectPickSide()).toBeNull();
  });
});

describe('B06104 a2 — 【ヒラメキ】evidence:remove-by-action で pending push', () => {
  it('positive: B06104 が証拠から action リムーブ → pendingHirameki push (a2)', () => {
    const s = base();
    event.emit(s, 'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'B06104' }, byUid: 'atk' },
      { player: 'self', uid: 'atk' });
    const pend = _peekPendingHirameki();
    expect(pend, 'B06104 のヒラメキが pending へ').not.toBeNull();
    expect(pend!.cardId).toBe('B06104');
    expect(pend!.abilityId).toBe('a2');
  });

  it('negative: ヒラメキ非所持カード (FILL) → push なし', () => {
    const s = base();
    event.emit(s, 'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'FILL' }, byUid: 'atk' },
      { player: 'self', uid: 'atk' });
    expect(_peekPendingHirameki(), 'ヒラメキ無しカードは push しない').toBeNull();
  });

  // MANUAL-NOTE: a2 の draw1 実行は UI 委譲 (hiramekiResolve dispatch / useHiramekiFlowDriver)。
  // engine 層では pendingHirameki への push までが観測点 (listeners/hirameki.ts)。
  // 実 draw の end-to-end は store 経路 (dispatchEngineAction) が必要なため本 probe では push を pin。
});
