// engine.effect.pending-state — pick/choice/optional の中断 decision を保持する side-channel 状態。
// Phase 3b (2026-06-22): resolve-picks.ts から pending管理を分離 (責務 3 分割 walk/pending/continuation)。
// rules: 15-abilities-effects.md (未解決効果は所有者が解決) / 25-qa-effects-resolution.md
// spec: .claude/specs/refactor-plan/phase-3b-design.md
//
// 役割: declare global ×8 / Pending各型 / ContinuationFrame型 / toPlainDeep / queue/slot/holder の
//   getter/setter/drain/peek/clear/take。walk (resolve-picks) と continuation (apply-pick) の共有状態。
//   本ファイルは leaf (resolve-picks/apply-pick/resolver を import しない)。

import type { Effect, EffectCtx, EffectResolutionKind } from '../types/index.js';

type Player = 'self' | 'opp';

export type PendingEffectSource = {
  cardId: string;
  abilityId: string;
  uid?: string;
  /** Resolving-card lifecycle marker. Must survive human decision pauses. */
  resolutionKind?: EffectResolutionKind;
  /** Stack position to resume before the next simultaneous sibling. */
  triggerBatch?: number;
  ownerChosenOrder?: number;
  ownerOrderConfirmed?: boolean;
  declaredBatch?: number | string;
};

// Phase 3c (2026-06-22): choice 再開 holder。旧 2 channel (Resume=Effect / 旧 ChoiceBindings=bindings) を
// 1 globalThis slot (__pendingEffectChoiceResume) に統合した格納形。effect / bindings は
// 個別に set/take/clear できる (現 API シグネチャ不変)。両 field とも null 可・holder 自体も null 可。
type ChoiceResumeState = {
  effect: Effect | null;
  bindings: Record<string, unknown> | null;
  continuation: ContinuationFrame | null;
};

// user_request 20260522_01 #6 BUG-054 + BUG-078 (queue 化): human pick の側チャネル。
// BUG-078 fix: 単一スロットから FIFO queue に変更。sequence 内に複数 PB pick atom がある
// 場合 (D08013 a1 step 2 evidenceToHand → step 3 discard 等)、初回 drain で両方を push し、
// effectPickResolve dispatch ごとに先頭を shift して順次 UI に出す。
declare global {

  var __pendingEffectPickQueue: PendingEffectPickSide[] | undefined;
  // Legacy backward-compat: 旧コード/テストが queue[0] を読む時の互換 property。
  // 書き込み (`= null`) しても queue は変わらないため、cleanup は
  // `_clearPendingEffectPickQueue()` を使うこと。

  var __pendingEffectPickSide: PendingEffectPickSide | null | undefined;
  // Phase 3c (2026-06-22): 旧 chain break 信号 slot (chainStepNoApply) は ctx.dyn.chainStepNoApply へ移設
  // (intra-produce で resolver chain case のみ読む → globalThis 不要)。本 declare global は削除。
  // BUG-121: human の複数 option choice を pause/surface する side-channel (pick と同型・別スロット)。
  // deckReveal と同じ単一スロット (choice は 1 dispatch に高々 1 個想定)。drain で null クリア。

  var __pendingEffectChoiceSide: PendingEffectChoiceSide | null | undefined;
  // BUG-121 (残課題解消): choiceResolve 再開時に再 walk すべき effect (engine holder、store へは drain しない)。
  // top-level choice なら choice 効果そのもの。sequence 内 choice なら sequence case が
  // {sequence:[choice, ...post-choice remainder]} に wrap して保持 → pre-choice step の二重実行を防ぐ。
  // Phase 3c (2026-06-22): BUG-114 の choice bindings (旧 ChoiceBindings channel) を本 holder の
  // bindings field に統合 (常にペアで set/take/clear されるため。globalThis side-channel -1)。bindings = cutin の
  // ctx.bindings ($contact.byUid 等) を保持し、choiceResolve 再開時に resume ctx へ復元する
  // (applyChoiceAndContinuation の bindings:{} で contact binding が落ち、option の $contact.* が未解決になる問題を解消)。

  var __pendingEffectChoiceResume: ChoiceResumeState | null | undefined;
  // 2026-06-06 タスクC: optional 決定の配線 (pendingEffectChoice と同型・別スロット)。
  // 「〜してもよい」effect (Effect kind:'optional') を human に「する/しない」で問う side-channel。
  // choice との違いは選択値が boolean (run) であること。drain で null クリア。

  var __pendingEffectOptionalSide: PendingEffectOptionalSide | null | undefined;
  // optionalResolve 再開時に再 walk すべき optional 効果の holder (engine 内のみ、store へは drain しない)。

  var __pendingEffectOptionalResume: Effect | null | undefined;
  // engine wave-18 (2026-07-03): optional 再開 ctx の bindings 復元 (BUG-114 の choice-bindings 対称)。
  // optional{...} 内効果が $contact.* / ctx.contact (inContact pick, B04092 キャンティ) を参照する場合、
  // surface 時の ctx.bindings を保持しないと resume ctx で contact が失われ pick 候補0になる。

  var __pendingEffectOptionalBindings: Record<string, unknown> | null | undefined;
  // Rock-paper-scissors is a distinct simultaneous-decision flow.  It must not
  // share generic choice state because the hidden AI hand and tie retries are
  // part of its resolution contract.

  var __pendingRpsSide: PendingRpsSide | null | undefined;

  var __pendingRpsResume: Effect | null | undefined;

  var __pendingRpsBindings: Record<string, unknown> | null | undefined;

  var __pendingRpsContinuation: ContinuationFrame | null | undefined;
  // Dedicated discard-or-negate response. It deliberately does not share optional/choice state:
  // accepting discards a hand occurrence and cancels a different effect; declining resumes it.

  var __pendingChooseInterceptSide: PendingChooseInterceptSide | null | undefined;

  var __pendingChooseInterceptResume: ChooseInterceptResume | null | undefined;
}

