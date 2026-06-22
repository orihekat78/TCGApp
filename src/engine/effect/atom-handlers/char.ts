// engine.effect.atom-handlers/char — Phase 3a 分割 (case body 無改変移送, 2026-06-22)
import { mutate } from '../../mutate/index.js';
import { tryRePickFromAtom } from '../resolve-picks.js';
import { isShortFormDelta } from '../atom-pick-spec.js';
import { resolvePlayer, resolveBindRef, resolveDeltaToNumber, hasNorMax, paShortFormAwait } from './_shared.js';
import type { Player } from './_shared.js';
import type { GameState, AtomVerb, EffectCtx } from '../../types/index.js';

export function atomCharModifyAP(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // D11014 a1 driver: PA 短縮形 — uid 不在 + delta + n/max なら pick query 構築 + tryRePickFromAtom
      // (sceneRemove 短縮形と同 pattern。「キャラを1枚まで選び AP±N」を declarative に表現)
      if (a.uid === undefined && isShortFormDelta(a.delta) && hasNorMax(a)) {
        // PA 短縮形 (dyn-delta 対応): side 既定='either', chooser=controller。
        // delta:{dyn} は pushPendingEffectPickSide / AI 経路の resolveDynArgs で literal 化される (BUG-085)。
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, 'either');
        return;
      }
      // skip-unresolved: max:N の pick が user skip (pickedUid=null) で resolve された後の handler 呼出
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyAP', result: 'skipped' });
        return;
      }
      const maUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof maUid !== 'string' || maUid.startsWith('$')) return;
      const maDelta = resolveDeltaToNumber(a.delta, s, ctx);
      const maScope = a.scope as 'turn' | 'contact' | 'permanent' | 'action';
      mutate.char.modifyAP(s, maUid, maDelta, maScope);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyAP', target: maUid, result: `${maDelta >= 0 ? '+' : ''}${maDelta}/${maScope}` });
      return;
    }

export function atomCharModifyLP(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // PA 短縮形 (charModifyAP と同型, dyn-delta 対応): chooser/byPlayer=ctx.source.player, side 既定='either'。
      if (a.uid === undefined && isShortFormDelta(a.delta) && hasNorMax(a)) {
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, 'either');
        return;
      }
      // skip-unresolved: max:N の pick が user skip (pickedUid=null) で resolve された後の handler 呼出。
      // 機能的には下の startsWith('$') guard でも return するが、charModifyAP/Level と対称化し 'skipped' log を残す
      // (2026-06-08 adversarial review でハンドラ非対称を指摘)。
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLP', result: 'skipped' });
        return;
      }
      const mlUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof mlUid !== 'string' || mlUid.startsWith('$')) return;
      const mlDelta = resolveDeltaToNumber(a.delta, s, ctx);
      const mlScope = a.scope as 'turn' | 'contact' | 'permanent' | 'action';
      mutate.char.modifyLP(s, mlUid, mlDelta, mlScope);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLP', target: mlUid, result: `${mlDelta >= 0 ? '+' : ''}${mlDelta}/${mlScope}` });
      return;
    }

export function atomCharModifyLevel(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine-extension #2 (2026-06-05): PA 短縮形 (charModifyAP/LP と同型, dyn-delta 対応)
      if (a.uid === undefined && isShortFormDelta(a.delta) && hasNorMax(a)) {
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, 'either');
        return;
      }
      // skip-unresolved: max:N の pick が user skip (pickedUid=null) で resolve された後の handler 呼出
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLevel', result: 'skipped' });
        return;
      }
      const mlvUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof mlvUid !== 'string' || mlvUid.startsWith('$')) return;
      const mlvDelta = resolveDeltaToNumber(a.delta, s, ctx);
      const mlvScope = a.scope as 'turn' | 'contact' | 'permanent' | 'action';
      mutate.char.modifyLevel(s, mlvUid, mlvDelta, mlvScope);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLevel', target: mlvUid, result: `${mlvDelta >= 0 ? '+' : ''}${mlvDelta}/${mlvScope}` });
      return;
    }

export function atomCharOverrideAP(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-068: bind ref 解決を配線
      const oaUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof oaUid !== 'string' || oaUid.startsWith('$')) return;
      const oaVal = a.val as number | null;
      mutate.char.setOverrideAP(s, oaUid, oaVal);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charOverrideAP', target: oaUid, result: oaVal === null ? 'reset' : String(oaVal) });
      return;
    }

export function atomCharOverrideLP(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-068: bind ref 解決を配線
      const olUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof olUid !== 'string' || olUid.startsWith('$')) return;
      const olVal = a.val as number | null;
      mutate.char.setOverrideLP(s, olUid, olVal);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charOverrideLP', target: olUid, result: olVal === null ? 'reset' : String(olVal) });
      return;
    }

