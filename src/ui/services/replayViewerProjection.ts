import {
  FILE_CARD_BACK_PLACEHOLDER,
  type CausalLogEntryV1,
  type CausalOutcome,
  type GameState,
  type LegacyLogEntry,
  type PlayerState,
  type PublicCausalRef,
  type PublicCausalZone,
  type SceneCharacter,
} from '@/engine/types';
import {
  buildReplayLogV3,
  replayStates,
  type ReplayLogV3,
  type ReplayViewerMode,
} from '@/ai/replay/state-frame';
import { isCausalLogEntry } from '@/engine/log/causal';
import { redactLogEntryForViewer, type LogViewer } from '@/engine/read/log';
import { def as readDef } from '@/engine/read/def';
import { cloneReplayStateAtCommit } from '@/ui/services/replayStateBoundary';

const ZONE_LABELS: Record<PublicCausalZone, string> = {
  deck: 'デッキ',
  hand: '手札',
  scene: '現場',
  partner: 'パートナー',
  case: '事件',
  file: 'FILE',
  evidence: '証拠',
  remove: 'リムーブ',
  'set-card': 'セットカード',
};

function sideLabel(side: 'self' | 'opp'): string {
  return side === 'self' ? '自分' : '相手';
}

function canonicalOutcomeText(outcome: CausalOutcome): string | undefined {
  switch (outcome.type) {
    case 'none': return undefined;
    case 'count': return `${outcome.amount}:${outcome.unit}`;
    case 'move': return `${outcome.from}->${outcome.to}:${outcome.count}`;
    case 'state': return outcome.state;
    case 'case-status': return `${outcome.from}->${outcome.to}`;
    case 'face-change': return `${outcome.from}->${outcome.to}:${outcome.count}`;
    case 'summary': return `${outcome.count}:${outcome.kinds.join(',')}`;
  }
}

function zoneRef(side: 'self' | 'opp', zone: PublicCausalZone): PublicCausalRef {
  return {
    visibility: 'public',
    kind: 'zone',
    label: `${sideLabel(side)}の${ZONE_LABELS[zone]}`,
    side,
    zone,
  };
}

function hasVisibleCardIdentity(
  state: GameState,
  side: 'self' | 'opp',
  zone: PublicCausalZone,
  cardNumber: string,
): boolean {
  if (cardNumber === FILE_CARD_BACK_PLACEHOLDER) return false;
  const player = state.players[side];
  switch (zone) {
    case 'deck':
      return false;
    case 'hand':
      return false;
    case 'scene':
      return player.scene.some((character) => character.cardId === cardNumber);
    case 'partner':
      return player.partner.location === 'partner-area' && player.partner.cardId === cardNumber;
    case 'case':
      return player.case.cardId === cardNumber;
    case 'file': {
      const matchingEntries = player.file.filter((entry) => entry.cardId === cardNumber);
      if (matchingEntries.some((entry) => entry.type === 'card-back' && entry.faceUp !== true)) {
        return false;
      }
      if (matchingEntries.length > 0) return true;
      return player.partner.location === 'partner-area'
        && player.partner.cardId === cardNumber;
    }
    case 'evidence': {
      const matchingEntries = player.evidence.filter((entry) => entry.cardId === cardNumber);
      return matchingEntries.length > 0 && matchingEntries.every((entry) => entry.faceUp);
    }
    case 'remove':
      return player.remove.includes(cardNumber);
    case 'set-card': {
      const matchingEntries = player.scene.flatMap((character) => (
        character.setCards.filter((entry) => entry.cardId === cardNumber)
      ));
      return matchingEntries.length > 0 && matchingEntries.every((entry) => entry.faceUp);
    }
  }
}

function projectCausalRef(state: GameState, ref: PublicCausalRef): PublicCausalRef {
  if (ref.kind === 'player' && ref.side) {
    return { visibility: 'public', kind: 'player', label: sideLabel(ref.side), side: ref.side };
  }
  if (ref.kind === 'zone' && ref.side && ref.zone) return zoneRef(ref.side, ref.zone);
  if (ref.kind === 'card' && ref.side && ref.zone && ref.cardNumber) {
    if (!hasVisibleCardIdentity(state, ref.side, ref.zone, ref.cardNumber)) {
      return zoneRef(ref.side, ref.zone);
    }
    return {
      visibility: 'public',
      kind: 'card',
      label: readDef.card(ref.cardNumber)?.names[0] ?? ref.cardNumber,
      side: ref.side,
      zone: ref.zone,
      cardNumber: ref.cardNumber,
    };
  }
  if (ref.kind === 'counter') {
    return { visibility: 'public', kind: 'counter', label: 'カウンター' };
  }
  return { visibility: 'public', kind: 'rule', label: 'ルール' };
}