/**
 * BUG-111 family (continuation-nest, 2026-06-22): 中断 pick の残り step を表す frame。
 * `outer` で外側の囲い (sequence/chain) の remainder を連結する linked list。
 * 内側 (head) が先に実行され、その後 `outer` を辿って外側 remainder を実行する。
 * 単一 frame (outer 無し) は BUG-111 (#1/#2) 以前と byte 互換。
 */
export type ContinuationFrame = {
  remainder: Effect[];
  ctx: EffectCtx;
  kind: 'sequence' | 'chain';
  outer?: ContinuationFrame;
};

export type PendingEffectRepeatOptionalSide = { player: Player; source: PendingEffectSource & { uid: string }; remaining: number };
type RepeatOptionalResume = { body: Effect; remaining: number; ctx: EffectCtx; remainder: Effect[]; continuation?: ContinuationFrame };
declare global { var __pendingEffectRepeatOptionalSide: PendingEffectRepeatOptionalSide | null | undefined; var __pendingEffectRepeatOptionalResume: RepeatOptionalResume | null | undefined; }
export function pushPendingEffectRepeatOptionalSide(v: PendingEffectRepeatOptionalSide, r: RepeatOptionalResume): void { globalThis.__pendingEffectRepeatOptionalSide = v; globalThis.__pendingEffectRepeatOptionalResume = r; }
export function _drainPendingEffectRepeatOptionalSide(): PendingEffectRepeatOptionalSide | null { const v = globalThis.__pendingEffectRepeatOptionalSide ?? null; globalThis.__pendingEffectRepeatOptionalSide = null; return v; }
export function _peekPendingEffectRepeatOptionalSide(): PendingEffectRepeatOptionalSide | null { return globalThis.__pendingEffectRepeatOptionalSide ?? null; }
export function _takePendingEffectRepeatOptionalResume(): RepeatOptionalResume | null { const v = globalThis.__pendingEffectRepeatOptionalResume ?? null; globalThis.__pendingEffectRepeatOptionalResume = null; return v; }
export function setPendingEffectRepeatOptionalRemainder(remainder: Effect[]): void { if (globalThis.__pendingEffectRepeatOptionalResume) globalThis.__pendingEffectRepeatOptionalResume.remainder = remainder; }
export function setPendingEffectRepeatOptionalContinuation(continuation: ContinuationFrame): void { if (globalThis.__pendingEffectRepeatOptionalResume) globalThis.__pendingEffectRepeatOptionalResume.continuation = continuation; }
export function _clearPendingEffectRepeatOptionalSide(): void { globalThis.__pendingEffectRepeatOptionalSide = null; globalThis.__pendingEffectRepeatOptionalResume = null; }

