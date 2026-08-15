// Task A batch#2 — certify-harvest + wave3 (opt-cost reanimate) の novel composition 実 flow 検証。
//
// 検証対象:
//   B01069 (【登場時】optional{ sequence[evidenceGain opp, draw self] })
//   B02053 (event __eventUse → sceneEnter from:remove 白怪盗 + ヒラメキ handAddFromRemove)
//   B02083 (event partnerColor黄 → forEach opp-stun draw + conditional(no stun) stun-pick)
//   D05006 (【登場時】optional{ chain[discard1, sceneEnter from:remove enterSleep] })
//   PR138  (【登場時】optional{ chain[self-sleep, discard1, sceneEnter from:remove] } + ヒラメキ sleep-pick)
// 実証元: B05019 (optional + applyOptionalAndContinuation), D08024 (event-use reanimate), B06071 (forEach all)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks, applyOptionalAndContinuation, _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _peekPendingEffectOptionalSide, _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { B01069 } from '@/cards/ct-p01/B01069';
import { B02053 } from '@/cards/ct-p02/B02053';
import { B02083 } from '@/cards/ct-p02/B02083';
import { D05006 } from '@/cards/ct-d05/D05006';
import { PR138 } from '@/cards/pr-01/PR138';
import { sceneChar as baseScene } from '../helpers/fixtures';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

