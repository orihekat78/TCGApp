// cluster8 — ヒラメキ抑止窓 (B06049 a2) を実 engine 経路で駆動する挙動テスト
// (engine拡張 wave#2 cluster8, 2026-06-15)。B06049 は非 MVP のため smoke:1000 では踏めない
// (BUG-132 教訓: smoke green は no-op 回帰のみ保証 / 新挙動は専用テストで実証)。
//
// 検証 (公式テキスト + qAndA と 1対1):
//   a2「このキャラがアクション[事件]したとき、アクション終了時まで相手の【ヒラメキ】は発動しない」:
//     - setHiramekiSuppress verb が turnState[相手].hiramekiSuppressed=true をセット (verb 単体)
//     - handleEvidenceRemovedHook が flag 中は hirameki を push しない / flag 無しは push する (抑止の核)
//     - B06049 が action[事件] 宣言 → 相手 flag set (trigger 配線)。action[char] / 非このキャラ では set されない
//       (matcherCondition triggerActionKind case + selfOnly)
//     - flag は action-end (state-machine contact-end→action-end) で清掃される (action-scoped)
// rules: 10 (アクション[事件]/ヒラメキ) / 13 (突撃) / 22 (アクション宣言時に発動) / 17

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { run as runEffect } from '@/engine/effect/resolver';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { advance, declare, passGuard } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState, EffectCtx, ActionContext } from '@/engine/types';

// 任意発動の【ヒラメキ】を持つ synthetic 証拠カード (発火源)
function hiramekiCard(id: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: [], level: 1, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
    abilities: [{
      id: 'h', type: 'triggered', scope: 'on-evidence',
      trigger: { hook: 'evidence:remove-by-action', optional: true },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    }],
  } as unknown as CardDef;
}

