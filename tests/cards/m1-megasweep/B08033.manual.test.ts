// tests/cards/m1-megasweep/B08033.manual — 工藤有希子 手書き probe (engine 実評価)
//
// 公式テキスト (payload fullTexts.effect):
//   【登場時】自分の現場にいるキャラ1枚につき、自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//   【パートナー白】【宣言】【ターン2】〚現場にいるキャラに裏向きでセットされているカードを合わせて2枚
//     リムーブする〛：【白】のキャラを1枚まで選び、ターン終了時までAP＋2000し、〚突撃［キャラ］〛
//     （登場したターンからすぐにキャラを指定してアクションできる）を与える。
//
// novel 句 (2 refusedLine、全て engine 実評価で踏む):
//   a1 (登場時): trigger enter selfOnly / effect forEach over{all scene self} → charSetCard
//       {uid:$self, fromDeckTop:true, player:self} = 自現場キャラ数だけ deck 上端を **裏向き** で
//       B08033 自身にセット。QA「このキャラ自身も数える」/「デッキ不足はリフレッシュして残りをセット」。
//   a2 (宣言): condition partnerColor:白 / limit turn 2 / cost removeSetCard n:2 (自現場の裏向きセット
//       合わせて2枚) / effect sequence[ charModifyAP 短縮形 carrier {max:1, side:either, filter:{color:白},
//       delta:2000, scope:turn, bind:$picked} → charGrantKeyword {uid:$picked.uid, kw:突撃[キャラ], scope:turn} ]。
//
// 検証の核 (BUG-117/118: DSL に filter を書いても engine が実評価する保証はない):
//   - a2 condition = partnerColor:白 を canDeclaredAbility が実 gate (白でなければ宣言不可、rules/17)。
//   - a2 cost removeSetCard n:2 を canPay が実 gate (裏向きセット合計<2 なら不可、rules/21)。
//   - charModifyAP filter{color:白} + 突撃[キャラ] rider が同一 picked char に carrier-bind で乗る。
//   - 「1枚まで」= 0-pick 許容 (rules/15)、decline でも declaredUseCount カウント (rules/24)。
//   - owner=opp で cost/effect の player が反転しない (BUG-174)。
//
// production dispatch: a1 = 実 enter emit / a2 = activateDeclaredAbility + runAllUntilEmpty (BUG-171)。
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md,
//        21-declared-ability-cost.md, 24-qa-naming-stun.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { canPay } from '@/engine/cost/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
  _peekPendingEffectPickQueueLength,
} from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { char as readChar } from '@/engine/read/char';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../../helpers/fixtures';
import { B08033 } from '@/cards/ct-p08/B08033';
import type { GameState, CardDef, EffectCtx, Player } from '@/engine/types';

