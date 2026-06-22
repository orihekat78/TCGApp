// useEngineDispatch/can-check.ts — Phase 3d 分割 (isAllowed 前段ガード, body 無改変移送, 2026-06-22)
import * as flow from '@/engine/flow/index.js';
import { useGameStateStore } from '@/ui/state/store.js';
import { _getResolutionLock } from '@/engine/event/registry.js';
import type { GameState } from '@/engine/types/game-state.js';
import type { EngineAction } from './types.js';

// ---- can-check (前段ガード) ----

export function isAllowed(state: GameState, action: EngineAction): boolean {
  switch (action.type) {
    case 'reasoning':
      return flow.canReason(state, action.uid);
    case 'handUseCard':
      return flow.canHandUseCard(state, action.player, action.cardId);
    case 'handUseCardSwitch':
      return flow.canHandUseCardSwitch(state, action.player, action.cardId);
    case 'nextHint':
      return flow.canStartNextHint(state, action.player);
    case 'partnerAbility':
      return flow.canPartnerAbility(state, action.player, action.abilId);
    case 'declaredAbility':
      return flow.canDeclaredAbility(state, action.uid, action.abilId);
    case 'assist': {
      // src/ai/move-enumerator.ts canAssist と同条件
      const ps = state.players[action.player];
      if (ps.partner.state !== 'active') return false;
      if (ps.partner.location !== 'partner-area') return false;
      if (state.turnState[action.player].assistedThisTurn) return false;
      return true;
    }
    case 'solveCase': {
      // src/ai/move-enumerator.ts canSolveCase と同条件
      const ps = state.players[action.player];
      if (ps.case.status !== '解決編') return false;
      if (ps.evidence.length < ps.case.requiredEvidence) return false;
      if (ps.partner.state !== 'active') return false;
      if (state.turnState[action.player].assistedThisTurn) return false;
      return true;
    }
    case 'actionAgainstChar':
      return flow.canActionAgainstChar(state, action.byUid, action.targetUid);
    case 'actionAgainstCase':
      return flow.canActionAgainstCase(state, action.byUid, action.targetPlayer);
    // Phase 8 完全クローズ Commit 2: per-step action dispatch can-check
    case 'actionDeclareChar':
      return flow.canActionAgainstChar(state, action.byUid, action.targetUid);
    case 'actionDeclareCase':
      return flow.canActionAgainstCase(state, action.byUid, action.targetPlayer);
    case 'actionGuard': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return false;
      if (ax.phase !== 'guard-window') return false;
      if (action.guarderUid === null) return true; // pass はいつでも可
      // Task D E4: アクション対象自身はガード不可 (B09028/B09054 Q&A)
      return flow.guard.canGuard(state, ax.byUid, action.guarderUid, ax.target.kind === 'char' ? ax.target.uid : undefined);
    }
    case 'actionContact': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return false;
      if (ax.phase !== 'action-1' && ax.phase !== 'action-2' && ax.phase !== 'action-1-redo') return false;
      if (action.choice.kind === 'pass') return true;
      if (action.choice.kind === 'cutin') return flow.contact.canCutIn(state, ax, action.player, action.choice.cardId);
      if (action.choice.kind === 'disguise') return flow.contact.canDisguise(state, ax, action.player, action.choice.cardId);
      return false;
    }
    case 'actionAdvance': {
      const ax = flow.action._getContext(action.actionId);
      return !!ax && ax.phase !== 'action-end';
    }
    case 'actionJudge': {
      const ax = flow.action._getContext(action.actionId);
      return !!ax && ax.phase === 'judge';
    }
    case 'hiramekiResolve': {
      // pendingHirameki が set されているときのみ有効
      return useGameStateStore.getState().pendingHirameki !== null;
    }
    case 'misreadResolve': {
      // pendingMisread が set されているときのみ有効
      return useGameStateStore.getState().pendingMisread !== null;
    }
    case 'optionalResolve': {
      // 2026-06-06 タスクC: pendingEffectOptional が set されているときのみ有効
      return useGameStateStore.getState().pendingEffectOptional !== null;
    }
    case 'deckReorderResolve': {
      // BUG-136: pendingDeckReorder が set されているときのみ有効
      return useGameStateStore.getState().pendingDeckReorder !== null;
    }
    case 'choiceResolve': {
      // BUG-121: pendingEffectChoice が set されているときのみ有効
      return useGameStateStore.getState().pendingEffectChoice !== null;
    }
    case 'effectPickResolve': {
      // BUG-054: pendingEffectPick が set されているときのみ有効
      return useGameStateStore.getState().pendingEffectPick !== null;
    }
    case 'setEffectOrder': {
      // resolution lock 中は禁止
      const lock = _getResolutionLock();
      if (lock.locked) return false;
      // entry が存在 + owner が action.player と一致する場合のみ
      const entry = state.pendingEffects.find((e) => e.id === action.entryId);
      if (!entry) return false;
      return entry.source.player === action.player;
    }
    case 'endTurn': {
      // engine 側 predicate 無し: 自分の turn かつ main phase のみ許可
      if (state.turn.player !== action.player || state.turn.phase !== 'main') return false;
      // BUG-139 (wave#2 cluster2, 2026-06-12): 必須 pick (nMin>=1) 未解決中はターン終了不可
      // (rules/05 効果解決中は次の行動に移れない)。従来は終了できてしまい、未解決の必須効果
      // (例: D08026 t1 解決編化 discard) が黙って永久放置されていた (X8 導入で CPU 側 stall として顕在化)。
      // 任意 pick (nMin=0) / optional / choice は modal が skip/decline を提供するため対象外 (narrow gate)。
      const pendingPick = useGameStateStore.getState().pendingEffectPick;
      if (pendingPick && pendingPick.player === action.player && pendingPick.nMin >= 1) return false;
      return true;
    }
  }
}
