// engine.flow.actionCase — アクション[事件] 処理 (Phase 4 Group B Task 4.6)
// spec: .claude/specs/engine-api-flow-contact.md
// rules: 07-action-flow.md, 10-action-event.md
//
// 提供 API:
//   - removeOpponentEvidenceTop: 相手証拠最上部1枚を取り出し → リムーブ
//                                + evidence:remove-by-action emit (ヒラメキ判定窓)
//   - flashWindow:               (Phase 4 stub、Phase 7-1/7-2 で実機構は evidence:remove-by-action
//                                  listener (hirameki.ts) + shared resolveHiramekiDecision に
//                                  移行済。本関数は legacy log 専用で外部呼び出しなし)
//   - gainSelfEvidence:          自分の証拠+1 (LP無関係) — byUid 不在でも進める

import type { ActionContext, CausalEffectTrace, EffectCtx, EvidenceCard, GameState } from '../types/index.js';
import { mutate } from '../mutate/index.js';
import { event } from '../event/index.js';
import { resolveEffectPicks, type ChooseAtomTargetFn } from '../effect/resolve-picks.js';
import { appendCausal, isCausalLogEntry, type AppendCausalInput } from '../log/causal.js';
import {
  cloneCausalEffectTrace,
  recordCausalTraceOperation,
  withStructuredCausalResolution,
} from '../log/effect-causal.js';
import type { PendingHiramekiSide } from '../listeners/hirameki.js';
import { def as readDef } from '../read/def.js';
import { recordActionCausalOperation } from './action/causal.js';
import { isLegacyReplayHiramekiCompatibilityActive } from './action/legacy-replay-compat.js';
import { cardOccurrenceUid, cardOccurrenceWitness, isLiveCardOccurrenceWitness } from '../target/card-occurrence.js';

type Player = 'self' | 'opp';

/**
 * removeOpponentEvidenceTop — 相手証拠最上部1枚をリムーブ
 *
 * - mutate.evidence.removeTop が証拠 → リムーブエリア へ移動 (rules/10)
 * - evidence:remove-by-action emit (spec: { player, ev })
 * - 戻り値: 取り出した EvidenceCard (なければ undefined)
 *
 * 注意: spec では「ヒラメキ判定窓」はこの Hook で発火させる設計だが、
 *       Phase 7-1/7-2 で `evidence:remove-by-action` listener (hirameki.ts) +
 *       UI/AI 共通の `resolveHiramekiDecision` 経路に移行済。flashWindow は legacy stub。
 */
export function removeOpponentEvidenceTop(
  state: GameState,
  ax: ActionContext,
): EvidenceCard | undefined {
  if (ax.target.kind !== 'case') {
    throw new Error('flow.actionCase.removeOpponentEvidenceTop: target is not case');
  }
  const player: Player = ax.target.player;
  const ev = mutate.evidence.removeTop(state, player);
  if (!ev) return undefined;
  const causalCorrelationEventId = recordActionCausalOperation(state, ax, {
    actor: ax.byPlayer,
    kind: 'zone-move',
    source: { kind: 'zone', side: player, zone: 'evidence' },
    targets: [{ kind: 'zone', side: player, zone: 'remove' }],
    outcome: { type: 'move', from: 'evidence', to: 'remove', count: 1 },
  });

  // evidence:remove-by-action emit (spec: { player, ev })
  // engine wave-11 (2026-07-02): byUid = アクション[事件] actor の snapshot を payload に併記。
  // 「アクション中のキャラ」hirameki (B03085/B05032/B05111) が effect 内 '$trigger.byUid' で参照する
  // (公式Q&A B05111: ヒラメキを発動させた=アクション[事件]した キャラが該当)。既存 consumer
  // (triggered.ts handleEvidenceRemovedHook) は player/ev のみ参照 → additive。source の uid と
  // 同値だが、payload flat 一階解決 (resolveBindRef $trigger.<field>) は source を見ないため payload に併記。
  event.emit(
    state,
    'evidence:remove-by-action',
    {
      player,
      ev,
      byUid: ax.byUid,
      actionId: ax.id,
      ...(causalCorrelationEventId ? { causalCorrelationEventId } : {}),
      occurrence: {
        uid: cardOccurrenceUid(player, 'remove', ev.cardId, state.players[player].remove.length - 1),
        player,
        cardId: ev.cardId,
        area: 'remove',
        index: state.players[player].remove.length - 1,
        occurrenceWitness: cardOccurrenceWitness(state, player, 'remove'),
      },
    },
    { player: ax.byPlayer, uid: ax.byUid },
    causalCorrelationEventId ? { causalCorrelationEventId } : undefined,
  );

  return ev;
}

