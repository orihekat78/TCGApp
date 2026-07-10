// tests/cards/m2-attribution/p08-costpaid — 高橋良一(B08041) / 安室透(B08068) 手書き probe
//
// attribution mini-wave ② costPaid 束: cost pay() が導出値を ctx.costPaid へ書込み、
// 後続 conditional / dyn がそれを実評価する経路を production dispatch で踏む。
//
// B08041 (removeSetCard の kind 分岐):
//   a1 【登場時】charSetCard{uid:$self, fromDeckTop, faceUp:false} = デッキ上1枚を裏向きで自身にセット。
//   a2 【宣言】【ターン1】cost removeSetCard{n:1} → costPaid['removeSetCard'].kinds を
//      costRemovedMatches{key:'removeSetCard', filter:{kind:'character'|'event'}} が読み、
//      character → charModifyAP{uid:$self,+2000,turn} / event → charModifyLP{uid:$self,+1,turn}。
//      1 removal ゆえ char/event どちらか一方の branch のみ発火 (2 conditional を sequence)。
// B08068 (revealFromHand count 合成 dyn):
//   a1 【宣言】【スリープ】cost revealFromHand{trait:喫茶ポアロ, kind:character, n:{min:0,max:99}} →
//      costPaid['revealFromHand'].count と $self.sceneTrait.喫茶ポアロ を合成した dyn
//      '$cost.revealFromHand.count + $self.sceneTrait.喫茶ポアロ' が sceneRemove の levelMax を決める。
//      公式Q&A「1枚も公開せずに宣言できます」= min:0 (0 公開時 dyn=盤面計数のみ)。
//
// 検証の核 (BUG-117/118: DSL に書いても engine が実評価する保証はない):
//   - costRemovedMatches{key,filter.kind} が cost で除去した裏向きセットカードの印字 kind を実 gate。
//   - revealFromHand count + sceneTrait 盤面計数の合成 dyn が sceneRemove levelMax を実駆動。
//   - owner=opp で cost/effect の player が反転しない (BUG-174)。
//   - 条件外 decoy (逆 kind / levelMax 超過 / 非ポアロ手札) を非発火・非対象で pin。
//
// production dispatch (BUG-171): a1 = 実 enter emit / declared = activateDeclaredAbility + runAllUntilEmpty。
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { canPay } from '@/engine/cost/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
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
import { B08041 } from '@/cards/ct-p08/B08041';
import { B08068 } from '@/cards/ct-p08/B08068';
import type { GameState, CardDef, EffectCtx, Player } from '@/engine/types';

