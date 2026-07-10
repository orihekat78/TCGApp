// src/ui/state/store.ts — Phase 7 Task 7.1
// 役割: GameState の受動的ホルダ + dispatcher（mutator を実行して結果を保持）
//
// 設計方針（plan / 骨格凍結原則準拠）:
//  - store はドメイン知識を持たない。UI イベント→engine mutation の seam に徹する
//  - mutator は呼び出し側が engine API から合成する純粋関数 (s: GameState) => GameState
//  - 状態 mutation は engine が immutable に管理するため、store では immer を使わない
//  - gameState=null はゲーム未ロードを表す。dispatch は null のとき no-op

import { create } from 'zustand';
import type { GameState } from '@/engine/types/game-state';

export type GameStateMutator = (state: GameState) => GameState;

export type GameStateStore = {
  /** 現在のゲーム状態。未ロード時は null。 */
  gameState: GameState | null;
  /** state を全置換する（ゲーム開始 / リセット / リプレイ読み込み用） */
  setGameState: (state: GameState) => void;
  /**
   * 現在の gameState に mutator を適用し、その戻り値で置き換える。
   * gameState が null の場合は何もしない（mutator も呼ばれない）。
   */
  dispatch: (mutator: GameStateMutator) => void;
  /**
   * Phase 8 完全クローズ Commit 2: 進行中の ActionContext.id を保持。
   * - actionDeclareChar/Case dispatch 直後にセット
   * - useContactFlowDriver が監視し phase ごとにモーダル open / AI 自動進行
   * - phase='action-end' に到達したら driver が null にクリア
   * GameState には積まない理由は src/engine/flow/action/state-machine.ts の冒頭コメント参照。
   */
  activeActionId: string | null;
  setActiveActionId: (id: string | null) => void;
  /**
   * Phase 8 完全クローズ Commit 3a: アクション[事件] による証拠リムーブで
   * ヒラメキ能力が検出された時の保留状態。
   * - engine listener (`src/engine/listeners/hirameki.ts`) が
   *   `evidence:remove-by-action` 発火で側チャネル経由で set
   * - useHiramekiFlowDriver が監視し、self owner ならモーダル / opp owner なら AI 自動
   * - `hiramekiResolve` dispatch で fire/skip 決定 → クリア
   */
  pendingHirameki: PendingHirameki | null;
  setPendingHirameki: (p: PendingHirameki | null) => void;
  /**
   * Phase 8 完全クローズ Commit 3b: 推理に対する human-side ミスリード保留状態。
   * - listener (`src/engine/listeners/misread.ts`) が human defender ケースで側チャネル経由で set
   * - AI defender ケースは listener 内で同期解決するため pending は使わない
   * - useMisreadFlowDriver が監視し、self defender ならモーダル open
   * - `misreadResolve` dispatch で picks 決定 → クリア
   */
  pendingMisread: PendingMisread | null;
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
   * useEffect の deps に含めることで「1手→aiSpeedMs 待ち→次の1手」のループを成立させる
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
   * - useOppTurnDriver / useSpectatorTurnDriver が setTimeout(driver, aiSpeedMs) で参照
   * - SpectatorHUD の slider で変更可能
   * - default 400ms (既存 oppTurnDelayMs / spectatorDelayMs と一致)
   * - preset: 200 (高速) / 400 (標準) / 800 (普通) / 1500 (ゆっくり) / 3000 (最遅)
   */
  aiSpeedMs: number;
  setAiSpeedMs: (ms: number) => void;
  /**
   * user_request 20260521_01 #12: AI 自動進行の一時停止フラグ。
   * - true なら driver の setTimeout は走らない (= AI 進行停止)
   * - SpectatorHUD の pause / resume ボタンで切替
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
  pendingEffectPick: PendingEffectPick | null;
  setPendingEffectPick: (p: PendingEffectPick | null) => void;
  /**
   * BUG-121: enter トリガ等の human 複数 option choice 待ち state。pendingEffectPick と同型 —
   * resolve-picks が humanChooser fired 時に globalThis 側チャネルにセット → useEngineDispatch
   * post-dispatch drain で本 field に転送 → ChoiceResolveModalHost が modal を開き選択を待つ。
   */
  pendingEffectChoice: PendingEffectChoice | null;
  setPendingEffectChoice: (p: PendingEffectChoice | null) => void;
  /**
   * 2026-06-06 タスクC: optional 決定 (「〜してもよい」) 待ち state。pendingEffectChoice と同型 —
   * resolve-picks の optional case が humanChooser fired 時に globalThis 側チャネルにセット →
   * useEngineDispatch drain で本 field に転送 → EffectOptionalModalHost が「する/しない」modal を開き選択を待つ。
   */
  pendingEffectOptional: PendingEffectOptional | null;
  setPendingEffectOptional: (p: PendingEffectOptional | null) => void;
  /**
   * user_request 20260522_01 #12 BUG-061: D11019「15の受難」等の
   * deckRevealUntil 効果でデッキ上から公開されたカードを順次めくる演出用。
   * atom-handlers.deckRevealUntil 末尾で side-channel set → dispatch drain で
   * 本 field に反映 → DeckRevealOverlay が表示 → auto-dismiss で null へ。
   */
  pendingDeckReveal: PendingDeckReveal | null;
  setPendingDeckReveal: (p: PendingDeckReveal | null) => void;
  /**
   * BUG-136: deckToBottomBound「残りを好きな順番でデッキの下に移す」の順序選択待ち。
   * engine 側 PendingDeckReorderSide と同 shape。human 所有 & 2 枚以上を底へ移したときだけ set され
   * DeckReorderModal で並べ替える。deckReorderResolve dispatch で底ブロックを再配置して null へ。
   */
  pendingDeckReorder: PendingDeckReorder | null;
  setPendingDeckReorder: (p: PendingDeckReorder | null) => void;
  /**
   * mini-wave #5 P2: deckPlaceSplitBound「見た各カードを上か下へ」の振り分け待ち。
   * engine 側 PendingDeckPlaceSide と同 shape。human 所有時だけ set され DeckPlaceModal で
   * top/bottom へ割当。deckPlaceResolve dispatch で適用して null へ。
   */
  pendingDeckPlace: PendingDeckPlace | null;
  setPendingDeckPlace: (p: PendingDeckPlace | null) => void;
  /**
   * 2026-05-26 ヒラメキ効果検証 demo モード。
   * 'idle'      … 未使用 (通常ゲーム)
   * 'picking'   … HiramekiDemoPickerModal 表示中、ユーザが icon-flash カード選択待ち
   * 'playing'   … setGameState 完了、actionAgainstCase dispatch 済み、
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
  cutinDemoSelectedCardId: string | null;
  setCutinDemoSelectedCardId: (id: string | null) => void;
};

export type PendingDeckReveal = {
  player: 'self' | 'opp';
  revealed: string[];
  matched: string | null;
  /** BUG-132 GAP-1: chooseMatch pick 未解決中は overlay を hold (engine 側 PendingDeckRevealSide と同 shape) */
  awaitingPick?: boolean;
};

