import {
  isCausalLogEntry,
  normalizeGameLog,
  validateGameCausalState,
  type NormalizedLogGraph,
} from '@/engine/log/causal';
import type { GameState } from '@/engine/types';
import { currentPresentationSessionId } from './coordinator';
import { projectPublicCausalLogEntry } from '@/ui/services/replayViewerProjection';

/** One public, validated consumer boundary for live, legacy, and replay logs. */
export function normalizedGameLogForUi(state: GameState): NormalizedLogGraph {
  validateGameCausalState(state);
  const projected = {
    ...state,
    log: state.log.map((entry) => (
      isCausalLogEntry(entry) ? projectPublicCausalLogEntry(state, entry) : entry
    )),
  };
  return normalizeGameLog(projected, {
    legacySessionId: currentPresentationSessionId(),
  });
}
