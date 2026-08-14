// engine.effect.atom-handlers/picks — Phase 3a 分割 (case body 無改変移送, 2026-06-22)
import { mutate } from '../../mutate/index.js';
import { pendingSource, pushPendingPickFromAtom, toPlainDeep, resolveFilterDynObj, tryRePickFromAtom } from '../resolve-picks.js';
import { pushPendingEffectPickSide } from '../pending-state.js';
import { preparePendingPickRange } from '../pick-selection.js';
import { candidates as targetCandidates } from '../../target/candidates.js';
import { removeExcludedSourceCardId } from '../../read/effect-source.js';
import { targetFilterToPredicateWithCtx, resolvePlayer, resolveBindRef, hasNorMax, paShortFormAwait, resolveDeltaToNumber, queuePendingDeckRevealSide } from './_shared.js';
import type { PendingDeckPlaceSide, PendingDeckReorderSide } from './_shared.js';
import { FILE_CARD_BACK_PLACEHOLDER, type GameState, type EffectCtx, type Candidate, type AtomVerb, type TargetingRef } from '../../types/index.js';
import type { TargetFilter } from '../../types/effect.js';
import { ensureEffectCausalTrace, markEffectCausalAwaitingResume, recordEffectCausalOperation } from '../../log/effect-causal.js';

type DeckRevealVisibility = 'public' | 'private';
type DeckRevealViewer = 'self' | 'opp' | 'all';

function resolveDeckRevealAccess(
  a: Record<string, unknown>,
  ctx: EffectCtx,
  deckOwner: 'self' | 'opp',
): { visibility: DeckRevealVisibility; viewer: DeckRevealViewer; humanCanSee: boolean } {
  const visibility: DeckRevealVisibility = a.visibility === 'public' ? 'public' : 'private';
  let viewer: DeckRevealViewer;
  if (visibility === 'public' || a.viewer === 'all') {
    viewer = 'all';
  } else if (a.viewer === 'deck-owner') {
    viewer = deckOwner;
  } else if (a.viewer === 'self' || a.viewer === 'opp') {
    viewer = resolvePlayer(a.viewer, ctx);
  } else {
    viewer = ctx.source.player;
  }
  const humanSide = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
  return { visibility, viewer, humanCanSee: viewer === 'all' || viewer === humanSide };
}

function deckRevealLogResult(
  access: { visibility: DeckRevealVisibility; viewer: DeckRevealViewer; humanCanSee: boolean },
  revealedCount: number,
  matched: string,
): string {
  const visibleMatch = access.humanCanSee ? matched : 'hidden';
  return `revealed=${revealedCount} matched=${visibleMatch} visibility=${access.visibility} viewer=${access.viewer}`;
}

/** Exact stacked occurrences use instance IDs as generic-picker UIDs. */
export function atomStackedCardPick(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
  const hostUid = resolveBindRef(a.hostUid, ctx);
  const min = a.min;
  const max = a.max;
  if (typeof hostUid !== 'string' || hostUid.startsWith('$') || typeof min !== 'number' || typeof max !== 'number' || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) return;
  // A picker promises stable instance identities through its continuation. Upgrade old
  // count-only stacks before either surfacing candidates or validating a resumed choice.
  if (!mutate.char.ensureStackedCardEntries(s, hostUid)) return;
  if (Array.isArray(a.selectedInstanceIds)) {
    if (!a.selectedInstanceIds.every((id): id is string => typeof id === 'string')) return;
    const selected = mutate.char.selectStackedCardEntries(s, hostUid, a.selectedInstanceIds, min, max);
    if (!selected) return;
    if (typeof a.bind === 'string') (ctx.bindings as Record<string, unknown>)[a.bind] = selected.map(entry => ({ kind: 'stacked', hostUid, cardId: entry.cardId, instanceId: entry.instanceId }));
    mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:stackedCardPick', target: a.selectedInstanceIds.join(',') });
    return;
  }
  const owner = (['self', 'opp'] as const).find(player => s.players[player].scene.some(c => c.uid === hostUid));
  if (!owner) return;
  const pending = preparePendingPickRange({
    player: resolvePlayer(a.player, ctx), ownerPlayer: ctx.source.player,
    candidates: mutate.char.stackedCardEntries(s, hostUid).map(entry => ({
      uid: entry.instanceId,
      cardId: FILE_CARD_BACK_PLACEHOLDER,
      player: owner,
      hidden: true,
    })),
    atomVerb: 'stackedCardPick', atomArgs: toPlainDeep(a), nMin: min, nMax: max,
    source: pendingSource(s, ctx, {
      cardId: ctx.source.cardId ?? '',
      abilityId: ctx.source.abilityId ?? '',
      uid: ctx.source.uid,
    }),
  });
  if (pending === null) {
    (ctx.dyn ??= {}).chainStepNoApply = true;
    return;
  }
  pending.atomArgs = { ...pending.atomArgs, min: pending.nMin, max: pending.nMax };
  pushPendingEffectPickSide(pending);
}

