// engine.effect.apply-pick — pending effect-pick の解決 + continuation 実行を一箇所に集約。
//
// rules: 15-abilities-effects.md (効果解決順) / 21-declared-ability-cost.md
// spec: BUG-054/065 (pattern A/B substitute) / BUG-107 (continuation の bind 共有) / BUG-109 (AI drain)
//
// 設計:
//   - `applyPickAndContinuation` は「pick 解決した atom を build → 中断中 sequence/chain の保存 ctx で
//     runEffect 実行 → continuation remainder を同一 ctx で実行」を行う。human (useEngineDispatch.
//     effectPickResolve) と AI (drainAiEffectPicks) の **共通実体**。store / skip / 候補選択は呼出側。
//   - `drainAiEffectPicks` は __pendingEffectPickQueue を heuristic で順次解決する (CPU 経路には
//     human modal が無いため、PA 短縮形 atom の pick が drain されず no-op になる BUG-109 を解消)。

import type { GameState, Effect, EffectCtx, Candidate, Condition } from '../types/index.js';
import type { PendingEffectPickSide, PendingEffectChoiceSide, PendingEffectOptionalSide, ContinuationFrame } from './resolve-picks.js';
import { resolveEffectPicks, _takePendingChoiceResume, _takePendingChoiceBindings, _takePendingOptionalResume, _takePendingOptionalBindings, _takePendingOptionalCostPaid } from './resolve-picks.js';
import { findChooseIntercept } from './consult-choose-intercept.js';

type Player = 'self' | 'opp';
import { run as runEffect } from './resolver.js';
import {
  _takePendingChooseInterceptResume,
  _takePendingEffectRepeatOptionalResume,
  pushPendingChooseInterceptSide,
  type PendingChooseInterceptSide,
  type PendingEffectRepeatOptionalSide,
  type PendingRpsSide,
  type RpsHand,
  _takePendingRpsResume,
  pushPendingRpsSide,
  setPendingRpsResume,
  _takePendingSetCardChoiceResume,
  type PendingSetCardChoiceSide,
  type PendingSetCardReplacementSide,
} from './pending-state.js';
import { hand } from '../mutate/hand.js';
import { char as charMutator } from '../mutate/char.js';
import { scene as sceneMutator } from '../mutate/scene.js';
import { resolveBindRef } from './atom-handlers/_shared.js';

export function applyRepeatOptionalAndContinuation(state: GameState, _pending: PendingEffectRepeatOptionalSide, run: boolean): void {
  const resume = _takePendingEffectRepeatOptionalResume();
  if (!resume) return;
  const next: Effect[] = run
    ? [resume.body, ...(resume.remaining > 1 ? [{ kind: 'repeatOptional', max: resume.remaining - 1, body: resume.body } as Effect] : []), ...resume.remainder]
    : resume.remainder;
  const effect: Effect = { kind: 'sequence', steps: next };
  const resolved = resolveEffectPicks(state, effect, resume.ctx, { humanChooser: true, byPlayer: resume.ctx.source.player, source: { cardId: resume.ctx.source.cardId ?? '', abilityId: resume.ctx.source.abilityId ?? '' } });
  runEffect(state, resolved, resume.ctx);
}
import { runAllUntilEmpty } from '../resolve/index.js';
import { event } from '../event/index.js';
import { def } from '../read/def.js';
import { allCardNameComponentsForDef } from '../target/card-def-registry.js';

/** Resolve the human half of a dedicated rock-paper-scissors decision. */
export function applyRpsAndContinuation(state: GameState, pending: PendingRpsSide, handChoice: RpsHand): void {
  const resume = _takePendingRpsResume();
  if (!resume || resume.effect.kind !== 'rps') return;
  const hands: RpsHand[] = ['rock', 'paper', 'scissors'];
  const wins = (a: RpsHand, b: RpsHand): boolean =>
    (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper');
  const ownerHand = pending.ownerPlayer === pending.player ? handChoice : pending.aiHand;
  const otherHand = pending.ownerPlayer === pending.player ? pending.aiHand : handChoice;
  if (ownerHand === otherHand) {
    const aiHand = hands[Math.floor(Math.random() * hands.length)]!;
    pushPendingRpsSide({ ...pending, aiHand });
    setPendingRpsResume(resume.effect, resume.bindings);
    return;
  }
  const ctx: EffectCtx = {
    source: { cardId: pending.source.cardId, uid: pending.source.uid, abilityId: pending.source.abilityId, player: pending.ownerPlayer, area: 'scene' },
    bindings: resume.bindings as EffectCtx['bindings'],
  };
  const branch = wins(ownerHand, otherHand) ? resume.effect.win : resume.effect.lose;
  const resolved = resolveEffectPicks(state, branch, ctx, {
    byPlayer: pending.ownerPlayer,
    humanChooser: pending.player === pending.ownerPlayer,
    humanPlayer: pending.player,
    source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId },
  });
  runEffect(state, resolved, ctx);
  runAllUntilEmpty(state);
}

/** Resolve an opaque set-card occurrence selection and expose it as face-up evidence. */
export function applySetCardChoiceAndContinuation(state: GameState, pending: PendingSetCardChoiceSide, instanceId: string): void {
  const resume = _takePendingSetCardChoiceResume();
  if (!resume || resume.effect.kind !== 'setCardToEvidence' || !pending.entries.some((entry) => entry.instanceId === instanceId)) return;
  const moved = charMutator.takeOneSetCard(state, pending.hostUid, instanceId);
  if (!moved) return;
  state.players[moved.player].evidence.push({ cardId: moved.cardId, faceUp: true, origin: { turn: state.turn.number, via: 'effect', sourceCardId: pending.source.cardId } });
  if (resume.remainder.length > 0) {
    const ctx: EffectCtx = {
      source: { cardId: pending.source.cardId, uid: pending.source.uid, abilityId: pending.source.abilityId, player: pending.player, area: 'scene' },
      bindings: resume.bindings as EffectCtx['bindings'],
    };
    const continuation: Effect = { kind: resume.remainderKind, steps: resume.remainder };
    const resolved = resolveEffectPicks(state, continuation, ctx, {
      byPlayer: pending.player,
      humanChooser: true,
      humanPlayer: pending.player,
      source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId },
    });
    runEffect(state, resolved, ctx);
  }
  runAllUntilEmpty(state);
}

