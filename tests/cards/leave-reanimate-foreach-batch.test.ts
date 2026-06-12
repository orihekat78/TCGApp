// Task A batch#2 wave2 — leave→hand / reanimate / forEach-all クラスタ (engine変更0)
//
// 検証対象 (9 枚): B05034/B07042/B09015 (【相手ターン中】【現場リムーブ時】→ handAddFromRemove),
//   B04007/B03099 (リムーブから sceneEnter enterSleep), B03012/PR155/PR161 (手札から sceneEnter ± enterSleep+draw),
//   PR230 (【パートナー黒】forEach over:all 全キャラスリープ + leave 版 + ヒラメキ sleep-pick)。
//
// すべて settled パターンの再録: handAddFromRemove (B02004 a2), sceneEnter from:remove (B02004 a1/D08024),
//   sceneEnter from:hand (B05112), enterSleep (D01012), forEach over:all→sceneSetState{$each.uid} (B06071,
//   primitive は tests/engine/effect/foreach-all.test.ts 検証済), hirameki sleep-pick (D03013 a2)。
// スタン状態のキャラへの sleep は mutate.scene.setState が rules/03 を enforce (stun のまま)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import type { AbilityDef, GameState, SceneCharacter } from '@/engine/types';
import { B05034 } from '@/cards/ct-p05/B05034';
import { B07042 } from '@/cards/ct-p07/B07042';
import { B09015 } from '@/cards/ct-p09/B09015';
import { B04007 } from '@/cards/ct-p04/B04007';
import { B03099 } from '@/cards/ct-p03/B03099';
import { B03012 } from '@/cards/ct-p03/B03012';
import { PR155 } from '@/cards/pr-01/PR155';
import { PR161 } from '@/cards/pr-01/PR161';
import { PR230 } from '@/cards/pr-01/PR230';
import { sceneChar as baseScene } from '../helpers/fixtures';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

function sceneChar(cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return baseScene(cardId, uid, { state });
}

