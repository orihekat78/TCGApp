// tests/cards/miniwave2-nexthint/probes
// mini-wave #2 (2026-07-10) 新規登録 3 枚の手書き probe。全て「自分がネクストヒントで手札を使用したとき」
//   (viaNextHint 判別) trigger を持つ。production 経路 runNextHint(→ effect:declared emit with
//   viaNextHint:true) で駆動し、effect:declared listener が pendingEffects に積む観測型効果を
//   runAllUntilEmpty + pick queue drain (hybrid-batch5 drainScript 慣行) で解決して検証する。
//   engine / src/cards は変更しない (probe のみ)。
//
// 対象:
//   B01005 江戸川コナン a1【パートナー青】【ターン1】ネクストヒント使用 → そのカードのレベル以下 (levelMax
//     = $trigger.cardLevel) のキャラ1枚まで → デッキの下。
//     negatives: (a) 通常の手札の使用 (handUseCard) → 不発火 (viaNextHint 判別、★key regression)
//                (b) パートナー青 不成立 → 不発火 (c)【ターン1】2回目のネクストヒント → 不発火。
//   B03002 江戸川コナン a1【ターン1】ネクストヒント使用 → 上3枚を見て[少年探偵団]1枚まで手札 + 残りデッキ下。
//     a2 ability:declared observer:【ターン1】自現場の[少年探偵団]が【宣言】能力使用 → このキャラ 突撃 (turn)。
//     negatives: a1 hand-use 不発火 / reveal filter 非[少年探偵団] 候補外 / a2 非[少年探偵団]宣言者 → 不付与。
//   B05005 江戸川コナン＆工藤新一 a1【パートナー青】【ターン1】ネクストヒントで【青】カード使用 → AP8000以下
//     1枚まで → デッキの下。negative: 【赤】カード使用 → triggerCardMatches 色 gate で不発火。
//     a2【宣言】相手キャラ1枚まで「必ずガードする」(mustGuard turnEffect)。PA-MR 経路で駆動 (declared)。
//     a3【カットイン】AP+2000 ($contact.byUid)。cutin 経路。
// rules: 12/13/15/17/19/20/21/22/23