export type PendingEffectPickSide = {
  player: Player;
  /**
   * BUG-175 (2026-07-04): 能力所有者 (ctx.source.player)。chooser (player) と所有者が異なる
   * cross-side pick (「相手は手札を1枚リムーブする」= owner self / chooser opp、B04058) で、
   * 解決後 event.queue の source.player に chooser を渡すと相対 arg (player:'opp') が二重反転する
   * (BUG-174 family 第3経路)。再実行 ctx は所有者を保つ。省略時は player (既存 pending と互換)。
   */
  ownerPlayer?: Player;
  /** 候補 uid 配列 (Candidate.kind === 'char' のみ抽出) */
  candidates: { uid: string; cardId: string; player: Player; kind?: 'char' | 'card' | 'evidence'; area?: string; index?: number }[];
  /** 元 atom の verb (例: 'sceneRemove') */
  atomVerb: string;
  /** atom args (uid='$pick' 含む、resolve 後に上書きされる) */
  atomArgs: Record<string, unknown>;
  /** 任意効果の min/max (n.min === 0 なら skip 可) */
  nMin: number;
  nMax: number;
  /** ability source (UI 表示・log 用) */
  source: PendingEffectSource;
  /** Links a public opponent-hand window to this exact target resolution. */
  publicHandRevealToken?: string;
  /**
   * D08021 driver 2026-05-26: target.query.distinctNames を UI に渡すための flag。
   * true なら UI multi-select で「同じ name component (rules/19 分割名展開後) を持つ
   * 既選択カードと衝突する候補」を click 不可化する。
   */
  distinctNames?: boolean;
  /**
   * Cluster WB1 (2026-07-11, B09105「キッ」): target.query.distinctLevel を UI/AI に渡す flag。
   * true なら multi-select で「既選択カードと同一 (印字) レベルを持つ候補」を click 不可化 (distinctNames の level 版)。
   */
  distinctLevel?: boolean;
  /** B03042: multi-pick cards cannot share a printed color. */
  distinctColors?: boolean;
  /**
   * engine mega-wave W4 (2026-07-03, r84 G38): side 毎の選択上限 (「自分と相手で1枚ずつ」B08019 a2)。
   * UI multi-select は quota 到達 side の残候補を click 不可化 / chooseAiPick は greedy walk で skip。
   */
  perSideMax?: number;
  /** Combined printed level ceiling for a multi-pick. */
  aggregateLevelMax?: number;
  /**
   * engine mega-wave W2b (2026-07-03, P50/r27): mustBeSelectedByOppEvent (B08087) の
   * forced-inclusion 集合。resolve-picks の human push site が算出して載せ、UI (CardListModal
   * auto-select+lock / Playmat 直接クリック restrict / EffectPickerModal restrict) と
   * apply-pick.chooseAiPick (AI drain) が honor する。**unclamped** — forced.length > nMax の
   * 場合は min(forced.length, nMax) 枚を選ぶ (どれを選ぶかは chooser、公式Q&A)。
   * 不在/空 = 従来挙動 byte 等価。
   */
  forcedUids?: string[];
  /**
   * BUG-111: 中断した sequence/chain の残り step (continuation) を pick 本体に同梱し、
   * 別 side-channel FIFO (__pendingChainContinuation) の index ずれ desync を排除する。
   * remainder.length>0 の step で pick を await したときに resolver が set。pick と 1:1。
   *
   * BUG-111 #2 (2026-06-16): `kind` で origin (sequence/chain) を記録する。decline (0枚選択) 時の扱いが
   * origin で分岐する (sequence = 末尾 step は独立で常時実行 rules/15 / chain = 「そうした場合」gate で drop)。
   * multi-step remainder の wrap も origin kind で行い、sequence に chain-gate を誤適用しない。
   *
   * BUG-111 family (continuation-nest, 2026-06-22): `sequence[chain[pausing-pick, step2], step3]` のように
   * pick が 2 重に囲まれて pause したとき、内側 (chain) の frame に外側 (sequence) を `outer` として連結する
   * (上書きせず nest)。head=内側が先に実行され、後で `outer` を辿って外側 remainder を実行する。
   */
  continuation?: ContinuationFrame;
  /**
   * BUG-132 GAP-1 (2026-06-12): skip (pickedUid=null) を「破棄」ではなく「0枚選択の atom 解決」
   * として処理するマーカー (rules/15 「〜まで」=0枚可)。deckRevealUntil chooseMatch が set する。
   * true のとき useEngineDispatch は applyPickSkipAndContinuation を呼び、atom を __declined:true で
   * 再実行 + continuation (デッキ下移動等の必須 remainder) を続行する。
   * 従来 skip (破棄 = continuation も drop) は本 flag 無しの任意効果 pick の挙動として不変。
   */
  skipResolvesAtom?: boolean;
};

export type PendingChooseInterceptSide = {
  player: Player;
  publicHandRevealToken?: string;
  protector: { uid: string; cardId: string; abilityId: string };
  targetUid: string;
};

type ChooseInterceptResume = {
  pending: PendingEffectPickSide;
  pickedUid: string;
  pickedUids?: string[];
  switchRemoveUid?: string;
  switchRemoveUids?: string[];
};

export function pushPendingChooseInterceptSide(v: PendingChooseInterceptSide, resume: ChooseInterceptResume): void {
  globalThis.__pendingChooseInterceptSide = v;
  globalThis.__pendingChooseInterceptResume = resume;
}

export function _drainPendingChooseInterceptSide(): PendingChooseInterceptSide | null {
  const v = globalThis.__pendingChooseInterceptSide ?? null;
  globalThis.__pendingChooseInterceptSide = null;
  return v;
}

export function _takePendingChooseInterceptResume(): ChooseInterceptResume | null {
  const v = globalThis.__pendingChooseInterceptResume ?? null;
  globalThis.__pendingChooseInterceptResume = null;
  return v;
}

export function _peekPendingChooseInterceptSide(): PendingChooseInterceptSide | null {
  return globalThis.__pendingChooseInterceptSide ?? null;
}

export function _clearPendingChooseInterceptSide(): void {
  globalThis.__pendingChooseInterceptSide = null;
  globalThis.__pendingChooseInterceptResume = null;
}

function getPendingQueue(): PendingEffectPickSide[] {
  const g = globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] };
  if (!g.__pendingEffectPickQueue) g.__pendingEffectPickQueue = [];
  return g.__pendingEffectPickQueue;
}

/** 旧 single-slot property を queue[0] に同期 (テスト等の backward compat) */
function syncLegacyPickProperty(): void {
  const q = getPendingQueue();
  (globalThis as { __pendingEffectPickSide?: PendingEffectPickSide | null }).__pendingEffectPickSide = q[0] ?? null;
}

export function pushPendingEffectPickSide(v: PendingEffectPickSide): void {
  getPendingQueue().push(v);
  syncLegacyPickProperty();
}

/** test fixture / 内部 caller 用: queue に直接 push する公開ヘルパ */
export function _pushPendingEffectPickSideForTest(v: PendingEffectPickSide): void {
  pushPendingEffectPickSide(v);
}

/**
 * BUG-132 GAP-1: atom-handler (deckRevealUntil chooseMatch) が runtime に直接 pending pick を
 * push する公開エントリポイント。tryRePickFromAtom と同じく「queue 長増加」を resolver の
 * sequence/chain walker が検知し、残り step を continuation として本 pick に同梱する (BUG-105/111)。
 */
export function pushPendingPickFromAtom(v: PendingEffectPickSide): void {
  pushPendingEffectPickSide(v);
}

