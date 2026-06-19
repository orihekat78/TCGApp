// ai.policy — AIPolicy インターフェース + playTurn ドライバ (Phase 6 Group A Task 6.2)
// spec: .claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md
// rules: 05-turn-phases.md, 07-action-flow.md, 13-keywords.md
//
// 設計メモ:
//   - AIPolicy は move 候補から 1 つを選ぶだけのシンプルなインターフェース
//   - playTurn は enumerate → choose → apply のループ。endTurn が選ばれたら終了
//   - applyMove は Move kind → 対応する engine.flow / engine.mutate 呼出のマッピング
//   - assist / solveCase は flow に専用 API がないので mutate.partner.* を直接使う
//   - actionAgainstChar は contact 判定までを単純実行する (Phase 6 では AI 側 cutin/disguise なし)
//   - 200 手の安全弁を設けて無限ループを防止する

import type { GameState, EffectCtx, Cost } from '@/engine/types';
import { engine } from '@/engine';
import { produce } from 'immer';
import { enumerateMoves, type Move } from './move-enumerator.js';
import { resolveActionAgainstChar, resolveActionAgainstCase } from './action-resolution.js';
import { HeuristicPolicy } from './policies/heuristic.js';
import { makeDeclaredAbilCtx } from './ability-ctx.js';
import type { AbilityCostParams } from '@/engine/flow/index.js';
import { drainAiEffectPicks, hasPendingHumanPick } from '@/engine/effect/apply-pick.js';

type Player = 'self' | 'opp';

/**
 * AIPolicy — 合法手の中から 1 手を選ぶ意思決定インターフェース。
 *
 * Phase 6 Group A の責務はインターフェースの定義のみ。
 * 具象実装 (Random / Heuristic) は Group B で追加される。
 */
export interface AIPolicy {
  /**
   * Given the current state and a list of legal moves, choose one.
   * Returns null if no moves are available (shouldn't happen — at minimum endTurn is always available).
   */
  choose(state: GameState, candidates: Move[], byPlayer: Player): Move | null;

  /**
   * Phase 8.7c: ガード判定 (optional)。
   * 防御側の active キャラ候補から 1 つを選んでガードする。null なら passGuard。
   * 未実装ポリシー (RandomPolicy 等) は省略可 — その場合 caller 側は passGuard で fallback。
   *
   * @param ax 進行中の ActionContext (declare 後、guard-window phase)
   * @param candidates 防御側でガード可能な active キャラ一覧
   *                   (engine.flow.guard.candidates() の戻り値)
   */
  chooseGuard?(
    state: GameState,
    ax: import('@/engine/types').ActionContext,
    candidates: ReadonlyArray<{ uid: string; cardId: string }>,
  ): string | null;

  /**
   * Phase 8.7d: カットイン判定 (optional)。
   * コンタクト中の action-1 / action-2 phase で、player が手札から
   * カットイン持ちカードを使うか決める。null なら contact.pass。
   *
   * @param candidates 既に canCutIn を満たすことが確認された手札 cardId 一覧
   */
  chooseCutIn?(
    state: GameState,
    ax: import('@/engine/types').ActionContext,
    player: Player,
    candidates: ReadonlyArray<string>,
  ): string | null;

  /**
   * Phase 8.7e: 変装判定 (optional)。
   * コンタクト中の action-1 / action-2 phase で、player が手札から
   * 変装持ちキャラを使うか決める。null なら disguise スキップ。
   * cutin と排他: 同 phase で chooseCutIn が cardId を返した場合は本関数は呼ばれない。
   */
  chooseDisguise?(
    state: GameState,
    ax: import('@/engine/types').ActionContext,
    player: Player,
    candidates: ReadonlyArray<string>,
  ): string | null;

