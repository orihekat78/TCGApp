// 戻り値型定義
// rules: 07-action-flow.md, 08-contact.md, 14-refresh.md, 21-declared-ability-cost.md

import type { CardId, EvidenceCard, GameState } from './game-state.js';
import type { HookName } from './hooks.js';
import type { CausalEffectTrace } from './effect-ctx.js';

export type RemoveResult = {
  removed: { uid?: string; cardId: string };
  setCardsRemoved: CardId[];
  stackedCardsRemoved: number;
  triggeredHooks: HookName[];
  /**
   * mega-wave W6 step10 (row9): leave:intercept でリムーブが「代わりに〜」へ差し替わった。
   * 'hand' = B01092 型 (キャラは手札へ、interceptor がコストでリムーブ) /
   * 'kept-in-scene' = B01039 型 (キャラは現場に残り、set-card rider のみ消費)。
   * undefined = 通常リムーブ (既存 4 call site は無視で back-compat)。
   */
  prevented?: boolean;
  redirectedTo?: 'hand' | 'kept-in-scene';
  /** A human optional leave intercept is awaiting a decision; no removal happened. */
  deferred?: boolean;
  pendingLeaveIntercept?: { player: 'self' | 'opp'; targetUid: string; interceptorUid: string };
};

export type RefreshResult =
  | { ok: true; reshuffled: number; opponentEvidenceGained: 1 }
  | { ok: false; loserPlayer: 'self' | 'opp'; reason: 'remove-empty' };

export type JudgeResult = {
  attackerAP: number;
  defenderAP: number;
  defenderRemoved: boolean;
  attackerRemoved: false;
  /** Judge is paused before a human leave-intercept decision. */
  deferred?: boolean;
  pendingLeaveIntercept?: { player: 'self' | 'opp'; targetUid: string; interceptorUid: string };
};

export type PaidRecord = { kind: string; details: unknown };

export type PayResult = { paidItems: PaidRecord[]; releasedTriggers: HookName[] };

export type CostPreview = {
  description: string;
  requiresChoice: boolean;
  choices?: { label: string; value: unknown }[];
  affordable: boolean;
};

export type ValidationResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; errors: string[] };

export type GameResult = { winner: 'self' | 'opp'; reason: 'evidence' | 'deck-out' | 'concede' | 'alt-lose' };

export type ActionPhase =
  | 'declared' | 'guard-window' | 'leave-resolution' | 'contact-pending'
  | 'action-1' | 'action-2' | 'action-1-redo' | 'judge' | 'contact-end' | 'action-end';

export type ActionContext = {
  id: string;
  byUid: string;
  byPlayer: 'self' | 'opp';
  target: { kind: 'char'; uid: string } | { kind: 'case'; player: 'self' | 'opp' };
  phase: ActionPhase;
  /** @deprecated 互換性のため残置。新コードは guardUid を参照すること */
  guarded?: { guardUid: string };
  guardUid?: string;
  apSnapshot?: { aUid: string; aAP: number; bUid: string; bAP: number };
  /** コンタクトの行動順 (apSnapshot から computeOrder で算出) */
  firstUid?: string;
  secondUid?: string;
  /** 1番目/2番目が cutIn/disguise したか (pass=false, action=true) */
  firstActed?: boolean;
  secondActed?: boolean;
  /** Whether the optional first-player redo decision was explicitly answered. */
  firstRedoActed?: boolean;
  /** Judge work completed; actionAdvance may not leave judge before this is true. */
  judgeResolved?: boolean;
  /**
   * Serializable human leave-intercept decision. The ActionContext owns this
   * state so a save/reload cannot lose a paused contact judgment.
   */
  pendingLeaveIntercept?: {
    player: 'self' | 'opp';
    targetUid: string;
    interceptorUid: string;
  };
  /** 1コンタクト1枚 (rules/09): プレイヤー単位で cutIn 使用済みフラグ */
  cutInUsed?: { self?: boolean; opp?: boolean };
  /** 防御側のコンタクト免疫 (turnEffects から snapshot) */
  contactImmune?: boolean;
  /**
   * mega-wave W6 step9 (2026-07-04, row65): 「コンタクトを発生させる」効果 (B06020/B06042) 由来の
   * ax。true のとき contact-end→action-end 遷移で **action:end を emit しない** (公式Q&A
   * 「これはアクションではないので、アクションによって発動する能力や『アクション終了時』の能力は
   * 発動しません」)。declare/guard-window/sleepActor/actedCharThisTurn も一切通らない
   * (startFromEffect が bootstrap)。undefined = 通常アクション (既存挙動 byte 等価)。
   */
  generatedByEffect?: boolean;
  /** State-owned public causal lineage for this action/contact. */
  causalTrace?: CausalEffectTrace;
  /** Complete this case action's evidence gain after its Hirameki decision/effect. */
  deferredCaseEvidenceGain?: boolean;
  /**
   * Exact evidence card suspended while its optional Hirameki resolves. The
   * card belongs to this action until the effect finishes, then moves to the
   * remove area unless that effect moved the held card elsewhere.
   */
  pendingHiramekiEvidenceRemoval?: {
    token: string;
    player: 'self' | 'opp';
    evidence: EvidenceCard;
    /** Exact optional Hirameki ability selected when the hold was opened. */
    abilityId?: string;
    /** Condition result frozen at the opening checkpoint. */
    effectValid?: boolean;
    /** False until the public fire/skip answer has passed authority checks. */
    decisionResolved: boolean;
  };
  /** Exact event used to correlate contact:start and its triggered children. */
  contactCausalEventId?: string;
  /** Exact terminal contact result/cancellation event. */
  contactResultCausalEventId?: string;
  startedAt: { turn: number; nano: number };
};

export type Unsubscribe = () => void;

export type PlaytestReport = {
  total: number;
  aWin: number;
  bWin: number;
  deckOut: number;
  invariantViolations: { type: string; message: string; count: number }[];
  avgTurns: number;
};

export type TurnSnapshot = Readonly<GameState['turn']>;
export type CaseInfo = Readonly<GameState['players']['self']['case']>;