function sceneChar(cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return baseScene(cardId, uid, { state });
}
function def(id: string, colors: string[], traits: string[], level: number, kind: 'character' | 'event' = 'character'): CardDef {
  return { id, no: 'NO', kind, names: [id], colors, level, ap: 4000, lp: 1, traits, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

describe('Task A certify-harvest + wave3 — novel compositions', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    _clearPendingEffectOptionalSide();
    _clearPendingEffectPickQueue();
    setHuman(null);
  });

  // ---- B01069: optional 【登場時】 相手証拠+1 → draw ----
  it('B01069: human が「する」を選ぶと 相手に証拠+1 + 自分 draw / 「しない」で何も起きない', () => {
    setHuman('self');
    const base = (): GameState => {
      const s = createEmptyGameState();
      s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      s.players.self.hand = ['B01069'];
      s.players.self.case.colors = ['赤'];
      s.players.self.file = [FB, FB, FB, FB];
      s.players.self.deck = ['D08017', 'D08017'];
      s.players.opp.deck = ['D08017', 'D08017'];
      return s;
    };
    // する
    let s = produce(base(), (d) => {
      handUseCard(d, 'self', 'B01069'); runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.opp.evidence.length, '相手に証拠+1').toBe(1);
    expect(s.players.self.hand.includes('D08017'), '自分 1 ドロー').toBe(true);
    _clearPendingEffectOptionalSide(); _clearPendingEffectPickQueue();
    // しない
    s = produce(base(), (d) => {
      handUseCard(d, 'self', 'B01069'); runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      applyOptionalAndContinuation(d, p!, false);
    });
    expect(s.players.opp.evidence.length, 'しない: 相手証拠 0').toBe(0);
  });

  // ---- B02053: event reanimate 白怪盗 ----
  it('B02053: イベント使用で リムーブの白[怪盗]Lv5(KAITO)を登場、非該当(青)は対象外', () => {
    registerCardDef(def('WKAITO', ['白'], ['怪盗'], 5));
    registerCardDef(def('BLUECHAR', ['青'], ['探偵'], 4));
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B02053'];
    s.players.self.case.colors = ['白'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB];
    s.players.self.remove = ['WKAITO', 'BLUECHAR'];
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02053'); runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.scene.some((c) => c.cardId === 'WKAITO'), '白[怪盗]が登場').toBe(true);
    expect(s.players.self.scene.some((c) => c.cardId === 'BLUECHAR'), '青キャラは登場しない').toBe(false);
    expect(s.players.self.remove.includes('WKAITO'), 'WKAITO はリムーブから出た').toBe(false);
  });

  // ---- B02083: event partnerColor黄 → 相手スタン数だけ draw ----
  it('B02083: 【パートナー黄】相手スタン2体で 2 ドロー', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner.cardId = 'D05001'; // 安室透 (黄) → 【パートナー黄】成立
    s.players.self.hand = ['B02083'];
    s.players.self.case.colors = ['黄'];
    s.players.self.file = [FB, FB, FB, FB];
    s.players.self.deck = ['D08017', 'D08017', 'D08017'];
    s.players.opp.scene = [sceneChar('D08017', 'x#1', 'stun'), sceneChar('D08017', 'x#2', 'stun')];
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02083'); runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.hand.filter((c) => c === 'D08017').length, '相手スタン2体 → 2 ドロー').toBe(2);
  });

  // ---- D05006: opt-cost chain reanimate (enterSleep) ----
  it('D05006: human「する」で 手札1リムーブ + リムーブの黄Lv4をスリープ登場 / AI は skip', () => {
    registerCardDef(def('YL4', ['黄'], ['警察'], 4));
    const base = (): GameState => {
      const s = createEmptyGameState();
      s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      s.players.self.hand = ['D05006', 'D08017']; // D08017 = discard 対象
      s.players.self.case.colors = ['黄'];
      s.players.self.file = [FB, FB, FB, FB, FB, FB];
      s.players.self.remove = ['YL4'];
      return s;
    };
    setHuman('self');
    let s = produce(base(), (d) => {
      handUseCard(d, 'self', 'D05006'); runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'opt surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true);
      // BUG-138 (X8): human 所有 pick は drainAiEffectPicks が温存する → human modal 代行 helper で解決
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    const yl4 = s.players.self.scene.find((c) => c.cardId === 'YL4');
    expect(yl4, '黄Lv4 が登場').toBeTruthy();
    expect(yl4?.state, 'スリープ状態で登場').toBe('sleep');
    expect(s.players.self.remove.includes('D08017'), '手札 D08017 をリムーブ(discard)').toBe(true);
    _clearPendingEffectOptionalSide(); _clearPendingEffectPickQueue();
    // AI は optional skip → reanimate しない
    setHuman(null);
    s = produce(base(), (d) => { handUseCard(d, 'self', 'D05006'); runAllUntilEmpty(d); drainAiEffectPicks(d, new HeuristicPolicy()); });
    expect(s.players.self.scene.some((c) => c.cardId === 'YL4'), 'AI: reanimate しない').toBe(false);
  });

  // ---- PR138: self-sleep + opt-cost chain reanimate ----
  it('PR138: human「する」で 自身スリープ + 手札1リムーブ + リムーブの黒ずくめLv6を登場', () => {
    registerCardDef(def('KZ6', ['黒'], ['黒ずくめの組織'], 6));
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['PR138', 'D08017'];
    s.players.self.case.colors = ['黒'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB];
    s.players.self.remove = ['KZ6'];
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR138'); runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'opt surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true);
      // BUG-138 (X8): human 所有 pick は drainAiEffectPicks が温存する → human modal 代行 helper で解決
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'PR138')?.state, '自身スリープ').toBe('sleep');
    expect(s.players.self.scene.some((c) => c.cardId === 'KZ6'), '黒ずくめLv6 登場').toBe(true);
    expect(s.players.self.remove.includes('D08017'), '手札 1 リムーブ').toBe(true);
  });

  // ---- descriptor 構造 ----
  it('descriptor: B01069/D05006 = optional, PR138 = active-gated optional, B02053/B02083 = event-use matcher', () => {
    expect((B01069.abilities[0].effect as { kind: string }).kind).toBe('optional');
    expect((D05006.abilities[0].effect as { kind: string }).kind).toBe('optional');
    expect(PR138.abilities[0].effect).toMatchObject({
      kind: 'conditional',
      if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
      then: { kind: 'optional' },
    });
    expect(typeof (B02053.abilities[0].trigger as { matcher?: unknown }).matcher).toBe('function');
    expect(typeof (B02083.abilities[0].trigger as { matcher?: unknown }).matcher).toBe('function');
  });
});
