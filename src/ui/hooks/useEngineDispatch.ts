// Phase 8 Task 8.1: UI → engine action ディスパッチ基盤
//
// rules: 05-turn-phases.md (メインフェイズ), 11-reasoning.md, 12-next-hint.md,
//        21-declared-ability-cost.md
//
// 設計:
//   - 骨格 (engine) は変更しない。本ファイルは UI 層の seam として
//     engine.flow.* (canX + 実行関数) を呼び分け、結果を Zustand store に反映する。
//   - engine actions は in-place mutator (void 戻り) のため、Immer の `produce` で
//     wrap して Zustand に新参照を渡す。これにより構造的共有 + change detection が両立。
//   - 各 action 種別ごとに canX 判定を hook 層でも前段ガードし、UI で
//     friendly な DispatchResult を返す (engine の throw は engine-error として包む)。

import { produce } from 'immer';
import * as flow from '@/engine/flow/index.js';
import { mutate } from '@/engine/mutate/index.js';
import { runAllUntilEmpty } from '@/engine/resolve/index.js';
import { cost as engineCost } from '@/engine/cost/index.js';
import { useGameStateStore } from '@/ui/state/store.js';
import type { GameState } from '@/engine/types/game-state.js';
import type { Cost, EffectCtx } from '@/engine/types';
import { resolveActionAgainstChar, resolveActionAgainstCase } from '@/ai/action-resolution.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import { event as engineEvent } from '@/engine/event/index.js';
import { def as readDef } from '@/engine/read/def.js';
import { char as readCharFromEngine } from '@/engine/read/char.js';
import { _drainPendingHirameki } from '@/engine/listeners/hirameki.js';
import { _drainPendingMisread } from '@/engine/listeners/misread.js';

type Player = 'self' | 'opp';

/**
 * Phase 8.1+ で扱うメインフェイズ単発 action。
 * - action 宣言 / コンタクト 9 段階等は後続 task で別 dispatcher。
 * - assist / solveCase は flow に専用ラッパが無いため `mutate.partner.*` を直叩き
 *   (`src/ai/policy.ts` と同じ運用)。can-check は move-enumerator と同じ条件を inline。
 */
/**
 * Phase 8 完全クローズ Commit 2: コンタクト 中の人間プレイヤーの選択肢。
 *  - 'cutin': 手札のカットイン能力カードを選択
 *  - 'disguise': 手札の変装能力カードを選択
 *  - 'pass': 行動しない
 */
export type ContactChoice =
  | { kind: 'cutin'; cardId: string }
  | { kind: 'disguise'; cardId: string }
  | { kind: 'pass' };

export type EngineAction =
  | { type: 'reasoning'; uid: string }
  | { type: 'handUseCard'; player: Player; cardId: string }
  | { type: 'nextHint'; player: Player; optionalCardId?: string }
  | { type: 'partnerAbility'; player: Player; abilId: string; cost?: Cost; ctx?: EffectCtx }
  | { type: 'declaredAbility'; uid: string; abilId: string; cost?: Cost; ctx?: EffectCtx }
  | { type: 'assist'; player: Player }
  | { type: 'solveCase'; player: Player }
  | { type: 'actionAgainstChar'; byUid: string; targetUid: string }
  | { type: 'actionAgainstCase'; byUid: string; targetPlayer: Player }
  // Phase 8 完全クローズ Commit 2: per-step action dispatch
  // - 既存 actionAgainstChar / actionAgainstCase は CPU vs CPU 用に温存
  // - 新 dispatch は useContactFlowDriver と組み合わせて人間プレイヤー介入を実現
  | { type: 'actionDeclareChar'; byUid: string; targetUid: string }
  | { type: 'actionDeclareCase'; byUid: string; targetPlayer: Player }
  | { type: 'actionGuard'; actionId: string; guarderUid: string | null }
  | { type: 'actionContact'; actionId: string; player: Player; choice: ContactChoice }
  | { type: 'actionAdvance'; actionId: string }
  | { type: 'actionJudge'; actionId: string }
  // Phase 8 完全クローズ Commit 3a: ヒラメキ発動 / スキップ決定
  | { type: 'hiramekiResolve'; choice: 'fire' | 'skip' }
  // Phase 8 完全クローズ Commit 3b: ミスリード発動キャラ複数選択
  | { type: 'misreadResolve'; picks: ReadonlyArray<{ uid: string; x: number }> }
  | { type: 'endTurn'; player: Player };

export type DispatchResult =
  | { ok: true }
  | { ok: false; reason: 'no-state' | 'not-allowed' | 'engine-error'; detail?: string };

