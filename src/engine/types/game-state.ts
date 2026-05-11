// GameState 型定義
// rules: 01-victory-conditions.md, 03-field-areas.md, 05-turn-phases.md, 13-keywords.md, 14-refresh.md

export type CardId = string;

export type PlayerState = {
  partner: PartnerOnBoard;
  case: { cardId: string; status: '事件編' | '解決編'; requiredEvidence: number; colors: string[] };
  scene: SceneCharacter[];
  hand: CardId[];
  deck: CardId[];
  evidence: EvidenceCard[];
  remove: CardId[];
  file: FileCard[];
};

export type SceneCharacter = {
  cardId: string;
  uid: string;
  state: 'active' | 'sleep' | 'stun';
  isNamed: boolean;
  enterOrder: number;
  setCards: CardId[];
  stackedCards: number;
  keywordOverrides: { granted: string[]; disabledOriginal: boolean };
  apOverride: number | null;
  lpOverride: number | null;
  turnEffects: {
    contactImmune: boolean;
    removeOnTurnEnd: boolean;
    [other: string]: unknown;
  };
  declaredUseCount: Record<string, number>;
};

export type PartnerOnBoard = {
  cardId: string;
  state: 'active' | 'sleep' | 'stun';
  location: 'partner-area' | 'file-area' | 'mr-removed';
};

export type EvidenceCard = {
  cardId: string;
  faceUp: boolean;
  origin: EvidenceOrigin;
};

export type EvidenceOrigin = {
  turn: number;
  via: 'reasoning' | 'action-case' | 'effect' | 'opening' | 'refresh-penalty';
  sourceCardId?: string;
};

export type FileCard =
  | { type: 'card-back' }
  | { type: 'assisted-partner'; cardId: string };

export type TurnScopedFlags = {
  handUseUsed: boolean;
  nextHintUsed: boolean;
  assistedThisTurn: boolean;
  declaredAbilityUseCount: Record<string, number>;
};

export type LogEntry = {
  ts: number;
  player: 'self' | 'opp';
  turn: number;
  action: string;
  target?: string;
  result?: string;
};

// Effect は effect.ts で定義されるが、GameState が pendingEffects: Effect[] を持つため
// 前方参照を避けるために import を使用する
import type { Effect } from './effect.js';

export type GameState = {
  turn: {
    number: number;
    player: 'self' | 'opp';
    phase: 'auto' | 'main' | 'end';
    isFirstPlayerFirstTurn: boolean;
  };
  players: { self: PlayerState; opp: PlayerState };
  pendingEffects: Effect[];
  scratchTrace: { self: '未発見' | '発見済'; opp: '未発見' | '発見済' };
  turnState: { self: TurnScopedFlags; opp: TurnScopedFlags };
  refreshCount: { self: number; opp: number };
  log: LogEntry[];
  gameResult?: { winner: 'self' | 'opp'; reason: 'evidence' | 'deck-out' | 'concede' };
};