/**
 * flashWindow — ヒラメキ判定窓 (Phase 4 legacy stub)
 *
 * Phase 7-1/7-2 で実機構は移行済:
 *   - `evidence:remove-by-action` event を `removeOpponentEvidenceTop` が emit
 *   - `src/engine/listeners/hirameki.ts` が捕捉、pendingHirameki side-channel set
 *   - UI/AI が `resolveHiramekiDecision` → `resolveEffectPicks` で effect 解決
 *
 * 本関数は **legacy log 専用** で、外部呼び出しは無し (barrel から export はされるが unused)。
 * 削除は将来の cleanup phase で実施予定 (現状は API 互換性のため保持)。
 *
 * @param ev   リムーブ対象の証拠カード
 * @param owner 証拠の所有者 (リムーブされた側 = ヒラメキ発動可能側)
 */
export function flashWindow(
  state: GameState,
  ev: EvidenceCard,
  owner: Player,
): void {
  mutate.log.append(state, {
    ts: Date.now(),
    player: owner,
    turn: state.turn.number,
    action: 'flash-window-stub',
    target: ev.cardId,
    result: 'legacy-stub',
  });
}

/**
 * ActionGainCtx — gainSelfEvidence が必要とする ActionContext の構造的部分集合。
 * fast path と contact-end の deferred path は同じ ActionContext を渡す。構造的部分集合に
 * 留めることで、単体テストと因果 trace を持たない既存 caller も engine 内で再利用できる。
 */
export type ActionGainCtx = {
  byPlayer: Player;
  byUid: string;
  causalTrace?: CausalEffectTrace;
};

/**
 * gainSelfEvidence — 自分のデッキから1枚を裏向きで証拠エリアに追加 (rules/10)
 *
 * - 1枚固定 (攻撃キャラの LP に依存しない)
 * - byUid が現場を離れていても、ここまでは進める (rules/10)
 */