function selfMain(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

describe('cluster8 — hirameki suppression (B06049 a2 / setHiramekiSuppress)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    _resetPendingHirameki();
    registerAll();
    registerCardDef(hiramekiCard('HIRAM'));
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ---- 抑止の核: handleEvidenceRemovedHook が flag を尊重する ----
  it('evidence:remove-by-action: flag 中は hirameki を push しない / flag 無しは push する', () => {
    // 制御 (flag 無し): hirameki が push される
    const sOff = createEmptyGameState();
    selfMain(sOff);
    produce(sOff, draft => {
      event.emit(draft, 'evidence:remove-by-action', { player: 'opp', ev: { cardId: 'HIRAM' } }, { player: 'self', uid: 'atk' });
    });
    expect(_drainPendingHirameki(), 'flag 無し → ヒラメキ発火 (pending set)').not.toBeNull();

    // 抑止 (flag 有り): hirameki が push されない
    _resetPendingHirameki();
    const sOn = createEmptyGameState();
    selfMain(sOn);
    sOn.turnState.opp.hiramekiSuppressed = true; // 証拠を失う側 (opp) を抑止
    produce(sOn, draft => {
      event.emit(draft, 'evidence:remove-by-action', { player: 'opp', ev: { cardId: 'HIRAM' } }, { player: 'self', uid: 'atk' });
    });
    expect(_drainPendingHirameki(), 'flag 有り → ヒラメキ抑止 (pending null)').toBeNull();

    // 相手側 (self) の flag は opp の hirameki を抑止しない (per-player)
    _resetPendingHirameki();
    const sCross = createEmptyGameState();
    selfMain(sCross);
    sCross.turnState.self.hiramekiSuppressed = true; // 別 slot
    produce(sCross, draft => {
      event.emit(draft, 'evidence:remove-by-action', { player: 'opp', ev: { cardId: 'HIRAM' } }, { player: 'self', uid: 'atk' });
    });
    expect(_drainPendingHirameki(), 'self flag は opp hirameki に無関係').not.toBeNull();
  });

  // ---- verb: setHiramekiSuppress{player:'opp'} が相手 slot をセット ----
  it('setHiramekiSuppress{player:opp}: 所有者(self)から見た相手(opp) の flag をセット', () => {
    const s = createEmptyGameState();
    selfMain(s);
    const ctx = { source: { player: 'self', cardId: 'B06049', uid: 'src', abilityId: 'a2', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
    const out = produce(s, draft => {
      runEffect(draft, { kind: 'atom', verb: 'setHiramekiSuppress', args: { player: 'opp' } } as never, ctx);
    });
    expect(out.turnState.opp.hiramekiSuppressed).toBe(true);
    expect(out.turnState.self.hiramekiSuppressed ?? false).toBe(false);
  });

  // ---- trigger 配線: B06049 が action[事件] 宣言 → opp flag set ----
  it('B06049 action[事件] 宣言で opp.hiramekiSuppressed set / action[char]・非このキャラ では set されない', () => {
    const base = createEmptyGameState();
    selfMain(base);
    let uid = '';
    const s = produce(base, draft => {
      uid = mutate.scene.enter(draft, 'self', 'B06049', { active: true }).uid;
    });
    // a1 (enter) を drain (YAIBA 不在で no-op)
    const s1 = produce(s, draft => { engine.resolve.runAllUntilEmpty(draft); });

    // action[事件] 宣言を emit (state-machine declare と同 payload)
    const sCase = produce(s1, draft => {
      event.emit(draft, 'action:declare',
        { byUid: uid, target: { kind: 'case', player: 'opp' }, uid, player: 'self', targetUid: undefined },
        { player: 'self', uid });
      engine.resolve.runAllUntilEmpty(draft);
    });
    expect(sCase.turnState.opp.hiramekiSuppressed, 'action[事件] → opp 抑止 set').toBe(true);

    // 制御: action[char] (target.kind:'char') → matcherCondition case が false → set されない
    const sChar = produce(s1, draft => {
      event.emit(draft, 'action:declare',
        { byUid: uid, target: { kind: 'char', uid: 'dummy' }, uid, player: 'self', targetUid: 'dummy' },
        { player: 'self', uid });
      engine.resolve.runAllUntilEmpty(draft);
    });
    expect(sChar.turnState.opp.hiramekiSuppressed ?? false, 'action[char] → 抑止しない').toBe(false);

    // 制御: 非このキャラ (別 actor uid) → selfOnly が false → set されない
    const sOther = produce(s1, draft => {
      event.emit(draft, 'action:declare',
        { byUid: 'OTHER', target: { kind: 'case', player: 'opp' }, uid: 'OTHER', player: 'self', targetUid: undefined },
        { player: 'self', uid: 'OTHER' });
      engine.resolve.runAllUntilEmpty(draft);
    });
    expect(sOther.turnState.opp.hiramekiSuppressed ?? false, '非このキャラの action → 抑止しない').toBe(false);
  });

  // ---- action-scope: flag は action-end で清掃される ----
  it('hiramekiSuppressed は contact-end→action-end 遷移で両プレイヤー分クリアされる', () => {
    const base = createEmptyGameState();
    selfMain(base);
    base.turnState.opp.hiramekiSuppressed = true;
    base.turnState.self.hiramekiSuppressed = true;
    const ax: ActionContext = {
      id: 'ax-c8', byUid: 'a', byPlayer: 'self', target: { kind: 'case', player: 'opp' },
      phase: 'contact-end', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    } as unknown as ActionContext;
    const out = produce(base, draft => {
      advance(draft, ax); // contact-end → action-end (清掃)
    });
    expect(out.turnState.opp.hiramekiSuppressed).toBe(false);
    expect(out.turnState.self.hiramekiSuppressed).toBe(false);
  });

  it('clears B06049 suppression when B01062 removes the acting B06049 before guard', () => {
    registerCardDef({
      id: 'RED-PARTNER', no: '9/RED-PARTNER', kind: 'partner', names: ['RED-PARTNER'],
      colors: ['赤'], level: 0, ap: 0, lp: 1, traits: [], keywords: [], rarity: 'C',
      imageUrl: '', ruleRefs: [], abilities: [],
    } as unknown as CardDef);

    const base = createEmptyGameState();
    selfMain(base);
    base.players.self.partner = { cardId: 'RED-PARTNER', state: 'active', location: 'partner-area' };
    base.players.opp.evidence = [{ cardId: 'HIRAM', faceUp: false, origin: { turn: 1, via: 'action-case' } }];

    const out = produce(base, draft => {
      mutate.scene.enter(draft, 'self', 'B01062', { active: true });
      const actor = mutate.scene.enter(draft, 'self', 'B06049', { active: true });
      const ax = declare(draft, actor.uid, { kind: 'case', player: 'opp' });
      engine.resolve.runAllUntilEmpty(draft);

      expect(draft.turnState.opp.hiramekiSuppressed).toBe(true);
      expect(draft.players.self.scene.some((card) => card.uid === actor.uid)).toBe(false);
      passGuard(draft, ax);
    });

    expect(out.actionContexts).toEqual({});
    expect(out.turnState.opp.hiramekiSuppressed).toBe(false);
    expect(out.turnState.self.hiramekiSuppressed).toBe(false);

    produce(out, draft => {
      event.emit(
        draft,
        'evidence:remove-by-action',
        { player: 'opp', ev: { cardId: 'HIRAM' } },
        { player: 'self', uid: 'next-actor' },
      );
    });
    expect(_drainPendingHirameki()).not.toBeNull();
  });
});
