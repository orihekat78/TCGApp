// engine.effect.atom-handlers/scene — Phase 3a 分割 (case body 無改変移送, 2026-06-22)
import { mutate } from '../../mutate/index.js';
import { event } from '../../event/index.js';
import { tryRePickFromAtom } from '../resolve-picks.js';
import { buildShortFormPick } from '../atom-pick-spec.js';
import { sceneCap } from '../../read/scene-cap.js'; // engine E3 P11 (2026-07-02): 現場登場上限 (既定5、case override 可)
import { char as readChar } from '../../read/char.js'; // engine mega-wave W4 (2026-07-03, r1): 保護 rider gate
import { def as readDef } from '../../read/def.js'; // S2 wave (2026-07-11, PR279): event-source 限定保護の kind 判定
import { removeExcludedSourceCardId } from '../../read/effect-source.js';
import {
  requireField,
  resolvePlayer,
  resolveBindRef,
  hasNorMax,
  paShortFormAwait,
  readHeldHiramekiSelfClaim,
  resolveBoundOccurrenceRef,
} from './_shared.js';
import { allCardNameComponentsForDef } from '../../target/card-def-registry.js';
import {
  pushPendingEffectChoiceSide,
  setPendingChoiceBindings,
  setPendingChoiceResume,
  toPlainDeep,
} from '../pending-state.js';
import type { Player } from './_shared.js';
import type { GameState, AtomVerb, EffectCtx, Candidate, Effect, PublicCausalZone } from '../../types/index.js';
import { recordEffectCausalOperation } from '../../log/effect-causal.js';
import { advanceIndexedZoneEpoch } from '../../state/indexed-zone-epoch.js';
import { isLiveCardOccurrenceWitness } from '../../target/card-occurrence.js';
import {
  advanceDeckEpochAndRebaseBindings,
  isLiveDeckOccurrenceAuthority,
} from '../deck-occurrence-authority.js';

function recordPublicZoneMove(
  s: GameState,
  ctx: EffectCtx,
  fromSide: Player,
  from: PublicCausalZone,
  toSide: Player,
  to: PublicCausalZone,
  count: number,
  kind: 'zone-move' | 'evidence' = 'zone-move',
): void {
  if (count < 1) return;
  recordEffectCausalOperation(s, ctx, {
    actor: ctx.source.player,
    kind,
    source: { kind: 'zone', side: fromSide, zone: from },
    targets: [{ kind: 'zone', side: toSide, zone: to }],
    outcome: { type: 'move', from, to, count },
  });
}

function refreshDeckForSceneEnter(s: GameState, ctx: EffectCtx, player: Player): boolean {
  const refreshesBefore = s.refreshCount[player] ?? 0;
  const removeBefore = s.players[player].remove.length;
  if (!mutate.deck.refreshAfterTake(s, player, removeExcludedSourceCardId(ctx, player))) return false;
  const returnedFromRemove = removeBefore - s.players[player].remove.length;
  if ((s.refreshCount[player] ?? 0) > refreshesBefore && returnedFromRemove > 0) {
    recordEffectCausalOperation(s, ctx, {
      actor: ctx.source.player,
      kind: 'zone-move',
      tags: ['refresh'],
      source: { kind: 'zone', side: player, zone: 'remove' },
      targets: [{ kind: 'zone', side: player, zone: 'deck' }],
      outcome: { type: 'move', from: 'remove', to: 'deck', count: returnedFromRemove },
    });
  }
  return true;
}

function partnerAreaMrSignature(s: GameState, player: Player): string | undefined {
  const card = s.players[player].partnerAreaMR;
  return card == null ? undefined : `${card.uid}\u0000${card.cardId}`;
}

function redirectedSceneCardToPartnerArea(
  s: GameState,
  player: Player,
  cardId: string | undefined,
  previousSignature: string | undefined,
): boolean {
  const card = s.players[player].partnerAreaMR;
  return cardId !== undefined
    && card?.cardId === cardId
    && partnerAreaMrSignature(s, player) !== previousSignature;
}

function markCutinEffectEntry(ctx: EffectCtx, char: { turnEffects: Record<string, unknown> }): void {
  if (ctx.source.resolutionKind === 'cutin') {
    char.turnEffects.enteredByCutinEffectThisTurn = true;
  }
}

function rebaseBoundCardIndexes(
  ctx: EffectCtx,
  player: Player,
  area: 'remove' | 'hand' | 'deck',
  removedIndex: number,
  cardId: string,
): void {
  for (const key of Object.keys(ctx.bindings)) {
    const bound = ctx.bindings[key];
    if (!Array.isArray(bound)) continue;
    let consumed = false;
    const remaining = bound.filter((entry) => {
      const card = entry as { kind?: string; player?: string; area?: string; index?: number; cardId?: string };
      if (!consumed && card.kind === 'card' && card.player === player && card.area === area
        && card.index === removedIndex && card.cardId === cardId) {
        consumed = true;
        return false;
      }
      return true;
    });
    ctx.bindings[key] = remaining.map((entry) => {
      const card = entry as Candidate;
      if (card.kind === 'card' && card.player === player && card.area === area
        && typeof card.index === 'number' && card.index > removedIndex) {
        return { ...card, index: card.index - 1 };
      }
      return entry;
    }) as EffectCtx['bindings'][string];
  }
}

type SceneSourceArea = 'remove' | 'partner-area' | 'hand' | 'deck';

interface SelectedSceneOccurrence {
  cardId: string;
  area: SceneSourceArea;
  player: Player;
  index: number;
}

function selectedSceneOccurrences(
  s: GameState,
  a: Record<string, unknown>,
  ctx: EffectCtx,
  player: Player,
  cardIds: string[],
  allowedAreas: readonly SceneSourceArea[],
): SelectedSceneOccurrence[] | null | undefined {
  if (!Object.hasOwn(a, 'selectedCardOccurrences')) return undefined;
  const occurrences = resolveBindRef(a.selectedCardOccurrences, ctx);
  if (!Array.isArray(occurrences) || occurrences.length !== cardIds.length) return null;
  const selected: SelectedSceneOccurrence[] = [];
  const seen = new Set<string>();
  for (const [position, occurrence] of occurrences.entries()) {
    if (occurrence === null || typeof occurrence !== 'object' || Array.isArray(occurrence)) return null;
    const value = occurrence as Record<string, unknown>;
    if (typeof value.cardId !== 'string'
      || value.cardId !== cardIds[position]
      || typeof value.area !== 'string'
      || !allowedAreas.includes(value.area as SceneSourceArea)
      || value.player !== player
      || typeof value.index !== 'number'
      || !Number.isSafeInteger(value.index)
      || value.index < 0) {
      return null;
    }
    const area = value.area as SceneSourceArea;
    const key = `${value.player}:${area}:${value.index}`;
    if (seen.has(key)) return null;
    seen.add(key);
    if (area === 'deck') {
      if (value.kind !== undefined && value.kind !== 'card') return null;
      const deckOccurrence = value.kind === 'card' ? value : { ...value, kind: 'card' };
      if (!isLiveDeckOccurrenceAuthority(s, player, deckOccurrence)) return null;
    } else if (area === 'remove') {
      if (!isLiveCardOccurrenceWitness(s, player, area, value.occurrenceWitness)
        || s.players[player].remove[value.index] !== value.cardId) {
        return null;
      }
    } else {
      const cards = area === 'partner-area'
        ? (s.players[player].partnerAreaCards ?? [])
        : s.players[player][area];
      if (cards[value.index] !== value.cardId) return null;
    }
    selected.push({ cardId: value.cardId, area, player, index: value.index });
  }
  return selected;
}

