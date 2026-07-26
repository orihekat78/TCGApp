// BUG-132 GAP-1/2 修正の pin test (engine拡張 wave#2, 2026-06-12)
//
// GAP-1: deckRevealUntil chooseMatch:'upTo' — 「1枚まで」=0枚可 (rules/15) の decline channel。
//   human owner: 取得/decline/identity 選択を pick で surface (decline 時も deckToBottomBound は実行)。
//   AI / 非human: 従来 path (先頭 match 自動取得) 完全不変 — smoke baseline 不変の根拠。
// GAP-2: effect:declared 第三者反応の解決順 + pick 候補時点 —
//   「使用したイベントの効果を先に解決します」(B08020 公式Q&A、TSV qAndA 一次データ) +
//   rules/15 §解決時参照。batch gate (stack.next) + 遅延 substitute (stack.runOne) を pin する。
//
// rules: 15-abilities-effects.md, 24-qa-naming-stun.md, 25-qa-effects-resolution.md, 26-qa-deck-refresh.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { applyDeckReorderAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import type { PendingDeckRevealSide } from '@/engine/effect/atom-handlers';
import type { GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __pendingDeckRevealSide?: PendingDeckRevealSide | null;
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;

function pickQueue(): PendingEffectPickSide[] {
  return g.__pendingEffectPickQueue ?? [];
}

/** D01013 (上から4枚→【青】1枚まで→discard1→残り下) の共通 fixture */
function d01013State(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.case.colors = ['青'];
  s.players.self.file = [FB, FB, FB, FB, FB, FB, FB];
  // top4 = [D11015(黄), D08013(青=match), D11003(黄), D11004] + 5枚目 D08005
  s.players.self.deck = ['D11015', 'D08013', 'D11003', 'D11004', 'D08005'];
  s.players.self.hand = ['D01013', 'D11005'];
  return s;
}

describe('BUG-132 GAP-1 — deckRevealUntil chooseMatch decline channel', () => {
  beforeEach(() => {
    (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
    (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    g.__pendingEffectPickQueue = [];
    g.__pendingDeckRevealSide = null;
    g.__humanPlayerSide = null;
  });

  it('AI 経路 (humanSide=null): chooseMatch 付きでも従来 path — pick を出さず先頭 match を自動取得', () => {
    const s = produce(d01013State(), (d) => {
      handUseCard(d, 'self', 'D01013');
      runAllUntilEmpty(d);
    });
    expect(pickQueue().some((p) => p.atomVerb === 'deckRevealUntil'), 'deckRevealUntil pick は出ない').toBe(false);
    expect(s.players.self.hand, 'D08013 を自動取得 (従来挙動不変)').toContain('D08013');
  });

  it('human take: pick surface (nMin=0/skipResolvesAtom/overlay hold) → 選択で取得 + discard + 残り下', () => {
    g.__humanPlayerSide = 'self';
    let s = produce(d01013State(), (d) => {
      handUseCard(d, 'self', 'D01013');
      runAllUntilEmpty(d);
    });
    // pick が surface し、効果は pause している
    expect(s.players.self.hand, '取得前 — 手札にまだ入らない').not.toContain('D08013');
    const pending = pickQueue()[0];
    expect(pending?.atomVerb).toBe('deckRevealUntil');
    expect(pending?.nMin, '「まで」=0枚可').toBe(0);
    expect(pending?.skipResolvesAtom, 'decline は破棄でなく atom 解決').toBe(true);
    expect(pending?.candidates.map((c) => c.cardId)).toEqual(['D08013']);
    expect(g.__pendingDeckRevealSide?.awaitingPick, 'overlay は hold mode').toBe(true);
    // 取得を選択
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, pending!.candidates[0]!.uid);
    });
    expect(s.players.self.hand, 'D08013 を取得').toContain('D08013');
    expect(g.__pendingDeckRevealSide?.matched, 'overlay 確定 matched').toBe('D08013');
    expect(g.__pendingDeckRevealSide?.awaitingPick).toBeUndefined();
    // continuation: conditional true → discard pick (必須 n:1) が次に出る
    const discardPick = pickQueue()[0];
    expect(discardPick?.atomVerb, '「加えた場合」の必須 discard').toBe('discard');
    g.__pendingEffectPickQueue = [];
    const d11005 = discardPick!.candidates.find((c) => c.cardId === 'D11005')!;
    s = produce(s, (d) => {
      applyPickAndContinuation(d, discardPick!, d11005.uid);
    });
    const reorder = _drainPendingDeckReorderSide();
    expect(reorder, '残り3枚はデッキ下順序の決定待ち').not.toBeNull();
    s = produce(s, d => applyDeckReorderAndContinuation(d, reorder!, reorder!.cardIds));
    expect(s.players.self.remove, 'D11005 を discard').toContain('D11005');
    // deckToBottomBound: 残り3枚が下、元5枚目が top
    expect(s.players.self.deck.length).toBe(4);
    expect(s.players.self.deck[0]).toBe('D08005');
    expect([...s.players.self.deck.slice(-3)].sort()).toEqual(['D11003', 'D11004', 'D11015']);
  });

  it('human decline: 取得なし・discard なし・全 reveal がデッキ下 (公式Q&A「加えないことは可能」)', () => {
    g.__humanPlayerSide = 'self';
    let s = produce(d01013State(), (d) => {
      handUseCard(d, 'self', 'D01013');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending);
    });
    const reorder = _drainPendingDeckReorderSide();
    expect(reorder, 'declineでも公開4枚はデッキ下順序の決定待ち').not.toBeNull();
    s = produce(s, d => applyDeckReorderAndContinuation(d, reorder!, reorder!.cardIds));
    expect(s.players.self.hand, '加えない選択 — D08013 は手札に入らない').not.toContain('D08013');
    expect(pickQueue().some((p) => p.atomVerb === 'discard'), '「加えた場合」不成立 — discard も出ない').toBe(false);
    expect(s.players.self.hand, 'D11005 は手札に残る').toContain('D11005');
    expect(s.players.self.remove, 'リムーブなし').toEqual([]);
    // 全 4 reveal (match 含む) が「残り」としてデッキ下へ、元5枚目が top
    expect(s.players.self.deck.length, 'デッキ枚数不変').toBe(5);
    expect(s.players.self.deck[0]).toBe('D08005');
    expect([...s.players.self.deck.slice(-4)].sort()).toEqual(['D08013', 'D11003', 'D11004', 'D11015']);
    expect(g.__pendingDeckRevealSide?.matched, 'overlay は decline 確定 (matched なし)').toBeNull();
  });

  it('human multi-match: window 内の全 match が候補 (identity 選択、rules/15「選び」)', () => {
    g.__humanPlayerSide = 'self';
    const base = d01013State();
    // top4 に青2枚: D08013(青) と D08009(青)
    base.players.self.deck = ['D08013', 'D11003', 'D08009', 'D11004', 'D08005'];
    let s = produce(base, (d) => {
      handUseCard(d, 'self', 'D01013');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    expect(pending.candidates.map((c) => c.cardId).sort(), '青2枚とも候補').toEqual(['D08009', 'D08013']);
    // 2番目の match (D08009) を選択 — 先頭固定でないことを pin
    const second = pending.candidates.find((c) => c.cardId === 'D08009')!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, second.uid);
    });
    expect(s.players.self.hand).toContain('D08009');
    expect(s.players.self.hand).not.toContain('D08013');
    expect(s.players.self.deck, '非選択 match (D08013) は残りとしてデッキへ').toContain('D08013');
  });
});

