// src/ui/state/store.ts — Phase 7 Task 7.1
// 役割: GameState の受動的ホルダ + dispatcher（mutator を実行して結果を保持）
//
// 設計方針（plan / 骨格凍結原則準拠）:
//  - store はドメイン知識を持たない。UI イベント→engine mutation の seam に徹する
//  - mutator は呼び出し側が engine API から合成する純粋関数 (s: GameState) => GameState
//  - 状態 mutation は engine が immutable に管理するため、store では immer を使わない
//  - gameState=null はゲーム未ロードを表す。dispatch は null のとき no-op

import { create } from 'zustand';
import { produce } from '@/engine/produce';
import { mutate } from '@/engine/mutate';
import type { GameState } from '@/engine/types/game-state';
import type { CausalEffectTrace, EffectCtx } from '@/engine/types';
import type { ContinuationFrame, PendingEffectSource } from '@/engine/effect/pending-state';
import { isCausalLogEntry } from '@/engine/log/causal.js';
import {
  hydratePendingRuntimeState,
  resetPendingRuntimeState,
  resetPendingRuntimeStateAfterGameEnd,
  restorePendingRuntimeState,
  snapshotPendingRuntimeState,
  withIsolatedPendingRuntimeState,
} from '@/engine/effect/runtime-state.js';
import { _drainPendingDeckRevealSide, _drainPendingPublicHandRevealSide } from '@/engine/effect/atom-handlers.js';
import {
  collectPendingSideChannels,
  type PendingSurfaceState,
} from './surface-pending.js';
import {
  admitPresentationFromState,
  currentPresentationSessionId,
  getPresentationQueue,
  validatePresentationAtCurrentState,
} from '@/ui/presentation/coordinator.js';
import { usePresentationStore } from '@/ui/presentation/store.js';
import {
  areStoreRollbackParticipantsCurrent,
  checkpointStoreRollbackParticipants,
  markStoreRollbackHandled,
  rollbackStoreRollbackParticipants,
  runStoreRollbackPublication,
  StoreRollbackHandledError,
} from '@/ui/services/storeTransaction.js';
import { notifyTerminalInteractionPublication } from '@/ui/services/terminalInteractionPublication.js';

export type GameStateMutator = (state: GameState) => GameState;
export type PendingDecisionIdentity = { decisionId: string };
type PendingDecision<T> = T & PendingDecisionIdentity;
export type SetGameStateOptions = {
  /** Keep live resolver channels while committing the next state of one session. */
  preserveRuntime?: boolean;
};