  /**
   * Phase 8 完全クローズ Commit 3a: ヒラメキ発動/スキップ判定 (optional)。
   * 自分の証拠 (ヒラメキ持ち) がアクション[事件]でリムーブされる際、
   * 発動するか (true) スキップするか (false) を決める。
   * 未実装ポリシーは省略可 — その場合 driver 側は true で fallback。
   */
  chooseHiramekiTrigger?(
    state: GameState,
    pending: { cardId: string; abilityId: string },
  ): boolean;

  /**
   * Phase 8 完全クローズ Commit 3b: ミスリード発動キャラ選択 (optional)。
   * 相手が推理したとき、自分の現場の active ミスリード持ちから発動する組合せを選ぶ。
   * 1 推理に対し何枚でも同時発動可 (rules/13)。
   * 戻り値: 発動する候補の配列 (空配列で全スキップ)。
   */
  chooseMisreadTriggers?(
    state: GameState,
    reasoningUid: string,
    candidates: ReadonlyArray<{ uid: string; x: number }>,
  ): ReadonlyArray<{ uid: string; x: number }>;

  /**
   * Phase 5 advance: 捜査X 順番決定 (rules/13)。
   * defender (公開させられる側) の policy が、公開された X 枚をデッキの下に戻す順番を決める。
   * 戻り値: cardId の配列 (同じカード集合の permutation)。
   * 未実装ポリシーは fallback として peek 順 (atom 側で `?? cardIds`)。
   */
  chooseSouzaOrder?(
    state: GameState,
    defender: Player,
    cardIds: ReadonlyArray<string>,
  ): ReadonlyArray<string>;

  /**
   * Phase 7-3: `$pick` atom target ヒューリスティック選択 (optional)。
   * `resolveEffectPicks` (engine/effect/resolve-picks.ts) が `$pick` placeholder atom を
   * 列挙候補から 1 つに置換する際、verb / args / 自陣敵陣を考慮して best を選ぶ。
   * 戻り値 null → caller 側で先頭採用 fallback (no-op semantics 維持)。
   *
   * @param atomVerb atom verb (例: 'sceneRemove', 'sceneSetState', 'charModifyAP')
   * @param atomArgs atom args (delta / state / cause 等の verb 別判定材料)
   * @param candidates targetCandidates 戻り値 (uid:'$pick' を置換する候補)
   * @param byPlayer 効果発動側プレイヤー
   */
  chooseAtomTarget?(
    state: GameState,
    atomVerb: string,
    atomArgs: Readonly<Record<string, unknown>>,
    candidates: ReadonlyArray<import('@/engine/types').Candidate>,
    byPlayer: Player,
  ): import('@/engine/types').Candidate | null;

  /** Identifier for logging / debug */
  readonly name: string;
}

/**
 * 安全弁: 1 ターンの最大手数。
 * これを超えると playTurn は throw する (バグ検出用)。
 */
const PLAY_TURN_SAFETY_CAP = 200;

/**
 * makeCtx — Move 適用時に flow.* に渡す最小 EffectCtx を生成する。
 *   - source.player のみが必須。area は scene を既定値とする。
 */
function makeCtx(p: Player): EffectCtx {
  return {
    source: { player: p, area: 'scene' },
    bindings: {},
  };
}

/**
 * computeAiCostParams — Phase 9-B (B3 fix) 由来の greedy cost picker 充填。
 * Phase 2c: 旧 populateCostParams (ctx.dyn 直接 mutate) を、engine.flow.activateXxx へ渡す
 * AbilityCostParams の構築に置換 (充填値・順序は同一 = 挙動不変)。
 *
 * cost.pay (src/engine/cost/pay.ts) は `flipFaceUpEvidence` で
 * `ctx.dyn.costParams.flipFaceUpEvidence.indices` を要求し、未供給だと
 * `picks 0 out of [min, max]` で throw する (Random vs Random 100戦で 34% 失敗)。
 *
 * - `flipFaceUpEvidence`: face-down 証拠の先頭から `n.min` 枚を採用
 * - `pay` / `choice` (composite): 全 items を再帰
 * - `choice` の branch 選択: cost.pay 側が「costChoice 未指定 → 最初に canPay する branch」に
 *   fallback するため明示指定は不要
 * - 他: picker 不要のためノーオペ
 */