/** Resolve the optional pre-removal replacement of one exact set-card occurrence. */
export function applySetCardReplacement(state: GameState, pending: PendingSetCardReplacementSide, toUid: string | null): void {
  const applied = charMutator.resolveSetCardRemovalReplacement(state, pending, toUid);
  if (applied && pending.resume) {
    switch (pending.resume.kind) {
      case 'scene-remove':
        sceneMutator.removeToRemove(state, pending.fromUid, pending.resume.cause, pending.resume.byUid, {
          byPlayer: pending.resume.byPlayer,
          skipSetCardReplacementInstanceIds: [pending.setCardInstanceId],
        });
        break;
      case 'scene-to-deck':
        sceneMutator.toDeck(state, pending.fromUid, pending.resume.pos);
        break;
      case 'scene-to-hand':
        sceneMutator.toHand(state, pending.fromUid);
        break;
      case 'scene-to-evidence':
        sceneMutator.toEvidence(state, pending.fromUid, pending.resume.faceUp, pending.resume.sourceCardId);
        break;
      case 'scene-to-stack':
        sceneMutator.toStack(state, pending.fromUid, pending.resume.hostUid);
        break;
    }
  }
  runAllUntilEmpty(state);
}

/**
 * pick uid → cardId 逆引き。`evidence:side:idx` / `cardId#idx` / snapshot fallback に対応。
 * (旧 useEngineDispatch ローカル。BUG-109 で engine 側へ移し human/AI 共有。)
 * Pattern A (uid='$pick' / scene char uid) は本関数を呼ばない経路。
 */
