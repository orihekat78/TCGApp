// m1-megasweep probe — PR096 安室透 (character, engine変更0)
//
// 印字 (ground truth, payloads/PR096.json fullTexts):
//   a1 (triggered / effect):
//     【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚特徴［喫茶ポアロ］〛のキャラが
//     登場したとき、相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。
//   a2 (declared / effect):
//     【パートナー黄】【宣言】【スリープ】〚デッキのカードを上から5枚リムーブする〛：この【宣言】
//     能力のコストによって〚特徴［探偵］〛のキャラがリムーブされた場合、レベル8以下のキャラを
//     1枚まで選び、リムーブする。
//
// rules: 15 (「〜まで」=0枚可 / 条件発動は必ず発動), 17 (【自分ターン中】/【ターン1】/【パートナー黄】),
//        19 (レベル下限なし・LP/AP と同様), 21 (宣言/コスト = 5枚リムーブできなければ使用不可)。
//
// カード固有 Q&A (payloads/PR096.json):
//   - レベル-1 で「レベル7以下を選ぶ」等の参照が変わる (Lv8→7 で選択可に)。
//   - コストの「上から5枚リムーブ」は自分のデッキのみ。自デッキ4枚以下では宣言不可 (canPay=false)。
//
// novel 経路 = production dispatch:
//   a1: triggered 'enter' 実 emit (mutate.scene.enter → event.emit('enter') = hand-use-card 同型)。
//       matcherCondition triggerCharMatches{side:self, payloadKey:uid, excludeSource, filter{喫茶ポアロ,character}}
//       → condition turn{self} → limit turn{1} → charModifyLevel{side:opp, max:1, delta:-1, scope:turn} (PA pick)。
//       heuristic は charModifyLevel を chooseAtomTarget 非対応 → 先頭候補 fallback。opp 候補 1体で確定 pick。
//   a2: declared。activateDeclaredAbility → engineCost.pay(sleepSelf + removeDeckTop self×5) →
//       conditional{if: costRemovedMatches{trait:探偵, n:1}} → sceneRemove{side:either, max:1, filter{levelMax:8}}。
//       costRemovedMatches は cost.pay が ctx.costPaid.removeDeckTop.ids に積んだ除去 cardId を def-trait で判定。
// BUG-171: declared は activateDeclaredAbility + runAllUntilEmpty (production dispatch)。
// BUG-174: owner='opp' 反転 pin (S3) — a1 の side:opp が ctx.source.player 相対 = opp所有なら self側を対象。
// beforeEach: registry / triggered / uid / pending pick queue を全 reset + event._resetRegistry
//   (handler 累積で N 重発火を防ぐ、CLAUDE.md 規約)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canPay } from '@/engine/cost/evaluate';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { char as readChar } from '@/engine/read/char';
import { makeChar } from '../../helpers/fixtures';
import { PR096 } from '@/cards/pr-01/PR096';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

type Player = 'self' | 'opp';
const policy = new HeuristicPolicy();

// --- synthetic defs (candidates / level read / trait 判定は registry の def を読む) ---
function chDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...over,
  } as unknown as CardDef;
}
function partnerDef(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'partner', names: [id], colors,
    lp: 7, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

const PY = 'PY';            // partner 黄 (a2 partnerColor gate)
const POARO = 'POARO';      // 喫茶ポアロ entrant (a1 matcher hit)
const PLAIN = 'PLAIN';      // trait なし entrant (a1 matcher decoy)
const T5 = 'T5';            // a1 level-target (Lv5)
const T5b = 'T5b';          // side-decoy / owner-side char (Lv5)
const DET = 'DET';          // 探偵 deck-top (costRemovedMatches hit)
const ND = 'ND';            // trait なし deck-top (costRemovedMatches miss)
const R8 = 'R8';            // a2 removable target (Lv8, levelMax:8 境界内)
const R9 = 'R9';            // a2 levelMax decoy (Lv9, 候補外)

function registerFixtures(): void {
  registerCardDef(PR096);
  registerCardDef(partnerDef(PY, ['黄']));
  registerCardDef(chDef(POARO, { level: 4, traits: ['喫茶ポアロ'] }));
  registerCardDef(chDef(PLAIN, { level: 4, traits: [] }));
  registerCardDef(chDef(T5, { level: 5, ap: 5000 }));
  registerCardDef(chDef(T5b, { level: 5, ap: 3000 }));
  registerCardDef(chDef(DET, { level: 3, traits: ['探偵'] }));
  registerCardDef(chDef(ND, { level: 3, traits: [] }));
  registerCardDef(chDef(R8, { level: 8, ap: 6000 }));
  registerCardDef(chDef(R9, { level: 9, ap: 9000 }));
}

function base(turnPlayer: Player = 'self'): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.players.self.partner = { cardId: PY, state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: PY, state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: 'cs', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
  s.players.opp.case = { cardId: 'co', status: '事件編', requiredEvidence: 6, colors: ['黄'], declaredUseCount: {} };
  s.turn = { number: 3, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

const ctxFor = (uid: string, player: Player): EffectCtx => ({
  source: { cardId: 'PR096', uid, abilityId: 'a2', player, area: 'scene' },
  bindings: {},
});
const a2 = PR096.abilities!.find((a) => a.id === 'a2')!;

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  registerFixtures();
  registerTriggeredListener();
});

/** a1 triggered: owner 現場へ entrant を登場させ 'enter' emit → pick を AI 解決して drain しきる。 */
function fireEnter(s: GameState, owner: Player, entrantCardId: string): GameState {
  return produce(s, (d) => {
    const nc = mutate.scene.enter(d, owner, entrantCardId, { named: true, viaEffect: false });
    event.emit(
      d, 'enter',
      { uid: nc.uid, viaEffect: false, enterOrder: nc.enterOrder, enterOrderThisTurn: nc.enterOrderThisTurn },
      { player: owner, cardId: entrantCardId, uid: nc.uid },
    );
    for (let i = 0; i < 4; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, policy);
      runAllUntilEmpty(d);
    }
  });
}