export function atomCharGrantKeyword(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // Task D E0 addendum (2026-06-12): PA 短縮形対応 (B09032 解禁条件)。
      // 明示 uid:'$pick'+target 形は初期 walk push となり human 経路で後続 step の bind が
      // 喪失するため、pick carrier に使う場合は短縮形 (runtime push) が必須。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, resolvePlayer(a.player, ctx));
        return;
      }
      if (a.uid === '$pick' && (a as { target?: unknown }).target === undefined) {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantKeyword', result: 'skipped' });
        return;
      }
      // user_request 20260522_01 #12 fix: $matched.uid 等の bind ref 解決
      const grantUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof grantUid !== 'string' || grantUid.startsWith('$')) return;
      const grantKw = a.kw as string;
      const grantScope = (a.scope as 'turn' | 'contact' | 'permanent' | undefined) ?? 'permanent';
      mutate.char.grantKeyword(s, grantUid, grantKw, grantScope);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantKeyword', target: grantUid, result: `${grantKw}/${grantScope}` });
      return;
    }

export function atomCharRevokeKeyword(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const revokeUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof revokeUid !== 'string' || revokeUid.startsWith('$')) return;
      const revokeKw = a.kw as string;
      mutate.char.revokeKeyword(s, revokeUid, revokeKw);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charRevokeKeyword', target: revokeUid, result: revokeKw });
      return;
    }

export function atomCharDisableOriginal(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-068: bind ref 解決を配線
      const doUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof doUid !== 'string' || doUid.startsWith('$')) return;
      mutate.char.disableOriginalAbilities(s, doUid);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charDisableOriginal', target: doUid });
      return;
    }

export function atomCharGrantAbility(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // Task D E4 (2026-06-12): triggered ability の動的付与。args:
      //   { uid|'$pick'+target, ability: { id?, trigger, condition?, limit?, effect }, scope:'turn' }
      // descriptor は turnEffects.grantedAbilities[] に積まれ、triggered.ts handleHook が
      // def.abilities と合算走査。清掃は clearTurnEffects('turn')。validate.ts が JSON 性と
      // trigger.hook の許可リストを enforce (rules/15, 19)。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, resolvePlayer(a.player, ctx));
        return;
      }
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantAbility', result: 'skipped' });
        return;
      }
      const cgaUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof cgaUid !== 'string' || cgaUid.startsWith('$')) return;
      const abilitySpec = a.ability;
      if (!abilitySpec || typeof abilitySpec !== 'object') return;
      const spec = abilitySpec as Record<string, unknown>;
      // granted id namespace (limit:{turn} の declaredUseCount キーとして機能する)
      const grantedId = typeof spec.id === 'string'
        ? spec.id
        : `granted:${ctx.source.cardId ?? '?'}:${ctx.source.abilityId ?? '?'}`;
      const grantedDef = {
        ...spec,
        id: grantedId,
        type: 'triggered',
        scope: 'on-scene',
        description: typeof spec.description === 'string' ? spec.description : '(granted)',
      };
      mutate.char.grantAbility(s, cgaUid, grantedDef);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantAbility', target: cgaUid, result: grantedId });
      return;
    }

export function atomCharSetTurnEffect(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const teUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof teUid !== 'string' || teUid.startsWith('$')) return;
      const teKey = a.key as string;
      mutate.char.setTurnEffect(s, teUid, teKey, a.val);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetTurnEffect', target: teUid, result: `${teKey}=${String(a.val)}` });
      return;
    }

export function atomCharSetCard(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine-extension #5b PA短縮形 (2026-06-05 残課題解消):
      // uid 未指定 + fromDeckTop + n/max で「キャラを N 枚まで選び、デッキ上端を裏向きでセット」
      // を declarative に表現できる (B02020/B02023/B02030 系)。sceneRemove/sceneToHand と同型。
      if (a.uid === undefined && a.fromDeckTop && typeof a.player === 'string' && hasNorMax(a)) {
        // scsP = deck-source / 既定 side (a.player 側、'opp' なら相手の現場/デッキを対象)。
        // BUG-120: 選択者 (chooser/byPlayer) は a.player ではなく **controller** (ctx.source.player)。
        //   旧コードは byPlayer=scsP を渡し、player:'opp' (B02020/B03032) で『controller が相手キャラを
        //   選ぶ』が「相手が選ぶ」に化けていた (charModifyAP/LP/Level は byPlayer=ctx.source.player で正)。
        //   deck-source は後段 resolve (L798 resolvePlayer(a.player)) が a.player を別途参照するため不変。
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, resolvePlayer(a.player, ctx));
        return;
      }
      // skip-unresolved: max:N の pick が user skip (pickedUid=null) で resolve された後の handler 呼出
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', result: 'skipped' });
        return;
      }
      // BUG-068: bind ref 解決を配線
      const scUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof scUid !== 'string' || scUid.startsWith('$')) return;
      // engine-extension #5b (2026-06-05): fromDeckTop オプション。
      // 「自分のデッキのカードを上から1枚裏向きでセットする」(B02018/B02020/B02023/B02030/B08054)
      // 系で使用。a.player (既定 'self') の deck.shift で 1 枚 splice → そのまま setCard。
      // (cardId 引数は無視、自動補完される)
      let scCardId: string;
      if (a.fromDeckTop) {
        const sscP = resolvePlayer(a.player ?? 'self', ctx);
        const sscDeck = s.players[sscP].deck;
        if (sscDeck.length === 0) {
          mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', target: scUid, result: 'empty-deck' });
          return;
        }
        scCardId = sscDeck.shift()!;
      } else {
        scCardId = resolveBindRef(a.cardId, ctx) as string;
        if (typeof scCardId !== 'string' || scCardId.startsWith('$')) return;
      }
      mutate.char.setCard(s, scUid, scCardId, a.faceUp as boolean);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', target: scUid, result: scCardId });
      return;
    }