/**
 * BUG-132 (2026-06-12): produce 境界を跨いで global side-channel に保存する値の deep-plain 化。
 * runtime (atom-handler / 遅延 substitute) で entry.effect (Immer draft) から読んだ args を
 * そのまま pending に保存すると、nested object (filter 等) が draft proxy 参照のまま残り、
 * 次の produce で event.queue 経路 (resolvedAtom → state) に入った時点で
 * 「Cannot perform 'get' on a proxy that has been revoked」で finalize が落ちる。
 * 関数値 (legacy filter 関数等) は参照のまま維持する (JSON round-trip と違い欠落しない)。
 */
export function toPlainDeep<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => toPlainDeep(x)) as unknown as T;
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object)) {
      out[k] = toPlainDeep((v as Record<string, unknown>)[k]);
    }
    return out as T;
  }
  return v;
}

/** dispatch 経由で UI 側 store に転送するための drain ヘルパ。FIFO 先頭を 1 件取り出す。 */
export function _drainPendingEffectPickSide(): PendingEffectPickSide | null {
  const q = getPendingQueue();
  const v = q.shift() ?? null;
  syncLegacyPickProperty();
  return v;
}

/** queue の長さを確認するヘルパ (テスト/UI 用) */
export function _peekPendingEffectPickQueueLength(): number {
  return getPendingQueue().length;
}

/** FIFO 先頭を消費せずに確認する。UI の二重 surface 防止用。 */
export function _peekPendingEffectPickSide(): PendingEffectPickSide | null {
  return getPendingQueue()[0] ?? null;
}

/** queue を全クリア (テスト用 / セッション初期化用) */
export function _clearPendingEffectPickQueue(): void {
  const g = globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] };
  g.__pendingEffectPickQueue = [];
  syncLegacyPickProperty();
}

// ===========================================================================
// BUG-121: human 複数 option choice の pause/surface — pick と同型 (別スロット)。
// enter トリガ等の複数択 choice が option 0 既定化される問題を、pick と同じ
// 「engine globalThis side-channel → UI store field → modal → choiceResolve dispatch」
// 二段構成で補完する。store へ運ぶ side-channel は {index, verb, args} の plain data のみ
// (JSON シリアライズ可能)。再開時に再 walk すべき実 effect tree は別 holder
// (__pendingEffectChoiceResume) に engine 内で保持する (store へは drain しない)。
// sequence 内 choice では sequence case が remainder を holder に wrap し、pre-choice step の
// 二重実行を防ぐ (top-level B06007 では holder = choice 効果そのもの)。
// ===========================================================================

export type PendingEffectChoiceSide = {
  player: Player;
  /** Decision owner can differ from the player whose effect is paused. */
  sourcePlayer?: Player;
  publicHandRevealToken?: string;
  /** 元 ability の特定 + 再開 ctx 復元 + option1 の $self 解決 + event.queue source に使用 */
  source: PendingEffectSource & { uid: string };
  /** UI ラベル化用 (atom option のみ verb/args、それ以外は index のみ)。JSON シリアライズ可能 */
  options: { index: number; verb?: string; args?: Record<string, unknown>; label?: string; sceneEnter?: boolean }[];
};

export function pushPendingEffectChoiceSide(v: PendingEffectChoiceSide): void {
  (globalThis as { __pendingEffectChoiceSide?: PendingEffectChoiceSide | null }).__pendingEffectChoiceSide = v;
}

/** dispatch 経由で UI store に転送するための drain (取り出して null クリア)。 */
export function _drainPendingEffectChoiceSide(): PendingEffectChoiceSide | null {
  const g = globalThis as { __pendingEffectChoiceSide?: PendingEffectChoiceSide | null };
  const v = g.__pendingEffectChoiceSide ?? null;
  g.__pendingEffectChoiceSide = null;
  return v;
}

/** slot + 再開 holder をクリア (テスト用 / セッション初期化用。side-channel と holder はペア)。 */
export function _clearPendingEffectChoiceSide(): void {
  (globalThis as { __pendingEffectChoiceSide?: PendingEffectChoiceSide | null }).__pendingEffectChoiceSide = null;
  // Phase 3c: Resume holder を null 化 = effect + bindings 両 field を一括クリア (旧 Bindings channel 統合)。
  (globalThis as { __pendingEffectChoiceResume?: ChoiceResumeState | null }).__pendingEffectChoiceResume = null;
}

// --- choice 再開 ctx の bindings 復元 (BUG-114: cutin の $contact.* 保持。Phase 3c で Resume holder に統合) ---
export function setPendingChoiceBindings(b: Record<string, unknown>): void {
  const g = globalThis as { __pendingEffectChoiceResume?: ChoiceResumeState | null };
  (g.__pendingEffectChoiceResume ??= { effect: null, bindings: null, continuation: null }).bindings = b;
}
/** choiceResolve 時に bindings を取り出してクリア (applyChoiceAndContinuation が resume ctx へ復元)。 */
export function _takePendingChoiceBindings(): Record<string, unknown> | null {
  const g = (globalThis as { __pendingEffectChoiceResume?: ChoiceResumeState | null }).__pendingEffectChoiceResume;
  const v = g?.bindings ?? null;
  if (g) g.bindings = null; // null-safe: holder 未生成/clear 後でも crash しない (現行 top-level ?? null と byte 等価)
  return v;
}

/** slot を peek (テスト用)。 */
export function _peekPendingEffectChoiceSide(): PendingEffectChoiceSide | null {
  return (globalThis as { __pendingEffectChoiceSide?: PendingEffectChoiceSide | null }).__pendingEffectChoiceSide ?? null;
}

