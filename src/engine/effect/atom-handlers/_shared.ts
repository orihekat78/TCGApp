// engine.effect.atom-handlers/_shared — Phase 3a: 共有 helper / 型 / side-channel
// 元 atom-handlers.ts L14-309 を無改変移送 + export 付与 (refactor Phase 3a, 2026-06-22)
import type { GameState, AtomVerb, EffectCtx } from '../../types/index.js';
import type { TargetFilter } from '../../types/effect.js';
import type { ContinuationFrame } from '../pending-state.js';
import { mutate } from '../../mutate/index.js';
import { cards as engineCards } from '../../cards/index.js';
import { tryRePickFromAtom } from '../resolve-picks.js';
import { buildShortFormPick } from '../atom-pick-spec.js';
import { evalDyn } from '../../dyn/eval.js';
import { cardOccurrenceUid, isLiveCardOccurrenceWitness } from '../../target/card-occurrence.js';
import { defHasKeyword, defHasNoOriginalAbilityExceptIcons } from '../../read/keyword.js';
import { allCardNameComponentsForDef } from '../../target/card-def-registry.js';
import { effectiveKeywordForCard, effectiveTraitNames, printedKeywordForCard } from '../../target/candidates.js';

declare global {

  var __pendingDeckRevealSide: PendingDeckRevealSide | PendingDeckRevealSide[] | null | undefined;
  var __pendingPublicHandRevealSide: PublicHandRevealSide | PublicHandRevealSide[] | null | undefined;
}

export type PublicHandRevealSide = {
  owner: 'self' | 'opp';
  audience: 'all';
  /** Ordered occurrences. Duplicate cardIds intentionally remain distinct. */
  cardIds: string[];
  handSnapshot: string[];
  lifetime: 'effect' | 'presentation';
  resolutionToken: string;
  source: { cardId?: string; abilityId?: string; uid?: string };
};

export function publicHandRevealToken(s: GameState, ctx: EffectCtx): string {
  const next = (s.publicHandRevealSeq ?? 0) + 1;
  s.publicHandRevealSeq = next;
  const token = `public-hand-reveal:${next}`;
  (ctx.causal ??= {}).publicHandRevealToken = token;
  return token;
}

export function peekPublicHandRevealToken(ctx: EffectCtx): string | undefined {
  return ctx.causal?.publicHandRevealToken;
}

export function takePublicHandRevealToken(ctx: EffectCtx): string | undefined {
  const token = ctx.causal?.publicHandRevealToken;
  if (!token || !ctx.causal) return undefined;
  delete ctx.causal.publicHandRevealToken;
  if (Object.keys(ctx.causal).length === 0) delete ctx.causal;
  return token;
}

export function restorePublicHandRevealToken(ctx: EffectCtx, token: string | undefined): void {
  if (token) (ctx.causal ??= {}).publicHandRevealToken = token;
}

export function queuePendingPublicHandRevealSide(next: PublicHandRevealSide): void {
  const root = globalThis as { __pendingPublicHandRevealSide?: PublicHandRevealSide | PublicHandRevealSide[] | null };
  const current = root.__pendingPublicHandRevealSide;
  if (!current) root.__pendingPublicHandRevealSide = next;
  else if (Array.isArray(current)) current.push(next);
  else root.__pendingPublicHandRevealSide = [current, next];
}

export function _drainPendingPublicHandRevealSide(): PublicHandRevealSide | null {
  const root = globalThis as { __pendingPublicHandRevealSide?: PublicHandRevealSide | PublicHandRevealSide[] | null };
  const current = root.__pendingPublicHandRevealSide;
  if (!current) return null;
  if (!Array.isArray(current)) {
    root.__pendingPublicHandRevealSide = null;
    return current;
  }
  const next = current.shift() ?? null;
  root.__pendingPublicHandRevealSide = current.length === 0 ? null : current.length === 1 ? current[0]! : current;
  return next;
}

export type PendingDeckRevealSide = {
  player: 'self' | 'opp';
  /** Public reveals are visible to both players; private looks only to viewer. */
  visibility: 'public' | 'private';
  /** Absolute viewer identity after resolving source-relative effect args. */
  viewer: 'self' | 'opp' | 'all';
  /** デッキ上から公開した順番のカード ID (matched 含む末尾) */
  revealed: string[];
  /** filter match した cardId、null なら全公開でも不一致 */
  matched: string | null;
  /**
   * BUG-132 GAP-1: chooseMatch (「1枚まで」) の human pick が未解決の間 true。
   * DeckRevealOverlay は自動進行 (toBottom→shuffle→dismiss) を停止して公開リストを
   * 表示し続け、EffectPickerModal (z-index 上位) の選択/decline を待つ。
   * pick 解決の再入時に確定 matched で再 set される (awaitingPick 無し → 通常演出)。
   */
  awaitingPick?: boolean;
  /** A plain reveal returns every card to its original deck position. */
  presentation?: 'reveal-return';
  /** Stable resolver source identity; prevents an unrelated reveal replacing this one. */
  source?: { cardId?: string; abilityId?: string; uid?: string };
};