export function atomCharStackCard(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // D08021 driver 2026-05-26: sceneEnter (line 374) と同型の pick-await + source-area cleanup pattern を流用。
      //   - 旧 contract: { uid, n } → 即 stackedCards += n (本パスを末尾に維持)
      //   - 新 contract: { uid:'$self', cardIds:'$pick.cardIds', target:{kind:'pick',...,n:{min,max}} }
      //     → cardIds 未解決時 side-channel queue で modal、resolve 後に
      //       stack count=cardIds.length + 各 cardId を source area から splice
      //   - multi-pick (n>1) は UI 側 (CardListModal nMax>1 multi-select) と
      //     useEngineDispatch.ts effectPickResolve dispatcher の協調で実装。
      const stUid = resolveBindRef(a.uid, ctx) as string;
      const rawCardIds = a.cardIds;
      // 新 multi-pick contract: cardIds が array (resolved) or '$pick.cardIds' (await)
      if (rawCardIds === '$pick.cardIds') {
        if (a.target && typeof a.target === 'object') {
          const ctxP = ctx.source.player ?? 'self';
          // D08021 driver 2026-05-26: $self は ctx.source.uid に依存するが、effectPickResolve
          // 経由の re-dispatch では ctx.source.uid が drop される (useEngineDispatch.ts は
          // { player, cardId } のみ渡す)。tryRePickFromAtom 呼出時点で stUid に置換しておき、
          // 再 dispatch 時に handler が resolveBindRef を再実行しても解決済 uid を使えるよう保証。
          const argsWithResolvedUid = { ...a, uid: stUid };
          tryRePickFromAtom(s, { kind: 'atom', verb, args: argsWithResolvedUid }, ctx, {
            byPlayer: ctxP,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, {
            ts: Date.now(), player: ctxP, turn: s.turn.number,
            action: 'effect:charStackCard:awaiting-pick',
          });
        }
        return; // pick query 無し or await 完了 → no-op return
      }
      if (Array.isArray(rawCardIds)) {
        const cardIds = rawCardIds as string[];
        if (cardIds.length === 0) {
          // skip (n.min=0 で 0 枚 pick) → no-op + log
          mutate.log.append(s, {
            ts: Date.now(), player: ctx.source.player, turn: s.turn.number,
            action: 'effect:charStackCard', target: stUid, result: '0',
          });
          return;
        }
        const sourceArea = ((a.target && typeof a.target === 'object')
          ? ((a.target as { query?: { area?: string; side?: string } }).query?.area)
          : undefined) as 'remove' | 'hand' | 'deck' | undefined;
        const sourceSide = ((a.target && typeof a.target === 'object')
          ? ((a.target as { query?: { side?: string } }).query?.side)
          : undefined) as 'self' | 'opp' | undefined;
        const ownerP = ctx.source.player ?? 'self';
        if (sourceArea === 'remove' || sourceArea === 'hand' || sourceArea === 'deck') {
          const fromPlayer = sourceSide === 'opp' ? 'opp' : ownerP;
          const arr = (s.players[fromPlayer] as unknown as Record<string, string[]>)[sourceArea];
          for (const cid of cardIds) {
            const idx = arr?.indexOf(cid) ?? -1;
            if (idx !== -1) arr.splice(idx, 1);
          }
        }
        mutate.char.stackCard(s, stUid, cardIds.length);
        mutate.log.append(s, {
          ts: Date.now(), player: ownerP, turn: s.turn.number,
          action: 'effect:charStackCard', target: stUid, result: cardIds.join(','),
        });
        return;
      }
      // legacy: { uid, n }
      const stN = a.n as number;
      mutate.char.stackCard(s, stUid, stN);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charStackCard', target: stUid, result: String(stN) });
      return;
    }