function computeAiCostParams(
  state: GameState,
  player: Player,
  cost: Cost,
): AbilityCostParams | undefined {
  let flip: { indices: number[] } | undefined;
  const walk = (c: Cost): void => {
    switch (c.kind) {
      case 'pay':
      case 'choice':
        for (const item of c.items) walk(item);
        return;
      case 'flipFaceUpEvidence': {
        const evidence = state.players[player].evidence;
        const indices: number[] = [];
        for (let i = 0; i < evidence.length && indices.length < c.n.min; i++) {
          if (!evidence[i].faceUp) indices.push(i);
        }
        flip = { indices };
        return;
      }
      default:
        // Other cost kinds: no picker needed
        return;
    }
  };
  walk(cost);
  return flip ? { flipFaceUpEvidence: flip } : undefined;
}

/**
 * applyMove — Move kind ごとに対応する engine API を呼ぶ。
 *
 * 重要:
 *   - state は Immer draft (caller が produce() 内で呼ぶ)
 *   - assist / solveCase は flow に専用 API がないため mutate.partner.* を使用
 *   - actionAgainstChar / actionAgainstCase は state machine を最後まで進める
 *   - endTurn は何もせず呼出元 (playTurn) でループを抜ける
 */
export function applyMove(state: GameState, move: Move, byPlayer: Player): void {
  switch (move.kind) {
    case 'handUseCard': {
      engine.flow.handUseCard(state, byPlayer, move.cardId, makeCtx(byPlayer));
      return;
    }
    case 'handUseCardSwitch': {
      // rules/20 §スイッチ: scene 5 埋まりキャラ登場時の代替経路。
      // 第 5 引数 switchRemoveUid を渡すと engine 側で mutate.scene.switchEnter を呼ぶ。
      engine.flow.handUseCard(state, byPlayer, move.cardId, makeCtx(byPlayer), move.removeUid);
      return;
    }
    case 'startNextHint': {
      engine.flow.runNextHint(state, byPlayer);
      return;
    }
    case 'partnerAbility': {
      // Phase 2c (BUG-116 構造解消): cost+ctx 構築 + pay は engine.flow.activatePartnerAbility
      // (UI dispatcher と共通の単一支払点) に委譲。AI は picker 値のみ greedy に事前計算して渡す。
      const partnerCardId = state.players[byPlayer].partner.cardId;
      const partnerDef = partnerCardId ? engine.cards.get(partnerCardId) : null;
      const ab = partnerDef?.abilities.find((a) => a.id === move.abilityId);
      const costParams = ab?.cost ? computeAiCostParams(state, byPlayer, ab.cost) : undefined;
      engine.flow.activatePartnerAbility(state, byPlayer, move.abilityId, costParams);
      return;
    }
    case 'declaredAbility': {
      // Phase 2c: 同上。makeDeclaredAbilCtx は cost def 逆引きの probe としてのみ使用
      // (ctx 構築・pay・BUG-085 の costPaid/dyn 伝播は activateDeclaredAbility 内)。
      const probe = makeDeclaredAbilCtx(state, move.uid, move.abilityId);
      let costParams: AbilityCostParams | undefined;
      if (probe?.source.cardId) {
        const def = engine.cards.get(probe.source.cardId);
        const ab = def?.abilities.find((a) => a.id === move.abilityId);
        if (ab?.cost) {
          costParams = computeAiCostParams(state, probe.source.player as Player, ab.cost);
        }
      }
      engine.flow.activateDeclaredAbility(state, move.uid, move.abilityId, costParams);
      return;
    }
    case 'reasoning': {
      engine.flow.doReasoning(state, move.uid);
      return;
    }
    case 'actionAgainstChar': {
      // Phase 8.7c: 防御側ガード判定を HeuristicPolicy に委譲。
      // 共通ヘルパ resolveActionAgainstChar (src/ai/action-resolution.ts) を経由。
      resolveActionAgainstChar(state, move.byUid, move.targetUid, new HeuristicPolicy());
      return;
    }
    case 'actionAgainstCase': {
      // BUG-144: 防御側 (CPU) に guard 窓を出す (char 経路と同型に HeuristicPolicy を渡す)。
      resolveActionAgainstCase(state, move.byUid, move.targetPlayer, new HeuristicPolicy());
      return;
    }
    case 'assist': {
      // flow.assist は未実装のため mutate.partner.assist を直接呼ぶ。
      // BUG-089: FILE 7 枚以上 → 解決編 移行 + case:to-resolved hook emit は
      // mutate.partner.assist (→ mutate.case.toResolved) に集約済。直接代入 (hook を出さない) は除去。
      engine.mutate.partner.assist(state, byPlayer);
      return;
    }
    case 'solveCase': {
      engine.mutate.partner.solveCase(state, byPlayer);
      return;
    }
    case 'endTurn': {
      // caller (playTurn) がループを抜ける
      return;
    }
  }
}