export type PendingDeckReorder = {
  player: 'self' | 'opp';
  /** デッキ底へ移したカード群 (公開順)。並べ替え対象 */
  cardIds: string[];
};

export type PendingDeckPlace = {
  player: 'self' | 'opp';
  /** mini-wave #5 P2: deckPlaceSplitBound「各カードを上か下へ」の振り分け対象 (公開順、まだ deck 元位置) */
  cardIds: string[];
  /** S2 B01093: 選択者 = ability owner (絶対座標)。modal 表示 gate はこちらで判定 (engine 型と同 shape) */
  ownerPlayer: 'self' | 'opp';
};

export type PendingEffectPick = {
  player: 'self' | 'opp';
  candidates: { uid: string; cardId: string; player: 'self' | 'opp' }[];
  atomVerb: string;
  atomArgs: Record<string, unknown>;
  nMin: number;
  nMax: number;
  source: { cardId: string; abilityId: string };
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
};

/** BUG-121: human 複数 option choice 保留 (PendingEffectChoiceSide と同 shape)。 */
export type PendingEffectChoice = {
  player: 'self' | 'opp';
  source: { cardId: string; abilityId: string; uid: string };
  options: { index: number; verb?: string; args?: Record<string, unknown> }[];
};

/** 2026-06-06 タスクC: optional 決定 (「〜してもよい」) 保留 (PendingEffectOptionalSide と同 shape)。 */
export type PendingEffectOptional = {
  player: 'self' | 'opp';
  source: { cardId: string; abilityId: string; uid: string };
  /** optional 内が $trigger.<field> を参照する場合の再開 ctx 復元用 (B03038、JSON-safe) */
  triggerPayload?: unknown;
};