export function atomSceneEnter(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      if (a.__declined === true) {
        mutate.log.append(s, { ts: Date.now(), player: resolvePlayer(a.player, ctx), turn: s.turn.number, action: 'effect:sceneEnter:declined' });
        return;
      }
      // cluster14 (2026-06-15) multi-card sceneEnter: 「…キャラを2枚まで選び、登場させる」(B09010/PR042 等)。
      //   handAddFromRemove/charStackCard と同型の cardIds:'$pick.cardIds' 契約を sceneEnter に拡張する。
      //   単一 cardId path は cardIds 不在時に従来通り (additive・非干渉。骨格凍結例外: rules/20 スイッチ + defer カード)。
      //   現場満杯時の switch は switchRemoveUids[] (UI が overflow 枚数ぶん収集) を per-card に消費する。
      {
        const rawCardIdsM = (a as { cardIds?: unknown; __declined?: unknown }).cardIds;
        if (rawCardIdsM === '$pick.cardIds') {
          // FIX-B2: 0枚選択 (skipResolvesAtom decline) の再入。__declined → 0体登場 (continuation は
          //   applyPickSkipAndContinuation が別途実行)。deckRevealUntil の __declined 契約と同型。
          if ((a as { __declined?: unknown }).__declined === true) {
            mutate.log.append(s, { ts: Date.now(), player: resolvePlayer(a.player, ctx), turn: s.turn.number, action: 'effect:sceneEnter:multi-declined' });
            return;
          }
          // 未解決 await: side-channel に pick を queue (handAddFromRemove 同型)。
          if (a.target && typeof a.target === 'object') {
            const seMP = resolvePlayer(a.player, ctx);
            tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, { byPlayer: seMP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
            mutate.log.append(s, { ts: Date.now(), player: seMP, turn: s.turn.number, action: 'effect:sceneEnter:awaiting-pick' });
          }
          return;
        }
        if (Array.isArray(rawCardIdsM)) {
          // 解決済 (0〜max 枚)。各 cardId を source area から splice → enter / switchEnter。
          const cardIds = rawCardIdsM as string[];
          const enterP = resolvePlayer(a.player, ctx);
          const switchUids = Array.isArray((a as { switchRemoveUids?: unknown }).switchRemoveUids)
            ? [...((a as { switchRemoveUids?: string[] }).switchRemoveUids as string[])]
            : [];
          const viaEffectM = (a.viaEffect as boolean | undefined) ?? true;
          const enterOptsM = {
            named: (a.named as boolean | undefined) ?? true,
            viaEffect: viaEffectM,
            active: a.enterSleep === true ? false : undefined,
          };
          const rawSrcArea = (a.target && typeof a.target === 'object')
            ? (a.target as { query?: { area?: string | string[] } }).query?.area
            : undefined;
          const srcAreas = (Array.isArray(rawSrcArea) ? rawSrcArea : [rawSrcArea])
            .filter((area): area is SceneSourceArea => area === 'remove'
              || area === 'partner-area'
              || area === 'hand'
              || area === 'deck');
          const srcArea = srcAreas.length === 1 ? srcAreas[0] : undefined;
          const srcSide = ((a.target && typeof a.target === 'object') ? (a.target as { query?: { side?: string } }).query?.side : undefined) as 'self' | 'opp' | undefined;
          // engine mega-wave W4 (2026-07-03, r83): 同一解決で登場した全キャラを集約 (enter:group 用)
          const enteredGroup: Array<{ kind: 'char'; uid: string; cardId: string; player: Player }> = [];
          let lastEnterEventId: string | undefined;
          const selectedDeckIndexes = Array.isArray((a as { selectedDeckIndexes?: unknown }).selectedDeckIndexes)
            ? (a as { selectedDeckIndexes: unknown[] }).selectedDeckIndexes
            : [];
          const sourcePlayer = srcSide === 'opp' ? 'opp' : enterP;
          const selectedOccurrences = selectedSceneOccurrences(s, a, ctx, sourcePlayer, cardIds, srcAreas);
          if (selectedOccurrences === null) {
            (ctx.dyn ??= {}).chainStepNoApply = true;
            if (typeof a.bind === 'string') (ctx.bindings as Record<string, unknown>)[a.bind] = [];
            mutate.log.append(s, {
              ts: Date.now(), player: enterP, turn: s.turn.number,
              action: 'effect:sceneEnter:source-missing-skip',
            });
            return;
          }
          let tookFromDeck = false;
          const removedDeckOriginalIndexes: number[] = [];
          for (const [cardPosition, cid] of cardIds.entries()) {
            // 単一 path と同じ inline splice (remove/hand/deck のみ)。これがないと remove に残り複製登場 (D11014 a2 class bug)。
            const selectedOccurrence = selectedOccurrences?.[cardPosition];
            const fp = selectedOccurrence?.player ?? sourcePlayer;
            const cardSourceArea = selectedOccurrence?.area ?? srcArea;
            let consumedFromSource = false;
            if (cardSourceArea === 'remove' || cardSourceArea === 'partner-area'
              || cardSourceArea === 'hand' || cardSourceArea === 'deck') {
              const arr = cardSourceArea === 'partner-area'
                ? (s.players[fp].partnerAreaCards ?? [])
                : s.players[fp][cardSourceArea];
              const originalSelectedIndex = selectedDeckIndexes[cardPosition];
              // Earlier entries in the same multi-pick have already been spliced.
              // Convert the candidate's snapshot index to its current deck index.
              const selectedIndex = typeof originalSelectedIndex === 'number'
                ? originalSelectedIndex - selectedDeckIndexes.slice(0, cardPosition)
                  .filter((previous): previous is number => typeof previous === 'number' && previous < originalSelectedIndex).length
                : undefined;
              const exactSelectedIndex = selectedOccurrence === undefined
                ? undefined
                : selectedOccurrence.index - selectedOccurrences!.slice(0, cardPosition)
                  .filter((previous) => previous.player === selectedOccurrence.player
                    && previous.area === selectedOccurrence.area
                    && previous.index < selectedOccurrence.index).length;
              const i = exactSelectedIndex !== undefined
                ? (arr[exactSelectedIndex] === cid ? exactSelectedIndex : -1)
                : cardSourceArea === 'deck'
                  && typeof selectedIndex === 'number'
                  && arr[selectedIndex] === cid
                  ? selectedIndex
                  : arr.indexOf(cid);
              if (i !== -1) {
                let originalDeckIndex: number | undefined;
                if (cardSourceArea === 'deck') {
                  const explicitOriginalIndex = selectedOccurrence?.area === 'deck'
                    ? selectedOccurrence.index
                    : typeof originalSelectedIndex === 'number'
                      && Number.isSafeInteger(originalSelectedIndex)
                      && originalSelectedIndex >= 0
                      && !removedDeckOriginalIndexes.includes(originalSelectedIndex)
                      ? originalSelectedIndex
                      : undefined;
                  if (explicitOriginalIndex !== undefined) {
                    originalDeckIndex = explicitOriginalIndex;
                  } else {
                    originalDeckIndex = i;
                    for (const removedIndex of [...removedDeckOriginalIndexes].sort((left, right) => left - right)) {
                      if (removedIndex <= originalDeckIndex) originalDeckIndex += 1;
                    }
                  }
                }
                arr.splice(i, 1);
                if (cardSourceArea === 'remove') {
                  advanceIndexedZoneEpoch(s, fp, 'remove');
                  mutate.remove.emitExit(s, fp, cid);
                }
                consumedFromSource = true;
                // S2 deck cluster (2026-07-10, B01022): stale-bind prune — deck を離れたカードの
                // bound entry を各 bindKey から 1 occurrence ずつ除去する。怠ると後続 deckToBottomBound
                // (cardId ベース splice) が同 cardId の deep copy (window 外) を誤って底送りする。
                // deck source の cardIds-multi 経路のみ (shipped 単一 path は bindMatch 除外で stale が
                // 生じない構成のため触らない)。array は差替え (凍結 bindings shallow-copy と非干渉)。
                if (cardSourceArea === 'deck') {
                  tookFromDeck = true;
                  removedDeckOriginalIndexes.push(originalDeckIndex!);
                }
                if (cardSourceArea === 'remove' || cardSourceArea === 'hand') {
                  rebaseBoundCardIndexes(ctx, fp, cardSourceArea, i, cid);
                }
              } else if (selectedOccurrence !== undefined) {
                (ctx.dyn ??= {}).chainStepNoApply = true;
                mutate.log.append(s, {
                  ts: Date.now(), player: enterP, turn: s.turn.number,
                  action: 'effect:sceneEnter:source-missing-skip', target: cid,
                });
                continue;
              }
            }
            // FIX-B3a: full は **ループ内で都度再計算** (hoist 禁止。enter で scene が伸びるため)。
            const full = s.players[enterP].scene.length >= sceneCap(s, enterP);
            let nc: ReturnType<typeof mutate.scene.enter>;
            let switched = false;
            if (full) {
              const v = switchUids.shift();
              // FIX-B3b: victim が現 scene に存在するか検証 (stale/dup/illegal → skip、enter() の throw 防止)。
              if (typeof v === 'string' && !v.startsWith('$') && s.players[enterP].scene.some((c) => c.uid === v)) {
                nc = mutate.scene.switchEnter(s, enterP, cid, v, enterOptsM);
                switched = true;
              } else {
                mutate.log.append(s, { ts: Date.now(), player: enterP, turn: s.turn.number, action: 'effect:sceneEnter:scene-full-skip', target: cid });
                continue;
              }
            } else {
              nc = mutate.scene.enter(s, enterP, cid, enterOptsM);
            }
            markCutinEffectEntry(ctx, nc);
            if (switched) {
              recordPublicZoneMove(s, ctx, enterP, 'scene', enterP, 'remove', 1);
            }
            if (consumedFromSource && cardSourceArea !== undefined) {
              const publicSourceArea = cardSourceArea === 'partner-area' ? 'partner' : cardSourceArea;
              recordPublicZoneMove(s, ctx, fp, publicSourceArea, enterP, 'scene', 1);
            }
            const enterOperation = recordEffectCausalOperation(s, ctx, {
              actor: ctx.source.player,
              kind: 'enter',
              source: { kind: 'player', side: ctx.source.player },
              targets: [{ kind: 'scene-card', side: enterP, uid: nc.uid }],
              outcome: { type: 'state', state: 'success' },
            });
            lastEnterEventId = enterOperation?.eventId ?? lastEnterEventId;
            // BUG-146: enter emit の source は登場キャラ・原因カードは payload.sourceCardId (単一 path と同規約)。
            //   per-card emit で enterOrderThisTurn が 1 枚ずつ加算され【疾風 N】が正しく判定される (batch emit 禁止)。
            event.emit(s, 'enter', {
              uid: nc.uid, viaEffect: viaEffectM, enterOrder: nc.enterOrder,
              enterOrderThisTurn: nc.enterOrderThisTurn, sourceCardId: (ctx.source as { cardId?: string }).cardId, sourcePlayer: ctx.source.player, /* WB2 B05009: enterSource side gate */
            }, { player: enterP, uid: nc.uid, cardId: cid }, {
              causalCorrelationEventId: enterOperation?.eventId,
            });
            enteredGroup.push({ kind: 'char', uid: nc.uid, cardId: cid, player: enterP });
          }
          // The reveal window remains deck until selected cards actually move.
          // Refresh only after the whole multi-transfer has completed so later
          // selected snapshot indexes are not invalidated by an early shuffle.
          if (removedDeckOriginalIndexes.length > 0) {
            advanceDeckEpochAndRebaseBindings(
              s,
              ctx,
              sourcePlayer,
              removedDeckOriginalIndexes,
            );
          }
          if ((srcArea === 'deck' || selectedOccurrences?.some(({ area }) => area === 'deck')) && tookFromDeck) {
            if (!refreshDeckForSceneEnter(s, ctx, sourcePlayer)) return;
          }
          // M2後半 (2026-07-10, B09019): 実登場キャラ群を bind (「この効果によってキャラが5枚登場した場合」
          // = boundCountCompare が読む)。scene-full-skip 分は enteredGroup に積まれない → 実登場のみ計数。
          // 0枚でも明示 [] を書く (evidenceFlip declined と同 posture — 「0枚登場した」を記録)。
          if (typeof a.bind === 'string') {
            (ctx.bindings as Record<string, unknown>)[a.bind] = enteredGroup;
          }
          // engine mega-wave W4 (2026-07-03, r83 G34): batch 単位の enter:group を 1 回だけ emit
          // (per-cid でなく呼出単位、「その中から1枚」の母集合)。viaEffect=true のみ (「能力や効果によって」)。
          if (viaEffectM && enteredGroup.length > 0) {
            event.emit(s, 'enter:group', {
              player: enterP, uids: enteredGroup.map(e => e.uid),
              sourceCardId: (ctx.source as { cardId?: string }).cardId, sourcePlayer: ctx.source.player, /* WB2 B05009: enterSource side gate */
            }, { player: enterP, bindings: { enterGroup: enteredGroup } }, {
              causalCorrelationEventId: lastEnterEventId,
            });
          }
          return;
        }
      }
      // 2026-06-04 switch-on-effect-enter (rules/20 スイッチ): 現場満杯 (5枚) の効果登場の早期分岐。
      //  - switchRemoveUid 指定済 (UI が満杯時に SceneSwitchPickerModal で退場キャラを収集) → skip せず
      //    下の解決済 path で switchEnter する。
      //  - 未指定の AI 経路 (humanSide でない側) → スイッチ選択 UI/heuristic 無しなので skip する
      //    (rules: 0枚選択=合法な辞退。modal も無駄 pick cycle も出さない、smoke 不変)。
      //  - 未指定の human 経路 → ここでは skip せず短縮形/await pick を通し、reanimate 対象を選ばせる。
      //    解決時に UI が現場満杯を検知して switch 対象を収集 → switchRemoveUid 付きで再解決される。
      {
        const seFullP = resolvePlayer(a.player, ctx);
        const seHasSwitch = typeof a.switchRemoveUid === 'string' && !(a.switchRemoveUid as string).startsWith('$');
        const seHumanSide = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
        if (s.players[seFullP].scene.length >= sceneCap(s, seFullP) && !seHasSwitch && seFullP !== seHumanSide) {
          mutate.log.append(s, { ts: Date.now(), player: seFullP, turn: s.turn.number, action: 'effect:sceneEnter:scene-full-skip' });
          return;
        }
      }
      // PA 短縮形 (area からの登場): cardId 不在 + from + n|max で source area pick を構築し、
      // cardId='$pick.cardId' + target を付与して下記 $pick.cardId awaiting-pick 経路に合流させる。
      // sourceSplice (remove/evidence から実体除去) は解決後の本処理が target.query.area を見て行う。
      if (a.cardId === undefined && typeof a.from === 'string' && hasNorMax(a)) {
        const seP0 = resolvePlayer(a.player, ctx);
        // BUG-186 (夜間 W0 2026-07-11): side は相対値のまま渡す (sidesForQuery が owner 相対解釈)。
        // 旧実装は解決済み絶対値 seP0 を渡しており、owner='opp' で side が反転し候補 0 になっていた
        // (BUG-174 と同族。sceneToDeck/sceneSetState は相対渡しで正しい)。chooser は絶対値のままで正。
        const seTarget = buildShortFormPick(a.from, a, seP0, (a.player as 'self' | 'opp' | undefined) ?? 'self');
        tryRePickFromAtom(s, { kind: 'atom', verb, args: { ...a, cardId: '$pick.cardId', target: seTarget } }, ctx, { byPlayer: seP0, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: seP0, turn: s.turn.number, action: 'effect:sceneEnter:awaiting-pick' });
        return;
      }
      // 効果による登場 (atom verb 駆動) は viaEffect=true がデフォルト。
      // ただし args に明示があれば尊重する (テスト・特殊呼出用)。
      const viaEffect = (a.viaEffect as boolean | undefined) ?? true;
      // user_request 20260522_01 #12 fix: $matched.cardId 等の bind ref を解決
      // (D11019 deckRevealUntil → sceneEnter sequence で必要)
      const rawCardId = requireField<string>(a, 'cardId', 'string');
      const enterPlayer = resolvePlayer(a.player, ctx);
      const targetSourceArea = ((a.target && typeof a.target === 'object')
        ? ((a.target as { query?: { area?: string; side?: string } }).query?.area)
        : undefined) as 'remove' | 'evidence' | 'file' | 'deck' | 'hand' | undefined;
      const sourceSide = ((a.target && typeof a.target === 'object')
        ? ((a.target as { query?: { side?: string } }).query?.side)
        : undefined) as 'self' | 'opp' | undefined;
      const mayConsumeHeldEvidence = rawCardId === '$occurrence.cardId'
        && targetSourceArea === 'remove'
        && sourceSide === 'self'
        && (a as { sourceRequired?: unknown }).sourceRequired === true;
      const heldClaimRead = mayConsumeHeldEvidence
        ? readHeldHiramekiSelfClaim(ctx, enterPlayer)
        : { kind: 'absent' as const };
      if (heldClaimRead.kind === 'invalid') {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, {
          ts: Date.now(), player: enterPlayer, turn: s.turn.number,
          action: 'effect:sceneEnter:source-missing-skip', target: ctx.source.cardId,
        });
        return;
      }
      const heldClaim = heldClaimRead.kind === 'claim' ? heldClaimRead.claim : undefined;
      const cardId = heldClaim?.cardId ?? resolveBindRef(rawCardId, ctx) as string;
      // D11014 a2 driver 2026-05-26: cardId が `$pick.*` で未解決かつ target に
      // pick query があれば tryRePickFromAtom で side-channel set (Pattern A 同型)。
      // handAddFromRemove と同 pattern。これがないと sceneEnter は silent no-op で
      // modal が出ない長年バグ (D08024 / D11014 a2 等が影響)。
      if (typeof cardId !== 'string' || cardId.startsWith('$')) {
        if (rawCardId === '$pick.cardId' && a.target && typeof a.target === 'object') {
          const sePlayer = resolvePlayer(a.player, ctx);
          tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, {
            byPlayer: sePlayer,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, {
            ts: Date.now(), player: sePlayer, turn: s.turn.number,
            action: 'effect:sceneEnter:awaiting-pick',
          });
          return;
        }
        // それ以外の未解決 bind ref は従来通り silent no-op (BUG-048 と同 pattern)
        return;
      }
      const enteringDef = readDef.card(cardId);
      if (enteringDef?.kind === 'character' && (s.turnState[enterPlayer].useEnterBannedCardNames ?? []).some(name => enteringDef.names.includes(name))) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, { ts: Date.now(), player: enterPlayer, turn: s.turn.number, action: 'effect:sceneEnter:use-enter-banned', target: cardId });
        return;
      }
      // switch-on-effect-enter (rules/20): 現場満杯時は既存キャラを除去 (switchEnter) して登場する。
      // switchRemoveUid (UI が SceneSwitchPickerModal で収集した退場キャラ uid) があれば switchEnter、
      // 無ければ skip (human が switch を辞退 / AI 経路)。room があれば通常 enter。
      const seSwitchRemoveUid = resolveBindRef(a.switchRemoveUid, ctx) as string | undefined;
      const seIsFull = s.players[enterPlayer].scene.length >= sceneCap(s, enterPlayer);
      const seHasValidSwitch = typeof seSwitchRemoveUid === 'string'
        && !seSwitchRemoveUid.startsWith('$')
        && s.players[enterPlayer].scene.some(card => card.uid === seSwitchRemoveUid);
      if (seIsFull && !seHasValidSwitch) {
        mutate.log.append(s, { ts: Date.now(), player: enterPlayer, turn: s.turn.number, action: 'effect:sceneEnter:scene-full-skip', target: cardId });
        return;
      }
      // D11014 a2 driver 2026-05-26: pick query で source area が指定されていれば、
      // そこから cardId 1 枚を取り除いてから scene へ。これがないと「リムーブから
      // 登場」が「リムーブに残ったまま scene にコピー登場」になる duplication bug。
      // handAddFromRemove と同 pattern (line 360-367)。
      // A direct hand declaration can enter its own source without a target
      // picker (B06103/B06103P). Consume that exact source card once; do not
      // turn an on-hand effect into a duplicate scene character.
      const declaredHandSource = targetSourceArea === undefined
        && a.from === 'hand'
        && typeof ctx.source.uid === 'string'
        && ctx.source.uid.startsWith('hand:')
        && ctx.source.cardId === cardId;
      const sourceArea = targetSourceArea ?? (declaredHandSource ? 'hand' : undefined);
      let deckTakeFromPlayer: Player | undefined;
      let deckTakeOccurred = false;
      let movedFromSource: { player: Player; area: 'remove' | 'hand' | 'deck' | 'partner' | 'evidence' } | undefined;
      // Cluster WB1 (2026-07-11, B09055「世良真純」): source area が union 配列 or 'partner-area' の場合 —
      //   「自分のパートナーエリアかリムーブエリアにある〚X〛を1枚まで登場」。handAddFromRemove の union
      //   splice と同流儀 (pick 済 cardId は一意 zone 由来)。候補列挙は area 配列 union が既対応
      //   (candidates.ts 'partner-area' = partnerAreaCards、非MR一般枠)。remove→登場 は remove:exit emit
      //   (wave-4 一貫性)、PA→登場 は PA 一般枠から除去 (remove:exit 不要 = 離脱でなく現場流入)。
      //   単一 area 文字列 (remove/hand/deck) は従来 branch へ落ちる = byte 互換。
      const rawSrcArea = (a.target && typeof a.target === 'object')
        ? (a.target as { query?: { area?: string | string[] } }).query?.area : undefined;
      const allowedSourceAreas = (Array.isArray(rawSrcArea) ? rawSrcArea : [sourceArea])
        .filter((area): area is SceneSourceArea => area === 'remove'
          || area === 'partner-area'
          || area === 'hand'
          || area === 'deck');
      const selectedSourcePlayer = declaredHandSource
        ? ctx.source.player
        : (sourceSide === 'opp' ? 'opp' : enterPlayer);
      const selectedOccurrences = selectedSceneOccurrences(
        s, a, ctx, selectedSourcePlayer, [cardId], allowedSourceAreas,
      );
      const selectedOccurrence = selectedOccurrences?.[0];
      const boundRemoveOccurrence = allowedSourceAreas.includes('remove')
        ? resolveBoundOccurrenceRef(rawCardId, s, ctx, selectedSourcePlayer, 'remove')
        : { kind: 'unbound' as const };
      const invalidPhysicalSelection = heldClaim === undefined && (selectedOccurrences === null
        || boundRemoveOccurrence.kind === 'invalid'
        || (boundRemoveOccurrence.kind === 'live'
          && (boundRemoveOccurrence.cardId !== cardId
            || (selectedOccurrence !== undefined
              && (selectedOccurrence.area !== 'remove'
                || selectedOccurrence.index !== boundRemoveOccurrence.index)))));
      if (invalidPhysicalSelection) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, {
          ts: Date.now(), player: enterPlayer, turn: s.turn.number,
          action: 'effect:sceneEnter:source-missing-skip', target: cardId,
        });
        return;
      }
      const physicalOccurrence = selectedOccurrence
        ?? (boundRemoveOccurrence.kind === 'live'
          ? { cardId, area: 'remove' as const, player: selectedSourcePlayer, index: boundRemoveOccurrence.index }
          : undefined);
      if (heldClaim !== undefined) {
        const evidence = mutate.evidence.takeHeldHiramekiEvidence(s, heldClaim);
        if (!evidence) {
          (ctx.dyn ??= {}).chainStepNoApply = true;
          mutate.log.append(s, {
            ts: Date.now(), player: enterPlayer, turn: s.turn.number,
            action: 'effect:sceneEnter:source-missing-skip', target: cardId,
          });
          return;
        }
        movedFromSource = { player: heldClaim.player, area: 'evidence' };
      } else if (Array.isArray(rawSrcArea) || rawSrcArea === 'partner-area') {
        const fromPlayer = sourceSide === 'opp' ? 'opp' : enterPlayer;
        const areas = (Array.isArray(rawSrcArea) ? rawSrcArea : [rawSrcArea])
          .filter((x): x is 'remove' | 'partner-area' => x === 'remove' || x === 'partner-area');
        let spliced = false;
        const physicalAreas: Array<'remove' | 'partner-area'> = physicalOccurrence === undefined
          ? areas
          : physicalOccurrence.area === 'remove' || physicalOccurrence.area === 'partner-area'
            ? [physicalOccurrence.area]
            : [];
        for (const ar of physicalAreas) {
          if (ar === 'remove') {
            const arr = s.players[fromPlayer].remove;
            const idx = physicalOccurrence?.area === 'remove'
              ? (arr[physicalOccurrence.index] === cardId ? physicalOccurrence.index : -1)
              : arr.indexOf(cardId);
            if (idx !== -1) {
              arr.splice(idx, 1);
              advanceIndexedZoneEpoch(s, fromPlayer, 'remove');
              mutate.remove.emitExit(s, fromPlayer, cardId);
              movedFromSource = { player: fromPlayer, area: 'remove' };
              spliced = true;
              break;
            }
          } else {
            const pa = s.players[fromPlayer].partnerAreaCards;
            const idx = physicalOccurrence?.area === 'partner-area'
              ? (pa?.[physicalOccurrence.index] === cardId ? physicalOccurrence.index : -1)
              : (pa ? pa.indexOf(cardId) : -1);
            if (idx !== -1) {
              pa!.splice(idx, 1);
              movedFromSource = { player: fromPlayer, area: 'partner' };
              spliced = true;
              break;
            }
          }
        }
        // sourceRequired (B05115 型): 解決までに union のどの zone にも無ければ登場中止。
        if (!spliced && ((a as { sourceRequired?: boolean }).sourceRequired === true
          || physicalOccurrence !== undefined)) {
          mutate.log.append(s, { ts: Date.now(), player: enterPlayer, turn: s.turn.number, action: 'effect:sceneEnter:source-missing-skip', target: cardId });
          return;
        }
      } else if (sourceArea === 'remove') {
        const fromPlayer = sourceSide === 'opp' ? 'opp' : enterPlayer;
        const arr = s.players[fromPlayer].remove;
        const selectedIndex = resolveBindRef((a as { selectedCardIndex?: unknown }).selectedCardIndex, ctx);
        const exactSelectedIndex = (a as { exactSelectedCardIndex?: unknown }).exactSelectedCardIndex === true;
        const idx = physicalOccurrence?.area === 'remove'
          ? (arr[physicalOccurrence.index] === cardId ? physicalOccurrence.index : -1)
          : typeof selectedIndex === 'number'
          ? (arr[selectedIndex] === cardId ? selectedIndex : (exactSelectedIndex ? -1 : arr.indexOf(cardId)))
          : arr.indexOf(cardId);
        // engine mega-wave W3 (2026-07-03, r17): sourceRequired:true (opt-in) — 対象カードが source area に
        // 無ければ登場自体を中止 (B05115 公式Q&A「解決までにリムーブエリアを離れていた場合、登場できません」)。
        // 既存カードは未宣言 → 従来挙動 (idx===-1 でも enter 続行) byte 等価。
        if (idx === -1 && ((a as { sourceRequired?: boolean }).sourceRequired === true
          || physicalOccurrence !== undefined)) {
          mutate.log.append(s, { ts: Date.now(), player: enterPlayer, turn: s.turn.number, action: 'effect:sceneEnter:source-missing-skip', target: cardId });
          return;
        }
        if (idx !== -1) {
          arr.splice(idx, 1);
          advanceIndexedZoneEpoch(s, fromPlayer, 'remove');
          mutate.remove.emitExit(s, fromPlayer, cardId);
          movedFromSource = { player: fromPlayer, area: 'remove' };
        } // wave-4: remove→登場 離脱 (原因非依存 remove:exit、B05087 1st 能力が観測しうる)
        if (idx !== -1) rebaseBoundCardIndexes(ctx, fromPlayer, 'remove', idx, cardId);
      } else if (sourceArea === 'hand') {
        const fromPlayer = declaredHandSource
          ? ctx.source.player
          : (sourceSide === 'opp' ? 'opp' : enterPlayer);
        const arr = s.players[fromPlayer].hand;
        const selectedIndex = physicalOccurrence?.area === 'hand' ? physicalOccurrence.index : undefined;
        const idx = selectedIndex === undefined ? arr.indexOf(cardId) : selectedIndex;
        if (idx === -1 || arr[idx] !== cardId) {
          if ((a as { sourceRequired?: unknown }).sourceRequired === true || selectedIndex !== undefined) {
            mutate.log.append(s, { ts: Date.now(), player: enterPlayer, turn: s.turn.number, action: 'effect:sceneEnter:source-missing-skip', target: cardId });
            return;
          }
        } else {
          arr.splice(idx, 1);
          rebaseBoundCardIndexes(ctx, fromPlayer, 'hand', idx, cardId);
          movedFromSource = { player: fromPlayer, area: 'hand' };
        }
      } else if (sourceArea === 'deck') {
        const fromPlayer = sourceSide === 'opp' ? 'opp' : enterPlayer;
        if (!refreshDeckForSceneEnter(s, ctx, fromPlayer)) return;
        const arr = s.players[fromPlayer].deck;
        // mini-wave #5 review B1 (2026-07-10): fromBottom 公開カードの登場は deckPos:'bottom' を渡す。
        // indexOf (先頭出現) だと同名コピーがデッキ上方にあるとき「見せていない top 側」が抜かれ、
        // 公開した底カードが残る (隠れ順序破壊、rules/02 同名3枚合法なので頻出)。lastIndexOf = 底出現。
        const idx = physicalOccurrence?.area === 'deck'
          ? (arr[physicalOccurrence.index] === cardId ? physicalOccurrence.index : -1)
          : a.deckPos === 'bottom' ? arr.lastIndexOf(cardId) : arr.indexOf(cardId);
        if (idx === -1 && physicalOccurrence !== undefined) {
          (ctx.dyn ??= {}).chainStepNoApply = true;
          mutate.log.append(s, {
            ts: Date.now(), player: enterPlayer, turn: s.turn.number,
            action: 'effect:sceneEnter:source-missing-skip', target: cardId,
          });
          return;
        }
        if (idx !== -1) {
          arr.splice(idx, 1);
          const rawBindDot = typeof rawCardId === 'string' ? rawCardId.indexOf('.') : -1;
          const referencedBindKey = rawBindDot > 1 && rawCardId.startsWith('$')
            ? rawCardId.slice(0, rawBindDot)
            : undefined;
          const preserveRemovedBindingKeysAsResolved = referencedBindKey === undefined
            ? []
            : [referencedBindKey, referencedBindKey.slice(1)]
              .filter(bindKey => Object.hasOwn(ctx.bindings, bindKey));
          advanceDeckEpochAndRebaseBindings(s, ctx, fromPlayer, [idx], {
            preserveRemovedBindingKeysAsResolved,
          });
          deckTakeFromPlayer = fromPlayer;
          deckTakeOccurred = true;
          movedFromSource = { player: fromPlayer, area: 'deck' };
        }
      }
      const enterOpts = {
        // BUG-093: 効果/能力による登場も「同ターン登場」= 名乗り状態 (rules/06, 17)。
        // 既定 false だと効果登場キャラが名乗りにならず、名乗り例外 (突撃/迅速) 無しでも
        // action/推理できてしまっていた。明示 false を渡さない限り名乗りで登場させる。
        named: (a.named as boolean | undefined) ?? true,
        viaEffect,
        // look-top-N (2026-06-06 タスクC, D01012): enterSleep:true で「スリープ状態で登場」(rules/03)。
        // mutate.scene.enter が active===false → 'sleep' で生成する。既定 (undefined) は従来通り active。
        active: a.enterSleep === true ? false : undefined,
      };
      // 満杯なら switchEnter (退場キャラを除去してから登場、rules/20)、room あれば通常 enter。
      const sceneUidsBefore = seIsFull
        ? new Set(s.players[enterPlayer].scene.map((card) => card.uid))
        : undefined;
      const newChar = seIsFull
        ? mutate.scene.switchEnter(s, enterPlayer, cardId, seSwitchRemoveUid as string, enterOpts)
        : mutate.scene.enter(s, enterPlayer, cardId, enterOpts);
      markCutinEffectEntry(ctx, newChar);
      if (sceneUidsBefore !== undefined) {
        const removedFromScene = [...sceneUidsBefore]
          .filter((uid) => !s.players[enterPlayer].scene.some((card) => card.uid === uid))
          .length;
        recordPublicZoneMove(s, ctx, enterPlayer, 'scene', enterPlayer, 'remove', removedFromScene);
      }
      if (movedFromSource !== undefined) {
        recordPublicZoneMove(s, ctx, movedFromSource.player, movedFromSource.area, enterPlayer, 'scene', 1);
      }
      const enterOperation = recordEffectCausalOperation(s, ctx, {
        actor: ctx.source.player,
        kind: 'enter',
        source: { kind: 'player', side: ctx.source.player },
        targets: [{ kind: 'scene-card', side: enterPlayer, uid: newChar.uid }],
        outcome: { type: 'state', state: 'success' },
      });
      // user_request 20260522_01 #12 fix: 新 uid を $matched に書き戻し、
      // 後続 atom (charGrantKeyword 等) が `$matched.uid` で参照できるよう
      // する。元 binding の cardId は維持しつつ uid を上書き。
      // BUG-091: deckRevealUntil は $込みキー ('$matched') で格納するため、$無し ('matched') と
      // 両方を試して登場キャラの新 uid を書き戻す (後続 $matched.uid = charGrantKeyword 参照のため)。
      const existing = ((ctx.bindings as Record<string, unknown>)['matched']
        ?? (ctx.bindings as Record<string, unknown>)['$matched']) as Record<string, unknown>[] | undefined;
      if (Array.isArray(existing) && existing.length > 0) {
        existing[0].uid = newChar.uid;
      }
      // D11014 a2 driver (2026-05-25): args.bind が指定されていれば、登場したキャラ情報
      // ({ cardId, uid }) を `ctx.bindings[bind]` に格納。後続 condition (boundMatchesFilter 等)
      // が「〚カード名[X]〛を登場させた場合」を declarative に判定できる。
      const enteredBindKey = a.bind as string | undefined;
      if (enteredBindKey) {
        ctx.bindings[enteredBindKey] = [{
          kind: 'card', cardId, area: 'scene', player: enterPlayer, uid: newChar.uid,
        } as unknown as Candidate];
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: enterPlayer, turn: s.turn.number, action: 'effect:sceneEnter', target: cardId });
      // rules/17 — 現場登場時 Hook (【登場時】・【疾風 N】判定)
      // BUG-146 (2026-06-15): enter emit の source は **登場キャラ** に統一する (hand-use-card / next-hint と同規約)。
      // 旧実装は ctx.source (= 登場を起こした原因カード) を渡しており、selfOnlyMatches (source.uid===card.uid) で
      // 効果/能力登場キャラ自身の【登場時】(selfOnly) が永久不発 + 原因カードの【登場時】が誤発火していた。
      // 原因カード (cluster11 enterSource 用) は payload.sourceCardId へ移送 (additive、既存 listener は読まない)。
      event.emit(s, 'enter', {
        uid: newChar.uid,
        viaEffect,
        enterOrder: newChar.enterOrder,
        enterOrderThisTurn: newChar.enterOrderThisTurn,
        sourceCardId: (ctx.source as { cardId?: string }).cardId, sourcePlayer: ctx.source.player, /* WB2 B05009: enterSource side gate */
      }, { player: enterPlayer, uid: newChar.uid, cardId }, {
        causalCorrelationEventId: enterOperation?.eventId,
      });
      // sceneEnter is the final move of the revealed/selected card. Run refresh
      // only after the character and its enter event exist, matching the multi
      // path and preventing refresh observers from seeing a half-moved state.
      if (deckTakeOccurred && deckTakeFromPlayer !== undefined) {
        if (!refreshDeckForSceneEnter(s, ctx, deckTakeFromPlayer)) return;
      }
      // engine mega-wave W4 (2026-07-03, r83): 単一登場も group-of-1 として emit (B01012 は 1枚登場でも発動)
      if (viaEffect) {
        event.emit(s, 'enter:group', {
          player: enterPlayer, uids: [newChar.uid],
          sourceCardId: (ctx.source as { cardId?: string }).cardId, sourcePlayer: ctx.source.player, /* WB2 B05009: enterSource side gate */
        }, { player: enterPlayer, bindings: { enterGroup: [{ kind: 'char', uid: newChar.uid, cardId, player: enterPlayer }] } }, {
          causalCorrelationEventId: enterOperation?.eventId,
        });
      }
      return;
    }

