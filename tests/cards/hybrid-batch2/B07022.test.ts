// CARD PHASE hybrid-batch2 probe — B07022 沖田総司 (character, engine変更0)
//
// 公式テキスト (印字 = ground truth):
//   【登場時】手札から〚特徴［高校生］〛のキャラを1枚公開してもよい。そうした場合、ターン終了時まで
//   このキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。この効果によって【緑】以外の
//   色を持つキャラを公開した場合、ターン終了時までこのキャラをAP＋1000する。
//
// novel 句 (compiler refusedLine): 上記 effect 全体。DSL =
//   a1 triggered{enter, selfOnly} → chain[
//     handReveal(n:1, filter{trait:高校生,kind:character}, bind:$revealed),   // 「1枚公開してもよい」
//     charGrantKeyword($self, 突撃, turn),                                     // 「そうした場合〜突撃」
//     conditional{ boundMatchesFilter($revealed, colorNot:緑) → charModifyAP($self,+1000,turn) } // 「【緑】以外の色…AP+1000」
//   ]
//
// 検証面 (全 novel 経路を production dispatch = 実 enter emit + reveal pick drain で実測):
//   - handReveal n:1 = 「1枚公開してもよい」の shipped idiom (B09061 exemplar と同型)。
//     forced-reveal は無害 (公開=zone 不変、公式Q&A)。候補=1 枚のとき pick は sole 候補に確定するので
//     公開色を deterministic に制御でき、色分岐 (AP+1000) を pin できる。
//   - chainStepNoApply gate (core.ts:150 availN<n → gate-skip): 手札に 高校生 が 0 枚なら chain break
//     → 突撃も AP も付かない (resolver.ts:102 で以降全 step skip = 「そうした場合」gate)。
//   - boundMatchesFilter{colorNot:緑} (cond/eval.ts:471, some説): 緑単色 revealed → 除外 → AP 無し /
//     非緑 revealed → 一致 → AP+1000。
//   - decoy (BUG-117/118): 手札の非高校生カードは reveal 候補に入らない。緑非高校生 decoy を混ぜても
//     revealed=白高校生 のままなので AP 6000 = 白が公開された証左 (trait filter が decoy を除外)。
//   - negative: 高校生不在 → gate → 突撃/AP なし。
//
// BUG-174 owner='opp' pin: 本カードは reveal=自手札 / grant・AP=$self(自キャラ) のみで相手側 target を
//   一切持たない (cross-side pick が構造的に存在しない) ため owner=opp ケースは N/A。
//
// rules: 05, 07, 13 (突撃), 15 (してもよい/そうした場合), 17 (登場時)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { char as readChar } from '@/engine/read/char';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, CardDef } from '@/engine/types';

import { B07022 } from '@/cards/ct-p07/B07022';

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const FIXTURES: CardDef[] = [
  def('FILL'),
  def('KOKG', { colors: ['緑'], traits: ['高校生'] }),   // 緑 高校生 → 公開しても AP 無し
  def('KOKW', { colors: ['白'], traits: ['高校生'] }),   // 白 高校生 → 公開すると AP+1000
  def('KOKB', { colors: ['青'], traits: ['高校生'] }),   // 青 高校生 (非緑) 別色
  def('GDECOY', { colors: ['緑'] }),                     // 緑・非高校生 decoy (trait filter 外)
  def('PLAINX', { colors: ['赤'] }),                     // 非高校生 decoy
];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  s.players.opp.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  for (const d of [B07022, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

// production dispatch: 実 enter emit で triggered a1 を発火 → reveal pick を AI drain で解決。
// (B03098 test の enter emit 慣行 + B09061 の handReveal pick drain 慣行)
function play(hand: string[]): GameState {
  const s = base();
  s.players.self.hand = [...hand];
  return produce(s, (d) => {
    const c = mutateAll.scene.enter(d, 'self', 'B07022', {});
    event.emit(d, 'enter',
      { uid: c.uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 },
      { player: 'self', cardId: 'B07022', uid: c.uid });
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);   // handReveal (forced n:1) pick → sole 候補に確定、continuation(grant+conditional) 実行
    runAllUntilEmpty(d);
  });
}

const uidOf = (s: GameState) => s.players.self.scene.find(c => c.cardId === 'B07022')!.uid;

describe('B07022 a1 — 【登場時】高校生公開 → 突撃 + (非緑なら) AP+1000', () => {
  it('緑 高校生を公開 → 突撃 付与 / AP 加算なし (base 5000)', () => {
    const after = play(['KOKG', 'FILL']);
    const u = uidOf(after);
    expect(readChar.hasKeyword(after, u, '突撃'), '公開成立 → 突撃').toBe(true);
    expect(readChar.ap(after, u), '緑公開 → colorNot緑 不一致 → +1000 なし').toBe(5000);
  });

  it('白 高校生を公開 → 突撃 + AP+1000 (5000→6000)', () => {
    const after = play(['KOKW', 'FILL']);
    const u = uidOf(after);
    expect(readChar.hasKeyword(after, u, '突撃')).toBe(true);
    expect(readChar.ap(after, u), '非緑公開 → AP+1000').toBe(6000);
  });

  it('青 高校生を公開 → 非緑ゆえ AP+1000 (別色でも「緑以外」判定)', () => {
    const after = play(['KOKB', 'FILL']);
    const u = uidOf(after);
    expect(readChar.hasKeyword(after, u, '突撃')).toBe(true);
    expect(readChar.ap(after, u)).toBe(6000);
  });

  it('decoy: 白高校生 + 緑非高校生 → 緑decoyは候補外、公開=白ゆえ AP 6000 (BUG-117/118)', () => {
    // GDECOY(緑,非高校生) が誤って reveal 候補に入ると sole 候補でなくなる。trait filter が
    // GDECOY を除外し KOKW(白) が確定公開 → colorNot緑 一致 → 6000 が「白が公開された」証左。
    const after = play(['KOKW', 'GDECOY']);
    const u = uidOf(after);
    expect(readChar.hasKeyword(after, u, '突撃')).toBe(true);
    expect(readChar.ap(after, u), '緑decoy 混入せず 白公開 → +1000').toBe(6000);
  });

  it('negative: 手札に高校生なし → gate (chainStepNoApply) → 突撃なし / AP 5000', () => {
    const after = play(['GDECOY', 'PLAINX', 'FILL']);
    const u = uidOf(after);
    expect(readChar.hasKeyword(after, u, '突撃'), '高校生不在 → 公開不可 → 突撃も付かない').toBe(false);
    expect(readChar.ap(after, u), 'chain break → AP 加算なし').toBe(5000);
  });

  it('negative: 手札 0 枚 → gate → 突撃なし / AP 5000', () => {
    const after = play([]);
    const u = uidOf(after);
    expect(readChar.hasKeyword(after, u, '突撃')).toBe(false);
    expect(readChar.ap(after, u)).toBe(5000);
  });
});
