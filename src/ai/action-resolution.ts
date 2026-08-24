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
//   - actionAgainstCase はガード不成立時のみ contact 省略
//     (rules/10: 証拠リムーブ + 自証拠獲得)

import {
  _drainPendingHirameki,
  _markPendingHiramekiGainDeferred,
  _peekPendingHirameki,
  engine,
} from '@/engine';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick.js';
import type { GameState, ActionContext } from '@/engine/types';
import type { AIPolicy } from './policy.js';
import { chooseAiCutInDeclaredName } from './cutin-declared-name.js';

type Player = 'self' | 'opp';

// engine拡張 wave#2 cluster3 (2026-06-13, BUG-141): 宣言時 trigger (action:declare) の効果は
// 公式裁定「ガード判定より前に発動・解決される」(rules/22 + TSV qAndA B08048/B01036/B02068)。
// CPU 経路は従来 chooseGuard の後にしか drain しておらず、B01036 (ガード候補をスリープで奪う) 等が
// 逆順で機能しなかった。declare 直後に stack + AI pick を drain してガード判定前に解決を完了させる。
type EffectPickPolicy = { chooseAtomTarget?: NonNullable<AIPolicy['chooseAtomTarget']> };

function drainQueuedEffects(state: GameState, policy?: EffectPickPolicy): void {
  engine.resolve.runAllUntilEmpty(state);
  drainAiEffectPicks(state, policy);
  // pick 解決後に continuation (chain/sequence の後続) が積まれる場合があるため再度 stack を流す。
  engine.resolve.runAllUntilEmpty(state);
}

function actionEffectPickPolicy(
  ax: ActionContext,
  attackerPolicy?: AIPolicy,
  defenderPolicy?: AIPolicy,
): EffectPickPolicy | undefined {
  if (!attackerPolicy?.chooseAtomTarget && !defenderPolicy?.chooseAtomTarget) return undefined;
  return {
    chooseAtomTarget: (state, verb, args, candidates, byPlayer) => {
      const policy = byPlayer === ax.byPlayer ? attackerPolicy : defenderPolicy;
      return policy?.chooseAtomTarget?.(state, verb, args, candidates, byPlayer) ?? null;
    },
  };
}

function drainActionEffects(
  state: GameState,
  ax: ActionContext,
  attackerPolicy?: AIPolicy,
  defenderPolicy?: AIPolicy,
): void {
  drainQueuedEffects(state, actionEffectPickPolicy(ax, attackerPolicy, defenderPolicy));
}

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

function currentActionContext(state: GameState, actionId: string): ActionContext | undefined {
  return engine.flow.action._getContext(state, actionId);
}

/**
 * Effect resolution can replace the state-owned ActionContext. Re-read it before
 * continuing the synchronous AI/UI sequence, and close an early-ended contact.
 */