export function atomDeckRevealUntil(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const p = resolvePlayer(a.player, ctx);
      const revealAccess = resolveDeckRevealAccess(a, ctx, p);
      // mega-wave W5 (2026-07-03, r47): filter 内の {dyn} nested field を **dispatch 時** に解決
      // (B09109 a1「そのキャラと同じレベルで同じカード名」= levelMin/levelMax/cardName:{dyn:'$bound...'})。
      // resolveEffectPicks の generic 事前 walk は top-level 引数しか解決せず、また bind (chain 前段の
      // pick 結果) は実行時にしか確定しないため、handler 冒頭での解決が load-bearing。dyn 不在の filter は
      // resolveFilterDynObj が同一参照を返す = 既存カード no-op。関数 filter (legacy) は非対象。
      const rawFilter = a.filter;
      const resolvedFilter = (rawFilter !== null && typeof rawFilter === 'object')
        ? resolveFilterDynObj(s, rawFilter, ctx)
        : rawFilter;
      // BUG-045 fix: filter は declarative TargetFilter object として渡される
      // (D11019.ts 等)。predicate 関数化して使用 (旧コードは function を期待していて crash)。
      const filterArg = resolvedFilter as TargetFilter | ((cardId: string) => boolean) | undefined;
      // cluster16 G2: filterAny (OR-of-filters) を reveal-filter 経路でも honor (従来は candidates.ts
      // のみ)。意味論は candidates.ts matchesFilters と同一の AND-of(filter, OR(filterAny))。
      // a.filter が関数の場合 (legacy caller) は filterAny 非適用 (legacy は filterAny 不使用)。
      const filterAnyArg = a.filterAny as TargetFilter[] | undefined;
      let filter: (cardId: string) => boolean;
      if (typeof filterArg === 'function') {
        filter = filterArg;
      } else {
        const basePred = targetFilterToPredicateWithCtx(s, filterArg, ctx, p);
        if (Array.isArray(filterAnyArg) && filterAnyArg.length > 0) {
          const anyPreds = filterAnyArg.map(f => targetFilterToPredicateWithCtx(s, f, ctx, p));
          filter = (cardId: string) => basePred(cardId) && anyPreds.some(p => p(cardId));
        } else {
          filter = basePred;
        }
      }
      const bindKey = a.bind as string | undefined;
      const bindMatchKey = a.bindMatch as string | undefined;
      // ---- BUG-132 GAP-1 再入 path (chooseMatch pick 解決後) ----
      // take: applyPickAndContinuation (Pattern B 無マーカー分岐) が target=[cardId] を載せる。
      // decline: applyPickSkipAndContinuation が __declined:true を載せる (「〜まで」=0枚可、rules/15)。
      // window は first-run の snapshot (__windowIds) を使う — pick await 中の deck 変動に影響されない。
      if (a.__windowIds !== undefined) {
        const windowIds = a.__windowIds as string[];
        const declined = a.__declined === true;
        const chosen = declined
          ? null
          : Array.isArray(a.target) ? ((a.target as string[])[0] ?? null) : null;
        if (bindMatchKey) {
          ctx.bindings[bindMatchKey] = chosen
            ? [{ kind: 'card', cardId: chosen, area: 'deck', player: p }]
            : [];
        }
        if (bindKey) {
          // decline 時は全 reveal が「残り」(公式: 加えなければ全部デッキ下へ。B08020 公式Q&A)
          // ⚠ 本再入 path (chooseMatch) は bindMatchKey===undefined gate (下の初回 path、mini-wave #5 ①)
          //   の対象外で matched を常時除外する。bind-only + chooseMatch:'upTo' の組合せカードは現状 0 件
          //   (grep 実測) — 将来組む場合は初回/再入で $bind の内容が食い違うため gate をここにも要移植。
          let restIds: string[];
          if (chosen === null) {
            restIds = windowIds;
          } else {
            const idx = windowIds.indexOf(chosen);
            restIds = idx === -1 ? windowIds : [...windowIds.slice(0, idx), ...windowIds.slice(idx + 1)];
          }
          ctx.bindings[bindKey] = restIds.map<Candidate>(id => ({
            kind: 'card', cardId: id, area: 'deck', player: p,
          }));
        }
        // overlay: 確定 matched で再 set (awaitingPick 無し → hold 解除、通常演出で完了)
        if (revealAccess.humanCanSee) {
          queuePendingDeckRevealSide({
            player: p,
            visibility: revealAccess.visibility,
            viewer: revealAccess.viewer,
            revealed: [...windowIds],
            matched: chosen,
            presentation: a.presentation === 'reveal-return' ? 'reveal-return' : undefined,
            source: { cardId: ctx.source.cardId, abilityId: ctx.source.abilityId, uid: ctx.source.uid },
          });
        }
        mutate.log.append(s, {
          ts: Date.now(), player: p, turn: s.turn.number,
          action: 'effect:deckRevealUntil',
          result: deckRevealLogResult(revealAccess, windowIds.length, chosen ?? (declined ? 'declined' : 'none')),
        });
        return;
      }
      const deck = s.players[p].deck;
      const revealed: string[] = [];
      let matched: string | null = null;
      // engine-extension #5a (2026-06-05): maxN — "上から N 枚見る" 系。
      // maxN 指定時: 上から min(deck.length, maxN) 枚を **全件** reveal してから最初の match を選ぶ。
      //   $matched = 最初の match (or null) / $revealed = match を除いた残りの全 reveal カード。
      //   この semantics で「上から N 枚見て、その中から該当 1 枚を取り、残りはデッキ下」が成立。
      // maxN 未指定時: 従来通り (filter match まで or デッキ末尾まで reveal、match で stop)。
      // WB2 (2026-07-11, B09112): maxN が {dyn} object の場合 dispatch 時に解決 (「指定名キャラ1枚につき」=
      // {dyn:'$declared.named.sceneNameCount'})。filter dyn (L11-19) と対の処理 — resolve-picks の pre-walk は
      // declareName 実行前で literal 化できず (deferral)、handler dispatch 時が唯一の解決点。plain number は
      // resolveDeltaToNumber が同値返し = 既存 ~60 消費者 byte 互換。undefined は undefined 維持 (非 maxN 経路)。
      const maxN = a.maxN === undefined ? undefined : resolveDeltaToNumber(a.maxN, s, ctx);
      // mini-wave #5 P3 (2026-07-10): fromBottom — 「デッキ下から公開」(B03049)。走査方向のみ切替
      // (maxN 分岐 = deck 末尾から i 枚 / 非 maxN = 逆順 copy を走査)。revealed の格納順は底優先。
      // bind/bindMatch/chooseMatch/refresh は無改変。未指定 (既存 ~60 消費者) は byte 互換。
      const fromBottom = a.fromBottom === true;
      if (maxN !== undefined) {
        // 公式テキスト "上から N 枚見る" — N 枚を全件 reveal し、その中から最初の match を採用
        const lookN = Math.min(deck.length, maxN);
        for (let i = 0; i < lookN; i++) {
          const cardId = fromBottom ? deck[deck.length - 1 - i]! : deck[i]!;
          revealed.push(cardId);
          if (filter(cardId)) {
            if (matched === null) matched = cardId;
            if (a.stopAtFirstMatch === true) break;
          }
        }
      } else {
        // 従来 semantics: filter match まで 1 枚ずつ reveal、match で停止
        for (const cardId of (fromBottom ? [...deck].reverse() : deck)) {
          revealed.push(cardId);
          if (filter(cardId)) {
            matched = cardId;
            break;
          }
        }
      }
      // ---- BUG-132 GAP-1: chooseMatch:'upTo' (「1枚まで」型) — human owner は取得/decline/identity を選択 ----
      // rules/15 「〜枚まで」=0枚可 + B08020 公式Q&A「条件を満たすカードがあっても手札に加えないことは可能」。
      // owner (効果所有者) が human のときのみ pick を surface。AI は従来 path (先頭 match 自動取得 =
      // 合法手内の固定戦略、rules/15 の選択『権』であり義務でない。smoke baseline 不変)。
      // 「まで」無し forced 型 (B01048 等 10枚) は chooseMatch を持たず本分岐に入らない (従来動作が正)。
      if (a.chooseMatch === 'upTo' && maxN !== undefined) {
        const humanSide = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
        const owner = ctx.source.player;
        if (humanSide !== null && owner === humanSide) {
          // window 内の全 match を候補化 (従来は先頭 1 件のみ機械束縛 — identity 選択も surface)
          const matchCands = revealed
            .map((cardId, i) => ({ cardId, i }))
            .filter(({ cardId }) => filter(cardId));
          const pendingPick = preparePendingPickRange({
            player: owner,
            ownerPlayer: owner, // BUG-175: 座標系明示 (本 site は chooser==owner ゆえ挙動不変)
            candidates: matchCands.map(({ cardId, i }) => ({ uid: `${cardId}#${i}`, cardId, player: p })),
            atomVerb: 'deckRevealUntil',
            // 再入用に window snapshot を同梱 (deck 再走査しない)。chooseMatch 等の元 args も保持。
            // BUG-132: toPlainDeep — drafted entry.effect 由来の nested object (filter 等) を
            // plain 化して produce 境界を安全に跨ぐ (revoked-proxy crash 防止)
            atomArgs: toPlainDeep({ ...(a as Record<string, unknown>), __windowIds: [...revealed] }),
            nMin: 0, // 「まで」= 0枚可。候補0でも確認/skip decisionを明示する。
            nMax: 1,
            source: pendingSource(s, ctx, {
              cardId: ctx.source.cardId ?? '',
              abilityId: (ctx.source as { abilityId?: string }).abilityId ?? '',
            }),
            skipResolvesAtom: true,
          });
          if (pendingPick) pushPendingPickFromAtom(pendingPick);
          // overlay は hold mode — pick 解決まで公開リストを表示し続ける (自動進行しない)
          if (revealAccess.humanCanSee) {
            queuePendingDeckRevealSide({
              player: p,
              visibility: revealAccess.visibility,
              viewer: revealAccess.viewer,
              revealed: [...revealed],
              matched: null,
              awaitingPick: true,
              presentation: a.presentation === 'reveal-return' ? 'reveal-return' : undefined,
              source: { cardId: ctx.source.cardId, abilityId: ctx.source.abilityId, uid: ctx.source.uid },
            });
          }
          mutate.log.append(s, {
            ts: Date.now(), player: p, turn: s.turn.number,
            action: 'effect:deckRevealUntil',
            result: `revealed=${revealed.length} awaiting-pick matches=${matchCands.length} visibility=${revealAccess.visibility} viewer=${revealAccess.viewer}`,
          });
          // bind 未書込のまま return → resolver の queue 増加検知が残り step を pick に同梱して停止
          return;
        }
      }
      // bindings に Candidate[] として保存
      // { kind: 'card', cardId, area: 'deck', player } は Candidate の card バリアントに適合する
      if (bindKey) {
        // 旧 semantics (maxN 未指定): match は revealed の最後尾 → slice(0,-1) で除く
        // 新 semantics (maxN 指定): match は revealed の任意位置 → matched の最初の出現を除外
        // mini-wave #5 ① (2026-07-10): matched 除外は bindMatch とペアのときのみ。bindMatch 省略 =
        // 「window 全体を $bind に保持したい」用途 (B05047 の見た 2 枚全部を後段で振り分け)。filter 省略時は
        // predicate が常 true で先頭が matched になり、gate 無しだと 1 枚が意図せず欠落する。
        // 既存の bindKey 消費者 168 file は全部 bindMatch とペア (grep 実測) = 挙動不変。
        // S2 deck cluster (2026-07-10, B01022): 各 entry に reveal 時点の deck 位置 index を同梱。
        // fromGroupCards (candidates.ts) が window 内の重複 cardId を位置で区別するために必要。
        // 走査規約: revealed の k 番目 = deck[fromBottom ? deck.length-1-k : k] (maxN/非 maxN 共通)。
        // matched 除外時は位置配列を並行 slice する (indexOf 再利用だと同 cardId 重複で取り違える)。
        // index は reveal 時点の snapshot — 後続 atom が deck を mutate したら失効 (fromGroupCards の
        // pick 列挙は splice 前に行われるため B01022 系 flow では常に有効)。
        const posToDeckIdx = (k: number): number => (fromBottom ? deck.length - 1 - k : k);
        const allIdxs = revealed.map((_, k) => posToDeckIdx(k));
        let restIds: string[];
        let restIdxs: number[];
        if (matched === null || bindMatchKey === undefined) {
          restIds = revealed;
          restIdxs = allIdxs;
        } else if (maxN === undefined) {
          restIds = revealed.slice(0, -1);
          restIdxs = allIdxs.slice(0, -1);
        } else {
          // 最初の matched 出現を 1 件だけ除く (同 cardId 複数あっても 1 件のみ拾われる前提)
          const idx = revealed.indexOf(matched);
          restIds = idx === -1 ? revealed : [...revealed.slice(0, idx), ...revealed.slice(idx + 1)];
          restIdxs = idx === -1 ? allIdxs : [...allIdxs.slice(0, idx), ...allIdxs.slice(idx + 1)];
        }
        ctx.bindings[bindKey] = restIds.map<Candidate>((id, k) => ({
          kind: 'card',
          cardId: id,
          area: 'deck',
          player: p,
          index: restIdxs[k]!,
        }));
      }
      if (bindMatchKey) {
        const mPos = matched !== null ? revealed.indexOf(matched) : -1;
        ctx.bindings[bindMatchKey] = matched
          ? [{ kind: 'card', cardId: matched, area: 'deck', player: p, index: fromBottom ? deck.length - 1 - mPos : mPos }]
          : [];
      }
      // user_request 20260522_01 #12 BUG-061: UI 演出側チャネル
      // `__pendingDeckRevealSide` に revealed/matched を set。後続 atom が
      // 結果を消費する前 (sceneEnter / deckToBottomBound / shuffle 前) の
      // スナップショットとして公開する。
      if (revealed.length > 0 && revealAccess.humanCanSee) {
        queuePendingDeckRevealSide({
          player: p,
          visibility: revealAccess.visibility,
          viewer: revealAccess.viewer,
          revealed: [...revealed],
          matched,
          presentation: a.presentation === 'reveal-return' ? 'reveal-return' : undefined,
          source: { cardId: ctx.source.cardId, abilityId: ctx.source.abilityId, uid: ctx.source.uid },
        });
      }
      // BUG-073: effect log
      mutate.log.append(s, {
        ts: Date.now(), player: p, turn: s.turn.number,
        action: 'effect:deckRevealUntil',
        result: deckRevealLogResult(revealAccess, revealed.length, matched ?? 'none'),
      });
      return;
    }

