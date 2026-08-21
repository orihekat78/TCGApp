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
  // PA 一般カード枠 (rules/03 §パートナーエリア、engine wave-12 2026-07-02 G39):
  // 「このカードをパートナーエリアに移す」効果 (B07059/B07060/PR195 等のイベント) で PA に常駐する
  // 一般カードの配列。公式 Q&A (B07059 ほか): PA に置けるカードの枚数に **上限なし** → 配列・cap なし。
  // partner (strict singleton) / partnerAreaMR (MR 専用 slot) とは別枠。移動元は常に remove
  // (event は使用時に remove へ置かれてから効果解決 / hirameki も removeTop で remove 移動後に hook)。
  // 参照は candidates.ts case 'partner-area' が {kind:'card', area:'partner-area'} で列挙。
  // 不在 (undefined) が既定 — state-factory / fixtures は未初期化 (additive, 回帰0)。
  partnerAreaCards?: CardId[];
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
  /** Runtime occurrence identity. Optional for saved states and legacy fixtures. */
  instanceId?: string;
  /** Per-occurrence replacement history. Turn numbers make expiry implicit. */
  replacementUseCounts?: Record<string, { turn: number; count: number }>;
};

/** Exact occurrence below a host; duplicate print IDs remain distinguishable. */
export type StackedCardEntry = {
  cardId: string;
  instanceId: string;
};

/** Numeric form is accepted only for legacy saved states and old fixtures. */
export type StackedCards = number | StackedCardEntry[];