/** a2 declared: production dispatch (activateDeclaredAbility + pay) → pick drain (B03029 同型)。 */
function fireDeclared(s: GameState, uid: string): GameState {
  let after = produce(s, (d) => {
    activateDeclaredAbility(d, uid, 'a2');
    runAllUntilEmpty(d);
  });
  after = produce(after, (d) => _drainAllEffectPicksForTest(d, policy));
  after = produce(after, (d) => runAllUntilEmpty(d));
  return after;
}

// ───────── S1: a1 happy — 喫茶ポアロ登場 → 相手キャラ Lv-1。自陣/登場キャラは side:opp で対象外 ─────────
describe('S1 a1 triggered: 自分の現場に喫茶ポアロ登場 → 相手キャラ1体を Lv-1 (ターン終了時まで)', () => {
  it('opp T5 が Lv5→4。self 側の T5b と登場した POARO 自身 (owner側) は不変', () => {
    const s = base('self');
    s.players.self.scene.push(makeChar({ uid: 'anmr', cardId: 'PR096', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'self-decoy', cardId: T5b, state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'opp-t', cardId: T5, state: 'active' }));
    expect(readChar.level(s, 'opp-t')).toBe(5); // printed

    const after = fireEnter(s, 'self', POARO);

    // 相手キャラ Lv-1 (5→4)
    expect(readChar.level(after, 'opp-t')).toBe(4);
    // side:opp 相対 → 自陣 T5b は対象にならない
    expect(readChar.level(after, 'self-decoy')).toBe(5);
    // 登場した喫茶ポアロは owner(self) 側 = side:opp 対象外
    const poaro = after.players.self.scene.find((c) => c.cardId === POARO)!;
    expect(readChar.level(after, poaro.uid)).toBe(4); // POARO printed Lv4, 未修正
  });
});

// ───────── S2: a1 matcher decoy — trait なしキャラ登場 → 発火しない (triggerCharMatches filter外) ─────────
describe('S2 a1 matcher off: 喫茶ポアロ以外のキャラ登場 → 発火せず 相手 Lv 不変', () => {
  it('PLAIN (trait なし) 登場 → opp T5 は Lv5 のまま', () => {
    const s = base('self');
    s.players.self.scene.push(makeChar({ uid: 'anmr', cardId: 'PR096', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'opp-t', cardId: T5, state: 'active' }));

    const after = fireEnter(s, 'self', PLAIN);

    expect(readChar.level(after, 'opp-t')).toBe(5); // 未発火
  });
});

// ───────── S3: a1 owner=opp 反転 pin (BUG-174) — side:opp は owner 相対で self 側を対象 ─────────
describe('S3 a1 反転 pin: PR096 が opp 所有 → 喫茶ポアロが opp現場登場 → side:opp = self側を Lv-1', () => {
  it('opp 所有・opp ターンで発火 → self T5 が Lv-1。opp(owner)側 T5b は不変', () => {
    const s = base('opp'); // condition turn{self} は owner=opp のターンで成立
    s.players.opp.scene.push(makeChar({ uid: 'anmr', cardId: 'PR096', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'owner-decoy', cardId: T5b, state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'victim', cardId: T5, state: 'active' }));

    const after = fireEnter(s, 'opp', POARO);

    // side:opp = oppSide(owner=opp) = self → self 側 victim を Lv-1
    expect(readChar.level(after, 'victim')).toBe(4);
    // owner(opp) 側の char は対象外 (反転せず自陣を誤爆しない)
    expect(readChar.level(after, 'owner-decoy')).toBe(5);
  });
});

