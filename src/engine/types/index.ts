// engine/types barrel export
// 全型を re-export する

export type {
  CardId,
  GameState,
  PlayerState,
  SceneCharacter,
  SetCardEntry,
  StackedCardEntry,
  StackedCards,
  PartnerOnBoard,
  EvidenceCard,
  EvidenceOrigin,
  FileCard,
  TurnScopedFlags,
  LegacyLogEntry,
  CausalEventKind,
  CausalEventTag,
  PublicCausalZone,
  PublicCausalRef,
  CausalOutcome,
  CausalLogEntryV1,
  CausalLogStateV1,
  LogEntry,
} from './game-state.js';

export { FILE_CARD_BACK_PLACEHOLDER, stackedCardCount } from './game-state.js';

export type {
  Effect,
  AtomVerb,
  TriggerRef,
  Scope,
  Condition,
  TargetingRef,
  TargetQuery,
  TargetFilter,
  DeckRevealUntilArgs,
  Cost,
} from './effect.js';

export type { Candidate } from './candidate.js';

export type {
  EffectStackEntry,
  EffectStackEntrySource,
  EffectStackEntryTrigger,
  EffectStackEntryTimestamp,
  EffectStackEntryState,
  ReasoningContinuation,
} from './effect-stack.js';

export type {
  EffectCtx,
  DeclaredNameDomain,
  ContactCtx,
  CausalEffectTrace,
  EffectResolutionKind,
} from './effect-ctx.js';

export type {
  MisreadCandidate,
  MisreadDecision,
  PendingMisreadAuthority,
} from './misread.js';

// mega-wave W6 step8 (2026-07-04, row75): 離場後予約効果 queue
export type { ReservedEffectEntry, ReservedEffectTrigger } from './reserved-effect.js';

export type {
  RemoveResult,
  RefreshResult,
  JudgeResult,
  PayResult,
  PaidRecord,
  CostPreview,
  ValidationResult,
  GameResult,
  ActionPhase,
  ActionContext,
  Unsubscribe,
  PlaytestReport,
  TurnSnapshot,
  CaseInfo,
} from './results.js';

export type { HookName } from './hooks.js';

export type {
  CardDef,
  AbilityDef,
  AbilityType,
  AbilityScope,
  AbilityLimit,
  TriggerDef,
  ContinuousModifier,
  FilteredAssaultGrant, // engine mega-wave W4 (2026-07-03, r62)
} from './card-def.js';