/** Fail-closed public projection shared by live presentation and replay UI. */
export function projectPublicCausalLogEntry(
  state: GameState,
  entry: CausalLogEntryV1,
): CausalLogEntryV1 {
  const source = entry.source ? projectCausalRef(state, entry.source) : undefined;
  const targets = entry.targets.map((ref) => projectCausalRef(state, ref));
  const target = targets[0]?.label;
  const result = canonicalOutcomeText(entry.outcome);
  return {
    ...structuredClone(entry),
    action: `causal.${entry.kind}`,
    ...(target ? { target } : { target: undefined }),
    ...(result ? { result } : { result: undefined }),
    ...(source ? { source } : { source: undefined }),
    targets,
  };
}

function hiddenCards(count: number): string[] {
  return Array.from({ length: count }, () => FILE_CARD_BACK_PLACEHOLDER);
}

function redactHostedCards(character: SceneCharacter): void {
  character.setCards = character.setCards.map((entry, index) => (
    entry.faceUp
      ? entry
      : {
          cardId: FILE_CARD_BACK_PLACEHOLDER,
          faceUp: false,
          instanceId: `hidden-set:${index}`,
        }
  ));
  if (Array.isArray(character.stackedCards)) {
    character.stackedCards = character.stackedCards.map((_entry, index) => ({
      cardId: FILE_CARD_BACK_PLACEHOLDER,
      instanceId: `hidden-stack:${index}`,
    }));
  }
}

function redactPlayer(player: PlayerState, revealHand: boolean): void {
  if (!revealHand) player.hand = hiddenCards(player.hand.length);
  player.deck = hiddenCards(player.deck.length);
  if (player.partner.location === 'mr-removed') {
    player.partner.cardId = FILE_CARD_BACK_PLACEHOLDER;
  }
  player.evidence = player.evidence.map((entry) => (
    entry.faceUp
      ? entry
      : {
          cardId: FILE_CARD_BACK_PLACEHOLDER,
          faceUp: false,
          origin: { turn: entry.origin.turn, via: entry.origin.via },
        }
  ));
  player.file = player.file.map((entry) => {
    if (entry.type === 'assisted-partner') {
      return entry;
    }
    return entry.faceUp !== true
      ? { type: 'card-back', cardId: FILE_CARD_BACK_PLACEHOLDER }
      : entry;
  });
  player.scene.forEach(redactHostedCards);
  if (player.partnerAreaMR) redactHostedCards(player.partnerAreaMR);
}

function projectLegacyLogEntry(entry: LegacyLogEntry, viewer: LogViewer): LegacyLogEntry {
  const canSeePrivateDetail = entry.targetAudience === undefined || entry.targetAudience === viewer;
  const projected = { ...redactLogEntryForViewer(entry, viewer) } as LegacyLogEntry;
  delete projected.targetAudience;
  if (!canSeePrivateDetail) delete projected.result;
  return projected;
}

/**
 * Produce the only GameState shape that replay UI may receive.
 * Replay artifacts are deterministic read-only playback projections, not
 * resumable GameState saves. Hidden identities and live resolver continuations
 * are removed before persistence and again before Zustand/DOM ownership.
 */
export function projectReplayStateForViewer(
  state: GameState,
  viewerMode: ReplayViewerMode,
  previousProjectedState?: GameState,
): GameState {
  const projected = cloneReplayStateAtCommit(state);
  const viewer: LogViewer = viewerMode === 'solo-self' ? 'self' : null;

  redactPlayer(projected.players.self, viewerMode === 'solo-self');
  redactPlayer(projected.players.opp, false);
  projected.log = projected.log.map((entry) => (
    entry.schemaVersion === 1 ? projectPublicCausalLogEntry(projected, entry) : projectLegacyLogEntry(entry, viewer)
  ));
  if (previousProjectedState) {
    const previousCausalEntries = new Map(
      previousProjectedState.log
        .filter(isCausalLogEntry)
        .map((entry) => [entry.eventId, entry] as const),
    );
    projected.log = projected.log.map((entry) => {
      if (!isCausalLogEntry(entry)) return entry;
      const previous = previousCausalEntries.get(entry.eventId);
      return previous ? structuredClone(previous) : entry;
    });
  }

  return projected;
}

/**
 * Rebuild a validated replay from viewer-safe states. This is intentionally
 * usable at every persistence boundary, even when a caller supplies an older
 * raw V3 artifact that was created before capture-time projection existed.
 */
export function projectReplayLogForViewer(log: ReplayLogV3): ReplayLogV3 {
  const states: GameState[] = [];
  for (const state of replayStates(log)) {
    states.push(projectReplayStateForViewer(state, log.viewerMode, states.at(-1)));
  }
  return buildReplayLogV3({
    artifactId: log.artifactId,
    sessionId: log.sessionId,
    viewerMode: log.viewerMode,
    states,
  });
}
