// qa: card:B09039:f2e98bbb3d44e213bf33b029253bb3aecf1a2669c18736ed488d4ae55db630f0
// tests/cards/s1-defer/B09039 中森青子 — S1 defer-unlock probe (owner='opp' 固定)
//
// a1【登場時】handAddFromRemove の area union (remove ∪ partner-area) + filter{trait ビッグジュエル, kind event}。
// a2【宣言】【ターン1】chain[useEventFromHand(0使用 gate) → handAddFromRemove(gateOnZero) → discard]。
//
// gate 経路 (payload 必須):
//   ① イベント使用 + 白 lvl≤3 加えた → discard 発生
//   ② イベント使用 + 加える対象0 → discard **発生しない** (gateOnZero)
//   ③ イベント不使用 (候補0) → 後続全 skip (useEventFromHand chainStepNoApply)
//   ④ owner=opp (全 probe で pin)
// rules: 03, 15 §「まで」=0可, 17, 21, 25 §B08020 解決順

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { _drainPendingEffectPickSide, _peekPendingEffectPickSide } from '@/engine/effect/pending-state';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B09039 } from '@/cards/ct-p09/B09039';
import { B07059 } from '@/cards/ct-p07/B07059';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function ev(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors: ['白'], level: 5, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// テスト用 def
const BJ5 = 'BJ5';        // レベル5 ビッグジュエル イベント (a2 使用対象)
const BJ_EV = 'BJ_EV';    // ビッグジュエル イベント (a1 remove 対象、任意レベル)
const BJ_PA = 'BJ_PA';    // ビッグジュエル イベント (a1 partner-area 対象)
const NONBJ_EV = 'NONBJ_EV'; // ビッグジュエルでない イベント (decoy)
const BJ_CHAR = 'BJ_CHAR';   // ビッグジュエル だが character (kind:event でない → a1 非対象 decoy)
const W3 = 'W3';          // 白 レベル3 キャラ (a2 handAdd 対象)
const W4 = 'W4';          // 白 レベル4 キャラ (levelMax:3 超過 decoy)
const BLK3 = 'BLK3';      // 黒 レベル3 キャラ (色違い decoy)
const SENT = 'SENT';      // 手札 sentinel キャラ (event でない → useEventFromHand 非対象)
const WHITE_PARTNER: CardDef = {
  id: 'WHITE_PARTNER', no: 'WHITE_PARTNER', kind: 'partner', names: ['WHITE_PARTNER'],
  colors: ['白'], lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerCardDef(B09039);
  registerCardDef(B07059);
  registerCardDef(WHITE_PARTNER);
  registerCardDef(ev(BJ5, { level: 5, traits: ['ビッグジュエル'] }));
  registerCardDef(ev(BJ_EV, { level: 3, traits: ['ビッグジュエル'] }));
  registerCardDef(ev(BJ_PA, { level: 3, traits: ['ビッグジュエル'] }));
  registerCardDef(ev(NONBJ_EV, { level: 3, traits: [] }));
  registerCardDef(ch(BJ_CHAR, { level: 3, traits: ['ビッグジュエル'], colors: ['白'] }));
  registerCardDef(ch(W3, { level: 3, colors: ['白'] }));
  registerCardDef(ch(W4, { level: 4, colors: ['白'] }));
  registerCardDef(ch(BLK3, { level: 3, colors: ['黒'] }));
  registerCardDef(ch(SENT, { level: 2, colors: ['白'] }));
  registerTriggeredListener();
});

function oppTurn(s: GameState): void {
  s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
}

