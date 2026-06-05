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
   * user_request 20260522_01 #12 BUG-061: D11019「15の受難」等の
   * deckRevealUntil 効果でデッキ上から公開されたカードを順次めくる演出用。
   * atom-handlers.deckRevealUntil 末尾で side-channel set → dispatch drain で
   * 本 field に反映 → DeckRevealOverlay が表示 → auto-dismiss で null へ。
   */
  pendingDeckReveal: PendingDeckReveal | null;
  setPendingDeckReveal: (p: PendingDeckReveal | null) => void;
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
};

/** BUG-121: human 複数 option choice 保留 (PendingEffectChoiceSide と同 shape)。 */
export type PendingEffectChoice = {
  player: 'self' | 'opp';
  source: { cardId: string; abilityId: string; uid: string };
  options: { index: number; verb?: string; args?: Record<string, unknown> }[];
};

/** ヒラメキ保留 (Commit 3a) */
export type PendingHirameki = {
  /** 証拠の所有者 = ヒラメキ発動権利者 */
  player: 'self' | 'opp';
  /** 元証拠カードの cardId */
  cardId: string;
  /** 発動対象 ability id */
  abilityId: string;
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
  pendingDeckReveal: null,
  setPendingDeckReveal: (p) => set({ pendingDeckReveal: p }),
  hiramekiDemoMode: 'idle',
  setHiramekiDemoMode: (m) => set({ hiramekiDemoMode: m }),
  hiramekiDemoSelectedCardId: null,
  setHiramekiDemoSelectedCardId: (id) => set({ hiramekiDemoSelectedCardId: id }),
  cutinDemoMode: 'idle',
  setCutinDemoMode: (m) => set({ cutinDemoMode: m }),
  cutinDemoSelectedCardId: null,
  setCutinDemoSelectedCardId: (id) => set({ cutinDemoSelectedCardId: id }),
}));
