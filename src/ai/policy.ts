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

import type { GameState, EffectCtx } from '@/engine/types';
import { engine } from '@/engine';
import { produce } from 'immer';
import { enumerateMoves, type Move } from './move-enumerator.js';
import { resolveActionAgainstChar, resolveActionAgainstCase } from './action-resolution.js';
import { HeuristicPolicy } from './policies/heuristic.js';
import { makePartnerAbilCtx, makeDeclaredAbilCtx } from './ability-ctx.js';

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
    case 'startNextHint': {
      engine.flow.runNextHint(state, byPlayer);
      return;
    }
    case 'partnerAbility': {
      // Phase 8.8d: cost があれば pay → flow.useXxx (UI 側と対称な atomic)
      const partnerCardId = state.players[byPlayer].partner.cardId;
      const partnerDef = partnerCardId ? engine.cards.get(partnerCardId) : null;
      const ab = partnerDef?.abilities.find((a) => a.id === move.abilityId);
      if (ab?.cost && partnerCardId) {
        const ctx = makePartnerAbilCtx(byPlayer, partnerCardId, move.abilityId);
        engine.cost.pay(state, ab.cost, ctx);
      }
      engine.flow.usePartnerAbility(state, byPlayer, move.abilityId, makeCtx(byPlayer));
      return;
    }
    case 'declaredAbility': {
      // Phase 8.8d: 同じく cost あれば pay
      const ctx = makeDeclaredAbilCtx(state, move.uid, move.abilityId);
      if (ctx?.source.cardId) {
        const def = engine.cards.get(ctx.source.cardId);
        const ab = def?.abilities.find((a) => a.id === move.abilityId);
        if (ab?.cost) engine.cost.pay(state, ab.cost, ctx);
      }
      engine.flow.useDeclaredAbility(state, move.uid, move.abilityId, makeCtx(byPlayer));
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
      resolveActionAgainstCase(state, move.byUid, move.targetPlayer);
      return;
    }
    case 'assist': {
      // flow.assist は未実装のため mutate.partner.assist を直接呼ぶ。
      engine.mutate.partner.assist(state, byPlayer);
      // FILE 7 枚以上で事件編 → 解決編 (rules/01, 25)
      const ps = state.players[byPlayer];
      if (ps.case.status === '事件編' && ps.file.length >= 7) {
        ps.case.status = '解決編';
      }
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
export type PlayTurnResult = {
  moves: Move[];
  finalState: GameState;
};

export function playTurn(
  state: GameState,
  policy: AIPolicy,
  byPlayer: Player,
): PlayTurnResult {
  const moves: Move[] = [];
  let s = state;

  for (let i = 0; i < PLAY_TURN_SAFETY_CAP; i++) {
    const candidates = enumerateMoves(s, byPlayer);
    const chosen = policy.choose(s, candidates, byPlayer);
    if (chosen === null) {
      // 候補が無い (起こり得ない — endTurn が常にある)。安全側で終了する。
      return { moves, finalState: s };
    }
    moves.push(chosen);
    if (chosen.kind === 'endTurn') {
      return { moves, finalState: s };
    }
    s = produce(s, draft => {
      applyMove(draft, chosen, byPlayer);
    });
    // pendingEffects があれば解消する
    s = produce(s, draft => {
      engine.resolve.runAllUntilEmpty(draft);
    });
    // gameResult が決まったら終了
    if (s.gameResult) {
      return { moves, finalState: s };
    }
  }

  throw new Error(
    `playTurn: ${PLAY_TURN_SAFETY_CAP}-move safety cap exceeded for ${byPlayer} — possible infinite loop. Last moves: ${moves
      .slice(-5)
      .map(m => m.kind)
      .join(', ')}`,
  );
}