const setHuman = (s: Player | null) => {
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s;
};
const queue = (): PendingEffectPickSide[] =>
  (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue ?? [];

// synthetic char factory (色を明示 — charModifyAP filter{color:白} の実評価を可視化)
function cdef(id: string, colors: string[], over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9999/${id}`, kind: 'character', names: [id], colors,
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}
const WHITE = cdef('WHITE', ['白']);        // charModifyAP filter{color:白} 一致
const REDDECOY = cdef('REDDECOY', ['赤']);  // color decoy (白でない) → 候補外
const PLAIN = cdef('PLAIN', ['青']);        // a1 forEach 用の追加現場キャラ (色任意)
const PW = cdef('PW', ['白'], { kind: 'partner' });   // 白 パートナー (condition 成立)
const PR = cdef('PR', ['赤'], { kind: 'partner' });   // 非白 パートナー (condition off-variant)

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B08033);
  registerCardDef(WHITE); registerCardDef(REDDECOY); registerCardDef(PLAIN);
  registerCardDef(PW); registerCardDef(PR);
  registerTriggeredListener();
  setHuman(null);
});

function base(owner: Player, partnerId: string): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  s.players[owner].partner = { cardId: partnerId, state: 'active', location: 'partner-area' };
  return s;
}

// 裏向きセット済みキャラを作る (a2 cost removeSetCard の在庫)
function withSetCards(cardId: string, uid: string, faceDownIds: string[]) {
  return sceneChar(cardId, uid, { setCards: faceDownIds.map((cid) => ({ cardId: cid, faceUp: false })) });
}

// ============================================================
// shape
// ============================================================
describe('B08033 工藤有希子 — shape', () => {
  it('id/no/色/lv/ap/特徴 + a1 enter selfOnly forEach / a2 declared partnerColor白 limit2 cost removeSetCard n2', () => {
    expect(B08033.id).toBe('B08033');
    expect(B08033.no).toBe('0872/B08033');
    expect(B08033.colors).toEqual(['白']);
    expect(B08033.level).toBe(8);
    expect(B08033.ap).toBe(7000);
    expect(B08033.traits).toEqual(['女優']);

    const a1 = B08033.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('enter');
    expect(a1.trigger?.selfOnly).toBe(true);
    expect(a1.effect?.kind).toBe('forEach');

    const a2 = B08033.abilities[1];
    expect(a2.type).toBe('declared');
    expect(a2.condition).toMatchObject({ kind: 'partnerColor', color: '白' });
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 2 });
    expect(a2.cost).toMatchObject({ kind: 'removeSetCard', n: 2 });
  });
});

// ============================================================
// a1 — 登場時: 自現場キャラ1枚につき deck 上端1枚を裏向きで B08033 自身にセット
// ============================================================
describe('B08033 a1 — 登場時 charSetCard forEach (自現場キャラ数だけ裏向きセット)', () => {
  it('S1 happy: 自現場に他2体 + B08033 登場 (計3体) → 上端3枚を裏向きで B08033 にセット、deck -3 (QA: 自身も数える)', () => {
    let s = base('self', 'PW');
    s.players.self.scene = [sceneChar('PLAIN', 'p1'), sceneChar('PLAIN', 'p2')]; // 先在 2 体
    s.players.self.deck = ['D1', 'D2', 'D3', 'D4'];
    let hostUid = '';
    s = produce(s, (d) => {
      const c = mutate.scene.enter(d, 'self', 'B08033', {});
      hostUid = c.uid;
      event.emit(d, 'enter', { uid: c.uid, player: 'self', enterOrder: 3, enterOrderThisTurn: 1 },
        { player: 'self', cardId: 'B08033', uid: c.uid });
      runAllUntilEmpty(d);
    });
    const host = s.players.self.scene.find((c) => c.uid === hostUid)!;
    expect(host.setCards.length, '3 体 → 3 枚セット (self も計上)').toBe(3);
    // 裏向き = faceUp !== true (card は faceUp 引数を渡さず undefined でセット。engine の face-down
    // 契約は faceUp!==true — removeSetCard の !e.faceUp が undefined を裏向きとして計数する)
    expect(host.setCards.every((e) => e.faceUp !== true), '全て裏向き (faceUp!==true, rules/16)').toBe(true);
    expect(host.setCards.map((e) => e.cardId), 'deck 上端から順に').toEqual(['D1', 'D2', 'D3']);
    expect(s.players.self.deck, '上端3枚消費').toEqual(['D4']);
    // 先在キャラにはセットしない (uid:$self = B08033 のみ)
    expect(s.players.self.scene.find((c) => c.uid === 'p1')!.setCards.length, '他キャラは host でない').toBe(0);
  });

  it('S2 refresh (QA): 自現場2体 + deck1枚 → 1枚セット後 deck0 → リフレッシュして残り1枚セット (計2枚)', () => {
    let s = base('self', 'PW');
    s.players.self.scene = [sceneChar('PLAIN', 'p1')]; // 先在 1 体
    s.players.self.deck = ['D1'];                       // deck 1枚のみ (2体に足りない)
    s.players.self.remove = ['R1', 'R2'];               // refresh 在庫
    const oppEv0 = s.players.opp.evidence.length;
    let hostUid = '';
    s = produce(s, (d) => {
      const c = mutate.scene.enter(d, 'self', 'B08033', {});
      hostUid = c.uid;
      event.emit(d, 'enter', { uid: c.uid, player: 'self', enterOrder: 2, enterOrderThisTurn: 1 },
        { player: 'self', cardId: 'B08033', uid: c.uid });
      runAllUntilEmpty(d);
    });
    const host = s.players.self.scene.find((c) => c.uid === hostUid)!;
    expect(host.setCards.length, '2体 → 2枚セット (deck0 で refresh 後に継続)').toBe(2);
    expect(s.players.self.deck.length, 'refresh(remove2→deck) 後 1枚消費 → 残1').toBe(1);
    expect(s.players.opp.evidence.length, 'リフレッシュで相手が証拠+1 (rules/14)').toBe(oppEv0 + 1);
  });
});

// ============================================================
// a2 — 宣言: cost 裏向きセット2枚リムーブ → 白キャラに AP+2000 + 突撃[キャラ]
// ============================================================
describe('B08033 a2 — 宣言 (partnerColor白 / cost removeSetCard n2 / 白キャラ AP+2000 + 突撃[キャラ])', () => {
  const declareCtx = (uid: string): EffectCtx =>
    ({ source: { cardId: 'B08033', uid, abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} });

  it('S3 gate: partnerColor白 を canDeclaredAbility が実 gate / cost removeSetCard n2 を canPay が実 gate', () => {
    // condition off-variant: パートナー非白 → 宣言不可
    const sRed = base('self', 'PR');
    sRed.players.self.scene = [withSetCards('B08033', 'yuki', ['S1', 'S2'])];
    expect(canDeclaredAbility(sRed, 'yuki', 'a2'), '非白パートナー → condition 未達で宣言不可').toBe(false);

    // condition 成立: パートナー白 → 宣言可
    const sWhite = base('self', 'PW');
    sWhite.players.self.scene = [withSetCards('B08033', 'yuki', ['S1', 'S2'])];
    expect(canDeclaredAbility(sWhite, 'yuki', 'a2'), '白パートナー → 宣言可').toBe(true);

    // cost gate: 裏向きセット合計 <2 → canPay false
    const cost = B08033.abilities[1].cost!;
    const ctx = declareCtx('yuki');
    const oneOnly = base('self', 'PW');
    oneOnly.players.self.scene = [withSetCards('B08033', 'yuki', ['S1'])]; // 裏向き1枚のみ
    expect(canPay(oneOnly, cost, ctx), '裏向きセット1枚 → n2 払えず不可').toBe(false);
    expect(canPay(sWhite, cost, ctx), '裏向きセット2枚 → 払える').toBe(true);
  });

  it('S4 happy: cost で B08033 の裏向き2枚除去 → 白キャラに AP+2000 & 突撃[キャラ] / 赤 decoy は不変', () => {
    setHuman('self'); // pending pick を覗いて候補集合を decoy 検証
    let s = base('self', 'PW');
    s.players.self.scene = [
      withSetCards('B08033', 'yuki', ['S1', 'S2']), // cost 在庫 (裏向き2枚)
      sceneChar('WHITE', 'w1'),                     // charModifyAP 対象 (白)
      sceneChar('REDDECOY', 'r1'),                  // color decoy (赤) → 候補外
    ];
    expect(readChar.ap(s, 'w1')).toBe(3000);
    expect(readChar.keywords(s, 'w1')).not.toContain('突撃[キャラ]');

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'yuki', 'a2', { removeSetCard: { hostUids: ['yuki', 'yuki'], instanceIds: ['set:1', 'set:2'] } });
      runAllUntilEmpty(d);
    });
    // cost: B08033 の裏向きセット2枚が除去された
    expect(s.players.self.scene.find((c) => c.uid === 'yuki')!.setCards.length, 'cost で裏向き2枚除去').toBe(0);
    // pick surface — 候補は 白キャラ (side:either color:白)。赤 decoy は候補外
    expect(_peekPendingEffectPickQueueLength(), 'charModifyAP pick surface').toBe(1);
    const pending = queue()[0]!;
    expect(pending.atomVerb).toBe('charModifyAP');
    expect(pending.nMin, '「1枚まで」= 0枚可').toBe(0);
    const cands = pending.candidates.map((c) => c.uid);
    expect(cands, '白キャラ w1 は候補').toContain('w1');
    expect(cands, '赤 decoy r1 は候補外 (filter{color:白})').not.toContain('r1');

    // 白キャラを pick → carrier-bind で AP+2000 + 突撃[キャラ] rider が同一 char に乗る
    s = produce(s, (d) => applyPickAndContinuation(d, pending, 'w1'));
    expect(readChar.ap(s, 'w1'), '白キャラ AP+2000 → 5000').toBe(5000);
    expect(readChar.keywords(s, 'w1'), '同一 picked char に突撃[キャラ]付与 (carrier rider)').toContain('突撃[キャラ]');
    // decoy: 赤キャラは AP/keyword 不変
    expect(readChar.ap(s, 'r1'), '赤 decoy AP 不変').toBe(3000);
    expect(readChar.keywords(s, 'r1'), '赤 decoy 突撃なし').not.toContain('突撃[キャラ]');
    // 【ターン2】: 1回使用済 → まだ宣言可 (n:2)。cost 在庫は無いので canDeclaredAbility は true (cost 別 gate)
    expect(readChar.declaredUseCount(s, 'yuki', 'a2'), '1回発動でカウント1').toBe(1);
    expect(canDeclaredAbility(s, 'yuki', 'a2'), 'limit turn 2 → 1回後もまだ宣言可').toBe(true);
  });

  it('S5 decline (0-pick): 白キャラが居ても辞退 → AP/突撃なし、cost は支払済 & declaredUseCount カウント (rules/15,24)', () => {
    setHuman('self');
    let s = base('self', 'PW');
    s.players.self.scene = [
      withSetCards('B08033', 'yuki', ['S1', 'S2']),
      sceneChar('WHITE', 'w1'),
    ];
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'yuki', 'a2', { removeSetCard: { hostUids: ['yuki', 'yuki'] } });
      runAllUntilEmpty(d);
    });
    const pending = queue()[0]!;
    expect(pending.nMin, '0枚可').toBe(0);
    _clearPendingEffectPickQueue();
    s = produce(s, (d) => applyPickSkipAndContinuation(d, pending));

    expect(readChar.ap(s, 'w1'), 'decline: AP 不変').toBe(3000);
    expect(readChar.keywords(s, 'w1'), 'decline: 突撃なし').not.toContain('突撃[キャラ]');
    expect(s.players.self.scene.find((c) => c.uid === 'yuki')!.setCards.length, 'cost は支払済 (裏向き2枚除去)').toBe(0);
    expect(readChar.declaredUseCount(s, 'yuki', 'a2'), '辞退でも発動済み扱いでカウント').toBe(1);
  });

  it('S6 owner=opp (BUG-174): opp の B08033 が opp ターンに宣言 → opp の裏向き除去 & opp 白キャラ強化 (反転しない)', () => {
    setHuman('opp');
    let s = base('opp', 'PW'); // opp ターン + opp パートナー白
    s.players.opp.scene = [
      withSetCards('B08033', 'yuki', ['S1', 'S2']),
      sceneChar('WHITE', 'w1'),
    ];
    s.players.self.scene = [withSetCards('WHITE', 'selfw', ['X1', 'X2'])]; // 自陣 (反転検出用 decoy)

    expect(canDeclaredAbility(s, 'yuki', 'a2'), 'opp 側でも白パートナーで宣言可').toBe(true);
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'yuki', 'a2', { removeSetCard: { hostUids: ['yuki', 'yuki'] } });
      runAllUntilEmpty(d);
    });
    // cost は opp 側から除去 (self の裏向きは不変 = player 反転なし)
    expect(s.players.opp.scene.find((c) => c.uid === 'yuki')!.setCards.length, 'opp 裏向き2枚除去').toBe(0);
    expect(s.players.self.scene.find((c) => c.uid === 'selfw')!.setCards.length, 'self 裏向きは不変 (cost 反転なし)').toBe(2);

    const pending = queue()[0]!;
    s = produce(s, (d) => applyPickAndContinuation(d, pending, 'w1'));
    expect(readChar.ap(s, 'w1'), 'opp 白キャラ AP+2000').toBe(5000);
    expect(readChar.keywords(s, 'w1'), 'opp 白キャラに突撃[キャラ]').toContain('突撃[キャラ]');
  });
});
