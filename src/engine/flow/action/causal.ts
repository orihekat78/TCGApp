import type {
  ActionContext,
  CausalEventKind,
  CausalEventTag,
  CausalOutcome,
  GameState,
} from '../../types/index.js';
import {
  appendCausal,
  type AppendCausalInput,
  type PublicCausalLocator,
} from '../../log/causal.js';
import {
  currentEffectCausalCorrelationEventId,
  isStructuredCausalResolutionActive,
  recordCausalTraceOperation,
  startStandaloneCausalTrace,
  completeOwnedCausalTrace,
} from '../../log/effect-causal.js';

type Player = 'self' | 'opp';
type ActionOperation = Omit<AppendCausalInput, 'parentEventId' | 'correlationEventId'>;

export function otherPlayer(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

export function publicUidLocator(
  state: GameState,
  uid: string,
  fallbackSide: Player,
): PublicCausalLocator {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    return { kind: 'partner-card', side: uid === 'partner:self' ? 'self' : 'opp' };
  }
  for (const side of ['self', 'opp'] as const) {
    if (state.players[side].scene.some((card) => card.uid === uid)) {
      return { kind: 'scene-card', side, uid };
    }
  }
  return { kind: 'player', side: fallbackSide };
}

/** Start a state-owned trace without borrowing the resolver's mutable trace. */
export function startActionCausalTrace(
  state: GameState,
  ax: ActionContext,
  tags?: CausalEventTag[],
): void {
  if (state.causalLog === undefined || state.gameResult !== undefined || ax.causalTrace !== undefined) return;

  const target: PublicCausalLocator = ax.target.kind === 'char'
    ? publicUidLocator(state, ax.target.uid, otherPlayer(ax.byPlayer))
    : { kind: 'case-card', side: ax.target.player };

  const input: ActionOperation = {
    actor: ax.byPlayer,
    kind: 'declare',
    ...(tags?.length ? { tags } : {}),
    source: publicUidLocator(state, ax.byUid, ax.byPlayer),
    targets: [target],
    outcome: { type: 'state', state: 'active' },
  };

  if (isStructuredCausalResolutionActive(state)) {
    const correlationEventId = currentEffectCausalCorrelationEventId(state);
    if (correlationEventId === undefined) {
      throw new Error('structured action causal trace requires a parent effect root');
    }
    const root = appendCausal(state, { ...input, correlationEventId });
    ax.causalTrace = { rootEventId: root.eventId, tailEventId: root.eventId };
    return;
  }

  ax.causalTrace = startStandaloneCausalTrace(state, input);
}

export function recordActionCausalOperation(
  state: GameState,
  ax: ActionContext,
  input: ActionOperation,
): string | undefined {
  return recordCausalTraceOperation(state, ax.causalTrace, input)?.eventId;
}

export function completeActionCausalOperation(
  state: GameState,
  ax: ActionContext,
  kind: Extract<CausalEventKind, 'summary' | 'cancel' | 'fizzle'>,
  outcome: CausalOutcome,
  tags: CausalEventTag[] = ax.contactCausalEventId !== undefined ? ['contact'] : [],
): string | undefined {
  const completion = completeOwnedCausalTrace(
    state,
    ax.causalTrace,
    ax.byPlayer,
    kind,
    outcome,
    tags,
  );
  if (completion !== undefined) {
    ax.contactResultCausalEventId = completion.eventId;
  }
  return completion?.eventId;
}

export function actionCorrelationEventId(
  ax: ActionContext,
  preferred?: string,
): string | undefined {
  return preferred ?? ax.contactResultCausalEventId ?? ax.contactCausalEventId
    ?? ax.causalTrace?.tailEventId ?? ax.causalTrace?.rootEventId;
}
