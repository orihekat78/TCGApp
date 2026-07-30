// BUG-134 characterization / guard — 同一 hook (phase:end:start 等) で複数 triggered entry が同時 queue
//   されるとき、各 entry の pick 候補は **queue 時 (発動時) の盤面で確定** する (effect:declared 以外の全 hook)。
//   先行 entry の解決が盤面を変えても後続 entry の候補は再評価されない (rules/15「未解決効果は解決時に
//   参照」・rules/25「解決時の盤面」に対する既知の構造的乖離)。
//
// 2026-06-22 scan 結論 (BUG-134.md 参照):
//   - 害B (先行が候補を「追加」→ 後続が新候補を選べない): turn-end で sceneEnter する出荷カードが
//     0 件のため **構造的に実在しない**。
//   - 害A (先行が候補を「削除/スタン」→ 後続 pre-resolved が stale target に当たる): 多 copy の
//     turn-end 削除 pick で原理上発生しうるが、atom handler の splice 防御 (BUG-132 dedup guard) により
//     適用結果は **rules-correct な no-op** (rules/25「同時リムーブで両方消えていれば条件不成立」と一致)。
//     不正状態 (複製・crash) は生じない。残差は AI の手の最適性 / human の stale 候補表示という狭い tail で、
//     manifesting カードは MVP smoke デッキ外。engine 全面の遅延 substitute 一般化は 骨格凍結 risk に対し
//     過大なため見送り。本テストは guard 不変条件 (no illegal state) を pin する。
//
// rules: 15-abilities-effects.md (§未解決効果), 25-qa-effects-resolution.md (§解決時参照 / §同時リムーブ)
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';

type G = { __pendingEffectPickQueue?: PendingEffectPickSide[]; __humanPlayerSide?: 'self' | 'opp' | null };
const g = globalThis as G;
const ch = (id: string, a: AbilityDef[] = [], o: Partial<CardDef> = {}): CardDef => ({
  id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: a, ruleRefs: [], ...o,
}) as unknown as CardDef;

// 【ターン終了時】(condition turn:self) 相手の現場のキャラを1枚リムーブ (side:'opp' pick)
const removeOppA: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  trigger: { hook: 'phase:end:start' },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'opp', cause: 'effect', uid: '$pick', target: { kind: 'pick', query: { area: 'scene', side: 'opp' }, n: { min: 0, max: 1 }, chooser: 'self' } } },
  description: 'turn-end remove 1 opp char', ruleRefs: [],
};

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  g.__pendingEffectPickQueue = [];
  resetDefRegistry();
  registerCardDef(ch('REMA', [removeOppA]));
  registerCardDef(ch('REMB', [removeOppA]));
  registerCardDef(ch('OX'));
  registerCardDef(ch('OY'));
  registerTriggeredListener();
});
afterAll(() => { g.__humanPlayerSide = null; });

describe('BUG-134 — 同時 queue entry の pick 候補は発動時確定 (guard 不変条件)', () => {
  it('AI 経路: 2 つの turn-end 削除 pick が co-fire しても不正状態を生まない (stale target は guard で no-op)', () => {
    g.__humanPlayerSide = null; // smoke / AI path
    const s0 = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.scene = [sceneChar('REMA', 'a0', { state: 'active' }), sceneChar('REMB', 'b0', { state: 'active' })];
      d.players.opp.scene = [sceneChar('OX', 'ox0', { state: 'sleep' }), sceneChar('OY', 'oy0', { state: 'sleep' })];
    });
    const s1 = produce(s0, (d) => {
      event.emit(d, 'phase:end:start', { player: 'self' }, undefined);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    const opp = s1.players.opp.scene;
    // guard 不変条件: queue は drain しきる / opp scene に複製や不正 uid は無い / 削除数は 0..2 の合法範囲。
    expect((g.__pendingEffectPickQueue ?? []).length).toBe(0);
    const uids = opp.map((c) => c.uid);
    expect(new Set(uids).size).toBe(uids.length); // 複製なし
    expect(opp.length).toBeGreaterThanOrEqual(0);
    expect(opp.length).toBeLessThanOrEqual(2);
    // 残存 char は元の OX/OY のいずれか (不正 cardId が現れない)
    for (const c of opp) expect(['OX', 'OY']).toContain(c.cardId);
    g.__humanPlayerSide = null;
  });

  it('human path: owner order resolves each sibling against the then-current board', () => {
    // Both same-batch triggers wait for the owner order. The first resolution removes OX;
    // only then is the second trigger's legal target set derived from the current board.
    g.__humanPlayerSide = 'self';
    let state = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.scene = [sceneChar('REMA', 'a0', { state: 'active' }), sceneChar('REMB', 'b0', { state: 'active' })];
      d.players.opp.scene = [sceneChar('OX', 'ox0', { state: 'sleep' }), sceneChar('OY', 'oy0', { state: 'sleep' })];
    });
    state = produce(state, (d) => {
      event.emit(d, 'phase:end:start', { player: 'self' }, undefined);
      runAllUntilEmpty(d);
      expect(d.pendingEffects.filter(entry => entry.state === 'pending')).toHaveLength(2);
      d.pendingEffects.forEach((entry, order) => {
        entry.ownerChosenOrder = order;
        entry.ownerOrderConfirmed = true;
      });
      runAllUntilEmpty(d);
    });
    const first = _drainPendingEffectPickSide()!;
    expect(first.source.triggerBatch).toBeDefined();
    // The first picker sees the original board; the second no longer offers the removed OX.
    expect(first.candidates.map(candidate => candidate.uid).sort()).toEqual(['ox0', 'oy0']);
    state = produce(state, draft => applyPickAndContinuation(draft, first, 'ox0'));
    const second = _drainPendingEffectPickSide()!;
    expect(second.candidates.map(candidate => candidate.uid)).toEqual(['oy0']);
    expect(state.players.opp.scene.map(character => character.uid)).toEqual(['oy0']);
    g.__humanPlayerSide = null;
  });
});