import { describe, it, expect, beforeEach } from 'vitest';
import { produce, setAutoFreeze } from 'immer';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { runNextHint } from '@/engine/flow/main/next-hint';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { cutIn, canCutIn } from '@/engine/flow/contact';
import {
  _drainPendingEffectPickSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectChoiceSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import {
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
  applyOptionalAndContinuation,
  applyChoiceAndContinuation,
} from '@/engine/effect/apply-pick';
import { B01005 } from '@/cards/ct-p01/B01005';
import { B03002 } from '@/cards/ct-p03/B03002';
import { B05005 } from '@/cards/ct-p05/B05005';
import type { AbilityDef, CardDef, GameState, ActionContext } from '@/engine/types';

// ---- fixtures ----
function charDef(
  id: string,
  o: { names?: string[]; ap?: number; level?: number; colors?: string[]; traits?: string[]; abilities?: AbilityDef[] } = {},
): CardDef {
  return {
    id, no: id, kind: 'character', names: o.names ?? [id], colors: o.colors ?? ['青'],
    level: o.level ?? 1, ap: o.ap ?? 2000, lp: 1, traits: o.traits ?? [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: o.abilities ?? [], ruleRefs: [],
  };
}
function partnerDef(id: string, colors: string[]): CardDef {
  return { id, no: id, kind: 'partner', names: [id], colors, level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

// 宣言能力を持つ fixture (B03002 a2 の ability:declared observer を駆動する declarer)。
// 効果は draw1 (deck 消費のみ・pick 非 surface)。
const d1: AbilityDef = {
  id: 'd1', type: 'declared', scope: 'on-scene',
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

const USED4 = charDef('USED4', { colors: ['青'], level: 4, ap: 3000 });         // B01005 next-hint 使用カード (lv4)
const USED_B = charDef('USED_B', { colors: ['青'], level: 1, ap: 2000 });        // 汎用 青 使用カード (lv1)
const USED_R = charDef('USED_R', { colors: ['赤'], level: 1, ap: 2000 });        // B05005 a1 negative 用 赤 使用カード
const TGT4 = charDef('TGT4', { level: 4, ap: 2000 });                            // levelMax4 候補
const DECOY5 = charDef('DECOY5', { level: 5, ap: 2000 });                        // levelMax4 候補外 (lv5)
const TGT_AP8000 = charDef('TGT_AP8000', { ap: 8000 });                          // apMax8000 候補 (境界)
const DECOY_AP9000 = charDef('DECOY_AP9000', { ap: 9000 });                      // apMax8000 候補外
const SBD = charDef('SBD', { names: ['少年A'], traits: ['少年探偵団'] });          // B03002 a1 reveal 対象
const NONBDS = charDef('NONBDS', { names: ['一般'], traits: ['探偵'] });           // B03002 a1 reveal 非対象
const DECLARER_BDS = charDef('DECLARER_BDS', { names: ['少年B'], traits: ['少年探偵団'], abilities: [d1] }); // a2 宣言者 (適格)
const DECLARER_NON = charDef('DECLARER_NON', { names: ['刑事'], traits: ['警察'], abilities: [d1] });        // a2 宣言者 (非適格)
const OPPCHAR = charDef('OPPCHAR', { ap: 3000 });                                // B05005 a2 mustGuard 付与対象
const ATK = charDef('ATK', { ap: 2000 });                                        // a3 cutin 自コンタクトキャラ
const OPPDEF = charDef('OPPDEF', { ap: 7000 });                                  // a3 cutin 相手
const MOB = charDef('MOB', { ap: 2000, level: 5 });                              // 汎用 decoy
const DK = charDef('DK', {});
const PART_B = partnerDef('PART_B', ['青']);
const PART_R = partnerDef('PART_R', ['赤']);

const FIXTURES = [
  USED4, USED_B, USED_R, TGT4, DECOY5, TGT_AP8000, DECOY_AP9000, SBD, NONBDS,
  DECLARER_BDS, DECLARER_NON, OPPCHAR, ATK, OPPDEF, MOB, DK, PART_B, PART_R,
];

function setHuman(s: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
}

function base(turn: 'self' | 'opp' = 'self', caseColors: string[] = ['青']): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.case = { ...s.players.self.case, colors: caseColors } as never;
  s.players.self.deck = ['DK', 'DK', 'DK', 'DK'];
  s.players.opp.deck = ['DK', 'DK', 'DK', 'DK'];
  return s;
}

function fileBacks(n: number, cardId = 'DK'): GameState['players']['self']['file'] {
  return Array.from({ length: n }, () => ({ type: 'card-back', cardId })) as GameState['players']['self']['file'];
}

// runNextHint は mutate.file.popTop が Immer current() を呼ぶため draft (produce) 内で駆動する
//   (cluster6 / engine-wave12 慣行)。setAutoFreeze(false) で produce 出力を可変に保ち、以降の
//   in-place harness (runAllUntilEmpty / drainScript) をそのまま続行できるよう新 state を返す。
function nh(s: GameState, cardId: string): GameState {
  return produce(s, (d) => { runNextHint(d as GameState, 'self', cardId); });
}

// pick / choice / optional を順に drain し script を 1 対 1 で適用する汎用ループ (hybrid-batch5 慣行)。
type ScriptAction = 'pick:skip' | 'optional:take' | 'optional:decline' | { pickCardId: string } | { pickUid: string } | { choiceIndex: number };
interface Recorded { verb: string; cardIds: string[] }
function drainScript(s: GameState, script: ScriptAction[]): { recorded: Recorded[]; prompts: number } {
  const recorded: Recorded[] = [];
  let i = 0;
  let prompts = 0;
  for (let g = 0; g < 50; g++) {
    const pick = _drainPendingEffectPickSide();
    if (pick) {
      prompts++;
      const cands = (pick.candidates as Array<{ uid: string; cardId: string }>).map((c) => ({ uid: c.uid, cardId: c.cardId }));
      recorded.push({ verb: pick.atomVerb, cardIds: cands.map((c) => c.cardId) });
      const a = script[i++];
      if (a === undefined) throw new Error(`pick "${pick.atomVerb}" surfaced but script exhausted (cands=${cands.map((c) => c.cardId).join(',')})`);
      if (a === 'pick:skip') applyPickSkipAndContinuation(s, pick, false);
      else if (typeof a === 'object' && 'pickCardId' in a) {
        const hit = cands.find((c) => c.cardId === a.pickCardId);
        if (!hit) throw new Error(`pickCardId ${a.pickCardId} not in ${pick.atomVerb} cands: ${cands.map((c) => c.cardId).join(',')}`);
        applyPickAndContinuation(s, pick, hit.uid);
      } else if (typeof a === 'object' && 'pickUid' in a) applyPickAndContinuation(s, pick, a.pickUid);
      else throw new Error(`pick "${pick.atomVerb}" surfaced but script action is ${JSON.stringify(a)}`);
      runAllUntilEmpty(s);
      continue;
    }
    const choice = _drainPendingEffectChoiceSide();
    if (choice) {
      prompts++;
      const a = script[i++];
      if (typeof a !== 'object' || !('choiceIndex' in a)) throw new Error(`choice surfaced but script action is ${JSON.stringify(a)}`);
      applyChoiceAndContinuation(s, choice, a.choiceIndex);
      runAllUntilEmpty(s);
      continue;
    }
    const opt = _drainPendingEffectOptionalSide();
    if (opt) {
      prompts++;
      const a = script[i++];
      if (a === 'optional:take') applyOptionalAndContinuation(s, opt, true);
      else if (a === 'optional:decline') applyOptionalAndContinuation(s, opt, false);
      else throw new Error(`optional surfaced but script action is ${JSON.stringify(a)}`);
      runAllUntilEmpty(s);
      continue;
    }
    break;
  }
  if (i < script.length) throw new Error(`${script.length - i} leftover script action(s) but no more prompts (over-scripted)`);
  return { recorded, prompts };
}

beforeEach(() => {
  (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
  (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B01005); registerCardDef(B03002); registerCardDef(B05005);
  for (const f of FIXTURES) registerCardDef(f);
  registerTriggeredListener();
  setHuman('self');
  setAutoFreeze(false); // produce(runNextHint) 出力を可変に保つ (in-place harness 継続用)
});

// ============================================================================
// B01005 江戸川コナン a1【パートナー青】【ターン1】ネクストヒント使用 → levelMax=$trigger.cardLevel の
//   キャラ1枚まで → デッキの下
// ============================================================================
describe('B01005 a1 next-hint → sceneToDeck (levelMax = $trigger.cardLevel)', () => {
  it('positive: lv4 カードをネクストヒント使用 → levelMax4 pick surface (lv5 decoy 候補外) → TGT4 デッキ下', () => {
    let s = base('self');
    s.players.self.partner.cardId = 'PART_B';
    mutate.scene.enter(s, 'self', 'B01005', {});
    mutate.scene.enter(s, 'opp', 'TGT4', {});   // lv4 → 候補
    mutate.scene.enter(s, 'opp', 'DECOY5', {}); // lv5 → 候補外
    s.players.self.file = fileBacks(5);
    s.players.self.hand = ['USED4'];
    s = nh(s, 'USED4'); // pop 1 (FILE 4), USED4(lv4 ≤ 4) 使用 → effect:declared viaNextHint
    runAllUntilEmpty(s);
    const { recorded } = drainScript(s, [{ pickCardId: 'TGT4' }]);
    expect(recorded[0]?.verb, 'sceneToDeck pick surface').toBe('sceneToDeck');
    expect(recorded[0]?.cardIds, 'lv4 TGT4 は候補').toContain('TGT4');
    expect(recorded[0]?.cardIds, 'lv5 DECOY5 は $trigger.cardLevel=4 で候補外').not.toContain('DECOY5');
    expect(s.players.opp.scene.some((c) => c.cardId === 'TGT4'), 'TGT4 は現場を離れた').toBe(false);
    expect(s.players.opp.deck[s.players.opp.deck.length - 1], 'TGT4 はデッキの下').toBe('TGT4');
    expect(s.players.opp.scene.some((c) => c.cardId === 'DECOY5'), 'DECOY5 は残存').toBe(true);
  });

  it('negative(a): 通常の手札の使用 (handUseCard) → viaNextHint 無し → 不発火 (★key regression)', () => {
    const s = base('self');
    s.players.self.partner.cardId = 'PART_B';
    mutate.scene.enter(s, 'self', 'B01005', {});
    mutate.scene.enter(s, 'opp', 'TGT4', {});
    s.players.self.file = fileBacks(5); // levelAllowed(lv4 ≤ FILE5) 充足
    s.players.self.hand = ['USED4'];
    handUseCard(s, 'self', 'USED4'); // 通常使用: effect:declared に viaNextHint 無し
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), '手札の使用では sceneToDeck 不発火').toBeNull();
    expect(s.players.opp.scene.some((c) => c.cardId === 'TGT4'), 'TGT4 据置').toBe(true);
  });

  it('negative(b): パートナー青 不成立 (赤P) → condition 不成立 → 不発火', () => {
    let s = base('self');
    s.players.self.partner.cardId = 'PART_R'; // 赤 → partnerColor青 false
    mutate.scene.enter(s, 'self', 'B01005', {});
    mutate.scene.enter(s, 'opp', 'TGT4', {});
    s.players.self.file = fileBacks(5);
    s.players.self.hand = ['USED4'];
    s = nh(s, 'USED4');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'partnerColor青 不成立 → 不発火').toBeNull();
    expect(s.players.opp.scene.some((c) => c.cardId === 'TGT4'), 'TGT4 据置').toBe(true);
  });

  it('negative(c):【ターン1】→ 同ターン2回目のネクストヒントは不発火', () => {
    let s = base('self');
    s.players.self.partner.cardId = 'PART_B';
    mutate.scene.enter(s, 'self', 'B01005', {});
    s.players.self.file = fileBacks(6);
    s.players.self.hand = ['USED4', 'USED4'];
    s = nh(s, 'USED4'); // 1回目
    runAllUntilEmpty(s);
    drainScript(s, ['pick:skip']); // 1回目 fire を消化 (0枚選択)
    s = nh(s, 'USED4'); // 2回目 (FILE/level 充足)
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), '【ターン1】で2回目は不発火').toBeNull();
  });
});

