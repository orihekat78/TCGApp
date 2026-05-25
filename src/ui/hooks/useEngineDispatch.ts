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
import { resolveEffectPicks } from '@/engine/effect/resolve-picks.js';
import { useGameStateStore } from '@/ui/state/store.js';
import type { GameState } from '@/engine/types/game-state.js';
import type { Cost, Effect, EffectCtx } from '@/engine/types';
import { resolveActionAgainstChar, resolveActionAgainstCase } from '@/ai/action-resolution.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import { event as engineEvent } from '@/engine/event/index.js';
import { _getResolutionLock } from '@/engine/event/registry.js';
import { def as readDef } from '@/engine/read/def.js';
import { char as readCharFromEngine } from '@/engine/read/char.js';
// Round 4j-fix (BUG-034): `@/engine` 経由で取得し vite dev mode の module duplication 回避
import { _drainPendingHirameki, _drainPendingMisread } from '@/engine';
import { _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _drainPendingDeckRevealSide } from '@/engine/effect/atom-handlers';

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
  // Phase 5 advance: SceneSwitch (rules/20) — scene 5 埋まり時のキャラ手札使用
  | { type: 'handUseCardSwitch'; player: Player; cardId: string; removeUid: string }
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
  // user_request 20260522_01 #2/#6 BUG-054: human player による effect 対象選択結果
  // pickedUid=null は「選ばない」(skip、n.min===0 任意効果のみ可能)
  | { type: 'effectPickResolve'; pickedUid: string | null }
  // Phase 8 完全クローズ Commit 5: 効果スタック同所有者順序設定 (▲▼ UI)
  | { type: 'setEffectOrder'; entryId: string; order: number; player: Player }
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

/**
 * BUG-078 follow-up: pending.candidates (queue push 時の snapshot) は sequence の
 * 先行 step (例: D08013 step 2 evidenceToHand) で当該 area の内容が変化すると
 * stale になる。現在の gameState から uid → cardId を再解決して常に最新を採用する。
 *
 * uid 形式:
 *   - `evidence:<side>:<idx>` → gameState.players[side].evidence[idx].cardId
 *   - `<cardId>#<idx>` → cardId 部分 (Pattern B card kind の synthetic uid)
 *
 * Pattern A (uid='$pick' / scene char uid) は対象外 (本関数を呼ばない経路)
 */
