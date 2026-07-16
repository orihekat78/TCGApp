// EffectCtx 型定義
// rules: 15-abilities-effects.md, 08-contact.md, 21-declared-ability-cost.md

import type { Candidate } from './candidate.js';

/**
 * How the source card entered its current effect-resolution window.
 *
 * Official rules distinguish normal events / Hirameki (not yet in remove)
 * from cut-ins (already in remove).  CardDef.kind cannot express that
 * lifecycle distinction, so every use path writes it explicitly.
 */
export type EffectResolutionKind = 'normal-event' | 'hirameki' | 'cutin';

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
    resolutionKind?: EffectResolutionKind;
  };
  bindings: Record<string, Candidate[]>;
  // mega-wave W6 step1 (2026-07-04): declareName verb が書き込む「プレイヤーが宣言した任意カード名」。
  // 盤面実体を持たない自由文字列は Candidate として表現できない (cardId/area 不在) ため、
  // ctx.bindings とは別の軽量チャネル (rows 49/53/999 の 3-way storage を本形に統一、Candidate 汚染案は棄却)。
  // 読み手: cond boundNameMatchesDeclared / dyn $declared.<key>[.sceneNameCount]。
  declaredNames?: Record<string, string>;
  picked?: Candidate[];
  viaCost?: boolean;
  costPaid?: Record<string, unknown>;
  triggerPayload?: unknown;
  contact?: ContactCtx;
  dyn?: Record<string, unknown>;
  rng?: () => number;
  parent?: EffectCtx;
};