function resumeContactAt(
  state: GameState,
  actionId: string,
  expectedPhases: readonly ActionContext['phase'][],
  attackerPolicy?: AIPolicy,
  defenderPolicy?: AIPolicy,
): ActionContext | undefined {
  let current = currentActionContext(state, actionId);
  if (!current) return undefined;
  if (current.phase === 'contact-end') {
    // contact:end observers resolve before action:end and before the serialized
    // context is deleted. Re-read after draining because an effect may replace
    // or terminate the state-owned ActionContext.
    drainActionEffects(state, current, attackerPolicy, defenderPolicy);
    current = currentActionContext(state, actionId);
    if (!current || current.phase !== 'contact-end') return undefined;
    engine.flow.action.advance(state, current);
    drainActionEffects(state, current, attackerPolicy, defenderPolicy);
    return undefined;
  }
  if (!expectedPhases.includes(current.phase)) {
    throw new Error(
      `resolveContactSequence: expected ${expectedPhases.join(' or ')}, got ${current.phase}`,
    );
  }
  return current;
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
  attackerPolicy: AIPolicy | undefined,
  defenderPolicy: AIPolicy | undefined,
  which: 'firstUid' | 'secondUid',
): void {
  const flagKey: 'firstActed' | 'secondActed' = which === 'firstUid' ? 'firstActed' : 'secondActed';
  const uid = ax[which];
  if (!uid) {
    const current = currentActionContext(state, ax.id);
    if (current) current[flagKey] = false;
    return;
  }
  const player = ownerOfUid(state, uid);
  if (!player) {
    const current = currentActionContext(state, ax.id);
    if (current) current[flagKey] = false;
    return;
  }
  const policy = uid === ax.byUid ? attackerPolicy : defenderPolicy;

  // 1) cutin を試す (Phase 8.7d)
  if (policy?.chooseCutIn) {
    const cutinCands = state.players[player].hand.filter((c) =>
      engine.flow.contact.canCutIn(state, ax, player, c),
    );
    const cutinChoice = policy.chooseCutIn(state, ax, player, cutinCands);
    if (cutinChoice !== null) {
      const declaredName = chooseAiCutInDeclaredName(state, ax, player, cutinChoice);
      const spec = engine.flow.contact.cutInDeclaredNameSpec(state, ax, player, cutinChoice);
      if (!spec || spec.optional || spec.domain === 'unrestricted' || declaredName !== undefined) {
        engine.flow.contact.cutIn(state, ax, player, cutinChoice, undefined, declaredName);
        drainActionEffects(state, ax, attackerPolicy, defenderPolicy);
        const current = currentActionContext(state, ax.id);
        if (current) current[flagKey] = true;
        return;
      }
    }
  }

  // 2) cutin が選ばれなければ disguise を試す (Phase 8.7e)
  if (policy?.chooseDisguise) {
    const disgCands = state.players[player].hand.filter((c) =>
      engine.flow.contact.canDisguise(state, ax, player, c),
    );
    const disgChoice = policy.chooseDisguise(state, ax, player, disgCands);
    if (disgChoice !== null) {
      engine.flow.contact.disguise(state, ax, player, disgChoice);
      drainActionEffects(state, ax, attackerPolicy, defenderPolicy);
      const current = currentActionContext(state, ax.id);
      if (current) current[flagKey] = true;
      return;
    }
  }

  // 3) どちらも選ばれなければ pass
  engine.flow.contact.pass(state, ax, player);
  const current = currentActionContext(state, ax.id);
  if (current) current[flagKey] = false;
}

