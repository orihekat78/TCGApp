// Phase 8 完全クローズ Commit 2: ContactFlowDriver
//
// rules: 07-action-flow.md / 08-contact.md / 09-cutin-disguise.md / 10-action-event.md /
//        22-qa-action-contact.md / 23-qa-disguise-cutin.md / 24-qa-naming-stun.md
// spec: 計画 — Per-Step Action Dispatch + ContactFlowDriver
//
// 役割:
//   - useGameStateStore.activeActionId と gameState を監視
//   - flow.action._getContext で ActionContext.phase を読み、phase ごとに:
//       declared / leave-resolution / contact-pending / contact-end → 即 advance
//       guard-window → defender=self なら GuardPickerModal open / opp なら AI
//       action-1 / action-2 / action-1-redo → 1番目/2番目 が self なら
//         CutInDisguisePickerModal open / opp なら AI
//       judge → actionJudge + actionAdvance を 2 連発 (snapshot + judge + contact-end へ)
//       action-end → activeActionId クリア
//   - 単一 useEffect で 1 phase 1 dispatch (まれに 2 dispatch) → re-render → 次の effect
//
// 設計上の注意:
//   - ActionContext は module-level Map (state-machine.ts) に保持。effect deps には
//     gameState (Zustand) と activeActionId を渡し、phase 変化が log emit 等で
//     state 変化を伴うことに依存して再走させる。
//   - modal-open phase では dispatchEngineAction を呼ばずモーダル state のみ更新。
//     ユーザー操作時に Playmat 側のモーダルハンドラが直接 dispatch する。

import { useEffect } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { useContactModalStore } from './useContactModalStore.js';
import { dispatchEngineAction, type ContactChoice } from './useEngineDispatch.js';
import * as flow from '@/engine/flow/index.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import { def as readDef } from '@/engine/read/def.js';
import type { GameState, ActionContext } from '@/engine/types/index.js';
import type { GuardPickerCandidate } from '../components/GuardPickerModal.js';
import type { CutInDisguiseCandidate } from '../components/CutInDisguisePickerModal.js';

type Player = 'self' | 'opp';

function ownerOfUid(state: GameState, uid: string): Player | null {
  if (uid === 'partner:self') return 'self';
  if (uid === 'partner:opp') return 'opp';
  for (const p of ['self', 'opp'] as const) {
    if (state.players[p].scene.some((c) => c.uid === uid)) return p;
  }
  return null;
}

function readApLp(state: GameState, uid: string): { ap: number; lp: number; cardId: string; name: string } {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p: Player = uid === 'partner:self' ? 'self' : 'opp';
    const cardId = state.players[p].partner.cardId ?? '';
    const def = cardId ? readDef.card(cardId) : null;
    return { ap: def?.ap ?? 0, lp: def?.lp ?? 0, cardId, name: def?.names?.[0] ??cardId };
  }
  for (const p of ['self', 'opp'] as const) {
    const c = state.players[p].scene.find((x) => x.uid === uid);
    if (c) {
      const def = readDef.card(c.cardId);
      return { ap: def?.ap ?? 0, lp: def?.lp ?? 0, cardId: c.cardId, name: def?.names?.[0] ??c.cardId };
    }
  }
  return { ap: 0, lp: 0, cardId: '', name: uid };
}

function buildGuardCandidates(
  state: GameState,
  byUid: string,
  excludeUid?: string, // Task D E4: アクション対象自身は除外 (B09028/B09054 Q&A)
): GuardPickerCandidate[] {
  return flow.guard.candidates(state, byUid, excludeUid).map((c) => {
    const { ap, lp, name } = readApLp(state, c.uid);
    return { uid: c.uid, cardId: c.cardId, name, ap, lp };
  });
}

function buildCutInDisguiseCandidates(
  state: GameState,
  ax: ActionContext,
  p: Player,
): CutInDisguiseCandidate[] {
  const hand = state.players[p].hand;
  const result: CutInDisguiseCandidate[] = [];
  for (const cardId of hand) {
    const def = readDef.card(cardId);
    const name = def?.names?.[0] ??cardId;
    if (flow.contact.canCutIn(state, ax, p, cardId)) {
      result.push({ cardId, name, kind: 'cutin' });
    }
    if (flow.contact.canDisguise(state, ax, p, cardId)) {
      result.push({ cardId, name, kind: 'disguise' });
    }
  }
  return result;
}

