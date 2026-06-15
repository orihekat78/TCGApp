// cluster14 — multi-card sceneEnter (「…キャラを2枚まで選び、登場させる」) の挙動テスト。
// engine拡張 wave#2 cluster14 (2026-06-15): sceneEnter に cardIds:'$pick.cardIds' 契約を拡張し、
// 現場満杯時の switch を switchRemoveUids[] で per-card 消費。distinctNames は chooseAiPick でも dedup。
// B09010 は skipResolvesAtom により 0枚登場でも後続 fileRemoveTop を解決。
//
// 検証 (非MVP のため smoke では踏めない = 専用テスト必須):
//   §a B09010 2枚 room十分 → 2体 active 登場 + FILE 上1リムーブ。
//   §b PR042 enterSleep → 2体スリープ登場。
//   §c room1 + enter2 (victim 1) → 1体通常 + 1体 switch、scene=5・victim 離場。
//   §d full + enter2 (victim 2) → 2体 switch、scene=5・victim 2体離場 (throw 無)。
//   §e full + enter2 (victim 無 / AI) → 入る分のみ (per-card skip、throw 無)。
//   §f AI distinctNames: 同名2 + 別名1 → 別名2体 (rules/19 split-name dedup)。
//   §g B09010 0枚 decline (remove に有効候補無) でも FILE 上1リムーブ実行 (skipResolvesAtom)。
//   §i exact vs ≤ level: Lv3[少年探偵団] decoy は B09010(Lv4 EXACT)非対象 / PR042(≤4)対象。
//   §j 疾風N: 2体の enterOrderThisTurn が 1 枚ずつ加算される (per-card emit)。
//   §k 構造: 4 printings 登録。
// rules: 03, 15 §「〜まで」=0可, 17 §疾風N, 19 split-name, 20 §スイッチ, 21

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry, def } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// 少年探偵団 reanimate 候補。SBT4a/SBT4b = Lv4 別名、SBT4a2 = SBT4a と同名(別 id 同 names) で distinctNames decoy、
// SBT3 = Lv3 (B09010 の Lv4 EXACT 非対象 / PR042 ≤4 対象)。
const SBT4a = 'SBT4a', SBT4b = 'SBT4b', SBT4a2 = 'SBT4a2', SBT3 = 'SBT3';

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerAll(); // cluster14 cards (B09010/B09010P/PR042/PR046) 込み
  registerCardDef(ch(SBT4a, { names: ['歩'], level: 4, traits: ['少年探偵団'] }));
  registerCardDef(ch(SBT4b, { names: ['光彦'], level: 4, traits: ['少年探偵団'] }));
  registerCardDef(ch(SBT4a2, { names: ['歩'], level: 4, traits: ['少年探偵団'] })); // SBT4a と同名
  registerCardDef(ch(SBT3, { names: ['元太'], level: 3, traits: ['少年探偵団'] }));
  registerTriggeredListener();
});

function turnSelf(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

/** ability の effect を実 engine 経路で駆動し pick を AI 解決して drain しきる。 */
function runAbility(cardId: string, abilityId: string, setup: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  turnSelf(s);
  setup(s);
  const ab = def.card(cardId)!.abilities.find((a) => a.id === abilityId)!;
  s = produce(s, (d) => {
    const ctx = { source: { player: 'self', cardId, uid: 'src#1', abilityId, area: 'scene' }, bindings: {} } as unknown as EffectCtx;
    runEffect(d, ab.effect as never, ctx);
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    }
  });
  return s;
}

/** 解決済 (resolved) sceneEnter atom を直接実行 (human の switch victim 選択を模擬)。 */
function runResolvedEnter(cardIds: string[], switchRemoveUids: string[], setup: (s: GameState) => void, enterSleep = false): GameState {
  let s = createEmptyGameState();
  turnSelf(s);
  setup(s);
  s = produce(s, (d) => {
    const ctx = { source: { player: 'self', cardId: 'B09010', uid: 'src#1', abilityId: 'a1', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
    const atom = {
      kind: 'atom', verb: 'sceneEnter',
      args: {
        player: 'self', from: 'remove', cardIds, switchRemoveUids, viaEffect: true, enterSleep,
        target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '少年探偵団' } }, n: { min: 0, max: 2 }, chooser: 'self' },
      },
    };
    runEffect(d, atom as never, ctx);
    runAllUntilEmpty(d);
  });
  return s;
}