export function atomDeckToBottomBound(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const p = resolvePlayer(a.player, ctx);
      const bindKey = a.bindKey as string;
      const bound = ctx.bindings[bindKey];
      if (!bound || bound.length === 0) return;
      // Candidate から cardId を抽出 → デッキ下へ
      const ids = bound.map(c => {
        const cAny = c as unknown as { cardId?: string };
        return cAny.cardId ?? '';
      }).filter(id => id !== '');
      const deck = s.players[p].deck;
      // Resolve exact occurrences without mutating. Prefer bound snapshot indexes when
      // still valid; otherwise consume the first unused matching occurrence.
      const used = new Set<number>();
      const occurrences: Array<{ cardId: string; index: number }> = [];
      for (const [position, id] of ids.entries()) {
        const candidate = bound[position] as unknown as { index?: number };
        const hinted = candidate.index;
        const index = typeof hinted === 'number' && !used.has(hinted) && deck[hinted] === id
          ? hinted
          : deck.findIndex((cardId, i) => cardId === id && !used.has(i));
        if (index === -1) continue;
        used.add(index);
        occurrences.push({ cardId: id, index });
      }
      const humanSide = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      const order = a.order === 'preserve' ? 'preserve' : 'arbitrary';
      if (order === 'arbitrary' && occurrences.length >= 2 && p === humanSide) {
        const trace = ensureEffectCausalTrace(s, ctx);
        markEffectCausalAwaitingResume(trace);
        (globalThis as { __pendingDeckReorderSide?: PendingDeckReorderSide | null }).__pendingDeckReorderSide = {
          player: p,
          cardIds: occurrences.map(entry => entry.cardId),
          deckSnapshot: [...deck],
          occurrences,
          ctx: toPlainDeep(ctx),
        };
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckToBottomBound', result: `await ${occurrences.length}` });
        return;
      }
      // AI / spectator / single-card path remains synchronous.
      for (const entry of [...occurrences].sort((a, b) => b.index - a.index)) deck.splice(entry.index, 1);
      const splicedIds = occurrences.map(entry => entry.cardId);
      mutate.deck.toBottom(s, p, splicedIds);
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckToBottomBound', result: String(splicedIds.length) });
      return;
    }