/** a1 の effect を owner=opp で直接駆動 (pick は AI 解決)。 */
function driveA1(setup: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  oppTurn(s);
  setup(s);
  const eff = B09039.abilities.find((a) => a.id === 'a1')!.effect;
  s = produce(s, (d) => {
    const ctx = { source: { player: 'opp', cardId: 'B09039', uid: 'aoko#1', abilityId: 'a1', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
    runEffect(d, eff as never, ctx);
    for (let i = 0; i < 6; i++) { runAllUntilEmpty(d); _drainAllEffectPicksForTest(d, new HeuristicPolicy()); runAllUntilEmpty(d); }
  });
  return s;
}

/** a2 を production dispatch (activateDeclaredAbility) で owner=opp 駆動。B09039 を opp 現場に置く。 */
function driveA2(setup: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  oppTurn(s);
  s.players.opp.scene = [sceneChar('B09039', 'aoko#1')];
  setup(s);
  s = produce(s, (d) => {
      activateDeclaredAbility(d, 'aoko#1', 'a2');
    for (let i = 0; i < 6; i++) { runAllUntilEmpty(d); _drainAllEffectPicksForTest(d, new HeuristicPolicy()); runAllUntilEmpty(d); }
  });
  return s;
}

const discarded = (s: GameState) => s.log.some((e) => e.player === 'opp' && e.action === 'effect:discard');

// ============================================================
// a1 — 【登場時】 area union pick (remove ∪ partner-area) + event filter
// ============================================================
describe('B09039 a1 — handAddFromRemove area union', () => {
  it('remove の ビッグジュエル event を手札へ (非BJ event / BJ character は非対象)', () => {
    const s = driveA1((st) => {
      st.players.opp.remove = [NONBJ_EV, BJ_CHAR, BJ_EV];
    });
    expect(s.players.opp.hand.includes(BJ_EV), 'BJ event 手札へ').toBe(true);
    expect(s.players.opp.remove.includes(BJ_EV), 'remove から抜けた').toBe(false);
    expect(s.players.opp.remove.includes(NONBJ_EV), '非BJ event は remove 残').toBe(true);
    expect(s.players.opp.remove.includes(BJ_CHAR), 'BJ だが character は remove 残 (kind:event gate)').toBe(true);
  });

  it('partner-area の ビッグジュエル event を手札へ (union の PA path)', () => {
    const s = driveA1((st) => {
      st.players.opp.partnerAreaCards = [BJ_PA];
      st.players.opp.remove = [];
    });
    expect(s.players.opp.hand.includes(BJ_PA), 'PA の BJ event 手札へ').toBe(true);
    expect((s.players.opp.partnerAreaCards ?? []).includes(BJ_PA), 'PA から抜けた').toBe(false);
  });

  it('候補0 (BJ event 不在) → 何も加えない (hand 不変)', () => {
    const s = driveA1((st) => {
      st.players.opp.remove = [NONBJ_EV, BJ_CHAR];
      st.players.opp.hand = [];
    });
    expect(s.players.opp.hand.length, 'hand は空のまま').toBe(0);
  });
});

// ============================================================
// a2 — 【宣言】chain gate (useEventFromHand → handAddFromRemove gateOnZero → discard)
// ============================================================
describe('B09039 a2 — chain gate paths (owner=opp)', () => {
  it('① イベント使用 + 白lvl≤3 加えた → discard 発生', () => {
    const s = driveA2((st) => {
      st.players.opp.hand = [BJ5, SENT];
      st.players.opp.remove = [W3];
    });
    expect(s.players.opp.remove.includes(BJ5), 'イベント使用 → remove へ').toBe(true);
    expect(s.log.some((e) => e.action === 'effect:handAddFromRemove' && e.result === 'ok'), '白キャラ handAdd 成功').toBe(true);
    expect(discarded(s), 'discard 発生').toBe(true);
  });

  it('② イベント使用 + 加える対象0 (白lvl≤3 不在) → discard **発生しない** (gateOnZero)', () => {
    const s = driveA2((st) => {
      st.players.opp.hand = [BJ5, SENT];
      st.players.opp.remove = [W4, BLK3]; // 白Lv4 (超過) / 黒Lv3 (色違い) — 有効候補0
    });
    expect(s.players.opp.remove.includes(BJ5), 'イベント使用 → remove へ').toBe(true);
    expect(discarded(s), 'discard は発生しない (gateOnZero で skip)').toBe(false);
    expect(s.players.opp.hand, 'hand は SENT のみ (BJ5 使用・加無し・discard無)').toEqual([SENT]);
  });

  it('③ イベント不使用 (BJ5 event が手札に無い) → 後続全 skip', () => {
    const s = driveA2((st) => {
      st.players.opp.hand = [SENT]; // BJ5 event 無し
      st.players.opp.remove = [W3];
    });
    expect(s.players.opp.hand, 'hand 不変 (使用も加も discard も無)').toEqual([SENT]);
    expect(s.players.opp.remove.includes(W3), 'W3 は remove 残 (handAdd 未実行)').toBe(true);
    expect(discarded(s), 'discard 発生しない').toBe(false);
  });

  it.each(['use condition', 'event-use ban'] as const)(
    'human pending event use becomes stale by %s: consumes only the picker and aborts the B09039.a2 remainder',
    (staleBy) => {
      registerCardDef(ev(BJ5, {
        level: 5,
        traits: ['ビッグジュエル'],
        useCondition: { kind: 'fileAtLeast', n: 1 },
      }));
      const s = createEmptyGameState();
      oppTurn(s);
      s.players.opp.hand = [BJ5, SENT];
      s.players.opp.remove = [W3];
      s.players.opp.file = [{ type: 'card-back' }];
      const ctx: EffectCtx = {
        source: { player: 'opp', cardId: 'B09039', uid: 'aoko#1', abilityId: 'a2', area: 'scene' },
        bindings: {},
      };
      const selected = resolveEffectPicks(s, B09039.abilities.find((a) => a.id === 'a2')!.effect!, ctx, {
        byPlayer: 'opp', humanChooser: true, humanPlayer: 'opp', source: { cardId: 'B09039', abilityId: 'a2' },
      });
      runEffect(s, selected, ctx);
      const pick = _peekPendingEffectPickSide();
      expect(pick?.candidates.map((c) => c.cardId)).toEqual([BJ5]);
      const pickedUid = pick!.candidates[0]!.uid;

      if (staleBy === 'use condition') s.players.opp.file = [];
      else s.turnState.opp.eventUseBanned = true;
      const before = structuredClone(s);
      const beforeBindings = structuredClone(ctx.bindings);
      const beforeDyn = structuredClone(ctx.dyn);
      let declared = 0;
      event.on('effect:declared', () => { declared++; });

      applyPickAndContinuation(s, pick!, pickedUid);

      expect(s).toEqual(before);
      expect(ctx.bindings).toEqual(beforeBindings);
      expect(ctx.dyn).toEqual(beforeDyn);
      expect(declared).toBe(0);
      expect(_drainPendingEffectPickSide()).toBeNull();
    },
  );

  it('resolves B07059 after the B09039 remainder and moves the used event to partner area', () => {
    const s = driveA2((state) => {
      state.players.opp.hand = [B07059.id];
      state.players.opp.partner.cardId = WHITE_PARTNER.id;
    });

    expect(s.players.opp.partnerAreaCards, B09039.id).toContain(B07059.id);
    expect(s.players.opp.hand).not.toContain(B07059.id);
    expect(s.players.opp.remove).not.toContain(B07059.id);
  });
});