export function stackedCardCount(cards: StackedCards): number {
  return Array.isArray(cards) ? cards.length : cards;
}

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
  stackedCards: StackedCards;
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
  /** Scoped actor modifiers. Optional for legacy saved states. */
  turnEffects?: Record<string, unknown>;
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
  /** Turn-scoped traits granted to every character owned by this player, in every rules area. */
  globalCharacterTraitGrants_turn?: string[];
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
   * 「このターン中、自分はネクストヒントできない」(B06104/P・B09019/P・B09105/P、wave use-restrict 2026-06-30)。
   * setNextHintBan verb がセットし、turn:start の resetTurnFlags でクリア。undefined/false = 制限なし。
   * eventUseBanned は手札使用/ネクストヒントの **event のみ** を gate するのに対し、本フラグは
   * **ネクストヒント全体** (step1 FILE→手札 含む) を canStartNextHint で不可にする (rules/12 §「ネクストヒントできない」)。
   * 手札の使用 (rules/05 01.) は別行動なので阻害しない。enterCountThisTurn と同じ optional-flag 前例に倣い未初期化。
   */
  nextHintBanned?: boolean;
  /** Turn-scoped named character restriction (B06103): normal use and effect entry only. */
  useEnterBannedCardNames?: string[];
  /**
   * 「アクション[事件]終了時まで、このプレイヤーの【ヒラメキ】は発動しない」(B06049 a2、cluster8 2026-06-15)。
   * setHiramekiSuppress verb が **相手** (アクション[事件]を行った側から見た相手 = 証拠を失う側) の slot に
   * セットし、state-machine の action-end (contact-end→action-end 遷移) で両プレイヤー分クリアする
   * (action-scoped。eventUseBanned の turn-scoped とは清掃タイミングが異なる)。turn:start の
   * resetTurnFlags も backstop でクリア。listeners/triggered.ts handleEvidenceRemovedHook が
   * payload.player の本フラグを見て hirameki の push/queue を抑止する。undefined/false = 抑止なし。
   */
  hiramekiSuppressed?: boolean;
  /**
   * 「相手はこのアクションによって証拠を得られない」(B02088/B03126 ヒラメキ、mega-wave W6 step7
   * row70)。setEvidenceGainSuppress verb が **アクション[事件]を行った側** (ヒラメキ所有者 =
   * 証拠を失った側から見た相手) の slot にセットし、flow/action-case.ts gainSelfEvidence が
   * consume-on-read (読んだら即 false) で単発消費する。清掃は turn:start の resetTurnFlags
   * backstop **のみ** — hiramekiSuppressed と違い action-end 清掃は書かない (本フラグはヒラメキ解決
   * = 当該アクションの action-end が同期発火し終わった後にセットされるため、action-end 清掃は
   * 「セット前に走る dead code」になる)。undefined/false = 抑止なし。
   */
  evidenceGainSuppressed?: boolean;
  /**
   * 「このターン中、(このプレイヤーの) キャラの【疾風】が発動していたか」(B09072 横溝重悟、
   * engine additive wave-8 2026-07-02 P15)。listeners/triggered.ts の in-play scan で疾風 ability
   * (abilityIsShippu = enter + enterOrderEquals) が全 gate 通過 = 実際に発動した時点で発動キャラの
   * owner 側を true にする。「このターン中、自分のキャラの【疾風】が発動していた場合」は汎用
   * Condition {kind:'flag', player:'self', key:'shippuFiredThisTurn', v:true} で読む (新 Condition kind 不要)。
   * 清掃は endTurn (phase:end:cleanup、両プレイヤー) が primary + resetTurnFlags が backstop。
   * キャラ離場後も履歴として残る (boolean、per-char turnEffect ではない) ため「発動した疾風キャラが
   * その後リムーブされても条件成立」を満たす。undefined/false = 未発動。既存カードは本 flag を
   * 読まない (write-only) → 挙動不変 (smoke baseline 不変)。付与 (grantedAbilities) 由来の【疾風】も
   * abilityIsShippu 一致で記録する (rules/17 §「〜を持つ」= 付与も該当)。
   * ⚠ endTurn 清掃は phase:end:cleanup (phase:end:start の「ターン終了時」trigger queue より **後**)。
   *   将来「ターン終了時、疾風発動キャラが〜」型の consumer は queue 時評価の `ability.condition` で本 flag を
   *   読むこと (in-effect の resolve-time `conditional` は清掃後で false になる。本 wave の consumer B09072 a1 は
   *   【登場時】= main-phase reader なので無関係)。
   */
  shippuFiredThisTurn?: boolean;
  /**
   * mega-wave W6 step4 (2026-07-04, B09090/P16): 「このターン中、次に自分の現場に登場したキャラは
   * 【疾風】の条件を無視できる」の armed flag。setShippuWaive verb がセット。消費 = **次に登場した
   * キャラ 1 体** (疾風の有無を問わない、公式Q&A: 疾風を持たないキャラが次に登場したら arm は無駄に
   * 消費され、その次の疾風は発動しない)。listeners/triggered.ts handleHook の enter 前処理が
   * owner 側 armed を消費し、登場キャラへ per-char turnEffects['shippuWaived']=true を移す
   * (matcherCondition=enterOrderEquals の bypass 根拠)。清掃: resetTurnFlags + endTurn 両プレイヤー。
   * ⚠ per-player `shippuFiredThisTurn` (turnState=発動履歴) / per-char `shippuFiredCharThisTurn`
   * (turnEffects=発動キャラ標識、r58) / 本 flag (turnState=waive 予約) の 3 軸は別物 — 取り違え注意。
   */
  shippuWaiveArmed?: boolean;
  /**
   * 「このターン中、このプレイヤーは【カットイン】を使用できない」(B07002 江戸川コナン a2、wave-10 2026-07-02)。
   * setCutinBan verb がセット (B07002 は player:'opp' = 相手側 slot へ)、turn:start の resetTurnFlags でクリア。
   * ゲート: flow/contact.ts canCutIn。side-level flag ゆえ発動キャラが現場を離れても有効
   * (公式 Q&A B07002「使用した後でこのキャラが現場を離れても有効ですか？→はい。能力を使用したターン中は有効」)。
   * per-char の cutinBanOpp_action (action-scoped turnEffect、wave-0629d) とは別 axis。
   * undefined/false = 制限なし。既存カードは未使用 (write は B07002 のみ) → 挙動不変。
   */
  cutinBanned?: boolean;
  /**
   * 同上の【変装】版 —「このターン中、このプレイヤーは【変装】を使用できない」(B07002 a2)。
   * setDisguiseBan verb がセット、ゲートは flow/contact.ts canDisguise、清掃は resetTurnFlags。
   */
  disguiseBanned?: boolean;
  /**
   * engine A3 wave (2026-07-11, B05007 妃英理): 「このターン中、自分の現場にいる〚特徴［毛利探偵事務所］〛の
   * キャラがアクションしたとき、アクション終了時まで相手は【カットイン】を使用できない」— 【宣言】能力が
   * arm する **turn-scoped filter**。canCutIn が現行アクションの actor (ax.byUid/byPlayer) を本 filter と
   * live 照合し、一致キャラのアクション中のみ相手 cutin を封じる (per-char flag 不要 = 将来登場キャラにも自動適用)。
   * 「アクション終了時まで」= canCutIn がアクション中のみ呼ばれるため自然に action スコープ。turn:start で清掃。
   * この slot は armer (【宣言】使用者) 側。undefined = 制限なし (既存カード未使用 → 挙動不変)。
   */
  actionCutinBanOppFilter?: TargetFilter;
};

