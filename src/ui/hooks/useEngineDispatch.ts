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
import { applyPickAndContinuation, applyPickSkipAndContinuation, applyChoiceAndContinuation, applyOptionalAndContinuation } from '@/engine/effect/apply-pick.js';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks.js';
import { useGameStateStore } from '@/ui/state/store.js';
import type { GameState } from '@/engine/types/game-state.js';
import type { EffectCtx } from '@/engine/types';
import type { AbilityCostParams } from '@/engine/flow/index.js';
import { resolveActionAgainstChar, resolveActionAgainstCase } from '@/ai/action-resolution.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import { event as engineEvent } from '@/engine/event/index.js';
import { _getResolutionLock } from '@/engine/event/registry.js';
import { def as readDef } from '@/engine/read/def.js';
import { char as readCharFromEngine } from '@/engine/read/char.js';
// Round 4j-fix (BUG-034): `@/engine` 経由で取得し vite dev mode の module duplication 回避
import { _drainPendingHirameki, _drainPendingMisread } from '@/engine';
import { _drainPendingEffectPickSide, _drainPendingEffectChoiceSide, _drainPendingEffectOptionalSide } from '@/engine/effect/resolve-picks';
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
  // Phase 2c (BUG-116 構造解消): cost+ctx は dispatcher 内 (engine.flow.activateXxx) で構築する。
  // 呼出元は picker 選択値 (costParams) のみ渡す — cost/ctx の caller 構築契約は廃止。
  | { type: 'partnerAbility'; player: Player; abilId: string; costParams?: AbilityCostParams }
  | { type: 'declaredAbility'; uid: string; abilId: string; costParams?: AbilityCostParams }
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
  // Phase 2c: optional 引数群の required/optional を 4 形態の union で明示。
  //   - skip:   pickedUid=null 単独 (「選ばない」— n.min===0 任意効果のみ。pending と対の
  //             continuation も自動 drop (BUG-111)。他引数は同時指定しない)
  //   - single: pickedUid のみ
  //   - multi:  pickedUids 必須 (nMax>1 の一括 resolve。D08021 charStackCard 等 multi-pick atom が
  //             cardIds:'$pick.cardIds' を resolved 配列で受ける。pickedUid は先頭要素)
  //   - switch: switchRemoveUid 必須 (効果登場 sceneEnter が現場満杯のとき SceneSwitchPickerModal
  //             で収集した退場キャラ uid。rules/20 スイッチで switchEnter — switch-on-effect-enter)
  | { type: 'effectPickResolve'; pickedUid: null }
  | { type: 'effectPickResolve'; pickedUid: string }
  | { type: 'effectPickResolve'; pickedUid: string; pickedUids: string[] }
  | { type: 'effectPickResolve'; pickedUid: string; switchRemoveUid: string }
  // BUG-121: human 複数 option choice の選択結果 (enter トリガ等)。pendingEffectChoice を解決する。
  | { type: 'choiceResolve'; choiceIndex: number }
  // 2026-06-06 タスクC: optional (「〜してもよい」) の決定。pendingEffectOptional を解決する。
  | { type: 'optionalResolve'; run: boolean }
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