describe('Task A wave2 — leave→hand / reanimate / forEach-all cluster', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ---------- 実 flow 1: 【相手ターン中】【現場リムーブ時】 リムーブの【緑】イベントを手札 (B05034) ----------
  it('B05034: 相手ターン中の現場リムーブで リムーブの【緑】イベント(D02015)を手札、緑キャラ(decoy)は対象外', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false }; // 【相手ターン中】
    s.players.self.scene = [sceneChar('B05034', 'kunisue#1')];
    // remove: D02015 (緑イベント=該当) / D02002 (緑キャラ=kind:event filter で対象外)
    s.players.self.remove = ['D02015', 'D02002'];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'kunisue#1', 'effect'); // 現場リムーブ → leave:to-remove
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand, '【緑】イベント D02015 を手札に加える').toContain('D02015');
    expect(s.players.self.remove, 'D02015 はリムーブから抜けた').not.toContain('D02015');
    expect(s.players.self.remove, '緑キャラ D02002 は対象外 (kind:event filter)').toContain('D02002');
  });

  it('B05034: 自分ターンでは発火しない (【相手ターン中】gate)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B05034', 'kunisue#1')];
    s.players.self.remove = ['D02015'];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'kunisue#1', 'effect');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand, '自分ターンでは手札に加えない').not.toContain('D02015');
    expect(s.players.self.remove, 'D02015 はリムーブに残る').toContain('D02015');
  });

  // ---------- 実 flow 2: reanimate — リムーブから enterSleep 登場 (B04007) ----------
  it('B04007: 相手ターン中の現場リムーブで リムーブの[白鳥任三郎](D05011)がスリープ状態で登場、名前違い(D01004)は対象外', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B04007', 'kobayashi#1')];
    // remove: D05011 (白鳥任三郎 Lv3 ≤6 = 該当) / D01004 (工藤新一 Lv8 = cardName 不一致)
    s.players.self.remove = ['D05011', 'D01004'];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'kobayashi#1', 'effect');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    const entered = s.players.self.scene.find((c) => c.cardId === 'D05011');
    expect(entered, '白鳥任三郎 D05011 が現場に登場').toBeTruthy();
    expect(entered?.state, 'スリープ状態で登場 (enterSleep)').toBe('sleep');
    expect(s.players.self.remove, 'D05011 はリムーブから抜けた').not.toContain('D05011');
    expect(s.players.self.scene.find((c) => c.cardId === 'D01004'), '名前違い D01004 は登場しない').toBeFalsy();
    expect(s.players.self.remove, 'D01004 はリムーブに残る').toContain('D01004');
  });

  it('B04007: リムーブに該当 0 枚なら no-op (例外なし)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B04007', 'kobayashi#1')];
    s.players.self.remove = ['D01004']; // 白鳥任三郎なし

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'kobayashi#1', 'effect');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(s.players.self.scene.find((c) => c.cardId === 'D01004'), '誰も登場しない').toBeFalsy();
  });

  // ---------- 実 flow 3: from:hand 登場 + draw (PR155) ----------
  it('PR155: 通常プレイ登場で 手札の[灰原哀]Lv4(D01013)がスリープ状態で登場し、カードを1枚引く', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 7, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['PR155', 'D01013'];
    s.players.self.case.colors = ['青']; // PR155=青 (色制限 rules/20)
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level7
    s.players.self.deck = ['B04006', FB.cardId]; // draw 対象

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR155');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    const hai = s.players.self.scene.find((c) => c.cardId === 'D01013');
    expect(hai, '手札の灰原哀 D01013 が現場に登場').toBeTruthy();
    expect(hai?.state, 'スリープ状態で登場 (enterSleep)').toBe('sleep');
    expect(s.players.self.hand, 'D01013 は手札から消費').not.toContain('D01013');
    expect(s.players.self.hand, 'デッキ上 B04006 を 1 ドロー').toContain('B04006');
  });

  // ---------- 実 flow 4: forEach over:all 全キャラスリープ (PR230) ----------
  it('PR230: 【パートナー黒】登場時、両現場のすべてのキャラをスリープ (スタンはスタンのまま rules/03)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 8, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner.cardId = 'D07001'; // シェリー (黒) → 【パートナー黒】成立
    s.players.self.hand = ['PR230'];
    s.players.self.case.colors = ['黒'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level7
    s.players.self.scene = [sceneChar('B04006', 'shinichi#1', 'active')];
    s.players.opp.scene = [sceneChar('D05011', 'shiratori#1', 'active'), sceneChar('D01004', 'yusaku#1', 'stun')];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR230');
      runAllUntilEmpty(d);
    });

    const gin = s.players.self.scene.find((c) => c.cardId === 'PR230');
    expect(gin, 'PR230 が現場に登場').toBeTruthy();
    expect(gin?.state, '自身も「すべてのキャラ」に含まれスリープ').toBe('sleep');
    expect(s.players.self.scene.find((c) => c.uid === 'shinichi#1')?.state, '自現場キャラ sleep').toBe('sleep');
    expect(s.players.opp.scene.find((c) => c.uid === 'shiratori#1')?.state, '相手現場キャラ sleep').toBe('sleep');
    expect(s.players.opp.scene.find((c) => c.uid === 'yusaku#1')?.state, 'スタンはスタンのまま (rules/03)').toBe('stun');
  });

  it('PR230: パートナーが黒以外なら【登場時】効果は発火しない', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 8, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner.cardId = 'D01001'; // 江戸川コナン (青) → gate 不成立
    s.players.self.hand = ['PR230'];
    s.players.self.case.colors = ['黒'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB];
    s.players.opp.scene = [sceneChar('D05011', 'shiratori#1', 'active')];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR230');
      runAllUntilEmpty(d);
    });

    expect(s.players.opp.scene.find((c) => c.uid === 'shiratori#1')?.state, '相手キャラは active のまま').toBe('active');
  });

  // ---------- descriptor 構造 (9 枚) ----------
  it('leave→hand: hook/condition/filter が text と一致 (B05034/B07042/B09015)', () => {
    for (const c of [B05034, B07042, B09015]) {
      const a1 = c.abilities[0] as AbilityDef;
      expect(a1.trigger, `${c.id}: leave hook`).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
      expect(a1.condition, `${c.id}: 相手ターン中`).toEqual({ kind: 'turn', player: 'opp' });
    }
    expect((B05034.abilities[0] as AbilityDef).effect).toMatchObject({
      kind: 'atom', verb: 'handAddFromRemove', args: { max: 1, filter: { color: '緑', kind: 'event' } },
    });
    // B05034 a2 = 【ヒラメキ】同効果
    expect((B05034.abilities[1] as AbilityDef).trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect((B05034.abilities[1] as AbilityDef).effect).toMatchObject({ kind: 'atom', verb: 'handAddFromRemove' });
    expect((B07042.abilities[0] as AbilityDef).effect).toMatchObject({
      kind: 'atom', verb: 'handAddFromRemove', args: { filter: { cardName: '白馬探' } },
    });
    // B09015 = filterAny OR (カード名[円谷光彦] か レベル4 特徴[少年探偵団])
    const b9 = (B09015.abilities[0] as AbilityDef).effect as { args: { filterAny: unknown[] } };
    expect(b9.args.filterAny).toEqual([
      { cardName: '円谷光彦', kind: 'character' },
      { trait: '少年探偵団', levelMin: 4, levelMax: 4, kind: 'character' },
    ]);
  });

  it('reanimate: from/enterSleep/filter が text と一致 (B04007/B03099/B03012/PR155/PR161)', () => {
    expect((B04007.abilities[0] as AbilityDef).effect).toMatchObject({
      kind: 'atom', verb: 'sceneEnter',
      args: { from: 'remove', max: 1, enterSleep: true, filter: { cardName: '白鳥任三郎', levelMax: 6 } },
    });
    // B03099 = 【ターン1】このキャラがアクションしたとき (action:declare selfOnly)
    const y = B03099.abilities[0] as AbilityDef;
    expect(y.limit).toEqual({ kind: 'turn', n: 1 });
    expect(y.trigger).toMatchObject({ hook: 'action:declare', selfOnly: true });
    expect(y.effect).toMatchObject({
      kind: 'atom', verb: 'sceneEnter',
      args: { from: 'remove', enterSleep: true, filter: { trait: '長野県警', levelMax: 6 } },
    });
    // B03012 = 手札から (enterSleep なし)
    const s12 = (B03012.abilities[0] as AbilityDef).effect as { args: Record<string, unknown> };
    expect(s12.args).toMatchObject({ from: 'hand', max: 1, filter: { cardName: '工藤新一', levelMax: 6 } });
    expect(s12.args.enterSleep, 'B03012 はスリープ登場ではない').toBeUndefined();
    // PR155/PR161 = sequence[from:hand enterSleep, draw1] + ヒラメキ handAddFromRemove
    for (const c of [PR155, PR161]) {
      const steps = ((c.abilities[0] as AbilityDef).effect as { steps: Array<{ verb: string; args: Record<string, unknown> }> }).steps;
      expect(steps.map((x) => x.verb), `${c.id}: enter→draw sequence`).toEqual(['sceneEnter', 'draw']);
      expect(steps[0].args).toMatchObject({ from: 'hand', enterSleep: true, filter: { cardName: '灰原哀', levelMax: 6 } });
      const a2 = c.abilities[1] as AbilityDef;
      expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
      expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'handAddFromRemove', args: { filter: { cardName: '灰原哀' } } });
    }
  });

  it('PR230: a1 partnerColor黒+enter / a2 turn:opp+leave / 両方 forEach over:all → sleep, a3 ヒラメキ sleep-pick', () => {
    const [a1, a2, a3] = PR230.abilities as AbilityDef[];
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '黒' });
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a2.condition).toEqual({ kind: 'turn', player: 'opp' });
    expect(a2.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    for (const a of [a1, a2]) {
      expect(a.effect).toMatchObject({
        kind: 'forEach',
        over: { kind: 'all', query: { area: 'scene', side: 'either' } },
        do: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$each.uid', state: 'sleep' } },
      });
    }
    expect(a3.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a3.effect).toMatchObject({
      kind: 'atom', verb: 'sceneSetState',
      args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', n: { min: 0, max: 1 } } },
    });
  });
});
