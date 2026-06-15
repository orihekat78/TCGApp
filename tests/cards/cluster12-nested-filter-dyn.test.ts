// cluster12 — nested-filter-dyn (FILE-level enter events) の挙動テスト。
// engine拡張 wave#2 cluster12 (2026-06-15): resolve-picks.substituteAtomPick で pick query.filter 内の
// {dyn}(levelMax:{dyn:'$self.fileCount'}) を targetCandidates 列挙前に具体値へ解決する変更を実証する。
//
// 検証 (実 engine 経路 runEffect → pick drain で駆動。非MVP のため smoke では踏めない = 専用テスト必須):
//   §1 cap が **発火する** — FILE枚数を超えるレベルのキャラは登場できない (旧: 未解決 {dyn} で `level > {object}`
//      = 常に false = レベル上限が黙って消える誤挙動。登場「しない」ことが dyn 解決の証跡)。
//   §2 境界 inclusive — レベル == FILE枚数 は登場可。
//   §3 動的 — 同じ手札でも FILE枚数で可否が変わる (= constant ではなく live fileCount を読む)。
//   §4 色 filter (B04013 は【青】) / §5 B08060 は色指定なし (任意色) + cap。
//   §6 B08060 reveal-until-level7 (必須 add) + 条件 discard。
//   §7 構造 — 15 printings 登録 + trigger 形。
// rules: 14, 15, 17 §FILE(X), 20, 26-qa-deck-refresh.md

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
import { B04013 } from '@/cards/ct-p04/B04013';
import { B08060 } from '@/cards/ct-p08/B08060';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// synthetic hand / deck targets
const BL5 = 'BL5'; // 青 Lv5
const BL3 = 'BL3'; // 青 Lv3
const GR1 = 'GR1'; // 緑 Lv1
const AN4 = 'AN4'; // 赤 Lv4 (色フリー検証用)
const ZD = ['ZD1', 'ZD2', 'ZD3']; // 緑 (deck-look が【青】を拾わない decoy)
const NL3 = 'NL3'; // Lv3 (非Lv7)
const L7C = 'L7C'; // Lv7 (reveal-until 対象)
const NL2 = 'NL2'; // Lv2 (非Lv7)
const SPARE = 'SPARE'; // discard 用の余り手札

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerAll(); // cluster12 cards (B04013/B08060/...) 込み
  registerCardDef(ch(BL5, { colors: ['青'], level: 5 }));
  registerCardDef(ch(BL3, { colors: ['青'], level: 3 }));
  registerCardDef(ch(GR1, { colors: ['緑'], level: 1 }));
  registerCardDef(ch(AN4, { colors: ['赤'], level: 4 }));
  for (const z of ZD) registerCardDef(ch(z, { colors: ['緑'], level: 2 }));
  registerCardDef(ch(NL3, { colors: ['黒'], level: 3 }));
  registerCardDef(ch(L7C, { colors: ['黒'], level: 7 }));
  registerCardDef(ch(NL2, { colors: ['黒'], level: 2 }));
  registerCardDef(ch(SPARE, { colors: ['黒'], level: 9 })); // Lv9 = §6 の sceneEnter cap(<=FILE)を超え、最終登場に巻き込まれない
  registerTriggeredListener();
});

function turnSelf(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

/** event の a1 効果を実 engine 経路で駆動し pick を AI 解決して drain しきる。 */
function runEventA1(cardId: string, mutateBoard: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  turnSelf(s);
  mutateBoard(s);
  const cdef = def.card(cardId);
  const a1 = cdef!.abilities.find((a) => a.id === 'a1')!;
  s = produce(s, (d) => {
    const ctx = { source: { player: 'self', cardId, uid: 'ev#1', abilityId: 'a1', area: 'hand' }, bindings: {} } as unknown as EffectCtx;
    runEffect(d, a1.effect as never, ctx);
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    }
  });
  return s;
}

const inScene = (s: GameState, cardId: string) => s.players.self.scene.some((c) => c.cardId === cardId);
const inHand = (s: GameState, cardId: string) => s.players.self.hand.includes(cardId);

describe('cluster12 §1 — FILE-level cap が発火する (dyn 解決の証跡, B04013)', () => {
  it('FILE 1枚 → 青Lv5 は登場できない (Lv5 > 1 = cap)。未解決 {dyn} なら登場してしまう', () => {
    const s = runEventA1('B04013', (st) => {
      st.players.self.file = [FB];
      st.players.self.hand = [BL5];
      st.players.self.deck = [...ZD];
    });
    expect(inScene(s, BL5), '青Lv5 は FILE1 では登場しない (cap 発火)').toBe(false);
    expect(inHand(s, BL5), '登場しなかった BL5 は手札に残る').toBe(true);
  });
});

describe('cluster12 §2 — 境界 inclusive (レベル == FILE枚数 は登場可, B04013)', () => {
  it('FILE 3枚 → 青Lv3 は登場する (Lv3 <= 3)', () => {
    const s = runEventA1('B04013', (st) => {
      st.players.self.file = [FB, FB, FB];
      st.players.self.hand = [BL3];
      st.players.self.deck = [...ZD];
    });
    expect(inScene(s, BL3), '青Lv3 は FILE3 で登場 (境界 inclusive)').toBe(true);
  });
});