export function _drainPendingDeckRevealSide(): PendingDeckRevealSide | null {
  const channel = (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | PendingDeckRevealSide[] | null }).__pendingDeckRevealSide;
  if (!channel) return null;
  if (!Array.isArray(channel)) {
    (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | PendingDeckRevealSide[] | null }).__pendingDeckRevealSide = null;
    return channel;
  }
  const next = channel.shift() ?? null;
  (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | PendingDeckRevealSide[] | null }).__pendingDeckRevealSide =
    channel.length === 0 ? null : channel.length === 1 ? channel[0]! : channel;
  return next;
}

/** Read the next public-hand presentation without consuming its FIFO entry. */
export function _peekPendingPublicHandRevealSide(): PublicHandRevealSide | null {
  const current = (globalThis as {
    __pendingPublicHandRevealSide?: PublicHandRevealSide | PublicHandRevealSide[] | null;
  }).__pendingPublicHandRevealSide;
  if (!current) return null;
  return Array.isArray(current) ? current[0] ?? null : current;
}

/** Read the next deck reveal without consuming its FIFO entry. */
export function _peekPendingDeckRevealSide(): PendingDeckRevealSide | null {
  const channel = (globalThis as {
    __pendingDeckRevealSide?: PendingDeckRevealSide | PendingDeckRevealSide[] | null;
  }).__pendingDeckRevealSide;
  if (!channel) return null;
  return Array.isArray(channel) ? channel[0] ?? null : channel;
}

/** FIFO prevents simultaneous reveal effects from overwriting a different player's private card. */
export function queuePendingDeckRevealSide(next: PendingDeckRevealSide): void {
  const root = globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | PendingDeckRevealSide[] | null };
  const current = root.__pendingDeckRevealSide;
  const replacesAwaiting = (candidate: PendingDeckRevealSide): boolean =>
    next.awaitingPick !== true
    && candidate.awaitingPick === true
    && candidate.source?.cardId === next.source?.cardId
    && candidate.source?.abilityId === next.source?.abilityId
    && candidate.source?.uid === next.source?.uid;
  if (!current) {
    root.__pendingDeckRevealSide = next;
  } else if (Array.isArray(current)) {
    const awaitingIndex = current.findIndex(replacesAwaiting);
    if (awaitingIndex >= 0) current[awaitingIndex] = next;
    else current.push(next);
  } else if (replacesAwaiting(current)) {
    root.__pendingDeckRevealSide = next;
  } else {
    root.__pendingDeckRevealSide = [current, next];
  }
}

// BUG-136: deckToBottomBound「残りを好きな順番でデッキの下に移す」の順序選択 side-channel
// (side-channel-pattern.md 準拠)。human 所有 & 2 枚以上を底へ移したときのみ set し、UI の
// DeckReorderModal が並べ替えをsurfaceする。deckToBottomBoundはconfirmまでdeckを変更せず、
// resolver continuationも本pendingへ保存する。legacy souza等は移動済みbottom blockを扱う。
declare global {

  var __pendingDeckReorderSide: PendingDeckReorderSide | null | undefined;
}

export type PendingDeckReorderSide = {
  player: 'self' | 'opp';
  /** 並べ替え対象cardId群。新await経路ではconfirmまでデッキ元位置に残る。 */
  cardIds: string[];
  /** await開始時の全デッキsnapshot。confirm時のstale state防御。 */
  deckSnapshot?: string[];
  /** snapshot上の物理occurrence。重複cardIdを別コピーとして保持。 */
  occurrences?: Array<{ cardId: string; index: number }>;
  /** 後続効果と共有する保存ctx。 */
  ctx?: EffectCtx;
  /** resolverが同梱するsequence/chain remainder。 */
  continuation?: ContinuationFrame;
};

export function _peekPendingDeckReorderSide(): PendingDeckReorderSide | null {
  return (globalThis as { __pendingDeckReorderSide?: PendingDeckReorderSide | null }).__pendingDeckReorderSide ?? null;
}

export function _attachPendingDeckReorderContinuation(frame: ContinuationFrame, preserveFrameCtx = false): void {
  const pending = _peekPendingDeckReorderSide();
  if (!pending) return;
  const safeFrame: ContinuationFrame = {
    ...frame,
    ctx: preserveFrameCtx ? frame.ctx : (pending.ctx ?? frame.ctx),
  };
  if (!pending.continuation) {
    pending.continuation = safeFrame;
    return;
  }
  let tail = pending.continuation;
  while (tail.outer) tail = tail.outer;
  tail.outer = safeFrame;
}