// mini-wave #5 P2 (2026-07-10): 「見た各カードを、好きな順番でデッキの上か下に移す」(B05047)。
// bound window (deckRevealUntil 公開分、まだ deck 元位置に居る) を対象に:
// - human 所有: __pendingDeckPlaceSide を立てて await (deckReorder 同型 side-channel)。カードは
//   未移動のまま (rules/26 見ている間はデッキ扱い)。UI の DeckPlaceModal → 'deckPlaceResolve'
//   dispatch が multiset 検証つきで splice + mutate.deck.toTop/toBottom を適用する。
// - AI / 非 human: 恒等 (全カード元位置のまま = 「全部を元の順で上に置く」合法 choice、
//   souza AI default = peek 順そのまま と同じ設計判断)。smoke baseline 不変。
export function atomDeckPlaceSplitBound(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const p = resolvePlayer(a.player, ctx);
      const bindKey = a.bindKey as string;
      const bound = ctx.bindings[bindKey];
      if (!bound || bound.length === 0) return;
      const ids = bound.map(c => {
        const cAny = c as unknown as { cardId?: string };
        return cAny.cardId ?? '';
      }).filter(id => id !== '');
      if (ids.length === 0) return;
      const deck = s.players[p].deck;
      const used = new Set<number>();
      const occurrences: Array<{ cardId: string; index: number }> = [];
      for (const [position, id] of ids.entries()) {
        const candidate = bound[position] as unknown as { index?: number };
        const hinted = candidate.index;
        const index = typeof hinted === 'number' && !used.has(hinted) && deck[hinted] === id
          ? hinted
          : deck.findIndex((cardId, i) => cardId === id && !used.has(i));
        if (index === -1) continue;
        used.add(index);
        occurrences.push({ cardId: id, index });
      }
      if (occurrences.length !== ids.length) return;
      const humanSide = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      // S2 B01093 (2026-07-10): 選択者 = ability owner (印字「自分が上か下かを選ぶ」)。gate を
      // 対象デッキ所有者 (p) から owner 絶対座標に是正 — B01093 は p='opp' (相手デッキ) でも
      // owner=human なら modal を出し、逆に CPU owner が human デッキを対象にしても modal を出さない。
      // B05047 (唯一の既存消費者) は player:'self' で p===owner のため挙動不変 (byte 互換)。
      const ownerAbs = ctx.source.player;
      if (ownerAbs === humanSide) {
        const trace = ensureEffectCausalTrace(s, ctx);
        markEffectCausalAwaitingResume(trace);
        (globalThis as { __pendingDeckPlaceSide?: PendingDeckPlaceSide | null }).__pendingDeckPlaceSide = {
          player: p,
          cardIds: occurrences.map(entry => entry.cardId),
          ownerPlayer: ownerAbs,
          deckSnapshot: [...deck],
          occurrences,
          ctx: toPlainDeep(ctx),
        };
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckPlaceSplitBound', result: `await ${ids.length}` });
        return;
      }
      // AI 恒等: deck に既に元順で存在するため mutation 不要
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckPlaceSplitBound', result: `identity ${ids.length}` });
      return;
    }