export type GameStateStore = {
  /** 現在のゲーム状態。未ロード時は null。 */
  gameState: GameState | null;
  /** state を全置換する（ゲーム開始 / リセット / リプレイ読み込み用） */
  /** `true` only when presentation validation passed and the replacement was committed. */
  setGameState: (state: GameState | null, options?: SetGameStateOptions) => boolean;
  /** Atomically publish a validated terminal state with no actionable UI surface. */
  commitTerminalState: (state: GameState) => boolean;
  /** Replay projection only. Never hydrates resolver continuations or decision surfaces. */
  setReplayGameState: (state: GameState | null) => void;
  /** 新規対戦開始前に GameState と UI 上の対戦一時状態を一括破棄する。 */
  resetMatchSessionState: () => void;
  /**
   * 現在の gameState に mutator を適用し、その戻り値で置き換える。
   * gameState が null の場合は何もしない（mutator も呼ばれない）。
   */
  /** `true` only when the produced state passed validation and was committed. */
  dispatch: (mutator: GameStateMutator) => boolean;
  /**
   * Phase 8 完全クローズ Commit 2: 進行中の ActionContext.id を保持。
   * - actionDeclareChar/Case dispatch 直後にセット
   * - useContactFlowDriver が監視し phase ごとにモーダル open / AI 自動進行
   * - phase='action-end' に到達したら driver が null にクリア
   * GameState には積まない理由は src/engine/flow/action/state-machine.ts の冒頭コメント参照。
   */
  activeActionId: string | null;
  setActiveActionId: (id: string | null) => void;
  /** Monotonic UI decision identity. Deliberately survives match-session reset. */
  pendingDecisionSeq: number;
  /**
   * Phase 8 完全クローズ Commit 3a: アクション[事件] による証拠リムーブで
   * ヒラメキ能力が検出された時の保留状態。
   * - engine listener (`src/engine/listeners/hirameki.ts`) が
   *   `evidence:remove-by-action` 発火で側チャネル経由で set
   * - useHiramekiFlowDriver が監視し、self owner ならモーダル / opp owner なら AI 自動
   * - `hiramekiResolve` dispatch で fire/skip 決定 → クリア
   */
  pendingHirameki: PendingDecision<PendingHirameki> | null;
  setPendingHirameki: (p: PendingHirameki | null) => void;
  /**
   * Phase 8 完全クローズ Commit 3b: 推理に対する human-side ミスリード保留状態。
   * - listener (`src/engine/listeners/misread.ts`) が human defender ケースで側チャネル経由で set
   * - AI defender ケースは listener 内で同期解決するため pending は使わない
   * - useMisreadFlowDriver が監視し、self defender ならモーダル open
   * - `misreadResolve` dispatch で picks 決定 → クリア
   */
  pendingMisread: PendingDecision<PendingMisread> | null;
  setPendingMisread: (p: PendingMisread | null) => void;
  /**
   * Task2/4: アクティブカード信号 — 効果解決中 / CPU が今動かしているカードの uid + 行動ラベル。
   * SceneArea がその場ぴこんポップ + チップ表示に使う (中央全画面ポップは不採用)。
   * CPU 手番は useOppTurnDriver が 1 手ごとに set、ターン終了で null クリア。
   */
  activeCardUid: string | null;
  activeCardLabel: string | null;
  setActiveCard: (uid: string | null, label: string | null) => void;
  /**
   * Task4: CPU 1手駆動の再 fire トリガ。useOppTurnDriver が 1 手 (stepTurn) 適用するたび ++ し、
   * useEffect の deps に含めることで「1手→重要手だけ aiSpeedMs 表示→次の1手」を成立させる
   * (turn.player は 'opp' のまま変わらないため、これが無いと 1 手で stall する)。
   */
  oppMoveTick: number;
  bumpOppMoveTick: () => void;
  /**
   * Round 4l (B5 観戦モード): true なら self ターンも AI が自動進行 (AI vs AI 観戦)。
   * - GameSetupModal の「観戦」button で true に
   * - useSpectatorTurnDriver が turnPlayer==='self' && spectatorMode==true で driveSelfTurn を実行
   */
  spectatorMode: boolean;
  setSpectatorMode: (v: boolean) => void;
  /**
   * user_request 20260521_01 #12: AI ターン進行の遅延 (ms)。
   * - useOppTurnDriver / useSpectatorTurnDriver が重要手の表示間隔として参照
   * - AI 進行設定から変更可能
   * - default 400ms (既存 oppTurnDelayMs / spectatorDelayMs と一致)
   * - preset: 200 (高速) / 400 (標準) / 800 (普通) / 1500 (ゆっくり) / 3000 (最遅)
   */
  aiSpeedMs: number;
  setAiSpeedMs: (ms: number) => void;
  /**
   * user_request 20260521_01 #12: AI 自動進行の一時停止フラグ。
   * - true なら driver の setTimeout は走らない (= AI 進行停止)
   * - 対戦画面の専用操作で切替
   * - step button は paused でも 1 回駆動 (aiStepCounter で gate)
   */
  isAiPaused: boolean;
  setAiPaused: (v: boolean) => void;
  /**
   * user_request 20260521_01 #12: step button counter。
   * - paused 中に increment → driver が 1 回だけ駆動して再度停止
   * - driver 側は最後に消費した counter 値を useRef で記憶
   */
  aiStepCounter: number;
  incrementAiStep: () => void;
  /**
   * user_request 20260522_01 #2/#6 BUG-054: human player による effect 対象
   * 選択待ち state。triggered listener が humanChooser fired 時に
   * resolve-picks 経由 globalThis 側チャネルにセット → useEngineDispatch
   * post-dispatch drain で本 field に転送 → useEffectPickFlowDriver が modal を
   * 開きユーザー選択を待つ。
   */
  pendingEffectPick: PendingDecision<PendingEffectPick> | null;
  setPendingEffectPick: (p: PendingEffectPick | null) => void;
  /**
   * BUG-121: enter トリガ等の human 複数 option choice 待ち state。pendingEffectPick と同型 —
   * resolve-picks が humanChooser fired 時に globalThis 側チャネルにセット → useEngineDispatch
   * post-dispatch drain で本 field に転送 → ChoiceResolveModalHost が modal を開き選択を待つ。
   */
  pendingEffectChoice: PendingDecision<PendingEffectChoice> | null;
  setPendingEffectChoice: (p: PendingEffectChoice | null) => void;
  /**
   * 2026-06-06 タスクC: optional 決定 (「〜してもよい」) 待ち state。pendingEffectChoice と同型 —
   * resolve-picks の optional case が humanChooser fired 時に globalThis 側チャネルにセット →
   * useEngineDispatch drain で本 field に転送 → EffectOptionalModalHost が「する/しない」modal を開き選択を待つ。
   */
  pendingEffectOptional: PendingDecision<PendingEffectOptional> | null;
  setPendingEffectOptional: (p: PendingEffectOptional | null) => void;
  pendingChooseIntercept: PendingDecision<PendingChooseIntercept> | null;
  setPendingChooseIntercept: (p: PendingChooseIntercept | null) => void;
  pendingLeaveIntercept: PendingDecision<PendingLeaveIntercept> | null;
  setPendingLeaveIntercept: (p: PendingLeaveIntercept | null) => void;
  pendingRps: PendingDecision<PendingRps> | null;
  setPendingRps: (p: PendingRps | null) => void;
  pendingSetCardChoice: PendingDecision<PendingSetCardChoice> | null;
  setPendingSetCardChoice: (p: PendingSetCardChoice | null) => void;
  pendingSetCardReplacement: PendingDecision<PendingSetCardReplacement> | null;
  setPendingSetCardReplacement: (p: PendingSetCardReplacement | null) => void;
  /** repeatOptional の各round決定。body実行後、残回数があれば次roundへ遷移する。 */
  pendingEffectRepeatOptional: PendingDecision<PendingEffectRepeatOptional> | null;
  setPendingEffectRepeatOptional: (p: PendingEffectRepeatOptional | null) => void;
  /**
   * user_request 20260522_01 #12 BUG-061: D11019「15の受難」等の
   * deckRevealUntil 効果でデッキ上から公開されたカードを順次めくる演出用。
   * atom-handlers.deckRevealUntil 末尾で side-channel set → dispatch drain で
   * 本 field に反映 → DeckRevealOverlay が表示 → auto-dismiss で null へ。
   */
  pendingDeckReveal: PendingDeckReveal | null;
  setPendingDeckReveal: (p: PendingDeckReveal | null) => void;
  pendingPublicHandReveal: PendingPublicHandReveal | null;
  setPendingPublicHandReveal: (p: PendingPublicHandReveal | null) => void;
  /**
   * BUG-136: deckToBottomBound「残りを好きな順番でデッキの下に移す」の順序選択待ち。
   * engine 側 PendingDeckReorderSide と同 shape。human 所有 & 2 枚以上なら移動前にsetされ、
   * DeckReorderModal確定時に指定順で底へ移して後続効果を再開する。
   */
  pendingDeckReorder: PendingDecision<PendingDeckReorder> | null;
  setPendingDeckReorder: (p: PendingDeckReorder | null) => void;
  /**
   * mini-wave #5 P2: deckPlaceSplitBound「見た各カードを上か下へ」の振り分け待ち。
   * engine 側 PendingDeckPlaceSide と同 shape。human 所有時だけ set され DeckPlaceModal で
   * top/bottom へ割当。deckPlaceResolve dispatch で適用して null へ。
   */
  pendingDeckPlace: PendingDecision<PendingDeckPlace> | null;
  setPendingDeckPlace: (p: PendingDeckPlace | null) => void;
  /**
   * 2026-05-26 ヒラメキ効果検証 demo モード。
   * 'idle'      … 未使用 (通常ゲーム)
   * 'picking'   … HiramekiDemoPickerModal 表示中、ユーザが icon-flash カード選択待ち
   * 'playing'   … state-owned actionDeclareCase → guard → judge 完了、
   *               hirameki resolve 待ち。useHiramekiDemoDriver が pendingHirameki 監視。
   * 'completed' … hirameki resolve 完了、HiramekiDemoBanner 表示。Reset で 'idle' に戻る。
   */
  hiramekiDemoMode: 'idle' | 'picking' | 'playing' | 'completed';
  setHiramekiDemoMode: (m: 'idle' | 'picking' | 'playing' | 'completed') => void;
  /** Demo で選択された hirameki カードの cardId (banner 表示用)。 */
  hiramekiDemoSelectedCardId: string | null;
  setHiramekiDemoSelectedCardId: (id: string | null) => void;
  /**
   * 2026-05-27 カットイン効果検証 demo モード (hirameki demo と同型)。
   * 'idle' → 'picking' (picker 表示) → 'playing' (contact flow 進行中) →
   * 'completed' (cutin effect 適用 + judge 完了)。
   */
  cutinDemoMode: 'idle' | 'picking' | 'playing' | 'completed';
  setCutinDemoMode: (m: 'idle' | 'picking' | 'playing' | 'completed') => void;
  /** Monotonic identity for one cut-in demo run. Deliberately survives session reset. */
  cutinDemoRunToken: number;
  cutinDemoSelectedCardId: string | null;
  setCutinDemoSelectedCardId: (id: string | null) => void;
};