export function _drainPendingDeckReorderSide(): PendingDeckReorderSide | null {
  const v = (globalThis as { __pendingDeckReorderSide?: PendingDeckReorderSide | null }).__pendingDeckReorderSide ?? null;
  (globalThis as { __pendingDeckReorderSide?: PendingDeckReorderSide | null }).__pendingDeckReorderSide = null;
  return v;
}

// mini-wave #5 P2 (2026-07-10): deckPlaceSplitBound (B05047「見た各カードを上か下へ」) の
// human 振り分け待ち (deckReorder 同型 side-channel)。human 所有時のみ set し、UI の
// DeckPlaceModal が 2-bucket (top/bottom) 割当を surface → useEngineDispatch 'deckPlaceResolve'
// が multiset 検証つきで mutate.deck.toTop/toBottom を適用する。AI / 非 human は atom 側で
// 恒等 (全カード元位置のまま = 合法な一choice、souza AI default 同型) のため set しない。
// ⚠ await 中は対象カードが deck 元位置に残る (rules/26 見ている間はデッキ扱い)。同一 effect
// chain の後続 step が deck を読む構成は本 atom の消費者では組まないこと (B05047 は最終 step)。
declare global {

  var __pendingDeckPlaceSide: PendingDeckPlaceSide | null | undefined;
}

export type PendingDeckPlaceSide = {
  /** 対象デッキの所有者 (deckPlaceResolve が splice する側) */
  player: 'self' | 'opp';
  /** 振り分け対象の cardId 群 (公開順)。human が各カードを top/bottom バケツへ割り当てる */
  cardIds: string[];
  /**
   * S2 B01093 (2026-07-10): 選択者 = ability owner (絶対座標)。B01093「相手デッキ top 1 を公開し、
   * **自分**が上か下かを選ぶ」は 対象デッキ所有者 ≠ 選択者。modal 表示 gate は ownerPlayer で判定する
   * (BUG-175 の player/ownerPlayer 分離パターン踏襲)。B05047 は player===ownerPlayer で挙動不変。
   */
  ownerPlayer: 'self' | 'opp';
  /** Full deck at the decision boundary. Rejects stale or cross-session answers. */
  deckSnapshot: string[];
  /** Exact deck occurrences shown by the effect, including duplicate card IDs. */
  occurrences: Array<{ cardId: string; index: number }>;
  /** Effect authority retained until the human answer resumes resolution. */
  ctx: EffectCtx;
  /** Saved sequence/chain remainder owned by this decision. */
  continuation?: ContinuationFrame;
};

export function _peekPendingDeckPlaceSide(): PendingDeckPlaceSide | null {
  return (globalThis as { __pendingDeckPlaceSide?: PendingDeckPlaceSide | null }).__pendingDeckPlaceSide ?? null;
}

export function _attachPendingDeckPlaceContinuation(frame: ContinuationFrame, preserveFrameCtx = false): void {
  const pending = _peekPendingDeckPlaceSide();
  if (!pending) return;
  const safeFrame: ContinuationFrame = {
    ...frame,
    ctx: preserveFrameCtx ? frame.ctx : (pending.ctx ?? frame.ctx),
  };
  if (!pending.continuation) {
    pending.continuation = safeFrame;
    return;
  }
  let tail = pending.continuation;
  while (tail.outer) tail = tail.outer;
  tail.outer = safeFrame;
}

export function _drainPendingDeckPlaceSide(): PendingDeckPlaceSide | null {
  const v = _peekPendingDeckPlaceSide();
  (globalThis as { __pendingDeckPlaceSide?: PendingDeckPlaceSide | null }).__pendingDeckPlaceSide = null;
  return v;
}

// mega-wave W6 step9 (2026-07-04, row65): startContact atom が生成した ActionContext.id の
// 片道通知 (effect atom → React store の produce 境界越え、hirameki/misread/deckReveal と同型)。
// UI 側は drain → store.setActiveActionId(id) で useContactFlowDriver が拾う。
// ⚠ scalar なので同一 effect chain 内で startContact が複数回発火すると後勝ち上書き —
// 現 exemplar (B06020/B06042) は 0-1 pick 単発なので到達しない。複数発火カードが出たら
// pendingEffectPick 同様の queue 化が要る (row65 risks(4))。
declare global {

  var __pendingContactStartAxId: string | null | undefined;
}

export function _setPendingContactStartAxId(id: string): void {
  (globalThis as { __pendingContactStartAxId?: string | null }).__pendingContactStartAxId = id;
}

export function _drainPendingContactStartAxId(): string | null {
  const v = (globalThis as { __pendingContactStartAxId?: string | null }).__pendingContactStartAxId ?? null;
  (globalThis as { __pendingContactStartAxId?: string | null }).__pendingContactStartAxId = null;
  return v;
}