/** Drive every contact phase shared by character targets and guarded cases. */
function resolveContactSequence(
  state: GameState,
  ax: ActionContext,
  attackerPolicy?: AIPolicy,
  defenderPolicy?: AIPolicy,
): void {
  const actionId = ax.id;
  engine.flow.action.advance(state, ax); // leave-resolution → contact-pending
  engine.flow.action.advance(state, ax); // contact-pending → action-1
  drainActionEffects(state, ax, attackerPolicy, defenderPolicy);

  let current = resumeContactAt(state, actionId, ['action-1'], attackerPolicy, defenderPolicy);
  if (!current) return;
  resolveCutInForPhase(state, current, attackerPolicy, defenderPolicy, 'firstUid');
  current = resumeContactAt(state, actionId, ['action-1'], attackerPolicy, defenderPolicy);
  if (!current) return;
  engine.flow.action.advance(state, current); // action-1 → action-2

  current = resumeContactAt(state, actionId, ['action-2'], attackerPolicy, defenderPolicy);
  if (!current) return;
  resolveCutInForPhase(state, current, attackerPolicy, defenderPolicy, 'secondUid');
  current = resumeContactAt(state, actionId, ['action-2'], attackerPolicy, defenderPolicy);
  if (!current) return;
  engine.flow.action.advance(state, current); // action-2 → judge (or action-1-redo)

  current = resumeContactAt(state, actionId, ['judge', 'action-1-redo'], attackerPolicy, defenderPolicy);
  if (!current) return;
  if (current.phase === 'action-1-redo') {
    resolveCutInForPhase(state, current, attackerPolicy, defenderPolicy, 'firstUid');
    current = resumeContactAt(state, actionId, ['action-1-redo'], attackerPolicy, defenderPolicy);
    if (!current) return;
    engine.flow.action.advance(state, current); // action-1-redo → judge
  }

  current = resumeContactAt(state, actionId, ['judge'], attackerPolicy, defenderPolicy);
  if (!current) return;
  engine.flow.action.snapshotAP(state, current);
  engine.flow.contact.judge(state, current);
  drainActionEffects(state, current, attackerPolicy, defenderPolicy);
  current = resumeContactAt(state, actionId, ['judge'], attackerPolicy, defenderPolicy);
  if (!current) return;
  engine.flow.action.advance(state, current); // judge → contact-end
  resumeContactAt(state, actionId, [], attackerPolicy, defenderPolicy); // contact-end → action-end
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

  // BUG-141 (cluster3): 宣言時 trigger の効果をガード判定前に解決 (rules/22 R1)。
  // attackerPolicy で drain (発火源は攻撃側カード。AI-vs-AI は humanSide null で全 pick が drain される)。
  drainQueuedEffects(state, attackerPolicy);

  if (engine.flow.action.abortIfMissing(state, ax)) return;

  // ガード判定 (Phase 8.7c)
  // Task D E4: アクション対象自身はガード候補から除外 (B09028/B09054 Q&A)
  const guardExclude = ax.target.kind === 'char' ? ax.target.uid : undefined;
  const cands = engine.flow.guard.candidates(state, ax.byUid, guardExclude);
  // W2b (2026-07-03, r28): mustGuard 義務 (B09040 a2)。義務 char が居れば policy 判断を上書きして
  // 必ずその中からガードさせる (passGuard/tryGuard の throw fail-safe を踏ませない)。
  // policy が義務 char を選んでいればそれを尊重、そうでなければ義務先頭。義務 0 件は従来挙動。
  const mustCands = engine.flow.guard.mustGuardCandidates(state, ax.byUid, guardExclude);
  const policyChoice =
    cands.length > 0 && defenderPolicy.chooseGuard
      ? defenderPolicy.chooseGuard(state, ax, cands)
      : null;
  const guardUid = mustCands.length > 0
    ? (policyChoice !== null && mustCands.some(c => c.uid === policyChoice) ? policyChoice : mustCands[0]!.uid)
    : policyChoice;
  if (guardUid !== null) {
    engine.flow.action.tryGuard(state, ax, guardUid);
  } else {
    engine.flow.action.passGuard(state, ax);
  }
  // Task D E4 (2026-06-12): action:guarded / action:unguarded で queue された triggered effect
  // (例: B09041 a2 がガードキャラへ contactImmune_action を grant) を judge 前に解決する。
  // 従来 drain は cutin/disguise 成立時のみで、CPU 経路では judge 後まで未解決だった。
  drainActionEffects(state, ax, attackerPolicy, defenderPolicy);

  resolveContactSequence(state, ax, attackerPolicy, defenderPolicy);
}

/**
 * アクション [事件] の完全解決 (rules/07 / rules/10)。
 *
 * BUG-144 (2026-06-15): アクション[事件] も rules/07-08 でガード可能。defenderPolicy.chooseGuard に
 * 委譲し、ガード成立時は contact AP 判定 (攻撃 vs ガード) のみ・証拠変動なし、不成立時のみ rules/10
 * の証拠リムーブ + 自証拠獲得を行う。これは human 経路 useEngineDispatch actionJudge の分岐
 * (`case && !guardUid` → 証拠操作 / else → snapshotAP+judge、user_request 20260522_01 #8 で確定) と同型。
 * - declare → drainQueuedEffects (宣言時 trigger をガード判定前に解決、BUG-141)
 * - defenderPolicy?.chooseGuard で guard 判定 (候補は scene の active キャラ、partner 不可)
 * - guard 成立: full contact (cutin / disguise を含む、証拠変動なし)
 * - guard 不成立: evidence remove → exact Hirameki checkpoint → deferred gain → advance × 2
 */