export type PendingDeckReveal = {
  player: 'self' | 'opp';
  visibility: 'public' | 'private';
  viewer: 'self' | 'opp' | 'all';
  revealed: string[];
  matched: string | null;
  /** BUG-132 GAP-1: chooseMatch pick 未解決中は overlay を hold (engine 側 PendingDeckRevealSide と同 shape) */
  awaitingPick?: boolean;
  /** Pure reveal which returns every card to its original deck position. */
  presentation?: 'reveal-return';
  source?: { cardId?: string; abilityId?: string; uid?: string };
};

export type PendingPublicHandReveal = {
  owner: 'self' | 'opp';
  audience: 'all';
  cardIds: string[];
  handSnapshot: string[];
  lifetime: 'effect' | 'presentation';
  resolutionToken: string;
  source: { cardId?: string; abilityId?: string; uid?: string };
};

export type PendingDeckReorder = {
  player: 'self' | 'opp';
  /** 並べ替え対象カード群。 */
  cardIds: string[];
  deckSnapshot?: string[];
  occurrences?: Array<{ cardId: string; index: number }>;
  ctx?: EffectCtx;
  continuation?: ContinuationFrame;
};

export type PendingDeckPlace = {
  player: 'self' | 'opp';
  /** mini-wave #5 P2: deckPlaceSplitBound「各カードを上か下へ」の振り分け対象 (公開順、まだ deck 元位置) */
  cardIds: string[];
  /** S2 B01093: 選択者 = ability owner (絶対座標)。modal 表示 gate はこちらで判定 (engine 型と同 shape) */
  ownerPlayer: 'self' | 'opp';
  deckSnapshot: string[];
  occurrences: Array<{ cardId: string; index: number }>;
  ctx: EffectCtx;
  continuation?: ContinuationFrame;
};