/**
 * BUG-045 (#9 spectator stall fix の副産物): deckRevealUntil 等で
 * TargetFilter (declarative object) を predicate に変換するヘルパ。
 * src/engine/target/candidates.ts matchOneFilter の cardId-based subset。
 * 対応: cardId / color / trait / apMin/Max / lpMin/Max / levelMin/Max / kind ('character' | 'event')。
 *
 * BUG-117 (2026-06-05): apMin/apMax/lpMin/lpMax が未実装で **黙って drop** されていた。
 *   型 (TargetFilter) には在るため typecheck は通り、B01013「LP0の青」/ B01053「LP2以上の白」が
 *   LP 条件を無視して最初の色一致キャラを拾っていた (Playwright で実機検出)。
 *   deck 内のカードは scene candidate (turnEffects/override) を持たないため、printed 値
 *   (d.ap/d.lp/d.level、undefined は 0) で判定する = matchOneFilter の非現場ケースと同式。
 */
/**
 * Static deck-card filter.  Kept as the public compatibility API used by
 * legacy probes and callers that have no trigger context.
 */
export function targetFilterToPredicate(filter: TargetFilter | undefined): (cardId: string) => boolean {
  return targetFilterToPredicateWithCtx(undefined, filter);
}

/** 対戦セッションを跨いではならない atom 側の一時通知を一括消去する。 */
export function resetPendingAtomSession(): void {
  (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | PendingDeckRevealSide[] | null }).__pendingDeckRevealSide = null;
  (globalThis as { __pendingPublicHandRevealSide?: PublicHandRevealSide | PublicHandRevealSide[] | null }).__pendingPublicHandRevealSide = null;
  (globalThis as { __pendingDeckReorderSide?: PendingDeckReorderSide | null }).__pendingDeckReorderSide = null;
  (globalThis as { __pendingDeckPlaceSide?: PendingDeckPlaceSide | null }).__pendingDeckPlaceSide = null;
  (globalThis as { __pendingContactStartAxId?: string | null }).__pendingContactStartAxId = null;
}

/**
 * Context-aware deck-card filter.  Dynamic trigger payload filters must use
 * this path; absent state/payload fails closed.
 */