export type LegacyLogEntry = {
  schemaVersion?: never;
  ts: number;
  player: 'self' | 'opp';
  turn: number;
  action: string;
  target?: string;
  /** When set, target is private to this player; action/result remain public. */
  targetAudience?: 'self' | 'opp';
  result?: string;
};

export type CausalEventKind =
  | 'use'
  | 'declare'
  | 'select'
  | 'draw'
  | 'discard'
  | 'zone-move'
  | 'enter'
  | 'sleep'
  | 'stun'
  | 'activate'
  | 'face-change'
  | 'value-change'
  | 'evidence'
  | 'case-status-change'
  | 'case-resolve'
  | 'negate'
  | 'fizzle'
  | 'cancel'
  | 'game-result'
  | 'summary';

export type CausalEventTag = 'contact' | 'cutin' | 'hirameki' | 'misread' | 'refresh';

export type PublicCausalZone =
  | 'deck'
  | 'hand'
  | 'scene'
  | 'partner'
  | 'case'
  | 'file'
  | 'evidence'
  | 'remove'
  | 'set-card';

export type PublicCausalRef = {
  visibility: 'public';
  kind: 'player' | 'card' | 'zone' | 'counter' | 'rule';
  label: string;
  side?: 'self' | 'opp';
  zone?: PublicCausalZone;
  cardNumber?: string;
};

export type CausalOutcome =
  | { type: 'none' }
  | { type: 'count'; amount: number; unit: 'card' | 'evidence' | 'lp' | 'ap' | 'level' }
  | { type: 'move'; from: PublicCausalZone; to: PublicCausalZone; count: number }
  | { type: 'state'; state: 'success' | 'failed' | 'cancelled' | 'negated' | 'fizzled' | 'sleep' | 'stun' | 'active' }
  | { type: 'case-status'; from: 'incident'; to: 'resolved' }
  | { type: 'face-change'; from: 'face-down' | 'face-up'; to: 'face-down' | 'face-up'; count: number }
  | { type: 'summary'; count: number; kinds: CausalEventKind[] };

export type CausalLogEntryV1 = {
  schemaVersion: 1;
  eventId: string;
  sessionId: string;
  sequence: number;
  ts: number;
  player: 'self' | 'opp';
  actor: 'self' | 'opp';
  turn: number;
  action: string;
  target?: string;
  targetAudience?: never;
  result?: string;
  kind: CausalEventKind;
  tags?: CausalEventTag[];
  parentEventId?: string;
  correlationEventId?: string;
  source?: PublicCausalRef;
  targets: PublicCausalRef[];
  outcome: CausalOutcome;
};

export type LogEntry = LegacyLogEntry | CausalLogEntryV1;

export type CausalLogStateV1 = {
  schemaVersion: 1;
  sessionId: string;
  nextSequence: number;
};

// pendingEffects は EffectStackEntry[] として保持する。
// 単なる Effect ではなく、発火元・発火タイミング・解決状態を含むラッパー。
// spec: .claude/specs/engine-api-resolver.md
import type { EffectStackEntry, ReasoningContinuation } from './effect-stack.js';
import type { ReservedEffectEntry } from './reserved-effect.js';
import type { TargetFilter } from './effect.js'; // engine A3 wave (2026-07-11): actionCutinBanOppFilter (B05007)
import type { ActionContext } from './results.js';

