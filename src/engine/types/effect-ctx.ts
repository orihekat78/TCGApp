// EffectCtx 型定義
// rules: 15-abilities-effects.md, 08-contact.md, 21-declared-ability-cost.md

import type { Candidate } from './candidate.js';

export type ContactCtx = {
  byUid: string;
  targetUid?: string;
  guardUid?: string;
  attackerSide: 'self' | 'opp';
};

export type EffectCtx = {
  source: {
    cardId?: string;
    uid?: string;
    abilityId?: string;
    player: 'self' | 'opp';
    area: 'scene' | 'partner-area' | 'hand' | 'evidence' | 'file' | 'remove' | 'case';
  };
  bindings: Record<string, Candidate[]>;
  picked?: Candidate[];
  viaCost?: boolean;
  costPaid?: Record<string, unknown>;
  triggerPayload?: unknown;
  contact?: ContactCtx;
  dyn?: Record<string, unknown>;
  rng?: () => number;
  parent?: EffectCtx;
};
