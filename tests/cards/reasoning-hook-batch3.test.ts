// engine-extension reasoning-hook batch #3 (2026-06-06 タスクC) — 実カード経由 sanity test
//
// 検証: reasoning:end トリガで multi-target pick (B05039) / 捜査1=deckRevealUntil(opp) 代替 (B03096)
//   が忠実に解決されること。PA 短縮形 pick は runtime に __pendingEffectPickQueue へ積まれ、
//   CPU 経路は drainAiEffectPicks が heuristic 解決する (BUG-109 / disguise-hook batch 同型)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { doReasoning } from '@/engine/flow/main/reasoning';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { char as readChar } from '@/engine/read/char';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B05039 } from '@/cards/ct-p05/B05039';
import { B03096 } from '@/cards/ct-p03/B03096';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';

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

// level / ap を制御する合成キャラ def (filter 検証用 decoy 含む)
function synthChar(id: string, level: number, ap: number): CardDef {
  return {
    id, no: `NO-${id}`, kind: 'character', names: [id], colors: ['青'],
    level, ap, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

describe('engine-extension reasoning-hook batch #3 (2026-06-06)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue = [];
    (globalThis as { __pendingChainContinuation?: unknown[] }).__pendingChainContinuation = [];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ---- B05039: multi-target charModifyAP via reasoning:end (selfOnly) ----

  it('card def: trigger.hook=reasoning:end / selfOnly + 2 段 charModifyAP', () => {
    expect(B05039.abilities[0].trigger).toMatchObject({ hook: 'reasoning:end', selfOnly: true });
  });

  it('B05039: 推理時 Lv5を2枚 + Lv7を1枚に AP+1000 / Lv4・Lv6 decoy は不変', () => {
    const policy = new HeuristicPolicy();
    // 合成 def: Lv5×2 (L5A/L5B), Lv7×1 (L7), decoy Lv4 / Lv6
    registerCardDef(synthChar('L5A', 5, 5000));
    registerCardDef(synthChar('L5B', 5, 5000));
    registerCardDef(synthChar('L7X', 7, 7000));
    registerCardDef(synthChar('L4X', 4, 4000)); // decoy (Lv5/Lv7 いずれにも該当せず)
    registerCardDef(synthChar('L6X', 6, 6000)); // decoy

    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B05039', 'mat#1'),
      sceneChar('L5A', 'l5a'), sceneChar('L5B', 'l5b'),
      sceneChar('L7X', 'l7'),
      sceneChar('L4X', 'l4'), sceneChar('L6X', 'l6'),
    ];
    s.players.self.deck = ['D08005']; // 推理 LP1 で 1 枚消費
    s = produce(s, (d) => {
      doReasoning(d, 'mat#1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, policy);
    });

    expect(readChar.ap(s, 'l5a'), 'Lv5(A) に AP+1000').toBe(6000);
    expect(readChar.ap(s, 'l5b'), 'Lv5(B) に AP+1000 (2枚目も適用 = multi-target)').toBe(6000);
    expect(readChar.ap(s, 'l7'), 'Lv7 に AP+1000').toBe(8000);
    expect(readChar.ap(s, 'l4'), 'Lv4 decoy は不変').toBe(4000);
    expect(readChar.ap(s, 'l6'), 'Lv6 decoy は不変').toBe(6000);
  });

  // ---- B03096: 捜査1 (deckRevealUntil opp) + レベル8発見で自分1ドロー ----

  it('card def: trigger.hook=reasoning:end / triggerCharMatches side:self + limit turn:1', () => {
    expect(B03096.abilities[0].trigger).toMatchObject({
      hook: 'reasoning:end',
      matcherCondition: { kind: 'triggerCharMatches', side: 'self' },
    });
    expect(B03096.abilities[0].limit).toMatchObject({ kind: 'turn', n: 1 });
  });

  it('B03096: 推理時 相手デッキ上=Lv8 → 自分1ドロー + その札は相手デッキ下へ', () => {
    const policy = new HeuristicPolicy();
    registerCardDef(synthChar('L8X', 8, 8000));

    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B03096', 'mgr#1')];
    // self deck: [推理 LP1 で消費する 1 枚, 発見ドローで引く 1 枚]
    s.players.self.deck = ['D08005', 'D08013'];
    // opp deck top = Lv8 (発見 = 条件成立)
    s.players.opp.deck = ['L8X', 'OPPF2', 'OPPF3'];
    s = produce(s, (d) => {
      doReasoning(d, 'mgr#1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, policy);
    });

    expect(s.players.self.hand, 'Lv8発見で自分が1ドロー (D08013)').toContain('D08013');
    expect(s.players.opp.deck[0], '公開した Lv8 は相手デッキ上に残らない').not.toBe('L8X');
    expect(s.players.opp.deck[s.players.opp.deck.length - 1], '公開した Lv8 は相手デッキ下へ').toBe('L8X');
  });

  it('B03096: 推理時 相手デッキ上=Lv7 (<8) → ドローなし / その札は相手デッキ下へ', () => {
    const policy = new HeuristicPolicy();
    registerCardDef(synthChar('L7Y', 7, 7000));

    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B03096', 'mgr#1')];
    s.players.self.deck = ['D08005', 'D08013']; // D08013 は引かれないはず
    s.players.opp.deck = ['L7Y', 'OPPF2', 'OPPF3'];
    s = produce(s, (d) => {
      doReasoning(d, 'mgr#1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, policy);
    });

    expect(s.players.self.hand, 'Lv8未満 → ドローなし (D08013 は手札に来ない)').not.toContain('D08013');
    expect(s.players.opp.deck[0], '公開した Lv7 は相手デッキ上に残らない').not.toBe('L7Y');
    expect(s.players.opp.deck[s.players.opp.deck.length - 1], '公開した Lv7 は相手デッキ下へ (捜査1)').toBe('L7Y');
  });
});