export type PendingEffectPick = {
  player: 'self' | 'opp';
  candidates: {
    uid: string;
    cardId: string;
    player: 'self' | 'opp';
    kind?: 'char' | 'card' | 'evidence';
    area?: string;
    index?: number;
    hostUid?: string;
    setCardInstanceId?: string;
    hidden?: boolean;
  }[];
  atomVerb: string;
  atomArgs: Record<string, unknown>;
  nMin: number;
  nMax: number;
  requestedNMin?: number;
  requestedNMax?: number;
  minimumPolicy?: 'best-effort' | 'exact';
  source: PendingEffectSource;
  publicHandRevealToken?: string;
  /**
   * D08021 driver 2026-05-26: target.query.distinctNames を UI multi-select に伝達。
   * CardListModal で同 name component (rules/19) の重複選択を click 不可化する。
   */
  distinctNames?: boolean;
  /**
   * Cluster WB1 (2026-07-11, B09105「キッ」): target.query.distinctLevel を UI multi-select に伝達。
   * CardListModal で同一 (印字) レベルの重複選択を click 不可化する (distinctNames の level 版)。
   */
  distinctLevel?: boolean;
  distinctColors?: boolean;
  /**
   * BUG-132 GAP-1: decline (pickedUid=null) を「0枚選択の atom 解決 + remainder 続行」として
   * 処理するマーカー (engine 側 PendingEffectPickSide.skipResolvesAtom と同 shape)。
   */
  skipResolvesAtom?: boolean;
  /**
   * engine mega-wave W2b (2026-07-03, P50/r27): mustBeSelectedByOppEvent (B08087) forced 集合
   * (engine 側 PendingEffectPickSide.forcedUids と同 shape)。UI は forced 以外を pick 不可化し
   * skip を封じる (human enforce は UI が唯一の層)。unclamped — min(forced.length, nMax) 枚必須。
   */
  forcedUids?: string[];
  /**
   * 夜間 W0 (2026-07-11, B08019 a2): perSideMax quota (「自分と相手で1枚ずつ」) を UI multi-select
   * に伝達 (engine 側 PendingEffectPickSide.perSideMax と同 shape、resolve-picks.ts が伝播済)。
   * EffectPickerModal multi mode が side 別選択数を quota で click 不可化する (human enforce は UI 層)。
   */
  perSideMax?: number;
  aggregateLevelMax?: number;
};

/** BUG-121: human 複数 option choice 保留 (PendingEffectChoiceSide と同 shape)。 */
export type PendingEffectChoice = {
  player: 'self' | 'opp';
  /** Decision owner can differ from the player whose effect is paused. */
  sourcePlayer?: 'self' | 'opp';
  publicHandRevealToken?: string;
  source: PendingEffectSource & { uid: string };
  options: { index: number; verb?: string; args?: Record<string, unknown>; label?: string; sceneEnter?: boolean }[];
};

/** 2026-06-06 タスクC: optional 決定 (「〜してもよい」) 保留 (PendingEffectOptionalSide と同 shape)。 */
export type PendingEffectOptional = {
  player: 'self' | 'opp';
  publicHandRevealToken?: string;
  source: PendingEffectSource & { uid: string };
  /** optional 内が $trigger.<field> を参照する場合の再開 ctx 復元用 (B03038、JSON-safe) */
  triggerPayload?: unknown;
};

export type PendingRps = {
  player: 'self' | 'opp';
  ownerPlayer: 'self' | 'opp';
  aiHand: 'rock' | 'paper' | 'scissors';
  source: PendingEffectSource & { uid: string };
};