// S2 deck cluster (2026-07-10, B08057): 「好きな順番でデッキの下に移す」の順序選択を、
// removeAreaToDeckTop(dest:'bottom') 等で **既に deck 底へ移し終えた** bound block に対して surface する。
// atomDeckToBottomBound の BUG-136 tail (並べ替え modal) の独立 atom 版 — 本 atom 自体は deck を
// mutate しない (block は移動順という合法な一 choice で既置。human のみ DeckReorderModal →
// 'deckReorderResolve' が deck 末尾 multiset 検証つきで並べ替える)。AI / 非 human は恒等。
// ⚠ 前提: bound block の移送と本 atom の間に他の bottom 操作を挟まないこと (multiset 不一致で
// 並べ替えが silent no-op になる)。B08057 は直前 3 step の連続移送 → 最終 step 配置で満たす。
export function atomDeckBottomReorderBound(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const p = resolvePlayer(a.player, ctx);
      const bound = ctx.bindings[a.bindKey as string];
      if (!bound || !Array.isArray(bound) || bound.length === 0) return;
      const ids = bound
        .map(c => (c as unknown as { cardId?: string }).cardId ?? '')
        .filter(id => id !== '');
      const humanSide = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      if (ids.length >= 2 && p === humanSide) {
        const trace = ensureEffectCausalTrace(s, ctx);
        markEffectCausalAwaitingResume(trace);
        (globalThis as { __pendingDeckReorderSide?: PendingDeckReorderSide | null }).__pendingDeckReorderSide = {
          player: p,
          cardIds: [...ids],
          ctx: toPlainDeep(ctx),
        };
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckBottomReorderBound', result: `await ${ids.length}` });
        return;
      }
      // AI / 1 枚以下: 移動順のまま (恒等)
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckBottomReorderBound', result: `identity ${ids.length}` });
      return;
    }