/** ヒラメキ保留 (Commit 3a) */
export type PendingHirameki = {
  /** 証拠の所有者 = ヒラメキ発動権利者 */
  player: 'self' | 'opp';
  /** 元証拠カードの cardId */
  cardId: string;
  /** 発動対象 ability id */
  abilityId: string;
  /** wave-11: アクション[事件] actor uid snapshot ('$trigger.byUid' =「アクション中のキャラ」解決用) */
  actorUid?: string;
};

/** ミスリード保留 (Commit 3b) */
export type PendingMisread = {
  /** 推理側 (LP-X 対象) の uid */
  reasoningUid: string;
  /** 推理側プレイヤー */
  reasoningPlayer: 'self' | 'opp';
  /** 発動候補 (反対側 active misread 持ち) */
  candidates: { uid: string; x: number }[];
};

export const useGameStateStore = create<GameStateStore>((set, get) => ({
  gameState: null,
  setGameState: (state) => set({ gameState: state }),
  dispatch: (mutator) => {
    const current = get().gameState;
    if (current === null) return;
    const next = mutator(current);
    // BUG-006: state-machine の advance() は module-level ax.phase のみ変えて
    // GameState を mutate しないケースがあり、Immer produce が同一参照を返す。
    // 同一参照だと Zustand subscribers が起きず、ContactFlowDriver の useEffect が
    // 再 run しないため judge phase で stuck する。常に新参照を保証して driver を起動する。
    const nextRef = Object.is(next, current) ? { ...current } : next;
    set({ gameState: nextRef });
  },
  activeActionId: null,
  setActiveActionId: (id) => set({ activeActionId: id }),
  pendingHirameki: null,
  setPendingHirameki: (p) => set({ pendingHirameki: p }),
  pendingMisread: null,
  setPendingMisread: (p) => set({ pendingMisread: p }),
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
  setPendingEffectPick: (p) => set({ pendingEffectPick: p }),
  pendingEffectChoice: null,
  setPendingEffectChoice: (p) => set({ pendingEffectChoice: p }),
  pendingEffectOptional: null,
  setPendingEffectOptional: (p) => set({ pendingEffectOptional: p }),
  pendingDeckReveal: null,
  setPendingDeckReveal: (p) => set({ pendingDeckReveal: p }),
  pendingDeckReorder: null,
  setPendingDeckReorder: (p) => set({ pendingDeckReorder: p }),
  pendingDeckPlace: null,
  setPendingDeckPlace: (p) => set({ pendingDeckPlace: p }),
  hiramekiDemoMode: 'idle',
  setHiramekiDemoMode: (m) => set({ hiramekiDemoMode: m }),
  hiramekiDemoSelectedCardId: null,
  setHiramekiDemoSelectedCardId: (id) => set({ hiramekiDemoSelectedCardId: id }),
  cutinDemoMode: 'idle',
  setCutinDemoMode: (m) => set({ cutinDemoMode: m }),
  cutinDemoSelectedCardId: null,
  setCutinDemoSelectedCardId: (id) => set({ cutinDemoSelectedCardId: id }),
}));