/** An opaque set-card entry: no card identity crosses the UI boundary. */
export type PendingSetCardChoice = {
  player: 'self' | 'opp';
  hostUid: string;
  face?: 'down' | 'up' | 'any';
  destination?: { area: 'evidence'; faceUp: boolean } | { area: 'hand' } | { area: 'scene'; hostUid: string };
  /** effect=従来の単一選択、cost=宣言コストの複数物理 occurrence 選択。 */
  purpose?: 'effect' | 'cost';
  entries: {
    instanceId: string;
    ordinal: number;
    /** cost picker の公開 host 情報。裏向き cardId は格納しない。 */
    hostUid?: string;
    hostLabel?: string;
    hidden?: boolean;
    cardId?: string;
  }[];
  nMin?: number;
  nMax?: number;
  selectedInstanceIds?: string[];
  source: PendingEffectSource & { uid: string };
};
export type PendingSetCardReplacement = {
  player: 'self' | 'opp'; fromUid: string; setCardInstanceId: string;
  candidates: { uid: string; cardId: string }[];
  source: PendingEffectSource & { uid: string };
};

/** Opponent may discard one hand occurrence to cancel the already-selected effect. */
export type PendingChooseIntercept = {
  player: 'self' | 'opp';
  publicHandRevealToken?: string;
  protector: { uid: string; cardId: string; abilityId: string };
  targetUid: string;
};

/** Human decision window for B01092-style leave interception. */
export type PendingLeaveIntercept = {
  player: 'self' | 'opp';
  targetUid: string;
  interceptorUid: string;
  actionId: string;
};

export type PendingEffectRepeatOptional = {
  player: 'self' | 'opp';
  source: PendingEffectSource & { uid: string };
  remaining: number;
};

/** ヒラメキ保留 (Commit 3a) */
export type PendingHirameki = {
  /** 証拠の所有者 = ヒラメキ発動権利者 */
  player: 'self' | 'opp';
  /** 元証拠カードの cardId */
  cardId: string;
  /** 発動対象 ability id */
  abilityId: string;
  /** Ver.2.5 p.21: false means activation is legal but resolves no text. */
  effectValid?: boolean;
  /** wave-11: アクション[事件] actor uid snapshot ('$trigger.byUid' =「アクション中のキャラ」解決用) */
  actorUid?: string;
  /** Exact remove-area occurrence created by the action evidence removal. */
  occurrence?: { player: 'self' | 'opp'; cardId: string; removeIndex: number };
  /** State-owned action that must still be awaiting this decision. */
  actionId?: string;
  /** Exact public evidence-removal event that opened this decision. */
  causalCorrelationEventId?: string;
  /** The action state machine owes its evidence gain after this decision. */
  gainDeferred?: boolean;
};

/** ミスリード保留 (Commit 3b) */
export type PendingMisread = {
  /** Player who chooses which misread abilities to activate. */
  player: 'self' | 'opp';
  /** 推理側 (LP-X 対象) の uid */
  reasoningUid: string;
  /** 推理側プレイヤー */
  reasoningPlayer: 'self' | 'opp';
  /** 発動候補 (反対側 active misread 持ち) */
  candidates: { uid: string; x: number }[];
  /** Causal graph paused while this decision is surfaced. */
  causalTrace?: CausalEffectTrace;
};

function setPendingDecision<T extends object>(
  set: (updater: (state: GameStateStore) => Partial<GameStateStore>) => void,
  key: keyof GameStateStore,
  pending: T | null,
): void {
  set((state) => {
    if (pending === null) return { [key]: null } as Partial<GameStateStore>;
    const next = state.pendingDecisionSeq + 1;
    return {
      [key]: { ...pending, decisionId: `decision:${next}` },
      pendingDecisionSeq: next,
    } as Partial<GameStateStore>;
  });
}

export const MATCH_SESSION_RESET_STATE = {
  gameState: null,
  activeActionId: null,
  pendingHirameki: null,
  pendingMisread: null,
  activeCardUid: null,
  activeCardLabel: null,
  oppMoveTick: 0,
  spectatorMode: false,
  isAiPaused: false,
  aiStepCounter: 0,
  pendingEffectPick: null,
  pendingEffectChoice: null,
  pendingEffectOptional: null,
  pendingChooseIntercept: null,
  pendingLeaveIntercept: null,
  pendingRps: null,
  pendingSetCardChoice: null,
  pendingSetCardReplacement: null,
  pendingEffectRepeatOptional: null,
  pendingDeckReveal: null,
  pendingPublicHandReveal: null,
  pendingDeckReorder: null,
  pendingDeckPlace: null,
  hiramekiDemoMode: 'idle',
  hiramekiDemoSelectedCardId: null,
  cutinDemoMode: 'idle',
  cutinDemoSelectedCardId: null,
} as const;

const PENDING_SURFACE_RESET_STATE = {
  pendingHirameki: null,
  pendingMisread: null,
  pendingEffectPick: null,
  pendingEffectChoice: null,
  pendingEffectOptional: null,
  pendingChooseIntercept: null,
  pendingLeaveIntercept: null,
  pendingRps: null,
  pendingSetCardChoice: null,
  pendingSetCardReplacement: null,
  pendingEffectRepeatOptional: null,
  pendingDeckReveal: null,
  pendingPublicHandReveal: null,
  pendingDeckReorder: null,
  pendingDeckPlace: null,
} as const;