describe('BUG-132 GAP-2 — effect:declared 自効果先行 + 反応 pick の解決時確定', () => {
  beforeEach(() => {
    (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
    (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    g.__pendingEffectPickQueue = [];
    g.__pendingDeckRevealSide = null;
    g.__humanPlayerSide = null;
  });

  /** B07016 (反応) + B06035 (緑イベント: キャラ1枚までリムーブ) の共通 fixture */
  function gap2State(): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.case.colors = ['緑'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ B06035 level7
    s.players.self.hand = ['B06035'];
    s.players.self.scene = [sceneChar('B07016', 'hatt#1', { state: 'active' })];
    // opp: D11003 (lvl8 AP8000) / D11015 (lvl5 AP5000) — どちらも反応 filter levelMax:8 内
    s.players.opp.scene = [
      sceneChar('D11003', 'oppA#1', { state: 'active' }),
      sceneChar('D11015', 'oppB#1', { state: 'active' }),
    ];
    s.players.self.deck = [FB.cardId, FB.cardId];
    return s;
  }

  it('AI 経路: イベント自効果が先に解決され、反応はイベント解決後の盤面で別キャラを除去 (計2枚)', () => {
    const s = produce(gap2State(), (d) => {
      handUseCard(d, 'self', 'B06035');
      runAllUntilEmpty(d);
      // AI policy loop 相当: PA 短縮形の runtime pick を heuristic で順次解決 (own → gate解除 → 反応)
      drainAiEffectPicks(d);
    });
    const total = s.players.self.scene.length + s.players.opp.scene.length;
    // 修正前: 反応の pick が queue 時 (イベント解決前盤面) に確定 → イベントが除去した同一キャラを
    // 選んで no-op → 除去合計 1 (残 2)。修正後: 解決時盤面で別キャラを選ぶ → 除去合計 2 (残 1)。
    expect(total, '3体中ちょうど2体が除去される (自効果1 + 反応1、重複なし)').toBe(1);
  });

  it('human 経路: 反応はイベント own pick の modal 解決まで gate され、候補は解決後盤面で確定', () => {
    g.__humanPlayerSide = 'self';
    let s = produce(gap2State(), (d) => {
      handUseCard(d, 'self', 'B06035');
      runAllUntilEmpty(d);
    });
    // 1st drain: own (B06035) の pick のみ surface。反応 entry は gate で pending のまま
    expect(pickQueue().length, 'pick は own の1件のみ (反応はまだ)').toBe(1);
    const ownPick = pickQueue()[0]!;
    expect(ownPick.source.cardId).toBe('B06035');
    const reaction = s.pendingEffects.find((e) => e.declaredReaction !== undefined);
    expect(reaction?.state, '反応 entry は own modal 解決待ちで pending').toBe('pending');
    expect(reaction?.declaredReaction?.abilityId).toBe('a1');
    // own pick で oppA#1 (D11003) を除去 → 反応が解決され、候補は除去後盤面
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, ownPick, 'oppA#1');
    });
    expect(s.players.opp.scene.some((c) => c.uid === 'oppA#1'), 'イベントが oppA#1 を除去').toBe(false);
    const reactionPick = pickQueue()[0];
    expect(reactionPick?.atomVerb, '反応 (B07016 a1) の pick が解決後に surface').toBe('sceneRemove');
    expect(reactionPick?.source.cardId).toBe('B07016');
    const candUids = reactionPick!.candidates.map((c) => c.uid);
    expect(candUids, '除去済み oppA#1 は候補に出ない (解決時盤面、rules/15 §解決時参照)').not.toContain('oppA#1');
    expect(candUids, '残存 oppB#1 は候補').toContain('oppB#1');
    // 反応で oppB#1 を除去して完走
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, reactionPick!, 'oppB#1');
    });
    expect(s.players.opp.scene.length, '反応が oppB#1 を除去 — 公式順の完走').toBe(0);
  });
});