// ============================================================================
// B03002 江戸川コナン a1 next-hint → deckRevealUntil(上3枚)[少年探偵団]1枚まで手札 + 残りデッキ下
// ============================================================================
describe('B03002 a1 next-hint → deckRevealUntil top3 [少年探偵団] → hand', () => {
  it('positive: ネクストヒント使用 → 上3枚 reveal で SBD(少年探偵団) を手札に加える (NONBDS は候補外)', () => {
    let s = base('self');
    mutate.scene.enter(s, 'self', 'B03002', {});
    s.players.self.deck = ['SBD', 'NONBDS', 'DK', 'DK']; // 上3枚 window = SBD/NONBDS/DK
    s.players.self.file = fileBacks(3);
    s.players.self.hand = ['USED_B'];
    s = nh(s, 'USED_B'); // 青 lv1 使用 → a1 fire (色 gate 無し)
    runAllUntilEmpty(s);
    const { recorded } = drainScript(s, [{ pickCardId: 'SBD' }]);
    expect(recorded[0]?.verb, 'deckRevealUntil pick surface').toBe('deckRevealUntil');
    expect(recorded[0]?.cardIds, 'SBD は[少年探偵団]候補').toContain('SBD');
    expect(recorded[0]?.cardIds, 'NONBDS は非[少年探偵団]で候補外').not.toContain('NONBDS');
    expect(s.players.self.hand, 'SBD を手札に加えた').toContain('SBD');
    expect(s.players.self.deck.includes('SBD'), 'SBD はデッキから抜けた').toBe(false);
  });

  it('negative: 通常の手札の使用 → viaNextHint 無し → deckRevealUntil 不発火', () => {
    const s = base('self');
    mutate.scene.enter(s, 'self', 'B03002', {});
    s.players.self.deck = ['SBD', 'NONBDS', 'DK', 'DK'];
    s.players.self.file = fileBacks(3);
    s.players.self.hand = ['USED_B'];
    handUseCard(s, 'self', 'USED_B');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), '手札の使用では不発火').toBeNull();
    expect(s.players.self.hand.includes('SBD'), 'SBD は手札に加わらない').toBe(false);
  });
});