/**
 * playTurn — 与えられた policy で 1 ターン分の move を繰り返し適用する。
 *
 * 流れ:
 *   1. enumerate → choose → applyMove
 *   2. engine.resolve.runAllUntilEmpty で pendingEffects を解消
 *   3. endTurn (または null) が出るまで繰り返す
 *   4. 200 手で safety cap → throw
 *
 * 注意:
 *   - 戻り値の Move[] は実行した手の順序を保持する
 *   - 状態変更は produce() 経由で行う (Immer)
 *   - state は呼出側で「最新の参照」を保持しないと前の参照を使うと無効になる
 *     → 呼出側で state を **参照渡し** にするため、本関数内で参照を更新する必要がある
 *     → 関数戻り値で更新後の state も返す設計が望ましいが、本タスクでは Move[] のみ返す
 *       (state を mutate するためには caller が produce 結果を受ける形にする必要がある)
 *
 * Phase 6 Group A の playTurn は **戻り値で Move[] を返し、state は引数で渡された
 * オブジェクトを Immer produce で書き換えた結果を返す形** にする。
 * しかし TypeScript の immutability 観点から、本実装では caller が
 *   ```
 *   const moves = playTurn(state, policy, p);
 *   // state は moves の playback で更新したい場合は別途 produce で
 *   ```
 * と扱うことを前提とせず、state を「ローカル変数として保持・更新」する形で実装する。
 *
 * 解決策: playTurn は state を引数で受け、関数内で produce を繰り返し適用しつつ
 * `result` プロパティを介して呼出側に最終 state を渡す API を別途用意するか、
 * 戻り値を `{ moves, finalState }` にする。本タスクでは後者を採用する。
 */
/**
 * Phase 8 完全クローズ Commit 2.5: playTurn の停止可能化。
 * pauseOnAction を true にすると、action move (`actionAgainstChar` / `actionAgainstCase`)
 * を選んだ時点で applyMove せず paused で early return する。UI 側 (useOppTurnDriver)
 * が dispatchEngineAction({type:'actionDeclareChar/Case', ...}) で declare を呼び、
 * useContactFlowDriver にコンタクト FSM を委譲することで、CPU 攻撃時も人間プレイヤーの
 * ガード/カットイン/変装モーダルが正しく開く。
 */
export type PlayTurnOptions = {
  pauseOnAction?: boolean;
};

export type PlayTurnResult = {
  moves: Move[];
  finalState: GameState;
  /**
   * pauseOnAction 時、action move が選ばれた場合に set される (move 同梱)。
   * BUG-138 (X8): human 所有の pending pick が queue に残っている場合は move を打たず
   * humanPick:true で停止する (rules/05 効果解決中は次の行動に移れない)。
   * caller (useOppTurnDriver) は surfacePendingSideChannels で modal へ転送し、
   * 解決後の re-fire で続きの move から再開する。
   */
  paused?: { move?: Move; humanPick?: true };
};