// --- choice 再開用 holder (engine 内のみ、store へ drain しない。Phase 3c で bindings field を統合) ---
export function setPendingChoiceResume(eff: Effect): void {
  const g = globalThis as { __pendingEffectChoiceResume?: ChoiceResumeState | null };
  (g.__pendingEffectChoiceResume ??= { effect: null, bindings: null, continuation: null }).effect = eff;
}
export function getPendingChoiceResume(): Effect | null {
  return (globalThis as { __pendingEffectChoiceResume?: ChoiceResumeState | null }).__pendingEffectChoiceResume?.effect ?? null;
}
/** choiceResolve 時に holder (effect) を取り出してクリア (apply-pick.applyChoiceAndContinuation が使用)。 */
export function _takePendingChoiceResume(): Effect | null {
  const g = (globalThis as { __pendingEffectChoiceResume?: ChoiceResumeState | null }).__pendingEffectChoiceResume;
  const v = g?.effect ?? null;
  if (g) g.effect = null; // null-safe: take は apply-pick:236 で desync guard(!resumeEffect)より先に走る→g=null でも graceful return
  return v;
}
/** holder (effect) をクリア (テスト用 / セッション初期化用。bindings は温存)。 */
export function _clearPendingChoiceResume(): void {
  const g = (globalThis as { __pendingEffectChoiceResume?: ChoiceResumeState | null }).__pendingEffectChoiceResume;
  if (g) g.effect = null;
}

// ===========================================================================
// 2026-06-06 タスクC: optional 決定の配線 — pendingEffectChoice と同型 (別スロット)。
// 「このキャラをリムーブしてもよい。そうした場合〜」(Effect kind:'optional') を human に
// 「する/しない」で surface する。choice の boolean 版: choiceIndex の代わりに run(boolean)。
//   - resolveEffectPicks の optional case が human walk で surface → no-op で pause。
//   - optionalResolve dispatch → applyOptionalAndContinuation が ctx.dyn.optionalRun=run で再 walk。
//   - AI / non-human は surface せず skip (optional は自己コストを含むことが多く既定で使わない)。
// store へ運ぶのは {player, source} の plain data のみ。再開すべき optional 効果は別 holder
// (__pendingEffectOptionalResume) に engine 内で保持する (store へは drain しない)。
// ===========================================================================

export type PendingEffectOptionalSide = {
  player: Player;
  publicHandRevealToken?: string;
  /** Effect owner. May differ from the player making this optional decision. */
  ownerPlayer?: Player;
  /** 元 ability の特定 + 再開 ctx 復元 ($self 解決 / modal の文言表示) に使用 */
  source: PendingEffectSource & { uid: string };
  /**
   * 2026-06-06 タスクC: optional 内の効果が $trigger.<field> (例 B03038 の $trigger.gained =
   * 推理で得た証拠枚数) を参照する場合、トリガ payload を再開 ctx に復元するため保持する。
   * reasoning:end payload = {uid,player,gained} 等の JSON-safe な plain data のみ。
   */
  triggerPayload?: unknown;
};

export type RpsHand = 'rock' | 'paper' | 'scissors';
/** Pre-removal set-card replacement.  The original removal stays suspended. */
export type PendingSetCardReplacementSide = {
  player: Player;
  fromUid: string;
  setCardInstanceId: string;
  candidates: { uid: string; cardId: string }[];
  source: PendingEffectSource & { uid: string };
  resume?:
    | { kind: 'scene-remove'; cause: 'contact-ap' | 'effect' | 'switch' | 'cost' | 'misplay-overflow'; byUid?: string; byPlayer?: Player }
    | { kind: 'scene-to-deck'; pos: 'bottom' | 'top' }
    | { kind: 'scene-to-hand' }
    | { kind: 'scene-to-evidence'; faceUp: boolean; sourceCardId?: string }
    | { kind: 'scene-to-stack'; hostUid: string };
};
export function pushPendingSetCardReplacementSide(v: PendingSetCardReplacementSide): void {
  (globalThis as { __pendingSetCardReplacementSide?: PendingSetCardReplacementSide | null }).__pendingSetCardReplacementSide = v;
}
export function _drainPendingSetCardReplacementSide(): PendingSetCardReplacementSide | null {
  const g = globalThis as { __pendingSetCardReplacementSide?: PendingSetCardReplacementSide | null };
  const v = g.__pendingSetCardReplacementSide ?? null; g.__pendingSetCardReplacementSide = null; return v;
}
export function _peekPendingSetCardReplacementSide(): PendingSetCardReplacementSide | null {
  return (globalThis as { __pendingSetCardReplacementSide?: PendingSetCardReplacementSide | null }).__pendingSetCardReplacementSide ?? null;
}
/** Preserve a pre-existing replacement prompt across rejected transactions. */
export function _restorePendingSetCardReplacementSide(v: PendingSetCardReplacementSide | null): void {
  (globalThis as { __pendingSetCardReplacementSide?: PendingSetCardReplacementSide | null }).__pendingSetCardReplacementSide = v;
}
/** Drop a replacement created by a payment that subsequently failed atomically. */
export function _clearPendingSetCardReplacementSide(): void {
  (globalThis as { __pendingSetCardReplacementSide?: PendingSetCardReplacementSide | null }).__pendingSetCardReplacementSide = null;
}
export type PendingSetCardChoiceSide = {
  player: Player;
  hostUid: string;
  entries: { instanceId: string; ordinal: number; hidden?: boolean; cardId?: string }[];
  face?: 'down' | 'up' | 'any';
  destination?: { area: 'evidence'; faceUp: boolean } | { area: 'hand' } | { area: 'scene'; hostUid: string };
  source: PendingEffectSource & { uid: string };
};