describe('cluster12 §3 — 動的: 同じ手札でも FILE枚数で可否が変わる (live fileCount, B04013)', () => {
  it('FILE 5枚 → 青Lv5 は登場する (§1 と同手札・FILE だけ変えて逆転)', () => {
    const s = runEventA1('B04013', (st) => {
      st.players.self.file = [FB, FB, FB, FB, FB];
      st.players.self.hand = [BL5];
      st.players.self.deck = [...ZD];
    });
    expect(inScene(s, BL5), '青Lv5 は FILE5 で登場する (cap=fileCount を動的に読む)').toBe(true);
  });
});

describe('cluster12 §4 — 色 filter (B04013 は【青】のみ)', () => {
  it('FILE 5枚でも 緑Lv1 は登場しない (色不一致)', () => {
    const s = runEventA1('B04013', (st) => {
      st.players.self.file = [FB, FB, FB, FB, FB];
      st.players.self.hand = [GR1];
      st.players.self.deck = [...ZD];
    });
    expect(inScene(s, GR1), '緑Lv1 は【青】filter で登場不可').toBe(false);
  });
});

describe('cluster12 §5 — B08060 は色指定なし (任意色) + cap', () => {
  it('FILE 5枚 → 赤Lv4 が登場 (色フリー) / FILE 2枚 → 赤Lv4 は登場しない (cap)', () => {
    const enter = runEventA1('B08060', (st) => {
      st.players.self.file = [FB, FB, FB, FB, FB];
      st.players.self.hand = [AN4];
      st.players.self.deck = [...ZD]; // Lv7 不在 → reveal で何も加えない
    });
    expect(inScene(enter, AN4), '赤Lv4 は色指定なし B08060 で FILE5 登場').toBe(true);

    const capped = runEventA1('B08060', (st) => {
      st.players.self.file = [FB, FB];
      st.players.self.hand = [AN4];
      st.players.self.deck = [...ZD];
    });
    expect(inScene(capped, AN4), '赤Lv4 は FILE2 では cap で登場不可').toBe(false);
  });
});

describe('cluster12 §6 — B08060 reveal-until-level7 (必須 add) + 条件 discard', () => {
  it('デッキに Lv7 あり → Lv7 を必ず手札へ (deck から抜ける) + 残りデッキ下 + 手札1枚 discard', () => {
    const s = runEventA1('B08060', (st) => {
      st.players.self.file = [FB, FB, FB, FB, FB];
      st.players.self.hand = [SPARE]; // discard 対象 (Lv7 add 後に 1枚 remove)
      st.players.self.deck = [NL3, L7C, NL2]; // 上から: NL3(非Lv7)→L7C(Lv7=match,stop)
    });
    expect(s.players.self.deck.includes(L7C), 'Lv7 の L7C は手札に加えられデッキから抜ける').toBe(false);
    // 手札に加えた → discard 1 が発火。SPARE か L7C のどちらか 1枚が remove (合計手札 = 開始1 + add1 - discard1 = 1)
    expect(s.players.self.hand.length, 'add1 - discard1 で手札枚数は開始と同じ (1)').toBe(1);
    expect(s.players.self.remove.length, 'discard で 1枚 remove された').toBeGreaterThanOrEqual(1);
  });

  it('デッキに Lv7 なし → 何も加えず discard も無し (全公開→デッキ下)', () => {
    const s = runEventA1('B08060', (st) => {
      st.players.self.file = [FB, FB, FB, FB, FB];
      st.players.self.hand = [SPARE];
      st.players.self.deck = [NL3, NL2]; // Lv7 不在
    });
    expect(s.players.self.hand.length, 'Lv7 不在なら add 無し → discard 無し (手札不変)').toBe(1);
    expect(inHand(s, SPARE), 'SPARE は discard されず手札に残る').toBe(true);
  });
});

describe('cluster12 §7 — 構造 (15 printings 登録 + trigger 形)', () => {
  it('15 printings すべて登録済 + a1 = effect:declared selfOnly event-use', () => {
    const ids = ['D01014', 'B04013', 'D02014', 'B04026', 'D03014', 'B04040', 'D04014', 'B04061', 'D05014', 'B04083', 'D07023', 'B03132', 'B03132P', 'B08060', 'B08060P'];
    for (const id of ids) {
      const cdef = def.card(id);
      expect(cdef, `${id} 登録済`).toBeTruthy();
      expect(cdef!.kind).toBe('event');
      expect(cdef!.abilities[0].trigger?.hook).toBe('effect:declared');
      expect(cdef!.abilities[0].trigger?.selfOnly).toBe(true);
    }
    expect(B04013.colors).toEqual(['青']);
    expect(B08060.abilities.length, 'B08060 は a1 + ヒラメキ a2').toBe(2);
  });
});