export function targetFilterToPredicateWithCtx(state: GameState | undefined, filter: TargetFilter | undefined, ctx?: EffectCtx, player?: 'self' | 'opp'): (cardId: string) => boolean {
  if (!filter) return () => true;
  return (cardId: string) => {
    const d = engineCards.get(cardId);
    if (!d) return false;
    if (filter.cardId !== undefined) {
      const ids = Array.isArray(filter.cardId) ? filter.cardId : [filter.cardId];
      if (!ids.includes(cardId)) return false;
    }
    if (filter.color !== undefined) {
      const wants = Array.isArray(filter.color) ? filter.color : [filter.color];
      if (!wants.some(w => d.colors.includes(w))) return false;
    }
    // engine additive (2026-06-27): colorNot (「【X】以外の色を持つ」) — matchOneFilter /
    // boundMatchesFilter と同式 (3経路 sync)。some説 (公式 B08079): 全色が notSet 内のとき除外。
    if (filter.colorNot !== undefined) {
      const nots = Array.isArray(filter.colorNot) ? filter.colorNot : [filter.colorNot];
      if (!d.colors.some(c => !nots.includes(c))) return false;
    }
    // CT-P10 B10074/B10102: static printed ability metadata.  Do not read
    // disabled-original or granted state for deck/reveal candidates.
    if (filter.hasOriginalAbility !== undefined) {
      if ((d.abilities.length > 0) !== filter.hasOriginalAbility) return false;
    }
    if (filter.hasNoOriginalAbilityExceptIcons !== undefined) {
      if (!defHasNoOriginalAbilityExceptIcons(d, filter.hasNoOriginalAbilityExceptIcons)) return false;
    }
    if (filter.trait !== undefined) {
      const wants = Array.isArray(filter.trait) ? filter.trait : [filter.trait];
      const owner = player ?? ctx?.source.player;
      const traits = state && owner
        ? effectiveTraitNames(state, cardId, null, { kind: 'card', cardId, area: 'deck', player: owner })
        : (d.traits ?? []);
      if (!wants.some(w => traits.includes(w))) return false;
    }
    if (filter.traitAll !== undefined) {
      const wants = Array.isArray(filter.traitAll) ? filter.traitAll : [filter.traitAll];
      if (wants.length === 0) return false;
      const owner = player ?? ctx?.source.player;
      const traits = state && owner
        ? effectiveTraitNames(state, cardId, null, { kind: 'card', cardId, area: 'deck', player: owner })
        : (d.traits ?? []);
      if (!wants.every(w => traits.includes(w))) return false;
    }
    if (filter.traitSharedWithTriggerRemoved === true) {
      const removed = (ctx?.triggerPayload as { removedChar?: { cardId?: unknown } | undefined } | undefined)?.removedChar;
      if (!state || !removed || typeof removed.cardId !== 'string') return false;
      const traits = effectiveTraitNames(state, removed.cardId, removed as never);
      const owner = player ?? ctx?.source.player;
      const candidateTraits = owner
        ? effectiveTraitNames(state, cardId, null, { kind: 'card', cardId, area: 'deck', player: owner })
        : (d.traits ?? []);
      if (!traits.some(trait => candidateTraits.includes(trait))) return false;
    }
    if (filter.cardNameAnyBound !== undefined) {
      const bound = ctx?.bindings?.[filter.cardNameAnyBound];
      const entry = Array.isArray(bound) ? bound[0] as { snapCardNames?: unknown } | undefined : undefined;
      const names = Array.isArray(entry?.snapCardNames) ? entry.snapCardNames.filter((name): name is string => typeof name === 'string') : [];
      if (names.length === 0 || !allCardNameComponentsForDef(d).some(name => names.includes(name))) return false;
    }
    // BUG-117: AP/LP filter (printed 値判定 — deck card は override/turnEffect を持たない)
    const ap = d.ap ?? 0;
    if (filter.apMin !== undefined && ap < filter.apMin) return false;
    if (filter.apMax !== undefined && ap > filter.apMax) return false;
    const lp = d.lp ?? 0;
    if (filter.lpMin !== undefined && lp < filter.lpMin) return false;
    if (filter.lpMax !== undefined && lp > filter.lpMax) return false;
    // Cluster WB1 (2026-07-11, B09011): baseLp = 「元のLP」。deck/remove カードは override/turnEffect を
    // 持たない = 印字 LP がそのまま元LP (matchOneFilter の非現場ケースと同式、3経路 sync)。
    if (filter.baseLpMin !== undefined && lp < filter.baseLpMin) return false;
    if (filter.baseLpMax !== undefined && lp > filter.baseLpMax) return false;
    if (filter.levelMin !== undefined && (d.level ?? 0) < filter.levelMin) return false;
    if (filter.levelMax !== undefined && (d.level ?? Infinity) > filter.levelMax) return false;
    // mega-wave W5 (2026-07-04, r47 review nit): levelIn / 未解決 levelInBound。levelIn は printed 判定
    // (deck/remove カードに修飾は乗らない)。levelInBound は本経路 (deckRevealUntil 等 cardId-based) では
    // 解決機構が無い = fail-closed で全不一致 (silent drop 防止)。ctx 付き解決は candidates() 経由のみ。
    if (filter.levelIn !== undefined && !filter.levelIn.includes(d.level ?? 0)) return false;
    if (filter.levelInBound !== undefined) return false;
    if (filter.levelMaxBound !== undefined) return false;
    if (filter.apMaxSource !== undefined) return false;
    // BUG-118: kind は TargetFilter 型に昇格済 (matchOneFilter と統一)
    if (filter.kind !== undefined && d.kind !== filter.kind) return false;
    // wave#2 cluster2 (2026-06-12): keyword / cardName が silent drop されていた (BUG-117/118 同型
    // ドリフト)。matchOneFilter と同じ単一真実源 (defHasKeyword / allCardNameComponentsForDef) に委譲。
    // hasSetCards / custom / actedCharThisTurn (wave-7 P17) は deck カードに state / closure / turnEffects が
    // 無く本質的に評価不能 → 非対応のまま (matchOneFilter の scene candidate 専用 semantics)。deck-look/reveal
    // 経路 (picks.ts) の filter でこれら board-only 軸を使うカードは想定外 (現状 0)。
    if (filter.keyword !== undefined) {
      const wants = Array.isArray(filter.keyword) ? filter.keyword : [filter.keyword];
      if (!wants.some(w => state && player
        ? effectiveKeywordForCard(state, `card:${player}:deck:${cardId}`, w, { cardId, player, area: 'deck' })
        : defHasKeyword(d, w))) return false;
    }
    if (filter.keywordNot !== undefined) {
      const nots = Array.isArray(filter.keywordNot) ? filter.keywordNot : [filter.keywordNot];
      if (nots.some(w => state && player
        ? effectiveKeywordForCard(state, `card:${player}:deck:${cardId}`, w, { cardId, player, area: 'deck' })
        : defHasKeyword(d, w))) return false;
    }
    if (filter.keywordFromPrintOrConditionIcon !== undefined) {
      const wants = Array.isArray(filter.keywordFromPrintOrConditionIcon) ? filter.keywordFromPrintOrConditionIcon : [filter.keywordFromPrintOrConditionIcon];
      if (!wants.some(w => state && player
        ? printedKeywordForCard(state, `card:${player}:deck:${cardId}`, w, { cardId, player, area: 'deck' })
        : (d.keywords ?? []).includes(w))) return false;
    }
    if (filter.cardName !== undefined) {
      const wants = Array.isArray(filter.cardName) ? filter.cardName : [filter.cardName];
      const components = allCardNameComponentsForDef(d, 'deck');
      if (!wants.some(w => components.includes(w))) return false;
    }
    // cluster16: cardNameNot (「〚カード名[X]〛以外」) — matchOneFilter / boundMatchesFilter と同式。
    if (filter.cardNameNot !== undefined) {
      const nots = Array.isArray(filter.cardNameNot) ? filter.cardNameNot : [filter.cardNameNot];
      const components = allCardNameComponentsForDef(d, 'deck');
      if (nots.some(w => components.includes(w))) return false;
    }
    return true;
  };
}