const TERMINAL_SURFACE_RESET_STATE = {
  ...PENDING_SURFACE_RESET_STATE,
  activeActionId: null,
  activeCardUid: null,
  activeCardLabel: null,
  hiramekiDemoMode: 'idle',
  hiramekiDemoSelectedCardId: null,
  cutinDemoMode: 'idle',
  cutinDemoSelectedCardId: null,
} as const;

function latestOpenActionContext(
  state: GameState,
): NonNullable<GameState['actionContexts']>[string] | undefined {
  const open = Object.values(state.actionContexts ?? {})
    .filter((context) => context.phase !== 'action-end');
  const allocated = state.actionContextSeq === undefined
    ? undefined
    : open.find((context) => context.id === `ax_${state.actionContextSeq}`);
  if (allocated) return allocated;
  return open.sort((left, right) => {
    const leftSeq = /^ax_(\d+)$/.exec(left.id)?.[1];
    const rightSeq = /^ax_(\d+)$/.exec(right.id)?.[1];
    if (leftSeq !== undefined && rightSeq !== undefined) {
      const sequenceDelta = Number(rightSeq) - Number(leftSeq);
      if (sequenceDelta !== 0) return sequenceDelta;
    }
    const turnDelta = right.startedAt.turn - left.startedAt.turn;
    if (turnDelta !== 0) return turnDelta;
    const timeDelta = right.startedAt.nano - left.startedAt.nano;
    if (timeDelta !== 0) return timeDelta;
    return right.id.localeCompare(left.id, undefined, { numeric: true });
  })[0];
}

function assertPendingLeaveIntercept(
  context: NonNullable<GameState['actionContexts']>[string] | undefined,
): void {
  const pending = context?.pendingLeaveIntercept as unknown;
  if (pending === undefined) return;
  if (pending === null || typeof pending !== 'object' || Array.isArray(pending)) {
    throw new Error('Invalid pendingLeaveIntercept: expected an object');
  }

  const value = pending as Record<string, unknown>;
  if (value.player !== 'self' && value.player !== 'opp') {
    throw new Error('Invalid pendingLeaveIntercept.player');
  }
  for (const field of ['targetUid', 'interceptorUid'] as const) {
    if (typeof value[field] !== 'string' || value[field].trim().length === 0) {
      throw new Error(`Invalid pendingLeaveIntercept.${field}`);
    }
  }
  if (typeof context?.id !== 'string' || context.id.trim().length === 0) {
    throw new Error('Invalid pendingLeaveIntercept.actionId');
  }
}

export function prepareGameStateForStore(state: GameState): {
  gameState: GameState;
  openAction: ReturnType<typeof latestOpenActionContext>;
} {
  const gameState = produce(state, (draft) => mutate.char.ensureSetCardInstanceIds(draft));
  const openAction = latestOpenActionContext(gameState);
  assertPendingLeaveIntercept(openAction);
  const humanSideGlobal = globalThis as {
    __humanPlayerSide?: 'self' | 'opp' | null;
  };
  const hadHumanSide = Object.prototype.hasOwnProperty.call(globalThis, '__humanPlayerSide');
  const previousHumanSide = humanSideGlobal.__humanPlayerSide;
  try {
    humanSideGlobal.__humanPlayerSide = null;
    withIsolatedPendingRuntimeState(gameState, () => {
      collectPendingSideChannels({
        ...PENDING_SURFACE_RESET_STATE,
        pendingDecisionSeq: 0,
      });
    });
  } finally {
    if (hadHumanSide) humanSideGlobal.__humanPlayerSide = previousHumanSide;
    else delete humanSideGlobal.__humanPlayerSide;
  }
  return { gameState, openAction };
}

