// engine.effect.atom-handlers/core — Phase 3a 分割 (case body 無改変移送, 2026-06-22)
import { mutate } from '../../mutate/index.js';
import { invokeLeaveToRemoveOfCard } from '../invoke-leave-to-remove.js';
import { invokeHiramekiOfCard, isHiramekiOccurrence, type HiramekiOccurrence } from '../invoke-hirameki.js';
import { event } from '../../event/index.js';
import { def as readDef } from '../../read/def.js'; // W6 step3 (r63): useEventFromHand の kind guard
import { eventUseAllowed } from '../../flow/main/hand-use-card.js';
import { pendingSource, tryRePickFromAtom } from '../resolve-picks.js';
// WC2b (2026-07-11): invokeHiramekiOfCard atom-level optional prompt 用 (pending-state は leaf — cycle 無し)。
import { pushPendingEffectOptionalSide, setPendingOptionalResume, setPendingOptionalBindings, setPendingOptionalCostPaid } from '../pending-state.js';
import { ATOM_PICK_SPEC, buildShortFormPick } from '../atom-pick-spec.js';
import { allocatePublicHandRevealToken, requireField, resolvePlayer, resolveBindRef, normalizeTargetToString, hasNorMax, resolveDeltaToNumber, publicEffectSource, publicHandRevealToken, queuePendingPublicHandRevealSide, readHeldHiramekiSelfClaim, resolveBoundOccurrenceRef, markPendingDeckRevealPresentation } from './_shared.js';
import { isDynObject, resolveDynNumber } from '../../dyn/eval.js';
import type { Player } from './_shared.js';
import type { GameState, AtomVerb, EffectCtx, FileCard, PublicCausalZone } from '../../types/index.js';
import { removeExcludedSourceCardId } from '../../read/effect-source.js';
import { recordEffectCausalOperation } from '../../log/effect-causal.js';
import { cardOccurrenceUid, cardOccurrenceWitness, isLiveCardOccurrenceWitness } from '../../target/card-occurrence.js';
import { advanceIndexedZoneEpoch } from '../../state/indexed-zone-epoch.js';
import { advanceDeckEpochAndRebaseBindings } from '../deck-occurrence-authority.js';

function resolvingEventCardId(ctx: EffectCtx, player: Player): string | undefined {
  return removeExcludedSourceCardId(ctx, player);
}

function refreshDeckForEffect(s: GameState, player: Player, ctx: EffectCtx): boolean {
  return mutate.deck.refreshAfterTake(
    s,
    player,
    resolvingEventCardId(ctx, player),
    (count) => recordDeckRefresh(s, ctx, player, count),
  );
}

function recordEvidenceFaceChange(
  s: GameState,
  ctx: EffectCtx,
  owner: Player,
  from: 'face-down' | 'face-up',
  to: 'face-down' | 'face-up',
  count: number,
): void {
  if (count < 1) return;
  recordEffectCausalOperation(s, ctx, {
    actor: ctx.source.player,
    kind: 'evidence',
    source: { kind: 'zone', side: owner, zone: 'evidence' },
    targets: [{ kind: 'zone', side: owner, zone: 'evidence' }],
    outcome: { type: 'face-change', from, to, count },
  });
}

function recordPublicZoneMove(
  s: GameState,
  ctx: EffectCtx,
  side: Player,
  from: PublicCausalZone,
  to: PublicCausalZone,
  count: number,
  kind: 'zone-move' | 'evidence' = 'zone-move',
): void {
  if (count < 1) return;
  recordEffectCausalOperation(s, ctx, {
    actor: ctx.source.player,
    kind,
    source: { kind: 'zone', side, zone: from },
    targets: [{ kind: 'zone', side, zone: to }],
    outcome: { type: 'move', from, to, count },
  });
}

function recordDeckRefresh(s: GameState, ctx: EffectCtx, player: Player, count: number): void {
  if (count < 1) return;
  recordEffectCausalOperation(s, ctx, {
    actor: ctx.source.player,
    kind: 'zone-move',
    tags: ['refresh'],
    source: { kind: 'zone', side: player, zone: 'remove' },
    targets: [{ kind: 'zone', side: player, zone: 'deck' }],
    outcome: { type: 'move', from: 'remove', to: 'deck', count },
  });
}

type DeckDrawCausalStep = { kind: 'draw' | 'refresh'; count: number };

function appendDeckDrawCausalStep(steps: DeckDrawCausalStep[], step: DeckDrawCausalStep): void {
  const previous = steps[steps.length - 1];
  if (previous?.kind === step.kind) {
    previous.count += step.count;
    return;
  }
  steps.push({ ...step });
}

function recordDeckDrawCausalSteps(
  s: GameState,
  ctx: EffectCtx,
  player: Player,
  steps: DeckDrawCausalStep[],
): void {
  for (const step of steps) {
    if (step.kind === 'draw') {
      recordEffectCausalOperation(s, ctx, {
        actor: ctx.source.player,
        kind: 'draw',
        source: { kind: 'zone', side: player, zone: 'deck' },
        targets: [{ kind: 'zone', side: player, zone: 'hand' }],
        outcome: { type: 'move', from: 'deck', to: 'hand', count: step.count },
      });
      continue;
    }
    recordDeckRefresh(s, ctx, player, step.count);
  }
}

type DeckTransferCausalStep = { kind: 'move' | 'refresh'; count: number };

function appendDeckTransferCausalStep(steps: DeckTransferCausalStep[], step: DeckTransferCausalStep): void {
  const previous = steps[steps.length - 1];
  if (previous?.kind === step.kind) {
    previous.count += step.count;
    return;
  }
  steps.push({ ...step });
}

function setCardMoveBinding(
  ctx: EffectCtx,
  bind: unknown,
  cards: Array<{ cardId: string; area: 'hand' | 'partner-area'; player: Player; index: number }>,
): void {
  if (typeof bind !== 'string') return;
  (ctx.bindings as Record<string, unknown>)[bind] = cards.map((card) => ({ kind: 'card', ...card }));
}

function presentPublicSelectedDeckCard(
  s: GameState,
  ctx: EffectCtx,
  owner: Player,
  cardIds: readonly string[],
  presentation: unknown,
): void {
  if (presentation !== 'public-selected-card' || cardIds.length !== 1) return;
  queuePendingPublicHandRevealSide({
    owner,
    audience: 'all',
    cardIds: [cardIds[0]!],
    lifetime: 'presentation',
    resolutionToken: allocatePublicHandRevealToken(s),
    origin: 'deck-selected-card',
    source: publicEffectSource(ctx),
  });
}

function boundDeckReferenceKeys(
  ctx: EffectCtx,
  ref: unknown,
  player: Player,
  index: number,
  cardId: string,
): string[] {
  if (typeof ref !== 'string' || !ref.startsWith('$')) return [];
  const dot = ref.indexOf('.');
  if (dot < 0) return [];
  const keys = [ref.slice(0, dot), ref.slice(1, dot)];
  return keys.filter((key, position) => {
    if (keys.indexOf(key) !== position) return false;
    const binding = ctx.bindings[key];
    if (!Array.isArray(binding) || binding.length === 0) return false;
    const first = binding[0];
    return first.kind === 'card'
      && first.area === 'deck'
      && first.player === player
      && first.index === index
      && first.cardId === cardId;
  });
}

function restoreMovedDeckReferenceInHand(
  ctx: EffectCtx,
  keys: readonly string[],
  player: Player,
  cardId: string,
  handIndex: number,
): void {
  for (const key of keys) {
    const surviving = Array.isArray(ctx.bindings[key]) ? ctx.bindings[key] : [];
    ctx.bindings[key] = [{ kind: 'card', cardId, area: 'hand', player, index: handIndex }, ...surviving];
  }
}

function exactSelectedIndexes(
  value: unknown,
  ctx: EffectCtx,
): number[] | null {
  if (!Array.isArray(value)) return null;
  const indexes = value.map((raw) => resolveBindRef(raw, ctx));
  return indexes.every((index): index is number => typeof index === 'number' && Number.isInteger(index) && index >= 0)
    ? indexes
    : null;
}

type SelectedCardOccurrence = {
  uid: string;
  cardId: string;
  area: 'remove' | 'partner-area' | 'evidence';
  player: Player;
  index: number;
  occurrenceWitness?: string;
};

function exactSelectedCardOccurrences(value: unknown, ctx: EffectCtx): SelectedCardOccurrence[] | null {
  if (!Array.isArray(value)) return null;
  const occurrences = value.map((raw) => resolveBindRef(raw, ctx));
  return occurrences.every((entry): entry is SelectedCardOccurrence => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as Record<string, unknown>;
    return typeof candidate.cardId === 'string'
      && (candidate.area === 'remove' || candidate.area === 'partner-area' || candidate.area === 'evidence')
      && (candidate.player === 'self' || candidate.player === 'opp')
      && typeof candidate.index === 'number'
      && Number.isInteger(candidate.index)
      && candidate.index >= 0
      && typeof candidate.uid === 'string'
      && candidate.uid === (candidate.area === 'evidence'
        ? `evidence:${candidate.player}:${candidate.index}`
        : cardOccurrenceUid(candidate.player as Player, candidate.area as string, candidate.cardId as string, candidate.index as number))
      && ((candidate.area !== 'remove' && candidate.area !== 'evidence') || typeof candidate.occurrenceWitness === 'string');
  }) ? occurrences : null;
}

function exactEvidenceOccurrenceIndexes(
  s: GameState,
  args: Record<string, unknown>,
  ctx: EffectCtx,
  player: Player,
  cardIds: readonly string[],
): number[] | null | undefined {
  if (!Object.hasOwn(args, 'selectedCardOccurrences')) return undefined;
  const occurrences = exactSelectedCardOccurrences(args.selectedCardOccurrences, ctx);
  if (occurrences === null || occurrences.length !== cardIds.length) return null;
  const indexes = occurrences.map((occurrence) => occurrence.index);
  if (new Set(indexes).size !== indexes.length) return null;
  return occurrences.every((occurrence, position) => occurrence.area === 'evidence'
    && occurrence.player === player
    && occurrence.cardId === cardIds[position]
    && isLiveCardOccurrenceWitness(s, player, 'evidence', occurrence.occurrenceWitness)
    && s.players[player].evidence[occurrence.index]?.cardId === occurrence.cardId)
    ? indexes
    : null;
}

/** Limit a useEventFromHand pick to events authorized at selection time. */
function restrictEventUsePick(s: GameState, player: Player, args: Record<string, unknown>): Record<string, unknown> {
  const target = args.target as { kind?: unknown; query?: { area?: unknown; filter?: { cardId?: string | string[] } } } | undefined;
  if (target?.kind !== 'pick' || target.query?.area !== 'hand') return args;
  const allowed = s.players[player].hand.filter(cardId => readDef.card(cardId)?.kind === 'event' && eventUseAllowed(s, player, cardId));
  const existing = target.query.filter?.cardId;
  const selected = existing === undefined
    ? allowed
    : allowed.filter(cardId => (Array.isArray(existing) ? existing : [existing]).includes(cardId));
  return {
    ...args,
    target: { ...target, query: { ...target.query, filter: { ...target.query.filter, cardId: selected } } },
  };
}

export function atomDraw(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-072: deck.draw が手札への push まで内部で行う + effect 経由の draw を log に残す
      const drawPlayer = resolvePlayer(a.player, ctx);
      // mini-wave #3 (2026-07-10): n は number | {dyn} (B05092「移した枚数と同じ数のカードを引く」
      // = {dyn:'$bound.$moved.count'})。number は従来 byte 互換 (resolveDeltaToNumber は number passthrough)。
      const drawN = typeof a.n === 'number' ? a.n : resolveDeltaToNumber(a.n, s, ctx);
      const causalSteps: DeckDrawCausalStep[] = [];
      const drawn = mutate.deck.draw(
        s,
        drawPlayer,
        drawN,
        resolvingEventCardId(ctx, drawPlayer),
        (step) => appendDeckDrawCausalStep(causalSteps, step),
      );
      recordDeckDrawCausalSteps(s, ctx, drawPlayer, causalSteps);
      mutate.log.append(s, {
        ts: Date.now(),
        player: drawPlayer,
        turn: s.turn.number,
        action: 'effect:draw',
        result: String(drawn.length),
      });
      return;
    }

// engine additive wave-4 (2026-07-01): drawUpToHandSize — 「手札が N 枚になるまでカードを引く」
// (B08047 沖矢昴「ターン終了時、手札が2枚になるまで引く」)。draw(max(0, n − 現手札)) の決定論 verb。
// 手札が既に N 枚以上なら draw 0 (draw-up 方向のみ、捨てない)。mutate.deck.draw は内部で手札 push +
// デッキ0時リフレッシュ (rules/14、足りなければ可能な限り) を担うため atomDraw と同じ薄いラッパー。
// discard-down 版 (B07076「N枚になるまでリムーブ」= pick 要) / 引いた枚数 return (B04048) は別 variant で DEFER。
export function atomDrawUpToHandSize(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const drawPlayer = resolvePlayer(a.player, ctx);
      const target = requireField<number>(a, 'n', 'number');
      const need = Math.max(0, target - s.players[drawPlayer].hand.length);
      // M2後半 (2026-07-10, B04048): 引いた cardId 群を bind (「引いた枚数と同じ数」を後段
      // handToDeckBottom n:{dyn:'$bound.<key>.count'} が読む)。mill/discard と同 idiom (0枚は書かない)。
      const causalSteps: DeckDrawCausalStep[] = [];
      const drawn = need > 0
        ? mutate.deck.draw(
          s,
          drawPlayer,
          need,
          resolvingEventCardId(ctx, drawPlayer),
          (step) => appendDeckDrawCausalStep(causalSteps, step),
        )
        : [];
      if (typeof a.bind === 'string' && drawn.length > 0) {
        (ctx.bindings as Record<string, unknown>)[a.bind] = drawn.map((cardId) => ({ cardId }));
      }
      recordDeckDrawCausalSteps(s, ctx, drawPlayer, causalSteps);
      mutate.log.append(s, {
        ts: Date.now(),
        player: drawPlayer,
        turn: s.turn.number,
        action: 'effect:drawUpToHandSize',
        result: `${need}→${target}`,
      });
      return;
    }

/** Remove cards from the front of hand until exactly n remain. */
export function atomDiscardDownTo(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
  const player = resolvePlayer(a.player, ctx);
  const n = requireField<number>(a, 'n', 'number');
  const hand = s.players[player].hand;
  const ids = hand.slice(0, Math.max(0, hand.length - n));
  if (ids.length > 0) {
    mutate.hand.discardToRemove(s, player, ids, { byPlayer: ctx.source.player });
    recordEffectCausalOperation(s, ctx, {
      actor: ctx.source.player,
      kind: 'discard',
      source: { kind: 'zone', side: player, zone: 'hand' },
      targets: [{ kind: 'zone', side: player, zone: 'remove' }],
      outcome: { type: 'move', from: 'hand', to: 'remove', count: ids.length },
    });
  }
  if (typeof a.bind === 'string') {
    (ctx.bindings as Record<string, unknown>)[a.bind] = ids.map((cardId) => ({ cardId }));
  }
  mutate.log.append(s, {
    ts: Date.now(), player, turn: s.turn.number,
    action: 'effect:discardDownTo', result: `${ids.length}`,
  });
}

