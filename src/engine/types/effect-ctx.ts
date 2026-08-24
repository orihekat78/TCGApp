// EffectCtx 型定義
// rules: 15-abilities-effects.md, 08-contact.md, 21-declared-ability-cost.md

import type { Candidate } from './candidate.js';

export type DeclaredNameDomain =
  | 'unrestricted'
  | 'registered-card-name'
  | 'registered-character-card-name';

/**
 * How the source card entered its current effect-resolution window.
 *
 * Official rules distinguish normal events / Hirameki (not yet in remove)
 * from cut-ins (already in remove).  CardDef.kind cannot express that
 * lifecycle distinction, so every use path writes it explicitly.
 */
export type EffectResolutionKind = 'normal-event' | 'hirameki' | 'cutin';

/** Stable authority for one host-owned declared-ability definition. */
export type DeclaredAbilityHostOrigin = 'printed' | 'granted';

export type ContactCtx = {
  byUid: string;
  targetUid?: string;
  guardUid?: string;
  attackerSide: 'self' | 'opp';
};

/** Public-only causal lineage for one resolving effect branch. */
export type CausalEffectTrace = {
  rootEventId: string;
  tailEventId: string;
  awaitingResume?: true;
  completed?: true;
};

export type EffectCtx = {
  source: {
    cardId?: string;
    /** Printed identity of the physical set card that granted this ability. */
    setCardId?: string;
    /** Runtime identity of that exact set-card occurrence. */
    setCardInstanceId?: string;
    /** Definition collection that supplied a host-owned declared ability. */
    abilityOrigin?: DeclaredAbilityHostOrigin;
    /** Original zero-based index inside that definition collection. */
    abilityIndex?: number;
    uid?: string;
    abilityId?: string;
    player: 'self' | 'opp';
    area: 'scene' | 'partner-area' | 'hand' | 'evidence' | 'file' | 'remove' | 'case';
    resolutionKind?: EffectResolutionKind;
    /** Internal stack provenance retained while a human decision is paused. */
    triggerBatch?: number;
    ownerChosenOrder?: number;
    ownerOrderConfirmed?: boolean;
    /** Exact declaration provenance for causal observer gating. */
    declaredBatch?: number | string;
  };
  bindings: Record<string, Candidate[]>;
  // mega-wave W6 step1 (2026-07-04): declareName verb が書き込む「プレイヤーが宣言した任意カード名」。
  // 盤面実体を持たない自由文字列は Candidate として表現できない (cardId/area 不在) ため、
  // ctx.bindings とは別の軽量チャネル (rows 49/53/999 の 3-way storage を本形に統一、Candidate 汚染案は棄却)。
  // 読み手: cond boundNameMatchesDeclared / dyn $declared.<key>[.sceneNameCount]。
  declaredNames?: Record<string, string>;
  /** Domain authority paired with each declared name across resolver pauses. */
  declaredNameDomains?: Record<string, DeclaredNameDomain>;
  picked?: Candidate[];
  viaCost?: boolean;
  costPaid?: Record<string, unknown>;
  triggerPayload?: unknown;
  contact?: ContactCtx;
  /** Scoped causal metadata for the currently resolving effect branch. */
  causal?: {
    publicHandRevealToken?: string;
    trace?: CausalEffectTrace;
    /** Immediate parent effect root for a newly triggered effect. */
    correlationEventId?: string;
    /** Identity-free autonomous selection, emitted only when the chosen atom commits. */
    pendingDecisionActor?: 'self' | 'opp';
  };
  dyn?: Record<string, unknown>;
  rng?: () => number;
  parent?: EffectCtx;
};
