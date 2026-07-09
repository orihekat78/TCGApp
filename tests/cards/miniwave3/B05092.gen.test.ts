// tests/cards/miniwave3/B05092 — HAND-WRITTEN probe (旧 gen 版を差し替え。再生成禁止)
// ★2026-07-10 更新: 下記ヘッダの MANUAL-NOTE(BUG) 記述は authoring 時の short-form 挙動の記録 (歴史)。
//   shipped カードは cardIds contract (+B05092 は shuffleThenDrawMoved 単一 atom) に修正済みで、
//   本文の test は修正後挙動 (multi 移動 / draw=移動数) を assert している。
//
// なぜ hand-written か: 旧 gen 版は script/expect が空の vacuous scenario (何も検証していなかった)。
//   本カードの検証には (1) デッキ下への **picked 順** 保持と (2) 「移した枚数と同じ数を引く」draw を
//   観測する必要があり、ProbeScenario 語彙では表現できない (deck 順序 assert 不可 / shuffle 非決定)。
//   deckShuffle を決定化するため Math.random を identity 化 (rng=()=>~1 で Fisher-Yates が無交換) して駆動する。
//   production 経路 (enter emit → a1【登場時】) で駆動。engine / src/cards は変更しない (probe のみ)。
//
// 対象: B05092 諸伏景光 (character) a1【登場時】
//   sequence[ handToDeckBottom(手札を4枚まで pick して picked 順でデッキ下へ, bind $moved)
//           → deckShuffle
//           → draw n={dyn:'$bound.$moved.count'} (移した枚数と同じ数を引く) ]
//
// ★MANUAL-NOTE(BUG, 要 card 修正): draw の枚数が常に 0 になる。原因 = a1 の handToDeckBottom が **短縮形**
//   ({player,max:4,bind:'$moved'}) で authoring されているが、短縮形 pick の解決 atom が bind を書き込む ctx と、
//   continuation (deckShuffle/draw) が dyn を評価する ctx が **別オブジェクト** になり、$bound.$moved.count が
//   空 binding を読んで 0 になる (実測: 書込 ctx≠読取 ctx、読取側 bindings=[])。→ 「移した枚数と同じ数引く」が死ぬ。
//   正しい authoring は B08028 (mega-wave W5 exemplar) と同じ **明示 multi-pick contract**
//   ({ cardIds:'$pick.cardIds', target:{kind:'pick',query:{area:'hand',…},n:{min:0,max:4},chooser:'self'},
//   bind:'$moved' }) を使うこと (cardIds 形は bind が continuation ctx に伝播する)。
//   本 probe は「move + picked 順は正しいが draw は 0」= 現状の実挙動を pin する (parent が card DSL を修正したら
//   positive の hand/deck サイズ assert を『draw 3 = hand 5 / deck 6』へ更新すること)。
// rules: 02/07/11/14/15/17

import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  _drainPendingEffectPickSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { B05092 } from '@/cards/ct-p05/B05092';
import type { CardDef, GameState } from '@/engine/types';

function charDef(id: string): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黒'], level: 1, ap: 2000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const DECK = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
const HAND = ['H1', 'H2', 'H3', 'H4', 'H5'];

function setHuman(s: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B05092);
  for (const id of [...DECK, ...HAND]) registerCardDef(charDef(id));
  registerTriggeredListener();
  setHuman('self');
});

function board(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = [...DECK];
  s.players.self.hand = [...HAND];
  return s;
}

function enterB05092(s: GameState): void {
  const e = mutate.scene.enter(s, 'self', 'B05092', {});
  event.emit(
    s,
    'enter',
    { uid: e.uid, viaEffect: true, enterOrder: e.enterOrder, enterOrderThisTurn: e.enterOrderThisTurn },
    { player: 'self', uid: e.uid, cardId: 'B05092' },
  );
  runAllUntilEmpty(s);
}

// deckShuffle を identity 化 (rng≈1 → Fisher-Yates j=i で無交換) して continuation を決定的に観測する。
function withIdentityShuffle<T>(fn: () => T): T {
  const orig = Math.random;
  Math.random = () => 0.9999999999;
  try { return fn(); } finally { Math.random = orig; }
}

describe('B05092 諸伏景光 a1【登場時】handToDeckBottom(picked順) → deckShuffle → draw(=移した枚数)', () => {
  it('positive: 手札3枚を H3,H1,H4 の順で pick → デッキ下に picked順で並ぶ / draw は現状 0 (下記 MANUAL-NOTE)', () => {
    withIdentityShuffle(() => {
      const s = board();
      enterB05092(s);
      const pick = _drainPendingEffectPickSide();
      expect(pick?.atomVerb, 'handToDeckBottom pick surface').toBe('handToDeckBottom');
      const cands = (pick!.candidates as Array<{ uid: string; cardId: string }>);
      expect(cands.map((c) => c.cardId).sort(), '手札5枚が候補').toEqual([...HAND].sort());
      // H3,H1,H4 の順で選択 (picked 順 = デッキ下の並び)
      const uids = ['H3', 'H1', 'H4'].map((cid) => cands.find((c) => c.cardId === cid)!.uid);
      applyPickAndContinuation(s, pick!, uids[0]!, uids);
      runAllUntilEmpty(s);

      // ① デッキ下 (末尾) に picked 順で並ぶ (identity shuffle ゆえ順序保存、draw が top から取る)
      const deck = s.players.self.deck;
      expect(deck.slice(-3), 'デッキ下3枚 = picked 順 [H3,H1,H4]').toEqual(['H3', 'H1', 'H4']);
      // ② 選んだ3枚は手札から抜けた
      for (const h of ['H3', 'H1', 'H4']) expect(s.players.self.hand, `${h} は手札から移動`).not.toContain(h);

      // 「移した枚数と同じ数のカードを引く」= cardIds contract 修正後、bind が継続 ctx へ届き draw 3。
      expect(s.players.self.hand.length, '手札 = 残 2 + draw 3 = 5').toBe(5);
      expect(s.players.self.deck.length, 'デッキ = 6+3 移動 - 3 draw = 6').toBe(6);
    });
  });

  it('negative: 0枚選択 (skip) → 移動なし・draw 0 → 手札/デッキ 不変', () => {
    withIdentityShuffle(() => {
      const s = board();
      enterB05092(s);
      const pick = _drainPendingEffectPickSide();
      expect(pick?.atomVerb, 'handToDeckBottom pick surface').toBe('handToDeckBottom');
      applyPickSkipAndContinuation(s, pick!, false); // 0枚 (「4枚まで」= 0 可, rules/15)
      runAllUntilEmpty(s);
      // 移動0 → $moved 未束縛 → draw n=0。identity shuffle ゆえデッキ順も保存。
      expect(s.players.self.deck, 'デッキ不変 [D1..D6]').toEqual([...DECK]);
      expect(s.players.self.hand, '手札不変 [H1..H5]').toEqual([...HAND]);
      // draw 0 の非空検証: デッキ由来の D* は 1 枚も手札に来ない
      expect(s.players.self.hand.some((c) => c.startsWith('D')), 'draw 0 → D* は手札に来ない').toBe(false);
    });
  });
});
