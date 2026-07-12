// tests/cards/m2-attribution/p07-costpaid — costPaid② 束の card probe (engine 実評価)
//
// B07025 星河童吾 (character):
//   【宣言】【スリープ】〚現場にいるこのキャラ以外の特徴[マジシャン]のキャラを1枚デッキの下に移す〛：
//     自分のリムーブエリアにある、コストで移したキャラのレベル以下のレベルの[マジシャン]のキャラを
//     1枚まで選び、手札に加える。
//
// novel 経路 = production dispatch (BUG-171): activateDeclaredAbility('<uid>','a1',
//   { sceneToDeckBottom:{ uids:[<移す マジシャン uid>] } }) → pay(sleepSelf + sceneToDeckBottom) →
//   pay.ts:210 が costPaid.sceneToDeckBottom={ids,level} 書込 → useDeclaredAbility → runAllUntilEmpty →
//   handAddFromRemove short-form pick。filter.levelMax:{dyn:'$cost.sceneToDeckBottom.level'} が
//   resolve-picks.ts:339 で costPaid から具体値 (移したキャラの level) へ解決。
// BUG-174: owner=opp 視点 pin (S7)。BUG-117/118: filter 条件外 decoy (Lv5 マジシャン / 非マジシャン /
//   マジシャン event) を remove に置き非候補を assert。
// rules: 15 (「〜まで」=0可), 17 (【スリープ】コスト), 21 (宣言コスト「自分の」省略 / 全部行えなければ不可)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { canPay } from '@/engine/cost/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  _drainPendingEffectPickSide,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/pending-state';
import { _clearPendingEffectOptionalSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, CardDef, EffectCtx, Player } from '@/engine/types';
import { B07025 } from '@/cards/ct-p07/B07025';

function chDef(id: string, opts: { level?: number; traits?: string[] } = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: opts.level ?? 3, ap: 2000, lp: 1, traits: opts.traits ?? [], keywords: [],
    rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function evDef(id: string, traits: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: ['緑'], level: 1,
    traits, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
const setHuman = (s: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s; };

// 現場 fixtures (コストで移す マジシャン)
const MAG4 = 'MAG4';   // Lv4 マジシャン (コストで移す → costPaid.level=4)
const MAG7 = 'MAG7';   // Lv7 マジシャン (別 level のコスト検証用)
const NONMAG = 'NONMAG'; // 非マジシャン (コスト対象外 = excludeSelf 以前に trait 不一致)
// remove fixtures (handAddFromRemove 候補)
const RMAG3 = 'RMAG3';   // Lv3 マジシャン (≤4 候補)
const RMAG4 = 'RMAG4';   // Lv4 マジシャン (≤4 候補、境界)
const RMAG5 = 'RMAG5';   // Lv5 マジシャン (>4 decoy: levelMax dyn 除外)
const RNONMAG = 'RNONMAG'; // Lv3 非マジシャン decoy (trait 除外)
const RMAGEV = 'RMAGEV';   // マジシャン event decoy (kind:character 除外)

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  setHuman('self');
  registerCardDef(B07025);
  registerCardDef(chDef(MAG4, { level: 4, traits: ['マジシャン'] }));
  registerCardDef(chDef(MAG7, { level: 7, traits: ['マジシャン'] }));
  registerCardDef(chDef(NONMAG, { level: 4, traits: ['刑事'] }));
  registerCardDef(chDef(RMAG3, { level: 3, traits: ['マジシャン'] }));
  registerCardDef(chDef(RMAG4, { level: 4, traits: ['マジシャン'] }));
  registerCardDef(chDef(RMAG5, { level: 5, traits: ['マジシャン'] }));
  registerCardDef(chDef(RNONMAG, { level: 3, traits: ['刑事'] }));
  registerCardDef(evDef(RMAGEV, ['マジシャン']));
  registerTriggeredListener();
});