export function resolveCardIdFromPickUid(
  uid: string,
  state: GameState | null,
  pending: { candidates: ReadonlyArray<{ uid: string; cardId: string }> },
): string | null {
  if (!state) {
    return pending.candidates.find((c) => c.uid === uid)?.cardId ?? null;
  }
  const ev = uid.match(/^evidence:(self|opp):(\d+)$/);
  if (ev) {
    const side = ev[1] as 'self' | 'opp';
    const idx = parseInt(ev[2]!, 10);
    return state.players[side]?.evidence?.[idx]?.cardId ?? null;
  }
  const ch = uid.match(/^([^#]+)#\d+$/);
  if (ch) return ch[1] ?? null;
  return pending.candidates.find((c) => c.uid === uid)?.cardId ?? null;
}

/**
 * BUG-111 family (continuation-nest, 2026-06-22): continuation frame 連鎖 (head → outer) を順に実行する。
 * 各 frame の remainder を保存 ctx で runEffect → runAllUntilEmpty。
 * ある frame の remainder 実行中に **再 pause** (新 pick enqueue) したら、残りの outer frames を
 * その新 pick に引き継いで停止する (外側 remainder は新 pick の解決時に実行される)。
 * 単一 frame (outer 無し) は従来の「remainder を 1 回 runEffect + runAllUntilEmpty」と byte 互換。
 */
function conditionReadsBinding(condition: Condition): boolean {
  switch (condition.kind) {
    case 'bound':
    case 'boundMatchesFilter':
    case 'boundAnyMatchesFilter':
    case 'boundDistinctColorCount':
    case 'boundNameMatchesDeclared':
    case 'boundIsMr':
    case 'boundCharStateIs':
      return true;
    case 'not':
      return conditionReadsBinding(condition.c);
    case 'and':
    case 'or':
      return condition.cs.some(conditionReadsBinding);
    default:
      return false;
  }
}

/**
 * Pre-walk leaves a conditional raw while a preceding pick has not produced
 * its binding. Only that shape needs a continuation-boundary re-walk; doing
 * it for every Pattern-B remainder mutates its original target query.
 */
function hasBindingDependentConditional(effect: Effect): boolean {
  switch (effect.kind) {
    case 'conditional':
      return conditionReadsBinding(effect.if)
        || hasBindingDependentConditional(effect.then)
        || (effect.else !== undefined && hasBindingDependentConditional(effect.else));
    case 'sequence':
    case 'parallel':
    case 'chain':
      return effect.steps.some(hasBindingDependentConditional);
    case 'choice':
      return effect.options.some(hasBindingDependentConditional);
    case 'optional':
      return hasBindingDependentConditional(effect.effect);
    case 'forEach':
      return hasBindingDependentConditional(effect.do);
    case 'repeatOptional':
      return hasBindingDependentConditional(effect.body);
    case 'replace':
      return hasBindingDependentConditional(effect.with);
    default:
      return false;
  }
}

function runContinuationChain(state: GameState, head: ContinuationFrame | undefined): void {
  const g = globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] };
  let f: ContinuationFrame | undefined = head;
  while (f) {
    const qBefore = g.__pendingEffectPickQueue?.length ?? 0;
    const remainderEffect: Effect = f.remainder.length === 1
      ? f.remainder[0]!
      : { kind: f.kind, steps: f.remainder };
    // A preceding picked atom can create a binding which selects a later
    // conditional branch. Re-walk only this deferred shape: a blanket
    // re-walk changes already-resolved Pattern-B target queries (B06025).
    let resolvedRemainder = remainderEffect;
    if (hasBindingDependentConditional(remainderEffect)) {
      const byPlayer = f.ctx.source.player;
      const runtimeDyn = f.ctx.dyn as Record<string, unknown> | undefined;
      const knownOwner = runtimeDyn?.['runtimePickOwnerKnown'] === true;
      const rememberedHuman = runtimeDyn?.['runtimeHumanPlayer'];
      const humanSide: Player | null = rememberedHuman === 'self' || rememberedHuman === 'opp'
        ? rememberedHuman
        : null;
      resolvedRemainder = resolveEffectPicks(state, remainderEffect, f.ctx, {
        byPlayer,
        humanChooser: knownOwner ? humanSide === byPlayer : true,
        ...(knownOwner ? { humanPlayer: humanSide } : {}),
        source: { cardId: f.ctx.source.cardId ?? '', abilityId: f.ctx.source.abilityId ?? '' },
      });
    }
    runEffect(state, resolvedRemainder as never, f.ctx);
    const qAfter = g.__pendingEffectPickQueue?.length ?? 0;
    if (qAfter > qBefore && f.outer) {
      // remainder 自身が再 pause → 残り outer frames を新 pick (queue[qBefore]) の continuation 末尾に append。
      // (resolver が intra-frame remainder を既に同梱していれば、その outer 末尾に連結される。)
      const firstNew = g.__pendingEffectPickQueue?.[qBefore];
      if (firstNew) {
        if (!firstNew.continuation) firstNew.continuation = f.outer;
        else { let t = firstNew.continuation; while (t.outer) t = t.outer; t.outer = f.outer; }
      }
      runAllUntilEmpty(state);
      return;
    }
    runAllUntilEmpty(state);
    f = f.outer;
  }
}

/** Human dispatch is untrusted. Enforce the same multi-pick constraints as UI and AI. */
function validatePendingPick(
  pending: PendingEffectPickSide,
  pickedUid: string,
  pickedUids?: string[],
): void {
  const uids = pickedUids ?? [pickedUid];
  // Existing pick contract: 0-pick reaches the atom as `target: []`, while
  // exact-N short-form atoms may resolve one human-picked candidate at a time.
  if (uids.length === 0) return;
  if (!uids.includes(pickedUid)) throw new Error('effectPickResolve: pickedUid is absent from pickedUids');
  if (uids.length > pending.nMax) {
    throw new Error(`effectPickResolve: picked count ${uids.length} exceeds ${pending.nMax}`);
  }
  if (new Set(uids).size !== uids.length) throw new Error('effectPickResolve: duplicate candidate uid');
  const chosen = uids.map((uid) => {
    const candidate = pending.candidates.find((c) => c.uid === uid);
    if (!candidate) throw new Error(`effectPickResolve: unknown candidate uid ${uid}`);
    return candidate;
  });
  const forced = (pending.forcedUids ?? []).slice(0, pending.nMax);
  if (forced.some((uid) => !chosen.some((c) => c.uid === uid))) {
    throw new Error('effectPickResolve: required candidate omitted');
  }
  if (pending.distinctNames === true) {
    const seen = new Set<string>();
    for (const c of chosen) {
      const names = def.card(c.cardId) ? allCardNameComponentsForDef(def.card(c.cardId)!) : [c.cardId];
      if (names.some((name) => seen.has(name))) throw new Error('effectPickResolve: distinctNames violated');
      names.forEach((name) => seen.add(name));
    }
  }
  if (pending.distinctLevel === true) {
    const seen = new Set<number>();
    for (const c of chosen) {
      const level = def.card(c.cardId)?.level;
      if (typeof level === 'number' && seen.has(level)) throw new Error('effectPickResolve: distinctLevel violated');
      if (typeof level === 'number') seen.add(level);
    }
  }
  if (pending.distinctColors === true) {
    const seen = new Set<string>();
    for (const c of chosen) {
      const colors = def.card(c.cardId)?.colors ?? [];
      if (colors.some((color) => seen.has(color))) throw new Error('effectPickResolve: distinctColors violated');
      colors.forEach((color) => seen.add(color));
    }
  }
  if (typeof pending.perSideMax === 'number') {
    const count: Record<Player, number> = { self: 0, opp: 0 };
    for (const c of chosen) {
      count[c.player]++;
      if (count[c.player] > pending.perSideMax) throw new Error('effectPickResolve: perSideMax violated');
    }
  }
  if (typeof pending.aggregateLevelMax === 'number') {
    const totalLevel = chosen.reduce((sum, candidate) => sum + (def.card(candidate.cardId)?.level ?? 0), 0);
    if (totalLevel > pending.aggregateLevelMax) {
      throw new Error('effectPickResolve: aggregateLevelMax violated');
    }
  }
}

/**
 * pending pick を pickedUid(s) で解決し、保存された sequence/chain continuation があれば
 * **同一 ctx** で remainder を実行する (BUG-107: bind を step 間で共有)。
 * 呼出側は skip (pickedUid=null) を事前処理し、queue から該当 pending を取り除いておくこと。
 */
export function applyPickAndContinuation(
  state: GameState,
  pending: PendingEffectPickSide,
  pickedUid: string,
  pickedUids?: string[],
  switchRemoveUid?: string,
  switchRemoveUids?: string[],
  skipChooseIntercept = false,
): void {
  validatePendingPick(pending, pickedUid, pickedUids);
  const interceptCtx = pending.continuation?.ctx ?? {
    source: {
      cardId: pending.source.cardId,
      uid: (pending.source as { uid?: string }).uid ?? '',
      abilityId: pending.source.abilityId,
      player: pending.player,
      area: 'scene' as const,
    },
    bindings: {},
  };
  if (!skipChooseIntercept) {
    for (const uid of pickedUids ?? [pickedUid]) {
      const intercept = findChooseIntercept(state, uid, interceptCtx);
      if (intercept.kind === 'cancel') return;
      if (intercept.kind === 'discard-or-cancel') {
        pushPendingChooseInterceptSide(
          {
            player: intercept.responder,
            protector: { uid: intercept.protectorUid, cardId: intercept.protectorCardId, abilityId: intercept.abilityId },
            targetUid: uid,
          },
          { pending, pickedUid, pickedUids, switchRemoveUid, switchRemoveUids },
        );
        return;
      }
    }
  }
  // Stacked-card candidates are identities, not card IDs. Revalidate their host
  // immediately before resolution: a stale or below-minimum client selection must
  // not reach the atom or its continuation.
  let resolvedStackHostUid: string | undefined;
  if (pending.atomVerb === 'stackedCardPick') {
    const args = pending.atomArgs as { hostUid?: unknown; min?: unknown; max?: unknown };
    const hostUid = resolveBindRef(args.hostUid, interceptCtx);
    if (typeof hostUid !== 'string' || typeof args.min !== 'number' || typeof args.max !== 'number'
      || charMutator.selectStackedCardEntries(state, hostUid, pickedUids ?? [pickedUid], args.min, args.max) === null) {
      throw new Error('stackedCardPick: stale, duplicate, or below-minimum selection');
    }
    resolvedStackHostUid = hostUid;
  }
  // ---- resolved atom を build (Pattern A: uid='$pick' → uid 置換 / Pattern B: cardId(s)/target 置換) ----
  const pendingArgs = pending.atomArgs as { uid?: unknown };
  const isPatternA = pendingArgs.uid === '$pick';
  // mega-wave W6 step6 (2026-07-04, r79/B08014): human+AI 共有継続経路の MR 選択タグ —
  // resolve-picks.ts substituteAtomPick (AI 同期 walk) と対称実装 (BUG-158 型 両経路罠)。
  // source card = MR の時のみ、解決済み現場キャラ uid を `_mrSelectCharUids` として args に同梱
  // (turnEffects 書込は resolver.ts atom dispatch 前 guard)。非 MR は完全素通し。
  const w6IsMrSource = def.isMR(pending.source.cardId);
  const w6CharUidsOf = (uids: string[]): string[] =>
    uids.filter(u => state.players.self.scene.some(c => c.uid === u) || state.players.opp.scene.some(c => c.uid === u));
  const w6TagMr = (a: Record<string, unknown>, uids: string[]): Record<string, unknown> => {
    if (!w6IsMrSource) return a;
    const charUids = w6CharUidsOf(uids);
    return charUids.length > 0 ? { ...a, _mrSelectCharUids: charUids } : a;
  };
  let resolvedAtom: Effect;
  if (isPatternA) {
    const { target: _omit, ...restArgs } = pending.atomArgs;
    void _omit;
    // engine-extension #3 (2026-06-05): multi-target Pattern A
    // pickedUids が複数なら各 uid に atom を per-char 適用する sequence にまとめる。
    // 単一なら従来通り (sequence wrap せずに atom のまま runEffect / event.queue)。
    const uids = (pickedUids && pickedUids.length > 1) ? pickedUids : [pickedUid];
    if (uids.length === 1) {
      resolvedAtom = { kind: 'atom', verb: pending.atomVerb as never, args: w6TagMr({ ...restArgs, uid: uids[0]! }, [uids[0]!]) };
    } else {
      const atoms: Effect[] = uids.map((u) => ({
        kind: 'atom' as const,
        verb: pending.atomVerb as never,
        args: w6TagMr({ ...restArgs, uid: u }, [u]),
      }));
      resolvedAtom = { kind: 'sequence', steps: atoms };
    }
  } else {
    const resolvedCardId = resolveCardIdFromPickUid(pickedUid, state, pending);
    if (!resolvedCardId) return; // 想定外、防御スキップ
    const hasCardIdBind = (pending.atomArgs as { cardId?: unknown }).cardId === '$pick.cardId';
    const hasCardIdsBind = (pending.atomArgs as { cardIds?: unknown }).cardIds === '$pick.cardIds';
    const hasInstanceIdsBind = (pending.atomArgs as { selectedInstanceIds?: unknown }).selectedInstanceIds === '$pick.uids';
    const allUids: string[] = pickedUids ?? [pickedUid];
    const allCardIds: string[] = allUids
      .map((u) => resolveCardIdFromPickUid(u, state, pending))
      .filter((c): c is string => typeof c === 'string');
    // Deck candidate uid carries the selected occurrence as `${cardId}#${index}`.
    // Preserve it because card IDs alone cannot distinguish duplicate copies.
    const selectedDeckIndexes = allUids.map((uid) => {
      const match = /#(\d+)$/.exec(uid);
      return match ? Number(match[1]) : undefined;
    });
    // switch-on-effect-enter: sceneEnter が現場満杯のとき UI が収集した switch 退場 uid を
    // 解決済 atom args に載せる (handler が switchEnter する)。他 atom には影響しない (未指定なら付かない)。
    // cluster14: multi-card sceneEnter は switchRemoveUids[] (plural, overflow 枚数ぶん) を優先。
    //   順序維持 (plural→singular→{}) で単一 sceneEnter (switchRemoveUid) path は byte 不変。
    const switchPart = (switchRemoveUids && switchRemoveUids.length > 0)
      ? { switchRemoveUids }
      : switchRemoveUid ? { switchRemoveUid } : {};
    const newArgs: Record<string, unknown> = hasCardIdsBind
      ? { ...pending.atomArgs, cardIds: allCardIds, selectedDeckIndexes, ...switchPart } // target は元の pick query を保持
      : hasCardIdBind
        ? { ...pending.atomArgs, cardId: resolvedCardId, selectedCardIndex: selectedDeckIndexes[0], ...switchPart } // target は元の pick query を保持
        // BUG-165 (wave-10 2026-07-02): 旧 target:[resolvedCardId] は pickedUids (nMax>1 の複数選択、
        // UI Playmat multi-select / AI chooseAiPick が渡す) を握り潰し先頭 1枚に collapse していた
        // (B04005「手札を2枚リムーブする」が全経路 1枚しか落ちない / handReveal ★未対応(3) の bind 1枚問題)。
        // allCardIds = pickedUids ?? [pickedUid] の解決済全件 → n:1 は [resolvedCardId] と byte 同一。
        : { ...pending.atomArgs, target: allCardIds, ...switchPart }; // 従来 pattern (handAddFromRemove 等)
    // W6 step6 (r79): Pattern B でも現場キャラ uid が選ばれた場合はタグ (scene 照合で char-kind 判別)
    if (hasInstanceIdsBind) newArgs.selectedInstanceIds = allUids;
    if (resolvedStackHostUid !== undefined) newArgs.hostUid = resolvedStackHostUid;
    resolvedAtom = { kind: 'atom', verb: pending.atomVerb as never, args: w6TagMr(newArgs, allUids) };
  }

  // ---- continuation (中断中 sequence/chain の残り step) を保存 ctx で実行 ----
  // BUG-111: continuation は pick 本体 (pending.continuation) に同梱されている (別 FIFO peek を廃止)。
  // これにより continuation を持たない pick が他 pick の continuation を誤消費する desync を排除。
  const chainCont = pending.continuation;
  if (chainCont) {
    // BUG-107: resolved atom と remainder を同一保存 ctx で runEffect → plain bindings を共有
    // (event.queue 経由は entry.bindings が Immer draft に取り込まれ bind が消えるため不可)。
    runEffect(state, resolvedAtom as never, chainCont.ctx);
    runAllUntilEmpty(state);
    // BUG-111 #2: multi-step remainder の wrap は origin kind で行う (sequence は chain-gate を持たない)。
    // BUG-111 family (nest): head → outer の順に frame 連鎖を実行 (再 pause は新 pick へ引継ぎ)。
    runContinuationChain(state, chainCont);
  } else {
    event.queue(
      state,
      resolvedAtom as never,
      // BUG-175: source.player は能力所有者 (chooser を渡すと相対 arg が二重反転 — B04058
      // 「相手は手札を1枚リムーブする」で self 手札を discard する誤り)。ownerPlayer 不在の
      // 旧 pending は player と同値 (chooser==owner) のため fallback で byte 等価。
      { player: pending.ownerPlayer ?? pending.player, cardId: pending.source.cardId },
      'effect:pick-resolved',
      { picked: pickedUid, source: pending.source },
    );
    runAllUntilEmpty(state);
  }
}

/** Resolve the dedicated discard-or-cancel response. Not discarding cancels the selected effect. */
export function applyChooseInterceptResponse(
  state: GameState,
  pending: PendingChooseInterceptSide,
  discardIndex: number | null,
): void {
  const resume = _takePendingChooseInterceptResume();
  if (!resume) return;
  const cards = state.players[pending.player].hand;
  if (Number.isInteger(discardIndex) && discardIndex! >= 0 && discardIndex! < cards.length) {
    hand.discardToRemove(state, pending.player, [cards[discardIndex!]!], { byPlayer: pending.player });
    return;
  }
  void resume;
}

/**
 * BUG-132 GAP-1 (2026-06-12): skipResolvesAtom 付き pending の decline (pickedUid=null) 解決。
 * 通常 skip (pending 破棄 = continuation も drop) と異なり、「0枚選択」を atom の解決として実行し、
 * 残り step (デッキ下移動等の必須 step) を continuation で続行する (rules/15 「〜まで」=0枚可、
 * B08020 公式Q&A「加えないことは可能」— 加えなければ全 reveal が「残り」としてデッキ下へ)。
 * atom 側は args.__declined===true を見て空解決 ($matched=[] 等) を bind する。
 */
export function applyPickSkipAndContinuation(
  state: GameState,
  pending: PendingEffectPickSide,
  runDeclinedAtom = true,
): void {
  if (pending.atomVerb === 'stackedCardPick' && pending.nMin > 0) {
    throw new Error('stackedCardPick: below-minimum selection');
  }
  const head = pending.continuation;
  // BUG-111 #2 (2026-06-16): runDeclinedAtom で declined head atom を再実行するか分岐する。
  //   - true (deckRevealUntil skipResolvesAtom): atom を __declined で再実行 (公開カードのデッキ下移動等、
  //     atom 側の必須 0枚解決を行う)。従来の唯一の挙動。
  //   - false (sequence-origin / chain-origin decline): declined 0-pick = 何もしない (rules/15) ため head atom を
  //     再実行せず remainder のみ実行する。単数 sceneEnter の __declined 未対応による pick 再 push を回避する。
  //     head の bind は unbound のままで、後続 conditional は boundMatchesFilter not-matched で正しく skip する。
  if (runDeclinedAtom) {
    const resolvedAtom: Effect = {
      kind: 'atom',
      verb: pending.atomVerb as never,
      args: { ...pending.atomArgs, __declined: true },
    };
    if (head) {
      // applyPickAndContinuation と同一の保存 ctx 共有 (BUG-107) — 空 bind が remainder から見える
      runEffect(state, resolvedAtom as never, head.ctx);
      runAllUntilEmpty(state);
    } else {
      event.queue(
        state,
        resolvedAtom as never,
        // BUG-175: decline 経路も同一座標系 (所有者) で再実行する
        { player: pending.ownerPlayer ?? pending.player, cardId: pending.source.cardId },
        'effect:pick-resolved',
        { picked: null, source: pending.source },
      );
      runAllUntilEmpty(state);
      return;
    }
    // deckRevealUntil: head.remainder (デッキ下移動等の必須 step) + outer を実行 (head から連鎖)。
    runContinuationChain(state, head);
    return;
  }
  // runDeclinedAtom === false: 「〜してもよい」decline。
  //   - sequence-origin head: head.remainder は独立 step (mandatory) → 実行 (rules/15) + outer。
  //   - chain-origin head: head.remainder は「そうした場合」gate → skip。BUG-111 family (nest) では
  //     outer (= 外側 sequence の remainder。例 B06033 sceneEnter) のみ実行する (rules/25 gate は内側のみ)。
  if (!head) return;
  if (head.kind === 'sequence') {
    runContinuationChain(state, head);
  } else {
    runContinuationChain(state, head.outer);
  }
}

/**
 * BUG-121: pending choice を choiceIndex で解決し、選択 option を再開する。
 * applyPickAndContinuation の choice 版。再開すべき effect は resolve-picks の engine holder
 * (__pendingEffectChoiceResume) から取り出す:
 *   - top-level choice (B06007): holder = choice 効果そのもの → unwrap で選択 option が返る。
 *   - sequence 内 choice: holder = {sequence:[choice, ...remainder]} → option + remainder のみ実行
 *     (pre-choice step は初回 runtime で実行済のため二重実行しない)。
 * choiceIndex 付きで resolveEffectPicks 再 walk → choice unwrap。選択 option 内に $pick
 * (例 B06007 option2 sceneToHand 短縮形) があれば humanChooser walk で __pendingEffectPickQueue に
 * 再 push され、既存 effectPickResolve 経路で連鎖消化される。
 */
export function applyChoiceAndContinuation(
  state: GameState,
  pending: PendingEffectChoiceSide,
  choiceIndex: number,
): void {
  const resumeEffect = _takePendingChoiceResume();
  if (!resumeEffect) return;
  // BUG-114: choice surface 時の bindings (cutin の $contact.* 等) を resume ctx へ復元。
  const resumeBindings = _takePendingChoiceBindings() ?? {};
  // 再 walk 用 ctx (triggered.ts の resolveCtx と同 shape の plain object、Immer draft 非由来)。
  // source.uid は option1 (charGrantKeyword uid:'$self') の $self 解決 + event.queue source に使用。
  const ctx: EffectCtx = {
    source: {
      cardId: pending.source.cardId,
      uid: pending.source.uid,
      abilityId: pending.source.abilityId,
      player: pending.player,
      area: 'scene',
    },
    bindings: resumeBindings as EffectCtx['bindings'],
    dyn: { choiceIndex },
  };
  const resolved = resolveEffectPicks(state, resumeEffect, ctx, {
    byPlayer: pending.player,
    humanChooser: true,
    source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId },
  });
  event.queue(
    state,
    resolved as never,
    { player: pending.player, uid: pending.source.uid, cardId: pending.source.cardId },
    'effect:choice-resolved',
    { choiceIndex, source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId } },
    // BUG-114: 復元した contact bindings を queue の bindings 引数 (6th) に渡し、entry → runtime ctx.bindings
    // へ伝達する (選択 option の $contact.byUid 等が runAllUntilEmpty 実行時に解決される)。
    resumeBindings as Record<string, unknown[]>,
  );
  runAllUntilEmpty(state);
}

