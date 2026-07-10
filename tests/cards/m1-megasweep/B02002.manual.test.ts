// B02002 江戸川コナン (ct-p02) — 手書き probe。全 novel 句を engine 実評価で踏む。
//
// カードテキスト (payload fullTexts.effect):
//   a1 【登場時】自分の現場にレベル7以上の【青】以外の色を持つキャラがいる場合、ターン終了時までこのキャラは
//        〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//   a2 【ターン1】このキャラがアクションしたとき、自分の現場にいる【青】以外の色を持つキャラ1枚につき、
//        アクション終了時までこのキャラを AP＋1000 する。
//
// 検証設計:
//   §1 a1 ON  — 現場に「レベル7以上 かつ 【青】以外」キャラがいる → enter で 突撃 付与。
//   §2 a1 OFF — 条件不成立 (Lv7だが青 / 非青だが Lv6 の decoy のみ) → 突撃 非付与。
//   §3 a2     — action:declare で「現場の【青】以外の色を持つキャラ」数×1000 の AP+ (青decoyは除外)。
//   §4 a2 ZERO— 現場が青キャラのみ → AP+0 (colorNot decoy 除外の裏取り)。
//   §5 owner=opp (BUG-174) — B02002 が opp 所有でも dyn side が反転せず opp 現場基準で +2000。
// 経路: enter は event.emit('enter'), action は flow/action/state-machine.declare — production dispatch。
// rules: 07/13/15/17/20/22

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { declare, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { makeChar } from '../../helpers/fixtures';
import type { CardDef, GameState, Side } from '@/engine/types';
import { B02002 } from '@/cards/ct-p02/B02002';

// 汎用 decoy def (色/レベル可変、能力なし)
function plain(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 5, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...over,
  };
}

function base(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.players.self.partner = { cardId: 'P-self', state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: 'P-opp', state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: 'cs', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
  s.players.opp.case = { cardId: 'co', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
  s.players.self.deck.push('d1', 'd2', 'd3', 'd4', 'd5');
  s.players.opp.deck.push('e1', 'e2', 'e3');
  s.turn = { number: 3, player: 'self' } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();      // handler 累積 (N重発火) 防止
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetActionContexts();
  _resetUidCounter();
});

// enter hook を production 経路 (event.emit) で駆動
function emitEnter(d: GameState, uid: string, cardId: string, side: Side): void {
  event.emit(
    d,
    'enter',
    { uid, viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1, sourceCardId: undefined },
    { player: side, uid, cardId },
  );
  runAllUntilEmpty(d);
}

describe('B02002 §1 — a1【登場時】: Lv7以上 かつ 【青】以外 のキャラがいれば 突撃 付与', () => {
  it('現場に Lv7 赤キャラ (条件一致) → 登場した B02002 が 突撃 を持つ', () => {
    registerCardDef(B02002);
    registerCardDef(plain('R7', { colors: ['赤'], level: 7 })); // Lv7 & 非青 = 条件充足
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'konan', cardId: 'B02002', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'r7', cardId: 'R7', state: 'active' }));

    const after = produce(s, (d) => emitEnter(d, 'konan', 'B02002', 'self'));
    expect(read.char.hasKeyword(after, 'konan', '突撃'), 'a1 条件成立で突撃付与').toBe(true);
  });
});

describe('B02002 §2 — a1 OFF: 条件不成立 (decoy) では 突撃 非付与', () => {
  it('Lv7だが青 / 非青だが Lv6 の decoy のみ → 突撃 を持たない', () => {
    registerCardDef(B02002);
    registerCardDef(plain('B7', { colors: ['青'], level: 7 })); // Lv7 だが青 → colorNot 不一致
    registerCardDef(plain('R6', { colors: ['赤'], level: 6 })); // 非青 だが Lv6 → levelMin 不一致
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'konan', cardId: 'B02002', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'b7', cardId: 'B7', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'r6', cardId: 'R6', state: 'active' }));

    const after = produce(s, (d) => emitEnter(d, 'konan', 'B02002', 'self'));
    expect(read.char.hasKeyword(after, 'konan', '突撃'), 'B02002自身(Lv7青)も含め条件充足キャラ不在 → 非付与').toBe(false);
  });
});