export function atomSceneSwitch(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const viaEffect = (a.viaEffect as boolean | undefined) ?? true;
      const swPlayer = resolvePlayer(a.player, ctx);
      // BUG-068: bind ref ($matched.cardId / $entered.uid 等) 解決を配線
      const swCardId = resolveBindRef(a.cardId, ctx) as string;
      if (typeof swCardId !== 'string' || swCardId.startsWith('$')) return;
      const swRemoveUid = resolveBindRef(a.removeUid, ctx) as string;
      if (typeof swRemoveUid !== 'string' || swRemoveUid.startsWith('$')) return;
      const sceneUidsBefore = new Set(s.players[swPlayer].scene.map((card) => card.uid));
      const newChar = mutate.scene.switchEnter(s, swPlayer, swCardId, swRemoveUid, {
        // BUG-093: 効果/能力による登場も「同ターン登場」= 名乗り状態 (rules/06, 17)。
        // 既定 false だと効果登場キャラが名乗りにならず、名乗り例外 (突撃/迅速) 無しでも
        // action/推理できてしまっていた。明示 false を渡さない限り名乗りで登場させる。
        named: (a.named as boolean | undefined) ?? true,
        viaEffect,
      });
      markCutinEffectEntry(ctx, newChar);
      const removedFromScene = [...sceneUidsBefore]
        .filter((uid) => !s.players[swPlayer].scene.some((card) => card.uid === uid))
        .length;
      recordPublicZoneMove(s, ctx, swPlayer, 'scene', swPlayer, 'remove', removedFromScene);
      const enterOperation = recordEffectCausalOperation(s, ctx, {
        actor: ctx.source.player,
        kind: 'enter',
        source: { kind: 'player', side: ctx.source.player },
        targets: [{ kind: 'scene-card', side: swPlayer, uid: newChar.uid }],
        outcome: { type: 'state', state: 'success' },
      });
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: swPlayer, turn: s.turn.number, action: 'effect:sceneSwitch', target: swCardId });
      // スイッチ登場も rules/17 上「登場」として enter Hook が発火する
      // BUG-146 (2026-06-15): source を登場キャラに統一 + 原因カードを payload.sourceCardId へ (sceneEnter と同様)。
      event.emit(s, 'enter', {
        uid: newChar.uid,
        viaEffect,
        enterOrder: newChar.enterOrder,
        enterOrderThisTurn: newChar.enterOrderThisTurn,
        sourceCardId: (ctx.source as { cardId?: string }).cardId, sourcePlayer: ctx.source.player, /* WB2 B05009: enterSource side gate */
      }, { player: swPlayer, uid: newChar.uid, cardId: swCardId }, {
        causalCorrelationEventId: enterOperation?.eventId,
      });
      // engine mega-wave W4 (2026-07-03, r83): スイッチ登場も「登場」(rules/17) → group-of-1 emit
      if (viaEffect) {
        event.emit(s, 'enter:group', {
          player: swPlayer, uids: [newChar.uid],
          sourceCardId: (ctx.source as { cardId?: string }).cardId, sourcePlayer: ctx.source.player, /* WB2 B05009: enterSource side gate */
        }, { player: swPlayer, bindings: { enterGroup: [{ kind: 'char', uid: newChar.uid, cardId: swCardId, player: swPlayer }] } }, {
          causalCorrelationEventId: enterOperation?.eventId,
        });
      }
      return;
    }