function admitCommittedPresentation(state: GameState): void {
  try {
    const admission = admitPresentationFromState(state);
    usePresentationStore.getState().setPresentationError(
      admission.rejected ? `presentation admission rejected: ${admission.rejected}` : null,
    );
  } catch (error) {
    usePresentationStore.getState().setPresentationError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

function validatePresentationCommit(state: GameState): boolean {
  try {
    validatePresentationAtCurrentState(state);
    const causalSessionId = state.causalLog?.sessionId
      ?? state.log.find(isCausalLogEntry)?.sessionId;
    if (causalSessionId && causalSessionId !== currentPresentationSessionId()) {
      throw new Error('presentation admission rejected: session');
    }
    return true;
  } catch (error) {
    usePresentationStore.getState().setPresentationError(
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

export const useGameStateStore = create<GameStateStore>((set, get) => ({
  gameState: null,
  setGameState: (state, options) => {
    if (state !== null && !validatePresentationCommit(state)) return false;
    const prepared = state === null ? null : prepareGameStateForStore(state);
    const gameState = prepared?.gameState ?? null;
    if (gameState?.gameResult !== undefined) {
      return get().commitTerminalState(gameState);
    }
    const openAction = gameState?.gameResult === undefined ? prepared?.openAction : null;
    const store = get();
    const pending = openAction?.pendingLeaveIntercept;
    const leaveDecisionSeq = store.pendingDecisionSeq + (pending ? 1 : 0);
    const surfaceSeed: PendingSurfaceState = {
      ...PENDING_SURFACE_RESET_STATE,
      pendingDecisionSeq: leaveDecisionSeq,
      pendingLeaveIntercept: pending && openAction
        ? {
            ...pending,
            actionId: openAction.id,
            decisionId: `decision:${leaveDecisionSeq}`,
          }
        : null,
      ...(options?.preserveRuntime === true
        ? {
            pendingDeckReveal: store.pendingDeckReveal,
            pendingPublicHandReveal: store.pendingPublicHandReveal,
          }
        : {}),
    };
    const previousRuntime = snapshotPendingRuntimeState();
    let pendingSurface = surfaceSeed;
    try {
      if (options?.preserveRuntime !== true) resetPendingRuntimeState();
      if (gameState !== null && gameState.gameResult === undefined) {
        hydratePendingRuntimeState(gameState);
        pendingSurface = collectPendingSideChannels(surfaceSeed);
      }
    } catch (error) {
      restorePendingRuntimeState(previousRuntime);
      throw error;
    }
    set({
      ...pendingSurface,
      gameState,
      activeActionId: gameState?.gameResult === undefined ? openAction?.id ?? null : null,
    });
    if (gameState !== null) admitCommittedPresentation(gameState);
    return true;
  },
  commitTerminalState: (state) => {
    if (state.gameResult === undefined) return false;
    const prepared = prepareGameStateForStore(state).gameState;
    if (
      prepared.gameResult === undefined
      || Object.keys(prepared.actionContexts ?? {}).length !== 0
      || !validatePresentationCommit(prepared)
    ) return false;
    const storeBefore = get();
    let completedDeckReveal = storeBefore.pendingDeckReveal?.awaitingPick === true
      ? null
      : storeBefore.pendingDeckReveal;
    let presentationHandReveal = storeBefore.pendingPublicHandReveal?.lifetime === 'presentation'
      ? storeBefore.pendingPublicHandReveal
      : null;
    const runtimeBefore = snapshotPendingRuntimeState();
    const participantCheckpoints = checkpointStoreRollbackParticipants();
    try {
      resetPendingRuntimeStateAfterGameEnd({ preserveCompletedPresentations: true });
      // The terminal resolver may have just completed a FIFO reveal after the
      // previous store surface was consumed. Keep exactly one presentable item.
      completedDeckReveal ??= _drainPendingDeckRevealSide();
      presentationHandReveal ??= _drainPendingPublicHandRevealSide();
      set({
        ...TERMINAL_SURFACE_RESET_STATE,
        gameState: prepared,
        pendingDeckReveal: completedDeckReveal,
        pendingPublicHandReveal: presentationHandReveal,
      });
      admitCommittedPresentation(prepared);
    } catch (error) {
      const authorityCurrent = rollbackStoreRollbackParticipants(participantCheckpoints);
      if (authorityCurrent) {
        try {
          runStoreRollbackPublication(storeBefore, () => set(storeBefore, true));
        } catch {
          // The exact replacement is already installed before Zustand notifies
          // subscribers. A rollback listener failure must not mask the original
          // failed terminal publish.
        }
        if (get() === storeBefore
          && areStoreRollbackParticipantsCurrent(participantCheckpoints)) {
          restorePendingRuntimeState(runtimeBefore);
        }
      }
      throw markStoreRollbackHandled(error);
    }
    if (storeBefore.gameState?.gameResult === undefined) {
      notifyTerminalInteractionPublication();
    }
    return true;
  },
  setReplayGameState: (state) => {
    if (state !== null && !validatePresentationCommit(state)) return;
    set({
      ...MATCH_SESSION_RESET_STATE,
      gameState: state,
    });
  },
  resetMatchSessionState: () => {
    resetPendingRuntimeState();
    set(MATCH_SESSION_RESET_STATE);
  },
  dispatch: (mutator) => {
    const current = get().gameState;
    if (current === null) return false;
    const storeBefore = get();
    const runtimeBefore = snapshotPendingRuntimeState();
    const participantCheckpoints = checkpointStoreRollbackParticipants();
    try {
      const next = mutator(current);
    // BUG-006: state-machine の advance() は module-level ax.phase のみ変えて
    // GameState を mutate しないケースがあり、Immer produce が同一参照を返す。
    // 同一参照だと Zustand subscribers が起きず、ContactFlowDriver の useEffect が
    // 再 run しないため judge phase で stuck する。常に新参照を保証して driver を起動する。
      const nextRef = Object.is(next, current) ? { ...current } : next;
      if (!validatePresentationCommit(nextRef)) return false;
      if (nextRef.gameResult !== undefined) return get().commitTerminalState(nextRef);
      set({ gameState: nextRef });
      admitCommittedPresentation(nextRef);
      return true;
    } catch (error) {
      if (error instanceof StoreRollbackHandledError) {
        if (get() === storeBefore
          && areStoreRollbackParticipantsCurrent(participantCheckpoints)) {
          restorePendingRuntimeState(runtimeBefore);
        }
        throw error;
      }
      const authorityCurrent = rollbackStoreRollbackParticipants(participantCheckpoints);
      if (authorityCurrent) {
        try {
          if (get() !== storeBefore) {
            runStoreRollbackPublication(storeBefore, () => set(storeBefore, true));
          }
        } catch {
          // Store state is replaced before listener delivery; preserve original error.
        }
        if (get() === storeBefore
          && areStoreRollbackParticipantsCurrent(participantCheckpoints)) {
          restorePendingRuntimeState(runtimeBefore);
        }
      }
      throw markStoreRollbackHandled(error);
    }
  },
  activeActionId: null,
  setActiveActionId: (id) => set({ activeActionId: id }),
  pendingDecisionSeq: 0,
  pendingHirameki: null,
  setPendingHirameki: (p) => setPendingDecision(set, 'pendingHirameki', p),
  pendingMisread: null,
  setPendingMisread: (p) => setPendingDecision(set, 'pendingMisread', p),
  activeCardUid: null,
  activeCardLabel: null,
  setActiveCard: (uid, label) => set({ activeCardUid: uid, activeCardLabel: label }),
  oppMoveTick: 0,
  bumpOppMoveTick: () => set((s) => ({ oppMoveTick: s.oppMoveTick + 1 })),
  spectatorMode: false,
  setSpectatorMode: (v) => set({ spectatorMode: v }),
  aiSpeedMs: 400,
  setAiSpeedMs: (ms) => set({ aiSpeedMs: ms }),
  isAiPaused: false,
  setAiPaused: (v) => set({ isAiPaused: v }),
  aiStepCounter: 0,
  incrementAiStep: () => set((s) => ({ aiStepCounter: s.aiStepCounter + 1 })),
  pendingEffectPick: null,
  setPendingEffectPick: (p) => setPendingDecision(set, 'pendingEffectPick', p),
  pendingEffectChoice: null,
  setPendingEffectChoice: (p) => setPendingDecision(set, 'pendingEffectChoice', p),
  pendingEffectOptional: null,
  setPendingEffectOptional: (p) => setPendingDecision(set, 'pendingEffectOptional', p),
  pendingChooseIntercept: null,
  setPendingChooseIntercept: (p) => setPendingDecision(set, 'pendingChooseIntercept', p),
  pendingLeaveIntercept: null,
  setPendingLeaveIntercept: (p) => setPendingDecision(set, 'pendingLeaveIntercept', p),
  pendingRps: null,
  setPendingRps: (p) => setPendingDecision(set, 'pendingRps', p),
  pendingSetCardChoice: null,
  setPendingSetCardChoice: (p) => setPendingDecision(set, 'pendingSetCardChoice', p),
  pendingSetCardReplacement: null,
  setPendingSetCardReplacement: (p) => setPendingDecision(set, 'pendingSetCardReplacement', p),
  pendingEffectRepeatOptional: null,
  setPendingEffectRepeatOptional: (p) => setPendingDecision(set, 'pendingEffectRepeatOptional', p),
  pendingDeckReveal: null,
  setPendingDeckReveal: (p) => set({ pendingDeckReveal: p }),
  pendingPublicHandReveal: null,
  setPendingPublicHandReveal: (p) => set({ pendingPublicHandReveal: p }),
  pendingDeckReorder: null,
  setPendingDeckReorder: (p) => setPendingDecision(set, 'pendingDeckReorder', p),
  pendingDeckPlace: null,
  setPendingDeckPlace: (p) => setPendingDecision(set, 'pendingDeckPlace', p),
  hiramekiDemoMode: 'idle',
  setHiramekiDemoMode: (m) => set({ hiramekiDemoMode: m }),
  hiramekiDemoSelectedCardId: null,
  setHiramekiDemoSelectedCardId: (id) => set({ hiramekiDemoSelectedCardId: id }),
  cutinDemoMode: 'idle',
  setCutinDemoMode: (m) => set((state) => ({
    cutinDemoMode: m,
    ...(m === 'playing' && state.cutinDemoMode !== 'playing'
      ? { cutinDemoRunToken: state.cutinDemoRunToken + 1 }
      : {}),
  })),
  cutinDemoRunToken: 0,
  cutinDemoSelectedCardId: null,
  setCutinDemoSelectedCardId: (id) => set({ cutinDemoSelectedCardId: id }),
}));

// Capacity is temporary backpressure. Re-admit the canonical suffix as soon as
// presentation removes one full-queue item; never dispatch an engine action.
getPresentationQueue().onCapacityAvailable(() => {
  const state = useGameStateStore.getState().gameState;
  if (state !== null) admitCommittedPresentation(state);
});
