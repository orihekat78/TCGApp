// engine-extension disguise-hook batch (2026-06-06 タスクC) — 実カード経由 sanity test
//
// 検証:
//   1. canDisguise が変装ゲート条件 (icon-disguise ability の condition) を評価する
//      - D06012: 【事件白】&【FILE5】 / B03129: 【FILE6】 / B02045: 【事件白】&【FILE4】
//   2. flow.contact.disguise が emit する disguise:into で、変装したキャラの triggered ability
//      (trigger.hook='disguise:into', selfOnly) が発火し effect が解決されること
//      - B03129: 【変装時】カードを1枚引く
//      - B02045: 【変装時】キャラを1枚まで選び ターン終了時まで AP-2000 (AI auto-pick = 相手 debuff)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { canDisguise, disguise } from '@/engine/flow/contact';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { char as readChar } from '@/engine/read/char';
import { D06012 } from '@/cards/ct-d06/D06012';
import { B03129 } from '@/cards/ct-p03/B03129';
import { B02045 } from '@/cards/ct-p02/B02045';
import type { GameState, ActionContext, SceneCharacter } from '@/engine/types';

function sceneChar(cardId: string, uid: string): SceneCharacter {
  return {
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

const FB = { type: 'card-back' as const, cardId: 'D08017' };

/** self 側 attacker (uid='atk') が opp char (uid='dft') に action → contact 中の ax を構築 */
function makeAx(): ActionContext {
  return {
    id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: 'atk', aAP: 4000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
  };
}

describe('engine-extension disguise-hook batch (2026-06-06)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    _clearPendingEffectPickQueue();
    registerAll();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null; // CPU vs CPU
  });

  it('card defs: icon-disguise + condition / disguise:into trigger', () => {
    expect(D06012.abilities[0]).toMatchObject({ type: 'icon-disguise' });
    expect(D06012.abilities[0].condition).toBeDefined();
    expect(B03129.abilities[1].trigger).toMatchObject({ hook: 'disguise:into', selfOnly: true });
    expect(B02045.abilities[1].trigger).toMatchObject({ hook: 'disguise:into', selfOnly: true });
  });

  it('D06012: 変装ゲート 【事件白】&【FILE5】 — 条件達/未達で canDisguise が切替わる', () => {
    const base = createEmptyGameState();
    base.players.self.scene = [sceneChar('Atk0', 'atk')];
    base.players.opp.scene = [sceneChar('Def0', 'dft')];
    base.players.self.hand = ['D06012'];
    const ax = makeAx();

    // 事件白 + FILE5 → 可
    const ok = produce(base, (d) => {
      d.players.self.case.colors = ['白'];
      d.players.self.file = [FB, FB, FB, FB, FB];
    });
    expect(canDisguise(ok, ax, 'self', 'D06012'), '事件白+FILE5 → 変装可').toBe(true);

    // 事件赤 (白でない) → 不可
    const wrongColor = produce(ok, (d) => { d.players.self.case.colors = ['赤']; });
    expect(canDisguise(wrongColor, ax, 'self', 'D06012'), '事件白でない → 不可').toBe(false);

    // FILE4 (5未満) → 不可
    const lowFile = produce(ok, (d) => { d.players.self.file = [FB, FB, FB, FB]; });
    expect(canDisguise(lowFile, ax, 'self', 'D06012'), 'FILE4 → 不可').toBe(false);
  });

  it('B03129: 【変装時】カードを1枚引く (disguise:into → draw)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('Atk0', 'atk')];
    s.players.opp.scene = [sceneChar('Def0', 'dft')];
    s.players.self.hand = ['B03129'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB]; // FILE6 で変装可
    s.players.self.deck = ['D08013']; // 変装時に引く 1 枚 (disguise が atk の元 cardId を deck 末尾へ push する前の先頭)
    expect(canDisguise(s, makeAx(), 'self', 'B03129'), 'FILE6 → 変装可').toBe(true);
    s = produce(s, (d) => {
      disguise(d, makeAx(), 'self', 'B03129');
      runAllUntilEmpty(d);
    });
    // uid 維持で cardId が B03129 に
    expect(s.players.self.scene.find((c) => c.uid === 'atk')?.cardId, '変装で cardId 差替え').toBe('B03129');
    // 変装時 draw で D08013 が手札に
    expect(s.players.self.hand, '【変装時】1ドローで D08013 が手札に').toContain('D08013');
    expect(s.players.self.hand, '変装に使った B03129 は手札から消費済').not.toContain('B03129');
  });

  it('B02045: 【変装時】キャラを1枚まで選び ターン終了時まで AP-2000 (AI=相手 debuff)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('Atk0', 'atk')];
    // 相手 debuff 対象: D08006 (AP 既知のキャラ)
    s.players.opp.scene = [sceneChar('D08006', 'dft')];
    s.players.self.hand = ['B02045'];
    s.players.self.case.colors = ['白'];
    s.players.self.file = [FB, FB, FB, FB]; // FILE4 + 事件白 で変装可
    const apBefore = readChar.ap(s, 'dft');
    expect(canDisguise(s, makeAx(), 'self', 'B02045'), '事件白+FILE4 → 変装可').toBe(true);
    // 変装時の charModifyAP 短縮形 (PA pick) は CPU 経路で drainAiEffectPicks が heuristic 解決する
    // (BUG-109 と同型。AI は debuff 対象として相手の高 AP キャラを選ぶ)。
    const policy = new HeuristicPolicy();
    s = produce(s, (d) => {
      disguise(d, makeAx(), 'self', 'B02045');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, policy);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'atk')?.cardId, '変装で cardId 差替え').toBe('B02045');
    expect(readChar.ap(s, 'dft'), '【変装時】相手キャラ AP-2000').toBe(apBefore - 2000);
  });
});
