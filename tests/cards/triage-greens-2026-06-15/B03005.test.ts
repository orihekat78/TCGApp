// gate5 RUNTIME behavior — B03005 工藤新一 (character, 青/探偵|高校生, Lv6 AP5000 LP1)
//
//   公式テキスト:
//     a1: 【パートナー青】【宣言】【スリープ】：レベル6以下の〚カード名［毛利蘭］〛のキャラを1枚まで選び、
//         ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//     a2: 【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある
//         〚カード名［江戸川コナン］〛を1枚まで選び、手札に加える。
//
//   rules: 13-keywords.md (突撃=名乗り中アクション可), 15-abilities-effects.md (「〜まで」=0枚可/必ず発動),
//          17-icons.md (【パートナー青】条件アイコン=条件未達なら能力を持たない扱い→宣言不可),
//          19-special-rules.md (cardName split-name), 21-declared-ability-cost.md (【スリープ】cost: active 必要),
//          10-action-event.md (ヒラメキ=証拠からアクションでリムーブされるとき発動), 14-refresh.md,
//          26-qa-deck-refresh.md.
//
// 検証の核 (BUG-117/118 教訓: DSL に filter を書いても engine が実評価する保証はない):
//   a1: charGrantKeyword {uid:'$pick', kw:'突撃', scope:'turn', target=pick{area:'scene', side:'either',
//       filter:{cardName:'毛利蘭', levelMax:6}, n:{min:0,max:1}}} の
//       (i) cardName:'毛利蘭' filter、(ii) levelMax:6 filter、(iii) side:'either' (どちらの現場でも) を
//       engine が **実際に評価** しているか。candidates.ts (matchOneFilter) が cardName(split-name) と
//       levelMax を honor、side:'either' で両陣営を列挙。Pattern A ($pick+target) が resolveEffectPicks で
//       picked.uid へ置換され grantKeyword が走るか。
//   a2: handAddFromRemove {player:'self', max:1, filter:{cardName:'江戸川コナン'}} の cardName filter を
//       evidence:remove-by-action (ヒラメキ) 経路で engine が実評価しているか。
//
// decoy/negative (filter/side/condition が実評価されている証明):
//   a1-D1: 自現場に 非毛利蘭キャラ (DEC_B03005_NONRAN=工藤新一) → cardName filter で候補外・効果なし。
//   a1-D2: 自現場に 毛利蘭 だが Lv7 (DEC_B03005_RAN_LV7) → levelMax6 超で候補外・効果なし。
//   a1-P : 相手現場の 毛利蘭 Lv6 (DEC_B03005_RAN_OPP) → side:'either' なので候補IN・効果対象 (positive)。
//   a1-N1: 「1枚まで」(rules/15) human decline (0-pick) → 毛利蘭が居ても突撃を付与しない。
//   a1-C1: 【パートナー青】未達 (パートナー赤) → canDeclaredAbility=false (能力を持たない扱い rules/17)。
//   a1-C2: cost【スリープ】— source が active のとき宣言→自身スリープ化。
//   a2-D1: リムーブに 非江戸川コナン (DEC_B03005_NONCONAN) のみ → cardName filter で 0枚 add。
//   a2-P : リムーブに 江戸川コナン (DEC_B03005_CONAN) → ヒラメキ fire で手札へ、decoy は残る。
//   a2-N : ヒラメキ skip → 何も起きない。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry, def as readDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import {
  drainAiEffectPicks,
  _drainAllEffectPicksForTest,
  applyPickSkipAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickQueueLength,
  resolveEffectPicks,
} from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B03005 } from '@/cards/ct-p03/B03005';
import type { GameState, CardDef, EffectCtx, AbilityDef } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};
const queue = (): PendingEffectPickSide[] =>
  (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue ?? [];

// ---- synthetic decoy / partner defs (prefix DEC_B03005_ で id 衝突回避) ----
// 毛利蘭 (cardName filter match 用)。突撃の有無を可視化。
function ran(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9999/${id}`, kind: 'character', names: ['毛利蘭'], colors: ['青'],
    level: 6, ap: 4000, lp: 1, traits: ['高校生'], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}
// 非毛利蘭 decoy (cardName filter で弾かれるべき)
function nonRan(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9999/${id}`, kind: 'character', names: ['工藤新一'], colors: ['青'],
    level: 6, ap: 4000, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}
// 江戸川コナン (a2 cardName filter match 用) — kind:event/character は a2 では問わない (リムーブ area)
function conan(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9999/${id}`, kind: 'character', names: ['江戸川コナン'], colors: ['青'],
    level: 4, ap: 3000, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}
// 非江戸川コナン (a2 decoy)
function nonConan(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9999/${id}`, kind: 'character', names: ['服部平次'], colors: ['赤'],
    level: 4, ap: 3000, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}
// synthetic partner def (色を可変に登録して【パートナー青】の達/未達を作る)
function partnerDef(id: string, colors: string[]): CardDef {
  return {
    id, no: `P/${id}`, kind: 'partner', names: [id], colors,
    level: 0, ap: 0, lp: 5, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}

const RAN_SELF = 'DEC_B03005_RAN_SELF';   // 毛利蘭 Lv6 self  → 候補IN
const RAN_OPP = 'DEC_B03005_RAN_OPP';     // 毛利蘭 Lv6 opp   → 候補IN (side:either)
const RAN_LV7 = 'DEC_B03005_RAN_LV7';     // 毛利蘭 Lv7       → 候補外 (levelMax6超)
const NONRAN = 'DEC_B03005_NONRAN';       // 工藤新一 Lv6     → 候補外 (cardName)
const CONAN = 'DEC_B03005_CONAN';         // 江戸川コナン     → a2 候補IN
const NONCONAN = 'DEC_B03005_NONCONAN';   // 服部平次         → a2 候補外
const PARTNER_BLUE = 'DEC_B03005_PARTNER_BLUE';
const PARTNER_RED = 'DEC_B03005_PARTNER_RED';

function declareCtx(uid = 'shin#1'): EffectCtx {
  return { source: { cardId: 'B03005', uid, abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };
}

describe('B03005 工藤新一 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    registerCardDef(B03005);
    registerCardDef(ran(RAN_SELF, { level: 6 }));
    registerCardDef(ran(RAN_OPP, { level: 6 }));
    registerCardDef(ran(RAN_LV7, { level: 7 }));
    registerCardDef(nonRan(NONRAN, { level: 6 }));
    registerCardDef(conan(CONAN));
    registerCardDef(nonConan(NONCONAN));
    registerCardDef(partnerDef(PARTNER_BLUE, ['青']));
    registerCardDef(partnerDef(PARTNER_RED, ['赤']));
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    _resetPendingHirameki();
    setHuman(null);
  });

  // ===== a1 本道 + DECOY: 候補は 自/相手現場の毛利蘭Lv6 のみ、突撃付与 (cardName/levelMax/side:either 実評価) =====
  it('a1 + DECOY: 候補=自現場毛利蘭Lv6 + 相手現場毛利蘭Lv6 のみ (非毛利/Lv7 除外)、選択キャラに突撃付与', () => {
    setHuman('self'); // pending pick を覗いて候補集合を decoy 検証
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner = { cardId: PARTNER_BLUE, state: 'active', location: 'partner-area' }; // 【パートナー青】成立
    s.players.self.scene = [
      sceneChar('B03005', 'shin#1'),
      sceneChar(RAN_SELF, 'ran#1'),     // match (自現場・毛利蘭・Lv6)
      sceneChar(RAN_LV7, 'ranlv7#1'),   // decoy (毛利蘭だが Lv7 > levelMax6)
      sceneChar(NONRAN, 'nonran#1'),    // decoy (工藤新一 = cardName 違い)
    ];
    s.players.opp.scene = [
      sceneChar(RAN_OPP, 'ranopp#1'),   // match (相手現場・毛利蘭・Lv6) — side:'either' 検証 (positive)
    ];

    expect(canDeclaredAbility(s, 'shin#1', 'a1'), '【パートナー青】成立 → 宣言可').toBe(true);
    // 発火前スナップショット
    expect(read.char.keywords(s, 'ran#1')).not.toContain('突撃');
    expect(read.char.keywords(s, 'ranopp#1')).not.toContain('突撃');
    expect(read.char.state(s, 'shin#1'), 'source は active').toBe('active');

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'shin#1', 'a1'); // cost sleepSelf を pay + effect 解決 walk
      runAllUntilEmpty(d);
    });

    // ---- cost【スリープ】: source 自身が sleep 化 ----
    expect(read.char.state(s, 'shin#1'), 'cost sleepSelf で source スリープ').toBe('sleep');

    // ---- DECOY 主張: 候補集合は 毛利蘭Lv6 (自 ran#1 / 相手 ranopp#1) のちょうど2件 ----
    expect(_peekPendingEffectPickQueueLength(), 'pick が surface').toBe(1);
    const pending = queue()[0]!;
    expect(pending.atomVerb, 'charGrantKeyword の pick').toBe('charGrantKeyword');
    expect(pending.nMin, '「〜まで」=0枚可 (nMin 0)').toBe(0);
    const cand = pending.candidates.map((c) => c.uid).sort();
    expect(cand, '毛利蘭Lv6 のみ (自+相手)、Lv7/非毛利は除外').toEqual(['ran#1', 'ranopp#1'].sort());

    // ---- pick を解決して実 mutation を確認 (AI が候補先頭=ran#1 を選ぶ) ----
    s = produce(s, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    const grantedSelf = read.char.hasKeyword(s, 'ran#1', '突撃');
    const grantedOpp = read.char.hasKeyword(s, 'ranopp#1', '突撃');
    expect(grantedSelf || grantedOpp, '候補(毛利蘭Lv6)のいずれかに突撃付与').toBe(true);
    // DECOY: Lv7 毛利蘭 と 非毛利キャラ は突撃なし
    expect(read.char.hasKeyword(s, 'ranlv7#1', '突撃'), 'decoy(毛利蘭Lv7) 突撃なし (levelMax6)').toBe(false);
    expect(read.char.hasKeyword(s, 'nonran#1', '突撃'), 'decoy(工藤新一) 突撃なし (cardName)').toBe(false);
  });

  // ===== a1 (AI 経路): side:either で 自現場の毛利蘭Lv6 のみ存在 → 自動付与 =====
  it('a1 (AI): 自現場の毛利蘭Lv6 に突撃を自動付与 / Lv7・非毛利は不変 (cardName+levelMax 実評価)', () => {
    setHuman(null); // AI 経路
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner = { cardId: PARTNER_BLUE, state: 'active', location: 'partner-area' };
    s.players.self.scene = [
      sceneChar('B03005', 'shin#1'),
      sceneChar(RAN_SELF, 'ran#1'),     // 唯一の有効候補
      sceneChar(RAN_LV7, 'ranlv7#1'),   // decoy Lv7
      sceneChar(NONRAN, 'nonran#1'),    // decoy cardName
    ];

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'shin#1', 'a1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(read.char.hasKeyword(s, 'ran#1', '突撃'), 'AI: 毛利蘭Lv6 に突撃付与').toBe(true);
    expect(read.char.hasKeyword(s, 'ranlv7#1', '突撃'), 'AI: 毛利蘭Lv7 decoy は不変').toBe(false);
    expect(read.char.hasKeyword(s, 'nonran#1', '突撃'), 'AI: 非毛利 decoy は不変').toBe(false);
    // grant scope は turn (ターン終了時まで) であることを log で確認
    const grantLog = s.log.find((l) => l.action === 'effect:charGrantKeyword' && l.target === 'ran#1');
    expect(grantLog?.result, 'scope:turn (ターン終了時まで)').toBe('突撃/turn');
  });

  // ===== a1 N1: 「1枚まで」human decline (0-pick) — 毛利蘭が居ても突撃なし =====
  it('a1 N1: human decline (0-pick) — 毛利蘭が居ても突撃を付与しない (「〜まで」=0枚可)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner = { cardId: PARTNER_BLUE, state: 'active', location: 'partner-area' };
    s.players.self.scene = [
      sceneChar('B03005', 'shin#1'),
      sceneChar(RAN_SELF, 'ran#1'),
    ];

    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'shin#1', 'a1');
      runAllUntilEmpty(d);
    });
    const pending = queue()[0]!;
    expect(pending.nMin, '0枚可').toBe(0);

    _clearPendingEffectPickQueue();
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending);
    });
    expect(read.char.hasKeyword(s, 'ran#1', '突撃'), 'decline: 毛利蘭に突撃なし').toBe(false);
    // cost は支払済み (source は依然スリープ) — decline は effect のみキャンセル
    expect(read.char.state(s, 'shin#1'), 'cost sleepSelf は支払済み (source スリープ)').toBe('sleep');
  });

  // ===== a1 C1: 【パートナー青】未達 — canDeclaredAbility=false (条件未達=能力を持たない扱い rules/17) =====
  it('a1 C1: パートナーが赤 → 【パートナー青】未達 → canDeclaredAbility=false (条件アイコン gate)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner = { cardId: PARTNER_RED, state: 'active', location: 'partner-area' }; // 赤 → 未達
    s.players.self.scene = [
      sceneChar('B03005', 'shin#1'),
      sceneChar(RAN_SELF, 'ran#1'),
    ];
    expect(canDeclaredAbility(s, 'shin#1', 'a1'), '【パートナー青】未達 → 宣言不可').toBe(false);
    // 対して青パートナーなら宣言可 (条件 toggle の対)
    const ok = produce(s, (d) => { d.players.self.partner.cardId = PARTNER_BLUE; });
    expect(canDeclaredAbility(ok, 'shin#1', 'a1'), '【パートナー青】成立 → 宣言可').toBe(true);
  });

  // ===== a2 本道 + DECOY: ヒラメキで リムーブの江戸川コナンを手札へ、非江戸川コナンは残る (cardName 実評価) =====
  it('a2 + DECOY: ヒラメキ fire で リムーブの江戸川コナンを手札へ / 非江戸川コナン(服部平次)は残る', () => {
    setHuman(null); // AI auto-pick (hiramekiResolve は chooseAtomTarget で解決)
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    // B03005 が証拠としてリムーブされる側 = self (ヒラメキ発動権利者)
    s.players.self.evidence = [{ type: 'card-back', cardId: 'B03005' }];
    s.players.self.remove = [CONAN, NONCONAN]; // 江戸川コナン (該当) + 服部平次 (decoy)

    // (1) アクション[事件] による証拠リムーブを emit → listener が pendingHirameki を push
    s = produce(s, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B03005' } }, { player: 'self', uid: 'atk' });
    });
    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ side-channel に push').not.toBeNull();
    expect(pending!.cardId, 'B03005 の a2').toBe('B03005');
    expect(pending!.abilityId).toBe('a2');
    expect(pending!.player, 'リムーブされた側=self が発動権利者').toBe('self');

    // (2) ヒラメキ fire を再現 (useEngineDispatch:hiramekiResolve と同じ手順)
    s = produce(s, (d) => {
      const def = readDef.card(pending!.cardId)!;
      const ability = def.abilities.find((a) => a.id === pending!.abilityId)!;
      const ctx: EffectCtx = { source: { player: pending!.player, cardId: pending!.cardId, area: 'evidence' }, bindings: {} };
      const aiPolicy = new HeuristicPolicy();
      const resolved = resolveEffectPicks(d, ability.effect!, ctx, {
        chooseAtomTarget: aiPolicy.chooseAtomTarget?.bind(aiPolicy),
        byPlayer: pending!.player,
      });
      event.queue(d, resolved, { player: pending!.player, cardId: pending!.cardId }, 'evidence:remove-by-action', { player: pending!.player, ev: { cardId: pending!.cardId } });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // 江戸川コナンは手札へ、リムーブから抜ける
    expect(s.players.self.hand.includes(CONAN), '江戸川コナンを手札に加える').toBe(true);
    expect(s.players.self.remove.includes(CONAN), '江戸川コナンはリムーブから抜けた').toBe(false);
    // DECOY: 非江戸川コナン (服部平次) は手札に入らず リムーブに残る (cardName filter 実評価)
    expect(s.players.self.hand.includes(NONCONAN), '服部平次は手札に入らない (cardName違い)').toBe(false);
    expect(s.players.self.remove.includes(NONCONAN), '服部平次はリムーブに残る').toBe(true);
  });

  // ===== a2 N1: リムーブに江戸川コナンが無い → 0枚 add (cardName filter unmet) =====
  it('a2 N1: リムーブに非江戸川コナン (服部平次) のみ → ヒラメキ fire しても手札に何も加えない', () => {
    setHuman(null);
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.evidence = [{ type: 'card-back', cardId: 'B03005' }];
    s.players.self.remove = [NONCONAN]; // 江戸川コナン 不在

    s = produce(s, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B03005' } }, { player: 'self', uid: 'atk' });
    });
    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ push (発動権利は得る)').not.toBeNull();

    s = produce(s, (d) => {
      const def = readDef.card(pending!.cardId)!;
      const ability = def.abilities.find((a) => a.id === pending!.abilityId)!;
      const ctx: EffectCtx = { source: { player: pending!.player, cardId: pending!.cardId, area: 'evidence' }, bindings: {} };
      const aiPolicy = new HeuristicPolicy();
      const resolved = resolveEffectPicks(d, ability.effect!, ctx, {
        chooseAtomTarget: aiPolicy.chooseAtomTarget?.bind(aiPolicy),
        byPlayer: pending!.player,
      });
      event.queue(d, resolved, { player: pending!.player, cardId: pending!.cardId }, 'evidence:remove-by-action', { player: pending!.player, ev: { cardId: pending!.cardId } });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(s.players.self.hand.includes(NONCONAN), '非江戸川コナンは手札に加えない (filter unmet)').toBe(false);
    expect(s.players.self.remove.includes(NONCONAN), '服部平次はリムーブに残る').toBe(true);
    expect(s.players.self.hand.length, '手札 0 (何も加わらない)').toBe(0);
  });

  // ===== a2 N2: ヒラメキ skip — 何も起きない (optional fire/skip の skip 側) =====
  it('a2 N2: ヒラメキ skip — 江戸川コナンがリムーブに居ても手札に加えない (fire しない)', () => {
    setHuman(null);
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.evidence = [{ type: 'card-back', cardId: 'B03005' }];
    s.players.self.remove = [CONAN];

    s = produce(s, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B03005' } }, { player: 'self', uid: 'atk' });
    });
    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ push').not.toBeNull();
    // skip = fire しない (effect を queue しない) → state 不変
    expect(s.players.self.hand.includes(CONAN), 'skip: 手札に入らない').toBe(false);
    expect(s.players.self.remove.includes(CONAN), 'skip: 江戸川コナンはリムーブに残る').toBe(true);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=declared/partnerColor青/sleepSelf cost/choice[charGrantKeyword $pick 突撃 turn, side:either, cardName毛利蘭 levelMax6], a2=hirameki handAddFromRemove cardName江戸川コナン', () => {
    const [a1, a2] = B03005.abilities as AbilityDef[];
    expect(a1).toMatchObject({ type: 'declared', scope: 'on-scene', condition: { kind: 'partnerColor', color: '青' }, cost: { kind: 'sleepSelf' } });
    const choice = a1.effect as { kind: string; options: Array<{ verb?: string; args?: Record<string, unknown> }> };
    expect(choice.kind).toBe('choice');
    expect(choice.options.length, '単一 option (choice は構造的に透過)').toBe(1);
    expect(choice.options[0]).toMatchObject({
      verb: 'charGrantKeyword',
      args: {
        uid: '$pick', kw: '突撃', scope: 'turn',
        target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { cardName: '毛利蘭', levelMax: 6 } }, n: { min: 0, max: 1 } },
      },
    });
    expect(a2).toMatchObject({
      type: 'triggered', scope: 'on-evidence',
      trigger: { hook: 'evidence:remove-by-action', optional: true },
      effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '江戸川コナン' } } },
    });
  });
});