export function atomBoundToRemove(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // wave#2 cluster2 (2026-06-12): bound window (deckRevealUntil 公開分) をリムーブエリアへ移す
      // (B09073 a2「残りをリムーブエリアに移す」)。rules/26: 見ている間はデッキ扱い → 本 verb で
      // 初めてデッキから出る。deckToBottomBound と同じ splice 防御 (BUG-132 窓侵食複製ガード):
      // 実際に splice できた id のみ remove へ。移送完了後にデッキ 0 なら refresh
      // (B09073 qAndA「残りをリムーブエリアに移す。まで解決したところでリフレッシュ」/ rules/14。
      // 直前に remove へ移したカード自身も shuffle 対象 — rules/26 リムーブエリア遷移)。
      const p = resolvePlayer(a.player, ctx);
      const bindKey = a.bindKey as string;
      const bound = ctx.bindings[bindKey];
      const refreshAfter = a.refreshAfter === true;
      const refreshAndRecord = (removeBeforeRefresh: number, refreshesBefore: number): void => {
        mutate.deck.refreshAfterTake(s, p, removeExcludedSourceCardId(ctx, p));
        const refreshed = (s.refreshCount[p] ?? 0) > refreshesBefore;
        const returnedFromRemove = removeBeforeRefresh - s.players[p].remove.length;
        if (refreshed && returnedFromRemove > 0) {
          recordEffectCausalOperation(s, ctx, {
            actor: ctx.source.player,
            kind: 'zone-move',
            tags: ['refresh'],
            source: { kind: 'zone', side: p, zone: 'remove' },
            targets: [{ kind: 'zone', side: p, zone: 'deck' }],
            outcome: { type: 'move', from: 'remove', to: 'deck', count: returnedFromRemove },
          });
        }
      };
      if (!bound || bound.length === 0) {
        if (!refreshAfter) return;
        const removeBeforeRefresh = s.players[p].remove.length;
        const refreshesBefore = s.refreshCount[p] ?? 0;
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:boundToRemove', result: '0' });
        refreshAndRecord(removeBeforeRefresh, refreshesBefore);
        return;
      }
      const ids = bound.map(c => {
        const cAny = c as unknown as { cardId?: string };
        return cAny.cardId ?? '';
      }).filter(id => id !== '');
      const deck = s.players[p].deck;
      const splicedIds: string[] = [];
      for (const id of ids) {
        const idx = deck.indexOf(id);
        if (idx !== -1) {
          deck.splice(idx, 1);
          splicedIds.push(id);
        }
      }
      const removeBeforeRefresh = s.players[p].remove.length;
      const refreshesBefore = s.refreshCount[p] ?? 0;
      mutate.remove.add(s, p, splicedIds);
      // The cards have left the deck before a zero-card refresh is evaluated.
      // Keep the observable log in the same causal order as the mutation.
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:boundToRemove', result: String(splicedIds.length) });
      if (splicedIds.length > 0) {
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: 'zone-move',
          source: { kind: 'zone', side: p, zone: 'deck' },
          targets: [{ kind: 'zone', side: p, zone: 'remove' }],
          outcome: { type: 'move', from: 'deck', to: 'remove', count: splicedIds.length },
        });
      }
      if (splicedIds.length > 0 || refreshAfter) {
        refreshAndRecord(removeBeforeRefresh + splicedIds.length, refreshesBefore);
      }
      return;
    }