function actorLabelFor(phase: ActionContext['phase']): '1番目' | '2番目' | '1番目 (再行動)' {
  if (phase === 'action-2') return '2番目';
  if (phase === 'action-1-redo') return '1番目 (再行動)';
  return '1番目';
}

/**
 * Phase 8 完全クローズ Commit 2: ContactFlowDriver。
 * Playmat 等の root component で 1 度だけ呼ぶ。
 */
export function useContactFlowDriver(): void {
  const activeActionId = useGameStateStore((s) => s.activeActionId);
  const gameState = useGameStateStore((s) => s.gameState);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const guardPickerOpen = useContactModalStore((s) => s.guardPicker !== null);
  const cutInDisguiseOpen = useContactModalStore((s) => s.cutInDisguise !== null);
  // D11007 a3 fix: 「コンタクトしたとき」効果 (rules/22) は action-1 (カットイン window) より
  // 先に解決すべき。contact:start で queue された pendingEffectPick が解決されるまで
  // contact flow を pause する。
  const pendingEffectPick = useGameStateStore((s) => s.pendingEffectPick);
  // engine拡張 wave#2 cluster3 (2026-06-13, BUG-141): optional/choice modal も同様に pause 対象。
  // 宣言時 trigger の optional (例 B02068 granted「手札を1枚リムーブしてもよい→ブレット」) が解決される
  // 前に driver が guard へ進むと、公式裁定「効果もガード判定前に解決」(rules/22 R1) に違反する。
  const pendingEffectOptional = useGameStateStore((s) => s.pendingEffectOptional);
  const pendingEffectRepeatOptional = useGameStateStore((s) => s.pendingEffectRepeatOptional);
  const pendingEffectChoice = useGameStateStore((s) => s.pendingEffectChoice);

  useEffect(() => {
    if (!activeActionId || !gameState) return;
    if (gameState.gameResult) {
      useGameStateStore.getState().setActiveActionId(null);
      useContactModalStore.getState()._reset();
      return;
    }
    // モーダルが open 中はユーザー操作待ち
    if (guardPickerOpen || cutInDisguiseOpen) return;
    // D11007 a3 fix: effect pick modal (contact:start triggered の chain など)
    // が open 中は contact flow を進めない (rules/22 「コンタクトしたとき」が
    // 行動順確認の前に解決)
    if (pendingEffectPick !== null) return;
    // BUG-141 (cluster3): optional/choice modal も解決待ち (宣言時 trigger の効果はガード判定前に解決)
    if (pendingEffectOptional !== null || pendingEffectRepeatOptional !== null) return;
    if (pendingEffectChoice !== null) return;

    const ax = flow.action._getContext(activeActionId);
    if (!ax) {
      useGameStateStore.getState().setActiveActionId(null);
      return;
    }

    runOneStep(gameState, ax, spectatorMode);
  }, [activeActionId, gameState, spectatorMode, guardPickerOpen, cutInDisguiseOpen, pendingEffectPick, pendingEffectOptional, pendingEffectRepeatOptional, pendingEffectChoice]);
}