describe('B02002 §3 — a2 action:declare: 現場の【青】以外キャラ数×1000 の AP+', () => {
  it('赤+黄 の2枚 (青decoy/B02002自身は除外) → AP+2000', () => {
    registerCardDef(B02002);
    registerCardDef(plain('RED', { colors: ['赤'] }));
    registerCardDef(plain('YEL', { colors: ['黄'] }));
    registerCardDef(plain('BLU', { colors: ['青'] })); // 青 decoy → sceneColorNot.青 で除外される
    registerCardDef(plain('TGT'));
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'konan', cardId: 'B02002', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'red', cardId: 'RED', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'yel', cardId: 'YEL', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'blu', cardId: 'BLU', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'tgt', cardId: 'TGT', state: 'sleep' }));

    const apBefore = read.char.ap(s, 'konan');
    const after = produce(s, (d) => {
      declare(d, 'konan', { kind: 'char', uid: 'tgt' });
      runAllUntilEmpty(d);
    });
    // 非青 = RED,YEL の2枚 (青BLU/自身青は除外) → +2000
    expect(read.char.ap(after, 'konan') - apBefore, 'AP delta = 非青2枚×1000').toBe(2000);
    expect(read.char.ap(after, 'konan'), 'base5000+2000').toBe(7000);
  });
});

describe('B02002 §4 — a2 ZERO: 現場が青キャラのみ → AP+0 (colorNot decoy 全除外)', () => {
  it('B02002 + 青decoy のみ → AP 不変', () => {
    registerCardDef(B02002);
    registerCardDef(plain('BLU', { colors: ['青'] }));
    registerCardDef(plain('TGT'));
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'konan', cardId: 'B02002', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'blu', cardId: 'BLU', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'tgt', cardId: 'TGT', state: 'sleep' }));

    const apBefore = read.char.ap(s, 'konan');
    const after = produce(s, (d) => {
      declare(d, 'konan', { kind: 'char', uid: 'tgt' });
      runAllUntilEmpty(d);
    });
    expect(read.char.ap(after, 'konan') - apBefore, '非青0枚 → AP+0').toBe(0);
  });
});

describe('B02002 §5 — owner=opp (BUG-174): 所有者反転でも opp 現場基準で発火', () => {
  it('opp ターン・opp 所有 B02002 が action → opp 現場の非青2枚で AP+2000', () => {
    registerCardDef(B02002);
    registerCardDef(plain('RED', { colors: ['赤'] }));
    registerCardDef(plain('GRN', { colors: ['緑'] }));
    registerCardDef(plain('BLU', { colors: ['青'] })); // opp 現場の青 decoy → 除外
    registerCardDef(plain('TGT'));
    registerTriggeredListener();
    const s = base();
    s.turn = { number: 4, player: 'opp' } as GameState['turn'];
    s.players.opp.scene.push(makeChar({ uid: 'konan', cardId: 'B02002', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'red', cardId: 'RED', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'grn', cardId: 'GRN', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'blu', cardId: 'BLU', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'tgt', cardId: 'TGT', state: 'sleep' }));

    const apBefore = read.char.ap(s, 'konan');
    const after = produce(s, (d) => {
      declare(d, 'konan', { kind: 'char', uid: 'tgt' });
      runAllUntilEmpty(d);
    });
    // dyn side が self にハードコードされていれば self 現場(TGTのみ=非青1)基準で誤発火する。
    // 正しくは ctx.source.player=opp → opp 現場の非青(RED,GRN)=2枚 → +2000。
    expect(read.char.ap(after, 'konan') - apBefore, 'owner=opp でも opp 現場基準 +2000').toBe(2000);
  });
});