// ============================================================================
// B03002 a2 ability:declared observer: 自現場[少年探偵団]が【宣言】能力使用 → このキャラ 突撃(turn)
// ============================================================================
describe('B03002 a2 ability:declared → 突撃 grant', () => {
  it('positive: [少年探偵団]declarer が宣言能力使用 → B03002 が 突撃 を得る', () => {
    const s = base('self');
    const b3uid = mutate.scene.enter(s, 'self', 'B03002', {}).uid;
    const decl = mutate.scene.enter(s, 'self', 'DECLARER_BDS', {}).uid; // 少年探偵団
    expect(engine.read.char.keywords(s, b3uid), '発火前は 突撃 無し').not.toContain('突撃');
    activateDeclaredAbility(s, decl, 'd1'); // draw1 → ability:declared emit
    runAllUntilEmpty(s);
    drainScript(s, []); // observer 効果 (charGrantKeyword) は pick 非 surface
    expect(engine.read.char.keywords(s, b3uid), '[少年探偵団]宣言で B03002 に 突撃 付与').toContain('突撃');
  });

  it('negative: 非[少年探偵団](警察)declarer → triggerCharMatches 不成立 → 不付与', () => {
    const s = base('self');
    const b3uid = mutate.scene.enter(s, 'self', 'B03002', {}).uid;
    const decl = mutate.scene.enter(s, 'self', 'DECLARER_NON', {}).uid; // 少年探偵団でない
    activateDeclaredAbility(s, decl, 'd1');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'observer 不発火').toBeNull();
    expect(engine.read.char.keywords(s, b3uid), '非[少年探偵団]宣言では 突撃 無し').not.toContain('突撃');
  });
});