function runOneStep(state: GameState, ax: ActionContext, spectatorMode: boolean): void {
  switch (ax.phase) {
    case 'declared':
    case 'leave-resolution':
    case 'contact-pending':
    case 'contact-end':
      dispatchEngineAction({ type: 'actionAdvance', actionId: ax.id });
      return;

    case 'action-end':
      useGameStateStore.getState().setActiveActionId(null);
      return;

    case 'guard-window': {
      const guardExclude = ax.target.kind === 'char' ? ax.target.uid : undefined;
      const cands = buildGuardCandidates(state, ax.byUid, guardExclude);
      if (cands.length === 0) {
        dispatchEngineAction({ type: 'actionGuard', actionId: ax.id, guarderUid: null });
        return;
      }
      // W2b (2026-07-03, r28): mustGuard 義務 (B09040 a2)。義務 char が居れば候補を義務 char のみに
      // 絞り、pass (ガードしない) を封じる (公式Q&A「ガードできる場合は必ずガード」。
      // engine passGuard/tryGuard の throw は backstop、UI が事前抑止する)。
      const mustCands = flow.guard.mustGuardCandidates(state, ax.byUid, guardExclude);
      const mustGuard = mustCands.length > 0;
      const effCands = mustGuard
        ? cands.filter((c) => mustCands.some((m) => m.uid === c.uid))
        : cands;
      const defender: Player = ax.byPlayer === 'self' ? 'opp' : 'self';
      // BUG-045 (#9 spectator stall fix): spectator mode では self も AI 委譲
      if (defender === 'self' && !spectatorMode) {
        // GuardPickerModal を open。ユーザー操作で actionGuard dispatch される。
        const attackerName = readApLp(state, ax.byUid).name;
        useContactModalStore.getState()._setGuardPicker({
          actionId: ax.id,
          candidates: effCands,
          attackerName,
          mustGuard,
        });
        return;
      }
      // opp defender OR spectator mode の self: AI (義務あれば義務 char へ強制)
      const ai = new HeuristicPolicy();
      const rawCands = flow.guard.candidates(state, ax.byUid, guardExclude);
      const aiChoice = ai.chooseGuard?.(state, ax, rawCands) ?? null;
      const choice = mustGuard
        ? (aiChoice !== null && mustCands.some((m) => m.uid === aiChoice) ? aiChoice : mustCands[0]!.uid)
        : aiChoice;
      dispatchEngineAction({ type: 'actionGuard', actionId: ax.id, guarderUid: choice });
      return;
    }

    case 'action-1':
    case 'action-2':
    case 'action-1-redo': {
      const which: 'firstUid' | 'secondUid' = ax.phase === 'action-2' ? 'secondUid' : 'firstUid';
      const uid = ax[which];
      const decider = uid ? ownerOfUid(state, uid) : null;
      if (!uid || !decider) {
        // fallback: pass + advance
        dispatchEngineAction({
          type: 'actionContact',
          actionId: ax.id,
          player: ax.byPlayer,
          choice: { kind: 'pass' },
        });
        dispatchEngineAction({ type: 'actionAdvance', actionId: ax.id });
        return;
      }
      const cands = buildCutInDisguiseCandidates(state, ax, decider);
      if (cands.length === 0) {
        // 候補ゼロ: 自動 pass
        dispatchEngineAction({
          type: 'actionContact',
          actionId: ax.id,
          player: decider,
          choice: { kind: 'pass' },
        });
        dispatchEngineAction({ type: 'actionAdvance', actionId: ax.id });
        return;
      }
      // BUG-045 (#9 spectator stall fix): spectator mode では self も AI 委譲
      if (decider === 'self' && !spectatorMode) {
        // user_request 20260522_01 #7 BUG-055: actorName を渡して
        // 「1番目 (江戸川コナン)」のように具体表示
        const actorUid = ax.phase === 'action-2' ? ax.secondUid : ax.firstUid;
        const actorName = actorUid ? readApLp(state, actorUid).name : undefined;
        useContactModalStore.getState()._setCutInDisguise({
          actionId: ax.id,
          player: 'self',
          actorLabel: actorLabelFor(ax.phase),
          actorName,
          candidates: cands,
        });
        return;
      }
      // opp decider OR spectator mode の self: AI
      const ai = new HeuristicPolicy();
      const choice = chooseAiContact(state, ax, decider, ai);
      dispatchEngineAction({ type: 'actionContact', actionId: ax.id, player: decider, choice });
      dispatchEngineAction({ type: 'actionAdvance', actionId: ax.id });
      return;
    }

    case 'judge': {
      dispatchEngineAction({ type: 'actionJudge', actionId: ax.id });
      dispatchEngineAction({ type: 'actionAdvance', actionId: ax.id }); // judge → contact-end
      return;
    }
  }
}

function chooseAiContact(
  state: GameState,
  ax: ActionContext,
  player: Player,
  ai: HeuristicPolicy,
): ContactChoice {
  const cutinCands = state.players[player].hand.filter((c) =>
    flow.contact.canCutIn(state, ax, player, c),
  );
  const cutinChoice = ai.chooseCutIn?.(state, ax, player, cutinCands) ?? null;
  if (cutinChoice) return { kind: 'cutin', cardId: cutinChoice };
  const disgCands = state.players[player].hand.filter((c) =>
    flow.contact.canDisguise(state, ax, player, c),
  );
  const disgChoice = ai.chooseDisguise?.(state, ax, player, disgCands) ?? null;
  if (disgChoice) return { kind: 'disguise', cardId: disgChoice };
  return { kind: 'pass' };
}

/**
 * Test 用: 外部から1ステップ駆動。React 不要で pure dispatch シーケンスを検証可能。
 * spectatorMode default false で既存テスト互換 (modal 経路維持)。
 */
export function _runDriverStep(state: GameState, ax: ActionContext, spectatorMode = false): void {
  runOneStep(state, ax, spectatorMode);
}