export function resolveActionAgainstCase(
  state: GameState,
  byUid: string,
  targetPlayer: Player,
  defenderPolicy?: AIPolicy,
  attackerPolicy?: AIPolicy,
): void {
  const ax = engine.flow.action.declare(state, byUid, { kind: 'case', player: targetPlayer });
  // BUG-141 (cluster3, F3-i): case アクションの宣言時 trigger (B01068/B02068 のブレット付与等) も
  // ガード判定前に解決する。drain 経路は従来挙動を維持 (attackerPolicy 未指定なら全 pick drain)。
  drainQueuedEffects(state, attackerPolicy);

  if (engine.flow.action.abortIfMissing(state, ax)) return;

  // BUG-144: ガード判定 (rules/07-08)。case target は対象自身の除外なし (guardExclude=undefined)。
  const cands = engine.flow.guard.candidates(state, ax.byUid, undefined);
  // W2b (2026-07-03, r28): mustGuard 義務 — char アクション側と同型の policy 上書き。
  const mustCands = engine.flow.guard.mustGuardCandidates(state, ax.byUid, undefined);
  const policyChoice =
    cands.length > 0 && defenderPolicy?.chooseGuard
      ? defenderPolicy.chooseGuard(state, ax, cands)
      : null;
  const guardUid = mustCands.length > 0
    ? (policyChoice !== null && mustCands.some(c => c.uid === policyChoice) ? policyChoice : mustCands[0]!.uid)
    : policyChoice;
  if (guardUid !== null) {
    engine.flow.action.tryGuard(state, ax, guardUid);
  } else {
    engine.flow.action.passGuard(state, ax);
  }
  // action:guarded / action:unguarded で queue された triggered effect を judge/証拠操作の前に解決
  // (resolveActionAgainstChar と同型)。
  drainActionEffects(state, ax, attackerPolicy, defenderPolicy);

  if (ax.guardUid) {
    // ガード成立 → 攻撃キャラ vs ガードキャラの full contact。証拠変動なし。
    resolveContactSequence(
      state,
      ax,
      attackerPolicy ?? defenderPolicy,
      defenderPolicy,
    );
  } else {
    // ガード不成立 → rules/10: 相手証拠 -1 + 自証拠 +1 (passGuard は phase を judge に設定済)。
    engine.flow.actionCase.removeOpponentEvidenceTop(state, ax);
    const pendingHirameki = _peekPendingHirameki();
    if (pendingHirameki !== null) {
      if (!engine.flow.actionCase.matchesHiramekiCheckpoint(state, ax, pendingHirameki)) {
        throw new Error('resolveActionAgainstCase: Hirameki checkpoint does not match active action');
      }
      _markPendingHiramekiGainDeferred();
      const decision = _drainPendingHirameki();
      if (
        decision === null
        || decision.gainDeferred !== true
        || !engine.flow.actionCase.matchesHiramekiCheckpoint(state, ax, decision)
      ) {
        throw new Error('resolveActionAgainstCase: failed to claim Hirameki checkpoint');
      }
      ax.deferredCaseEvidenceGain = true;
      ax.judgeResolved = true;
      const ownerPolicy = decision.player === ax.byPlayer ? attackerPolicy : defenderPolicy;
      const fire = ownerPolicy?.chooseHiramekiTrigger?.(state, {
        cardId: decision.cardId,
        abilityId: decision.abilityId,
      }) ?? true;
      engine.flow.actionCase.resolveHiramekiDecision(
        state,
        ax,
        decision,
        fire ? 'fire' : 'skip',
        {
          chooseAtomTarget: actionEffectPickPolicy(ax, attackerPolicy, defenderPolicy)?.chooseAtomTarget,
          humanChooser: false,
        },
      );
      drainActionEffects(state, ax, attackerPolicy, defenderPolicy);
    } else {
      drainActionEffects(state, ax, attackerPolicy, defenderPolicy);
      engine.flow.actionCase.gainSelfEvidence(state, ax);
      drainActionEffects(state, ax, attackerPolicy, defenderPolicy);
      ax.judgeResolved = true;
    }
    engine.flow.action.advance(state, ax); // judge → contact-end
    drainActionEffects(state, ax, attackerPolicy, defenderPolicy);
    engine.flow.action.advance(state, ax); // contact-end → action-end
    drainActionEffects(state, ax, attackerPolicy, defenderPolicy);
  }
}
