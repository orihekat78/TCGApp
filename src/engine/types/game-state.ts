// GameState 型定義
// rules: 01-victory-conditions.md, 03-field-areas.md, 05-turn-phases.md, 13-keywords.md, 14-refresh.md

export type CardId = string;

export type PlayerState = {
  partner: PartnerOnBoard;
  // MR partner-area (rules/18, 2026-06-23 engine/mr-partner-area-core):
  // MR能力①で相手ターン中に現場を離れた MR キャラ、または MR能力②で別の現場 MR を退かせた後に
  // パートナーエリアに常駐する MR キャラを保持する optional slot。real `partner` (strict singleton)
  // とは別枠 (rules/03:8 PA 枚数上限なし)。MR能力②により MR は player 毎 常に ≤1 → 単一 optional で十分。
  // SceneCharacter を流用 (declaredUseCount で PA-MR の【ターン①】を保持)。uid は sentinel
  // `partnerMR:self`/`partnerMR:opp` に書き換える (collectCardsInPlay / scene.byUid 解決用)。
  // 不在 (undefined/null) が既定 — state-factory / fixtures は未初期化 (additive, 回帰0)。
  partnerAreaMR?: SceneCharacter | null;
  // BUG-067 (2026-05-28): declaredUseCount を case にも追加して ターン① enforcement を可能に
  case: { cardId: string; status: '事件編' | '解決編'; requiredEvidence: number; colors: string[]; declaredUseCount: Record<string, number> };
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
  // Round 3: 隠された cardId を保持 (ネクストヒント時に表向きで手札に渡すため)
  // Task D E3 (2026-06-12): faceUp — fileFlipTop (「FILEの上から1枚表向きにする」B09021 等) で
  // 表向き化された状態。optional (undefined=裏向き) なので既存 state と互換。
  | { type: 'card-back'; cardId: string; faceUp?: boolean }
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
  /**
   * 「このターン中、自分はイベントを使用できない」(rules/25 §B08020 周辺 / B09034 公式 Q&A)。
   * setEventUseBan verb がセットし、turn:start の resetTurnFlags でクリア。
   * undefined/false = 制限なし。ゲート対象は「手札の使用」と「ネクストヒント」の event のみ
   * (公式 Q&A: 【カットイン】【ヒラメキ】は本制限を受けない)。enterCountThisTurn と同じ
   * optional-flag 前例に倣い state-factory / fixtures では未初期化。
   */
  eventUseBanned?: boolean;
  /**
   * 「アクション[事件]終了時まで、このプレイヤーの【ヒラメキ】は発動しない」(B06049 a2、cluster8 2026-06-15)。
   * setHiramekiSuppress verb が **相手** (アクション[事件]を行った側から見た相手 = 証拠を失う側) の slot に
   * セットし、state-machine の action-end (contact-end→action-end 遷移) で両プレイヤー分クリアする
   * (action-scoped。eventUseBanned の turn-scoped とは清掃タイミングが異なる)。turn:start の
   * resetTurnFlags も backstop でクリア。listeners/triggered.ts handleEvidenceRemovedHook が
   * payload.player の本フラグを見て hirameki の push/queue を抑止する。undefined/false = 抑止なし。
   */
  hiramekiSuppressed?: boolean;
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