/**
 * 2026-06-06 タスクC: pending optional を run(boolean) で解決し、optional 効果を再開する。
 * applyChoiceAndContinuation の boolean 版。再開すべき optional 効果は engine holder
 * (__pendingEffectOptionalResume) から取り出す。ctx.dyn.optionalRun=run を渡して再 walk すると
 * resolveEffectPicks の optional case が:
 *   - run=true  → 内部 effect を walk (内部の $pick は __pendingEffectPickQueue へ再 push)。
 *   - run=false → no-op (空 parallel) を返す。
 * を行い、結果を queue → runAllUntilEmpty で実行する。
 */
export function applyOptionalAndContinuation(
  state: GameState,
  pending: PendingEffectOptionalSide,
  run: boolean,
): void {
  const resumeEffect = _takePendingOptionalResume();
  if (!resumeEffect) return;
  // engine wave-18: surface 時の contact bindings を復元。ctx.bindings 自体は fresh {} のままにする —
  // resume walk は contact を必要とせず (optional 内 inContact pick / $contact.* は queue → runtime entryToCtx で
  // 解決)、resumeBindings を ctx.bindings に alias すると inner の bind 書込 ($entered 等) が下の queue 6th arg
  // (entry.bindings) を汚染し既存 optional (B09038 sceneEnter 等) を壊す。よって contact は 6th arg 経由でのみ伝達。
  const resumeBindings = _takePendingOptionalBindings();
  const hasResumeBindings = resumeBindings != null && Object.keys(resumeBindings).length > 0;
  // WC2b: surface 時に保持した costPaid を復元 (optional 内 $cost.* 参照用、B06023)。null は従来挙動。
  const resumeCostPaid = _takePendingOptionalCostPaid();
  const ctx: EffectCtx = {
    source: {
      cardId: pending.source.cardId,
      uid: pending.source.uid,
      abilityId: pending.source.abilityId,
      player: pending.ownerPlayer ?? pending.player,
      area: 'scene',
    },
    bindings: {},
    dyn: { optionalRun: run },
    // 2026-06-06 タスクC: optional 内の $trigger.<field> (B03038 の $trigger.gained 等) を解決可能に
    triggerPayload: (pending as { triggerPayload?: unknown }).triggerPayload,
    // WC2b: $cost.* (invokeHiramekiOfCard cardIds) は runtime (entryToCtx) 解決なので下の queue entryExtras
    // へも渡す。resume walk 自体の pre-walk でも参照できるよう ctx にも載せる。
    ...(resumeCostPaid ? { costPaid: resumeCostPaid } : {}),
  };
  const resolved = resolveEffectPicks(state, resumeEffect, ctx, {
    byPlayer: pending.ownerPlayer ?? pending.player,
    humanChooser: true,
    humanPlayer: pending.player,
    source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId },
  });
  // 2026-06-06 タスクC: payload に元 triggerPayload を載せて queue する (あれば)。これで runtime ctx
  // (entryToCtx) が triggerPayload を持ち、resumed effect 内の $trigger.<field> (B03038 evidenceToDeck の
  // $trigger.gained 等) が実行時に解決される。triggerPayload 無し (通常 optional) は従来の {run, source} marker。
  const optTriggerPayload = (pending as { triggerPayload?: unknown }).triggerPayload;
  event.queue(
    state,
    resolved as never,
    { player: pending.ownerPlayer ?? pending.player, uid: pending.source.uid, cardId: pending.source.cardId },
    'effect:optional-resolved',
    optTriggerPayload ?? { run, source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId } },
    // engine wave-18: 復元した contact bindings を queue 6th arg で entry → runtime ctx.contact へ伝達
    // (optional 内 $contact.* / inContact pick が runAllUntilEmpty 実行時に entryToCtx で解決される)。
    // 非空 (contact 有) のときのみ渡す — 空 optional (B09038 等) は従来通り bindings 省略 = 挙動不変。
    hasResumeBindings ? (resumeBindings as Record<string, unknown[]>) : undefined,
    // WC2b: costPaid を entry へ永続化 → runtime entryToCtx が復元し optional 内 $cost.* を解決 (B06023)。
    resumeCostPaid ? { costPaid: resumeCostPaid } : undefined,
  );
  runAllUntilEmpty(state);
}