export function atomDiscard(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // BUG-065 (本格対応) で resolve-picks.ts が pattern B (uid なし + target.kind='pick')
      // の解決をサポート。ここに到達した時点で a.target は string[] のはず。
      // BUG-071: pre-pick step (例: D08015 a1 step 1 draw) 実行のため、triggered
      // listener の queue skip を廃止 → human pick 待ちの atom はここで no-op skip。
      // BUG-072: skip 時の action 名を 'effect:discard:awaiting-pick' に変更し
      // UI で「効果: 手札選択待ち」と日本語表示できるよう mapping 追加。
      // BUG-076: awaiting-pick 時に tryRePickFromAtom で side-channel 再 set (連続 pick)
      // 物理動作 atom 化: { player, n } の省略形を受け取れるよう default pick target で補完
      const dcP = resolvePlayer(a.player, ctx);
      // M2後半 (2026-07-10, B07100): chooser:'source' — 「(自分が) 選び、相手はそれをリムーブする」。
      // 選ぶ主語 = 能力所有者 (ctx.source.player)、手札所有者 (dcP) と分離する。pending 側は
      // BUG-175 の ownerPlayer 分離が chooser≠owner の再実行座標系を既に支える。未指定は従来
      // どおり手札所有者が選ぶ (byte 互換)。
      const dcChooser = a.chooser === 'source' ? ctx.source.player : dcP;
      const dcArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.discard.defaultArea, a, dcChooser, a.player as Player) }
        : a;
      if (!Array.isArray(dcArgs.target)) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: dcArgs }, ctx, { byPlayer: dcChooser, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, {
          ts: Date.now(),
          player: dcP,
          turn: s.turn.number,
          action: 'effect:discard:awaiting-pick',
        });
        return;
      }
      const target = dcArgs.target as string[];
      // W3 (r17): byPlayer = 効果起動側 (相対 player と乖離しうる — 「相手の効果によって」判定用)
      const dcBefore = s.players[dcP].hand.length;
      mutate.hand.discardToRemove(s, dcP, target, { byPlayer: ctx.source.player });
      const dcDiscarded = dcBefore - s.players[dcP].hand.length;
      if (dcDiscarded > 0) {
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: 'discard',
          source: { kind: 'zone', side: dcP, zone: 'hand' },
          targets: [{ kind: 'zone', side: dcP, zone: 'remove' }],
          outcome: { type: 'move', from: 'hand', to: 'remove', count: dcDiscarded },
        });
      }
      // BUG-114: discard したカードを bind (リムーブしたカードの level/AP を $discarded dyn で参照)。
      // 続く chain step (charModifyAP delta:{dyn:'$discarded.level*1000'}) が同一 ctx で読む (BUG-107)。
      if (typeof a.bind === 'string' && target.length > 0) {
        (ctx.bindings as Record<string, unknown>)[a.bind] = target.map((cardId) => ({ cardId }));
      }
      // BUG-072: effect 経由の discard 成功も log に残す
      mutate.log.append(s, {
        ts: Date.now(),
        player: dcP,
        turn: s.turn.number,
        action: 'effect:discard',
        result: String(dcDiscarded),
      });
      return;
    }

// engine mini-wave #3 (2026-07-10): handToDeckBottom — 手札から N 枚 (pick) をデッキの下へ移す
// (B05092「手札からカードを4枚まで好きな順番でデッキの下に移し、…移した枚数と同じ数のカードを引く」)。
// atomDiscard の PB 短縮形 clone (dest = remove でなくデッキ末尾)。「好きな順番」= picked 順で push
// (デッキ下の順は非公開情報 rules/02 — 順序は所有者選択、engine は picked 順を尊重)。
// リムーブではないため hand:removed は emit しない (rules/03 zone 移動のみ)。bind = 移した cardId 群。
export function atomHandToDeckBottom(s: GameState, a0: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // M2後半 (2026-07-10, B04048): n:{dyn:'$bound.<key>.count'} を handler-local で解決
      // (「引いた枚数と同じ数の手札を…デッキの下に移す」)。evidenceFlip dyn-max と同封じ込め
      // (共有 helper は byte 不変)。解決値 <=0 は「0枚移す」= no-op (pick を出さない)。
      const a = isDynObject(a0.n) ? { ...a0, n: resolveDynNumber(a0.n, s, ctx) } : a0;
      if (isDynObject(a0.n) && (a.n as number) <= 0) {
        mutate.log.append(s, { ts: Date.now(), player: resolvePlayer(a.player, ctx), turn: s.turn.number, action: 'effect:handToDeckBottom', result: 'dyn-n-0' });
        return;
      }
      const hdP = resolvePlayer(a.player, ctx);
      // multi-pick は cardIds:'$pick.cardIds' contract 必須 (B09034/B08028 同型 — short-form N>1 は
      // normalizeTargetToString で 1 枚に collapse する engine-wide 既知罠。miniwave3 probe で実測)。
      const hdRawCardIds = (a as { cardIds?: unknown }).cardIds;
      if (hdRawCardIds === '$pick.cardIds') {
        // B05092: 「4枚まで」は0枚を選べるが、その後のshuffleは必須。
        // skipResolvesAtom はこの空解決を明示するopt-in。候補ありの辞退は
        // __declined、候補0は空のhandで到達する。どちらもmove 0として
        // hdMoveへ渡し、shuffleThenDrawMovedのshuffleだけを実行する。
        if ((a as { skipResolvesAtom?: unknown }).skipResolvesAtom === true
          && (a.__declined === true || s.players[hdP].hand.length === 0)) {
          return hdMove(s, a, ctx, hdP, []);
        }
        if (a.target && typeof a.target === 'object' && !Array.isArray(a.target)) {
          tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, { byPlayer: hdP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
          mutate.log.append(s, { ts: Date.now(), player: hdP, turn: s.turn.number, action: 'effect:handToDeckBottom:awaiting-pick' });
        }
        return;
      }
      if (Array.isArray(hdRawCardIds)) {
        return hdMove(s, a, ctx, hdP, hdRawCardIds as string[]);
      }
      const hdArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handToDeckBottom!.defaultArea, a, hdP, a.player as Player) }
        : a;
      if (!Array.isArray(hdArgs.target)) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: hdArgs }, ctx, { byPlayer: hdP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: hdP, turn: s.turn.number, action: 'effect:handToDeckBottom:awaiting-pick' });
        return;
      }
      return hdMove(s, a, ctx, hdP, hdArgs.target as string[]);
    }

function hdMove(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, hdP: 'self' | 'opp', hdTarget: string[]): void {
      const hdHand = s.players[hdP].hand;
      // M2後半 (2026-07-10, B04048): shuffleMoved — 「シャッフルしてデッキの下に移す」= 移動群のみ
      // 順序無作為化 (Fisher-Yates、mutate.deck.shuffle と同 idiom)。デッキ全体 shuffle
      // (shuffleThenDrawMoved、B05092) とは別物。既存カードは未指定 = picked 順 push 不変。
      if ((a as { shuffleMoved?: unknown }).shuffleMoved === true) {
        hdTarget = [...hdTarget];
        for (let i = hdTarget.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = hdTarget[i]; hdTarget[i] = hdTarget[j]; hdTarget[j] = tmp;
        }
      }
      const movedIds: string[] = [];
      for (const cid of hdTarget) {
        const i = hdHand.indexOf(cid);
        if (i === -1) continue; // 防御的 (rules/15 可能な限り)
        hdHand.splice(i, 1);
        s.players[hdP].deck.push(cid);
        movedIds.push(cid);
      }
      if (movedIds.length > 0) {
        advanceDeckEpochAndRebaseBindings(s, ctx, hdP, []);
      }
      if (typeof a.bind === 'string' && movedIds.length > 0) {
        (ctx.bindings as Record<string, unknown>)[a.bind] = movedIds.map((cardId) => ({ cardId }));
      }
      recordPublicZoneMove(s, ctx, hdP, 'hand', 'deck', movedIds.length);
      // shuffleThenDrawMoved (B05092「…デッキの下に移し、デッキをシャッフルする。移した枚数と同じ数の
      // カードを引く」): atom 内蔵で move → shuffle → 同数 draw を印字順に実行。別 step の
      // draw n:{dyn:'$bound...count'} は初期 walk が bind 前に 0 へ literalize するため不可
      // (miniwave3 実測。walk-literalize latent は DEFERRED-INDEX 記録)。自己完結が正準。
      if ((a as { shuffleThenDrawMoved?: unknown }).shuffleThenDrawMoved === true) {
        mutate.deck.shuffle(s, hdP);
        if (movedIds.length > 0) {
          const causalSteps: DeckDrawCausalStep[] = [];
          mutate.deck.draw(
            s,
            hdP,
            movedIds.length,
            resolvingEventCardId(ctx, hdP),
            (step) => appendDeckDrawCausalStep(causalSteps, step),
          );
          recordDeckDrawCausalSteps(s, ctx, hdP, causalSteps);
        }
      }
      mutate.log.append(s, { ts: Date.now(), player: hdP, turn: s.turn.number, action: 'effect:handToDeckBottom', result: String(movedIds.length) });
      return;
}

// engine additive: discardRandom — 手札からランダムに n 枚リムーブする (B01077「相手は手札を1枚ランダムに
// リムーブする」, 公式 QA = 相手が選べず確率均等)。atomDiscard と異なり **pick を持たない** (ランダム =
// プレイヤー choice 不要) → awaiting-pick 経路なし。ctx.rng (無ければ Math.random) で決定的に選ぶ (deck.shuffle
// と同式、smoke 再現性)。手札 < n なら可能な限り (rules/15)。zone = hand → remove (discardToRemove)。
export function atomDiscardRandom(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
  const drP = resolvePlayer(a.player, ctx);
  const n = requireField<number>(a, 'n', 'number');
  const hand = s.players[drP].hand;
  const k = Math.min(n, hand.length);
  if (k <= 0) {
    mutate.log.append(s, { ts: Date.now(), player: drP, turn: s.turn.number, action: 'effect:discardRandom', result: '0' });
    return;
  }
  // 手札 cardId 配列のコピーを Fisher-Yates shuffle し先頭 k 枚を選ぶ (均等確率)。重複 cardId は
  // discardToRemove (hand.remove = indexOf+splice) が1要素につき1インスタンス除去 → count は正確に k。
  const rand = ctx.rng ?? Math.random;
  const pool = hand.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const picked = pool.slice(0, k);
  mutate.hand.discardToRemove(s, drP, picked, { byPlayer: ctx.source.player }); // W3 (r17)
  recordEffectCausalOperation(s, ctx, {
    actor: ctx.source.player,
    kind: 'discard',
    source: { kind: 'zone', side: drP, zone: 'hand' },
    targets: [{ kind: 'zone', side: drP, zone: 'remove' }],
    outcome: { type: 'move', from: 'hand', to: 'remove', count: picked.length },
  });
  // BUG-114 同型: リムーブした cardId を bind ($discarded dyn で後続 chain step が参照可能)。
  if (typeof a.bind === 'string' && picked.length > 0) {
    (ctx.bindings as Record<string, unknown>)[a.bind] = picked.map((cardId) => ({ cardId }));
  }
  mutate.log.append(s, { ts: Date.now(), player: drP, turn: s.turn.number, action: 'effect:discardRandom', result: String(picked.length) });
}

// engine additive wave (2026-06-28): handReveal — 「手札から filter 一致を1枚公開してもよい。そうした場合〜」
// (B08082 a1 / B07022)。atomDiscard の clone から mutate.hand.discardToRemove を除去 = zone 変化なし (公開のみ、
// 公式Q&A: 解決後に手札へ戻してよい)。短縮形 ({player, max, filter}) は discard と同一 pick path
// (buildShortFormPick → tryRePickFromAtom)。resolve-picks が 0候補時に chainStepNoApply を自動設定するため
// 短縮形 0候補の gate は infra 任せ。resolved target が 0枚 (辞退) のときは本 handler で chainStepNoApply を立てる。
export function atomHandReveal(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      const hrP = resolvePlayer(a.player, ctx);
      const publicLifetime = a.audience === 'all' && (a.lifetime === 'effect' || a.lifetime === 'presentation')
        ? a.lifetime
        : null;
      const hrArgs = a.all === true
        ? { ...a, target: [...s.players[hrP].hand] }
        : (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handReveal.defaultArea, a, hrP, a.player as Player) }
        : a;
      // Rules/15: a mandatory fixed count resolves as much as possible.  Exact
      // prerequisites such as 「そうした場合」 are owned by the surrounding
      // chain/optional resolver, not by this atom; the shared pending-pick
      // policy therefore remains the single feasibility authority.
      if (!Array.isArray(hrArgs.target)) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: hrArgs }, ctx, { byPlayer: hrP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: hrP, turn: s.turn.number, action: 'effect:handReveal:awaiting-pick' });
        return;
      }
      const target = hrArgs.target as string[];
      if (publicLifetime !== null) {
        queuePendingPublicHandRevealSide({
          owner: hrP,
          audience: 'all',
          cardIds: [...target],
          handSnapshot: [...s.players[hrP].hand],
          lifetime: publicLifetime,
          resolutionToken: publicHandRevealToken(s, ctx),
          source: publicEffectSource(ctx),
        });
      }
      // W3 (r18): 公開 observer hook (B09004)。zone 不変のまま emit のみ (mutate.hand.emitReveal 単一ソース)。
      mutate.hand.emitReveal(s, hrP, target, { byPlayer: ctx.source.player, cause: 'effect' });
      // 公開のみ = zone 変化なし (mutate を呼ばない、カードは手札に残る)。
      // discard の bind と同型: 公開した cardId を ctx.bindings に格納 ($revealed 色読み companion の足場)。
      if (typeof a.bind === 'string' && target.length > 0) {
        // A revealed card remains in hand, but its printed name is public to
        // the resolving effect. Keep it beside cardId so a later chain step
        // can consume `$<bind>.cardName` without a card-specific atom.
        (ctx.bindings as Record<string, unknown>)[a.bind] = target.map((cardId) => ({
          cardId,
          cardName: readDef.card(cardId)?.names[0],
        }));
      }
      // 0枚公開 (候補無し or 辞退) → chainStepNoApply で「そうした場合」を gate (mill gate と同型)。
      if (target.length === 0) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
      }
      mutate.log.append(s, { ts: Date.now(), player: hrP, turn: s.turn.number, action: 'effect:handReveal', result: String(target.length) });
      return;
    }

// engine wave A1 (2026-07-02 G39 継続): partnerAreaRemove — 「自分のパートナーエリアにある
// 〚特徴[ビッグジュエル]〛のカードを N 枚リムーブ」(B07037 n:2 /PR263 n:1)。atomHandReveal の clone
// (短縮形 pick + exact-N gate + gate-on-0 + bind) に **実 zone 変化** (mutate.partner.removeAreaCardsToRemove)
// を足したもの。defaultArea='partner-area' (candidates case 'partner-area' が partnerAreaCards を列挙、
// wave-12)。「N枚リムーブしてもよい」の optional/「そうした場合」はカード側 (optional{chain[…]}) が担い、
// 固定数の不足は既定で best-effort。all-or-nothing の「そうした場合」はカード側が
// minimumPolicy:'exact' を明示し、共通 pick producer が判定する。
export function atomPartnerAreaRemove(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      const paP = resolvePlayer(a.player, ctx);
      const paArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.partnerAreaRemove.defaultArea, a, paP, a.player as Player) }
        : a;
      const resolvedTarget = Array.isArray(paArgs.target)
        ? paArgs.target
        : Array.isArray((paArgs as { cardIds?: unknown }).cardIds)
          ? (paArgs as { cardIds: unknown[] }).cardIds.filter((cardId): cardId is string => typeof cardId === 'string')
          : null;
      if (resolvedTarget === null) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, { byPlayer: ctx.source.player, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: paP, turn: s.turn.number, action: 'effect:partnerAreaRemove:awaiting-pick' });
        return;
      }
      const target = resolvedTarget;
      const hasExactOccurrences = Object.hasOwn(paArgs, 'selectedCardOccurrences');
      const selectedOccurrences = exactSelectedCardOccurrences(
        (paArgs as { selectedCardOccurrences?: unknown }).selectedCardOccurrences,
        ctx,
      );
      if (hasExactOccurrences) {
        const occurrenceKeys = selectedOccurrences?.map((entry) => `${entry.player}:${entry.area}:${entry.index}`) ?? [];
        const valid = selectedOccurrences !== null
          && selectedOccurrences.length === target.length
          && new Set(occurrenceKeys).size === occurrenceKeys.length
          && selectedOccurrences.every((entry, position) => entry.player === paP
            && entry.area === 'partner-area'
            && entry.cardId === target[position]
            && s.players[entry.player].partnerAreaCards?.[entry.index] === entry.cardId);
        if (!valid) {
          mutate.log.append(s, { ts: Date.now(), player: paP, turn: s.turn.number, action: 'effect:partnerAreaRemove', result: 'stale-selection' });
          return;
        }
        for (const [position, occurrence] of selectedOccurrences.entries()) {
          const priorFromSameArea = selectedOccurrences.slice(0, position)
            .filter((previous) => previous.player === occurrence.player
              && previous.area === occurrence.area
              && previous.index < occurrence.index).length;
          if (!mutate.partner.removeAreaCardToRemoveAt(s, occurrence.player, occurrence.cardId, occurrence.index - priorFromSameArea)) {
            // The complete preflight above makes this reachable only after an
            // observer mutation.  Do not fall back to a same-cardId copy.
            mutate.log.append(s, { ts: Date.now(), player: paP, turn: s.turn.number, action: 'effect:partnerAreaRemove', result: 'stale-selection' });
            return;
          }
        }
      } else {
        mutate.partner.removeAreaCardsToRemove(s, paP, target);
      }
      // discard/handReveal と同型: リムーブした cardId を bind (後続 chain step が $removed 等で参照可)。
      if (typeof a.bind === 'string' && target.length > 0) {
        (ctx.bindings as Record<string, unknown>)[a.bind] = target.map((cardId) => ({ cardId }));
      }
      // 0枚 (候補無し or 辞退) → chainStepNoApply で「そうした場合」を gate (mill/handReveal 同型)。
      if (target.length === 0) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
      }
      mutate.log.append(s, { ts: Date.now(), player: paP, turn: s.turn.number, action: 'effect:partnerAreaRemove', result: String(target.length) });
      return;
    }

