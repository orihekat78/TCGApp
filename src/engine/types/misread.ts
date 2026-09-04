import type { CausalEffectTrace } from './effect-ctx.js';

export type MisreadCandidate = { uid: string; x: number };

export type MisreadDecision = {
  /** Player who owns the Misread decision. */
  player: 'self' | 'opp';
  reasoningUid: string;
  reasoningPlayer: 'self' | 'opp';
  candidates: MisreadCandidate[];
};

/** Serializable single-use authority for one paused human Misread decision. */
export type PendingMisreadAuthority = MisreadDecision & {
  continuationToken: number;
  causalTrace?: CausalEffectTrace;
};