export function atomSceneRemove(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      type RemoveCause = 'contact-ap' | 'effect' | 'switch' | 'cost' | 'misplay-overflow';
      // 物理動作 atom 化 (拡張 3): 短縮形 { player, n or max, side, filter } で uid 不在
      // の場合、PA pick query を構築 + tryRePickFromAtom で side-channel set + awaiting-pick log。
      // (D08003 a1 step 2 「現場 AP≤8000 を1枚まで選びリムーブ」等で使用)
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        // PA 短縮形 (refactor 2a): chooser=byPlayer は従来どおり srP (= a.player、操作者規約)。
        const srP = resolvePlayer(a.player, ctx);
        paShortFormAwait(s, verb, a, ctx, srP, a.player as Player); // BUG-174: side は相対値のまま (sidesForQuery が owner 相対解釈)
        return;
      }
      // 「$pick」placeholder のまま atom-handler 到達 = pick で 0 枚選択された場合
      // (max: N で min=0 だと user が skip 可能)。silent no-op (log のみ)。
      if (a.uid === '$pick') {
        // A preceding runtime atom can populate a binding used by this
        // target query. Re-resolve now instead of treating the pre-walk
        // placeholder as a declined pick.
        if (a.target && typeof a.target === 'object') {
          tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, {
            byPlayer: ctx.source.player,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          return;
        }
        if (a.gateOnMissing === true) (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneRemove', result: 'skipped' });
        return;
      }
      // BUG-068: bind ref ($matched.uid 等) 解決を配線
      const srUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof srUid !== 'string' || srUid.startsWith('$')) {
        if (a.gateOnMissing === true) (ctx.dyn ??= {}).chainStepNoApply = true;
        return;
      }
      // engine mega-wave W4 (2026-07-03, r1 P01): 保護 rider gate —「相手の能力や効果によって
      // リムーブされず」(B05041)。cause 'effect' の **相手発** のみ block (公式Q&A: 選ぶことは可 /
      // コンタクト除去・スイッチ・コストは別経路ゆえ自然に対象外)。既存カードは未宣言 → false 短絡。
      {
        const srCause = (a.cause as RemoveCause) ?? 'effect';
        if (srCause === 'effect') {
          const srOwner: Player = s.players.self.scene.some(c => c.uid === srUid) ? 'self' : 'opp';
          if (ctx.source.player !== srOwner && readChar.charProtectedFrom(s, srUid, 'remove')) {
            (ctx.dyn ??= {}).chainStepNoApply = true;
            mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneRemove', target: srUid, result: 'blocked-protected' });
            return;
          }
          // S2 wave (2026-07-11, PR279): 「相手のイベントの効果によってリムーブされない」— 相手発 かつ
          // source カードが kind==='event' (イベント本体効果・イベントの【ヒラメキ】/【カットイン】) のみ block。
          // キャラ能力発のリムーブは素通し (charProtectedFrom 'remove' より狭い保護、公式Q&A PR279)。
          if (ctx.source.player !== srOwner
            && readDef.card(ctx.source.cardId ?? '')?.kind === 'event'
            && readChar.charProtectedFromOppEvent(s, srUid, 'remove')) {
            (ctx.dyn ??= {}).chainStepNoApply = true;
            mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneRemove', target: srUid, result: 'blocked-event-protected' });
            return;
          }
        }
      }
      // engine A3 wave (2026-07-11, B08002): 除去キャラの **実効** level/ap/lp を除去**前**に snapshot し bind。
      //   「リムーブしたキャラのレベルと同じ枚数」(mill) 等で参照。$bound.level は除去後 re-read で
      //   盤面不在→印字値に落ちるが、本 snapshot は増減後の実効値を静的保存 (公式Q&A: 増減した状態を参照)。
      //   dyn root $removed.<field> が binding[0].snap* を読む。既存 caller は bind 未指定 → 挙動不変。
      if (typeof a.bind === 'string') {
        const srChar = s.players.self.scene.find(c => c.uid === srUid) ?? s.players.opp.scene.find(c => c.uid === srUid);
        (ctx.bindings as Record<string, unknown>)[a.bind] = srChar
          ? [{ uid: srUid, cardId: srChar.cardId, snapState: srChar.state, snapLevel: readChar.level(s, srUid), snapAp: readChar.ap(s, srUid), snapLp: readChar.lp(s, srUid), snapCardNames: allCardNameComponentsForDef(readDef.card(srChar.cardId)!) }]
          : [];
      }
      // W6 step10 (row9): byPlayer = 効果 source 側 — leave:intercept の「相手の能力や効果」帰属判定用
      const rawLeaveInterceptDecision = a.leaveInterceptDecision;
      const leaveInterceptDecision = rawLeaveInterceptDecision !== null
        && typeof rawLeaveInterceptDecision === 'object'
        && !Array.isArray(rawLeaveInterceptDecision)
        && typeof (rawLeaveInterceptDecision as Record<string, unknown>).interceptorUid === 'string'
        && typeof (rawLeaveInterceptDecision as Record<string, unknown>).accept === 'boolean'
        ? {
            interceptorUid: (rawLeaveInterceptDecision as { interceptorUid: string }).interceptorUid,
            accept: (rawLeaveInterceptDecision as { accept: boolean }).accept,
            ...((rawLeaveInterceptDecision as Record<string, unknown>).interceptorCostPaid === true
              ? { interceptorCostPaid: true }
              : {}),
          }
        : undefined;
      const skipSetCardReplacementInstanceIds = Array.isArray(a.skipSetCardReplacementInstanceIds)
        && a.skipSetCardReplacementInstanceIds.every((instanceId) => typeof instanceId === 'string')
        ? [...a.skipSetCardReplacementInstanceIds] as string[]
        : undefined;
      const rawAfterSceneRemove = a.afterSceneRemove;
      const afterSceneRemove = rawAfterSceneRemove !== null
        && typeof rawAfterSceneRemove === 'object'
        && !Array.isArray(rawAfterSceneRemove)
        && typeof (rawAfterSceneRemove as Record<string, unknown>).uid === 'string'
        && ['contact-ap', 'effect', 'switch', 'cost', 'misplay-overflow'].includes(
          (rawAfterSceneRemove as Record<string, unknown>).cause as string,
        )
        ? (() => {
            const after = rawAfterSceneRemove as Record<string, unknown>;
            const rawDecision = after.leaveInterceptDecision;
            const leaveIntercept = rawDecision !== null
              && typeof rawDecision === 'object'
              && !Array.isArray(rawDecision)
              && typeof (rawDecision as Record<string, unknown>).interceptorUid === 'string'
              && typeof (rawDecision as Record<string, unknown>).accept === 'boolean'
              ? {
                  interceptorUid: (rawDecision as { interceptorUid: string }).interceptorUid,
                  accept: (rawDecision as { accept: boolean }).accept,
                  ...((rawDecision as Record<string, unknown>).interceptorCostPaid === true
                    ? { interceptorCostPaid: true }
                    : {}),
                }
              : undefined;
            const byPlayer: Player | undefined = after.byPlayer === 'self' || after.byPlayer === 'opp'
              ? after.byPlayer
              : undefined;
            return {
              uid: after.uid as string,
              cause: after.cause as RemoveCause,
              ...(typeof after.byUid === 'string' ? { byUid: after.byUid } : {}),
              ...(byPlayer ? { byPlayer } : {}),
              ...(leaveIntercept ? { leaveInterceptDecision: leaveIntercept } : {}),
            };
          })()
        : undefined;
      const srByUid = typeof a.byUid === 'string' ? a.byUid : undefined;
      const srOwner: Player | undefined = s.players.self.scene.some((card) => card.uid === srUid)
        ? 'self'
        : s.players.opp.scene.some((card) => card.uid === srUid)
          ? 'opp'
          : undefined;
      const srCardId = srOwner === undefined
        ? undefined
        : s.players[srOwner].scene.find((card) => card.uid === srUid)?.cardId;
      const removeResult = mutate.scene.removeToRemove(
        s,
        srUid,
        (a.cause as RemoveCause) ?? 'effect',
        srByUid,
        {
          byPlayer: ctx.source.player,
          leaveInterceptDecision,
          skipSetCardReplacementInstanceIds,
          ...(afterSceneRemove ? { afterSceneRemove } : {}),
        },
      );
      if (removeResult.deferred && removeResult.pendingLeaveIntercept) {
        const pending = removeResult.pendingLeaveIntercept;
        const resume: Effect = {
          kind: 'choice',
          chooser: pending.player === ctx.source.player ? 'self' : 'opp',
          options: [true, false].map((accept) => ({
            kind: 'atom' as const,
            verb: 'sceneRemove',
            args: {
              ...toPlainDeep(a),
              uid: srUid,
              leaveInterceptDecision: { interceptorUid: pending.interceptorUid, accept },
            },
          })),
        };
        pushPendingEffectChoiceSide({
          player: pending.player,
          sourcePlayer: ctx.source.player,
          source: {
            cardId: ctx.source.cardId ?? '',
            abilityId: ctx.source.abilityId ?? '',
            uid: ctx.source.uid ?? '',
            ...(ctx.source.resolutionKind ? { resolutionKind: ctx.source.resolutionKind } : {}),
            ...(ctx.source.triggerBatch !== undefined ? { triggerBatch: ctx.source.triggerBatch } : {}),
            ...(ctx.source.ownerChosenOrder !== undefined ? { ownerChosenOrder: ctx.source.ownerChosenOrder } : {}),
            ...(ctx.source.ownerOrderConfirmed !== undefined ? { ownerOrderConfirmed: ctx.source.ownerOrderConfirmed } : {}),
            ...(ctx.source.declaredBatch !== undefined ? { declaredBatch: ctx.source.declaredBatch } : {}),
          },
          options: [
            { index: 0, label: 'Use leave intercept' },
            { index: 1, label: 'Do not use leave intercept' },
          ],
        });
        setPendingChoiceResume(resume);
        setPendingChoiceBindings(toPlainDeep({ ...(ctx.bindings as Record<string, unknown>) }));
        (ctx.dyn ??= {}).runtimeChoicePending = true;
        return;
      }
      if (removeResult.deferred) return;
      const removedToRemove = (
        srOwner !== undefined
        && srCardId !== undefined
        && !removeResult.deferred
        && !removeResult.prevented
        && removeResult.removed.uid === srUid
        && removeResult.removed.cardId === srCardId
        && !s.players[srOwner].scene.some((card) => card.uid === srUid)
        && removeResult.redirectedToPartner !== true
      );
      const redirectedToPartner = removeResult.redirectedToPartner === true;
      if (!removedToRemove) (ctx.dyn ??= {}).chainStepNoApply = true;
      if (removedToRemove) {
        recordPublicZoneMove(s, ctx, srOwner, 'scene', srOwner, 'remove', 1);
      } else if (redirectedToPartner && srOwner !== undefined) {
        recordPublicZoneMove(s, ctx, srOwner, 'scene', srOwner, 'partner', 1);
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneRemove', target: srUid });
      return;
    }

export function atomCharRemoveSetCard(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // 2026-06-06 タスクC: キャラに裏向きでセットされたカードを1枚リムーブ (rules/16, B08034)。
      // PA 短縮形 (sceneRemove と同型): uid 不在 + n/max → pick query (filter hasSetCards:true で
      // セット card を持つキャラのみ候補化) を構築 + tryRePickFromAtom。max:1 は skip 可 → chain break で
      // 「リムーブしてもよい」を表現。resolve 後に removeOneSetCard で末尾 1 枚をリムーブエリアへ。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        const rsP = resolvePlayer(a.player, ctx);
        paShortFormAwait(s, verb, a, ctx, rsP, a.player as Player); // BUG-174: 同上
        return;
      }
      // max:1 で 0 枚選択 (skip) は uid='$pick' のまま到達 → silent no-op (sceneRemove 同型)。
      // chain の「そうした場合」break は skip 時の continuation-drop / no-candidate 時の
      // chainStepNoApply (resolve-picks → ctx.dyn、Phase 3c) が担うため、ここでは立てない。
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charRemoveSetCard', result: 'skipped' });
        return;
      }
      const rsUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof rsUid !== 'string' || rsUid.startsWith('$')) return;
      const rsOwner = s.players.self.scene.some((card) => card.uid === rsUid)
        ? 'self' as const
        : s.players.opp.scene.some((card) => card.uid === rsUid) ? 'opp' as const : undefined;
      // engine mega-wave W4 (2026-07-03, r82 同梱): faceDownOnly opt-in 転送 (B08035 a2「裏向きで
      // セットされているカード」)。未指定は従来通り末尾1枚 (B02033 は裏向き限定なし = 挙動不変)。
      const setCardId = resolveBindRef(a.setCardId, ctx) as string | undefined;
      const setCardInstanceId = resolveBindRef(a.setCardInstanceId, ctx) as string | undefined;
      const removeOpts = typeof setCardInstanceId === 'string' && !setCardInstanceId.startsWith('$')
        ? { setCardInstanceId }
        : typeof setCardId === 'string' && !setCardId.startsWith('$')
        ? { setCardId }
        : a.faceDownOnly === true ? { faceDownOnly: true } : undefined;
      const removed = mutate.char.removeOneSetCard(s, rsUid, removeOpts);
      if (removed !== null && rsOwner !== undefined) {
        recordPublicZoneMove(s, ctx, rsOwner, 'set-card', rsOwner, 'remove', 1);
      }
      if (!removed && a.gateOnMissing === true) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
      }
      // engine A3 wave (2026-07-11, B02087): 実除去カードを bind (「リムーブした場合」gate 用)。
      //   removed=cardId なら [{cardId}]、無ければ []。後続 conditional{bound presence:'matched'} が
      //   「リムーブした場合のみ」を判定 (0枚 decline/no-candidate は unbound/[] → not-matched)。既存 caller は
      //   bind 未指定 → 挙動不変。
      if (typeof a.bind === 'string') {
        (ctx.bindings as Record<string, unknown>)[a.bind] = removed ? [{ cardId: removed }] : [];
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charRemoveSetCard', target: rsUid, result: removed ?? 'none' });
      return;
    }