export function atomMill(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-073: effect log
      const millP = resolvePlayer(a.player, ctx);
      // M2後半 (2026-07-10, PR265): n:{dyn:'$bound.<key>.level'} を handler-local で解決
      // (「そのカードのレベルと同じ枚数リムーブする」)。chain 経路は pre-walk (resolveDynArgs) を
      // 通らず、前段 bind は実行時確定のため handler 側で数値化する (souza x:{dyn} / atomDraw と同型。
      // number は素通り = 既存 literal 消費者 byte 互換)。
      const millN = typeof a.n === 'number' ? a.n : resolveDeltaToNumber(a.n, s, ctx);
      // deck-mill-gated-chain wave (2026-06-23): gate:true は「上からN枚リムーブする」が実行不能
      // (deck<N) のとき何もリムーブせず chainStepNoApply を立て、chain (「そうした場合」) を break する。
      // 公式Q&A (B01044/B03094/B05061/B06016): 「N枚リムーブが実行できない場合、それ以降の効果は
      // 解決できません」= all-or-nothing gate。filePopToHand / evidenceToHand と同型の chain-break パターン。
      // gate 未指定/false は従来挙動 (可能な限りリムーブ + refresh、B09064/B09104) を完全保持 = 回帰0。
      if (a.gate === true && s.players[millP].deck.length < millN) {
        (ctx.dyn ??= {}).chainStepNoApply = true; // Phase 3c: chain break 信号を ctx.dyn へ (resolver chain case が読む)
        mutate.log.append(s, { ts: Date.now(), player: millP, turn: s.turn.number, action: 'effect:mill', result: 'gate-skip' });
        return;
      }
      const millRemoved = mutate.deck.removeFromTop(s, millP, millN);
      recordPublicZoneMove(s, ctx, millP, 'deck', 'remove', millRemoved.length);
      // engine defer-unlock mini-wave (2026-07-09): 「これによって〜がリムーブされた場合」(PR132/PR201) 用に
      // リムーブした cardId を bind (discard/handReveal/partnerAreaRemove と同型)。refresh より前に確定 —
      // binding は cardId snapshot なので refresh でデッキへ戻っても boundAnyMatchesFilter (印字値評価) は不変。
      if (typeof a.bind === 'string' && millRemoved.length > 0) {
        (ctx.bindings as Record<string, unknown>)[a.bind] = millRemoved.map((cardId) => ({ cardId }));
      }
      // BUG-137 (wave#2 cluster2, 2026-06-12): デッキ枯渇時の refresh guard が欠落していた。
      // rules/14 (デッキ 0 で即座に refresh) + rules/26 (可能な限りリムーブ → refresh →
      // 残り分は追加リムーブしない)。B09104 qAndA「可能な限りリムーブし、その後リフレッシュを行います」。
      // n=0 is not a deck take. For n>0, also resolve an already-empty
      // adversarial state (removed=0) as the pre-existing BUG-137 contract.
      if (millN > 0) {
        refreshDeckForEffect(s, millP, ctx);
      }
      mutate.log.append(s, { ts: Date.now(), player: millP, turn: s.turn.number, action: 'effect:mill', result: String(millRemoved.length) });
      return;
    }

export function atomFileAdd(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-073: effect log
      const faP = resolvePlayer(a.player, ctx);
      const faN = a.n as number;
      const causalSteps: DeckTransferCausalStep[] = [];
      // BUG-180: the mutator owns both between-card and exact-final refresh.
      // Preserve a normal event/hirameki source that is only eagerly represented
      // in remove while its effect is still resolving (rules/14, rules/26).
      const fileAdded = mutate.file.addFromDeckTop(
        s,
        faP,
        faN,
        resolvingEventCardId(ctx, faP),
        (step) => appendDeckTransferCausalStep(causalSteps, step),
      );
      for (const step of causalSteps) {
        if (step.kind === 'refresh') recordDeckRefresh(s, ctx, faP, step.count);
        else recordPublicZoneMove(s, ctx, faP, 'deck', 'file', step.count);
      }
      mutate.log.append(s, { ts: Date.now(), player: faP, turn: s.turn.number, action: 'effect:fileAdd', result: String(fileAdded) });
      return;
    }

export function atomFilePopToHand(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const p = resolvePlayer(a.player, ctx);
      // mini-wave #3 (2026-07-10): n (既定 1) + gate (all-or-nothing、B03110「FILEエリアのカードを上から
      // 2枚手札に加える」= 2枚揃わなければ以降解決不可 QA)。poppable = アシストパートナー除外後の枚数
      // (popTop の skip 対象と同一集合)。n=1・gate 無しは従来経路 byte 互換。
      const fpN = typeof a.n === 'number' ? a.n : 1;
      if (fpN !== 1 || a.gate === true) {
        const poppable = s.players[p].file.filter((f) => f.type !== 'assisted-partner').length;
        if (a.gate === true && poppable < fpN) {
          (ctx.dyn ??= {}).chainStepNoApply = true;
          mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:filePopToHand', result: `gate-fail (${poppable}<${fpN})` });
          return;
        }
        let fpMoved = 0;
        for (let i = 0; i < fpN; i++) {
          const fpc = mutate.file.popTop(s, p);
          if (!fpc) break;
          mutate.hand.add(s, p, [fpc.cardId]);
          event.emit(s, 'file:pop', { player: p, popped: fpc }, { player: p });
          fpMoved++;
        }
        if (fpMoved === 0) (ctx.dyn ??= {}).chainStepNoApply = true;
        recordPublicZoneMove(s, ctx, p, 'file', 'hand', fpMoved);
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:filePopToHand', result: `n=${fpN} moved=${fpMoved}` });
        return;
      }
      const popped: FileCard | undefined = mutate.file.popTop(s, p);
      // BUG-128 (Task D E3, 2026-06-12): FileCard.card-back は Round 3 から実 cardId を保持して
      // いる (next-hint.ts:66-74 は修正済) のに、本 verb は placeholder 'card-back' を手札に
      // push する stale 実装だった。実 cardId を加え、next-hint と同じ 'file:pop' を emit する。
      // popped 無し (FILE 空 or アシストパートナーのみ) は「そうした場合」不成立 = chain break
      // (PR100/B04068 公式Q&A: FILE に無ければ以降の効果は解決できない)。
      if (popped) {
        mutate.hand.add(s, p, [popped.cardId]);
        event.emit(s, 'file:pop', { player: p, popped }, { player: p });
      } else {
        (ctx.dyn ??= {}).chainStepNoApply = true; // Phase 3c: chain break 信号を ctx.dyn へ (resolver chain case が読む)
      }
      recordPublicZoneMove(s, ctx, p, 'file', 'hand', popped ? 1 : 0);
      // BUG-073: effect log (popped が無い場合も log には残す)
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:filePopToHand', result: popped ? 'moved=1' : 'none' });
      return;
    }

export function atomFileRemoveTop(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // Task D E3 (2026-06-12): FILE 上から n 枚を FILE 所有者のリムーブエリアへ。
      // rules/03 (リムーブエリア) / rules/05 (末尾が最上)。アシストパートナーは popTop が
      // 自動 skip (B09010/B09108/B09111 Q&A「パートナーカードを除いて」)。
      // 1 枚もリムーブできなければ chain break (B09105 Q&A「以降の効果は解決できない」)。
      // bind 指定でリムーブした cardId 群を ctx.bindings へ (discard a.bind と同流儀)。
      const frP = resolvePlayer(a.player, ctx);
      const frN = requireField<number>(a, 'n', 'number');
      const removedIds: string[] = [];
      for (let i = 0; i < frN; i++) {
        const popped = mutate.file.popTop(s, frP);
        if (!popped) break;
        removedIds.push(popped.cardId);
      }
      if (removedIds.length > 0) {
        mutate.remove.add(s, frP, removedIds);
      } else {
        (ctx.dyn ??= {}).chainStepNoApply = true; // Phase 3c: chain break 信号を ctx.dyn へ (resolver chain case が読む)
      }
      // S1 wave (2026-07-11, B09105): requireExact (opt-in) — 「FILE を上から N 枚リムーブしてもよい。
      // そうした場合〜」で N 枚に満たない場合は後続を gate (公式Q&A: FILE 1枚では以降の効果を解決
      // できない)。リムーブ自体は可能な限り行う (rules/15「可能な限り」、Q&A は以降の解決のみ否定)。
      // 既存 consumer は未宣言 → 0枚 break のみの従来挙動 byte 互換。
      if ((a as { requireExact?: boolean }).requireExact === true && removedIds.length < frN) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
      }
      if (typeof a.bind === 'string') {
        (ctx.bindings as Record<string, unknown[]>)[a.bind] =
          removedIds.map(cardId => ({ kind: 'card', cardId, area: 'remove', player: frP }));
      }
      recordPublicZoneMove(s, ctx, frP, 'file', 'remove', removedIds.length);
      mutate.log.append(s, { ts: Date.now(), player: frP, turn: s.turn.number, action: 'effect:fileRemoveTop', result: removedIds.join(',') || 'none' });
      return;
    }

export function atomFileFlipTop(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // Task D E3 (2026-06-12): FILE 最上位の非パートナーを表向き化 (B09021/B09108/B09023/B09005)。
      // 既に表向き / FILE 空は no-op。⚠ flip 不発でも chain break しない
      // (B09021 Q&A: 表向きにできなくても後続の AP+1000 は実行可 — fileRemoveTop と非対称)。
      const ffP = resolvePlayer(a.player, ctx);
      let ffIndex = -1;
      for (let index = s.players[ffP].file.length - 1; index >= 0; index -= 1) {
        if (s.players[ffP].file[index]?.type !== 'assisted-partner') {
          ffIndex = index;
          break;
        }
      }
      const ffResult = mutate.file.flipTop(s, ffP);
      if (ffResult === 'flipped' && ffIndex >= 0) {
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: 'face-change',
          source: { kind: 'zone', side: ffP, zone: 'file' },
          targets: [{ kind: 'file-card', side: ffP, index: ffIndex }],
          outcome: { type: 'face-change', from: 'face-down', to: 'face-up', count: 1 },
        });
      }
      mutate.log.append(s, { ts: Date.now(), player: ffP, turn: s.turn.number, action: 'effect:fileFlipTop', result: ffResult });
      return;
    }

