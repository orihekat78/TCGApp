// ReservedEffectEntry — 離場後予約効果 (mega-wave W6 step8, 2026-07-04, row75)
//
// rules: 15-abilities-effects.md §未解決効果, 21-declared-ability-cost.md (コストで自身が離場)
//
// 背景: listeners/triggered.ts の in-play scan (collectCardsInPlay = scene/partner-area/case/hand)
// は「発動源カードが盤面に居る」前提。コストで自身をデッキ下へ移す宣言能力 (B08069 風見裕也
// 「〚デッキの下に移す〛：ターン終了時、〜登場させる」) や、使用と同時にリムーブへ行くイベントの
// 「このターン中、次に〜したとき」(B01058 トッ 第2句) は、後で効果を発火すべき時点で源カードが
// どこにも scan されない。→ GameState 常駐の遅延効果 queue (カード位置非依存) が必要。
// pendingEffects は同一解決ループ内で drain される (turn-crossing hold なし) ため別物。
//
// 発火 (listeners/reserved-effects.ts):
//   - mode 'turn-end': arm した同ターンの phase:end:start (player 一致) で無条件発火 (B08069)
//   - mode 'next-match': arm した同ターン中、hook 一致 + condition (evalCond) 成立の最初の 1 回
//     で発火 (B01058)。未消費は flow/turn.ts endTurn が失効させる
// いずれも single-fire (発火時に splice)。JSON-serializable 制約 (kind:'custom' closure 禁止) は
// pendingEffects と同じだが、こちらは GameState 永続 field なので将来の save/replay でも直列化対象。

import type { Condition, Effect } from './effect.js';
import type { EffectStackEntrySource } from './effect-stack.js';

export type ReservedEffectTrigger = {
  /** 発火 hook 名 (listeners/reserved-effects.ts が listen している hook のみ有効) */
  hook: string;
  mode: 'turn-end' | 'next-match';
  /** arm した側 (絶対 side)。turn-end は payload.player 一致判定、next-match は condition ctx の source.player になる */
  player: 'self' | 'opp';
  /** arm 時の turn.number。同ターン内のみ発火 (turn-crossing しない) */
  armedTurn: number;
  /** next-match 用の追加 gate (例: {kind:'triggerPlayerIs', side:'opp'})。turn-end では未使用 */
  condition?: Condition;
};

export type ReservedEffectEntry = {
  id: string;
  trigger: ReservedEffectTrigger;
  effect: Effect;
  /** arm 時の source snapshot (発火時の EffectCtx.source を復元する — カードは既に離場していてよい) */
  source: EffectStackEntrySource;
};