export function pushPendingSetCardChoiceSide(v: PendingSetCardChoiceSide): void {
  (globalThis as { __pendingSetCardChoiceSide?: PendingSetCardChoiceSide | null }).__pendingSetCardChoiceSide = v;
}
export function _drainPendingSetCardChoiceSide(): PendingSetCardChoiceSide | null {
  const g = globalThis as { __pendingSetCardChoiceSide?: PendingSetCardChoiceSide | null };
  const v = g.__pendingSetCardChoiceSide ?? null;
  g.__pendingSetCardChoiceSide = null;
  return v;
}
export function _peekPendingSetCardChoiceSide(): PendingSetCardChoiceSide | null {
  return (globalThis as { __pendingSetCardChoiceSide?: PendingSetCardChoiceSide | null }).__pendingSetCardChoiceSide ?? null;
}
export function setPendingChoiceContinuation(continuation: ContinuationFrame): void {
  const g = globalThis as { __pendingEffectChoiceResume?: ChoiceResumeState | null };
  (g.__pendingEffectChoiceResume ??= { effect: null, bindings: null, continuation: null }).continuation = continuation;
}
/** Append an outer composite frame without replacing an inner choice continuation. */
export function appendPendingChoiceContinuation(continuation: ContinuationFrame): void {
  const g = globalThis as { __pendingEffectChoiceResume?: ChoiceResumeState | null };
  const resume = (g.__pendingEffectChoiceResume ??= { effect: null, bindings: null, continuation: null });
  if (!resume.continuation) {
    resume.continuation = continuation;
    return;
  }
  let tail = resume.continuation;
  while (tail.outer) tail = tail.outer;
  tail.outer = continuation;
}
export function _takePendingChoiceContinuation(): ContinuationFrame | null {
  const g = (globalThis as { __pendingEffectChoiceResume?: ChoiceResumeState | null }).__pendingEffectChoiceResume;
  const value = g?.continuation ?? null;
  if (g) g.continuation = null;
  return value;
}
export function setPendingSetCardChoiceResume(effect: Effect, bindings: Record<string, unknown>, choice?: PendingSetCardChoiceSide): void {
  (globalThis as { __pendingSetCardChoiceResume?: Effect | null }).__pendingSetCardChoiceResume = effect;
  (globalThis as { __pendingSetCardChoiceBindings?: Record<string, unknown> | null }).__pendingSetCardChoiceBindings = bindings;
  (globalThis as { __pendingSetCardChoiceGuard?: PendingSetCardChoiceSide | null }).__pendingSetCardChoiceGuard = choice
    ? toPlainDeep(choice) as PendingSetCardChoiceSide
    : null;
}
/** Add an outer composite frame without replacing the active set-card decision. */
export function appendPendingSetCardChoiceContinuation(frame: ContinuationFrame): void {
  const g = globalThis as { __pendingSetCardChoiceContinuation?: ContinuationFrame | null };
  if (!g.__pendingSetCardChoiceContinuation) {
    g.__pendingSetCardChoiceContinuation = frame;
    return;
  }
  let tail = g.__pendingSetCardChoiceContinuation;
  while (tail.outer) tail = tail.outer;
  tail.outer = frame;
}
export function setPendingSetCardChoiceRemainder(remainder: Effect[], kind: 'sequence' | 'chain'): void {
  // Compatibility entry point for existing callers/tests. New composite paths
  // retain the same information as a real continuation frame, including the
  // pending decision's provenance.
  const g = globalThis as { __pendingSetCardChoiceGuard?: PendingSetCardChoiceSide | null };
  const source = g.__pendingSetCardChoiceGuard?.source;
  appendPendingSetCardChoiceContinuation({
    remainder,
    ctx: {
      source: {
        cardId: source?.cardId ?? '',
        uid: source?.uid ?? '',
        abilityId: source?.abilityId ?? '',
        player: g.__pendingSetCardChoiceGuard?.player ?? 'self',
        area: 'scene',
        ...(source?.resolutionKind ? { resolutionKind: source.resolutionKind } : {}),
        ...(source?.triggerBatch !== undefined ? { triggerBatch: source.triggerBatch } : {}),
        ...(source?.ownerChosenOrder !== undefined ? { ownerChosenOrder: source.ownerChosenOrder } : {}),
        ...(source?.ownerOrderConfirmed !== undefined ? { ownerOrderConfirmed: source.ownerOrderConfirmed } : {}),
      },
      bindings: {},
    },
    kind,
  });
}
export function _peekPendingSetCardChoiceResume(): { effect: Effect; bindings: Record<string, unknown>; guard?: PendingSetCardChoiceSide; continuation?: ContinuationFrame } | null {
  const g = globalThis as { __pendingSetCardChoiceResume?: Effect | null; __pendingSetCardChoiceBindings?: Record<string, unknown> | null; __pendingSetCardChoiceGuard?: PendingSetCardChoiceSide | null; __pendingSetCardChoiceContinuation?: ContinuationFrame | null };
  const effect = g.__pendingSetCardChoiceResume ?? null;
  const bindings = g.__pendingSetCardChoiceBindings ?? null;
  return effect && bindings ? { effect, bindings, guard: g.__pendingSetCardChoiceGuard ?? undefined, continuation: g.__pendingSetCardChoiceContinuation ?? undefined } : null;
}
export function _takePendingSetCardChoiceResume(): { effect: Effect; bindings: Record<string, unknown>; guard?: PendingSetCardChoiceSide; continuation?: ContinuationFrame } | null {
  const value = _peekPendingSetCardChoiceResume();
  const g = globalThis as { __pendingSetCardChoiceResume?: Effect | null; __pendingSetCardChoiceBindings?: Record<string, unknown> | null; __pendingSetCardChoiceGuard?: PendingSetCardChoiceSide | null; __pendingSetCardChoiceContinuation?: ContinuationFrame | null };
  g.__pendingSetCardChoiceResume = null;
  g.__pendingSetCardChoiceBindings = null;
  g.__pendingSetCardChoiceGuard = null;
  g.__pendingSetCardChoiceContinuation = null;
  return value;
}
export type PendingRpsSide = {
  player: Player;
  ownerPlayer: Player;
  aiHand: RpsHand;
  source: PendingEffectSource & { uid: string };
};