// B07025 を owner の現場に置き、コスト対象キャラ(moveId)も置いて宣言する共通 driver。
// remove は owner 側の remove pile に配置。effect の handAddFromRemove pick は peek で候補確認/選択。
function run(opts: {
  owner: Player; turn: Player;
  sceneMove: string[];       // 現場に置くコスト対象 (先頭を moveId としてコストで移す)
  ownerRemove: string[]; foeRemove?: string[];
  pick?: string | 'skip';    // handAddFromRemove で選ぶ cardId (or skip)。省略時は peek せず auto なし
  capture?: (candIds: string[]) => void;
}): GameState {
  const b = createEmptyGameState();
  b.turn = { number: 5, player: opts.turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  const foe: Player = opts.owner === 'self' ? 'opp' : 'self';
  b.players[opts.owner].remove = [...opts.ownerRemove];
  if (opts.foeRemove) b.players[foe].remove = [...opts.foeRemove];
  b.players[opts.owner].deck = ['D1', 'D2', 'D3', 'D4'];
  return produce(b, (d: GameState) => {
    mutate.scene.enter(d, opts.owner, 'B07025', {});
    for (const c of opts.sceneMove) mutate.scene.enter(d, opts.owner, c, {});
    const srcUid = d.players[opts.owner].scene.find(c => c.cardId === 'B07025')!.uid;
    const moveUid = d.players[opts.owner].scene.find(c => c.cardId === opts.sceneMove[0])!.uid;
    activateDeclaredAbility(d, srcUid, 'a1', { sceneToDeckBottom: { uids: [moveUid] } });
    runAllUntilEmpty(d);
    if (opts.pick !== undefined) {
      const pk = _drainPendingEffectPickSide();
      if (pk) {
        const cands = pk.candidates as Array<{ uid: string; cardId: string }>;
        opts.capture?.(cands.map(c => c.cardId).sort());
        if (opts.pick === 'skip') applyPickSkipAndContinuation(d, pk, false);
        else {
          const hit = cands.find(c => c.cardId === opts.pick)!;
          applyPickAndContinuation(d, pk, hit.uid, [hit.uid]);
        }
        runAllUntilEmpty(d);
      } else {
        // pick が surface しない = 候補 0 枚 (auto no-op)。capture に空配列を渡す。
        opts.capture?.([]);
      }
    }
  }) as GameState;
}

// ---- shape ----
describe('B07025 星河童吾 — shape', () => {
  it('id/no/色/lv/ap/特徴 + a1 declared cost{sleepSelf, sceneToDeckBottom} effect handAddFromRemove(levelMax dyn)', () => {
    expect(B07025.id).toBe('B07025');
    expect(B07025.no).toBe('0757/B07025');
    expect(B07025.colors).toEqual(['緑']);
    expect(B07025.level).toBe(3);
    expect(B07025.ap).toBe(2000);
    expect(B07025.traits).toEqual(['マジシャン']);
    const a1 = B07025.abilities[0];
    expect(a1.type).toBe('declared');
    expect(a1.limit, '【ターン1】無し = limit 無し').toBeUndefined();
    const cost = a1.cost as { kind: string; items: Array<{ kind: string; target?: { query?: { excludeSelf?: boolean; side?: string; filter?: { trait?: string } } } }> };
    expect(cost.kind).toBe('pay');
    expect(cost.items[0].kind).toBe('sleepSelf');
    expect(cost.items[1].kind).toBe('sceneToDeckBottom');
    expect(cost.items[1].target?.query?.side, 'コスト対象 = 自分 (rules/21)').toBe('self');
    expect(cost.items[1].target?.query?.excludeSelf, 'このキャラ以外').toBe(true);
    expect(cost.items[1].target?.query?.filter?.trait).toBe('マジシャン');
    const eff = a1.effect as { kind: string; verb: string; args: { filter: { trait: string; kind: string; levelMax: { dyn: string } } } };
    expect(eff.verb).toBe('handAddFromRemove');
    expect(eff.args.filter.trait).toBe('マジシャン');
    expect(eff.args.filter.kind).toBe('character');
    expect(eff.args.filter.levelMax).toEqual({ dyn: '$cost.sceneToDeckBottom.level' });
  });
});

// ---- cost gates ----
describe('B07025 a1 — cost gate (rules/21 全部行えなければ不可)', () => {
  it('canPay: 現場に他マジシャン居る → 可 / 居ない (自身のみ = このキャラ以外なし) → 不可', () => {
    const withMag = produce(createEmptyGameState(), (d: GameState) => {
      mutate.scene.enter(d, 'self', 'B07025', {});
      mutate.scene.enter(d, 'self', MAG4, {});
    }) as GameState;
    const onlySelf = produce(createEmptyGameState(), (d: GameState) => {
      mutate.scene.enter(d, 'self', 'B07025', {});
    }) as GameState;
    const cost = B07025.abilities[0].cost!;
    const ctxOf = (s: GameState): EffectCtx => ({
      source: { player: 'self', uid: s.players.self.scene.find(c => c.cardId === 'B07025')!.uid, cardId: 'B07025', abilityId: 'a1', area: 'scene' },
      bindings: {},
    } as unknown as EffectCtx);
    expect(canPay(withMag, cost, ctxOf(withMag)), '他マジシャン居る → 可').toBe(true);
    expect(canPay(onlySelf, cost, ctxOf(onlySelf)), '自身のみ (excludeSelf → 対象0) → 不可').toBe(false);
  });
});

// ---- happy + filter/decoy ----
describe('B07025 a1 — happy: 移した Lv4 マジシャン以下の remove マジシャン回収', () => {
  it('S1 happy: MAG4 をコストで移す → costPaid.level=4 → remove 候補は Lv≤4 マジシャンのみ (Lv5/非マジシャン/event decoy 除外), RMAG3 回収', () => {
    let cands: string[] = [];
    const s = run({
      owner: 'self', turn: 'self',
      sceneMove: [MAG4],
      ownerRemove: [RMAG3, RMAG4, RMAG5, RNONMAG, RMAGEV],
      pick: RMAG3,
      capture: (c) => { cands = c; },
    });
    // 候補 = Lv≤4 マジシャン character のみ: RMAG3(Lv3), RMAG4(Lv4)。RMAG5(Lv5>4)/RNONMAG(非マジシャン)/RMAGEV(event) 除外。
    expect(cands, 'levelMax dyn=4 → Lv≤4 マジシャン character のみ').toEqual([RMAG3, RMAG4]);
    expect(s.players.self.hand, 'RMAG3 が手札へ').toContain(RMAG3);
    expect(s.players.self.remove, 'RMAG3 は remove から抜ける').not.toContain(RMAG3);
    expect(s.players.self.remove, 'RMAG5 (Lv5) 残置').toContain(RMAG5);
    expect(s.players.self.remove, 'RNONMAG (非マジシャン) 残置').toContain(RNONMAG);
    expect(s.players.self.remove, 'RMAGEV (event) 残置').toContain(RMAGEV);
    // コスト: MAG4 が現場から離脱 (デッキ下へ)、B07025 は sleep
    expect(s.players.self.scene.map(c => c.cardId), 'MAG4 は現場を離れ B07025 のみ').toEqual(['B07025']);
    expect(s.players.self.scene.find(c => c.cardId === 'B07025')!.state, 'B07025 は【スリープ】コスト消費').toBe('sleep');
    expect(s.players.self.deck.at(-1), 'MAG4 はデッキ下へ (リムーブでない)').toBe(MAG4);
  });

  it('S2 level 依存 (dyn 動的): MAG7 をコストで移す → costPaid.level=7 → Lv5 マジシャンも候補入り (RMAG5 回収可)', () => {
    let cands: string[] = [];
    const s = run({
      owner: 'self', turn: 'self',
      sceneMove: [MAG7],
      ownerRemove: [RMAG3, RMAG5],
      pick: RMAG5,
      capture: (c) => { cands = c; },
    });
    expect(cands, 'levelMax dyn=7 → RMAG3(3)/RMAG5(5) 両方候補').toEqual([RMAG3, RMAG5]);
    expect(s.players.self.hand, 'RMAG5 回収 (Lv5≤7)').toContain(RMAG5);
  });

  it('S3 「1枚まで」= 0 選択可 (rules/15): 候補ありでも skip → 何も回収されず (コストは消費)', () => {
    const s = run({
      owner: 'self', turn: 'self',
      sceneMove: [MAG4],
      ownerRemove: [RMAG3],
      pick: 'skip',
    });
    expect(s.players.self.hand, 'skip → RMAG3 未回収').not.toContain(RMAG3);
    expect(s.players.self.remove, 'RMAG3 remove 残置').toContain(RMAG3);
    expect(s.players.self.deck.at(-1), 'コスト (MAG4 デッキ下) は消費済').toBe(MAG4);
  });

  it('S4 空振り合法: remove に Lv≤4 マジシャン無し (RMAG5 のみ) → 候補0, pick 非 surface, コストのみ消費', () => {
    let cands: string[] | undefined;
    const s = run({
      owner: 'self', turn: 'self',
      sceneMove: [MAG4],
      ownerRemove: [RMAG5, RNONMAG],
      pick: 'skip',
      capture: (c) => { cands = c; },
    });
    expect(cands, '候補 0 枚 (RMAG5 Lv5>4 / RNONMAG 非マジシャン)').toEqual([]);
    expect(s.players.self.hand.length, '手札 増えず').toBe(0);
    expect(s.players.self.remove.slice().sort(), 'remove 全残置').toEqual([RMAG5, RNONMAG].slice().sort());
    expect(s.players.self.deck.at(-1), 'コスト消費 (MAG4 デッキ下)').toBe(MAG4);
  });
});

// ---- side:self honored (BUG-174) ----
describe('B07025 a1 — side:self honored', () => {
  it('S5 相手 remove の Lv≤4 マジシャンは対象外 (自分 remove のみ回収)', () => {
    let cands: string[] = [];
    const s = run({
      owner: 'self', turn: 'self',
      sceneMove: [MAG4],
      ownerRemove: [RNONMAG],       // 自分側は非マジシャンのみ
      foeRemove: [RMAG3],           // 相手側に Lv3 マジシャン decoy
      pick: 'skip',
      capture: (c) => { cands = c; },
    });
    expect(cands, '自分 remove に候補なし (相手 RMAG3 は不可視)').toEqual([]);
    expect(s.players.opp.remove, '相手 remove の RMAG3 は取られない').toContain(RMAG3);
    expect(s.players.self.hand, '相手カードは手札に来ない').not.toContain(RMAG3);
  });
});

// ---- owner=opp pin (BUG-174 KNOWN GAP) ----
describe('B07025 a1 — owner=opp (BUG-174 KNOWN GAP)', () => {
  // ⚠ KNOWN ENGINE GAP (BUG-174 class、B05087 a2 S8 と同型): handAddFromRemove は PB 短縮形 pick。
  //   resolve-picks.ts:313 の pre-walk が `p = args.player ?? 'self'` を **絶対 side 'self'** で解決し
  //   (resolvePlayer 未経由 owner-relative 化漏れ)、opp 所有 B07025 の effect が **相手 (self) の
  //   リムーブエリア** を候補列挙する。opp 自身の remove にある マジシャンは回収されない。この gap は
  //   shipped 全 handAddFromRemove 短縮形カード (B01030/B05087/B06065 等) 共通で、B07025 固有ではない。
  //   コスト側 (sceneToDeckBottom、pay.ts で owner-relative 解決済) は owner=opp でも正しく opp 現場から移す。
  //   ここでは反転の現状挙動 (opp 所有時に opp remove から回収**されない**) を pin してリグレッション検出する。
  it('S6 owner=opp: effect handAddFromRemove は反転バグで opp remove を回収できない (コストは正しく opp 現場から消費)', () => {
    setHuman('opp');
    let cands: string[] | undefined;
    const s = run({
      owner: 'opp', turn: 'opp',
      sceneMove: [MAG4],
      ownerRemove: [RMAG3],         // opp remove に Lv3 マジシャン (反転バグで回収されない)
      // self.remove は空 → 反転 pre-walk が self 側を列挙 → 候補 0 → pick 非 surface
      pick: 'skip',
      capture: (c) => { cands = c; },
    });
    expect(cands, 'opp remove の一致カードだけを候補にする').toEqual([RMAG3]);
    expect(s.players.opp.hand.length, 'opp 手札 不変 (RMAG3 未回収 = 反転バグ現状)').toBe(0);
    expect(s.players.opp.remove, 'opp remove に RMAG3 残存 (回収されず)').toContain(RMAG3);
    // コスト側 (sceneToDeckBottom) は owner-relative に正しく解決される (反転しない)
    expect(s.players.opp.scene.map(c => c.cardId), 'opp MAG4 離脱, B07025 のみ (コスト正常)').toEqual(['B07025']);
    expect(s.players.opp.deck.at(-1), 'MAG4 は opp デッキ下へ (コスト owner-relative 正常)').toBe(MAG4);
    expect(s.players.opp.scene.find(c => c.cardId === 'B07025')!.state, 'B07025 sleep (コスト消費)').toBe('sleep');
  });
});

// ---- excludeSelf pin ----
describe('B07025 a1 — excludeSelf (このキャラ以外)', () => {
  it('S7 コスト対象に B07025 自身は選べない: 現場に他マジシャン NONMAG(非) + MAG4 のみ、self 指定は不可扱い', () => {
    // canPay は「このキャラ以外の マジシャン」が居るかで判定。現場= B07025 + NONMAG(非マジシャン) のみ → コスト対象0 → 不可。
    const s = produce(createEmptyGameState(), (d: GameState) => {
      mutate.scene.enter(d, 'self', 'B07025', {});
      mutate.scene.enter(d, 'self', NONMAG, {}); // 非マジシャン → コスト対象にならない
    }) as GameState;
    const cost = B07025.abilities[0].cost!;
    const ctx: EffectCtx = {
      source: { player: 'self', uid: s.players.self.scene.find(c => c.cardId === 'B07025')!.uid, cardId: 'B07025', abilityId: 'a1', area: 'scene' },
      bindings: {},
    } as unknown as EffectCtx;
    expect(canPay(s, cost, ctx), 'B07025 自身は excludeSelf で対象外 + NONMAG は非マジシャン → コスト支払い不可').toBe(false);
  });
});