export function gainSelfEvidence(state: GameState, ax: ActionGainCtx): void {
  const p: Player = ax.byPlayer;
  // mega-wave W6 step7 (2026-07-04, row70): 「相手はこのアクションによって証拠を得られない」
  // (B02088/B03126 ヒラメキ)。単発 consume-on-read — 獲得も evidence:gain emit も行わない
  // (依存 trigger も不発、公式Q&A)。deck-empty refresh 判定より前に置く (獲得自体が無いので
  // refresh も起こさない — rules/14 は「証拠を得る」解決時のみ)。
  if (state.turnState[p].evidenceGainSuppressed) {
    state.turnState[p].evidenceGainSuppressed = false;
    if (state.causalLog) {
      const input: Omit<AppendCausalInput, 'parentEventId' | 'correlationEventId'> = {
        actor: p,
        kind: 'fizzle',
        source: { kind: 'player', side: p },
        targets: [{ kind: 'zone', side: p, zone: 'evidence' }],
        outcome: { type: 'state', state: 'fizzled' },
      };
      if (ax.causalTrace) recordCausalTraceOperation(state, ax.causalTrace, input);
      else appendCausal(state, input);
      return;
    }
    mutate.log.append(state, {
      ts: Date.now(),
      player: p,
      turn: state.turn.number,
      action: 'action-case-gain-suppressed',
    });
    return;
  }
  // engine拡張 wave#2 cluster3 (2026-06-13, BUG-142): rules/14「証拠を得る = リフレッシュ後に残り解決」。
  // 獲得前に deck0 なら refresh (fileAdd 同型の事前 guard)。remove0 なら敗北し、獲得も emit も行わない。
  if (!mutate.deck.refreshAfterTake(state, p)) return;
  const before = state.players[p].evidence.length;
  mutate.evidence.addFromDeck(state, p, 1, false, {
    turn: state.turn.number,
    via: 'action-case',
  });
  // engine拡張 wave#2 cluster3 (2026-06-13): evidence:gain emit — rules/10 手順3。
  // 実獲得時のみ emit (false-fire 防止)。本 emit が evidence:gain の唯一の emit 箇所であること
  // (推理/効果/refresh 由来では発火しない) が「アクション[事件]によって」の語義を構造的に保証する。
  // payload: uid/byUid = actor (selfOnly + triggerCharMatches{payloadKey:'byUid'} 両対応)。
  const gained = state.players[p].evidence.length > before;
  if (gained) {
    event.emit(state, 'evidence:gain', {
      player: p,
      byUid: ax.byUid,
      uid: ax.byUid,
      via: 'action-case',
      gained: 1,
    }, { player: p, uid: ax.byUid });
  }
  if (state.causalLog) {
    if (gained) {
      const input: Omit<AppendCausalInput, 'parentEventId' | 'correlationEventId'> = {
        actor: p,
        kind: 'evidence',
        source: { kind: 'player', side: p },
        targets: [{ kind: 'zone', side: p, zone: 'evidence' }],
        outcome: { type: 'count', amount: 1, unit: 'evidence' },
      };
      if (ax.causalTrace) recordCausalTraceOperation(state, ax.causalTrace, input);
      else appendCausal(state, input);
    }
    return;
  }
  // ログ
  mutate.log.append(state, {
    ts: Date.now(),
    player: p,
    turn: state.turn.number,
    action: 'action-case-gain',
    result: '+1',
  });
}

export type HiramekiDecisionOptions = {
  chooseAtomTarget?: ChooseAtomTargetFn;
  runtimeAtomTargetPolicyKey?: 'heuristic';
  humanChooser: boolean;
};

/** Exact state-owned checkpoint opened by this case action's evidence removal. */
export function matchesHiramekiCheckpoint(
  state: GameState,
  ax: ActionContext,
  pending: PendingHiramekiSide,
): boolean {
  if (
    ax.target.kind !== 'case'
    || pending.actionId !== ax.id
    || pending.actorUid !== ax.byUid
    || pending.player !== ax.target.player
    || pending.occurrence === undefined
    || pending.occurrence.player !== pending.player
    || pending.occurrence.cardId !== pending.cardId
    || pending.occurrence.area !== 'remove'
    || pending.occurrence.uid !== cardOccurrenceUid(
      pending.player,
      'remove',
      pending.cardId,
      pending.occurrence.index,
    )
    || typeof pending.occurrence.occurrenceWitness !== 'string'
    || !isLiveCardOccurrenceWitness(state, pending.player, 'remove', pending.occurrence.occurrenceWitness)
    || state.players[pending.player].remove[pending.occurrence.index] !== pending.cardId
  ) return false;

  const correlationEventId = pending.causalCorrelationEventId;
  if (typeof correlationEventId === 'string' && correlationEventId.length > 0) {
    return state.log.some((entry) =>
      entry.schemaVersion === 1
      && entry.eventId === correlationEventId
      && entry.kind === 'zone-move',
    );
  }
  if (correlationEventId !== undefined) return false;

  return isLegacyReplayHiramekiCompatibilityActive()
    && state.causalLog === undefined
    && !state.log.some(isCausalLogEntry);
}

