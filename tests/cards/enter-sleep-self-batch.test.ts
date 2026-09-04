// Task A batch#2 — A.enter+hirameki クラスタ: 自己「スリープ状態で登場」representative
//
// 検証対象: B01011 江戸川コナン
//   公式テキスト:
//     a1 「このキャラはスリープ状態で登場する。」
//     a2 「【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。」
//
// 自己スリープ登場は CardDef.entersSleep=true。mutate.scene.enter が enter hook より前に
// sleep で生成するため、observer や同時【登場時】能力へ一時 active を公開しない。
// 公式 Q&A: 「能力や効果によって登場する場合でもスリープ状態で登場しますか？ → はい」。
//   'enter' hook は通常プレイ (handUseCard) / ネクストヒント / 効果登場 (sceneEnter) の
//   全経路で emit されるため、selfOnly 'enter' で全登場経路を捕捉できることを確認する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { B01011 } from '@/cards/ct-p01/B01011';
import type { AbilityDef, CardDef } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

describe('Task A batch#2 — B01011 自己スリープ登場 + ヒラメキdraw', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('card def: 青Lv4 AP2000 LP2 / inherent sleep entry / sparse a2 ヒラメキ draw', () => {
    expect(B01011.kind).toBe('character');
    expect(B01011.colors).toEqual(['青']);
    const ch = B01011 as CardDef & { ap: number; lp: number; level: number; traits: string[] };
    expect(ch.level).toBe(4);
    expect(ch.ap).toBe(2000);
    expect(ch.lp).toBe(2);
    expect(ch.traits).toEqual(['探偵', '毛利探偵事務所', '少年探偵団']);

    expect(B01011.entersSleep).toBe(true);
    expect(B01011.abilities.map(ability => ability.id)).toEqual(['a2']);
    const [a2] = B01011.abilities as AbilityDef[];
    // a2: 【ヒラメキ】 1ドロー (D08013 a2 同型)
    expect(a2.type).toBe('triggered');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
  });

  it('通常プレイ (handUseCard) で現場にスリープ状態で登場する', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B01011'];
    s.players.self.case.colors = ['青']; // B01011=青 (色制限 rules/20)
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level4 (handUseCard 可)

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B01011');
      runAllUntilEmpty(d);
    });

    const entered = s.players.self.scene.find((c) => c.cardId === 'B01011');
    expect(entered, 'B01011 が現場に登場').toBeTruthy();
    expect(entered?.state, 'スリープ状態で登場 (active ではなく sleep)').toBe('sleep');
    expect(s.players.self.hand, '手札から消費').not.toContain('B01011');
  });
});