// ───────── S4: a2 happy — 探偵が cost で除去 → conditional 成立 → Lv8以下を1枚リムーブ ─────────
describe('S4 a2 declared full: 探偵を含む5枚 cost 除去 → costRemovedMatches 成立 → 相手 Lv8 をリムーブ', () => {
  it('自身スリープ + deck-5 + DET除去。opp R8(Lv8) リムーブ、R9(Lv9) は levelMax:8 外で残存', () => {
    const s = base('self');
    s.players.self.scene.push(makeChar({ uid: 'anmr', cardId: 'PR096', state: 'active' }));
    // deck top5 に 探偵(DET) を含める
    s.players.self.deck.push(DET, ND, ND, ND, ND, 'extra');
    s.players.opp.scene.push(makeChar({ uid: 'r8', cardId: R8, state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'r9', cardId: R9, state: 'active' }));
    expect(canPay(s, a2.cost!, ctxFor('anmr', 'self'))).toBe(true);

    const after = fireDeclared(s, 'anmr');

    // cost: 自身スリープ
    expect(after.players.self.scene.find((c) => c.uid === 'anmr')!.state).toBe('sleep');
    // cost: 上から5枚 remove へ (DET含む)、deck は 'extra' 1枚残
    expect(after.players.self.deck).toEqual(['extra']);
    expect(after.players.self.remove).toContain(DET);
    expect(after.players.self.remove.length).toBe(5);
    // effect: Lv8 の R8 がリムーブ (opp scene から消え opp remove へ)
    expect(after.players.opp.scene.find((c) => c.uid === 'r8')).toBeUndefined();
    expect(after.players.opp.remove).toContain(R8);
    // levelMax:8 decoy: R9(Lv9) は候補外で残存
    expect(after.players.opp.scene.find((c) => c.uid === 'r9')).toBeTruthy();
  });
});

// ───────── S5: a2 conditional off — 探偵が cost に含まれない → sceneRemove 不発 (「〜場合」不成立) ─────────
describe('S5 a2 conditional off: cost 除去5枚に探偵なし → costRemovedMatches 偽 → リムーブ発生せず', () => {
  it('自身スリープ + deck-5 は起きるが、opp R8 はリムーブされず残存', () => {
    const s = base('self');
    s.players.self.scene.push(makeChar({ uid: 'anmr', cardId: 'PR096', state: 'active' }));
    s.players.self.deck.push(ND, ND, ND, ND, ND); // 探偵なし
    s.players.opp.scene.push(makeChar({ uid: 'r8', cardId: R8, state: 'active' }));

    const after = fireDeclared(s, 'anmr');

    // cost は成立 (スリープ + 5枚除去)
    expect(after.players.self.scene.find((c) => c.uid === 'anmr')!.state).toBe('sleep');
    expect(after.players.self.deck.length).toBe(0);
    expect(after.players.self.remove.length).toBe(5);
    // conditional then 不発 → R8 は残存
    expect(after.players.opp.scene.find((c) => c.uid === 'r8')).toBeTruthy();
    expect(after.players.opp.remove).not.toContain(R8);
  });
});

// ───────── S6: a1 「1枚まで」= 0-pick — 相手現場0 で発火しても crash なし・能力は発動済 ─────────
// (a2 の sceneRemove は side:either ゆえ PR096 自身(Lv8)が常に候補 = 真の 0-pick が起きない。
//  side:opp の a1 は相手現場が空なら候補0 = 「1枚まで」の 0 選択が意味を持つ。)
describe('S6 a1 0-pick (「〜まで」=0枚可): 相手現場が空 → Lv-1 対象0 → throw なし', () => {
  it('喫茶ポアロ登場で発火するが opp scene 空 → 何も起きず PR096/登場キャラは盤面に残る', () => {
    const s = base('self');
    s.players.self.scene.push(makeChar({ uid: 'anmr', cardId: 'PR096', state: 'active' }));
    // opp scene は空 (side:opp 候補0)

    const after = fireEnter(s, 'self', POARO);

    // crash せず PR096 と登場した喫茶ポアロが盤面に残る
    expect(after.players.self.scene.find((c) => c.uid === 'anmr')).toBeTruthy();
    expect(after.players.self.scene.some((c) => c.cardId === POARO)).toBe(true);
    // 相手現場は依然空 (誤って自陣を対象にしない)
    expect(after.players.opp.scene).toHaveLength(0);
  });
});

// ───────── S7: a2 canPay gate — 自デッキ4枚以下では 5枚除去できず宣言不可 (カード固有Q&A) ─────────
describe('S7 a2 canPay gate: 自デッキ4枚 → removeDeckTop 5 できず canPay=false (Q&A)', () => {
  it('deck 4枚で canPay=false / deck 5枚で canPay=true', () => {
    const s = base('self');
    s.players.self.scene.push(makeChar({ uid: 'anmr', cardId: 'PR096', state: 'active' }));
    s.players.self.deck.push(ND, ND, ND, ND); // 4枚
    expect(canPay(s, a2.cost!, ctxFor('anmr', 'self'))).toBe(false);
    s.players.self.deck.push(ND); // 5枚
    expect(canPay(s, a2.cost!, ctxFor('anmr', 'self'))).toBe(true);
  });
});