export function atomSceneToHand(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine-extension #4 (2026-06-05): char→hand bounce verb. PA 短縮形 (sceneRemove と同型)。
      // 「相手の現場のキャラを1枚まで選び、手札に移す」等で使用。所有者の手札に戻る点に注意。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        const sthP = resolvePlayer(a.player, ctx);
        paShortFormAwait(s, verb, a, ctx, sthP, a.player as Player); // BUG-174: 同上
        return;
      }
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneToHand', result: 'skipped' });
        return;
      }
      const sthUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof sthUid !== 'string' || sthUid.startsWith('$')) return;
      const sthOwner: Player | undefined = s.players.self.scene.some((card) => card.uid === sthUid)
        ? 'self'
        : s.players.opp.scene.some((card) => card.uid === sthUid)
          ? 'opp'
          : undefined;
      const sthCardId = sthOwner === undefined
        ? undefined
        : s.players[sthOwner].scene.find((card) => card.uid === sthUid)?.cardId;
      const sthHandBefore = sthOwner === undefined ? 0 : s.players[sthOwner].hand.length;
      const sthPartnerAreaBefore = sthOwner === undefined ? undefined : partnerAreaMrSignature(s, sthOwner);
      mutate.scene.toHand(s, sthUid);
      if (sthOwner !== undefined && s.players[sthOwner].hand.length === sthHandBefore + 1) {
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: 'zone-move',
          source: { kind: 'zone', side: sthOwner, zone: 'scene' },
          targets: [{ kind: 'zone', side: sthOwner, zone: 'hand' }],
          outcome: { type: 'move', from: 'scene', to: 'hand', count: 1 },
        });
      } else if (
        sthOwner !== undefined
        && redirectedSceneCardToPartnerArea(s, sthOwner, sthCardId, sthPartnerAreaBefore)
      ) {
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: 'zone-move',
          source: { kind: 'zone', side: sthOwner, zone: 'scene' },
          targets: [{ kind: 'zone', side: sthOwner, zone: 'partner' }],
          outcome: { type: 'move', from: 'scene', to: 'partner', count: 1 },
        });
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneToHand', target: sthUid });
      return;
    }