// BUG-109: resolveCardIdFromPickUid + pick build/continuation 実行は engine の
// apply-pick.ts (applyPickAndContinuation) へ移設し human/AI で共有 (重複排除)。

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
      // Phase 2c (BUG-116 構造解消): cost+ctx 構築 + pay は engine 側 helper に一元化
      // (旧: action.cost && action.ctx が両方渡されたときのみ pay → 渡し忘れで silent skip)。
      flow.activatePartnerAbility(draft, action.player, action.abilId, action.costParams);
      return;
    case 'declaredAbility':
      // BUG-085 の costPaid/dyn 伝播は activateDeclaredAbility 内で維持される。
      flow.activateDeclaredAbility(draft, action.uid, action.abilId, action.costParams);
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
          // 2026-05-29 user_request: ヒラメキ発動をフロントログ + トーストに明示。
          // RecentActionToast は log 末尾を拾うため、この 1 行で「【ヒラメキ】発動」演出も出る。
          mutate.log.append(draft, {
            ts: Date.now(),
            player: pending.player,
            turn: draft.turn.number,
            action: 'hirameki:fire',
            target: pending.cardId,
          });
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
      if (action.pickedUid === null) {
        // BUG-132 GAP-1: skipResolvesAtom 付き pending (deckRevealUntil chooseMatch) の decline は
        // 「0枚選択」を atom 解決として実行し、remainder (デッキ下移動等の必須 step) を続行する
        // (rules/15 「〜まで」=0枚可)。破棄してしまうと全 reveal がデッキ上に残る。
        if (pending.skipResolvesAtom === true) {
          applyPickSkipAndContinuation(draft, pending);
          return;
        }
        // skip (n.min === 0 の任意効果のみ可能、UI 側で gate される想定)
        // BUG-111: continuation は pending 本体 (pending.continuation) に同梱されるため、
        // user skip 時は pending を破棄すれば対の continuation も自動 drop される (別 FIFO shift 不要)。
        // クリアは produce 後の post-dispatch drain で行う (return のみ)
        return;
      }
      // BUG-109: resolved atom の build (Pattern A/B) + continuation (BUG-107 の保存 ctx 共有) は
      // engine 共通 helper applyPickAndContinuation に集約 (AI drain drainAiEffectPicks と同実体)。
      // resolveCardIdFromPickUid の state は draft (produce 内最新) を渡す。
      applyPickAndContinuation(
        draft,
        pending,
        action.pickedUid,
        'pickedUids' in action ? action.pickedUids : undefined,
        'switchRemoveUid' in action ? action.switchRemoveUid : undefined,
      );
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'choiceResolve': {
      // BUG-121: pendingEffectChoice を choiceIndex で解決。元 effect を readDef から復元し
      // choiceIndex 付きで再 walk → 選択 option 内の $pick (option2 sceneToHand 等) は
      // __pendingEffectPickQueue へ再 push され既存 effectPickResolve 経路で連鎖消化される。
      const pendingC = useGameStateStore.getState().pendingEffectChoice;
      if (!pendingC) return;
      applyChoiceAndContinuation(draft, pendingC, action.choiceIndex);
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'optionalResolve': {
      // 2026-06-06 タスクC: pendingEffectOptional を run(boolean) で解決。run=true なら内部 effect を
      // 再 walk して実行 (内部 $pick は __pendingEffectPickQueue へ再 push)、run=false なら skip。
      const pendingO = useGameStateStore.getState().pendingEffectOptional;
      if (!pendingO) return;
      applyOptionalAndContinuation(draft, pendingO, action.run);
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
 * BUG-090: dispatchEngineAction 以外で human(self) の effect を runAllUntilEmpty で
 * 解決する経路 (ターンドライバ等) 向けに、engine 側 globalThis 側チャネルへ積まれた
 * pending pick / hirameki / misread / deckReveal を Zustand store に転送する。
 *
 * 背景: human の auto-phase (driveOppTurn の flow.startTurn(self)+runAllUntilEmpty) で
 *   事件編→解決編 になり case card a1 (case:to-resolved → discard) が発火すると、
 *   discard pick が __pendingEffectPickQueue に積まれる。dispatchEngineAction は produce 後に
 *   各 side-channel を drain → store.set しているが、ターンドライバ側ではこの転送が無く
 *   pick が取り残されて EffectPickerModal が出ない (= 「何も起きない」) バグだった。
 *
 * dispatchEngineAction の post-produce 同期と異なり action 種別が無いため、
 * 「新規 pending があれば先頭を set」(非 null のみ) の共通動作のみ行う。
 * effectPickResolve 等の「queue 空なら null クリア」特殊処理は dispatchEngineAction 専用。
 */
export function surfacePendingSideChannels(): void {
  const store = useGameStateStore.getState();
  const hiramekiSide = _drainPendingHirameki();
  if (hiramekiSide) store.setPendingHirameki(hiramekiSide);
  const misreadSide = _drainPendingMisread();
  if (misreadSide) store.setPendingMisread(misreadSide);
  const effectPickSide = _drainPendingEffectPickSide();
  if (effectPickSide) store.setPendingEffectPick(effectPickSide);
  // BUG-121: auto-phase enter 由来 choice の取り残し防止 (useOppTurnDriver 経路)
  const effectChoiceSide = _drainPendingEffectChoiceSide();
  if (effectChoiceSide) store.setPendingEffectChoice(effectChoiceSide);
  // 2026-06-06 タスクC: optional 決定の取り残し防止 (choice と同様)
  const effectOptionalSide = _drainPendingEffectOptionalSide();
  if (effectOptionalSide) store.setPendingEffectOptional(effectOptionalSide);
  const deckRevealSide = _drainPendingDeckRevealSide();
  if (deckRevealSide) store.setPendingDeckReveal(deckRevealSide);
}

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
    // BUG-121: human 複数 option choice の side-channel drain (effectPickSide と同 clear セマンティクス)
    const effectChoiceSide = _drainPendingEffectChoiceSide();
    if (action.type === 'choiceResolve') {
      // resolve で current pending choice を消化 → 次の choice (通常 null) を反映
      store.setPendingEffectChoice(effectChoiceSide);
    } else if (effectChoiceSide) {
      store.setPendingEffectChoice(effectChoiceSide);
    }
    // 2026-06-06 タスクC: optional 決定の side-channel drain (choice と同 clear セマンティクス)
    const effectOptionalSide = _drainPendingEffectOptionalSide();
    if (action.type === 'optionalResolve') {
      // resolve で current pending optional を消化 → 次 (通常 null) を反映
      store.setPendingEffectOptional(effectOptionalSide);
    } else if (effectOptionalSide) {
      store.setPendingEffectOptional(effectOptionalSide);
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