describe('cluster14 §a — B09010 2枚 room十分 → 2体 active 登場 + FILE上1リムーブ', () => {
  it('remove の Lv4 別名2体を登場 + file -1', () => {
    const s = runAbility('B09010', 'a1', (st) => {
      st.players.self.scene = [sceneChar('B09010', 'kasa#1')];
      st.players.self.remove = [SBT4a, SBT4b];
      st.players.self.file = [FB, FB, FB];
    });
    const entered = s.players.self.scene.filter((c) => c.cardId === SBT4a || c.cardId === SBT4b);
    expect(entered.length, '2体登場').toBe(2);
    expect(entered.every((c) => c.state === 'active'), 'active 登場 (enterSleep なし)').toBe(true);
    expect(s.players.self.remove.includes(SBT4a) || s.players.self.remove.includes(SBT4b), 'remove から除去').toBe(false);
    expect(s.players.self.file.length, 'FILE 上1リムーブ').toBe(2);
  });
});

describe('cluster14 §b — PR042 enterSleep → 2体スリープ登場', () => {
  it('手札1リムーブ → Lv4以下2体をスリープ登場', () => {
    const s = runAbility('PR042', 'a1', (st) => {
      st.players.self.scene = [sceneChar('PR042', 'sonoko#1')];
      st.players.self.hand = ['DUMMYHAND'];
      st.players.self.remove = [SBT4a, SBT4b];
    });
    const entered = s.players.self.scene.filter((c) => c.cardId === SBT4a || c.cardId === SBT4b);
    expect(entered.length, '2体登場').toBe(2);
    expect(entered.every((c) => c.state === 'sleep'), 'スリープ状態で登場').toBe(true);
  });
});

describe('cluster14 §c/§d — switch victim (explicit resolved)', () => {
  it('§c room1 + enter2 (victim 1) → scene=5、victim 離場', () => {
    const s = runResolvedEnter([SBT4a, SBT4b], ['v2'], (st) => {
      st.players.self.scene = [sceneChar('B09010', 'kasa#1'), sceneChar(SBT3, 'v1'), sceneChar(SBT3, 'v2'), sceneChar(SBT3, 'v3')];
      st.players.self.remove = [SBT4a, SBT4b];
    });
    expect(s.players.self.scene.length, 'scene=5').toBe(5);
    expect(s.players.self.scene.some((c) => c.uid === 'v2'), 'victim v2 離場').toBe(false);
    expect(s.players.self.scene.filter((c) => c.cardId === SBT4a || c.cardId === SBT4b).length, '2体登場').toBe(2);
  });
  it('§d full + enter2 (victim 2) → scene=5、victim 2体離場 (throw 無)', () => {
    const s = runResolvedEnter([SBT4a, SBT4b], ['v1', 'v3'], (st) => {
      st.players.self.scene = [sceneChar('B09010', 'kasa#1'), sceneChar(SBT3, 'v1'), sceneChar(SBT3, 'v2'), sceneChar(SBT3, 'v3'), sceneChar(SBT3, 'v4')];
      st.players.self.remove = [SBT4a, SBT4b];
    });
    expect(s.players.self.scene.length, 'scene=5').toBe(5);
    expect(s.players.self.scene.some((c) => c.uid === 'v1' || c.uid === 'v3'), 'victim 2体離場').toBe(false);
    expect(s.players.self.scene.filter((c) => c.cardId === SBT4a || c.cardId === SBT4b).length, '2体登場').toBe(2);
  });
  it('§h 阿笠自身を victim に指定 → 離場 (登場キャラは victim list に無い)', () => {
    const s = runResolvedEnter([SBT4a, SBT4b], ['kasa#1', 'v1'], (st) => {
      st.players.self.scene = [sceneChar('B09010', 'kasa#1'), sceneChar(SBT3, 'v1'), sceneChar(SBT3, 'v2'), sceneChar(SBT3, 'v3'), sceneChar(SBT3, 'v4')];
      st.players.self.remove = [SBT4a, SBT4b];
    });
    expect(s.players.self.scene.some((c) => c.uid === 'kasa#1'), '阿笠自身が switch で離場').toBe(false);
  });
});