export function atomSouza(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // rules/13 §捜査X: defender (player) のデッキ上 X 枚を、defender の好きな順で
      // デッキの下に移す。Sub-task A (Phase 5 advance): peek 順そのまま (= defender が
      // 順番変更しない default)。AI policy chooseSouzaOrder は将来 Sub-task B/C で
      // listener / dispatcher 経由で呼ぶ予定。「発見された」参照効果は scope 外。
      const player = resolvePlayer(a.player, ctx);
      // S2 deck cluster (2026-07-10, B02072): x:{dyn} 対応 — chain 経路は pre-walk (resolveDynArgs) を
      // 通らないため handler 側で数値化する (BUG-114 resolveDeltaToNumber と同型。number は素通り =
      // 既存 literal 消費者 byte 互換)。「捜査X — Xは自分の現場の[警察]の数」= x:{dyn:'$self.sceneTrait.警察'}。
      const x = resolveDeltaToNumber(a.x, s, ctx);
      const deck = s.players[player].deck;
      const count = Math.min(x, deck.length);
      if (count === 0) {
        mutate.log.append(s, {
          ts: Date.now(),
          player,
          turn: s.turn.number,
          action: 'souza',
          target: '',
          result: 'no-op (deck empty)',
        });
        return;
      }
      const top = deck.splice(0, count);
      // engine additive wave (2026-06-29d): souza bind — 「発見された」(=公開した) カードを ctx.bindings へ
      // 束ねる (B01084「レベル5以上のカードが発見された場合」等)。consumer は既存 boundMatchesFilter
      // (bound[0]、捜査1=X1 で単一)。bind 未指定なら従来通り束ねない (回帰0)。card area の Candidate
      // (cardId のみ参照、deckToBottomBound と同型)。⚠ X>1 の「いずれか発見」は boundMatchesFilter が
      // bound[0] のみ評価するため未対応 (将来 any-match cond の follow-up、現需要 B01084/B01095 は X=1)。
      const souzaBindKey = a.bind as string | undefined;
      if (souzaBindKey) {
        ctx.bindings[souzaBindKey] = top.map<Candidate>(id => ({ kind: 'card', cardId: id, area: 'deck', player }));
      }
      mutate.deck.toBottom(s, player, top);
      mutate.log.append(s, {
        ts: Date.now(),
        player,
        turn: s.turn.number,
        action: 'souza',
        target: '',
        result: `revealed ${count}`,
      });
      // BUG-136 水平展開: 捜査X も「(defender の)好きな順番でデッキの下に移す」(rules/13)。
      // deckToBottomBound と同じく defender が human & 2 枚以上のとき順序選択 modal を surface。
      const humanSideS = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      if (count >= 2 && player === humanSideS) {
        const trace = ensureEffectCausalTrace(s, ctx);
        markEffectCausalAwaitingResume(trace);
        (globalThis as { __pendingDeckReorderSide?: PendingDeckReorderSide | null }).__pendingDeckReorderSide = {
          player,
          cardIds: [...top],
          ...(trace ? { ctx: toPlainDeep(ctx) } : {}),
        };
      }
      return;
    }

