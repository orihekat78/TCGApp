// src/ui/state/interactionLock — 効果解決中の入力ロック判定
// rules: 05-turn-phases.md §割り込み禁止 (他の行動中や効果解決中は次の行動に移れない)、
//        15-abilities-effects.md §未解決効果。
//
// カード効果の解決中、または人間の未解決 decision (pick/choice/optional/hirameki/misread/deck-reveal)
// 待ち中は、新しいメインアクション (推理/アクション/手札使用/ネクストヒント/宣言/アシスト/事件解決) を
// 開始できない。decision を解決する modal/overlay 自体や、盤面/手札の pick クリックはロック対象外
// (それは「割り込み」でなく必要入力)。本 flag は ActionsPanel の main action 起点のみを塞ぐ。

import type { GameStateStore } from './store';
import { selectAutonomousDecisionBlocked } from './autonomousDecisionGate';

type LockSlice = Pick<GameStateStore, 'gameState'>
  & Parameters<typeof selectAutonomousDecisionBlocked>[0];

type AutonomousDecisionSlice = Parameters<typeof selectAutonomousDecisionBlocked>[0];

export function selectInteractionLocked(s: LockSlice): boolean {
  // BUG-173 (2026-07-04, step12 batch2 playwright 検出): pendingEffects は resolved/cancelled entry を
  // prune せず累積する (resolve/stack.ts 設計、BUG-151 と同根) — length>0 判定だと最初の効果解決後
  // パネルが永久ロックされる (B01058 手札使用→以降 main action 不可を実機で踏んだ)。
  // TopBar の効果スタック表示と同じ state フィルタ (pending|resolving のみ) で判定する。
  return (
    (s.gameState?.pendingEffects.some((e) => e.state === 'pending' || e.state === 'resolving') ?? false)
    || selectAutonomousDecisionBlocked(s)
  );
}

/**
 * Scene switch is a child decision of an effect pick/choice or a Hirameki
 * resolution. A deck reveal may also remain as the presentation parent of a
 * deck choice that resumes into scene entry. Those parent nodes may remain
 * present while its board picker is active. Any other decision owns
 * interaction and suspends the picker.
 */
export function selectSwitchVictimBlocked(s: AutonomousDecisionSlice): boolean {
  return selectAutonomousDecisionBlocked({
    ...s,
    pendingEffectPick: null,
    pendingEffectChoice: null,
    pendingHirameki: null,
    pendingDeckReveal: null,
  });
}