export function atomEvidenceGain(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const p = resolvePlayer(a.player, ctx);
      const n = a.n as number;
      const causalSteps: DeckTransferCausalStep[] = [];
      // BUG-180: one mutator call owns all refresh checkpoints, including exact
      // final exhaustion. faceUp remains a direct argument (B06085).
      const egGained = mutate.evidence.addFromDeck(
        s,
        p,
        n,
        a.faceUp === true,
        { turn: s.turn.number, via: 'effect' },
        resolvingEventCardId(ctx, p),
        (step) => appendDeckTransferCausalStep(causalSteps, step),
      );
      for (const step of causalSteps) {
        if (step.kind === 'refresh') {
          recordDeckRefresh(s, ctx, p, step.count);
        } else {
          recordEffectCausalOperation(s, ctx, {
            actor: ctx.source.player,
            kind: 'evidence',
            source: { kind: 'zone', side: p, zone: 'deck' },
            targets: [{ kind: 'zone', side: p, zone: 'evidence' }],
            outcome: { type: 'move', from: 'deck', to: 'evidence', count: step.count },
          });
        }
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceGain', result: String(egGained) });
      return;
    }

export function atomSelfToEvidence(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // 「このカードを表向きのまま証拠として得る」(rules/01 §必要証拠数 / rules/06 §イベント)。
      // イベント使用後 handUseCard が当該カードをリムーブへ置くので、リムーブ→証拠 へ移す。
      // ctx.source.cardId = 使用したイベント自身、ctx.source.player = 使用者。
      const steP = resolvePlayer((a.player as 'self' | 'opp' | undefined) ?? 'self', ctx);
      const steCardId = ctx.source.cardId;
      if (typeof steCardId !== 'string' || steCardId.length === 0) return;
      const steFaceUp = a.faceUp === undefined ? true : a.faceUp === true;
      const steEvidenceBefore = s.players[steP].evidence.length;
      mutate.evidence.gainCard(s, steP, steCardId, steFaceUp, {
        turn: s.turn.number, via: 'effect', sourceCardId: steCardId,
      });
      recordPublicZoneMove(
        s,
        ctx,
        steP,
        'remove',
        'evidence',
        s.players[steP].evidence.length === steEvidenceBefore + 1 ? 1 : 0,
        'evidence',
      );
      mutate.log.append(s, { ts: Date.now(), player: steP, turn: s.turn.number, action: 'effect:selfToEvidence', target: steCardId, result: steFaceUp ? '表向き' : '裏向き' });
      return;
    }

export function atomToPartnerArea(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // 「このカードをパートナーエリアに移す」(rules/03 §パートナーエリア、engine wave-12 G39)。
      // selfToEvidence と同型の deterministic self 経路 (pick 不要): イベント使用後 handUseCard /
      // next-hint が当該カードをリムーブへ置き、hirameki も evidence.removeTop が remove へ移動済 →
      // どちらの経路でも解決時カードは owner の remove 内。mutate.partner.addAreaCardFromRemove が
      // lastIndexOf splice + 不在 no-op (B06026 Q&A 同型) + remove:exit emit + PA push (上限なし) を行う。
      // ctx.source.cardId = 当該カード自身、ctx.source.player = 使用者/証拠所有者。
      const tpaP = resolvePlayer((a.player as 'self' | 'opp' | undefined) ?? 'self', ctx);
      // Cluster WB1 (2026-07-11, B07030 a1後段 / B07061): pick-form — 「リムーブエリアにある〚特徴
      //   [ビッグジュエル]〛を1枚まで選び、PAに移す」。removeAreaToDeckTop と同型 (PB pick + sourceSplice)、
      //   dest = PA (addAreaCardFromRemove が remove splice + remove:exit emit + PA push を行う)。target/n/max
      //   があれば pick-form、無ければ従来の自己移動形 (args:{}、B07059/B07060/PR195 等) = byte 互換。
      if (a.target !== undefined || hasNorMax(a)) {
        const tpaArgs = (a.target === undefined && hasNorMax(a))
          ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.toPartnerArea!.defaultArea, a, tpaP, a.player as Player) }
          : a;
        const tpaTarget0 = normalizeTargetToString(tpaArgs.target);
        const tpaTarget = typeof tpaTarget0 === 'string' ? resolveBindRef(tpaTarget0, ctx) : tpaTarget0;
        const tpaBoundOccurrence = resolveBoundOccurrenceRef(tpaTarget0, s, ctx, tpaP, 'remove');
        if (tpaBoundOccurrence.kind === 'invalid'
          || (tpaBoundOccurrence.kind === 'live' && tpaTarget !== tpaBoundOccurrence.cardId)) {
          setCardMoveBinding(ctx, tpaArgs.bind, []);
          (ctx.dyn ??= {}).chainStepNoApply = true;
          return;
        }
        if (typeof tpaTarget !== 'string' || !tpaTarget) {
          tryRePickFromAtom(s, { kind: 'atom', verb, args: tpaArgs }, ctx, { byPlayer: tpaP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
          mutate.log.append(s, { ts: Date.now(), player: tpaP, turn: s.turn.number, action: 'effect:toPartnerArea:awaiting-pick' });
          return;
        }
        const rawSelectedIndex = resolveBindRef((tpaArgs as { selectedCardIndex?: unknown }).selectedCardIndex, ctx);
        const hasExactSelectedIndex = Object.hasOwn(tpaArgs, 'selectedCardIndex');
        const exactSelectedIndex = typeof rawSelectedIndex === 'number' && Number.isInteger(rawSelectedIndex) && rawSelectedIndex >= 0
          ? rawSelectedIndex
          : undefined;
        const tpaPhysicalIndex = tpaBoundOccurrence.kind === 'live' ? tpaBoundOccurrence.index : undefined;
        const tpaIndexMismatch = tpaPhysicalIndex !== undefined
          && hasExactSelectedIndex
          && exactSelectedIndex !== tpaPhysicalIndex;
        const tpaMoveIndex = tpaPhysicalIndex ?? exactSelectedIndex;
        const partnerIndex = s.players[tpaP].partnerAreaCards?.length ?? 0;
        const tpaPicked = tpaIndexMismatch || (hasExactSelectedIndex && exactSelectedIndex === undefined)
          ? false
          : mutate.partner.addAreaCardFromRemove(s, tpaP, tpaTarget, tpaMoveIndex);
        setCardMoveBinding(ctx, tpaArgs.bind, tpaPicked
          ? [{ cardId: tpaTarget, area: 'partner-area', player: tpaP, index: partnerIndex }]
          : []);
        recordPublicZoneMove(s, ctx, tpaP, 'remove', 'partner', tpaPicked ? 1 : 0);
        // 0枚 (skip/不在) → chain gate (removeAreaToDeckTop と同型、「してもよい。そうした場合」対応)。
        if (!tpaPicked) (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, { ts: Date.now(), player: tpaP, turn: s.turn.number, action: 'effect:toPartnerArea', target: tpaTarget, result: tpaPicked ? 'ok' : 'not-found' });
        return;
      }
      const heldClaim = readHeldHiramekiSelfClaim(ctx, tpaP);
      if (heldClaim.kind === 'invalid') {
        setCardMoveBinding(ctx, a.bind, []);
        (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, { ts: Date.now(), player: tpaP, turn: s.turn.number, action: 'effect:toPartnerArea', result: 'invalid-held-authority' });
        return;
      }
      const tpaCardId = heldClaim.kind === 'claim' ? heldClaim.claim.cardId : ctx.source.cardId;
      if (typeof tpaCardId !== 'string' || tpaCardId.length === 0) return;
      const partnerIndex = s.players[tpaP].partnerAreaCards?.length ?? 0;
      const moved = heldClaim.kind === 'claim'
        ? mutate.evidence.takeHeldHiramekiEvidence(s, heldClaim.claim) !== undefined
        : mutate.partner.addAreaCardFromRemove(s, tpaP, tpaCardId);
      if (moved && heldClaim.kind === 'claim') mutate.partner.addAreaCard(s, tpaP, tpaCardId);
      setCardMoveBinding(ctx, a.bind, moved
        ? [{ cardId: tpaCardId, area: 'partner-area', player: tpaP, index: partnerIndex }]
        : []);
      recordPublicZoneMove(s, ctx, tpaP, heldClaim.kind === 'claim' ? 'evidence' : 'remove', 'partner', moved ? 1 : 0);
      if (!moved) (ctx.dyn ??= {}).chainStepNoApply = true;
      if (moved) {
        mutate.log.append(s, { ts: Date.now(), player: tpaP, turn: s.turn.number, action: 'effect:toPartnerArea', target: tpaCardId });
      }
      return;
    }

export function atomEvidenceLose(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const p = resolvePlayer(a.player, ctx);
      const n = a.n as number;
      let lost = 0;
      for (let i = 0; i < n; i++) {
        const removed = mutate.evidence.removeTop(s, p);
        if (!removed) break;
        lost++;
      }
      recordPublicZoneMove(s, ctx, p, 'evidence', 'remove', lost, 'evidence');
      // BUG-073: effect log (実際にロストした枚数を記録)
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceLose', result: String(lost) });
      return;
    }

export function atomEvidenceToDeck(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // 2026-06-06 タスクC: 証拠最上部 n 枚をデッキ上へ戻す (B03038「この推理によって証拠を得ない」)。
      // net で「証拠 0・デッキ復元」(rules/11 §LP≤0 と同じ状態)。n は number か $trigger.gained
      // (= 推理で得た枚数 payload.gained) を resolveBindRef で解決。
      const etdP = resolvePlayer(a.player, ctx);
      const nRaw = resolveBindRef(a.n, ctx);
      const etdN = typeof nRaw === 'number' ? nRaw : 0;
      const moved = mutate.evidence.toDeckTop(s, etdP, etdN);
      recordPublicZoneMove(s, ctx, etdP, 'evidence', 'deck', moved, 'evidence');
      mutate.log.append(s, { ts: Date.now(), player: etdP, turn: s.turn.number, action: 'effect:evidenceToDeck', result: String(moved) });
      return;
    }

export function atomEvidenceFlip(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // ① 旧 idx 固定形 (後方互換): { player, idx } を直接 flip。
      if (typeof a.idx === 'number') {
        const efP = resolvePlayer(a.player, ctx);
        const changed = s.players[efP].evidence[a.idx]?.faceUp === false;
        mutate.evidence.flipFaceUp(s, efP, a.idx);
        recordEvidenceFaceChange(s, ctx, efP, 'face-down', 'face-up', changed ? 1 : 0);
        // BUG-073: effect log
        mutate.log.append(s, { ts: Date.now(), player: efP, turn: s.turn.number, action: 'effect:evidenceFlip', target: String(a.idx) });
        return;
      }
      // engine拡張 wave (2026-06-23): evidence-flip-faceup 有効化。a.player = 表向きにする証拠の owner
      // ('opp'=相手の証拠 をスカウト)。chooser/picker は常に controller (ctx.source.player)。
      const flipP = resolvePlayer(a.player, ctx);
      // engine E3 P53 (2026-07-03): all = 「(自分の)証拠をすべて表向きにする」(B09107)。選択なし、全 idx faceUp 化。
      // 順序不変 (flipFaceUp は faceUp フラグのみ true 化)。証拠 0 枚は no-op。
      if (a.all === true) {
        const evList = s.players[flipP].evidence;
        const changed = evList.filter((evidence) => !evidence.faceUp).length;
        for (let i = 0; i < evList.length; i++) mutate.evidence.flipFaceUp(s, flipP, i);
        recordEvidenceFaceChange(s, ctx, flipP, 'face-down', 'face-up', changed);
        mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', target: 'all', result: evList.length === 0 ? 'none' : 'ok' });
        return;
      }
      // ② fromTop = 「(相手の)証拠を上から1つ表向きにする」(B03076)。上から=末尾 (removeTop と整合)、選択なし。
      if (a.fromTop === true) {
        const evList = s.players[flipP].evidence;
        if (evList.length === 0) {
          mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', result: 'none' });
          return;
        }
        const topIdx = evList.length - 1;
        const changed = evList[topIdx]?.faceUp === false;
        mutate.evidence.flipFaceUp(s, flipP, topIdx);
        recordEvidenceFaceChange(s, ctx, flipP, 'face-down', 'face-up', changed ? 1 : 0);
        mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', target: String(topIdx), result: 'ok' });
        return;
      }
      // mega-wave W5 (2026-07-03, r38): max の {dyn} 短縮形を handler local で literalize
      // (B08028「この効果によって表向きにした枚数と同じ数まで」= max:{dyn:'$bound.$flipped.count'})。
      // 共有 helper (hasNorMax/buildShortFormPick) は byte 不変 — 未解決 {dyn} が他 atom へ漏れる
      // footgun を封じ込め (本 handler だけが dyn-max を知る)。解決後 max<=0 は「0枚まで選ぶ」= no-op
      // (mirror-count 0 で pick を出さない、rules/15「〜まで」0可)。
      const ctrl = ctx.source.player;
      const aResolved = isDynObject(a.max) ? { ...a, max: resolveDynNumber(a.max, s, ctx) } : a;
      if (isDynObject(a.max) && (aResolved.max as number) <= 0) {
        mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', target: 'dyn-max-0', result: 'none' });
        return;
      }
      // ③-multi (r38): cardIds 契約 = evidenceFlipDown ①② の faceDown/flipFaceUp 版 clone。
      //   ① cardIds:'$pick.cardIds' 未解決 → short-form なら target を構築して side-channel enqueue
      //   ② cardIds 配列 (resolved) → 各 cardId の裏向き証拠を 1 枚ずつ表向き + bind writeback
      const rawCardIds = (aResolved as { cardIds?: unknown }).cardIds;
      if (rawCardIds === '$pick.cardIds') {
        // decline (0枚 skip、applyPickSkipAndContinuation runDeclinedAtom=true 経路): flip 0 で解決。
        // bind は空配列を書く — $bound.<key>.count が 0 を返し、後続 mirror step (B08028 step2) が
        // 正しく no-op になる (unbound のままだと defensive 0 だが、明示 [] で「0枚 flip した」を記録)。
        if ((aResolved as { __declined?: unknown }).__declined === true) {
          if (typeof aResolved.bind === 'string') {
            (ctx.bindings as Record<string, unknown>)[aResolved.bind] = [];
          }
          mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', target: 'declined', result: '0' });
          return;
        }
        const mTarget = (aResolved.target && typeof aResolved.target === 'object')
          ? aResolved.target
          : (hasNorMax(aResolved) ? buildShortFormPick(ATOM_PICK_SPEC.evidenceFlip.defaultArea, aResolved, ctrl, (aResolved.player as Player) ?? 'opp') : undefined);
        if (mTarget) {
          tryRePickFromAtom(s, { kind: 'atom', verb, args: { ...aResolved, target: mTarget } }, ctx, {
            byPlayer: ctrl,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: ctrl, turn: s.turn.number, action: 'effect:evidenceFlip:awaiting-pick' });
        }
        return;
      }
      if (Array.isArray(rawCardIds)) {
        const evl = s.players[flipP].evidence;
        const cardIds = rawCardIds.filter((cardId): cardId is string => typeof cardId === 'string');
        const exactIndexes = exactEvidenceOccurrenceIndexes(s, aResolved, ctx, flipP, cardIds);
        if (exactIndexes === null) {
          if (typeof aResolved.bind === 'string') (ctx.bindings as Record<string, unknown>)[aResolved.bind] = [];
          mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', result: 'stale-selection' });
          return;
        }
        const flipped: Array<{ kind: 'card'; uid: string; cardId: string; area: 'evidence'; player: Player; index: number; occurrenceWitness?: string }> = [];
        for (const [position, cid] of cardIds.entries()) {
          const exactIndex = exactIndexes?.[position];
          const i = exactIndex === undefined
            ? evl.findIndex(e => e.cardId === cid && !e.faceUp)
            : (evl[exactIndex]?.cardId === cid && !evl[exactIndex]!.faceUp ? exactIndex : -1);
          if (i !== -1) {
            mutate.evidence.flipFaceUp(s, flipP, i);
            flipped.push({ kind: 'card', uid: `evidence:${flipP}:${i}`, cardId: cid, area: 'evidence', player: flipP, index: i });
          }
        }
        const occurrenceWitness = cardOccurrenceWitness(s, flipP, 'evidence');
        for (const occurrence of flipped) occurrence.occurrenceWitness = occurrenceWitness;
        // bind writeback (core.ts 他 atom の a.bind idiom と同一行形): 実際に flip した分のみ。
        // $bound.<key>.count が「この効果によって表向きにした枚数」を正確に映す (B08028)。
        if (typeof aResolved.bind === 'string') {
          (ctx.bindings as Record<string, unknown>)[aResolved.bind] = flipped;
        }
        recordEvidenceFaceChange(s, ctx, flipP, 'face-down', 'face-up', flipped.length);
        mutate.log.append(s, {
          ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip',
          target: flipped.map(({ cardId }) => cardId).join(','), result: rawCardIds.length === 0 ? '0' : (flipped.length ? 'ok' : 'not-found'),
        });
        return;
      }
      // ③ pick 形 = 「(相手の)裏向きの証拠を N つまで選び、表向きにする」。chooser=controller、
      //    candidate area side = a.side(既定は a.player) で証拠 owner を指す、faceDown=裏向き限定。
      const efArgs = (aResolved.target === undefined && hasNorMax(aResolved))
        ? { ...aResolved, target: buildShortFormPick(ATOM_PICK_SPEC.evidenceFlip.defaultArea, aResolved, ctrl, (aResolved.player as Player) ?? 'opp') }
        : aResolved;
      const target0 = normalizeTargetToString(efArgs.target);
      const resolvedTarget = typeof target0 === 'string' ? resolveBindRef(target0, ctx) : target0;
      const target = typeof resolvedTarget === 'string' ? resolvedTarget : undefined;
      const boundOccurrence = resolveBoundOccurrenceRef(target0, s, ctx, flipP, 'evidence');
      const exactIndexes = typeof target === 'string'
        ? exactEvidenceOccurrenceIndexes(s, efArgs, ctx, flipP, [target])
        : undefined;
      if (boundOccurrence.kind === 'invalid' || exactIndexes === null
        || (boundOccurrence.kind === 'live' && (target !== boundOccurrence.cardId
          || (exactIndexes !== undefined && exactIndexes[0] !== boundOccurrence.index)))) {
        mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', result: 'stale-selection' });
        return;
      }
      if (!target) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: efArgs }, ctx, { byPlayer: ctrl, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: ctrl, turn: s.turn.number, action: 'effect:evidenceFlip:awaiting-pick' });
        return;
      }
      // pick で選ばれた cardId に対応する裏向き証拠を表向きに (同 cardId 複数は等価、evidenceToHand と同型)。
      const list = s.players[flipP].evidence;
      const physicalIndex = exactIndexes?.[0] ?? (boundOccurrence.kind === 'live' ? boundOccurrence.index : undefined);
      const idx = physicalIndex === undefined
        ? list.findIndex(e => e.cardId === target && !e.faceUp)
        : (list[physicalIndex]?.cardId === target && !list[physicalIndex]!.faceUp ? physicalIndex : -1);
      let flipped = false;
      if (idx !== -1) { mutate.evidence.flipFaceUp(s, flipP, idx); flipped = true; }
      recordEvidenceFaceChange(s, ctx, flipP, 'face-down', 'face-up', flipped ? 1 : 0);
      mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', target, result: flipped ? 'ok' : 'not-found' });
      return;
    }

// engine additive A2 (2026-07-11, B03040 和田進一): peekOwnEvidence — 「自分の証拠を上から1つ見る。
// （裏向きの証拠を見た場合、その後、元に戻す）」= 状態変化を伴わない私的閲覧 (evidenceFlip の「表向きに
// 固定」とは意味が正反対 — 永続 flip ではなく peek のみ)。zone/faceUp 完全不変。UI へ private 通知する
// のみ (log entry で表現)。証拠 0 枚は no-op。fromTop = 末尾 = 1番上 (evidence push=末尾=最上部)。
export function atomPeekOwnEvidence(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, _verb: AtomVerb): void {
  const p = resolvePlayer(a.player, ctx); // 既定 self (「自分の証拠」)
  const evList = s.players[p].evidence;
  if (evList.length === 0) {
    mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidencePeek', result: 'none' });
    return;
  }
  const top = evList[evList.length - 1];
  mutate.log.append(s, {
    ts: Date.now(), player: p, turn: s.turn.number,
    action: 'effect:evidencePeek', target: top.cardId, result: top.faceUp ? 'faceUp' : 'faceDown',
    targetAudience: top.faceUp ? undefined : p,
  });
}