export function atomSceneToDeck(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // Task D E2 (2026-06-12): scene→deck verb。sceneToHand と同型の PA 短縮形。
      // 「相手の現場のキャラを1枚まで選び、デッキの下に移す」(B07080/B08058/D10009 等)。
      // rules: 09/23 (リムーブでない=現場リムーブ時不発動), 16 (set/stacked リムーブ)
      // pos:'top' で「デッキの上に移す」(B05092)。移動先は所有者のデッキ。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        // chooser=controller / side 既定=a.player (対象側) — BUG-120 系規約
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, a.player as Player); // BUG-174: side は相対値のまま渡す (sidesForQuery が owner 相対解釈 — 絶対値だと owner='opp' で反転)
        return;
      }
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneToDeck', result: 'skipped' });
        return;
      }
      const stdUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof stdUid !== 'string' || stdUid.startsWith('$')) return;
      const stdPos = a.pos === 'top' ? 'top' : 'bottom';
      const stdOwner: Player | undefined = s.players.self.scene.some((card) => card.uid === stdUid)
        ? 'self'
        : s.players.opp.scene.some((card) => card.uid === stdUid)
          ? 'opp'
          : undefined;
      const stdCardId = stdOwner === undefined
        ? undefined
        : s.players[stdOwner].scene.find((card) => card.uid === stdUid)?.cardId;
      const stdDeckBefore = stdOwner === undefined ? 0 : s.players[stdOwner].deck.length;
      const stdPartnerAreaBefore = stdOwner === undefined ? undefined : partnerAreaMrSignature(s, stdOwner);
      mutate.scene.toDeck(s, stdUid, stdPos);
      if (stdOwner !== undefined && s.players[stdOwner].deck.length === stdDeckBefore + 1) {
        recordPublicZoneMove(s, ctx, stdOwner, 'scene', stdOwner, 'deck', 1);
      } else if (
        stdOwner !== undefined
        && redirectedSceneCardToPartnerArea(s, stdOwner, stdCardId, stdPartnerAreaBefore)
      ) {
        recordPublicZoneMove(s, ctx, stdOwner, 'scene', stdOwner, 'partner', 1);
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneToDeck', target: stdUid, result: stdPos });
      return;
    }