export function pushPendingRpsSide(v: PendingRpsSide): void {
  (globalThis as { __pendingRpsSide?: PendingRpsSide | null }).__pendingRpsSide = v;
}
export function _drainPendingRpsSide(): PendingRpsSide | null {
  const g = globalThis as { __pendingRpsSide?: PendingRpsSide | null };
  const v = g.__pendingRpsSide ?? null;
  g.__pendingRpsSide = null;
  return v;
}
export function _peekPendingRpsSide(): PendingRpsSide | null {
  return (globalThis as { __pendingRpsSide?: PendingRpsSide | null }).__pendingRpsSide ?? null;
}
export function _clearPendingRpsSide(): void {
  (globalThis as { __pendingRpsSide?: PendingRpsSide | null }).__pendingRpsSide = null;
  const g = globalThis as { __pendingRpsResume?: Effect | null; __pendingRpsBindings?: Record<string, unknown> | null; __pendingRpsContinuation?: ContinuationFrame | null };
  g.__pendingRpsResume = null;
  g.__pendingRpsBindings = null;
  g.__pendingRpsContinuation = null;
}
export function setPendingRpsResume(effect: Effect, bindings: Record<string, unknown>): void {
  (globalThis as { __pendingRpsResume?: Effect | null }).__pendingRpsResume = effect;
  (globalThis as { __pendingRpsBindings?: Record<string, unknown> | null }).__pendingRpsBindings = bindings;
}
/** Append a continuation that must run after the RPS branch resolves. */
export function appendPendingRpsContinuation(continuation: ContinuationFrame): void {
  const g = globalThis as { __pendingRpsContinuation?: ContinuationFrame | null };
  if (!g.__pendingRpsContinuation) {
    g.__pendingRpsContinuation = continuation;
    return;
  }
  let tail = g.__pendingRpsContinuation;
  while (tail.outer) tail = tail.outer;
  tail.outer = continuation;
}
export function _takePendingRpsResume(): { effect: Effect; bindings: Record<string, unknown>; continuation?: ContinuationFrame } | null {
  const g = globalThis as { __pendingRpsResume?: Effect | null; __pendingRpsBindings?: Record<string, unknown> | null; __pendingRpsContinuation?: ContinuationFrame | null };
  const effect = g.__pendingRpsResume ?? null;
  const bindings = g.__pendingRpsBindings ?? null;
  const continuation = g.__pendingRpsContinuation ?? undefined;
  g.__pendingRpsResume = null;
  g.__pendingRpsBindings = null;
  g.__pendingRpsContinuation = null;
  return effect && bindings ? { effect, bindings, continuation } : null;
}

export function pushPendingEffectOptionalSide(v: PendingEffectOptionalSide): void {
  (globalThis as { __pendingEffectOptionalSide?: PendingEffectOptionalSide | null }).__pendingEffectOptionalSide = v;
}

/** dispatch 経由で UI store に転送するための drain (取り出して null クリア)。 */
export function _drainPendingEffectOptionalSide(): PendingEffectOptionalSide | null {
  const g = globalThis as { __pendingEffectOptionalSide?: PendingEffectOptionalSide | null };
  const v = g.__pendingEffectOptionalSide ?? null;
  g.__pendingEffectOptionalSide = null;
  return v;
}

/** slot + 再開 holder をクリア (テスト用 / セッション初期化用。side-channel と holder はペア)。 */
export function _clearPendingEffectOptionalSide(): void {
  (globalThis as { __pendingEffectOptionalSide?: PendingEffectOptionalSide | null }).__pendingEffectOptionalSide = null;
  (globalThis as { __pendingEffectOptionalResume?: Effect | null }).__pendingEffectOptionalResume = null;
  (globalThis as { __pendingEffectOptionalContinuation?: ContinuationFrame | null }).__pendingEffectOptionalContinuation = null;
}

/** slot を peek (テスト用)。 */
export function _peekPendingEffectOptionalSide(): PendingEffectOptionalSide | null {
  return (globalThis as { __pendingEffectOptionalSide?: PendingEffectOptionalSide | null }).__pendingEffectOptionalSide ?? null;
}

