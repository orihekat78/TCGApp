// gate5 RUNTIME behavior — PR060 服部平次 (character, 緑/探偵・高校生, L5 AP4000 LP1)
//
// 公式テキスト:
//   【解決編】【登場時】相手の現場にスリープ状態かスタン状態のキャラが合わせて2枚以上いる場合、
//     レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする。
//     （自分の事件が解決編になっている場合、この能力か効果を使える）
//
// rules: 03-field-areas.md (state アクティブ/スリープ/スタン) / 15-abilities-effects.md (「〜まで」=0枚可) /
//        17-icons.md (【解決編】= 条件アイコン / 充足しないとその能力を「持っていない」扱い) /
//        20-color-and-switch.md (手札使用 = 事件色制限) / 24-qa-naming-stun.md (状態定義)
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   handUseCard('PR060') で現場登場 → enter hook → triggered listener が
//   ability.condition(caseStatus:解決編) を gate → conditional の if(sceneHas opp sleep|stun ≥2) を評価 →
//   then の sceneRemove 短縮形 pick を surface (setHuman('self') で候補を覗いて decoy 検証)。
//
// 検証する filter / 条件 (BUG-117/118 lesson — DSL に書いても engine が実評価する保証はない):
//   (COND-A) ability.condition {caseStatus:'解決編'} — 事件編では a1 そのものが発火しない (eval.ts caseStatus)。
//   (IF-A)   conditional.if {sceneHas opp, state:['sleep','stun'], nMin:2} — 相手現場の sleep|stun が
//            2枚未満なら removal しない (sceneHas candidates(query).count>=nMin)。**相手側のみカウント**。
//   (THEN-A) sceneRemove filter {levelMax:7} — level8 の sleep キャラは removal 候補に出ない (matchOneFilter levelMax)。
//   (THEN-B) sceneRemove state:['sleep'] — active/stun キャラは removal 候補に出ない (matchesQueryForChar state filter)。
//            ※ if は sleep|stun を数えるが、removal 対象は **sleep のみ** という語義差を実証する。
//   (THEN-C) side:'either' — 相手・自分どちらの sleep≤7 も候補 (text に side 指定なし)。
//   (NEG)    「1枚まで」(rules/15) human decline (0-pick) → 候補が居ても誰もリムーブされない。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import { PR060 } from '@/cards/pr-01/PR060';
import type { CardDef, GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// 合成 def (id prefix DEC_PR060_ で衝突回避)。色は filter に無関係 (緑にしておく)。
function charDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 5, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

// removal HIT: 相手現場の sleep Lv5 (state:sleep ✔ / levelMax7 ✔) → 唯一の removal 候補。
const SLEEP_HIT = 'DEC_PR060_SLEEP_HIT';
// if-count にも removal にも効く相方: 相手現場の stun Lv5。
//   if(sleep|stun ≥2) には数えられるが、removal state:['sleep'] では候補外 (THEN-B decoy)。
const STUN_CHAR = 'DEC_PR060_STUN';
// removal DECOY (levelMax): 相手現場の sleep Lv8 → if には数えるが levelMax7 超で removal 候補外。
const SLEEP_L8 = 'DEC_PR060_SLEEP_L8';
// removal DECOY (state): 相手現場の active Lv5 → if(sleep|stun) にも数えず removal 候補外。
const ACTIVE_CHAR = 'DEC_PR060_ACTIVE';
// 自陣の sleep Lv5 → side:'either' なので removal 候補に入る (THEN-C)。if(opp側) には数えない。
const SELF_SLEEP = 'DEC_PR060_SELF_SLEEP';

function registerDecoys(): void {
  registerCardDef(charDef(SLEEP_HIT, { level: 5 }));
  registerCardDef(charDef(STUN_CHAR, { level: 5 }));
  registerCardDef(charDef(SLEEP_L8, { level: 8 }));
  registerCardDef(charDef(ACTIVE_CHAR, { level: 5 }));
  registerCardDef(charDef(SELF_SLEEP, { level: 5 }));
}

// PR060 を手札使用して登場させる base。緑/Lv5 → 事件緑 + FILE5 でゲート通過。
function enterBase(caseStatus: '事件編' | '解決編'): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.hand = ['PR060'];
  s.players.self.case = { cardId: '', status: caseStatus, requiredEvidence: 7, colors: ['緑'], declaredUseCount: {} };
  s.players.self.file = [FB, FB, FB, FB, FB]; // FILE5 ≥ level5 (rules/12)
  s.players.self.deck = ['d1', 'd2'];
  s.players.opp.deck = ['e1', 'e2'];
  return s;
}

