// engine.effect.atom-handlers/picks — Phase 3a 分割 (case body 無改変移送, 2026-06-22)
import { mutate } from '../../mutate/index.js';
import { pushPendingPickFromAtom, toPlainDeep, resolveFilterDynObj } from '../resolve-picks.js';
import { targetFilterToPredicate, resolvePlayer, resolveBindRef, hasNorMax, paShortFormAwait } from './_shared.js';
import type { Player, PendingDeckRevealSide, PendingDeckReorderSide } from './_shared.js';
import type { GameState, EffectCtx, Candidate, AtomVerb } from '../../types/index.js';
import type { TargetFilter } from '../../types/effect.js';

export function atomDeckRevealUntil(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const p = resolvePlayer(a.player, ctx);
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
        const basePred = targetFilterToPredicate(filterArg);
        if (Array.isArray(filterAnyArg) && filterAnyArg.length > 0) {
          const anyPreds = filterAnyArg.map(f => targetFilterToPredicate(f));
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
        (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | null }).__pendingDeckRevealSide = {
          player: p,
          revealed: [...windowIds],
          matched: chosen,
        };
        mutate.log.append(s, {
          ts: Date.now(), player: p, turn: s.turn.number,
          action: 'effect:deckRevealUntil',
          result: `revealed=${windowIds.length} matched=${chosen ?? (declined ? 'declined' : 'none')}`,
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
      const maxN = a.maxN as number | undefined;
      if (maxN !== undefined) {
        // 公式テキスト "上から N 枚見る" — N 枚を全件 reveal し、その中から最初の match を採用
        const lookN = Math.min(deck.length, maxN);
        for (let i = 0; i < lookN; i++) {
          revealed.push(deck[i]!);
        }
        for (const cardId of revealed) {
          if (filter(cardId)) {
            matched = cardId;
            break;
          }
        }
      } else {
        // 従来 semantics: filter match まで 1 枚ずつ reveal、match で停止
        for (const cardId of deck) {
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
          if (matchCands.length > 0) {
            pushPendingPickFromAtom({
              player: owner,
              ownerPlayer: owner, // BUG-175: 座標系明示 (本 site は chooser==owner ゆえ挙動不変)
              candidates: matchCands.map(({ cardId, i }) => ({ uid: `${cardId}#${i}`, cardId, player: p })),
              atomVerb: 'deckRevealUntil',
              // 再入用に window snapshot を同梱 (deck 再走査しない)。chooseMatch 等の元 args も保持。
              // BUG-132: toPlainDeep — drafted entry.effect 由来の nested object (filter 等) を
              // plain 化して produce 境界を安全に跨ぐ (revoked-proxy crash 防止)
              atomArgs: toPlainDeep({ ...(a as Record<string, unknown>), __windowIds: [...revealed] }),
              nMin: 0, // 「まで」= 0枚可 → EffectPickerModal が「対象を選ばない」を表示 (既存配線)
              nMax: 1,
              source: {
                cardId: ctx.source.cardId ?? '',
                abilityId: (ctx.source as { abilityId?: string }).abilityId ?? '',
              },
              skipResolvesAtom: true,
            });
            // overlay は hold mode — pick 解決まで公開リストを表示し続ける (自動進行しない)
            (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | null }).__pendingDeckRevealSide = {
              player: p,
              revealed: [...revealed],
              matched: null,
              awaitingPick: true,
            };
            mutate.log.append(s, {
              ts: Date.now(), player: p, turn: s.turn.number,
              action: 'effect:deckRevealUntil',
              result: `revealed=${revealed.length} awaiting-pick (matches=${matchCands.length})`,
            });
            // bind 未書込のまま return → resolver の queue 増加検知が残り step を pick に同梱して停止
            return;
          }
          // match 0 件 → 従来 path へ fallthrough ($matched=[] bind、conditional 不発)
        }
      }
      // bindings に Candidate[] として保存
      // { kind: 'card', cardId, area: 'deck', player } は Candidate の card バリアントに適合する
      if (bindKey) {
        // 旧 semantics (maxN 未指定): match は revealed の最後尾 → slice(0,-1) で除く
        // 新 semantics (maxN 指定): match は revealed の任意位置 → matched の最初の出現を除外
        let restIds: string[];
        if (matched === null) {
          restIds = revealed;
        } else if (maxN === undefined) {
          restIds = revealed.slice(0, -1);
        } else {
          // 最初の matched 出現を 1 件だけ除く (同 cardId 複数あっても 1 件のみ拾われる前提)
          const idx = revealed.indexOf(matched);
          restIds = idx === -1 ? revealed : [...revealed.slice(0, idx), ...revealed.slice(idx + 1)];
        }
        ctx.bindings[bindKey] = restIds.map<Candidate>(id => ({
          kind: 'card',
          cardId: id,
          area: 'deck',
          player: p,
        }));
      }
      if (bindMatchKey) {
        ctx.bindings[bindMatchKey] = matched
          ? [{ kind: 'card', cardId: matched, area: 'deck', player: p }]
          : [];
      }
      // user_request 20260522_01 #12 BUG-061: UI 演出側チャネル
      // `__pendingDeckRevealSide` に revealed/matched を set。後続 atom が
      // 結果を消費する前 (sceneEnter / deckToBottomBound / shuffle 前) の
      // スナップショットとして公開する。
      if (revealed.length > 0) {
        (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | null }).__pendingDeckRevealSide = {
          player: p,
          revealed: [...revealed],
          matched,
        };
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckRevealUntil', result: `revealed=${revealed.length} matched=${matched ?? 'none'}` });
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
      // 元のデッキから該当 ID を除去 (deckRevealUntil で公開された分はまだデッキにある)
      // BUG-132 GAP-1 防御: 実際に splice できた id のみ bottom へ移す。chooseMatch の pick await 中に
      // 他 pending entry が deck を消費した場合 (同時 trigger の window 侵食、低確率)、deck に無い id を
      // 無条件 push すると複製が生まれるため (敵対レビュー impl lens 指摘)。
      const deck = s.players[p].deck;
      const splicedIds: string[] = [];
      for (const id of ids) {
        const idx = deck.indexOf(id);
        if (idx !== -1) {
          deck.splice(idx, 1);
          splicedIds.push(id);
        }
      }
      mutate.deck.toBottom(s, p, splicedIds);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckToBottomBound', result: String(splicedIds.length) });
      // BUG-136: 「残りを好きな順番でデッキの下に移す」の順序選択を human に surface。
      // 公開順 (splicedIds 順) は既に合法な一choice として底へ置かれている。human 所有 & 2 枚以上のときのみ
      // 並べ替え modal を出す (1 枚以下は順序が無意味、AI/spectator/smoke は __humanPlayerSide が当該 player
      // でないため byte-equal)。底ブロック = deck 末尾 splicedIds.length 件。
      const humanSide = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      if (splicedIds.length >= 2 && p === humanSide) {
        (globalThis as { __pendingDeckReorderSide?: PendingDeckReorderSide | null }).__pendingDeckReorderSide = {
          player: p,
          cardIds: [...splicedIds],
        };
      }
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
      if (!bound || bound.length === 0) return;
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
      mutate.remove.add(s, p, splicedIds);
      if (s.players[p].deck.length === 0) {
        const r = mutate.deck.refresh(s, p);
        if (!r.ok && s.gameResult === undefined) {
          const winner: Player = p === 'self' ? 'opp' : 'self';
          mutate.gameResult.set(s, winner, 'deck-out');
        }
      }
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:boundToRemove', result: String(splicedIds.length) });
      return;
    }

export function atomSouza(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // rules/13 §捜査X: defender (player) のデッキ上 X 枚を、defender の好きな順で
      // デッキの下に移す。Sub-task A (Phase 5 advance): peek 順そのまま (= defender が
      // 順番変更しない default)。AI policy chooseSouzaOrder は将来 Sub-task B/C で
      // listener / dispatcher 経由で呼ぶ予定。「発見された」参照効果は scope 外。
      const player = resolvePlayer(a.player, ctx);
      const x = a.x as number;
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
        (globalThis as { __pendingDeckReorderSide?: PendingDeckReorderSide | null }).__pendingDeckReorderSide = {
          player,
          cardIds: [...top],
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
  if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
    paShortFormAwait(s, verb, a, ctx, resolvePlayer(a.player, ctx), 'either');
    return;
  }
  const bpUid = resolveBindRef(a.uid, ctx) as string;
  if (typeof bpUid !== 'string' || bpUid.startsWith('$')) return;
  // binding は preamble で書込済。可観測性のため log のみ残す。
  mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:bindPick', target: bpUid });
}