describe('cluster14 §e — full + victim 無 (AI) → per-card skip (throw 無)', () => {
  it('現場満杯で AI が victim を持たない → 登場 0 (crash しない)', () => {
    const s = runAbility('B09010', 'a1', (st) => {
      st.players.self.scene = [sceneChar('B09010', 'kasa#1'), sceneChar(SBT3, 'x1'), sceneChar(SBT3, 'x2'), sceneChar(SBT3, 'x3'), sceneChar(SBT3, 'x4')];
      st.players.self.remove = [SBT4a, SBT4b];
      st.players.self.file = [FB, FB];
    });
    expect(s.players.self.scene.length, 'scene=5 維持 (登場できず)').toBe(5);
    expect(s.players.self.scene.filter((c) => c.cardId === SBT4a || c.cardId === SBT4b).length, '0体登場').toBe(0);
    expect(s.players.self.file.length, 'FILE上1リムーブは実行').toBe(1);
  });
});

describe('cluster14 §f — AI distinctNames dedup (rules/19)', () => {
  it('同名2 + 別名1 → 別名2体 (同名は1体のみ)', () => {
    const s = runAbility('B09010', 'a1', (st) => {
      st.players.self.scene = [sceneChar('B09010', 'kasa#1')];
      st.players.self.remove = [SBT4a, SBT4a2, SBT4b]; // SBT4a と SBT4a2 は同名「歩」
      st.players.self.file = [FB, FB];
    });
    const enteredNames = s.players.self.scene.filter((c) => c.cardId !== 'B09010').map((c) => def.card(c.cardId)!.names[0]);
    expect(enteredNames.length, '2体登場').toBe(2);
    expect(new Set(enteredNames).size, 'カード名は相異 (歩/光彦)').toBe(2);
  });
});

describe('cluster14 §g — 0枚 decline でも FILE上1リムーブ (skipResolvesAtom)', () => {
  it('remove に有効候補無 → 0体登場だが file -1', () => {
    const s = runAbility('B09010', 'a1', (st) => {
      st.players.self.scene = [sceneChar('B09010', 'kasa#1')];
      st.players.self.remove = [SBT3]; // Lv3 のみ = Lv4 EXACT 非対象 → 候補 0
      st.players.self.file = [FB, FB];
    });
    expect(s.players.self.scene.filter((c) => c.cardId !== 'B09010').length, '0体登場').toBe(0);
    expect(s.players.self.file.length, 'FILE上1リムーブは実行 (skipResolvesAtom)').toBe(1);
  });
});

describe('cluster14 §i — exact(Lv4) vs ≤(Lv4以下) level filter', () => {
  it('B09010 (Lv4 EXACT) は Lv3[少年探偵団] を登場させない', () => {
    const s = runAbility('B09010', 'a1', (st) => {
      st.players.self.scene = [sceneChar('B09010', 'kasa#1')];
      st.players.self.remove = [SBT3]; // Lv3 のみ
      st.players.self.file = [FB, FB];
    });
    expect(s.players.self.scene.some((c) => c.cardId === SBT3), 'Lv3 は非対象').toBe(false);
  });
  it('PR042 (Lv4以下) は Lv3[少年探偵団] を登場させる', () => {
    const s = runAbility('PR042', 'a1', (st) => {
      st.players.self.scene = [sceneChar('PR042', 'sonoko#1')];
      st.players.self.hand = ['DUMMYHAND'];
      st.players.self.remove = [SBT3]; // Lv3
    });
    expect(s.players.self.scene.some((c) => c.cardId === SBT3), 'Lv3 ≤4 は対象').toBe(true);
  });
});

describe('cluster14 §j — 疾風N enterOrderThisTurn は per-card 加算', () => {
  it('2体の enterOrderThisTurn が連番 (batch でなく per-card emit)', () => {
    const s = runAbility('B09010', 'a1', (st) => {
      st.players.self.scene = [sceneChar('B09010', 'kasa#1')];
      st.players.self.remove = [SBT4a, SBT4b];
      st.players.self.file = [FB, FB];
    });
    const orders = s.players.self.scene.filter((c) => c.cardId === SBT4a || c.cardId === SBT4b).map((c) => c.enterOrderThisTurn).sort();
    expect(orders.length).toBe(2);
    expect(orders[1]! - orders[0]!, 'per-card emit で 1 枚ずつ加算').toBe(1);
  });
});

describe('cluster14 §k — 構造: 4 printings 登録', () => {
  it('B09010/B09010P/PR042/PR046 が登録済', () => {
    for (const id of ['B09010', 'B09010P', 'PR042', 'PR046']) {
      expect(def.card(id), `${id} 登録`).toBeTruthy();
    }
  });
});
