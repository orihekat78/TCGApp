// 戻り値型定義
// rules: 07-action-flow.md, 08-contact.md, 14-refresh.md, 21-declared-ability-cost.md

import type { CardId, GameState } from './game-state.js';
import type { HookName } from './hooks.js';

export type RemoveResult = {
  removed: { uid?: string; cardId: string };
  setCardsRemoved: CardId[];
  stackedCardsRemoved: number;
  triggeredHooks: HookName[];
};

export type RefreshResult =
  | { ok: true; reshuffled: number; opponentEvidenceGained: 1 }
  | { ok: false; loserPlayer: 'self' | 'opp'; reason: 'remove-empty' };

export type JudgeResult = {
  attackerAP: number;
  defenderAP: number;
  defenderRemoved: boolean;
  attackerRemoved: false;
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

export type GameResult = { winner: 'self' | 'opp'; reason: 'evidence' | 'deck-out' | 'concede' };

export type ActionPhase =
  | 'declared' | 'guard-window' | 'leave-resolution' | 'contact-pending'
  | 'action-1' | 'action-2' | 'action-1-redo' | 'judge' | 'contact-end' | 'action-end';

export type ActionContext = {
  id: string;
  byUid: string;
  target: { kind: 'char'; uid: string } | { kind: 'case'; player: 'self' | 'opp' };
  phase: ActionPhase;
  guarded?: { guardUid: string };
  apSnapshot?: { aUid: string; aAP: number; bUid: string; bAP: number };
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