/**
 * Phase 8 完全クローズ Commit 2: actionDeclareChar/Case 直後に
 * `flow.action.declare()` が返した ActionContext.id を runEngineAction から
 * dispatchEngineAction へ伝える側チャネル (produce 境界を越えるため必要)。
 * 各 dispatch 開始時に null リセット → declare 時にセット → produce 完了後に
 * dispatchEngineAction が store.setActiveActionId へ転送して null に戻す。
 */
let _justDeclaredAxId: string | null = null;

// ---- can-check (前段ガード) ----

function isAllowed(state: GameState, action: EngineAction): boolean {
  switch (action.type) {
    case 'reasoning':
      return flow.canReason(state, action.uid);
    case 'handUseCard':
      return flow.canHandUseCard(state, action.player, action.cardId);
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
      return flow.guard.canGuard(state, ax.byUid, action.guarderUid);
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
    case 'endTurn':
      // engine 側 predicate 無し: 自分の turn かつ main phase のみ許可
      return state.turn.player === action.player && state.turn.phase === 'main';
  }
}

// ---- engine 呼出 (draft 上で in-place mutation) ----

function runEngineAction(draft: GameState, action: EngineAction): void {
  switch (action.type) {
    case 'reasoning':
      flow.doReasoning(draft, action.uid);
      return;
    case 'handUseCard':
      flow.handUseCard(draft, action.player, action.cardId);
      return;
    case 'nextHint':
      flow.runNextHint(draft, action.player, action.optionalCardId);
      return;
    case 'partnerAbility':
      // Phase 8.8c: cost が指定されていれば canPay + pay (atomic: pay → use)
      if (action.cost && action.ctx) {
        engineCost.pay(draft, action.cost, action.ctx);
      }
      flow.usePartnerAbility(draft, action.player, action.abilId);
      return;
    case 'declaredAbility':
      if (action.cost && action.ctx) {
        engineCost.pay(draft, action.cost, action.ctx);
      }
      flow.useDeclaredAbility(draft, action.uid, action.abilId);
      return;
    case 'assist':
      // flow.assist 未提供のため mutate を直叩き (src/ai/policy.ts:117 と同じ)
      mutate.partner.assist(draft, action.player);
      return;
    case 'solveCase':
      // flow.solveCase 未提供のため mutate を直叩き (src/ai/policy.ts:126 と同じ)
      mutate.partner.solveCase(draft, action.player);
      return;
    case 'actionAgainstChar': {
      // Phase 8.7c: ガード判定を HeuristicPolicy に委譲。共通ヘルパで policy.applyMove と
      // 同一シーケンスを共有 (将来カットイン/変装追加時もここを 1 箇所変更で OK)。
      resolveActionAgainstChar(draft, action.byUid, action.targetUid, new HeuristicPolicy());
      return;
    }
    case 'actionAgainstCase':
      resolveActionAgainstCase(draft, action.byUid, action.targetPlayer);
      return;
    // Phase 8 完全クローズ Commit 2: per-step action dispatch
    case 'actionDeclareChar': {
      const ax = flow.action.declare(draft, action.byUid, { kind: 'char', uid: action.targetUid });
      _justDeclaredAxId = ax.id;
      return;
    }
    case 'actionDeclareCase': {
      const ax = flow.action.declare(draft, action.byUid, { kind: 'case', player: action.targetPlayer });
      _justDeclaredAxId = ax.id;
      return;
    }
    case 'actionGuard': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return;
      if (action.guarderUid === null) {
        flow.action.passGuard(draft, ax);
      } else {
        flow.action.tryGuard(draft, ax, action.guarderUid);
      }
      return;
    }
    case 'actionContact': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return;
      // first/second の actedフラグも更新 (advance() の redo 判定用)
      const actorUid =
        action.player === ax.byPlayer ? ax.byUid : (ax.guardUid ?? (ax.target.kind === 'char' ? ax.target.uid : ''));
      const isFirst = ax.firstUid === actorUid;
      if (action.choice.kind === 'cutin') {
        flow.contact.cutIn(draft, ax, action.player, action.choice.cardId);
        if (isFirst) ax.firstActed = true; else ax.secondActed = true;
      } else if (action.choice.kind === 'disguise') {
        flow.contact.disguise(draft, ax, action.player, action.choice.cardId);
        if (isFirst) ax.firstActed = true; else ax.secondActed = true;
      } else {
        flow.contact.pass(draft, ax, action.player);
        if (isFirst) ax.firstActed = false; else ax.secondActed = false;
      }
      return;
    }
    case 'actionAdvance': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return;
      flow.action.advance(draft, ax);
      return;
    }
    case 'actionJudge': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return;
      if (ax.target.kind === 'case') {
        // rules/10: 相手証拠リムーブ + 自証拠獲得
        flow.actionCase.removeOpponentEvidenceTop(draft, ax);
        flow.actionCase.gainSelfEvidence(draft, ax);
      } else {
        flow.action.snapshotAP(draft, ax);
        flow.contact.judge(draft, ax);
      }
      return;
    }
    case 'hiramekiResolve': {
      const pending = useGameStateStore.getState().pendingHirameki;
      if (!pending) return;
      if (action.choice === 'fire') {
        // ability の effect を pendingEffects に queue → runAllUntilEmpty で解決
        const def = readDef.card(pending.cardId);
        const ability = def?.abilities.find(
          (a: unknown) => a !== null && typeof a === 'object' && (a as { id?: string }).id === pending.abilityId,
        ) as { effect?: unknown } | undefined;
        if (ability?.effect) {
          engineEvent.queue(
            draft,
            ability.effect as never,
            { player: pending.player, cardId: pending.cardId },
            'evidence:remove-by-action',
            { player: pending.player, ev: { cardId: pending.cardId } },
          );
        }
      }
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'misreadResolve': {
      const pending = useGameStateStore.getState().pendingMisread;
      if (!pending) return;
      // 各 pick について sleep + LP-X 合算
      let totalReduction = 0;
      for (const pick of action.picks) {
        mutate.scene.setState(draft, pick.uid, 'sleep');
        totalReduction += pick.x;
      }
      // listener と同じパターン: lpOverride で 1 回適用 (partner uid は対象外)
      if (
        totalReduction > 0 &&
        pending.reasoningUid !== 'partner:self' &&
        pending.reasoningUid !== 'partner:opp'
      ) {
        const currentLp = readCharFromEngine.lp(draft, pending.reasoningUid);
        mutate.char.setOverrideLP(draft, pending.reasoningUid, currentLp - totalReduction);
      }
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'endTurn':
      flow.endTurn(draft, action.player);
      return;
  }
}