// ============================================================================
// B05005 江戸川コナン＆工藤新一 a1【パートナー青】【ターン1】ネクストヒントで【青】カード使用 →
//   AP8000以下1枚まで → デッキの下 (triggerCardMatches 色 gate)
// ============================================================================
describe('B05005 a1 next-hint【青】card → sceneToDeck (apMax 8000)', () => {
  it('positive:【青】カードをネクストヒント使用 → apMax8000 pick surface (AP9000 decoy 候補外) → デッキ下', () => {
    let s = base('self', ['青', '赤']);
    s.players.self.partner.cardId = 'PART_B';
    mutate.scene.enter(s, 'self', 'B05005', {});
    mutate.scene.enter(s, 'opp', 'TGT_AP8000', {});   // AP8000 (境界) → 候補
    mutate.scene.enter(s, 'opp', 'DECOY_AP9000', {}); // AP9000 → 候補外
    s.players.self.file = fileBacks(3);
    s.players.self.hand = ['USED_B']; // 青 lv1
    s = nh(s, 'USED_B');
    runAllUntilEmpty(s);
    const { recorded } = drainScript(s, [{ pickCardId: 'TGT_AP8000' }]);
    expect(recorded[0]?.verb, 'sceneToDeck pick surface').toBe('sceneToDeck');
    expect(recorded[0]?.cardIds, 'AP8000 は候補').toContain('TGT_AP8000');
    expect(recorded[0]?.cardIds, 'AP9000 は apMax8000 で候補外').not.toContain('DECOY_AP9000');
    expect(s.players.opp.scene.some((c) => c.cardId === 'TGT_AP8000'), 'TGT_AP8000 は現場を離れた').toBe(false);
    expect(s.players.opp.deck[s.players.opp.deck.length - 1], 'TGT_AP8000 はデッキの下').toBe('TGT_AP8000');
  });

  it('negative:【赤】カードをネクストヒント使用 → triggerCardMatches 色青 不成立 → 不発火', () => {
    let s = base('self', ['青', '赤']); // 赤カード使用のため case に赤を含める
    s.players.self.partner.cardId = 'PART_B'; // partnerColor青 は充足 (色 gate のみで判別)
    mutate.scene.enter(s, 'self', 'B05005', {});
    mutate.scene.enter(s, 'opp', 'TGT_AP8000', {});
    s.players.self.file = fileBacks(3);
    s.players.self.hand = ['USED_R']; // 赤 lv1
    s = nh(s, 'USED_R');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), '【赤】使用は triggerCardMatches 色青 で不発火').toBeNull();
    expect(s.players.opp.scene.some((c) => c.cardId === 'TGT_AP8000'), 'TGT_AP8000 据置').toBe(true);
  });
});