// engine拡張 wave (2026-06-23): evidenceFlipDown — 「自分の表向きの証拠を N つまで選び、裏向きにする」
// (evidenceFlip=表向き化 の逆 mutate)。atomHandAddFromRemove と同型の 3-path:
//   ① cardIds:'$pick.cardIds' 未解決 (await) → tryRePickFromAtom で side-channel pick を enqueue
//   ② cardIds 配列 (resolved multi) → 各 cardId の表向き証拠を 1 枚ずつ裏向きに (B05013 enter「2つまで」)
//   ③ 単一 short-form (max:1) → buildShortFormPick (faceUp 候補限定) → 1 枚裏向きに (各 hira「1つまで」)
// flipP = 裏向きにする証拠の owner (a.player 既定 self、全 4 枚「自分の」)。chooser/picker は controller。
// 順番不変 (B05013 Q&A): flipFaceDown は faceUp フラグのみ false 化 (配列位置は不変)。
export function atomEvidenceFlipDown(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      const flipP = resolvePlayer(a.player, ctx); // 既定 self
      const ctrl = ctx.source.player ?? 'self';
      const rawCardIds = (a as { cardIds?: unknown }).cardIds;
      // ① multi-pick contract 未解決 (human await): side-channel に pick を queue して return。
      if (rawCardIds === '$pick.cardIds') {
        if (a.target && typeof a.target === 'object') {
          tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, {
            byPlayer: ctrl,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: ctrl, turn: s.turn.number, action: 'effect:evidenceFlipDown:awaiting-pick' });
        }
        return;
      }
      // ② multi-pick 解決済 (0〜max 枚): 各 cardId の表向き証拠を 1 枚ずつ裏向きに。
      //   同 cardId 複数の場合も flipFaceDown で faceUp=false 化されるため次 findIndex が別個体を拾う (index-based uid と整合)。
      if (Array.isArray(rawCardIds)) {
        const list = s.players[flipP].evidence;
        const cardIds = rawCardIds.filter((cardId): cardId is string => typeof cardId === 'string');
        const exactIndexes = exactEvidenceOccurrenceIndexes(s, a, ctx, flipP, cardIds);
        if (exactIndexes === null) {
          mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlipDown', result: 'stale-selection' });
          return;
        }
        const flippedIds: string[] = [];
        for (const [position, cid] of cardIds.entries()) {
          const exactIndex = exactIndexes?.[position];
          const i = exactIndex === undefined
            ? list.findIndex(e => e.cardId === cid && e.faceUp)
            : (list[exactIndex]?.cardId === cid && list[exactIndex]!.faceUp ? exactIndex : -1);
          if (i !== -1) { mutate.evidence.flipFaceDown(s, flipP, i); flippedIds.push(cid); }
        }
        recordEvidenceFaceChange(s, ctx, flipP, 'face-up', 'face-down', flippedIds.length);
        mutate.log.append(s, {
          ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlipDown',
          target: flippedIds.join(','), result: rawCardIds.length === 0 ? '0' : (flippedIds.length ? 'ok' : 'not-found'),
        });
        return;
      }
      // ③ 単一 short-form (max:1): target 未指定なら verb 既定 area (evidence) で faceUp 候補 pick を構築。
      const efArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.evidenceFlipDown.defaultArea, a, ctrl, (a.player as Player) ?? 'self') }
        : a;
      const target0 = normalizeTargetToString(efArgs.target);
      const resolvedTarget = typeof target0 === 'string' ? resolveBindRef(target0, ctx) : target0;
      const target = typeof resolvedTarget === 'string' ? resolvedTarget : undefined;
      const boundOccurrence = resolveBoundOccurrenceRef(target0, s, ctx, flipP, 'evidence');
      const exactIndexes = typeof target === 'string'
        ? exactEvidenceOccurrenceIndexes(s, efArgs, ctx, flipP, [target])
        : undefined;
      if (boundOccurrence.kind === 'invalid' || exactIndexes === null
        || (boundOccurrence.kind === 'live' && (target !== boundOccurrence.cardId
          || (exactIndexes !== undefined && exactIndexes[0] !== boundOccurrence.index)))) {
        mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlipDown', result: 'stale-selection' });
        return;
      }
      if (!target) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: efArgs }, ctx, { byPlayer: ctrl, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: ctrl, turn: s.turn.number, action: 'effect:evidenceFlipDown:awaiting-pick' });
        return;
      }
      const list = s.players[flipP].evidence;
      const physicalIndex = exactIndexes?.[0] ?? (boundOccurrence.kind === 'live' ? boundOccurrence.index : undefined);
      const idx = physicalIndex === undefined
        ? list.findIndex(e => e.cardId === target && e.faceUp)
        : (list[physicalIndex]?.cardId === target && list[physicalIndex]!.faceUp ? physicalIndex : -1);
      let flipped = false;
      if (idx !== -1) { mutate.evidence.flipFaceDown(s, flipP, idx); flipped = true; }
      recordEvidenceFaceChange(s, ctx, flipP, 'face-up', 'face-down', flipped ? 1 : 0);
      mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlipDown', target, result: flipped ? 'ok' : 'not-found' });
      return;
    }

export function atomEvidenceToHand(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // BUG-074: BUG-065 で resolve-picks が target を array 化 (`[cardId]`) する設計に
      // 変更されたため、string|array 両対応に正規化。未解決の pick query object の場合は
      // awaiting-pick として skip + log (D08013 a1 step 2 等で発覚)。
      // BUG-076: awaiting-pick 時に resolve-picks の tryRePickFromAtom を呼んで、
      // 残り atom 用に side-channel を再 set。これで sequence 内の連続 pattern B atom
      // が順次 modal を出せる (D08013 a1 step 2 → step 3 の連鎖)。
      // 物理動作 atom 化: { player, n } の省略形を受け取れるよう default pick target で補完
      const p = resolvePlayer(a.player, ctx);
      // engine拡張 wave (2026-06-21): fromTop = 「証拠を上から1つ手札に加え」(B03077) の deterministic top。
      // pick path をスキップし証拠スタック最上 (末尾=1番上、mutate/evidence.removeTop と整合) を手札へ。
      // 証拠0 なら no-op + __chainStepNoApply で chain break = 「そうした場合」不成立 (filePopToHand と同型)。
      // removeTop は remove エリアへ送るため使わず、手動 pop + hand.add (リムーブではなく手札移動)。
      if (a.fromTop === true) {
        const evList = s.players[p].evidence;
        if (evList.length === 0) {
          (ctx.dyn ??= {}).chainStepNoApply = true; // Phase 3c: chain break 信号を ctx.dyn へ (resolver chain case が読む)
          mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceToHand', result: 'none' });
          return;
        }
        const top = evList[evList.length - 1]!;
        const topId = top.cardId;
        evList.pop();
        advanceIndexedZoneEpoch(s, p, 'evidence');
        mutate.hand.add(s, p, [topId]);
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: 'evidence',
          source: { kind: 'zone', side: p, zone: 'evidence' },
          targets: [{ kind: 'zone', side: p, zone: 'hand' }],
          outcome: { type: 'move', from: 'evidence', to: 'hand', count: 1 },
        });
        mutate.log.append(s, {
          ts: Date.now(), player: p, turn: s.turn.number,
          action: 'effect:evidenceToHand', target: topId,
          targetAudience: top.faceUp ? undefined : p, result: 'ok',
        });
        return;
      }
      const ethArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.evidenceToHand.defaultArea, a, p, a.player as Player) }
        : a;
      const target0 = normalizeTargetToString(ethArgs.target);
      const resolvedTarget = typeof target0 === 'string' ? resolveBindRef(target0, ctx) : target0;
      const target = typeof resolvedTarget === 'string' ? resolvedTarget : undefined;
      const boundOccurrence = resolveBoundOccurrenceRef(target0, s, ctx, p, 'evidence');
      const exactIndexes = typeof target === 'string'
        ? exactEvidenceOccurrenceIndexes(s, ethArgs, ctx, p, [target])
        : undefined;
      if (boundOccurrence.kind === 'invalid' || exactIndexes === null
        || (boundOccurrence.kind === 'live' && (target !== boundOccurrence.cardId
          || (exactIndexes !== undefined && exactIndexes[0] !== boundOccurrence.index)))) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceToHand', result: 'stale-selection' });
        return;
      }
      if (!target) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: ethArgs }, ctx, { byPlayer: p, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceToHand:awaiting-pick' });
        return;
      }
      const list = s.players[p].evidence;
      const physicalIndex = exactIndexes?.[0] ?? (boundOccurrence.kind === 'live' ? boundOccurrence.index : undefined);
      const idx = physicalIndex === undefined
        ? list.findIndex(e => e.cardId === target)
        : (list[physicalIndex]?.cardId === target ? physicalIndex : -1);
      let moved = false;
      let targetAudience: Player | undefined;
      if (idx !== -1) {
        targetAudience = list[idx]!.faceUp ? undefined : p;
        list.splice(idx, 1);
        advanceIndexedZoneEpoch(s, p, 'evidence');
        mutate.hand.add(s, p, [target]);
        moved = true;
      }
      if (moved) {
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: 'evidence',
          source: { kind: 'zone', side: p, zone: 'evidence' },
          targets: [{ kind: 'zone', side: p, zone: 'hand' }],
          outcome: { type: 'move', from: 'evidence', to: 'hand', count: 1 },
        });
      }
      // BUG-073: effect log
      mutate.log.append(s, {
        ts: Date.now(), player: p, turn: s.turn.number,
        action: 'effect:evidenceToHand', target, targetAudience,
        result: moved ? 'ok' : 'not-found',
      });
      return;
    }

export function atomHandToEvidence(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine拡張 wave (2026-06-21): 手札から1枚 pick → 「裏向きで証拠として得る」(evidenceToHand の逆)。
      // discard と同型 PB pick (defaultArea 'hand')。公式Q&A B06029「手札から裏向きで得る証拠は1番上に
      // 置かれます」→ evidence.gainCard が push (末尾=証拠の1番上、mutate/evidence.removeTop と整合)。
      // fromArea:'none' = hand から先に remove 済なので remove エリアは触らない。
      const hteP = resolvePlayer(a.player, ctx);
      const hteArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handToEvidence.defaultArea, a, hteP, a.player as Player) }
        : a;
      if (!Array.isArray(hteArgs.target)) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: hteArgs }, ctx, { byPlayer: hteP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: hteP, turn: s.turn.number, action: 'effect:handToEvidence:awaiting-pick' });
        return;
      }
      const hteTargets = hteArgs.target as string[];
      const hteFaceUp = a.faceUp === true; // 既定 false (「裏向きで証拠として得る」)
      let hteMoved = 0;
      for (const cardId of hteTargets) {
        // 手札に実在する場合のみ証拠化 (手札→証拠なので、手札に無い cardId は no-op = 証拠に湧かせない)
        const hIdx = s.players[hteP].hand.indexOf(cardId);
        if (hIdx === -1) continue;
        s.players[hteP].hand.splice(hIdx, 1);
        mutate.evidence.gainCard(s, hteP, cardId, hteFaceUp, { turn: s.turn.number, via: 'effect' }, 'none');
        hteMoved++;
      }
      recordPublicZoneMove(s, ctx, hteP, 'hand', 'evidence', hteMoved, 'evidence');
      mutate.log.append(s, { ts: Date.now(), player: hteP, turn: s.turn.number, action: 'effect:handToEvidence', result: String(hteMoved) });
      return;
    }

export function atomHandToFileBottom(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine mega-wave W1 (2026-07-03, P41): 手札1枚を FILE の1番下に **表向き** で移す (B05045 a2
      // 「手札を1枚FILEエリアにあるカードの1番下に表向きで移す」)。handToEvidence の exact-clone
      // (PB pick defaultArea 'hand')。FILE 1番下 = mutate.file.insertBottomFaceUp (unshift、rules/05)。
      const hfbP = resolvePlayer(a.player, ctx);
      const hfbArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handToFileBottom!.defaultArea, a, hfbP, a.player as Player) }
        : a;
      const hfbT = hfbArgs.target;
      if (!Array.isArray(hfbT) && typeof hfbT !== 'string') {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: hfbArgs }, ctx, { byPlayer: hfbP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: hfbP, turn: s.turn.number, action: 'effect:handToFileBottom:awaiting-pick' });
        return;
      }
      const hfbIds = Array.isArray(hfbT) ? (hfbT as string[]) : [hfbT as string];
      let hfbMoved = 0;
      for (const cardId of hfbIds) {
        // 手札に実在する場合のみ移動 (無い cardId は no-op = FILE に湧かせない)
        const hIdx = s.players[hfbP].hand.indexOf(cardId);
        if (hIdx === -1) continue;
        s.players[hfbP].hand.splice(hIdx, 1);
        mutate.file.insertBottomFaceUp(s, hfbP, cardId);
        hfbMoved++;
      }
      recordPublicZoneMove(s, ctx, hfbP, 'hand', 'file', hfbMoved);
      mutate.log.append(s, { ts: Date.now(), player: hfbP, turn: s.turn.number, action: 'effect:handToFileBottom', result: String(hfbMoved) });
      return;
    }

export function atomUseEventFromHand(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine mega-wave W6 step3 (2026-07-04, r63 P18): 効果内から手札のイベントを filter 一致で
      // pick (0..1) して即時使用 (「手札からレベル6以下のイベントを1枚まで使用する」B08026/D10005/B05042)。
      // atomHandToFileBottom clone (PB pick defaultArea 'hand')。使用手順は hand-use-card.ts の event
      // 分岐と**同順序厳守**: ① effect:declared emit (viaEffect:true) ② hand.remove ③ remove.add —
      // emit が先でないと on-hand scope 判定 (collectCardsInPlay の hand sentinel) が使用イベント自身の
      // 効果を見つけられない。公式Q&A: 効果による使用は FILE 枚数・事件色制限をバイパス (canHandUseCard
      // 非経由がそのままバイパスの実装形)。
      const uefP = resolvePlayer(a.player, ctx);
      // B09034「能力や効果によっても使用できない」の防御的再ゲート (candidates は ban を見ないため
      // pick 構築より前に落とす — human に無意味な pick を出させない)。
      if (s.turnState[uefP].eventUseBanned) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        return;
      }
      const uefArgs0 = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.useEventFromHand!.defaultArea, a, uefP, a.player as Player) }
        : a;
      const uefArgs = restrictEventUsePick(s, uefP, uefArgs0);
      const uefT = uefArgs.target;
      if (!Array.isArray(uefT) && typeof uefT !== 'string') {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: uefArgs }, ctx, { byPlayer: uefP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: uefP, turn: s.turn.number, action: 'effect:useEventFromHand:awaiting-pick' });
        return;
      }
      const uefIds = Array.isArray(uefT) ? (uefT as string[]) : [uefT as string];
      // Recheck every selected event before the first emit/move. A stale
      // authorization must reject the atom atomically and leave no log.
      const selectedCounts = new Map<string, number>();
      for (const cardId of uefIds) selectedCounts.set(cardId, (selectedCounts.get(cardId) ?? 0) + 1);
      const handCounts = new Map<string, number>();
      for (const cardId of s.players[uefP].hand) handCounts.set(cardId, (handCounts.get(cardId) ?? 0) + 1);
      const staleSelection = [...selectedCounts].some(([cardId, count]) => (
        (handCounts.get(cardId) ?? 0) < count
        || readDef.card(cardId)?.kind !== 'event'
      ));
      if (staleSelection) {
        // A stale commit is rejected as if it never entered this handler:
        // no state, hook, log, or resolver-dynamic side effect.
        return;
      }
      // An explicit empty selection is a legitimate optional decline and
      // retains its chain gate. A non-empty authorization failure is stale
      // selection state, so it must leave ctx.dyn untouched as well.
      if (uefIds.length === 0) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        return;
      }
      const staleAuthorization = [...selectedCounts].some(([cardId]) => !eventUseAllowed(s, uefP, cardId));
      if (staleAuthorization) return;
      recordEffectCausalOperation(s, ctx, {
        actor: uefP,
        kind: 'use',
        source: { kind: 'zone', side: uefP, zone: 'hand' },
        targets: [],
        outcome: { type: 'state', state: 'active' },
      });
      for (const cardId of uefIds) {
        // 手札に実在する場合のみ使用 (無い cardId は no-op)
        // 混成 review NIT 対応 (2026-07-04): イベント以外は使用しない (author が filter:{kind:'event'}
        // を書き漏らした時にキャラカードが silent にリムーブ行きになる footgun の防御 1 行)。
        event.emit(
          s,
          'effect:declared',
          { kind: 'event-use', cardId, player: uefP, viaEffect: true },
          { player: uefP, cardId, resolutionKind: 'normal-event' as const },
        );
        mutate.hand.remove(s, uefP, [cardId]);
        mutate.remove.add(s, uefP, [cardId]);
      }
      recordPublicZoneMove(s, ctx, uefP, 'hand', 'remove', uefIds.length);
        // 0枚 (辞退/候補なし) → 「そうした場合」gate (handReveal gate-on-0 と同型)
      mutate.log.append(s, { ts: Date.now(), player: uefP, turn: s.turn.number, action: 'effect:useEventFromHand', result: String(uefIds.length) });
      return;
    }