describe('PR060 服部平次 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    setHuman(null);
  });

  // ===== POSITIVE + DECOY: 解決編 + 相手 sleep|stun≥2 → sceneRemove pick surface。
  //        候補は sleep かつ level≤7 のみ (stun/active/level8 は除外、自陣 sleep は side:either で含む) =====
  it('a1 + DECOY: 登場で removal pick surface — 候補は sleep×level≤7 のみ (stun/active/lv8 除外, 自陣sleep含む)', () => {
    setHuman('self'); // pick を覗いて候補集合を検証
    let s = enterBase('解決編');
    // 相手現場: sleep Lv5 (HIT) + stun Lv5 (if 用相方) + sleep Lv8 (decoy) + active Lv5 (decoy)
    s.players.opp.scene = [
      sceneChar(SLEEP_HIT, 'oh#1', { state: 'sleep' }),
      sceneChar(STUN_CHAR, 'os#1', { state: 'stun' }),
      sceneChar(SLEEP_L8, 'ol8#1', { state: 'sleep' }),
      sceneChar(ACTIVE_CHAR, 'oa#1', { state: 'active' }),
    ];
    // 自陣にも sleep Lv5 (side:'either' 検証)。PR060 は登場後 active+named → removal 候補にならない。
    s.players.self.scene = [sceneChar(SELF_SLEEP, 'ss#1', { state: 'sleep' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR060');
      runAllUntilEmpty(d);
    });

    // PR060 が現場登場
    expect(s.players.self.scene.some((c) => c.cardId === 'PR060'), 'PR060 が登場').toBe(true);

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sceneRemove pick が surface (= a1 発火 + if 成立)').toBe('sceneRemove');
    expect(pending?.nMin, '「1枚まで」=0枚可 (decline channel)').toBe(0);
    const candCardIds = pending!.candidates.map((c) => c.cardId).sort();
    // THEN-A/B/C decoy 主張:
    expect(candCardIds, 'sleep Lv5 (HIT) は候補').toContain(SLEEP_HIT);
    expect(candCardIds, '自陣 sleep Lv5 は side:either で候補').toContain(SELF_SLEEP);
    expect(candCardIds, 'stun は state:[sleep] で候補外 (if は数えるが removal 対象外)').not.toContain(STUN_CHAR);
    expect(candCardIds, 'sleep Lv8 は levelMax7 超で候補外').not.toContain(SLEEP_L8);
    expect(candCardIds, 'active は state:[sleep] で候補外').not.toContain(ACTIVE_CHAR);
    expect(candCardIds, 'PR060 自身 (active+named) は候補外').not.toContain('PR060');
    // 候補はちょうど {SLEEP_HIT, SELF_SLEEP} の 2 枚
    expect(candCardIds, '候補は sleep×level≤7 の 2 枚のみ').toEqual([SELF_SLEEP, SLEEP_HIT].sort());
  });

  it('a1: pick で sleep Lv5 (HIT) を選択 → リムーブされる / decoy 群は盤面に残る', () => {
    setHuman('self');
    let s = enterBase('解決編');
    s.players.opp.scene = [
      sceneChar(SLEEP_HIT, 'oh#1', { state: 'sleep' }),
      sceneChar(STUN_CHAR, 'os#1', { state: 'stun' }),
      sceneChar(SLEEP_L8, 'ol8#1', { state: 'sleep' }),
      sceneChar(ACTIVE_CHAR, 'oa#1', { state: 'active' }),
    ];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR060');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const hitCand = pending.candidates.find((c) => c.cardId === SLEEP_HIT)!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, hitCand.uid);
    });

    expect(s.players.opp.scene.some((c) => c.cardId === SLEEP_HIT), 'sleep Lv5 (HIT) はリムーブされた').toBe(false);
    expect(s.players.opp.remove.includes(SLEEP_HIT), 'HIT は相手リムーブエリアへ').toBe(true);
    // DECOY: stun / sleepLv8 / active は盤面に残る (filter が実評価された証明)
    expect(s.players.opp.scene.some((c) => c.cardId === STUN_CHAR), 'stun decoy は盤面に残る').toBe(true);
    expect(s.players.opp.scene.some((c) => c.cardId === SLEEP_L8), 'sleep Lv8 decoy は盤面に残る').toBe(true);
    expect(s.players.opp.scene.some((c) => c.cardId === ACTIVE_CHAR), 'active decoy は盤面に残る').toBe(true);
  });

  // ===== COND-A NEGATIVE: 【解決編】未達 (事件編) → a1 そのものが発火しない =====
  it('a1 NEGATIVE (caseStatus): 事件編では sleep|stun≥2 でも removal pick が立たない (条件アイコン未達)', () => {
    setHuman('self');
    let s = enterBase('事件編'); // 事件編 → 【解決編】不成立 → 能力を「持っていない」扱い (rules/17)
    s.players.opp.scene = [
      sceneChar(SLEEP_HIT, 'oh#1', { state: 'sleep' }),
      sceneChar(STUN_CHAR, 'os#1', { state: 'stun' }),
    ];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR060');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.some((c) => c.cardId === 'PR060'), 'PR060 は登場している').toBe(true);
    expect(pickQueue().length, '事件編 → a1 非発火 (caseStatus gate)').toBe(0);
    expect(s.players.opp.scene.some((c) => c.cardId === SLEEP_HIT), 'HIT はリムーブされない').toBe(true);
  });

  // ===== IF-A NEGATIVE: 相手 sleep|stun が 1枚 (< nMin2) → conditional 不成立 → removal なし =====
  it('a1 NEGATIVE (sceneHas <2): 相手 sleep|stun が 1枚だけなら removal pick が立たない (if 不成立)', () => {
    setHuman('self');
    let s = enterBase('解決編');
    // 相手現場に sleep 1枚のみ (if の nMin:2 未満)。removal 候補相当の sleep≤7 は居るが if で gate。
    s.players.opp.scene = [sceneChar(SLEEP_HIT, 'oh#1', { state: 'sleep' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR060');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.some((c) => c.cardId === 'PR060'), 'PR060 は登場している').toBe(true);
    expect(pickQueue().length, '相手 sleep|stun 1枚 → if(≥2) 不成立 → removal pick なし').toBe(0);
    expect(s.players.opp.scene.some((c) => c.cardId === SLEEP_HIT), 'HIT はリムーブされない').toBe(true);
  });

  // ===== IF-A NEGATIVE (side): 相手 sleep1 + 自分 sleep1 = opp側は1枚 → if 不成立 =====
  //   sceneHas の side:'opp' を実評価している証明 (自陣 sleep を数えていない)。
  it('a1 NEGATIVE (sceneHas side:opp): 相手 sleep1 + 自分 sleep1 でも opp側1枚なので if 不成立', () => {
    setHuman('self');
    let s = enterBase('解決編');
    s.players.opp.scene = [sceneChar(SLEEP_HIT, 'oh#1', { state: 'sleep' })];
    s.players.self.scene = [sceneChar(SELF_SLEEP, 'ss#1', { state: 'sleep' })]; // 自陣 sleep は if に数えない
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR060');
      runAllUntilEmpty(d);
    });
    expect(pickQueue().length, '相手 sleep は1枚 (自陣 sleep は side:opp で数えない) → if 不成立').toBe(0);
    expect(s.players.opp.scene.some((c) => c.cardId === SLEEP_HIT), '相手 HIT は残る').toBe(true);
    expect(s.players.self.scene.some((c) => c.cardId === SELF_SLEEP), '自陣 sleep も残る').toBe(true);
  });

  // ===== NEG: 「1枚まで」(rules/15) human decline (0-pick) → 候補が居ても誰もリムーブされない =====
  it('a1 NEGATIVE (0-pick): decline で候補(sleep Lv5)が居ても誰もリムーブされない (「〜まで」=0枚可)', () => {
    setHuman('self');
    let s = enterBase('解決編');
    s.players.opp.scene = [
      sceneChar(SLEEP_HIT, 'oh#1', { state: 'sleep' }),
      sceneChar(STUN_CHAR, 'os#1', { state: 'stun' }),
    ];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR060');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    expect(pending.atomVerb, 'pick surface').toBe('sceneRemove');
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending); // 0-pick (「1枚まで」=0枚可)
    });
    expect(s.players.opp.scene.some((c) => c.cardId === SLEEP_HIT), 'decline: HIT はリムーブされない').toBe(true);
    expect(s.players.opp.remove.includes(SLEEP_HIT), 'decline: リムーブエリアに移っていない').toBe(false);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1 = enter/解決編 conditional(sceneHas opp sleep|stun ≥2) → sceneRemove{levelMax:7,state:[sleep],either}', () => {
    const a1 = PR060.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.condition).toMatchObject({ kind: 'caseStatus', status: '解決編' });
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const eff = a1.effect as {
      kind: string;
      if: { kind: string; query: Record<string, unknown>; nMin: number };
      then: { kind: string; verb: string; args: Record<string, unknown> };
    };
    expect(eff.kind).toBe('conditional');
    expect(eff.if).toMatchObject({ kind: 'sceneHas', query: { area: 'scene', side: 'opp', state: ['sleep', 'stun'] }, nMin: 2 });
    expect(eff.then.verb).toBe('sceneRemove');
    expect(eff.then.args).toMatchObject({ player: 'self', max: 1, side: 'either', filter: { levelMax: 7 }, state: ['sleep'] });
  });
});