/** AI 経路の pick 候補選択 (PA char pick は policy.chooseAtomTarget、それ以外 / fallback は先頭採用)。 */
type AtomTargetChooser = (
  state: GameState,
  verb: string,
  args: Readonly<Record<string, unknown>>,
  cands: ReadonlyArray<Candidate>,
  byPlayer: Player,
) => Candidate | null;

function chooseAiPick(
  state: GameState,
  pending: PendingEffectPickSide,
  policy?: { chooseAtomTarget?: AtomTargetChooser },
): { pickedUid: string | null; pickedUids?: string[] } {
  const cands = pending.candidates;
  if (cands.length === 0) return { pickedUid: null };
  // PA char pick 用に Candidate(kind:'char') を再構築して heuristic に渡す。
  // (非 char verb は chooseAtomTarget が null を返し先頭採用 fallback されるため安全。)
  const charCands: Candidate[] = cands.map(
    (c) => ({ kind: 'char', uid: c.uid, cardId: c.cardId, player: c.player }) as unknown as Candidate,
  );
  const chosen = policy?.chooseAtomTarget?.(state, pending.atomVerb, pending.atomArgs, charCands, pending.player);
  // W2b (P50/r27): mustBeSelectedByOppEvent の forced 集合 (pending.forcedUids、push 時算出) を honor。
  // 「必ず選ぶ」— 単一 pick は forced 先頭が heuristic を上書き、multi は forced を先頭合流して
  // nMax clamp (min(forced, nMax) 枚、公式Q&A)。forced 不在は従来 byte 等価。
  const forced = (pending.forcedUids ?? []).filter((u) => cands.some((c) => c.uid === u));
  // chosen は kind:'char' (uid あり) のみ渡しているため uid を持つが、Candidate union 上は narrow 不能 → cast。
  const pickedUid = forced[0] ?? (chosen as { uid?: string } | null | undefined)?.uid ?? cands[0]!.uid;
  if (pending.nMax > 1) {
    // cluster14: distinctNames (「それぞれカード名の異なる」B09010) 時は UI(CardListModal isDistinctNamesBlocked)
    //   と同義 incremental dedup — 既選択候補の name component(rules/19 split-name) と1つでも衝突したら skip。
    // forced は dedup walk / greedy の先頭に来るよう並べ替える (forced 0 件は元順 = byte 等価)。
    const orderedCands = forced.length > 0
      ? [...cands.filter((c) => forced.includes(c.uid)), ...cands.filter((c) => !forced.includes(c.uid))]
      : cands;
    // engine mega-wave W4 (2026-07-03, r84): perSideMax (「自分と相手で1枚ずつ」B08019 a2) — distinctNames
    // と同型の greedy walk (side 別 counter)。両 flag 併用時は perSideMax gate → name-dedup の順で複合。
    if (pending.distinctNames === true || pending.distinctLevel === true || pending.distinctColors === true || typeof pending.perSideMax === 'number' || typeof pending.aggregateLevelMax === 'number') {
      const seen = new Set<string>();
      const seenLv = new Set<number>(); // Cluster WB1 (2026-07-11, B09105): distinctLevel greedy dedup
      const seenColors = new Set<string>();
      const bySide: Record<string, number> = {};
      let totalLevel = 0;
      const chosen: string[] = [];
      for (const c of orderedCands) {
        if (chosen.length >= pending.nMax) break;
        if (typeof pending.perSideMax === 'number') {
          const side = (c as { player?: string }).player ?? '?';
          if ((bySide[side] ?? 0) >= pending.perSideMax) continue;
        }
        if (pending.distinctNames === true) {
          const d = def.card(c.cardId);
          const comps = d ? allCardNameComponentsForDef(d) : [c.cardId];
          if (comps.some((x) => seen.has(x))) continue;
          comps.forEach((x) => seen.add(x));
        }
        // Cluster WB1: distinctLevel — 既選択と同レベルは skip (「それぞれレベルの異なる」B09105)。
        if (pending.distinctLevel === true) {
          const lv = def.card(c.cardId)?.level;
          if (typeof lv === 'number') {
            if (seenLv.has(lv)) continue;
            seenLv.add(lv);
          }
        }
        const level = def.card(c.cardId)?.level ?? 0;
        if (typeof pending.aggregateLevelMax === 'number' && totalLevel + level > pending.aggregateLevelMax) continue;
        if (pending.distinctColors === true) {
          const colors = def.card(c.cardId)?.colors ?? [];
          if (colors.some(color => seenColors.has(color))) continue;
          colors.forEach(color => seenColors.add(color));
        }
        if (typeof pending.perSideMax === 'number') {
          const side = (c as { player?: string }).player ?? '?';
          bySide[side] = (bySide[side] ?? 0) + 1;
        }
        totalLevel += level;
        chosen.push(c.uid);
      }
      return { pickedUid: chosen[0] ?? pickedUid, pickedUids: chosen };
    }
    // multi-pick: greedy に nMax まで取る (取れるだけ取る heuristic、resolve-picks の cardIds 経路と整合)
    return { pickedUid, pickedUids: orderedCands.slice(0, pending.nMax).map((c) => c.uid) };
  }
  return { pickedUid };
}

