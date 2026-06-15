// gate5 RUNTIME behavior — B01062 赤井秀一 (character, 赤/FBI・赤井家, L8 AP7000 LP2)
//
// 公式テキスト:
//   a1 【パートナー赤】【ターン1】自分の現場にいるキャラがアクション［事件］したとき、
//        レベル7以下のキャラを1枚まで選び、リムーブする。
//   a2 【宣言】【ターン1】【赤】のキャラを1枚まで選び、ターン終了時までAP＋1000する。
//
// rules: 07-action-flow.md / 10-action-event.md (action[事件]) / 15-abilities-effects.md (「〜まで」=0枚可) /
//        17-icons.md (【パートナー色】【ターン1】= 条件/回数アイコン) / 21-declared-ability-cost.md (【宣言】) /
//        22-qa-action-contact.md (action:declare は宣言時=ガード判定前に発火) / 24-qa-naming-stun.md (【ターン1】は発火でカウント)
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   a1: declare(attackerUid, {kind:'case', player:'opp'}) → state-machine が action:declare emit (宣言時, rules/22)
//       → triggered listener が matcherCondition(triggerActionKind:case + triggerCharMatches self) と
//          ability.condition(partnerColor:赤) を gate → sceneRemove 短縮形 pick を surface。
//   a2: useDeclaredAbility(B01062uid, 'a2') → effect:declared → charModifyAP 短縮形 pick を surface。
//
// 検証する filter / 条件 (BUG-117/118 lesson — DSL に書いても engine が評価する保証はない):
//   (a1-A) sceneRemove filter {levelMax:7} を engine が **実評価** しているか。
//          targetFilterToPredicate (atom-handlers.ts) が filter.levelMax を d.level>7 で除外する。
//          → DECOY: level8 のキャラ (B01062 自身 + 合成 level8) は **候補に出ない**。level7 のみ候補。
//   (a1-B) 【パートナー赤】(partnerColor) — partner が 赤 でないと a1 そのものが発火しない (eval.ts partnerColor)。
//   (a1-C) triggerActionKind{v:'case'} — action[キャラ] では発火しない (subtype filter)。
//   (a1-D) triggerCharMatches{side:'self'} — 自分の現場キャラの action でのみ発火 (相手の action[事件] では非発火)。
//   (a1-N) 「1枚まで」(rules/15) human decline (0-pick) → level7 が居ても誰もリムーブしない。
//          かつ 【ターン1】は発火でカウント (rules/24) → 同ターン2回目の action[事件] では再 surface しない。
//   (a2-A) charModifyAP filter {color:'赤'} を engine が **実評価** — 赤キャラのみ候補、青 decoy は除外。
//   (a2-B) scope:'turn' = ターン終了時まで AP+1000 (read.char.ap が turnEffect 合算)。
//   (a2-N) 【ターン1】 — 1回使用後 canDeclaredAbility=false (再使用不可)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { declare, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read/index';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import { B01062 } from '@/cards/ct-p01/B01062';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// 合成 def 群 (id prefix DEC_B01062_ で衝突回避)。
// 赤 partner (【パートナー赤】成立用)。
function redPartnerDef(): CardDef {
  return {
    id: 'DEC_B01062_REDPARTNER', no: '9/REDP', kind: 'partner', names: ['赤パートナー'],
    colors: ['赤'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'P', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}
function bluePartnerDef(): CardDef {
  return {
    id: 'DEC_B01062_BLUEPARTNER', no: '9/BLUEP', kind: 'partner', names: ['青パートナー'],
    colors: ['青'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'P', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}
function charDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

// id 定数
const ATTACKER = 'DEC_B01062_ATTACKER';   // 自分の現場キャラ — action[事件] を行う (赤/level5)
const LV7 = 'DEC_B01062_LV7';             // a1 sceneRemove 候補 (level7 = levelMax7 該当)
const LV8 = 'DEC_B01062_LV8';             // a1 DECOY (level8 > levelMax7 → 候補外)
const A2RED = 'DEC_B01062_A2RED';         // a2 候補 (赤 → color filter 該当)
const A2BLUE = 'DEC_B01062_A2BLUE';       // a2 DECOY (青 → color filter 候補外)

function registerDecoys(): void {
  registerCardDef(redPartnerDef());
  registerCardDef(bluePartnerDef());
  registerCardDef(charDef(ATTACKER, { colors: ['赤'], level: 5 }));
  registerCardDef(charDef(LV7, { colors: ['黄'], level: 7 }));
  registerCardDef(charDef(LV8, { colors: ['黄'], level: 8 }));
  registerCardDef(charDef(A2RED, { colors: ['赤'], ap: 3000, level: 4 }));
  registerCardDef(charDef(A2BLUE, { colors: ['青'], ap: 3000, level: 4 }));
}

// a1 base: 自分ターン / 赤 partner / B01062 + 攻撃キャラ on scene / 相手 case に証拠1 (action[事件] 合法化)。
function a1Base(partnerCardId: string): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.partner = { cardId: partnerCardId, state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: '', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
  s.players.opp.case = { cardId: '', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
  // B01062 (a1 listener: on-scene 必須) + 攻撃キャラ
  s.players.self.scene = [
    sceneChar('B01062', 'akai#1', { state: 'active' }),
    sceneChar(ATTACKER, 'atk#1', { state: 'active' }),
  ];
  // 相手証拠1 (rules/07: 証拠0の事件は action[事件] 対象外)
  s.players.opp.evidence = [{ cardId: 'ev', faceUp: false, origin: { turn: 1, via: 'action-case' } }];
  s.players.self.deck = ['d1', 'd2', 'd3', 'd4'];
  s.players.opp.deck = ['e1', 'e2'];
  return s;
}

describe('B01062 赤井秀一 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _resetActionContexts();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    setHuman(null);
  });

  // ===== a1-A + DECOY: action[事件] で level7以下のみ候補、level8 (decoy + B01062自身) は除外 =====
  it('a1 + DECOY: 自分キャラの action[事件] で sceneRemove pick が surface — 候補は level7以下のみ (level8 除外)', () => {
    setHuman('self'); // pending pick を覗いて候補集合を decoy 検証
    let s = a1Base('DEC_B01062_REDPARTNER');
    // 相手現場に level7 (候補) + level8 (decoy)。side:'either' なので両陣営を走査するが
    // 自陣には B01062(L8)/攻撃キャラ(L5) が居る → 候補に L5攻撃キャラ・L7 は入り、L8 群は除外される。
    s.players.opp.scene = [
      sceneChar(LV7, 'lv7#1', { state: 'sleep' }),
      sceneChar(LV8, 'lv8#1', { state: 'sleep' }),
    ];

    s = produce(s, (d) => {
      declare(d, 'atk#1', { kind: 'case', player: 'opp' });
      runAllUntilEmpty(d);
    });

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sceneRemove pick が surface (= a1 発火)').toBe('sceneRemove');
    expect(pending?.nMin, '「1枚まで」=0枚可 (decline channel)').toBe(0);
    const candCardIds = pending!.candidates.map((c) => c.cardId).sort();
    // DECOY 主張: level8 (LV8 / B01062自身) は候補に入らない。level7以下のみ。
    expect(candCardIds, 'level8 decoy (LV8) は候補外').not.toContain(LV8);
    expect(candCardIds, 'level8 の B01062 自身も候補外').not.toContain('B01062');
    expect(candCardIds, 'level7 (LV7) は候補').toContain(LV7);
    expect(candCardIds, 'level5 攻撃キャラ (ATTACKER) も level7以下 → 候補').toContain(ATTACKER);
  });

  it('a1: pick で level7 (LV7) を選択 → リムーブされる / level8 decoy は盤面に残る', () => {
    setHuman('self');
    let s = a1Base('DEC_B01062_REDPARTNER');
    s.players.opp.scene = [
      sceneChar(LV7, 'lv7#1', { state: 'sleep' }),
      sceneChar(LV8, 'lv8#1', { state: 'sleep' }),
    ];

    s = produce(s, (d) => {
      declare(d, 'atk#1', { kind: 'case', player: 'opp' });
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const lv7Cand = pending.candidates.find((c) => c.cardId === LV7)!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, lv7Cand.uid);
    });

    expect(s.players.opp.scene.some((c) => c.cardId === LV7), 'level7 (LV7) はリムーブされた').toBe(false);
    expect(s.players.opp.remove.includes(LV7), 'LV7 は相手リムーブエリアへ').toBe(true);
    expect(s.players.opp.scene.some((c) => c.cardId === LV8), 'level8 decoy (LV8) は盤面に残る').toBe(true);
  });

  // ===== a1-B: 【パートナー赤】未達 — 青 partner では a1 そのものが発火しない =====
  it('a1 NEGATIVE (partnerColor): 青パートナーでは action[事件] でも sceneRemove pick が立たない', () => {
    setHuman('self');
    let s = a1Base('DEC_B01062_BLUEPARTNER'); // 青 partner → 【パートナー赤】不成立
    s.players.opp.scene = [sceneChar(LV7, 'lv7#1', { state: 'sleep' })];

    s = produce(s, (d) => {
      declare(d, 'atk#1', { kind: 'case', player: 'opp' });
      runAllUntilEmpty(d);
    });
    expect(pickQueue().length, '青パートナー → a1 非発火 (partnerColor gate)').toBe(0);
    expect(s.players.opp.scene.some((c) => c.cardId === LV7), 'LV7 は残る (リムーブされない)').toBe(true);
  });

  // ===== a1-C: triggerActionKind — action[キャラ] では発火しない =====
  it('a1 NEGATIVE (action種別): action[キャラ] では sceneRemove pick が立たない (triggerActionKind:case)', () => {
    setHuman('self');
    let s = a1Base('DEC_B01062_REDPARTNER');
    // 相手 sleep キャラを action[キャラ] の対象にする (level7 = 候補相当だが action種別違いで非発火)
    s.players.opp.scene = [sceneChar(LV7, 'lv7#1', { state: 'sleep' })];

    s = produce(s, (d) => {
      declare(d, 'atk#1', { kind: 'char', uid: 'lv7#1' });
      runAllUntilEmpty(d);
    });
    expect(pickQueue().length, 'action[キャラ] → a1 非発火 (triggerActionKind:case のみ)').toBe(0);
  });

  // ===== a1-D: triggerCharMatches{side:'self'} — 相手の action[事件] では発火しない =====
  it('a1 NEGATIVE (side:self): 相手キャラの action[事件] では自分の B01062 a1 は発火しない', () => {
    setHuman('opp'); // 相手が行動するので相手側 human で pick を覗く
    _resetUidCounter();
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.partner = { cardId: 'DEC_B01062_REDPARTNER', state: 'active', location: 'partner-area' };
    s.players.self.case = { cardId: '', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
    s.players.opp.case = { cardId: '', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
    // B01062 は自分側に on-scene。相手側に攻撃キャラ。
    s.players.self.scene = [sceneChar('B01062', 'akai#1', { state: 'active' })];
    s.players.opp.scene = [sceneChar(ATTACKER, 'oatk#1', { state: 'active' })];
    // 自分 case に証拠1 → 相手は self の事件を action[事件] 可能
    s.players.self.evidence = [{ cardId: 'ev', faceUp: false, origin: { turn: 1, via: 'action-case' } }];
    s.players.self.deck = ['d1', 'd2'];
    s.players.opp.deck = ['e1', 'e2'];

    s = produce(s, (d) => {
      declare(d, 'oatk#1', { kind: 'case', player: 'self' });
      runAllUntilEmpty(d);
    });
    // 相手 (opp) キャラの action なので triggerCharMatches{side:'self'} (= B01062 所有者 self の現場) は不成立。
    expect(pickQueue().length, '相手の action[事件] → 自分の a1 非発火 (side:self gate)').toBe(0);
  });

  // ===== a1-N: 「1枚まで」(rules/15) human decline (0-pick) + 【ターン1】 は発火カウント (rules/24) =====
  it('a1 NEGATIVE (0-pick + ターン1): decline で誰もリムーブされない / 同ターン2回目の action[事件] では再 surface しない', () => {
    setHuman('self');
    let s = a1Base('DEC_B01062_REDPARTNER');
    s.players.opp.scene = [sceneChar(LV7, 'lv7#1', { state: 'sleep' })];

    // 1回目 action[事件] → pick surface → decline (0枚)
    s = produce(s, (d) => {
      declare(d, 'atk#1', { kind: 'case', player: 'opp' });
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    expect(pending.atomVerb, '1回目: sceneRemove pick surface').toBe('sceneRemove');
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending); // 0-pick (「1枚まで」=0枚可)
    });
    expect(s.players.opp.scene.some((c) => c.cardId === LV7), 'decline: LV7 はリムーブされない').toBe(true);

    // 2回目 action[事件] (攻撃キャラを再 active にして再宣言)。
    // 【ターン1】は 1回目の発火でカウント済み (rules/24: 解決内容が 0枚でも発火扱い) → 再 surface しない。
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      // 攻撃キャラは declare でスリープ済 → 再 active 化して 2回目を宣言
      const atk = d.players.self.scene.find((c) => c.uid === 'atk#1')!;
      atk.state = 'active';
      declare(d, 'atk#1', { kind: 'case', player: 'opp' });
      runAllUntilEmpty(d);
    });
    expect(pickQueue().length, '【ターン1】: 2回目の action[事件] では a1 再発火しない').toBe(0);
  });

  // ===== a2-A + DECOY: 【宣言】AP+1000 — 赤キャラのみ候補、青 decoy 除外 =====
  it('a2 + DECOY: 宣言能力で charModifyAP pick が surface — 候補は赤キャラのみ (青 decoy 除外)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [
      sceneChar('B01062', 'akai#1', { state: 'active' }),
      sceneChar(A2RED, 'red#1', { state: 'active' }),   // 赤 → 候補
      sceneChar(A2BLUE, 'blue#1', { state: 'active' }), // 青 → DECOY (候補外)
    ];

    expect(canDeclaredAbility(s, 'akai#1', 'a2'), 'a2 使用可').toBe(true);
    s = produce(s, (d) => {
      const ctx: EffectCtx = { source: { cardId: 'B01062', uid: 'akai#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} };
      useDeclaredAbility(d, 'akai#1', 'a2', ctx);
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'charModifyAP pick が surface').toBe('charModifyAP');
    expect(pending?.nMin, '「1枚まで」=0枚可').toBe(0);
    const candCardIds = pending!.candidates.map((c) => c.cardId).sort();
    // DECOY 主張: 青キャラは候補に入らない。赤キャラ (B01062自身=赤 + A2RED) のみ。
    expect(candCardIds, '青 decoy (A2BLUE) は候補外').not.toContain(A2BLUE);
    expect(candCardIds, '赤 A2RED は候補').toContain(A2RED);
    expect(candCardIds, '赤 B01062 自身も候補 (色フィルタ該当)').toContain('B01062');
  });

  it('a2: 赤キャラ (A2RED) を選択 → ターン終了時まで AP+1000 (3000→4000)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [
      sceneChar('B01062', 'akai#1', { state: 'active' }),
      sceneChar(A2RED, 'red#1', { state: 'active' }),
      sceneChar(A2BLUE, 'blue#1', { state: 'active' }),
    ];
    expect(read.char.ap(s, 'red#1'), 'A2RED 初期 AP3000').toBe(3000);

    s = produce(s, (d) => {
      const ctx: EffectCtx = { source: { cardId: 'B01062', uid: 'akai#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} };
      useDeclaredAbility(d, 'akai#1', 'a2', ctx);
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const redCand = pending.candidates.find((c) => c.cardId === A2RED)!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, redCand.uid);
    });
    expect(read.char.ap(s, 'red#1'), 'AP+1000 適用 (3000→4000)').toBe(4000);
    // DECOY: 青キャラは AP 不変
    expect(read.char.ap(s, 'blue#1'), '青 decoy は AP 不変 (3000)').toBe(3000);
  });

  // ===== a2-N: 【ターン1】 — 1回使用後 canDeclaredAbility=false =====
  it('a2 NEGATIVE (ターン1): 1回使用後は canDeclaredAbility が false (再使用不可)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [
      sceneChar('B01062', 'akai#1', { state: 'active' }),
      sceneChar(A2RED, 'red#1', { state: 'active' }),
    ];
    expect(canDeclaredAbility(s, 'akai#1', 'a2'), '使用前: 可').toBe(true);
    s = produce(s, (d) => {
      const ctx: EffectCtx = { source: { cardId: 'B01062', uid: 'akai#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} };
      useDeclaredAbility(d, 'akai#1', 'a2', ctx);
      runAllUntilEmpty(d);
    });
    expect(canDeclaredAbility(s, 'akai#1', 'a2'), '1回使用後: 【ターン1】で再使用不可').toBe(false);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=triggered action:declare(case+self) sceneRemove{levelMax:7}, a2=declared charModifyAP{color:赤,scope:turn}', () => {
    const [a1, a2] = B01062.abilities;
    expect(a1.type).toBe('triggered');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '赤' });
    expect(a1.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a1.trigger).toMatchObject({
      hook: 'action:declare',
      matcherCondition: { kind: 'and', cs: [{ kind: 'triggerActionKind', v: 'case' }, { kind: 'triggerCharMatches', side: 'self', filter: {} }] },
    });
    expect((a1.effect as { verb: string; args: Record<string, unknown> }).verb).toBe('sceneRemove');
    expect((a1.effect as { args: { filter: unknown; max: number } }).args).toMatchObject({ max: 1, side: 'either', cause: 'effect', filter: { levelMax: 7 } });
    expect(a2.type).toBe('declared');
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect((a2.effect as { verb: string; args: Record<string, unknown> }).verb).toBe('charModifyAP');
    expect((a2.effect as { args: Record<string, unknown> }).args).toMatchObject({ delta: 1000, max: 1, side: 'either', filter: { color: '赤' }, scope: 'turn' });
  });
});