const setHuman = (s: Player | null) => {
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s;
};
const queue = (): PendingEffectPickSide[] =>
  (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue ?? [];

function cdef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9999/${id}`, kind: 'character', names: [id], colors: ['白'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}
// B08041 用: cost 除去対象の裏向きセットカード (kind 別)
const SET_CHAR = cdef('SET_CHAR', { kind: 'character' });
const SET_EVENT = cdef('SET_EVENT', { kind: 'event' });
// B08068 用: 手札公開候補 (喫茶ポアロ) + decoy + sceneRemove 対象 (level 別)
const POARO_H1 = cdef('POARO_H1', { traits: ['喫茶ポアロ'], colors: ['黄'] });
const POARO_H2 = cdef('POARO_H2', { traits: ['喫茶ポアロ'], colors: ['黄'] });
const HAND_DECOY = cdef('HAND_DECOY', { traits: ['探偵'], colors: ['黄'] }); // 非ポアロ → 公開されない
const POARO_BOARD = cdef('POARO_BOARD', { traits: ['喫茶ポアロ'], colors: ['黄'], level: 6 }); // 盤面計数用 (lvl6 = 除去対象外)
const T1 = cdef('T1', { level: 1 });
const T3 = cdef('T3', { level: 3 });
const T5 = cdef('T5', { level: 5 });

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B08041);
  registerCardDef(B08068);
  registerCardDef(SET_CHAR); registerCardDef(SET_EVENT);
  registerCardDef(POARO_H1); registerCardDef(POARO_H2); registerCardDef(HAND_DECOY);
  registerCardDef(POARO_BOARD); registerCardDef(T1); registerCardDef(T3); registerCardDef(T5);
  registerTriggeredListener();
  setHuman(null);
});

function base(owner: Player): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
}
// 裏向きセット済み host
function withSet(cardId: string, uid: string, setIds: string[]) {
  return sceneChar(cardId, uid, { setCards: setIds.map((cid) => ({ cardId: cid, faceUp: false })) });
}

// ============================================================
// B08041 — shape
// ============================================================
describe('B08041 高橋良一 — shape', () => {
  it('id/no/色/lv/ap/特徴 + a1 enter selfOnly charSetCard / a2 declared limit1 cost removeSetCard n1', () => {
    expect(B08041.id).toBe('B08041');
    expect(B08041.no).toBe('0880/B08041');
    expect(B08041.colors).toEqual(['白']);
    expect(B08041.level).toBe(5);
    expect(B08041.ap).toBe(4000);
    expect(B08041.lp).toBe(1);
    expect(B08041.traits).toEqual(['食品会社社員']);

    const a1 = B08041.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('enter');
    expect(a1.trigger?.selfOnly).toBe(true);
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'charSetCard' });

    const a2 = B08041.abilities[1];
    expect(a2.type).toBe('declared');
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a2.cost).toMatchObject({ kind: 'removeSetCard', n: 1 });
    expect(a2.effect?.kind).toBe('sequence');
  });
});

// ============================================================
// B08041 a1 — 登場時: deck 上端1枚を裏向きで自身にセット
// ============================================================
describe('B08041 a1 — 登場時 charSetCard (deck 上端1枚を裏向きセット)', () => {
  it('B1 happy: B08041 登場 → 上端1枚を裏向きで自身にセット、deck -1', () => {
    let s = base('self');
    s.players.self.deck = ['D1', 'D2', 'D3'];
    let hostUid = '';
    s = produce(s, (d) => {
      const c = mutate.scene.enter(d, 'self', 'B08041', {});
      hostUid = c.uid;
      event.emit(d, 'enter', { uid: c.uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 },
        { player: 'self', cardId: 'B08041', uid: c.uid });
      runAllUntilEmpty(d);
    });
    const host = s.players.self.scene.find((c) => c.uid === hostUid)!;
    expect(host.setCards.length, '1枚セット').toBe(1);
    expect(host.setCards[0]!.cardId, 'deck 上端').toBe('D1');
    expect(host.setCards[0]!.faceUp !== true, '裏向き (faceUp!==true, rules/16)').toBe(true);
    expect(s.players.self.deck, '上端1枚消費').toEqual(['D2', 'D3']);
  });
});

// ============================================================
// B08041 a2 — 宣言: cost で除去した裏向きセットカードの kind で AP / LP 分岐
// ============================================================
describe('B08041 a2 — 宣言 (removeSetCard kind 分岐: character→AP+2000 / event→LP+1)', () => {
  const declareCtx = (uid: string): EffectCtx =>
    ({ source: { cardId: 'B08041', uid, abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} });

  it('B2 gate: cost removeSetCard n1 を canPay が実 gate (裏向きセット0枚 → 不可)', () => {
    const noSet = base('self');
    noSet.players.self.scene = [sceneChar('B08041', 'taka')]; // セット無し
    expect(canPay(noSet, B08041.abilities[1].cost!, declareCtx('taka')), 'セット0 → 払えず不可').toBe(false);
    const hasSet = base('self');
    hasSet.players.self.scene = [withSet('B08041', 'taka', ['SET_CHAR'])];
    expect(canPay(hasSet, B08041.abilities[1].cost!, declareCtx('taka')), 'セット1 → 払える').toBe(true);
    expect(canDeclaredAbility(hasSet, 'taka', 'a2'), '宣言可').toBe(true);
  });

  it('B3 character branch: 裏向きセットが character → cost 除去 → 自身 AP+2000 (4000→6000)、LP 不変', () => {
    let s = base('self');
    s.players.self.scene = [withSet('B08041', 'taka', ['SET_CHAR'])];
    expect(readChar.ap(s, 'taka')).toBe(4000);
    expect(readChar.lp(s, 'taka')).toBe(1);
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'taka', 'a2', { removeSetCard: { hostUids: ['taka'] } });
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'taka')!.setCards.length, 'cost で裏向き1枚除去').toBe(0);
    expect(readChar.ap(s, 'taka'), 'character → AP+2000').toBe(6000);
    expect(readChar.lp(s, 'taka'), 'event branch 非発火 → LP 不変').toBe(1);
  });

  it('B4 event branch: 裏向きセットが event → cost 除去 → 自身 LP+1 (1→2)、AP 不変', () => {
    let s = base('self');
    s.players.self.scene = [withSet('B08041', 'taka', ['SET_EVENT'])];
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'taka', 'a2', { removeSetCard: { hostUids: ['taka'] } });
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'taka')!.setCards.length, 'cost で裏向き1枚除去').toBe(0);
    expect(readChar.lp(s, 'taka'), 'event → LP+1').toBe(2);
    expect(readChar.ap(s, 'taka'), 'character branch 非発火 → AP 不変').toBe(4000);
  });

  it('B5 owner=opp (BUG-174): opp の B08041 が opp ターンに宣言 → opp 自身が強化 (反転しない)', () => {
    let s = base('opp');
    s.players.opp.scene = [withSet('B08041', 'taka', ['SET_CHAR'])];
    s.players.self.scene = [sceneChar('B08041', 'selftaka')]; // 自陣 decoy (反転検出用)
    expect(canDeclaredAbility(s, 'taka', 'a2'), 'opp 側でも宣言可').toBe(true);
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'taka', 'a2', { removeSetCard: { hostUids: ['taka'] } });
      runAllUntilEmpty(d);
    });
    expect(readChar.ap(s, 'taka'), 'opp 自身 AP+2000').toBe(6000);
    expect(readChar.ap(s, 'selftaka'), 'self 側 decoy は不変 (player 反転なし)').toBe(4000);
  });
});

// ============================================================
// B08068 — shape
// ============================================================
describe('B08068 安室透 — shape', () => {
  it('id/no/色/lv/ap/特徴 + a1 declared cost [sleepSelf, revealFromHand n{0,99}] / effect sceneRemove levelMax dyn', () => {
    expect(B08068.id).toBe('B08068');
    expect(B08068.no).toBe('0905/B08068');
    expect(B08068.colors).toEqual(['黄']);
    expect(B08068.level).toBe(7);
    expect(B08068.ap).toBe(6000);
    expect(B08068.traits).toEqual(['探偵', '喫茶ポアロ']);

    const a1 = B08068.abilities[0];
    expect(a1.type).toBe('declared');
    expect(a1.cost).toMatchObject({ kind: 'pay' });
    const items = (a1.cost as { items: Array<{ kind: string }> }).items;
    expect(items[0]).toMatchObject({ kind: 'sleepSelf' });
    expect(items[1]).toMatchObject({ kind: 'revealFromHand', n: { min: 0, max: 99 } });
    expect(a1.effect).toMatchObject({
      kind: 'atom', verb: 'sceneRemove',
      args: { filter: { levelMax: { dyn: '$cost.revealFromHand.count + $self.sceneTrait.喫茶ポアロ' } } },
    });
  });
});

// ============================================================
// B08068 a1 — 宣言: 公開枚数 + 盤面ポアロ計数 の合計以下レベルを1枚まで除去
// ============================================================
describe('B08068 a1 — 宣言 (revealFromHand count + sceneTrait 合成 dyn → sceneRemove levelMax)', () => {
  it('B6 happy: 手札ポアロ2公開 + 盤面ポアロ1 → levelMax=3。lvl≤3 が候補 (lvl5 decoy 除外)、非ポアロ手札は非公開', () => {
    setHuman('self');
    let s = base('self');
    s.players.self.hand = ['POARO_H1', 'POARO_H2', 'HAND_DECOY']; // 公開候補2 + 非ポアロ decoy
    s.players.self.scene = [
      sceneChar('B08068', 'amuro'),
      sceneChar('POARO_BOARD', 'pb'), // 盤面ポアロ計数 (lvl6 → 除去候補外)
    ];
    s.players.opp.scene = [
      sceneChar('T1', 't1'), // lvl1 候補
      sceneChar('T3', 't3'), // lvl3 候補 (境界)
      sceneChar('T5', 't5'), // lvl5 decoy → levelMax3 で候補外
    ];
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'amuro', 'a1', {});
      runAllUntilEmpty(d);
    });
    // cost: sleepSelf → amuro sleep / revealFromHand → ポアロ2公開 (非ポアロは公開されず手札に残る)
    expect(readChar.state(s, 'amuro'), 'sleepSelf で amuro スリープ').toBe('sleep');
    expect(s.players.self.hand, '非ポアロ decoy は手札に残る (公開のみ・消費なし)').toContain('HAND_DECOY');
    // pick surface — levelMax = 2(公開) + 1(盤面ポアロ) = 3
    expect(_peekPendingEffectPickQueueLength(), 'sceneRemove pick surface').toBe(1);
    const pending = queue()[0]!;
    expect(pending.atomVerb).toBe('sceneRemove');
    expect(pending.nMin, '「1枚まで」= 0枚可').toBe(0);
    const cands = pending.candidates.map((c) => c.uid);
    expect(cands, 'lvl1 候補').toContain('t1');
    expect(cands, 'lvl3 候補 (境界 = levelMax)').toContain('t3');
    expect(cands, 'lvl5 は levelMax3 超過で候補外').not.toContain('t5');
    expect(cands, 'lvl6 盤面ポアロは候補外').not.toContain('pb');
    expect(cands, 'B08068 自身 (lvl7) は候補外').not.toContain('amuro');
    // pick lvl3 → 除去
    s = produce(s, (d) => applyPickAndContinuation(d, pending, 't3'));
    expect(s.players.opp.scene.find((c) => c.uid === 't3'), 'lvl3 を除去').toBeUndefined();
    expect(s.players.opp.scene.find((c) => c.uid === 't5'), 'lvl5 decoy は残存').toBeDefined();
  });

  it('B7 0-reveal (Q&A 1枚も公開せず): 手札ポアロ0 → count=0、dyn=盤面計数のみ=1。lvl≤1 のみ候補', () => {
    setHuman('self');
    let s = base('self');
    s.players.self.hand = ['HAND_DECOY']; // ポアロ無し → 公開0
    s.players.self.scene = [
      sceneChar('B08068', 'amuro'),
      sceneChar('POARO_BOARD', 'pb'), // 盤面ポアロ1
    ];
    s.players.opp.scene = [sceneChar('T1', 't1'), sceneChar('T3', 't3')];
    expect(canPay(s, B08068.abilities[0].cost!,
      { source: { cardId: 'B08068', uid: 'amuro', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} }),
      'ポアロ0でも min:0 で支払可').toBe(true);
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'amuro', 'a1', {});
      runAllUntilEmpty(d);
    });
    const pending = queue()[0]!;
    const cands = pending.candidates.map((c) => c.uid);
    expect(cands, 'levelMax=0+1=1 → lvl1 候補').toContain('t1');
    expect(cands, 'lvl3 は levelMax1 超過で候補外').not.toContain('t3');
  });

  it('B8 owner=opp (BUG-174): opp の B08068 が opp ターンに宣言 → opp スリープ & opp 手札公開 (反転しない)', () => {
    setHuman('opp');
    let s = base('opp');
    s.players.opp.hand = ['POARO_H1'];  // opp 側手札ポアロ1 → count1
    s.players.opp.scene = [
      sceneChar('B08068', 'amuro'),
      sceneChar('POARO_BOARD', 'pb'), // opp 盤面ポアロ1
    ];
    s.players.self.hand = ['POARO_H2']; // 自陣手札 (反転検出用 decoy — 公開されてはならない)
    s.players.self.scene = [sceneChar('T1', 't1')]; // side:either で自陣も除去候補
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'amuro', 'a1', {});
      runAllUntilEmpty(d);
    });
    expect(readChar.state(s, 'amuro'), 'opp の amuro がスリープ (cost 反転なし)').toBe('sleep');
    expect(s.players.self.hand, 'self 手札は公開経路に巻き込まれない').toContain('POARO_H2');
    const pending = queue()[0]!;
    // levelMax = 1(opp 公開) + 1(opp 盤面ポアロ) = 2 → self 側 t1 (lvl1) が候補 (side:either)
    const cands = pending.candidates.map((c) => c.uid);
    expect(cands, 'side:either で self 側 t1 も候補').toContain('t1');
  });
});