/**
 * AI/CPU 経路で __pendingEffectPickQueue を順次 drain する。PA 短縮形 atom 等が runtime に
 * tryRePickFromAtom で積んだ pick を heuristic 解決し、continuation も進める (BUG-109)。
 * policy.playTurn が applyMove + runAllUntilEmpty 後に呼ぶ (human modal を持たない側の補完)。
 */
export function drainAiEffectPicks(
  state: GameState,
  policy?: { chooseAtomTarget?: AtomTargetChooser },
): void {
  const g = globalThis as {
    __pendingEffectPickQueue?: PendingEffectPickSide[];
    __humanPlayerSide?: 'self' | 'opp' | null;
  };
  // BUG-138 (wave#2 cluster2 X8): human 所有の pending は AI が横取り解決しない (rules/15
  // 未解決効果は所有者が解決)。__humanPlayerSide (BUG-132 導入の human 検出 side-channel) が
  // set のときのみ skip — smoke / spectator は null のため従来挙動 byte-equal。
  // skip した human pending は queue に温存され、playTurn の humanPick pause →
  // useOppTurnDriver.surfacePendingSideChannels が UI modal へ転送する。
  const humanSide = g.__humanPlayerSide ?? null;
  let guard = 0;
  let i = 0;
  while (i < (g.__pendingEffectPickQueue?.length ?? 0)) {
    if (++guard > 64) break; // 安全弁 (1 ターンの pick 数が 64 を超えることは無い)
    const q = g.__pendingEffectPickQueue!;
    const pending = q[i]!;
    if (humanSide !== null && pending.player === humanSide) {
      i++; // human 所有 → 温存 (同一所有者内の FIFO 順は維持される)
      continue;
    }
    q.splice(i, 1); // 解決対象を queue から取り出す (humanSide null なら i=0 のままで従来 shift と同一)
    const { pickedUid, pickedUids } = chooseAiPick(state, pending, policy);
    if (pickedUid === null) {
      // cluster14: skipResolvesAtom 付き pending (0枚=「〜まで」で必須 continuation あり、B09010 の
      //   FILE上1リムーブ等) は、human path (useEngineDispatch skipResolvesAtom 分岐) と対称に
      //   applyPickSkipAndContinuation で remainder を実行する (rules/15 「〜まで」=0枚可 + 公式Q&A)。
      if (pending.skipResolvesAtom === true) {
        applyPickSkipAndContinuation(state, pending);
        continue;
      }
      // BUG-111 #2 / family (nest): continuation があれば head の kind で gate しつつ実行する。
      //   sequence-origin → head.remainder (mandatory) + outer / chain-origin → outer のみ (「そうした場合」gate)。
      //   chain-origin で outer 無し (standalone chain) は no-op = 従来の drop と同一。
      //   AI は通常 greedy で decline しない (chooseAiPick は候補空のときのみ null) ため本枝は主に防御的。
      if (pending.continuation) {
        applyPickSkipAndContinuation(state, pending, false);
        continue;
      }
      // 候補 0 + continuation 無し → 純粋 skip。
      continue;
    }
    applyPickAndContinuation(state, pending, pickedUid, pickedUids);
  }
}