// ---- public API ----

/**
 * Pure dispatcher. React の外からも (テスト等) 呼べる。
 *
 *   const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
 *   if (!result.ok) showError(result.reason);
 *
 * - gameState === null  → { ok:false, reason:'no-state' }
 * - canX === false       → { ok:false, reason:'not-allowed' }
 * - engine が throw      → { ok:false, reason:'engine-error', detail }
 * - 成功時                → store の gameState を Immer 経由で新参照に更新し { ok:true }
 */
export function dispatchEngineAction(action: EngineAction): DispatchResult {
  const store = useGameStateStore.getState();
  const current = store.gameState;
  if (current === null) return { ok: false, reason: 'no-state' };
  if (!isAllowed(current, action)) return { ok: false, reason: 'not-allowed' };

  _justDeclaredAxId = null;
  try {
    store.dispatch((state) =>
      produce(state, (draft) => {
        runEngineAction(draft, action);
        // Phase 5 listener が pendingEffects に積んだ effect を解決する。
        // AI orchestrator (src/ai/policy.ts) と同じ運用パターン。
        runAllUntilEmpty(draft);
      }),
    );
    // Commit 2: declareChar/Case 直後は ActionContext.id を store.activeActionId にセット
    if (_justDeclaredAxId) {
      store.setActiveActionId(_justDeclaredAxId);
      _justDeclaredAxId = null;
    }
    // Commit 3a: evidence:remove-by-action listener が側チャネルにセットしていれば
    // Zustand pendingHirameki に転送。
    const hiramekiSide = _drainPendingHirameki();
    if (hiramekiSide) {
      store.setPendingHirameki(hiramekiSide);
    }
    // hiramekiResolve dispatch 後は pendingHirameki をクリア
    if (action.type === 'hiramekiResolve') {
      store.setPendingHirameki(null);
    }
    // Commit 3b: reasoning:before-add listener が human defender ケースで側チャネル set した分
    const misreadSide = _drainPendingMisread();
    if (misreadSide) {
      store.setPendingMisread(misreadSide);
    }
    if (action.type === 'misreadResolve') {
      store.setPendingMisread(null);
    }
    return { ok: true };
  } catch (e) {
    _justDeclaredAxId = null;
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: 'engine-error', detail };
  }
}

/**
 * React hook 形ラッパ。UI component から
 *   const { dispatch } = useEngineDispatch();
 * で利用する。`dispatchEngineAction` は module-level の安定参照なので
 * useCallback は不要。
 */
export function useEngineDispatch(): { dispatch: typeof dispatchEngineAction } {
  return { dispatch: dispatchEngineAction };
}