/** Queue one fire/skip decision without owning the caller's resolver or UI state. */
export function resolveHiramekiDecision(
  state: GameState,
  actionContext: ActionContext | undefined,
  pending: PendingHiramekiSide,
  choice: 'fire' | 'skip',
  options: HiramekiDecisionOptions,
): void {
  if (actionContext && pending.causalCorrelationEventId !== undefined
    && !matchesHiramekiCheckpoint(state, actionContext, pending)) return;
  const decisionEventId = actionContext
    ? recordActionCausalOperation(state, actionContext, choice === 'fire' ? {
      actor: pending.player,
      kind: 'activate',
      tags: ['hirameki'],
      source: { kind: 'zone', side: pending.player, zone: 'remove' },
      targets: [{ kind: 'player', side: pending.player }],
      outcome: { type: 'state', state: 'active' },
    } : {
      actor: pending.player,
      kind: 'cancel',
      tags: ['hirameki'],
      source: { kind: 'zone', side: pending.player, zone: 'remove' },
      targets: [{ kind: 'player', side: pending.player }],
      outcome: { type: 'state', state: 'cancelled' },
    })
    : undefined;
  if (decisionEventId === undefined) {
    withStructuredCausalResolution(state, () => mutate.log.append(state, {
      ts: Date.now(),
      player: pending.player,
      turn: state.turn.number,
      action: choice === 'fire' ? 'hirameki:fire' : 'hirameki:skip',
      target: pending.cardId,
    }));
  }
  if (choice !== 'fire') return;

  const card = readDef.card(pending.cardId);
  const ability = card?.abilities.find((candidate) => candidate.id === pending.abilityId);
  if (!ability?.effect || pending.effectValid === false) return;

  const ctx: EffectCtx = {
    source: {
      player: pending.occurrence?.player ?? pending.player,
      cardId: pending.occurrence?.cardId ?? pending.cardId,
      abilityId: pending.abilityId,
      ...(pending.occurrence ? { uid: pending.occurrence.uid, area: pending.occurrence.area } : { area: 'evidence' }),
      resolutionKind: 'hirameki',
    },
    bindings: pending.occurrence ? {
      occurrence: [{
        kind: 'card',
        uid: pending.occurrence.uid,
        cardId: pending.occurrence.cardId,
        area: pending.occurrence.area,
        player: pending.occurrence.player,
        index: pending.occurrence.index,
        occurrenceWitness: pending.occurrence.occurrenceWitness,
      }],
    } : {},
    ...((decisionEventId ?? pending.causalCorrelationEventId) ? {
      causal: { correlationEventId: (decisionEventId ?? pending.causalCorrelationEventId)! },
    } : {}),
    triggerPayload: {
      player: pending.player,
      ev: { cardId: pending.cardId },
      byUid: pending.actorUid,
      occurrence: pending.occurrence,
    },
  };
  const resolved = resolveEffectPicks(state, ability.effect, ctx, {
    chooseAtomTarget: options.chooseAtomTarget,
    runtimeAtomTargetPolicyKey: options.runtimeAtomTargetPolicyKey,
    byPlayer: pending.player,
    humanChooser: options.humanChooser,
    source: { cardId: pending.cardId, abilityId: pending.abilityId },
  });
  event.queue(
    state,
    resolved,
    {
      player: pending.occurrence?.player ?? pending.player,
      cardId: pending.occurrence?.cardId ?? pending.cardId,
      ...(pending.occurrence ? { uid: pending.occurrence.uid, area: pending.occurrence.area } : {}),
      resolutionKind: 'hirameki',
    },
    'evidence:remove-by-action',
    {
      player: pending.player,
      ev: { cardId: pending.cardId },
      byUid: pending.actorUid,
      actionId: pending.actionId,
      causalCorrelationEventId: decisionEventId ?? pending.causalCorrelationEventId,
      occurrence: pending.occurrence,
    },
    ctx.bindings,
    ctx.causal?.trace
      ? { causalTrace: cloneCausalEffectTrace(ctx.causal.trace) }
      : ctx.causal?.correlationEventId
        ? { causalCorrelationEventId: ctx.causal.correlationEventId }
        : undefined,
  );
}

export const actionCase = {
  removeOpponentEvidenceTop,
  flashWindow,
  gainSelfEvidence,
  matchesHiramekiCheckpoint,
  resolveHiramekiDecision,
};