/**
 * テスト/ツール用: 所有権 (__humanPlayerSide) を無視して全 pending を drain する。
 * human modal の代行 (UI を介さず heuristic で確定) を行うテストハーネス専用 —
 * production コードからは呼ばないこと (BUG-138: 横取りの再導入になる)。
 */
export function _drainAllEffectPicksForTest(
  state: GameState,
  policy?: { chooseAtomTarget?: AtomTargetChooser },
): void {
  const g = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };
  const saved = g.__humanPlayerSide ?? null;
  g.__humanPlayerSide = null;
  try {
    drainAiEffectPicks(state, policy);
  } finally {
    g.__humanPlayerSide = saved;
  }
}

/**
 * BUG-138 (X8): human 所有の未解決 decision (pick queue / optional / choice 各 side-channel) が
 * engine 側に残っているか。playTurn が move 選択前に確認し、残っていれば
 * paused:{humanPick:true} で停止する (rules/05 効果解決中は次の行動に移れない /
 * rules/15 未解決効果は所有者が解決)。__humanPlayerSide 未設定 (null) なら常に false
 * — smoke / spectator は従来挙動 byte-equal。
 */
export function hasPendingHumanPick(): boolean {
  const g = globalThis as {
    __pendingEffectPickQueue?: PendingEffectPickSide[];
    __pendingEffectOptionalSide?: { player: 'self' | 'opp' } | null;
    __pendingEffectRepeatOptionalSide?: { player: 'self' | 'opp' } | null;
    __pendingEffectChoiceSide?: { player: 'self' | 'opp' } | null;
    __humanPlayerSide?: 'self' | 'opp' | null;
  };
  const humanSide = g.__humanPlayerSide ?? null;
  if (humanSide === null) return false;
  if ((g.__pendingEffectPickQueue ?? []).some(p => p.player === humanSide)) return true;
  if (g.__pendingEffectOptionalSide?.player === humanSide) return true;
  if (g.__pendingEffectRepeatOptionalSide?.player === humanSide) return true;
  if (g.__pendingEffectChoiceSide?.player === humanSide) return true;
  return false;
}