export type Player = 'self' | 'opp';

/**
 * 必須スカラーフィールドの実行時検証。
 * 呼び出し元が typo などで undefined を渡した場合に mutate 層へ伝搬する前に検知する。
 * optional フィールド・nullable フィールドはここでは検証しない。
 */
export function requireField<T>(args: Record<string, unknown>, key: string, kind: 'string' | 'number' | 'boolean' | 'object'): T {
  const v = args[key];
  if (kind === 'object') {
    if (v === null || typeof v !== 'object') {
      throw new Error(`atom args missing ${kind} field "${key}"`);
    }
  } else if (typeof v !== kind) {
    throw new Error(`atom args missing ${kind} field "${key}" (got ${typeof v})`);
  }
  return v as T;
}

/**
 * BUG-079: card DSL の `player: 'self'` リテラルを ctx.source.player ベースで
 * relative resolution する。'self' = source card の owner、'opp' = opp-of-owner。
 *
 * 旧コードは `resolvePlayer(a.player, ctx)` でリテラル絶対 ID として処理していたため、
 * CPU 側 (opp) の card の `player: 'self'` が人間 (絶対 self) に効果を向けて
 * いた。cond/eval.ts の `resolvePlayer` と同じ慣習を atom 側にも統一。
 */
export function resolvePlayer(p: unknown, ctx: EffectCtx): Player {
  const owner = ctx.source.player as Player;
  if (p === 'self') return owner;
  if (p === 'opp')  return owner === 'self' ? 'opp' : 'self';
  // 想定外の入力は明示 throw (旧 requireField<Player> の保護を維持)
  throw new Error(`atom args missing string field "player" (got ${typeof p})`);
}

/**
 * Atom Verb → engine.mutate.* ディスパッチャ
 * 未知の verb は Error を throw する (defensive)
 */
/**
 * user_request 20260522_01 #12 fix: bind 参照 `$key.field` を ctx.bindings から
 * 解決する helper。
 *
 * D11019 等で `args: { cardId: '$matched.cardId' }` のような bind 参照が
 * atom handler に未解決のまま到達して `cardId='$matched.cardId'` の scene char
 * が作られ ?? 表示になっていたのを修正。
 *
 * pattern: `$<bindKey>.<field>` (例: `$matched.cardId`, `$matched.uid`)
 * - bindKey が ctx.bindings にあり、配列の先頭要素から field を取り出して返却
 * - 未解決 / 想定外 → 元 value をそのまま返す (caller 側で warning)
 */