// ============================================================================
// B05005 a2【宣言】相手キャラ1枚まで mustGuard 付与 (PA-MR 経路で declared 駆動)
// ============================================================================
describe('B05005 a2 declared (PA-MR) → 相手キャラに mustGuard', () => {
  it('positive: PA-MR の a2 宣言 → 相手キャラを pick → mustGuard turnEffect 付与', () => {
    const s = base('self');
    s.players.self.partnerAreaMR = { cardId: 'B05005', uid: 'partnerMR:self', state: 'active', declaredUseCount: {} } as GameState['players']['self']['partnerAreaMR'];
    const oppUid = mutate.scene.enter(s, 'opp', 'OPPCHAR', {}).uid;
    activateDeclaredAbility(s, 'partnerMR:self', 'a2');
    runAllUntilEmpty(s);
    const { recorded } = drainScript(s, [{ pickCardId: 'OPPCHAR' }]);
    expect(recorded[0]?.verb, 'charSetTurnEffect pick surface').toBe('charSetTurnEffect');
    expect(recorded[0]?.cardIds, '相手キャラ OPPCHAR が候補').toContain('OPPCHAR');
    expect(engine.read.char.hasTextAbility(s, oppUid, 'mustGuard'), 'OPPCHAR に mustGuard 付与').toBe(true);
  });
});

// ============================================================================
// B05005 a3【カットイン】AP+2000 ($contact.byUid) — 出荷済 idiom (B08062 a3 同型)
// ============================================================================
describe('B05005 a3【カットイン】AP+2000 ($contact.byUid)', () => {
  it('positive: コンタクト中に自身をカットイン → 自コンタクトキャラ AP 2000+2000 = 4000 (相手は据置)', () => {
    setHuman(null); // cutin own-effect は human 非依存で自動適用 (tequila 慣行)
    const s = base('self');
    const atk = mutate.scene.enter(s, 'self', 'ATK', {}).uid;
    const bys = mutate.scene.enter(s, 'self', 'MOB', {}).uid;
    const dft = mutate.scene.enter(s, 'opp', 'OPPDEF', {}).uid;
    s.players.self.hand = ['B05005'];
    const ax: ActionContext = {
      id: 'ax', byUid: atk, byPlayer: 'self', target: { kind: 'char', uid: dft },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: atk, aAP: 2000, bUid: dft, bAP: 7000 }, contactImmune: false,
    };
    expect(canCutIn(s, ax, 'self', 'B05005')).toBe(true);
    cutIn(s, ax, 'self', 'B05005');
    runAllUntilEmpty(s);
    expect(engine.read.char.ap(s, atk), '自コンタクトキャラ +2000').toBe(4000);
    expect(engine.read.char.ap(s, bys), '非参加の傍観キャラは据置').toBe(2000);
    expect(engine.read.char.ap(s, dft), 'コンタクト相手は据置').toBe(7000);
  });
});
