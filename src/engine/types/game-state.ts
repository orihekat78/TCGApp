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
  // Phase 4: setup flag — マリガンは1ゲーム1回 (rules/04)
  mulliganUsed: boolean;
};

export type SetCardEntry = {
  cardId: string;
  faceUp: boolean;
};

export type SceneCharacter = {
  cardId: string;
  uid: string;
  state: 'active' | 'sleep' | 'stun';
  isNamed: boolean;
  enterOrder: number;
  /**
   * 「このターン何番目に登場したか」(rules/17 §【疾風 N】判定用)。
   * `enterOrder` (累積 scene 位置) と異なり、turn 境界で counter リセット。
   * mutate.scene.enter で turnState[p].enterCountThisTurn を increment して設定。
   */
  enterOrderThisTurn?: number;
  setCards: SetCardEntry[];   // rules: 16-card-set.md (裏向きセット対応)
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
  | { type: 'card-back'; cardId: string }  // Round 3: 隠された cardId を保持 (ネクストヒント時に表向きで手札に渡すため)
  | { type: 'assisted-partner'; cardId: string };

/**
 * Placeholder CardId for FILE cards that have no revealed identity yet.
 * Matches the FileCard { type: 'card-back' } convention in mutate/file.ts.
 * Use this constant instead of the string literal 'card-back' in flow/effect code.
 */
export const FILE_CARD_BACK_PLACEHOLDER = 'card-back' as const;

export type TurnScopedFlags = {
  handUseUsed: boolean;
  nextHintUsed: boolean;
  assistedThisTurn: boolean;
  declaredAbilityUseCount: Record<string, number>;
  /**
   * 「このターンの登場順」カウンタ (rules/17 §【疾風 N】用)。
   * mutate.scene.enter で increment、turn:start で 0 リセット。
   * SceneCharacter.enterOrder (cumulative 累積位置) とは別。
   */
  enterCountThisTurn?: number;
};

export type LogEntry = {
  ts: number;
  player: 'self' | 'opp';
  turn: number;
  action: string;
  target?: string;
  result?: string;
};

// pendingEffects は EffectStackEntry[] として保持する。
// 単なる Effect ではなく、発火元・発火タイミング・解決状態を含むラッパー。
// spec: .claude/specs/engine-api-resolver.md
import type { EffectStackEntry } from './effect-stack.js';

export type GameState = {
  turn: {
    number: number;
    player: 'self' | 'opp';
    phase: 'auto' | 'main' | 'end';
    isFirstPlayerFirstTurn: boolean;
  };
  players: { self: PlayerState; opp: PlayerState };
  pendingEffects: EffectStackEntry[];
  scratchTrace: { self: '未発見' | '発見済'; opp: '未発見' | '発見済' };
  turnState: { self: TurnScopedFlags; opp: TurnScopedFlags };
  refreshCount: { self: number; opp: number };
  log: LogEntry[];
  gameResult?: { winner: 'self' | 'opp'; reason: 'evidence' | 'deck-out' | 'concede' };
};