export function resolveBindRef(value: unknown, ctx: EffectCtx): unknown {
  if (typeof value !== 'string') return value;
  if (!value.startsWith('$')) return value;
  // $self (no dot) → ctx.source.uid (source card's uid)
  // 多くのカード (D11007 a3 charModifyAP / D08005 charGrantKeyword / D11005 charSetTurnEffect 等)
  // が「このキャラ自身」を指すために $self を使う。
  if (value === '$self') {
    return ctx.source.uid ?? value;
  }
  // 2026-06-06 タスクC: $trigger.<field> → トリガ payload のキャラ参照。「そのキャラ」(=反応の
  // きっかけになったキャラ) を effect target にするための binding。payload は hook ごとに形が
  // 異なるため uid は payload.uid ?? payload.byUid で吸収 (reasoning:end={uid,player,gained} /
  // action:declare={byUid,target} / leave:to-remove={uid,cause})。runtime ctx は entryToCtx で
  // triggerPayload を持つ (stack.ts)。B05080「そのキャラをLP-1」等で使用。
  if (value.startsWith('$trigger.')) {
    const tfield = value.slice('$trigger.'.length);
    const tp = (ctx as { triggerPayload?: Record<string, unknown> }).triggerPayload;
    if (!tp || typeof tp !== 'object') return value;
    if (tfield === 'uid') return (tp['uid'] ?? tp['byUid']) ?? value;
    return tp[tfield] ?? value;
  }
  // mega-wave W6 step2 (2026-07-04, rows 74/999 統合): $dyn.<key> → ctx.dyn[<key>]。
  // charSetTurnEffect val:'$dyn.declaredName' (PR105 nameOverride) 等が使う。既存 prefix 分岐は
  // 無変更の additive ブランチ。未供給 key は元値 passthrough (caller 側 defensive、他 prefix と同 posture)。
  if (value.startsWith('$dyn.')) {
    const dkey = value.slice('$dyn.'.length);
    const dynObj = ctx.dyn as Record<string, unknown> | undefined;
    return dynObj && dkey in dynObj ? dynObj[dkey] : value;
  }
  // WC2b (2026-07-11): $cost.<key>.<path> → ctx.costPaid[key][path] (非数値 path も)。
  // 数値 dyn ($cost.X.count 等) は dyn/eval.ts が処理するが、cardIds 配列 ($cost.flipFaceUpEvidence.ids)
  // を verb arg に渡す用途は resolveBindRef 経由 (invokeHiramekiOfCard cardIds)。未供給 key は passthrough。
  if (value.startsWith('$cost.')) {
    const rest = value.slice('$cost.'.length);
    const dotc = rest.indexOf('.');
    const ckey = dotc < 0 ? rest : rest.slice(0, dotc);
    const cpath = dotc < 0 ? undefined : rest.slice(dotc + 1);
    const cp = (ctx as { costPaid?: Record<string, unknown> }).costPaid;
    const rec = cp && cp[ckey];
    if (!rec || typeof rec !== 'object') return value;
    if (!cpath) return rec;
    const rv = (rec as Record<string, unknown>)[cpath];
    return rv ?? value;
  }
  const dot = value.indexOf('.');
  if (dot < 0) return value;
  const key = value.slice(1, dot);
  const field = value.slice(dot + 1);
  // BUG-091: ctx.bindings のキー規約が混在する。contact.ts は `contact` ($無し) で格納し、
  // deckRevealUntil は `$matched` / `$revealed` ($込み、a.bind/a.bindMatch をそのまま使用) で格納する。
  // まず $無しキー (contact 等) を引き、無ければ $込みキー ($matched 等) に fallback する
  // (純粋に additive — 従来 $無しで解決していたカードの挙動は不変)。
  let binding = (ctx.bindings as Record<string, unknown>)[key];
  if (!Array.isArray(binding) || binding.length === 0) {
    binding = (ctx.bindings as Record<string, unknown>)[value.slice(0, dot)];
  }
  if (!Array.isArray(binding) || binding.length === 0) return value;
  const first = binding[0] as Record<string, unknown>;
  const fieldVal = first[field];
  return fieldVal ?? value;
}

export type BoundOccurrenceRef =
  | { kind: 'unbound' }
  | { kind: 'invalid' }
  | { kind: 'live'; cardId: string; index: number };

/** Resolve an indexed physical bind without treating a duplicate cardId as identity. */
export function resolveBoundOccurrenceRef(
  value: unknown,
  s: GameState,
  ctx: EffectCtx,
  player: Player,
  area: 'remove' | 'evidence',
): BoundOccurrenceRef {
  if (typeof value !== 'string' || !value.startsWith('$')) return { kind: 'unbound' };
  const dot = value.indexOf('.');
  if (dot < 0) return { kind: 'unbound' };
  let entries = ctx.bindings[value.slice(1, dot)];
  if (!Array.isArray(entries) || entries.length === 0) entries = ctx.bindings[value.slice(0, dot)];
  const entry = Array.isArray(entries) ? entries[0] : undefined;
  if (!entry || typeof entry !== 'object') return { kind: 'unbound' };
  const physical = entry as {
    uid?: unknown;
    cardId?: unknown;
    player?: unknown;
    area?: unknown;
    index?: unknown;
    occurrenceWitness?: unknown;
  };
  if (physical.area !== 'remove' && physical.area !== 'evidence') return { kind: 'unbound' };
  if (physical.player !== player
    || physical.area !== area
    || typeof physical.cardId !== 'string'
    || physical.cardId.length === 0
    || typeof physical.index !== 'number'
    || !Number.isSafeInteger(physical.index)
    || physical.index < 0
    || typeof physical.occurrenceWitness !== 'string'
    || !isLiveCardOccurrenceWitness(s, player, area, physical.occurrenceWitness)) {
    return { kind: 'invalid' };
  }
  const expectedUid = area === 'evidence'
    ? `evidence:${player}:${physical.index}`
    : cardOccurrenceUid(player, area, physical.cardId, physical.index);
  if (physical.uid !== undefined && physical.uid !== expectedUid) return { kind: 'invalid' };
  const liveCardId = area === 'remove'
    ? s.players[player].remove[physical.index]
    : s.players[player].evidence[physical.index]?.cardId;
  return liveCardId === physical.cardId
    ? { kind: 'live', cardId: physical.cardId, index: physical.index }
    : { kind: 'invalid' };
}