export function atomEvidenceToDeckBottom(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine mega-wave W1 (2026-07-03): 証拠を pick して **持ち主の** デッキの下へ移す
      // (「相手の証拠を1つまで選び、デッキの下に移す」B03084 a1 前段)。evidenceToHand の clone
      // (PB pick defaultArea 'evidence')。公式Q&A: どの位置の証拠でも選べる / 裏向きは確認できず
      // 裏向きのままデッキ下へ (deck は CardId[] で不可視ゆえ表現済)。リムーブではない (ヒラメキ不発動、
      // rules/10: ヒラメキは「証拠からリムーブされるとき」のみ)。
      // chooser=controller (自分が相手の証拠を選ぶ) / side=a.player (証拠の持ち主)。
      const edbP = resolvePlayer(a.player, ctx);
      const edbArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.evidenceToDeckBottom!.defaultArea, a, ctx.source.player as Player, edbP) }
        : a;
      const edbT = edbArgs.target;
      if (!Array.isArray(edbT) && typeof edbT !== 'string') {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: edbArgs }, ctx, { byPlayer: ctx.source.player as Player, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: edbP, turn: s.turn.number, action: 'effect:evidenceToDeckBottom:awaiting-pick' });
        return;
      }
      const edbRawIds = Array.isArray(edbT) ? edbT : [edbT];
      const edbIds = edbRawIds
        .map((cardId) => resolveBindRef(cardId, ctx))
        .filter((cardId): cardId is string => typeof cardId === 'string' && !cardId.startsWith('$'));
      const exactIndexes = exactEvidenceOccurrenceIndexes(s, edbArgs, ctx, edbP, edbIds);
      const boundOccurrence = edbRawIds.length === 1
        ? resolveBoundOccurrenceRef(edbRawIds[0], s, ctx, edbP, 'evidence')
        : { kind: 'unbound' as const };
      if (boundOccurrence.kind === 'invalid' || exactIndexes === null
        || (boundOccurrence.kind === 'live' && (edbIds[0] !== boundOccurrence.cardId
          || (exactIndexes !== undefined && exactIndexes[0] !== boundOccurrence.index)))) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, { ts: Date.now(), player: edbP, turn: s.turn.number, action: 'effect:evidenceToDeckBottom', result: 'stale-selection' });
        return;
      }
      let edbMoved = 0;
      for (const [position, cardId] of edbIds.entries()) {
        const evList = s.players[edbP].evidence;
        const originalIndex = exactIndexes?.[position]
          ?? (position === 0 && boundOccurrence.kind === 'live' ? boundOccurrence.index : undefined);
        const priorLowerIndexes = originalIndex === undefined || exactIndexes === undefined
          ? 0
          : exactIndexes.slice(0, position).filter((index) => index < originalIndex).length;
        const currentIndex = originalIndex === undefined ? undefined : originalIndex - priorLowerIndexes;
        const eIdx = currentIndex === undefined
          ? evList.findIndex(e => e.cardId === cardId)
          : (evList[currentIndex]?.cardId === cardId ? currentIndex : -1);
        if (eIdx === -1) continue; // 証拠に無い cardId は no-op
        evList.splice(eIdx, 1);
        advanceIndexedZoneEpoch(s, edbP, 'evidence');
        mutate.deck.toBottom(s, edbP, [cardId]); // 持ち主のデッキの下 (裏向き)
        edbMoved++;
      }
      recordPublicZoneMove(s, ctx, edbP, 'evidence', 'deck', edbMoved, 'evidence');
      mutate.log.append(s, { ts: Date.now(), player: edbP, turn: s.turn.number, action: 'effect:evidenceToDeckBottom', result: String(edbMoved) });
      return;
    }

// engine mega-wave W3 (2026-07-03, r12): リムーブ中カードの【現場リムーブ時】明示発動 (B08078 a2)。
// 実体は effect/invoke-leave-to-remove.ts leaf (emit 非経由 = 盤面 observer 波及なし)。
// args: { cardId | '$bind.ref', player? ('self' 相対、省略時効果起動側のカード所有 = self) }
export function atomInvokeLeaveToRemoveOfCard(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const ilCardId = resolveBindRef(a.cardId, ctx) as string;
      if (typeof ilCardId !== 'string' || ilCardId.startsWith('$')) return;
      const ilP = resolvePlayer(a.player ?? 'self', ctx);
      invokeLeaveToRemoveOfCard(s, ilCardId, ilP);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:invokeLeaveToRemoveOfCard', target: ilCardId });
      return;
    }