export function atomSceneToEvidence(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine mega-wave W1 (2026-07-03, P38): scene→owner-evidence verb。sceneToDeck と同型の PA 短縮形。
      // 「相手の現場にいるレベル7以下のキャラを1枚まで選び、相手はそのカードを表向きのまま証拠として得る」
      // (B03084)。移動先は **キャラ所有者** の証拠 (mutate.scene.toEvidence が owner を解決)。
      // rules: 01 (証拠), 09/23 (リムーブでない=現場リムーブ時不発動), 16 (set/stacked リムーブ), 18 (MR① parity)
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        // chooser=controller / side 既定=a.player (対象側) — BUG-120 系規約 (sceneToDeck と同一)
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, a.player as Player); // BUG-174: side は相対値のまま渡す (sidesForQuery が owner 相対解釈 — 絶対値だと owner='opp' で反転)
        return;
      }
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneToEvidence', result: 'skipped' });
        return;
      }
      const steUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof steUid !== 'string' || steUid.startsWith('$')) return;
      // a.bind ('$picked' 等) はハンドラ内で書かず、pick 解決層 (apply-pick/picks.ts) が chosen を
      // Candidate[] で bindings に書く (短縮形共通配線、B06085 boundIsMr が後段で参照)。
      const steFaceUp = a.faceUp !== false; // 既定 true (「表向きのまま証拠として得る」)
      const steOwner: Player | undefined = s.players.self.scene.some((card) => card.uid === steUid)
        ? 'self'
        : s.players.opp.scene.some((card) => card.uid === steUid)
          ? 'opp'
          : undefined;
      const steCardId = steOwner === undefined
        ? undefined
        : s.players[steOwner].scene.find((card) => card.uid === steUid)?.cardId;
      const steEvidenceBefore = steOwner === undefined ? 0 : s.players[steOwner].evidence.length;
      const stePartnerAreaBefore = steOwner === undefined ? undefined : partnerAreaMrSignature(s, steOwner);
      mutate.scene.toEvidence(s, steUid, steFaceUp, ctx.source.cardId);
      if (steOwner !== undefined && s.players[steOwner].evidence.length === steEvidenceBefore + 1) {
        recordPublicZoneMove(s, ctx, steOwner, 'scene', steOwner, 'evidence', 1, 'evidence');
      } else if (
        steOwner !== undefined
        && redirectedSceneCardToPartnerArea(s, steOwner, steCardId, stePartnerAreaBefore)
      ) {
        recordPublicZoneMove(s, ctx, steOwner, 'scene', steOwner, 'partner', 1);
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneToEvidence', target: steUid, result: steFaceUp ? 'faceUp' : 'faceDown' });
      return;
    }