// engine mega-wave W4 (2026-07-03, r82 G33): bindPick — 状態変化なしの pick-only atom。
// 「キャラを1枚まで選ぶ。そのキャラが〜の場合…/〜の場合…」(B08035) の共有 pick を担う。
// bind 書込は atom-handlers.ts runAtom 冒頭の pick-bind writeback preamble (Task D E0) が行うため、
// 本 handler は PA 短縮形 await と log のみ (二重書込しない)。preamble との結合は意図的 — preamble を
// 変更する場合は本 atom も必ず回帰確認すること。decline ('$pick' 残置) は bind 無し = 後続
// conditional{fromBound} が not-matched で正しく no-op (rules/15「まで」=0枚可)。
export function atomBindPick(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
  const rawCardIds = a.cardIds;
  if (rawCardIds === '$pick.cardIds') {
    if (a.target && typeof a.target === 'object') {
      tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, {
        byPlayer: ctx.source.player,
        source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
      });
    }
    return;
  }
  if (Array.isArray(rawCardIds)) {
    const target = a.target as TargetingRef | undefined;
    const available = target ? targetCandidates(s, target, ctx) : [];
    const remaining = available.filter((candidate): candidate is Extract<Candidate, { kind: 'card' }> => candidate.kind === 'card');
    const selected: Array<Extract<Candidate, { kind: 'card' }>> = [];
    const hasExactIndexes = Object.hasOwn(a, 'selectedDeckIndexes');
    const selectedIndexes = Array.isArray(a.selectedDeckIndexes)
      ? a.selectedDeckIndexes.map((index) => resolveBindRef(index, ctx))
      : null;
    const cardIds = rawCardIds.filter((cardId): cardId is string => typeof cardId === 'string');
    const exactSelectionIsValid = !hasExactIndexes || (
      selectedIndexes !== null
      && selectedIndexes.length === cardIds.length
      && selectedIndexes.every((index): index is number => typeof index === 'number' && Number.isInteger(index) && index >= 0)
      && new Set(selectedIndexes).size === selectedIndexes.length
    );
    for (const [position, cardId] of cardIds.entries()) {
      if (typeof cardId !== 'string') continue;
      const selectedIndex = exactSelectionIsValid ? selectedIndexes?.[position] : undefined;
      const index = remaining.findIndex((candidate) => candidate.cardId === cardId && (
        !hasExactIndexes || candidate.index === selectedIndex
      ));
      if (index === -1) continue;
      selected.push(remaining[index]!);
      remaining.splice(index, 1);
    }
    if (typeof a.bind === 'string') (ctx.bindings as Record<string, unknown>)[a.bind] = exactSelectionIsValid && selected.length === cardIds.length ? selected : [];
    mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:bindPick', target: selected.map((candidate) => candidate.cardId).join(',') });
    return;
  }
  if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
    paShortFormAwait(s, verb, a, ctx, resolvePlayer(a.player, ctx), 'either');
    return;
  }
  const bpUid = resolveBindRef(a.uid, ctx) as string;
  if (typeof bpUid !== 'string' || bpUid.startsWith('$')) return;
  // binding は preamble で書込済。可観測性のため log のみ残す。
  mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:bindPick', target: bpUid });
}