// engine night-wave WC2b (2026-07-11): 別カードの【ヒラメキ】effect を明示発動 (B06023/B06034)。
// 実体は effect/invoke-hirameki.ts leaf (emit 非経由)。
// args: { cardId | cardIds ('$bind.ref' / '$cost.flipFaceUpEvidence.ids' 等), player? ('self' 相対),
//         trait? (印字 trait gate — 例 'YAIBA'), optional? (「発動させてもよい」atom-level prompt — 下記) }。
// cardIds 配列内の各 cardId を順に invoke。
// 未解決 ($ 残り) / non-string は skip。invoke 側で def 不在・trait 不一致・hirameki 不在は no-op。
//
// optional:true (T2 review B06034): walk-level optional{} は binding-依存 conditional (boundMatchesFilter
// $flipped) の then 枝内で使えない — pre-walk が unstable-if の両枝を walk して bind 確定前に eager
// surface し (BUG-161 の unstable 側 latent)、continuation 経路の remainder は runtime resolver 直行で
// optional を surface できない (optionalRun 未設定 = silent skip)。よって「してもよい」prompt を atom 実行時
// (= bind 確定後・conditional 成立時のみ到達) に side-channel surface する。human owner → pendingEffectOptional
// (live ctx.bindings/costPaid を wave-18 resume 機構で保持、resume = optional{本 atom (flag 除去)})。
// AI / non-human → skip (walk-level optional の AI 既定 skip と同一 posture)。
export function atomInvokeHiramekiOfCard(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const ihP = resolvePlayer(a.player ?? 'self', ctx);
      const ihTrait = typeof a.trait === 'string' ? a.trait : undefined;
      if (a.optional === true) {
        const ihHuman = (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide ?? null;
        const ihCtrl = ctx.source.player;
        if (ihHuman !== null && ihCtrl === ihHuman) {
          const { optional: _ihOpt, ...ihRest } = a;
          void _ihOpt;
          pushPendingEffectOptionalSide({
            player: ihCtrl,
            source: pendingSource(s, ctx, {
              cardId: ctx.source.cardId ?? '',
              abilityId: ctx.source.abilityId ?? '',
              uid: ctx.source.uid ?? '',
            }),
            triggerPayload: (ctx as { triggerPayload?: unknown }).triggerPayload,
          });
          // resume = optional{atom (flag 除去)} — applyOptionalAndContinuation の walk が
          // dyn.optionalRun で run/skip を確定する (run:false = parallel[] で完全 no-op)。
          setPendingOptionalResume({ kind: 'optional', effect: { kind: 'atom', verb: 'invokeHiramekiOfCard', args: ihRest } } as never);
          setPendingOptionalBindings({ ...(ctx.bindings as Record<string, unknown>) });
          setPendingOptionalCostPaid((ctx as { costPaid?: Record<string, unknown> }).costPaid);
          mutate.log.append(s, { ts: Date.now(), player: ihCtrl, turn: s.turn.number, action: 'effect:invokeHiramekiOfCard:awaiting-optional' });
          return;
        }
        // AI / non-human: skip (「してもよい」既定不使用 — walk-level optional と同 posture)
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:invokeHiramekiOfCard', target: 'optional-skip' });
        return;
      }
      const resolveOccurrenceValue = (raw: unknown): unknown =>
        typeof raw === 'string' && raw.startsWith('$') && !raw.includes('.')
          ? (ctx.bindings as Record<string, unknown>)[raw] ?? raw
          : resolveBindRef(raw, ctx);
      const occurrenceFrom = (raw: unknown): HiramekiOccurrence | null => {
        const value = resolveOccurrenceValue(raw);
        const entry = Array.isArray(value) ? value[0] : value;
        if (!entry || typeof entry !== 'object') return null;
        return isHiramekiOccurrence(entry) ? entry : null;
      };
      const occurrences: HiramekiOccurrence[] = [];
      let ihIds: string[] = [];
      const rawOccurrences = a.occurrences ?? a.occurrence;
      if (rawOccurrences !== undefined) {
        const resolved = resolveOccurrenceValue(rawOccurrences);
        const values = Array.isArray(resolved) ? resolved : [resolved];
        for (const raw of values) {
          const occurrence = occurrenceFrom(raw);
          if (occurrence) occurrences.push(occurrence);
        }
        if (occurrences.length === 0 && rawOccurrences === '$pick' && a.target && typeof a.target === 'object') {
          tryRePickFromAtom(s, { kind: 'atom', verb: 'invokeHiramekiOfCard', args: a }, ctx, {
            byPlayer: ihP,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: ihP, turn: s.turn.number, action: 'effect:invokeHiramekiOfCard:awaiting-pick' });
          return;
        }
      } else if (a.cardIds !== undefined) {
        const resolved = resolveBindRef(a.cardIds, ctx);
        if (Array.isArray(resolved)) {
          ihIds = resolved.filter((x): x is string => typeof x === 'string' && !x.startsWith('$'));
        }
      } else if (a.cardId !== undefined) {
        // S1 wave (2026-07-11, B06036): cardId='$pick.cardId' + target query → Pattern B await-pick。
        // 「コストによって表向きになった〜のカードを1枚まで選び、その【ヒラメキ】の効果を発動」—
        // cost が表向きにした複数枚 (fromGroupCards:'$costFlipped') から 1 枚を選ばせる。
        // apply-pick は evidence:side:idx uid → cardId 逆引き対応済 (resolveCardIdFromPickUid)。
        // 0枚辞退 = cardId 未解決のまま re-dispatch されず → 発動なし (「1枚まで」rules/15)。
        if (a.cardId === '$pick.cardId' && a.target && typeof a.target === 'object') {
          tryRePickFromAtom(s, { kind: 'atom', verb: 'invokeHiramekiOfCard', args: a }, ctx, {
            byPlayer: ihP,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: ihP, turn: s.turn.number, action: 'effect:invokeHiramekiOfCard:awaiting-pick' });
          return;
        }
        const c = resolveBindRef(a.cardId, ctx);
        if (typeof c === 'string' && !c.startsWith('$')) ihIds = [c];
      }
      for (const occurrence of occurrences) invokeHiramekiOfCard(s, occurrence, undefined, ihTrait);
      for (const cid of ihIds) invokeHiramekiOfCard(s, cid, ihP, ihTrait);
      const targets = occurrences.map(({ cardId }) => cardId).concat(ihIds);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:invokeHiramekiOfCard', target: targets.join(',') });
      return;
    }

export function atomHandAddFromDeck(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // engine-extension #5a (2026-06-05): deck-reorder 系の補助 — bind 済 cardId をデッキから抜き手札へ。
      // 用途: 「上から N 枚見る → 1枚まで(filter)を手札に加え → 残りはデッキ下」(D01013/B01013 etc.).
      // 通常 a.cardId='$matched.cardId' で bind 解決 → デッキから splice → hand.add。
      const hadP = resolvePlayer(a.player, ctx);
      const deferRefresh = a.deferRefresh === true;
      if (!deferRefresh && !refreshDeckForEffect(s, hadP, ctx)) {
        setCardMoveBinding(ctx, a.bind, []);
        mutate.log.append(s, { ts: Date.now(), player: hadP, turn: s.turn.number, action: 'effect:handAddFromDeck', result: 'empty-deck-refresh-fail' });
        return;
      }
      const rawHadCardIds = (a as { cardIds?: unknown }).cardIds;
      if (rawHadCardIds === '$pick.cardIds') {
        // BUG-334: an up-to-N deck-window decline is a resolved zero-card
        // selection. Re-running the unresolved carrier would surface the same
        // decision forever and drop the saved remainder.
        if (a.__declined === true) {
          setCardMoveBinding(ctx, a.bind, []);
          mutate.log.append(s, {
            ts: Date.now(), player: hadP, turn: s.turn.number,
            action: 'effect:handAddFromDeck', result: 'declined=0',
          });
          return;
        }
        if (a.target && typeof a.target === 'object') {
          tryRePickFromAtom(s, { kind: 'atom', verb: 'handAddFromDeck', args: a }, ctx, {
            byPlayer: hadP,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: hadP, turn: s.turn.number, action: 'effect:handAddFromDeck:awaiting-pick' });
        }
        return;
      }
      if (Array.isArray(rawHadCardIds)) {
        const cardIds = rawHadCardIds.filter((id): id is string => typeof id === 'string');
        const deck = s.players[hadP].deck;
        const originalDeck = [...deck];
        const hasExactIndexes = Object.hasOwn(a, 'selectedDeckIndexes');
        const originalIndexes = exactSelectedIndexes((a as { selectedDeckIndexes?: unknown }).selectedDeckIndexes, ctx);
        if (hasExactIndexes && (
          originalIndexes === null
          || originalIndexes.length !== cardIds.length
          || new Set(originalIndexes).size !== originalIndexes.length
          || originalIndexes.some((index, position) => deck[index] !== cardIds[position])
        )) {
          setCardMoveBinding(ctx, a.bind, []);
          mutate.log.append(s, { ts: Date.now(), player: hadP, turn: s.turn.number, action: 'effect:handAddFromDeck', result: 'stale-selection' });
          return;
        }
        const moved: Array<{ cardId: string; area: 'hand'; player: Player; index: number }> = [];
        const movedOriginalDeckIndexes: number[] = [];
        for (const [position, cardId] of cardIds.entries()) {
          const originalIndex = originalIndexes?.[position]
            ?? originalDeck.findIndex((entry, index) => entry === cardId && !movedOriginalDeckIndexes.includes(index));
          const idx = typeof originalIndex === 'number'
            ? originalIndex - movedOriginalDeckIndexes.filter((previous) => previous < originalIndex).length
            : -1;
          if (idx === -1 || deck[idx] !== cardId) continue;
          deck.splice(idx, 1);
          const handIndex = s.players[hadP].hand.length;
          mutate.hand.add(s, hadP, [cardId]);
          moved.push({ cardId, area: 'hand', player: hadP, index: handIndex });
          if (originalIndex >= 0) movedOriginalDeckIndexes.push(originalIndex);
        }
        if (movedOriginalDeckIndexes.length > 0) {
          advanceDeckEpochAndRebaseBindings(s, ctx, hadP, movedOriginalDeckIndexes);
        }
        setCardMoveBinding(ctx, a.bind, moved);
        recordPublicZoneMove(s, ctx, hadP, 'deck', 'hand', moved.length);
        presentPublicSelectedDeckCard(
          s,
          ctx,
          hadP,
          moved.map((entry) => entry.cardId),
          a.presentation,
        );
        if (moved.length > 0 && !deferRefresh) refreshDeckForEffect(s, hadP, ctx);
        mutate.log.append(s, { ts: Date.now(), player: hadP, turn: s.turn.number, action: 'effect:handAddFromDeck', result: moved.length ? `moved=${moved.length}` : 'none' });
        return;
      }
      const rawHadCardId = a.cardId;
      const hadCardId = resolveBindRef(rawHadCardId, ctx) as string;
      if (typeof hadCardId !== 'string' || hadCardId.startsWith('$')) {
        // WC2a (2026-07-11, B05093): cardId='$pick.cardId' + pick query → await-pick で相手が選ぶ
        // deck-window を surface する (sceneEnter scene.ts:155 の $pick.cardId 経路と同型 Pattern B)。
        // byPlayer は owner 側 hadP を渡すだけ — resolve-picks の chooser chokepoint が target.chooser
        // ='opp-of-owner' から opp 側へ解決する。解決後 apply-pick が cardId=$pick.cardId contract で
        // 実 cardId を載せ再実行 (source.player=owner=BUG-175 ownerPlayer) → 下 splice/hand.add に合流。
        if (rawHadCardId === '$pick.cardId' && a.target && typeof a.target === 'object') {
          tryRePickFromAtom(s, { kind: 'atom', verb: 'handAddFromDeck', args: a }, ctx, {
            byPlayer: hadP,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: hadP, turn: s.turn.number, action: 'effect:handAddFromDeck:awaiting-pick' });
          return;
        }
        // 未解決 (bind 不在) は silent no-op
        setCardMoveBinding(ctx, a.bind, []);
        mutate.log.append(s, { ts: Date.now(), player: hadP, turn: s.turn.number, action: 'effect:handAddFromDeck', result: 'no-bind' });
        return;
      }
      const deck = s.players[hadP].deck;
      const boundOccurrence = resolveBoundOccurrenceRef(rawHadCardId, s, ctx, hadP, 'deck');
      if (boundOccurrence.kind === 'invalid') {
        setCardMoveBinding(ctx, a.bind, []);
        mutate.log.append(s, { ts: Date.now(), player: hadP, turn: s.turn.number, action: 'effect:handAddFromDeck', result: 'stale-selection' });
        return;
      }
      const rawSelectedIndex = resolveBindRef((a as { selectedCardIndex?: unknown }).selectedCardIndex, ctx);
      const hasExactSelectedIndex = Object.hasOwn(a, 'selectedCardIndex');
      const idx = boundOccurrence.kind === 'live'
        ? boundOccurrence.index
        : hasExactSelectedIndex
        ? (typeof rawSelectedIndex === 'number' && Number.isInteger(rawSelectedIndex) && rawSelectedIndex >= 0 && deck[rawSelectedIndex] === hadCardId ? rawSelectedIndex : -1)
        : deck.indexOf(hadCardId);
      let moved = false;
      let handIndex = -1;
      if (idx !== -1) {
        const movedReferenceKeys = boundDeckReferenceKeys(ctx, rawHadCardId, hadP, idx, hadCardId);
        deck.splice(idx, 1);
        advanceDeckEpochAndRebaseBindings(s, ctx, hadP, [idx]);
        handIndex = s.players[hadP].hand.length;
        mutate.hand.add(s, hadP, [hadCardId]);
        restoreMovedDeckReferenceInHand(ctx, movedReferenceKeys, hadP, hadCardId, handIndex);
        moved = true;
      }
      setCardMoveBinding(ctx, a.bind, moved ? [{ cardId: hadCardId, area: 'hand', player: hadP, index: handIndex }] : []);
      recordPublicZoneMove(s, ctx, hadP, 'deck', 'hand', moved ? 1 : 0);
      presentPublicSelectedDeckCard(s, ctx, hadP, moved ? [hadCardId] : [], a.presentation);
      if (moved && !deferRefresh) refreshDeckForEffect(s, hadP, ctx);
      mutate.log.append(s, { ts: Date.now(), player: hadP, turn: s.turn.number, action: 'effect:handAddFromDeck', result: moved ? 'moved=1' : 'not-found' });
      return;
    }

export function atomHandAddFromDeckBottom(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // engine additive (2026-06-29, B03051): デッキの下から1枚を手札に加える。atomHandAddFromDeck の
      // positional 下から版 (bind ではなくデッキ末尾=「下」を1枚)。pick を持たない fixed verb (draw/souza 同型)。
      // 「下」=末尾: mutate.deck.toBottom が push する側 (deck.ts:62) → deck[length-1] / deck.pop()。
      // rules/14+26: 最後の1枚を取りデッキ0になったら即リフレッシュ (B03051 Q&A「それを手札に→リフレッシュ」)。
      const hadbP = resolvePlayer(a.player, ctx);
      // 事前0 (chain で先行効果が空にした等): take の前に refresh (atomEvidenceGain と同流儀)。
      if (s.players[hadbP].deck.length === 0) {
        if (!refreshDeckForEffect(s, hadbP, ctx)) {
          mutate.log.append(s, { ts: Date.now(), player: hadbP, turn: s.turn.number, action: 'effect:handAddFromDeckBottom', result: 'empty-deck-refresh-fail' });
          return;
        }
      }
      const deck = s.players[hadbP].deck;
      const bottomId = deck[deck.length - 1];
      if (bottomId === undefined) {
        mutate.log.append(s, { ts: Date.now(), player: hadbP, turn: s.turn.number, action: 'effect:handAddFromDeckBottom', result: 'none' });
        return;
      }
      const bottomIndex = deck.length - 1;
      deck.pop();
      advanceDeckEpochAndRebaseBindings(s, ctx, hadbP, [bottomIndex]);
      mutate.hand.add(s, hadbP, [bottomId]);
      recordPublicZoneMove(s, ctx, hadbP, 'deck', 'hand', 1);
      // take でデッキが空になったら即リフレッシュ (rules/14 即座 / B03051 Q&A: 残1枚→手札→リフレッシュ)。
      refreshDeckForEffect(s, hadbP, ctx);
      mutate.log.append(s, { ts: Date.now(), player: hadbP, turn: s.turn.number, action: 'effect:handAddFromDeckBottom', result: 'moved=1' });
      return;
    }

export function atomHandAddFromRemove(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // BUG-074: 同じく string|array 両対応に正規化
      // BUG-076: awaiting-pick 時に tryRePickFromAtom で side-channel 再 set
      // 物理動作 atom 化: { player, n } の省略形を受け取れるよう default pick target で補完
      const p = resolvePlayer(a.player, ctx);
      // engine拡張 wave (2026-06-21): fromSelf = 【ヒラメキ】「このカードを手札に加える」(B06033/PR085/PR091)。
      //   hirameki の source = リムーブされた証拠カード自身。triggered.ts handleEvidenceRemovedHook が
      //   ctx.source.cardId = ev.cardId / ctx.source.player = 証拠所有者 で起動し、その直前に
      //   action-case.ts removeOpponentEvidenceTop → mutate.evidence.removeTop が ev.cardId を
      //   所有者の remove 末尾に push 済。よって pick せず ctx.source.cardId を remove から
      //   lastIndexOf (直近 push 分 = まさにこのカード) で取得し手札へ移す。同 cardId の旧コピーが
      //   remove にあっても末尾優先で正しい1枚を取る。見つからなければ no-op (防御的、通常は必ず存在)。
      //   fromTop (evidenceToHand) 同型: args:unknown ゆえ型/whitelist 同期不要・純 additive。
      if ((a as { fromSelf?: unknown }).fromSelf === true) {
        // An invoked Hirameki may name a character still in the scene. Move
        // that exact uid with the canonical mutator; duplicate cardIds never
        // select a replacement occurrence.
        if (ctx.source.area === 'scene' && typeof ctx.source.uid === 'string') {
          const sourceCard = s.players[p].scene.find((card) =>
            card.uid === ctx.source.uid && card.cardId === ctx.source.cardId,
          );
          if (!sourceCard) {
            setCardMoveBinding(ctx, a.bind, []);
            mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', result: 'none' });
            return;
          }
          const handIndex = s.players[p].hand.length;
          mutate.scene.toHand(s, sourceCard.uid, { cause: 'effect', byPlayer: ctx.source.player });
          if (s.players[p].hand.length !== handIndex + 1) {
            setCardMoveBinding(ctx, a.bind, []);
            mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', result: 'none' });
            return;
          }
          setCardMoveBinding(ctx, a.bind, [{ cardId: sourceCard.cardId, area: 'hand', player: p, index: handIndex }]);
          recordPublicZoneMove(s, ctx, p, 'scene', 'hand', 1);
          mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', target: sourceCard.cardId, result: 'ok' });
          return;
        }
        const heldClaim = readHeldHiramekiSelfClaim(ctx, p);
        if (heldClaim.kind !== 'absent') {
          const evidence = heldClaim.kind === 'claim'
            ? mutate.evidence.takeHeldHiramekiEvidence(s, heldClaim.claim)
            : undefined;
          if (!evidence) {
            setCardMoveBinding(ctx, a.bind, []);
            mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', result: 'none' });
            return;
          }
          const handIndex = s.players[p].hand.length;
          mutate.hand.add(s, p, [evidence.cardId]);
          setCardMoveBinding(ctx, a.bind, [{
            cardId: evidence.cardId,
            area: 'hand',
            player: p,
            index: handIndex,
          }]);
          recordPublicZoneMove(s, ctx, p, 'evidence', 'hand', 1);
          mutate.log.append(s, {
            ts: Date.now(),
            player: p,
            turn: s.turn.number,
            action: 'effect:handAddFromRemove',
            target: evidence.cardId,
            result: 'ok',
          });
          return;
        }
        const occurrence = ctx.bindings.occurrence?.[0] as {
          uid?: unknown; cardId?: unknown; player?: unknown; area?: unknown; index?: unknown; occurrenceWitness?: unknown;
        } | undefined;
        const selfCid = occurrence?.cardId;
        const remSelf = s.players[p].remove;
        const sIdx = typeof occurrence?.index === 'number' ? occurrence.index : -1;
        if (typeof selfCid !== 'string'
          || occurrence?.player !== p
          || occurrence?.area !== 'remove'
          || !Number.isInteger(sIdx)
          || occurrence.uid !== cardOccurrenceUid(p, 'remove', selfCid, sIdx)
          || typeof occurrence.occurrenceWitness !== 'string'
          || !isLiveCardOccurrenceWitness(s, p, 'remove', occurrence.occurrenceWitness)
          || remSelf[sIdx] !== selfCid) {
          setCardMoveBinding(ctx, a.bind, []);
          mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', result: 'none' });
          return;
        }
        remSelf.splice(sIdx, 1);
        advanceIndexedZoneEpoch(s, p, 'remove');
        mutate.remove.emitExit(s, p, selfCid); // wave-4: remove→hand 離脱 (原因非依存 remove:exit)
        const handIndex = s.players[p].hand.length;
        mutate.hand.add(s, p, [selfCid]);
        setCardMoveBinding(ctx, a.bind, [{ cardId: selfCid, area: 'hand', player: p, index: handIndex }]);
        recordPublicZoneMove(s, ctx, p, 'remove', 'hand', 1);
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', target: selfCid, result: 'ok' });
        return;
      }
      // cluster6 (2026-06-14) B09034「リムーブのイベントを2枚まで選び、手札に加える」用 multi-pick path。
      //   charStackCard (case 'charStackCard') と同型の cardIds:'$pick.cardIds' contract:
      //     { player, cardIds:'$pick.cardIds', target:{kind:'pick', query:{area:'remove',side:'self',
      //       filter:{kind:'event'}}, n:{min:0,max:2}, chooser:'self'} }
      //   human 経路: apply-pick.ts が picked uid → cardIds 配列を充填して再 dispatch (hasCardIdsBind)。
      //   AI 経路:   resolve-picks.ts が remove 候補から greedy に max 枚 cardIds を充填。
      //   従来 single-card path (cardIds 未指定) は下段で従来通り処理 → additive・非干渉。
      const rawCardIds = (a as { cardIds?: unknown }).cardIds;
      if (rawCardIds === '$pick.cardIds') {
        // 未解決 (human 経路の await): side-channel に pick を queue して return。
        if (a.target && typeof a.target === 'object') {
          tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, {
            byPlayer: p,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove:awaiting-pick' });
        }
        return;
      }
      if (Array.isArray(rawCardIds)) {
        // 解決済 (0〜max 枚): 各 cardId を source zone → hand へ移す (rules/15「〜まで」= 0 枚可 → no-op + log)。
        const cardIds = rawCardIds.filter((cardId): cardId is string => typeof cardId === 'string');
        // engine A1 wave (2026-07-11, B07049/B09039): source area union (remove ∪ partner-area) —
        // 「自分のリムーブエリアかパートナーエリアにある〚特徴[ビッグジュエル]〛の…を手札に加える」。
        // candidate 列挙は PR234 の area 配列 union が既に対応 (candidates.ts 'partner-area' = partnerAreaCards)。
        // splice 側を area ごとに順に探す (pick 済 cardId は一意 zone 由来 = charStackCard/charSetCard union と同流儀)。
        // area 無指定 / ['remove'] のみ = 従来 remove-only path と byte 等価 (B09034 等の既存 consumer 回帰0)。
        // ⚠ partner-area の対象は partnerAreaCards (非MR 一般カード枠) — partnerAreaMR (MR 専用 slot) は
        // candidates 'partner-area' が列挙しない (read/candidates 実測) ため本 consumer 群では非到達 (MR slot 清掃不要)。
        const hafrSrcRaw = (a.target && typeof a.target === 'object')
          ? (a.target as { query?: { area?: string | string[] } }).query?.area : undefined;
        const hafrSrcAreas = (Array.isArray(hafrSrcRaw) ? hafrSrcRaw : [hafrSrcRaw])
          .filter((x): x is 'remove' | 'partner-area' => x === 'remove' || x === 'partner-area');
        const hafrAreas: Array<'remove' | 'partner-area'> = hafrSrcAreas.length > 0 ? hafrSrcAreas : ['remove'];
        const hasExactOccurrences = Object.hasOwn(a, 'selectedCardOccurrences');
        const selectedOccurrences = exactSelectedCardOccurrences((a as { selectedCardOccurrences?: unknown }).selectedCardOccurrences, ctx);
        if (hasExactOccurrences) {
          const occurrenceKeys = selectedOccurrences?.map((entry) => `${entry.player}:${entry.area}:${entry.index}`) ?? [];
          const valid = selectedOccurrences !== null
            && selectedOccurrences.length === cardIds.length
            && new Set(occurrenceKeys).size === occurrenceKeys.length
            && selectedOccurrences.every((entry, position) => entry.player === p
              && (entry.area === 'remove' || entry.area === 'partner-area')
              && hafrAreas.includes(entry.area)
              && entry.cardId === cardIds[position]
              && (entry.area === 'remove'
                ? isLiveCardOccurrenceWitness(s, entry.player, 'remove', entry.occurrenceWitness)
                  && s.players[entry.player].remove[entry.index] === entry.cardId
                : s.players[entry.player].partnerAreaCards?.[entry.index] === entry.cardId));
          if (!valid) {
            setCardMoveBinding(ctx, a.bind, []);
            mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', result: 'stale-selection' });
            return;
          }
          const moved: Array<{ cardId: string; area: 'hand'; player: Player; index: number }> = [];
          for (const [position, occurrence] of selectedOccurrences.entries()) {
            const priorFromSameArea = selectedOccurrences.slice(0, position)
              .filter((previous) => previous.player === occurrence.player
                && previous.area === occurrence.area
                && previous.index < occurrence.index).length;
            const source = occurrence.area === 'remove'
              ? s.players[occurrence.player].remove
              : s.players[occurrence.player].partnerAreaCards;
            const currentIndex = occurrence.index - priorFromSameArea;
            if (!source || source[currentIndex] !== occurrence.cardId) {
              // Prevalidation above makes this unreachable without an observer mutation.
              // Keep the operation fail-closed instead of falling back to cardId lookup.
              setCardMoveBinding(ctx, a.bind, []);
              mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', result: 'stale-selection' });
              return;
            }
            source.splice(currentIndex, 1);
            if (occurrence.area === 'remove') {
              advanceIndexedZoneEpoch(s, occurrence.player, 'remove');
              mutate.remove.emitExit(s, occurrence.player, occurrence.cardId);
            }
            const handIndex = s.players[p].hand.length;
            mutate.hand.add(s, p, [occurrence.cardId]);
            moved.push({ cardId: occurrence.cardId, area: 'hand', player: p, index: handIndex });
          }
          setCardMoveBinding(ctx, a.bind, moved);
          recordPublicZoneMove(
            s,
            ctx,
            p,
            'remove',
            'hand',
            selectedOccurrences.filter((occurrence) => occurrence.area === 'remove').length,
          );
          recordPublicZoneMove(
            s,
            ctx,
            p,
            'partner',
            'hand',
            selectedOccurrences.filter((occurrence) => occurrence.area === 'partner-area').length,
          );
          mutate.log.append(s, {
            ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove',
            target: moved.map(({ cardId }) => cardId).join(','), result: cardIds.length === 0 ? '0' : (moved.length ? 'ok' : 'not-found'),
          });
          if ((a as { gateOnZero?: boolean }).gateOnZero === true && moved.length === 0) {
            (ctx.dyn ??= {}).chainStepNoApply = true;
          }
          return;
        }
        const hasExactIndexes = Object.hasOwn(a, 'selectedDeckIndexes');
        const originalIndexes = exactSelectedIndexes((a as { selectedDeckIndexes?: unknown }).selectedDeckIndexes, ctx);
        if (hasExactIndexes && (
          hafrAreas.length !== 1
          || hafrAreas[0] !== 'remove'
          || originalIndexes === null
          || originalIndexes.length !== cardIds.length
          || new Set(originalIndexes).size !== originalIndexes.length
          || originalIndexes.some((index, position) => s.players[p].remove[index] !== cardIds[position])
        )) {
          setCardMoveBinding(ctx, a.bind, []);
          mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', result: 'stale-selection' });
          return;
        }
        const moved: Array<{ cardId: string; area: 'hand'; player: Player; index: number }> = [];
        let movedFromRemove = 0;
        let movedFromPartner = 0;
        for (const [position, cid] of cardIds.entries()) {
          for (const ar of hafrAreas) {
            if (ar === 'remove') {
              const remM = s.players[p].remove;
              const originalIndex = originalIndexes?.[position];
              const idx = typeof originalIndex === 'number'
                ? originalIndex - originalIndexes!.slice(0, position).filter((previous) => previous < originalIndex).length
                : remM.indexOf(cid);
              if (idx !== -1 && remM[idx] === cid) {
                remM.splice(idx, 1);
                advanceIndexedZoneEpoch(s, p, 'remove');
                mutate.remove.emitExit(s, p, cid);
                const handIndex = s.players[p].hand.length;
                mutate.hand.add(s, p, [cid]);
                moved.push({ cardId: cid, area: 'hand', player: p, index: handIndex });
                movedFromRemove += 1;
                break;
              }
            } else {
              const pa = s.players[p].partnerAreaCards;
              const idx = pa ? pa.indexOf(cid) : -1;
              if (idx !== -1) {
                pa!.splice(idx, 1);
                const handIndex = s.players[p].hand.length;
                mutate.hand.add(s, p, [cid]);
                moved.push({ cardId: cid, area: 'hand', player: p, index: handIndex });
                movedFromPartner += 1;
                break;
              }
            }
          }
        }
        setCardMoveBinding(ctx, a.bind, moved);
        recordPublicZoneMove(s, ctx, p, 'remove', 'hand', movedFromRemove);
        recordPublicZoneMove(s, ctx, p, 'partner', 'hand', movedFromPartner);
        mutate.log.append(s, {
          ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove',
          target: moved.map(({ cardId }) => cardId).join(','), result: cardIds.length === 0 ? '0' : (moved.length ? 'ok' : 'not-found'),
        });
        // S1 wave (2026-07-11, B09039 a2): gateOnZero (opt-in) — 「カードを手札に加えた場合、手札を
        // 1枚リムーブする」の「加えた場合」gate。0 枚 (辞退 or 候補喪失) なら後続 chain step を skip
        // (useEventFromHand の gate-on-0 と同型)。既存 consumer は未宣言 → byte 互換。
        if ((a as { gateOnZero?: boolean }).gateOnZero === true && moved.length === 0) {
          (ctx.dyn ??= {}).chainStepNoApply = true;
        }
        return;
      }
      const hafrArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handAddFromRemove.defaultArea, a, p, a.player as Player) }
        : a;
      // M2後半 (2026-07-10, PR234 a2): target の bind 参照 ($trigger.setCardId 等) を解決してから
      // cardId 照合する。「その中から1枚」= trigger payload の厳密対象 (filter:{cardName} 代替は
      // 同名別 printing 混在で観測差)。非 '$' 文字列は resolveBindRef が素通し = 既存 byte 互換。
      const target0 = normalizeTargetToString(hafrArgs.target);
      const target = typeof target0 === 'string' ? (resolveBindRef(target0, ctx) as string) : target0;
      const boundOccurrence = resolveBoundOccurrenceRef(target0, s, ctx, p, 'remove');
      if (boundOccurrence.kind === 'invalid'
        || (boundOccurrence.kind === 'live' && target !== boundOccurrence.cardId)) {
        setCardMoveBinding(ctx, hafrArgs.bind, []);
        (ctx.dyn ??= {}).chainStepNoApply = true;
        return;
      }
      if (!target) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: hafrArgs }, ctx, { byPlayer: p, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove:awaiting-pick' });
        return;
      }
      const rem = s.players[p].remove;
      const hasExactOccurrence = Object.hasOwn(hafrArgs, 'selectedCardOccurrences');
      const selectedOccurrences = hasExactOccurrence
        ? exactSelectedCardOccurrences((hafrArgs as { selectedCardOccurrences?: unknown }).selectedCardOccurrences, ctx)
        : undefined;
      const exactOccurrence = selectedOccurrences?.length === 1 ? selectedOccurrences[0] : undefined;
      if (hasExactOccurrence && (selectedOccurrences === null
        || selectedOccurrences === undefined
        || selectedOccurrences.length !== 1
        || exactOccurrence?.player !== p
        || exactOccurrence.area !== 'remove'
        || exactOccurrence.cardId !== target
        || !isLiveCardOccurrenceWitness(s, p, 'remove', exactOccurrence.occurrenceWitness)
        || rem[exactOccurrence.index] !== target)) {
        setCardMoveBinding(ctx, hafrArgs.bind, []);
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', target, result: 'stale-selection' });
        return;
      }
      const rawSelectedIndex = resolveBindRef((hafrArgs as { selectedCardIndex?: unknown }).selectedCardIndex, ctx);
      const hasExactSelectedIndex = Object.hasOwn(hafrArgs, 'selectedCardIndex');
      const boundIndex = boundOccurrence.kind === 'live' ? boundOccurrence.index : undefined;
      const explicitIndex = typeof rawSelectedIndex === 'number' && Number.isInteger(rawSelectedIndex) && rawSelectedIndex >= 0
        ? rawSelectedIndex
        : undefined;
      const indexMismatch = boundIndex !== undefined && hasExactSelectedIndex && explicitIndex !== boundIndex;
      const idx = exactOccurrence !== undefined
        ? exactOccurrence.index
        : indexMismatch
        ? -1
        : boundIndex !== undefined
          ? (rem[boundIndex] === target ? boundIndex : -1)
          : hasExactSelectedIndex
        ? (typeof rawSelectedIndex === 'number' && Number.isInteger(rawSelectedIndex) && rawSelectedIndex >= 0 && rem[rawSelectedIndex] === target ? rawSelectedIndex : -1)
        : rem.indexOf(target);
      let moved = false;
      let handIndex = -1;
      if (idx !== -1) {
        rem.splice(idx, 1);
        advanceIndexedZoneEpoch(s, p, 'remove');
        mutate.remove.emitExit(s, p, target); // wave-4: remove→hand 離脱 (原因非依存 remove:exit)
        handIndex = s.players[p].hand.length;
        mutate.hand.add(s, p, [target]);
        moved = true;
      }
      setCardMoveBinding(ctx, hafrArgs.bind, moved ? [{ cardId: target, area: 'hand', player: p, index: handIndex }] : []);
      if (!moved && boundOccurrence.kind === 'live') (ctx.dyn ??= {}).chainStepNoApply = true;
      recordPublicZoneMove(s, ctx, p, 'remove', 'hand', moved ? 1 : 0);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', target, result: moved ? 'ok' : 'not-found' });
      return;
    }

