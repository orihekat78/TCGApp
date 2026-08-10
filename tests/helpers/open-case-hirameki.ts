import { mutate } from '@/engine/mutate';
import { startCausalSession } from '@/engine/log/causal';
import type { GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { useGameStateStore } from '@/ui/state/store';

let sessionSequence = 0;

type OpenCaseHiramekiOptions = {
  evidencePlayer?: Player;
  actorUid?: string;
  actorCardId?: string;
  humanPlayer?: Player | null;
  sessionLabel?: string;
};

/** Open a public Hirameki decision through the production unguarded CASE FSM. */
export function openCaseHirameki(
  state: GameState,
  evidenceCardId: string,
  options: OpenCaseHiramekiOptions = {},
) {
  const working = structuredClone(state) as GameState;
  const evidencePlayer = options.evidencePlayer ?? 'self';
  const actorPlayer: Player = evidencePlayer === 'self' ? 'opp' : 'self';
  working.turn = {
    number: Math.max(1, working.turn.number),
    player: actorPlayer,
    phase: 'main',
    isFirstPlayerFirstTurn: false,
  };
  if (!working.players[evidencePlayer].case.cardId) {
    const existingCase = working.players[evidencePlayer].case;
    working.players[evidencePlayer].case = {
      ...existingCase,
      cardId: 'D08026',
      requiredEvidence: existingCase.requiredEvidence || 7,
      colors: existingCase.colors.length > 0 ? existingCase.colors : ['blue'],
    };
  }
  if (working.players[evidencePlayer].evidence.at(-1)?.cardId !== evidenceCardId) {
    working.players[evidencePlayer].evidence.push({
      cardId: evidenceCardId,
      faceUp: false,
      origin: { turn: Math.max(1, working.turn.number), via: 'reasoning' },
    });
  }

  const actor = options.actorUid
    ? working.players[actorPlayer].scene.find((candidate) => candidate.uid === options.actorUid)
    : undefined;
  const actorUid = actor?.uid
    ?? mutate.scene.enter(working, actorPlayer, options.actorCardId ?? 'D08005', {}).uid;
  const sessionId = `${options.sessionLabel ?? 'test-case-hirameki'}-${++sessionSequence}`;
  startCausalSession(working, sessionId);
  resetPresentationQueue(sessionId);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide =
    options.humanPlayer === undefined ? evidencePlayer : options.humanPlayer;
  useGameStateStore.setState({ spectatorMode: false });
  if (!useGameStateStore.getState().setGameState(working)) {
    throw new Error(`Failed to commit CASE Hirameki fixture for session ${sessionId}`);
  }

  const declared = dispatchEngineAction({
    type: 'actionDeclareCase',
    byUid: actorUid,
    targetPlayer: evidencePlayer,
  });
  if (!declared.ok) {
    throw new Error(`Failed to declare CASE action: ${declared.reason}${declared.detail ? ` (${declared.detail})` : ''}`);
  }
  const actionId = useGameStateStore.getState().activeActionId;
  if (!actionId) throw new Error('CASE action did not expose an active action ID');
  const guarded = dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null });
  if (!guarded.ok) {
    throw new Error(`Failed to decline CASE guard: ${guarded.reason}${guarded.detail ? ` (${guarded.detail})` : ''}`);
  }
  const judged = dispatchEngineAction({ type: 'actionJudge', actionId });
  if (!judged.ok) {
    throw new Error(`Failed to judge CASE action: ${judged.reason}${judged.detail ? ` (${judged.detail})` : ''}`);
  }
  const pending = useGameStateStore.getState().pendingHirameki;
  if (!pending) throw new Error(`CASE action did not expose Hirameki for ${evidenceCardId}`);
  return { actionId, actorUid, pending, sessionId };
}
