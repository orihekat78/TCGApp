// ai.action-resolution — Phase 8.7c: アクション宣言の共通解決ヘルパ
//
// rules: 07-action-flow.md / 08-contact.md
// spec: .claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md
//
// 役割:
//   policy.applyMove と useEngineDispatch (UI) の actionAgainstChar / actionAgainstCase
//   が同じシーケンスで FSM を端まで進める必要がある。Phase 8.7a までは両者に inline で
//   重複していたが、Phase 8.7c でガード判定を追加するにあたり、一本化する。
//
// 設計:
//   - state は Immer draft (caller が produce() 内で呼ぶ)
//   - defenderPolicy.chooseGuard? を呼んでガード判定。未実装 / null 返却なら passGuard
//   - actionAgainstCase は contact 省略 (rules/10: 証拠リムーブ + 自証拠獲得のみ)

import { engine } from '@/engine';
import type { GameState, ActionContext } from '@/engine/types';
import type { AIPolicy } from './policy.js';

type Player = 'self' | 'opp';

/**
 * uid のオーナープレイヤーを判定 (cutin 解決時の player 特定用)。
 */
function ownerOfUid(s: GameState, uid: string): Player | null {
  if (uid === 'partner:self') return 'self';
  if (uid === 'partner:opp') return 'opp';
  for (const p of ['self', 'opp'] as const) {
    if (s.players[p].scene.some((c) => c.uid === uid)) return p;
  }
  return null;
}

/**
 * Phase 8.7d: action-1 / action-2 phase の cutin 判定を解決する。
 *
 * - which='firstUid' なら 1番目 (ax.firstUid)、'secondUid' なら 2番目 (ax.secondUid)
 * - 該当プレイヤーの AI policy.chooseCutIn? を呼び、
 *   - 戻り値が cardId → contact.cutIn + runAllUntilEmpty で AP+ 等の効果解決
 *   - null → contact.pass
 * - ax.firstActed / secondActed フラグを設定 (engine FSM の action-1-redo 判定用)
 */
function resolveCutInForPhase(
  state: GameState,
  ax: ActionContext,
  attackerPolicy: AIPolicy,
  defenderPolicy: AIPolicy,
  which: 'firstUid' | 'secondUid',
): void {
  const flagKey: 'firstActed' | 'secondActed' = which === 'firstUid' ? 'firstActed' : 'secondActed';
  const uid = ax[which];
  if (!uid) {
    ax[flagKey] = false;
    return;
  }
  const player = ownerOfUid(state, uid);
  if (!player) {
    ax[flagKey] = false;
    return;
  }
  const policy = uid === ax.byUid ? attackerPolicy : defenderPolicy;

  // 1) cutin を試す (Phase 8.7d)
  if (policy.chooseCutIn) {
    const cutinCands = state.players[player].hand.filter((c) =>
      engine.flow.contact.canCutIn(state, ax, player, c),
    );
    const cutinChoice = policy.chooseCutIn(state, ax, player, cutinCands);
    if (cutinChoice !== null) {
      engine.flow.contact.cutIn(state, ax, player, cutinChoice);
      engine.resolve.runAllUntilEmpty(state);
      ax[flagKey] = true;
      return;
    }
  }

  // 2) cutin が選ばれなければ disguise を試す (Phase 8.7e)
  if (policy.chooseDisguise) {
    const disgCands = state.players[player].hand.filter((c) =>
      engine.flow.contact.canDisguise(state, ax, player, c),
    );
    const disgChoice = policy.chooseDisguise(state, ax, player, disgCands);
    if (disgChoice !== null) {
      engine.flow.contact.disguise(state, ax, player, disgChoice);
      engine.resolve.runAllUntilEmpty(state);
      ax[flagKey] = true;
      return;
    }
  }

  // 3) どちらも選ばれなければ pass
  engine.flow.contact.pass(state, ax, player);
  ax[flagKey] = false;
}

/**
 * アクション [キャラ] の完全解決 (rules/07 / rules/08)。
 *
 * Phase 6 簡略実装をベースに、ガード判定だけ defenderPolicy.chooseGuard に委譲。
 * カットイン / 変装は Phase 8.7d / 8.7e で追加予定 (現状 advance × 4 で素通り)。
 */
export function resolveActionAgainstChar(
  state: GameState,
  byUid: string,
  targetUid: string,
  defenderPolicy: AIPolicy,
  attackerPolicy: AIPolicy = defenderPolicy,
): void {
  const ax = engine.flow.action.declare(state, byUid, { kind: 'char', uid: targetUid });

  // ガード判定 (Phase 8.7c)
  // Task D E4: アクション対象自身はガード候補から除外 (B09028/B09054 Q&A)
  const cands = engine.flow.guard.candidates(state, ax.byUid, ax.target.kind === 'char' ? ax.target.uid : undefined);
  const guardUid =
    cands.length > 0 && defenderPolicy.chooseGuard
      ? defenderPolicy.chooseGuard(state, ax, cands)
      : null;
  if (guardUid !== null) {
    engine.flow.action.tryGuard(state, ax, guardUid);
  } else {
    engine.flow.action.passGuard(state, ax);
  }
  // Task D E4 (2026-06-12): action:guarded / action:unguarded で queue された triggered effect
  // (例: B09041 a2 がガードキャラへ contactImmune_action を grant) を judge 前に解決する。
  // 従来 drain は cutin/disguise 成立時のみで、CPU 経路では judge 後まで未解決だった。
  engine.resolve.runAllUntilEmpty(state);

  // FSM 進行 + カットイン判定 (Phase 8.7d)
  engine.flow.action.advance(state, ax); // leave-resolution → contact-pending
  engine.flow.action.advance(state, ax); // contact-pending → action-1

  // 1番目 のカットイン判定
  resolveCutInForPhase(state, ax, attackerPolicy, defenderPolicy, 'firstUid');
  engine.flow.action.advance(state, ax); // action-1 → action-2

  // 2番目 のカットイン判定
  resolveCutInForPhase(state, ax, attackerPolicy, defenderPolicy, 'secondUid');
  engine.flow.action.advance(state, ax); // action-2 → judge (or action-1-redo)

  // action-1-redo: 1番目 pass + 2番目 行動 のとき発生 → 1番目 にもう一度チャンス
  // (Phase 8.7d は redo パスでも同じヒューリスティック判定を使う)
  if (ax.phase === 'action-1-redo') {
    resolveCutInForPhase(state, ax, attackerPolicy, defenderPolicy, 'firstUid');
    engine.flow.action.advance(state, ax); // action-1-redo → judge
  }

  engine.flow.action.snapshotAP(state, ax);
  engine.flow.contact.judge(state, ax);
  engine.flow.action.advance(state, ax); // judge → contact-end
  engine.flow.action.advance(state, ax); // contact-end → action-end
}

/**
 * アクション [事件] の完全解決 (rules/10)。
 *
 * - declare → passGuard (case ターゲットには guard 不可能、rules/08)
 * - removeOpponentEvidenceTop → gainSelfEvidence
 * - judge → contact-end → action-end へ advance × 2
 */
export function resolveActionAgainstCase(
  state: GameState,
  byUid: string,
  targetPlayer: Player,
): void {
  const ax = engine.flow.action.declare(state, byUid, { kind: 'case', player: targetPlayer });
  engine.flow.action.passGuard(state, ax);
  engine.flow.actionCase.removeOpponentEvidenceTop(state, ax);
  engine.flow.actionCase.gainSelfEvidence(state, ax);
  engine.flow.action.advance(state, ax); // judge → contact-end
  engine.flow.action.advance(state, ax); // contact-end → action-end
}