export function atomDeckShuffle(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // rules/04, 14, 26 — デッキ基本シャッフル (D11019 等で使用)
      const p = resolvePlayer(a.player, ctx);
      mutate.deck.shuffle(s, p, ctx.rng);
      markPendingDeckRevealPresentation(p, publicEffectSource(ctx), undefined);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckShuffle' });
      return;
    }

export function atomRemoveAreaToDeckTop(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // mega-wave W6 step11 (2026-07-04, row999 item4 / P42): 「自分のリムーブエリアにあるキャラを
      //   1枚まで選び、デッキの上に移す」(B07014 rider)。handAddFromRemove 単一 path clone、
      //   dest = deck top (mutate.deck.toTop)。rules/15「まで」= 0枚可 (pick 型は n 未満可)。
      //   remove からの離脱なので remove:exit emit (wave-4 契約、handAddFromRemove と同じ)。
      // ⚠ removeAreaAllToDeckBottom (全件 bottom + shuffle) とは別 verb — 命名衝突注意 (row999 risks④)。
      const rtdP = resolvePlayer(a.player, ctx);
      const rtdArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.removeAreaToDeckTop!.defaultArea, a, rtdP, a.player as Player) }
        : a;
      const rtdTarget0 = normalizeTargetToString(rtdArgs.target);
      const resolvedRtdTarget = typeof rtdTarget0 === 'string' ? resolveBindRef(rtdTarget0, ctx) : rtdTarget0;
      const rtdTarget = typeof resolvedRtdTarget === 'string' ? resolvedRtdTarget : undefined;
      const boundOccurrence = resolveBoundOccurrenceRef(rtdTarget0, s, ctx, rtdP, 'remove');
      const selectedOccurrences = Object.hasOwn(rtdArgs, 'selectedCardOccurrences')
        ? exactSelectedCardOccurrences(rtdArgs.selectedCardOccurrences, ctx)
        : undefined;
      const exactOccurrence = selectedOccurrences?.length === 1 ? selectedOccurrences[0] : undefined;
      const exactOccurrenceInvalid = selectedOccurrences === null
        || (selectedOccurrences !== undefined && (selectedOccurrences.length !== 1
          || exactOccurrence?.area !== 'remove'
          || exactOccurrence.player !== rtdP
          || exactOccurrence.cardId !== rtdTarget
          || !isLiveCardOccurrenceWitness(s, rtdP, 'remove', exactOccurrence.occurrenceWitness)
          || s.players[rtdP].remove[exactOccurrence.index] !== exactOccurrence.cardId));
      if (boundOccurrence.kind === 'invalid' || exactOccurrenceInvalid
        || (boundOccurrence.kind === 'live' && (rtdTarget !== boundOccurrence.cardId
          || (exactOccurrence !== undefined && exactOccurrence.index !== boundOccurrence.index)))) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, { ts: Date.now(), player: rtdP, turn: s.turn.number, action: 'effect:removeAreaToDeckTop', result: 'stale-selection' });
        return;
      }
      if (!rtdTarget) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: rtdArgs }, ctx, { byPlayer: rtdP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: rtdP, turn: s.turn.number, action: 'effect:removeAreaToDeckTop:awaiting-pick' });
        return;
      }
      const rtdRem = s.players[rtdP].remove;
      const physicalIndex = exactOccurrence?.index ?? (boundOccurrence.kind === 'live' ? boundOccurrence.index : undefined);
      const rtdIdx = physicalIndex === undefined
        ? rtdRem.indexOf(rtdTarget)
        : (rtdRem[physicalIndex] === rtdTarget ? physicalIndex : -1);
      let rtdMoved = false;
      if (rtdIdx !== -1) {
        rtdRem.splice(rtdIdx, 1);
        advanceIndexedZoneEpoch(s, rtdP, 'remove');
        mutate.remove.emitExit(s, rtdP, rtdTarget); // remove→deck 離脱 (原因非依存 remove:exit)
        // engine defer-unlock mini-wave (2026-07-09): dest:'bottom' = 「デッキの下に移す」(B02076)。
        // 従来 (dest 未指定) は top 固定 (B07014) — 既存 consumer は byte 不変。
        if (a.dest === 'bottom') {
          mutate.deck.toBottom(s, rtdP, [rtdTarget]);
        } else {
          mutate.deck.toTop(s, rtdP, [rtdTarget]);
        }
        rtdMoved = true;
        recordPublicZoneMove(s, ctx, rtdP, 'remove', 'deck', 1);
        // S2 deck cluster (2026-07-10, B08057): bindKey — 移動成功分を bound へ accumulate。
        // 「カードを合わせて3枚移した場合」(boundCountCompare) の材料 + deckBottomReorderBound の
        // block 特定に使う。未指定は従来挙動 (既存 consumer B07014/B02076 は byte 不変)。
        if (typeof a.bindKey === 'string') {
          const rtdPrev = ctx.bindings[a.bindKey];
          ctx.bindings[a.bindKey] = [
            ...(Array.isArray(rtdPrev) ? rtdPrev : []),
            { kind: 'card', cardId: rtdTarget, area: 'deck', player: rtdP },
          ];
        }
      }
      // engine defer-unlock mini-wave (2026-07-09): 0枚 (skip/不在) → chainStepNoApply。「〜してもよい。
      // そうした場合、カードを1枚引く」(B02076) の chain gate (discard/partnerAreaRemove と同型)。
      // 単発 path (B07014 rider) では flag は読まれない = 挙動不変。
      if (!rtdMoved) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
      }
      mutate.log.append(s, { ts: Date.now(), player: rtdP, turn: s.turn.number, action: 'effect:removeAreaToDeckTop', target: rtdTarget, result: rtdMoved ? 'ok' : 'not-found' });
      return;
    }

export function atomRemoveAreaAllToDeckBottom(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // cluster4 (2026-06-14) B08027【登場時】: 自分と相手はリムーブエリアの「すべて」のカードを
      //   各自のデッキの下に移し、両者のデッキをシャッフルする。
      // ⚠ 'self'/'opp' は **絶対スロット** を意図的に走査する (resolvePlayer しない)。この verb は
      //   両プレイヤーに対称な操作 (各自の remove → 各自の deck → 各自 shuffle) なので、所有者相対では
      //   なく両スロット網羅で「自分と相手」を表現する。BUG-079 の owner-relative 規約とは別物。
      // rules/14・26: デッキへ移すだけで 0 にならない → これは「リフレッシュ」ではない (証拠付与なし、
      //   公式Q&A)。よって mutate.deck.refresh は呼ばず raw splice + toBottom + shuffle で行う。
      // rules/09・23: (現場からの) デッキ下移動はリムーブでないため scene-removal hook (leave:to-remove /
      //   【現場リムーブ時】) は発火しない。一方ここは **リムーブエリアからの** 離脱なので wave-4 の
      //   remove:exit (原因非依存、rules/17 類推) は離脱カード毎に発火する (refresh / handAddFromRemove と同契約)。
      // 公式テキスト通り、移動枚数 0 (remove 空) のプレイヤーも無条件でシャッフルする。
      // shuffle は ctx.rng があれば使い、無ければ mutate.deck.shuffle 内の Math.random
      //   (smoke では seeded RNG に global override されている) を使う (deckShuffle と同一契約)。
      // engine defer-unlock mini-wave (2026-07-09): args.player 指定時は **片側のみ** (B04038 白馬探
      // 「自分のリムーブエリアにあるすべてのカードを…」= player:'self'、resolvePlayer で所有者相対)。
      // 未指定は従来どおり両者対称 (B08027) — 既存 consumer は byte 不変。
      const raSlots = a.player === undefined
        ? (['self', 'opp'] as const)
        : ([resolvePlayer(a.player, ctx)] as const);
      for (const pp of raSlots) {
        const rem = s.players[pp].remove;
        const movedCount = rem.length;
        if (rem.length > 0) {
          const ids = rem.splice(0, rem.length); // ALL — remove を drain
          advanceIndexedZoneEpoch(s, pp, 'remove');
          mutate.deck.toBottom(s, pp, ids);       // 各自のデッキ下へ
          for (const cid of ids) mutate.remove.emitExit(s, pp, cid); // wave-4: remove→deck下 離脱 emit
        }
        recordPublicZoneMove(s, ctx, pp, 'remove', 'deck', movedCount);
        mutate.deck.shuffle(s, pp, ctx.rng);
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:removeAreaAllToDeckBottom' });
      return;
    }
