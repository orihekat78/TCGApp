// engine-extension reasoning-hook batch (2026-06-06 タスクC) — 実カード経由 sanity test
//
// 検証: doReasoning が emit する reasoning:end で、推理したキャラの triggered ability
//   (trigger.hook='reasoning:end', selfOnly) が発火し effect が解決されること。
//   - B01074 羽田秀吉: 推理したとき log (相手手札公開 no-op)
//   - B01017 本堂瑛祐: 推理したとき デッキ上2枚見て [探偵] キャラ1枚を手札 (deck-look-N + reasoning トリガ)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { doReasoning } from '@/engine/flow/main/reasoning';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { char as readChar } from '@/engine/read/char';
import { B01017 } from '@/cards/ct-p01/B01017';
import { B01074 } from '@/cards/ct-p01/B01074';
import { B03102 } from '@/cards/ct-p03/B03102';
import { B05011 } from '@/cards/ct-p05/B05011';
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

describe('engine-extension reasoning-hook batch (2026-06-06)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
  });

  it('card defs: trigger.hook=reasoning:end / selfOnly', () => {
    expect(B01074.abilities[0].trigger).toMatchObject({ hook: 'reasoning:end', selfOnly: true });
    expect(B01017.abilities[0].trigger).toMatchObject({ hook: 'reasoning:end', selfOnly: true });
  });

  it('B01074: このキャラが推理したとき log (reveal-hand) が発火する', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B01074', 'hyd#1')];
    s.players.self.deck = ['D08005']; // LP1 推理用フィラー
    s = produce(s, (d) => {
      doReasoning(d, 'hyd#1');
      runAllUntilEmpty(d);
    });
    const hasRevealLog = s.log.some((e) => e.action === 'reveal-hand' && e.result?.includes('手札を公開'));
    expect(hasRevealLog, '相手手札公開の log が記録される').toBe(true);
    expect(s.players.self.scene.find((c) => c.uid === 'hyd#1')?.state, '推理でスリープ').toBe('sleep');
  });

  it('B01017: このキャラが推理したとき デッキ上2枚から [探偵] キャラ (D08003) を手札に加える (非探偵 D08009 は除外)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B01017', 'hnd#1')];
    // deck top: フィラー(推理 LP1 で消費) → D08003(探偵=正) → D08009(少年探偵団=decoy)
    s.players.self.deck = ['D08005', 'D08003', 'D08009'];
    s = produce(s, (d) => {
      doReasoning(d, 'hnd#1');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand, '[探偵] の D08003 が手札に').toContain('D08003');
    expect(s.players.self.hand, '非[探偵] の D08009 は手札に入らない').not.toContain('D08009');
    expect(s.players.self.deck, 'D08003 はデッキから抜けた').not.toContain('D08003');
    expect(s.players.self.deck, 'D08009 は残り (デッキ下へ)').toContain('D08009');
  });

  // ---- batch #2: 非 selfOnly (triggerCharMatches) ----

  it('B03102: 自分側の[警察]Lv≤4 (D02009) が推理 → このキャラ AP+1000 turn / 非[警察]では不発', () => {
    // 自分側の警察Lv3 (D02009) が推理 → B03102 AP 5000→6000
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B03102', 'ykm#1'), sceneChar('D02009', 'pol#1')];
    s.players.self.deck = ['D08005'];
    s = produce(s, (d) => { doReasoning(d, 'pol#1'); runAllUntilEmpty(d); });
    expect(readChar.ap(s, 'ykm#1'), '自分側[警察]Lv≤4 の推理で AP+1000 (5000→6000)').toBe(6000);

    // 非[警察] (D08009 少年探偵団) が推理 → 不発 (5000 のまま)
    let s2: GameState = createEmptyGameState();
    s2.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s2.players.self.scene = [sceneChar('B03102', 'ykm#1'), sceneChar('D08009', 'boy#1')];
    s2.players.self.deck = ['D08005'];
    s2 = produce(s2, (d) => { doReasoning(d, 'boy#1'); runAllUntilEmpty(d); });
    expect(readChar.ap(s2, 'ykm#1'), '非[警察]の推理では buff 不発').toBe(5000);
  });

  it('B03102: 相手側の[警察]が推理 → 不発 (side:self gate)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B03102', 'ykm#1')];
    s.players.opp.scene = [sceneChar('D02009', 'opol#1')];
    s.players.opp.deck = ['D08005'];
    s = produce(s, (d) => { doReasoning(d, 'opol#1'); runAllUntilEmpty(d); });
    expect(readChar.ap(s, 'ykm#1'), '相手側[警察]の推理では不発 (side:self)').toBe(5000);
  });

  it('B05011: 自分側の[毛利小五郎]が推理 → 1ドロー (限定 ターン1)', () => {
    const kogoro: CardDef = {
      id: 'KOGORO_T', no: 'NO', kind: 'character', names: ['毛利小五郎'], colors: ['青'],
      level: 4, ap: 4000, lp: 1, traits: ['探偵'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    };
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B05011', 'amk#1'), sceneChar('KOGORO_T', 'kog#1')];
    s.players.self.deck = ['D08005', 'D08013']; // 推理 LP1 で 1枚 + ドロー 1枚
    registerCardDef(kogoro); // synthetic [毛利小五郎] def を登録 (beforeEach の registerAll 後)
    s = produce(s, (d) => {
      doReasoning(d, 'kog#1');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand, '[毛利小五郎] の推理で 1 ドロー').toContain('D08013');
  });
});