function resolveCardIdFromPickUid(
  uid: string,
  state: GameState | null,
  pending: { candidates: ReadonlyArray<{ uid: string; cardId: string }> },
): string | null {
  if (!state) {
    // フォールバック: state 無し → pending snapshot を使用
    return pending.candidates.find((c) => c.uid === uid)?.cardId ?? null;
  }
  const ev = uid.match(/^evidence:(self|opp):(\d+)$/);
  if (ev) {
    const side = ev[1] as 'self' | 'opp';
    const idx = parseInt(ev[2]!, 10);
    return state.players[side]?.evidence?.[idx]?.cardId ?? null;
  }
  const ch = uid.match(/^([^#]+)#\d+$/);
  if (ch) return ch[1] ?? null;
  // フォールバック: snapshot 参照
  return pending.candidates.find((c) => c.uid === uid)?.cardId ?? null;
}

// ---- can-check (前段ガード) ----

function isAllowed(state: GameState, action: EngineAction): boolean {
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
    case 'handUseCardSwitch':
      // rules/20 §スイッチ: engine.flow.handUseCard の 5 番目引数 switchRemoveUid を渡す
      flow.handUseCard(draft, action.player, action.cardId, undefined, action.removeUid);
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
      // user_request 20260522_01 #8 fix: case target でも guard 成立した場合は
      // 証拠変動なし — contact AP 判定で攻撃キャラ or ガードキャラのリムーブ
      // のみ行う (rules/07 + rules/10: 証拠操作は「ガードされなかった場合」のみ)。
      if (ax.target.kind === 'case' && !ax.guardUid) {
        // rules/10: 相手証拠リムーブ + 自証拠獲得 (unguarded のみ)
        flow.actionCase.removeOpponentEvidenceTop(draft, ax);
        flow.actionCase.gainSelfEvidence(draft, ax);
      } else {
        // char target OR case target + guard 成立 → contact AP 判定
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
          // Phase 7-1 + 7-2 (BUG-035): hirameki effect 内の $pick atom を recursive utility で
          // substitute。Phase 7-1 の局所版 resolveHiramekiPick を resolveEffectPicks に retrofit。
          // Phase 7-3: chooseAtomTarget callback で verb 別ヒューリスティック選択
          // (D11009 sceneSetState stun → 敵 active 最高 AP 等)。
          // Human/AI 共通で適用 — UI 側 modal が出るときはこの dispatch 経路を通らないため実害なし。
          const ctx: EffectCtx = {
            source: { player: pending.player, cardId: pending.cardId, area: 'evidence' },
            bindings: {},
          };
          const aiPolicy = new HeuristicPolicy();
          const resolved = resolveEffectPicks(draft, ability.effect as never, ctx, {
            chooseAtomTarget: aiPolicy.chooseAtomTarget?.bind(aiPolicy),
            byPlayer: pending.player,
          });
          engineEvent.queue(
            draft,
            resolved as never,
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
    case 'setEffectOrder': {
      // entry を直接 mutate (isAllowed で entry 存在 + owner 一致は確認済)
      const entry = draft.pendingEffects.find((e) => e.id === action.entryId);
      if (entry) entry.ownerChosenOrder = action.order;
      return;
    }
    case 'effectPickResolve': {
      // user_request 20260522_01 #2/#6 BUG-054 + BUG-065:
      // pendingEffectPick の atomArgs を pattern により置換して queue + run
      //   Pattern A (uid='$pick'): uid → picked、target → drop
      //   Pattern B (uid 不在):    target → [cardId of picked candidate]
      const pending = useGameStateStore.getState().pendingEffectPick;
      if (!pending) return;
      const picked = action.pickedUid;
      if (picked === null) {
        // skip (n.min === 0 の任意効果のみ可能、UI 側で gate される想定)
        // 拡張 5 (chain): user skip 時は chain continuation も drop
        // (step 1 が applied されなかったので step 2 を実行しない)
        const chainG = globalThis as { __pendingChainContinuation?: unknown[] };
        chainG.__pendingChainContinuation?.shift();
        // クリアは produce 後の post-dispatch drain で行う (return のみ)
        return;
      }
      const pendingArgs = pending.atomArgs as { uid?: unknown };
      const isPatternA = pendingArgs.uid === '$pick';
      let resolvedAtom: { kind: 'atom'; verb: never; args: Record<string, unknown> };
      if (isPatternA) {
        // pattern A: atomArgs.uid を picked で置換、target は drop
        const { target: _omit, ...restArgs } = pending.atomArgs;
        void _omit;
        resolvedAtom = {
          kind: 'atom' as const,
          verb: pending.atomVerb as never,
          args: { ...restArgs, uid: picked },
        };
      } else {
        // BUG-065 pattern B: synthetic uid (cardId#index) → cardId 逆引き
        // → atomArgs.target を [cardId] で上書き (atom-handler は配列を期待)
        // BUG-078 follow-up: pending.candidates は queue push 時の snapshot で、
        // sequence の先行 step (例: D08013 step 2 evidenceToHand) により当該 area の
        // 内容が変化していると stale。現在の gameState から uid を再解決する。
        const currentState = useGameStateStore.getState().gameState;
        const resolvedCardId = resolveCardIdFromPickUid(picked, currentState, pending);
        if (!resolvedCardId) return; // 想定外、防御スキップ
        resolvedAtom = {
          kind: 'atom' as const,
          verb: pending.atomVerb as never,
          args: { ...pending.atomArgs, target: [resolvedCardId] },
        };
      }
      engineEvent.queue(
        draft,
        resolvedAtom as never,
        { player: pending.player, cardId: pending.source.cardId },
        'effect:human-pick-resolved',
        { picked, source: pending.source },
      );
      // 即座に flush (他 dispatch case と同 pattern)
      runAllUntilEmpty(draft);
      // 拡張 5 (chain continuation): resolved 後 chain の残り step を queue
      // resolved atom が applied (no-op でない) で、chain remainder が pending なら queue
      const chainG = globalThis as { __pendingChainContinuation?: { remainder: Effect[]; ctx: EffectCtx }[] };
      const chainCont = chainG.__pendingChainContinuation?.shift();
      if (chainCont) {
        // remainder を chain で wrap して queue (再度 chain semantics 適用)
        const remainderEffect: Effect = chainCont.remainder.length === 1
          ? chainCont.remainder[0]!
          : { kind: 'chain', steps: chainCont.remainder };
        // D11007 a3 driver fix 2026-05-25: 保存された ctx.source をそのまま渡す。
        // 旧コードは { player, cardId } のみ渡して uid を drop していたため、
        // remainder の atom が `uid: '$self'` 等を使うと ctx.source.uid 未設定で
        // resolveBindRef が解決できず silent no-op (AP+3000 効果が走らないバグ)。
        engineEvent.queue(
          draft,
          remainderEffect as never,
          chainCont.ctx.source,
          'effect:chain-continuation',
          { source: chainCont.ctx.source },
        );
        runAllUntilEmpty(draft);
      }
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'endTurn': {
      // Round 2 修正: 旧実装は endTurn のみで、次プレイヤーの startTurn を呼ばなかった。
      // 結果 (a) opp.turn 開始時に auto-phase 走らず、(b) opp.endTurn 後 self.turn でも
      // 同様 — 後攻 Human の auto-phase 欠落 + phase が 'end' のまま固定 → ターン終了
      // button 永続 disabled の root cause だった。次プレイヤーまで進めて phase='main'
      // に遷移させ、両プレイヤー対称な turn boundary を保証する。
      // (smoke harness src/ai/match.ts L106-112 と同等の遷移パターン)
      const nextPlayer: Player = action.player === 'self' ? 'opp' : 'self';
      flow.endTurn(draft, action.player);
      runAllUntilEmpty(draft);
      if (draft.gameResult) return;
      mutate.flag.resetTurnFlags(draft, nextPlayer);
      draft.turn.isFirstPlayerFirstTurn = false;
      flow.startTurn(draft, nextPlayer);
      runAllUntilEmpty(draft);
      return;
    }
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
    // user_request 20260522_01 #2/#6 BUG-054: human player による effect 対象選択
    // BUG-078 fix: queue 化対応。effectPickResolve 時は「次の pending を drain して set」
    // (queue が空なら null)。他 action では「新規 pending があれば先頭を set」。
    const effectPickSide = _drainPendingEffectPickSide();
    if (action.type === 'effectPickResolve') {
      // resolve で current pending を消化したので次の queue 先頭を反映 (or 空なら null)
      store.setPendingEffectPick(effectPickSide);
    } else if (effectPickSide) {
      store.setPendingEffectPick(effectPickSide);
    }
    // user_request 20260522_01 #12 BUG-061: deckRevealUntil 演出側チャネル drain
    const deckRevealSide = _drainPendingDeckRevealSide();
    if (deckRevealSide) {
      store.setPendingDeckReveal(deckRevealSide);
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
