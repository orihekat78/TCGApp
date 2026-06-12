// engine-extension multi-hook 共有【ターン1】batch (2026-06-06 タスクC) —
// 「推理かアクションしたとき」(reasoning:end + action:declare) を 1 ability の hooks で購読し、
// limit:{kind:'turn'} が ability.id 単位のため 2 hook を跨いだ共有【ターン1】が成立することを検証。
//   D03007 (selfOnly) / B04039 (triggerCharMatches on action:declare) / B02004 (bond + enter-from-remove)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { doReasoning } from '@/engine/flow/main/reasoning';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { D03007 } from '@/cards/ct-d03/D03007';
import { B04039 } from '@/cards/ct-p04/B04039';
import { B02004 } from '@/cards/ct-p02/B02004';
import type { GameState, CardDef } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';

function synth(id: string, names: string[], level: number, lp = 1): CardDef {
  return { id, no: `NO-${id}`, kind: 'character', names, colors: ['青'], level, ap: 3000, lp, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
// action:declare を直接 emit (listener の multi-hook + 共有 limit を検証する最小手段)
function emitAction(s: GameState, uid: string, player: 'self' | 'opp'): void {
  event.emit(s, 'action:declare', { byUid: uid, target: { kind: 'event' }, uid, player }, { player, uid });
}

describe('engine-extension multi-hook 共有【ターン1】batch (2026-06-06)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('card def: D03007 trigger=reasoning:end + hooks[action:declare] + selfOnly + limit turn1', () => {
    expect(D03007.abilities[0].trigger).toMatchObject({ hook: 'reasoning:end', hooks: ['action:declare'], selfOnly: true });
    expect(D03007.abilities[0].limit).toMatchObject({ kind: 'turn', n: 1 });
  });

  it('D03007: 推理で1ドロー → 同ターンのアクションでは追加ドローしない (共有【ターン1】)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('D03007', 'sh#1')];
    s.players.self.deck = ['c1', 'c2', 'c3', 'c4']; // 推理 LP1 で c1 証拠化 + a1 で c2 ドロー
    s = produce(s, (d) => {
      doReasoning(d, 'sh#1'); runAllUntilEmpty(d);   // 推理 → a1 draw (counter=1)
      emitAction(d, 'sh#1', 'self'); runAllUntilEmpty(d); // アクション → a1 は limit で skip
    });
    expect(s.players.self.hand, '推理で1ドローのみ (c2)、アクションでは追加なし').toEqual(['c2']);
  });

  it('D03007: 先にアクションで1ドロー → 同ターンの推理では追加ドローしない (逆順でも共有)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('D03007', 'sh#1')];
    s.players.self.deck = ['c1', 'c2', 'c3', 'c4'];
    s = produce(s, (d) => {
      emitAction(d, 'sh#1', 'self'); runAllUntilEmpty(d);  // アクション → a1 draw c1 (counter=1)
      doReasoning(d, 'sh#1'); runAllUntilEmpty(d);          // 推理 → 証拠化 c2、a1 は limit skip
    });
    expect(s.players.self.hand, 'アクションで1ドロー (c1) のみ').toEqual(['c1']);
  });

  it('B04039: 自分側[白馬探]の **アクション** で1ドロー (action:declare triggerChar)', () => {
    registerCardDef(synth('SHIRAISHI', ['白馬探'], 6));
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B04039', 'wat#1'), sceneChar('SHIRAISHI', 'shi#1')];
    s.players.self.deck = ['c1', 'c2'];
    s = produce(s, (d) => { emitAction(d, 'shi#1', 'self'); runAllUntilEmpty(d); });
    expect(s.players.self.hand, '[白馬探]のアクションで B04039 が1ドロー (c1)').toEqual(['c1']);
  });

  it('B04039: 非[白馬探]のアクションでは不発 (triggerCharMatches cardName gate)', () => {
    registerCardDef(synth('OTHER', ['別キャラ'], 5));
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B04039', 'wat#1'), sceneChar('OTHER', 'oth#1')];
    s.players.self.deck = ['c1', 'c2'];
    s = produce(s, (d) => { emitAction(d, 'oth#1', 'self'); runAllUntilEmpty(d); });
    expect(s.players.self.hand, '非[白馬探]のアクションでは不発').toEqual([]);
  });

  it('B02004: 【絆工藤新一】成立で推理時 リムーブの[妃英理]Lv5以下を登場 / 絆なしは不発', () => {
    const policy = new HeuristicPolicy();
    registerCardDef(synth('KUDO', ['工藤新一'], 6, 0));
    registerCardDef(synth('EIRI', ['妃英理'], 3, 2));
    // 絆あり: 工藤新一 が現場 → enter-from-remove で 妃英理 登場
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B02004', 'ran#1'), sceneChar('KUDO', 'kudo#1')];
    s.players.self.remove = ['EIRI'];
    s.players.self.deck = ['c1'];
    s = produce(s, (d) => { doReasoning(d, 'ran#1'); runAllUntilEmpty(d); drainAiEffectPicks(d, policy); });
    expect(s.players.self.scene.some((c) => c.cardId === 'EIRI'), '絆成立で[妃英理]が現場に登場').toBe(true);
    expect(s.players.self.remove, '[妃英理]はリムーブから出た').not.toContain('EIRI');

    // 絆なし: 工藤新一 不在 → a1 不発 (妃英理 はリムーブのまま)
    let s2: GameState = createEmptyGameState();
    s2.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s2.players.self.scene = [sceneChar('B02004', 'ran#1')];
    s2.players.self.remove = ['EIRI'];
    s2.players.self.deck = ['c1'];
    s2 = produce(s2, (d) => { doReasoning(d, 'ran#1'); runAllUntilEmpty(d); drainAiEffectPicks(d, policy); });
    expect(s2.players.self.remove, '絆なしなら[妃英理]はリムーブに残る').toContain('EIRI');
  });
});