export function atomSceneSetState(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // PA 短縮形: uid 不在 + player + state(設定先の状態の文字列) + n|max → scene pick を構築。
      // a.state は「設定先の状態」なので候補 filter には載せない (buildShortFormPick は配列 state のみ拾う)。
      if (a.uid === undefined && typeof a.player === 'string' && typeof a.state === 'string' && hasNorMax(a)) {
        // Cluster WB1 (2026-07-11, B03063「死闘」): dyn 上限が 0 以下に解決された「0枚まで選ぶ」は degenerate
        //   pick を出さず no-op (rules/15「〜まで」= 0可、evidenceFlip の dyn-max-0 と同 posture)。
        //   「自分の現場の〚特徴[空手家]〛と同じ数まで相手キャラをスリープ」= max:{dyn:'$self.sceneTrait.空手家'}。
        //   ★ top-level {dyn} は resolve-picks.resolveDynArgs が atom dispatch 前に literal 化済 (nMax:2 等は
        //   既に機能) → ここでは resolved 数値のみを見て 0以下を抑止する。全カードで literal max:0/n:0 短縮形は
        //   未使用のため byte 互換 (n.max:0 の pick object とは別物)。
        const ssMaxN = typeof a.max === 'number' ? a.max : (typeof a.n === 'number' ? (a.n as number) : undefined);
        if (ssMaxN !== undefined && ssMaxN <= 0) {
          mutate.log.append(s, { ts: Date.now(), player: resolvePlayer(a.player, ctx), turn: s.turn.number, action: 'effect:sceneSetState', target: 'max-0', result: 'none' });
          return;
        }
        paShortFormAwait(s, verb, a, ctx, resolvePlayer(a.player, ctx), 'either');
        return;
      }
      const ssUid = resolveBindRef(a.uid, ctx) as string;
      // A binding-dependent conditional may defer its Pattern-A pick until the
      // resolver reaches the selected branch.  Re-surface that pick here;
      // otherwise uid:'$pick' would silently no-op after the branch is true.
      if (typeof ssUid !== 'string' || ssUid.startsWith('$')) {
        if (a.uid === '$pick' && a.target && typeof a.target === 'object') {
          const ssPlayer = ctx.source.player;
          // Pattern-A pre-walk keeps the unresolved carrier as a runtime no-op after
          // it has already queued the human decision. Re-queue only for the deferred
          // conditional path where no equivalent pre-walk pending exists.
          const queuedEquivalent = ((globalThis as {
            __pendingEffectPickQueue?: Array<{
              atomVerb: string;
              atomArgs: Record<string, unknown>;
              source: { cardId: string; abilityId: string };
            }>;
          }).__pendingEffectPickQueue ?? []).some(pending =>
            pending.atomVerb === verb
            && pending.source.cardId === (ctx.source.cardId ?? '')
            && pending.source.abilityId === (ctx.source.abilityId ?? '')
            && JSON.stringify(pending.atomArgs) === JSON.stringify(a));
          if (!queuedEquivalent) {
            tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, {
              byPlayer: ssPlayer,
              source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
            });
          }
          mutate.log.append(s, { ts: Date.now(), player: ssPlayer, turn: s.turn.number, action: 'effect:sceneSetState:awaiting-pick' });
        }
        return;
      }
      const ssState = a.state as 'active' | 'sleep' | 'stun';
      const ssOwner: Player | undefined = s.players.self.scene.some((card) => card.uid === ssUid)
        ? 'self'
        : s.players.opp.scene.some((card) => card.uid === ssUid)
          ? 'opp'
          : undefined;
      const ssBefore = ssOwner === undefined
        ? undefined
        : s.players[ssOwner].scene.find((card) => card.uid === ssUid)?.state;
      // engine mega-wave W4 (2026-07-03, r1 P01): 保護 rider gate —「相手の能力や効果によって
      // スリープされず、スタンされない」(B05041)。相手発の sleep/stun のみ block ('active' 化は
      // 不利益でないため対象外)。既存カードは未宣言 → false 短絡。
      if (ssState === 'sleep' || ssState === 'stun') {
        const ssProtectedOwner: Player = s.players.self.scene.some(c => c.uid === ssUid) ? 'self' : 'opp';
        if (ctx.source.player !== ssProtectedOwner && readChar.charProtectedFrom(s, ssUid, ssState)) {
          (ctx.dyn ??= {}).chainStepNoApply = true;
          mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneSetState', target: ssUid, result: 'blocked-protected' });
          return;
        }
      }
      mutate.scene.setState(s, ssUid, ssState);
      const ssAfter = [...s.players.self.scene, ...s.players.opp.scene]
        .find(c => c.uid === ssUid)?.state;
      if (
        ssOwner !== undefined
        && ssBefore !== ssAfter
        && (ssAfter === 'active' || ssAfter === 'sleep' || ssAfter === 'stun')
      ) {
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: ssAfter === 'active' ? 'activate' : ssAfter,
          source: { kind: 'player', side: ctx.source.player },
          targets: [{ kind: 'scene-card', side: ssOwner, uid: ssUid }],
          outcome: { type: 'state', state: ssAfter },
        });
      }
      // BUG-167: `chain` means 「そうした場合」.  A resolved uid is not proof that the
      // requested state effect applied: rules/03 keeps stun unchanged for sleep/stun,
      // and setting an already-equal state is also a no-op.  Gate the tail from the
      // actual board transition, shared by direct, $self, and bound-uid paths.
      if (ssBefore === ssAfter) (ctx.dyn ??= {}).chainStepNoApply = true;
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneSetState', target: ssUid, result: ssState });
      return;
    }

export function atomSceneDisguise(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-068: bind ref 解決を配線
      const dgUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof dgUid !== 'string' || dgUid.startsWith('$')) return;
      const dgNewCardId = resolveBindRef(a.newCardId, ctx) as string;
      if (typeof dgNewCardId !== 'string' || dgNewCardId.startsWith('$')) return;
      const dgOwner: Player | undefined = s.players.self.scene.some((card) => card.uid === dgUid)
        ? 'self'
        : s.players.opp.scene.some((card) => card.uid === dgUid)
          ? 'opp'
          : undefined;
      if (dgOwner === undefined) return;
      const dgBefore = s.players[dgOwner].scene.find((card) => card.uid === dgUid)?.cardId;
      if (dgBefore === dgNewCardId) return;
      mutate.char.disguiseInto(s, dgUid, dgNewCardId);
      const dgAfter = s.players[dgOwner].scene.find((card) => card.uid === dgUid)?.cardId;
      if (dgAfter !== dgNewCardId) return;
      recordEffectCausalOperation(s, ctx, {
        actor: ctx.source.player,
        kind: 'value-change',
        source: { kind: 'player', side: ctx.source.player },
        targets: [{ kind: 'scene-card', side: dgOwner, uid: dgUid }],
        outcome: { type: 'state', state: 'success' },
      });
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneDisguise', target: dgUid, result: 'changed' });
      return;
    }