/**
 * BUG-114: explicit-uid の charModifyAP/LP/Level における delta 解決。
 * 短縮形 (pick) 経路は resolveDynArgs で literal 化されるが、explicit-uid 経路 (uid='$contact.byUid' 等)
 * は従来 number 専用だった (`a.delta as number`)。{dyn} delta を runtime に evalDyn で数値化する
 * (B05040 '$discarded.level * 1000' / B08055 '$discarded.ap')。number はそのまま (既存挙動不変)。
 * 非有限値は 0 (NaN ガード、AP/LP を汚染しない)。
 */
export function resolveDeltaToNumber(delta: unknown, s: GameState, ctx: EffectCtx): number {
  if (typeof delta === 'number') return delta;
  if (delta !== null && typeof delta === 'object' && 'dyn' in delta) {
    const v = evalDyn(s, (delta as { dyn: string }).dyn, ctx);
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }
  return 0;
}

/**
 * BUG-074: BUG-065 で resolve-picks が pattern B 解決時に target を array (`[cardId]`)
 * で構築するよう変更。一部 atom (evidenceToHand / handAddFromRemove) は元々 string を
 * 期待していたため、両形式から最初の cardId を取り出す正規化ヘルパー。
 *
 * 戻り値:
 *   - string → そのまま返す
 *   - string[] → 先頭要素を返す (n=1 ケースのみ正しく動作。n>1 の場合は要拡張)
 *   - その他 (undefined / pick query object) → undefined (caller が awaiting-pick と判断)
 */
export function normalizeTargetToString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

/**
 * Pattern B atom (evidenceToHand / discard / handAddFromRemove) の引数省略形対応 helper。
 *
 * カード DSL 上「自分の x エリアから n 枚選ぶ」と書きたい場合、target を毎回
 * `{ kind:'pick', query:{area,side}, n:{min,max}, chooser }` で書くのは冗長。
 * `args: { player, n }` だけ渡された場合に、verb 既定の area を使って pick query を
 * 自動構築する。
 *
 * - target 既指定 (string / array / pick query object) → そのまま返す (既存挙動を破壊しない)
 * - target 未指定 + n: number → 既定の pick query を生成
 * - 上記以外 → undefined (atom-handler 側で awaiting-pick / no-op 判断)
 */
// PB/PA 短縮形の pick query 構築は buildShortFormPick (atom-pick-spec.ts) に集約。
// 短縮形成立判定 (n|max あり)。verb 毎の guard / byPlayer は各 case 側に残す (動作不変維持)。
export function hasNorMax(a: Record<string, unknown>): boolean {
  return typeof a.n === 'number' || typeof a.max === 'number';
}

/**
 * PA 短縮形 (uid-carrier) の awaiting-pick 共通処理 (refactor 2a, 2026-06-12)。
 * 旧来 11 case にコピペされていた「pick query 構築 → uid:'$pick' carrier 化 →
 * tryRePickFromAtom (side-channel set) → awaiting-pick log → return」を集約する。
 *
 * - gate 条件 (uid 不在 + verb 固有の前提 + hasNorMax) は **各 case 側に残す** (動作不変維持)
 * - chooser (= byPlayer = log player): 「誰が選ぶか」。2 規約が併存する:
 *     a) chooser = resolvePlayer(a.player) — `player`=操作者 規約 (sceneRemove/sceneToHand 等。
 *        BUG-131 調査で正と裁定)
 *     b) chooser = ctx.source.player (controller) — BUG-120 裁定 (charModify系/charSetCard/
 *        charGrant系/sceneToDeck)。`player` は対象側 (side 既定) を表す
 *   既存カードへの挙動影響を避けるため本 helper は規約を強制せず、呼出側が明示する。
 * - side: buildShortFormPick の sideDefault (a.side 指定があればそちらが優先される)
 */
export function paShortFormAwait(
  s: GameState,
  verb: AtomVerb,
  a: Record<string, unknown>,
  ctx: EffectCtx,
  chooser: Player,
  side: 'self' | 'opp' | 'either',
  area = 'scene',
): void {
  const paTarget = buildShortFormPick(area, a, chooser, side);
  const paArgs = { ...a, uid: '$pick', target: paTarget };
  tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, {
    byPlayer: chooser,
    source: {
      cardId: ctx.source.cardId ?? '',
      abilityId: ctx.source.abilityId ?? '',
      uid: ctx.source.uid,
    },
  });
  mutate.log.append(s, { ts: Date.now(), player: chooser, turn: s.turn.number, action: `effect:${verb}:awaiting-pick` });
}