// --- optional 再開用 holder (engine 内のみ、store へ drain しない) ---
export function setPendingOptionalResume(eff: Effect): void {
  (globalThis as { __pendingEffectOptionalResume?: Effect | null }).__pendingEffectOptionalResume = eff;
}
/** optionalResolve 時に holder を取り出してクリア (apply-pick.applyOptionalAndContinuation が使用)。 */
export function _takePendingOptionalResume(): Effect | null {
  const g = globalThis as { __pendingEffectOptionalResume?: Effect | null };
  const v = g.__pendingEffectOptionalResume ?? null;
  g.__pendingEffectOptionalResume = null;
  return v;
}
/** holder をクリア (テスト用 / セッション初期化用)。 */
export function _clearPendingOptionalResume(): void {
  (globalThis as { __pendingEffectOptionalResume?: Effect | null }).__pendingEffectOptionalResume = null;
  (globalThis as { __pendingEffectOptionalBindings?: Record<string, unknown> | null }).__pendingEffectOptionalBindings = null;
  (globalThis as { __pendingEffectOptionalContinuation?: ContinuationFrame | null }).__pendingEffectOptionalContinuation = null;
}
export function getPendingOptionalResume(): Effect | null {
  return (globalThis as { __pendingEffectOptionalResume?: Effect | null }).__pendingEffectOptionalResume ?? null;
}
export function setPendingOptionalContinuation(continuation: ContinuationFrame): void {
  (globalThis as { __pendingEffectOptionalContinuation?: ContinuationFrame | null }).__pendingEffectOptionalContinuation = continuation;
}
export function _takePendingOptionalContinuation(): ContinuationFrame | null {
  const g = globalThis as { __pendingEffectOptionalContinuation?: ContinuationFrame | null };
  const value = g.__pendingEffectOptionalContinuation ?? null;
  g.__pendingEffectOptionalContinuation = null;
  return value;
}

/**
 * 対戦セッション境界で、effect resolver が保持する全ての中断状態を破棄する。
 * side-channel と resume holder は必ず対で消去し、新しい GameState へ継承しない。
 */
export function resetPendingEffectSession(): void {
  _clearPendingEffectPickQueue();
  _clearPendingEffectChoiceSide();
  _clearPendingEffectOptionalSide();
  _clearPendingOptionalResume();
  _clearPendingRpsSide();
  _clearPendingChooseInterceptSide();
  _clearPendingEffectRepeatOptionalSide();

  const g = globalThis as {
    __pendingEffectOptionalCostPaid?: Record<string, unknown> | null;
    __pendingSetCardChoiceSide?: PendingSetCardChoiceSide | null;
    __pendingSetCardChoiceResume?: Effect | null;
    __pendingSetCardChoiceBindings?: Record<string, unknown> | null;
    __pendingSetCardChoiceGuard?: PendingSetCardChoiceSide | null;
    __pendingSetCardChoiceContinuation?: ContinuationFrame | null;
    __pendingSetCardReplacementSide?: PendingSetCardReplacementSide | null;
  };
  g.__pendingEffectOptionalCostPaid = null;
  g.__pendingSetCardChoiceSide = null;
  g.__pendingSetCardChoiceResume = null;
  g.__pendingSetCardChoiceBindings = null;
  g.__pendingSetCardChoiceGuard = null;
  g.__pendingSetCardChoiceContinuation = null;
  g.__pendingSetCardReplacementSide = null;
  delete (globalThis as { __pendingRuntimeStateMarker?: unknown }).__pendingRuntimeStateMarker;
}

// --- optional 再開 ctx の bindings 復元 (engine wave-18: BUG-114 choice-bindings の対称、$contact.* / ctx.contact 保持) ---
export function setPendingOptionalBindings(b: Record<string, unknown>): void {
  (globalThis as { __pendingEffectOptionalBindings?: Record<string, unknown> | null }).__pendingEffectOptionalBindings = b;
}
/** optionalResolve 時に bindings を取り出してクリア (applyOptionalAndContinuation が resume ctx へ復元)。 */
export function _takePendingOptionalBindings(): Record<string, unknown> | null {
  const g = globalThis as { __pendingEffectOptionalBindings?: Record<string, unknown> | null };
  const v = g.__pendingEffectOptionalBindings ?? null;
  g.__pendingEffectOptionalBindings = null;
  return v;
}

// --- optional 再開 ctx の costPaid 復元 (WC2b 2026-07-11) ---
// declared 能力の cost で積んだ costPaid は effect resolveCtx に載る (declared-ability.ts) が、
// top-level `optional{}` の resume ctx (apply-pick.applyOptionalAndContinuation) は costPaid を
// 再構築しないため、optional 内で $cost.* を参照する effect (B06023 invokeHiramekiOfCard
// cardIds:'$cost.flipFaceUpEvidence.ids') が unbound 化する。surface 時 (optional walk) の
// ctx.costPaid を保持し resume ctx + queue entry へ復元する (bindings 復元の対称、純 additive:
// $cost を参照する optional は本 wave 新規のみ = 既存挙動不変)。
export function setPendingOptionalCostPaid(cp: Record<string, unknown> | undefined): void {
  (globalThis as { __pendingEffectOptionalCostPaid?: Record<string, unknown> | null }).__pendingEffectOptionalCostPaid = cp ?? null;
}
/** optionalResolve 時に costPaid を取り出してクリア。 */
export function _takePendingOptionalCostPaid(): Record<string, unknown> | null {
  const g = globalThis as { __pendingEffectOptionalCostPaid?: Record<string, unknown> | null };
  const v = g.__pendingEffectOptionalCostPaid ?? null;
  g.__pendingEffectOptionalCostPaid = null;
  return v;
}