export function playTurn(
  state: GameState,
  policy: AIPolicy,
  byPlayer: Player,
  opts?: PlayTurnOptions,
): PlayTurnResult {
  const moves: Move[] = [];
  let s = state;

  for (let i = 0; i < PLAY_TURN_SAFETY_CAP; i++) {
    // Task3: 1手駆動を stepTurn に委譲。playTurn は「stepTurn ループ」として再構成
    // (結果は従来 playTurn と byte 等価 / tests/ai/step-turn.test.ts)。
    const step = stepTurn(s, policy, byPlayer, opts);
    s = step.nextState;
    if (step.paused) return { moves, finalState: s, paused: step.paused };
    if (step.move) moves.push(step.move);
    if (step.done) return { moves, finalState: s };
  }

  throw new Error(
    `playTurn: ${PLAY_TURN_SAFETY_CAP}-move safety cap exceeded for ${byPlayer} — possible infinite loop. Last moves: ${moves
      .slice(-5)
      .map(m => m.kind)
      .join(', ')}`,
  );
}

/**
 * StepTurnResult — stepTurn の戻り値。done / paused で停止判定する。
 */
export type StepTurnResult = {
  /** 適用した move。pause / 候補なし のとき null。 */
  move: Move | null;
  /** この step 適用後の state (pause / 候補なし のときは入力 state のまま)。 */
  nextState: GameState;
  /** endTurn / 候補なし / gameResult 確定 で true (ターン終了)。 */
  done: boolean;
  /** pauseOnAction の action move、または human pending pick による停止。 */
  paused?: { move?: Move; humanPick?: true };
};

/**
 * stepTurn — playTurn ループの 1 反復 (Task3)。1 手だけ enumerate→choose→applyMove→runAllUntilEmpty する。
 * UI (useOppTurnDriver) が 1 手ごとに間 (aiSpeedMs) を挟んで CPU を可視化するための entry point。
 * 戻り値 nextState を次回 stepTurn に渡して反復し、done / paused で停止する。
 */
export function stepTurn(
  state: GameState,
  policy: AIPolicy,
  byPlayer: Player,
  opts?: PlayTurnOptions,
): StepTurnResult {
  // BUG-138 (X8): human 所有の未解決 pick が残っている間は次の move に移れない (rules/05)。
  // __humanPlayerSide 未設定 (smoke / spectator) では常に false → 従来挙動不変。
  if (hasPendingHumanPick()) {
    return { move: null, nextState: state, done: false, paused: { humanPick: true } };
  }
  const candidates = enumerateMoves(state, byPlayer);
  const chosen = policy.choose(state, candidates, byPlayer);
  if (chosen === null) {
    // 候補が無い (起こり得ない — endTurn が常にある)。安全側で終了する。
    return { move: null, nextState: state, done: true };
  }
  if (chosen.kind === 'endTurn') {
    return { move: chosen, nextState: state, done: true };
  }
  // Commit 2.5: action move pause — applyMove せず paused で返す (UI が contact FSM へ委譲)。
  if (
    opts?.pauseOnAction &&
    (chosen.kind === 'actionAgainstChar' || chosen.kind === 'actionAgainstCase')
  ) {
    return { move: null, nextState: state, done: false, paused: { move: chosen } };
  }
  let s = produce(state, draft => {
    applyMove(draft, chosen, byPlayer);
  });
  // pendingEffects があれば解消する
  s = produce(s, draft => {
    engine.resolve.runAllUntilEmpty(draft);
    // BUG-109: CPU には human modal が無いため、PA 短縮形 atom 等が runtime に
    // __pendingEffectPickQueue へ積んだ pick が drain されず no-op になる。heuristic で順次解決する
    // (chooseAtomTarget は walk と同じ HeuristicPolicy を使用。continuation も BUG-107 機構で進む)。
    drainAiEffectPicks(draft, new HeuristicPolicy());
  });
  return { move: chosen, nextState: s, done: Boolean(s.gameResult) };
}