export type GameState = {
  turn: {
    number: number;
    player: 'self' | 'opp';
    phase: 'auto' | 'main' | 'end';
    isFirstPlayerFirstTurn: boolean;
  };
  players: { self: PlayerState; opp: PlayerState };
  /**
   * Monotonic revisions for indexed physical zones. Optional only for legacy
   * saves; resumable physical selections fail closed until this exists.
   */
  indexedZoneEpochs?: {
    self: { deck: number; evidence: number; remove: number };
    opp: { deck: number; evidence: number; remove: number };
  };
  pendingEffects: EffectStackEntry[];
  /** Serializable in-flight action state. Optional only for legacy saves. */
  actionContexts?: Record<string, ActionContext>;
  /** Monotonic ActionContext allocator. Optional only for legacy saves. */
  actionContextSeq?: number;
  /** Monotonic EffectStackEntry allocator. Optional only for legacy saves. */
  effectEntrySeq?: number;
  /** Monotonic scene-character UID allocator. Optional only for legacy saves. */
  sceneUidSeq?: number;
  /**
   * Serializable turn-boundary continuation. End-phase effects must finish
   * before cleanup, expiry, turn transfer, and the optional next-turn start.
   */
  pendingTurnTransition?: {
    endingPlayer: 'self' | 'opp';
    stage: 'after-end-start' | 'after-cleanup' | 'after-turn-end';
    startNextTurn: boolean;
  };
  /** Monotonic identity for a serializable human-decision continuation. */
  pendingRuntimeSeq?: number;
  /**
   * Human-decision side channels paused by the resolver. The runtime globals
   * are only a live-process cache; this snapshot is the save/replay authority.
   */
  pendingRuntimeState?: {
    token: number;
    snapshot: Array<{
      key: string;
      present: boolean;
      value?: unknown;
    }>;
  };
  /**
   * Monotonic identity allocator for one hook emission.  Kept in GameState so
   * a saved/replayed match cannot accidentally merge two separate timings.
   * Optional only for legacy saves created before BUG-249.
   */
  effectTriggerBatchSeq?: number;
  /** Persisted declaration-causality sequence; survives save/reload. */
  declaredBatchSeq?: number;
  /** Engine-only single-use authority for the current reasoning continuation. */
  pendingReasoningContinuation?: ReasoningContinuation;
  /** Monotonic token allocator for reasoning continuations. */
  reasoningContinuationSeq?: number;
  /**
   * Transient nesting context while a hook listener is running.  This is
   * deliberately state-owned (rather than a module singleton) so nested
   * `event.queue` calls retain their real emission batch.
   */
  effectTriggerBatchContext?: number;
  /** Confirmation inherited only by continuation entries queued while resolving. */
  effectTriggerBatchConfirmedContext?: boolean;
  /** Monotonic set-card occurrence allocator; absent only in legacy saved state. */
  setCardInstanceSeq?: number;
  /** Persisted allocator for delayed reserved-effect identities. */
  reservedEffectSeq?: number;
  /** Persisted allocator for public-hand reveal resolution tokens. */
  publicHandRevealSeq?: number;
  /** Persisted allocator for physical choose-intercept reaction witnesses. */
  chooseInterceptBatchSeq?: number;
  /**
   * 離場後予約効果 queue (mega-wave W6 step8, row75)。コストで源カードが盤面を離れる
   * 「ターン終了時〜」(B08069) /「このターン中、次に〜したとき」(B01058) をカード位置非依存で保持。
   * arm = reserveEffect atom / 発火 = listeners/reserved-effects.ts (single-fire) /
   * 失効 = flow/turn.ts endTurn (next-match 未消費分)。pendingEffects と違い turn 内 hold される。
   */
  reservedEffects: ReservedEffectEntry[];
  scratchTrace: { self: '未発見' | '発見済'; opp: '未発見' | '発見済' };
  turnState: { self: TurnScopedFlags; opp: TurnScopedFlags };
  refreshCount: { self: number; opp: number };
  /** Public causal-log identity and allocator. Optional only before a caller starts a session. */
  causalLog?: CausalLogStateV1;
  log: LogEntry[];
  gameResult?: { winner: 'self' | 'opp'; reason: 'evidence' | 'deck-out' | 'concede' | 'alt-lose' };
};
