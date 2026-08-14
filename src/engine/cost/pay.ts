// engine.cost.pay — Cost payment (mutates draft)
// spec: Phase 3 Group B Task 3.5
// rules: 21-declared-ability-cost.md, 25-qa-effects-resolution.md (viaCost flag)
//
// IMPORTANT:
//   - Caller MUST invoke pay() inside a produce() block; the function mutates the draft.
//   - During payment we set ctx.viaCost = true. Downstream emit logic can read this
//     to suppress "by own ability" hooks (rules/25). TODO Phase 3.10: wire viaCost
//     into event.emit so triggered abilities do not fire from cost-payment mutations.
//   - canPay() should be called first; pay() throws if a step cannot be paid.

import type { GameState, Cost, EffectCtx, PayResult, Candidate, TargetingRef } from '@/engine/types';
import { candidates } from '@/engine/target/candidates.js';
import { mutate } from '@/engine/mutate/index.js';
import { canPay } from './evaluate.js';
import { resolveDynNumber } from '@/engine/dyn/eval.js';
// attribution mini-wave (2026-07-10): costPaid 導出値 (level/kind) の印字値参照。dyn/eval.ts と同一 import 元。
import { def as readDef } from '@/engine/read/def.js';
import { readRemoveSetCardWitness } from './remove-set-card-witness.js';
import { eligibleRemoveSetCards } from './remove-set-card-eligible.js';
import { char as readChar } from '@/engine/read/char.js';
import { _clearPendingSetCardReplacementSide, _peekPendingSetCardReplacementGuard, _peekPendingSetCardReplacementSide, _restorePendingSetCardReplacementSide } from '@/engine/effect/pending-state.js';
import { _abortEventJournal, _beginEventJournal, _commitEventJournal, _withEventsSuppressed } from '@/engine/event/registry.js';
import { produce } from '@/engine/produce.js';
import { cardOccurrenceWitness } from '@/engine/target/card-occurrence.js';
import { advanceIndexedZoneEpoch } from '@/engine/state/indexed-zone-epoch.js';

/**
 * Pay a Cost. Mutates the draft in place.
 * Sets ctx.viaCost = true while executing. Restores prior value when done.
 */
export function pay(state: GameState, cost: Cost, ctx: EffectCtx): PayResult {
  if (cost.kind === 'custom') throw new Error('cost.pay: custom costs are unsupported');
  if (!hasExactCostChoicePath(cost, ctx)) {
    throw new Error('cost.pay: invalid cost choice path');
  }
  if (cost.kind === 'pay' && !canPayAtomically(state, cost, ctx)) {
    throw new Error('cost.pay: cost is not fully payable');
  }
  const prevViaCost = ctx.viaCost;
  const stateBefore = cloneForAuthorization(state);
  const ctxBefore = cloneForAuthorization(ctx);
  const replacementBefore = _peekPendingSetCardReplacementSide();
  const replacementGuardBefore = _peekPendingSetCardReplacementGuard();
  let journal: ReturnType<typeof _beginEventJournal> | null = null;
  ctx.viaCost = true;

  try {
    // The pure simulator intentionally does not run replacement/defer hooks.
    // Execute real mutators on a detached clone first, then commit once.
    const preparedState = cloneForAuthorization(state);
    const preparedCtx = cloneForAuthorization(ctx);
    preparedCtx.viaCost = true;
    try {
      produce(preparedState, (draft) => {
        _withEventsSuppressed(() => payInner(draft, cost, preparedCtx, { paidItems: [], releasedTriggers: [] }));
      });
    } finally {
      _restorePendingSetCardReplacementSide(replacementBefore, replacementGuardBefore);
    }
    journal = _beginEventJournal();
    const result: PayResult = { paidItems: [], releasedTriggers: [] };
    payInner(state, cost, ctx, result);
    _commitEventJournal(journal);
    journal = null;
    return result;
  } catch (error) {
    if (journal !== null) _abortEventJournal(journal);
    restoreMutable(state, stateBefore);
    restoreMutable(ctx, ctxBefore);
    _restorePendingSetCardReplacementSide(replacementBefore, replacementGuardBefore);
    throw error;
  } finally {
    ctx.viaCost = prevViaCost;
  }
}

function restoreMutable<T extends object>(target: T, snapshot: T): void {
  const mutable = target as Record<string, unknown>;
  for (const key of Object.keys(mutable)) delete mutable[key];
  Object.assign(mutable, cloneForAuthorization(snapshot) as Record<string, unknown>);
}

function sourceOccurrenceIndex(ctx: EffectCtx): number | null {
  const area = ctx.source.area;
  if (area !== 'evidence' && area !== 'file') return null;
  const match = new RegExp(`^${area}:${ctx.source.player}:(\\d+)$`).exec(ctx.source.uid ?? '');
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function addToRemove(state: GameState, player: 'self' | 'opp', ids: readonly string[]): void {
  if (ids.length === 0) return;
  state.players[player].remove.push(...ids);
  advanceIndexedZoneEpoch(state, player, 'remove');
}

/**
 * Sequential, side-effect-free authorization for composite costs.
 *
 * Do not call mutators here. Several mutators emit hooks, allocate event IDs,
 * and touch pending-choice module state; cloning GameState alone cannot undo
 * those effects. This simulator changes only a private JSON copy.
 */
export function canPayAtomically(state: GameState, cost: Cost, ctx: EffectCtx): boolean {
  if (!hasExactCostChoicePath(cost, ctx)) return false;
  return canPayAtomicallyAtChoiceCursor(state, cost, ctx, 0);
}

/** Replacement-aware, listener-free authorization for public payment gates. */
export function canPayWithPreflight(state: GameState, cost: Cost, ctx: EffectCtx): boolean {
  if (!canPayAtomically(state, cost, ctx)) return false;
  const replacementBefore = _peekPendingSetCardReplacementSide();
  const replacementGuardBefore = _peekPendingSetCardReplacementGuard();
  try {
    const preparedState = cloneForAuthorization(state);
    const preparedCtx = cloneForAuthorization(ctx);
    produce(preparedState, (draft) => {
      _withEventsSuppressed(() => payInner(draft, cost, preparedCtx, { paidItems: [], releasedTriggers: [] }));
    });
    return true;
  } catch {
    return false;
  } finally {
    _restorePendingSetCardReplacementSide(replacementBefore, replacementGuardBefore);
  }
}

function canPayAtomicallyAtChoiceCursor(state: GameState, cost: Cost, ctx: EffectCtx, choiceCursor: number): boolean {
  try {
    // Preserve own `undefined` values and sparse arrays. JSON cloning erases
    // them; structuredClone cannot clone an Immer draft Proxy.
    const dryState = cloneForAuthorization(state);
    const dryCtx = cloneForAuthorization(ctx);
    return simulateCostPayment(dryState, cost, dryCtx, { value: choiceCursor });
  } catch {
    return false;
  }
}

function simulateCostPayment(state: GameState, cost: Cost, ctx: EffectCtx, choiceCursor = { value: 0 }): boolean {
  // Authorization must never execute repository-defined closures. Both
  // `check` and `pay` may mutate module/global state outside the GameState
  // clone, so custom costs are deliberately unsupported and fail closed.
  if (cost.kind === 'custom') return false;
  if (!isWellFormedCost(cost)) return false;
  if (cost.kind === 'pay') return cost.items.every(item => simulateCostPayment(state, item, ctx, choiceCursor));
  if (cost.kind === 'choice') {
    const selected = readChosenIndex(ctx, choiceCursor.value++);
    if (selected !== undefined) return !!cost.items[selected] && simulateCostPayment(state, cost.items[selected]!, ctx, choiceCursor);
    for (const item of cost.items) {
      const branchState = cloneForAuthorization(state);
      const branchCtx = cloneForAuthorization(ctx);
      const branchCursor = { value: choiceCursor.value };
      if (!simulateCostPayment(branchState, item, branchCtx, branchCursor)) continue;
      Object.assign(state, branchState);
      Object.assign(ctx, branchCtx);
      choiceCursor.value = branchCursor.value;
      return true;
    }
    return false;
  }
  if (!canPay(state, cost, ctx)) return false;

  const p = ctx.source.player;
  const selected = (ref: TargetingRef, n: number): Candidate[] => selectCostCandidates(state, ref, ctx, n);
  const removeHand = (ids: string[], toRemove = false) => {
    for (const id of ids) {
      const index = state.players[p].hand.indexOf(id);
      if (index >= 0) {
        state.players[p].hand.splice(index, 1);
        if (toRemove) addToRemove(state, p, [id]);
      }
    }
  };
  const detachScene = (uid: string, cascade = true) => {
    for (const side of ['self', 'opp'] as const) {
      const index = state.players[side].scene.findIndex(char => char.uid === uid);
      if (index < 0) continue;
      const [char] = state.players[side].scene.splice(index, 1);
      if (!char) return undefined;
      if (cascade) {
        addToRemove(state, side, char.setCards.map(entry => entry.cardId));
        addToRemove(state, side, (Array.isArray(char.stackedCards)
          ? char.stackedCards.map(entry => entry.cardId)
          : Array.from({ length: char.stackedCards }, () => 'back-card')));
        char.setCards = [];
        char.stackedCards = [];
      }
      return { char, player: side };
    }
    return undefined;
  };

  switch (cost.kind) {
    case 'sleepSelf':
      findChar(state, ctx.source.uid!)!.state = 'sleep'; return true;
    case 'sleepChar':
    case 'stunChar': {
      const min = cost.target.kind === 'pick' ? cost.target.n.min : 1;
      const eligible = selectActiveCharRangeCostCandidates(state, cost.target, ctx, cost.kind);
      if (eligible.length < min) return false;
      for (const candidate of eligible) {
        findChar(state, candidate.uid)!.state = cost.kind === 'sleepChar' ? 'sleep' : 'stun';
      }
      return true;
    }
    case 'removeFromHand': {
      const ids = selectRemoveFromHandCandidates(state, cost, ctx).map(c => c.cardId);
      if (ids.length !== cost.n) return false;
      removeHand(ids, true);
      recordCostPaid(ctx, 'removeFromHand', { ids, level: readDef.card(ids[0])?.level });
      return true;
    }
    case 'revealFromHand': {
      const max = typeof cost.n === 'number' ? cost.n : cost.n.max;
      const ids = selectRangeCostCandidates(state, cost.target, ctx).filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card').map(c => c.cardId);
      const min = typeof cost.n === 'number' ? cost.n : cost.n.min;
      if (ids.length < min || ids.length > max) return false;
      recordCostPaid(ctx, 'revealFromHand', { ids, count: ids.length, cardName: readDef.card(ids[0])?.names?.[0] });
      return true;
    }
    case 'revealHandToDeckTop': {
      const ids = selected(cost.target, cost.n).filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card').map(c => c.cardId);
      if (ids.length !== cost.n) return false;
      removeHand(ids); state.players[p].deck.unshift(...ids); return true;
    }
    case 'removeFromScene': {
      const uids = selected(cost.target, cost.n).filter((c): c is Candidate & { kind: 'char' } => c.kind === 'char').map(c => c.uid);
      if (uids.length !== cost.n || new Set(uids).size !== cost.n) return false;
      for (const uid of uids) {
        const found = detachScene(uid); if (!found) return false;
        if (found.player === p && readDef.isMR(found.char.cardId) && state.turn.player !== p) {
          state.players[p].partnerAreaMR = { ...found.char, uid: `partnerMR:${p}`, isNamed: false, setCards: [], stackedCards: [] };
        } else {
          addToRemove(state, found.player, [found.char.cardId]);
        }
      }
      return true;
    }
    case 'sceneStackUnderSelf': {
      const host = findChar(state, ctx.source.uid ?? '');
      const targets = selected(cost.target, cost.n).filter((c): c is Candidate & { kind: 'char' } => c.kind === 'char');
      if (!host || targets.length !== cost.n || new Set(targets.map(target => target.uid)).size !== cost.n || targets.some(target => target.uid === host.uid)) return false;
      const stacked = Array.isArray(host.stackedCards) ? host.stackedCards : [];
      for (const target of targets) {
        const found = detachScene(target.uid); if (!found) return false;
        stacked.push({ cardId: found.char.cardId, instanceId: `auth:${found.char.uid}` });
      }
      host.stackedCards = stacked; return true;
    }
    case 'handStackUnder': {
      const card = selected(cost.cardTarget, 1).find((c): c is Candidate & { kind: 'card' } => c.kind === 'card');
      const hostCandidate = selected(cost.hostTarget, 1).find((c): c is Candidate & { kind: 'char' } => c.kind === 'char');
      const host = hostCandidate && findChar(state, hostCandidate.uid);
      if (!card || !host) return false;
      removeHand([card.cardId]);
      const stacked = Array.isArray(host.stackedCards) ? host.stackedCards : [];
      stacked.push({ cardId: 'back-card', instanceId: `auth:hand:${card.cardId}` }); host.stackedCards = stacked; return true;
    }
    case 'removeDeckTop': {
      const removed = state.players[cost.player].deck.splice(0, resolveDynNumber(cost.n, state, ctx));
      addToRemove(state, cost.player, removed);
      const prior = (ctx.costPaid?.['removeDeckTop'] as { ids?: string[] } | undefined)?.ids ?? [];
      recordCostPaid(ctx, 'removeDeckTop', { ids: [...prior, ...removed] });
      if (removed.length > 0) simulateRefreshAfterTake(state, cost.player);
      return true;
    }
    case 'removeDeckAll': {
      const removed = state.players[cost.player].deck.splice(0);
      addToRemove(state, cost.player, removed);
      simulateRefreshAfterTake(state, cost.player);
      return true;
    }
    case 'discardEvidence': {
      for (let i = 0; i < cost.n; i++) {
        const evidence = state.players[p].evidence.pop(); if (!evidence) return false;
        advanceIndexedZoneEpoch(state, p, 'evidence');
        addToRemove(state, p, [evidence.cardId]);
      }
      return true;
    }
    case 'selfToDeckBottom': {
      const found = detachScene(ctx.source.uid!, true); if (!found) return false;
      if (readDef.isMR(found.char.cardId) && state.turn.player !== found.player) {
        state.players[found.player].partnerAreaMR = { ...found.char, uid: `partnerMR:${found.player}`, isNamed: false, setCards: [], stackedCards: [] };
      } else state.players[found.player].deck.push(found.char.cardId);
      return true;
    }
    case 'selfToRemove': {
      if (ctx.source.area === 'scene') {
        const source = state.players[p].scene.find(char => char.uid === ctx.source.uid);
        if (!source || source.cardId !== ctx.source.cardId) return false;
        state.players[p].scene.splice(state.players[p].scene.indexOf(source), 1);
        addToRemove(state, p, [source.cardId]);
        return true;
      }
      const index = sourceOccurrenceIndex(ctx);
      if (index === null) return false;
      if (ctx.source.area === 'evidence') {
        const entry = state.players[p].evidence[index];
        if (!entry || !entry.faceUp || entry.cardId !== ctx.source.cardId) return false;
        state.players[p].evidence.splice(index, 1);
        advanceIndexedZoneEpoch(state, p, 'evidence');
        addToRemove(state, p, [entry.cardId]);
        return true;
      }
      if (ctx.source.area === 'file') {
        const entry = state.players[p].file[index];
        if (!entry || entry.type !== 'card-back' || entry.faceUp !== true || entry.cardId !== ctx.source.cardId) return false;
        state.players[p].file.splice(index, 1);
        addToRemove(state, p, [entry.cardId]);
        return true;
      }
      return false;
    }
    case 'selfToPartnerArea': {
      if (ctx.source.area !== 'scene' || !ctx.source.uid) return false;
      const source = state.players[p].scene.find(char => char.uid === ctx.source.uid);
      if (!source || source.cardId !== ctx.source.cardId || !readDef.isMR(source.cardId) || state.players[p].partnerAreaMR) return false;
      state.players[p].scene.splice(state.players[p].scene.indexOf(source), 1);
      addToRemove(state, p, source.setCards.map(entry => entry.cardId));
      addToRemove(state, p, (Array.isArray(source.stackedCards)
        ? source.stackedCards.map(entry => entry.cardId)
        : Array.from({ length: source.stackedCards }, () => 'back-card')));
      source.setCards = [];
      source.stackedCards = 0;
      source.isNamed = false;
      state.players[p].partnerAreaMR = source;
      return true;
    }
    case 'removeSetCard': {
      const witness = readRemoveSetCardWitness(ctx);
      if (witness.kind === 'invalid') return false;
      mutate.char.ensureSetCardInstanceIds(state);
      const eligible = eligibleRemoveSetCards(state, cost, ctx);
      const picks: typeof eligible = [];
      if (witness.kind === 'valid') {
        if (witness.hostUids.length !== cost.n
          || (witness.instanceIds !== undefined
            && (witness.instanceIds.length !== cost.n || new Set(witness.instanceIds).size !== cost.n))) return false;
        const seen = new Set<string>();
        for (let index = 0; index < cost.n; index++) {
          const hostUid = witness.hostUids[index]!;
          const instanceId = witness.instanceIds?.[index];
          const found = eligible.find((candidate) => candidate.host.uid === hostUid
            && (instanceId === undefined || candidate.entry.instanceId === instanceId)
            && candidate.entry.instanceId !== undefined
            && !seen.has(candidate.entry.instanceId));
          if (!found || !found.entry.instanceId) return false;
          seen.add(found.entry.instanceId);
          picks.push(found);
        }
      } else {
        picks.push(...eligible.slice(0, cost.n));
      }
      if (picks.length !== cost.n) return false;
      const removedIds: string[] = [];
      const removeOne = (host: GameState['players']['self']['scene'][number], instanceId: string | undefined): boolean => {
        const index = host.setCards.findIndex(entry => entry.instanceId === instanceId);
        if (index < 0) return false;
        const [removed] = host.setCards.splice(index, 1);
        if (!removed) return false;
        addToRemove(state, p, [removed.cardId]);
        removedIds.push(removed.cardId);
        return true;
      };
      for (const pick of picks) {
        const host = state.players[p].scene.find(char => char.uid === pick.host.uid);
        if (!host || !removeOne(host, pick.entry.instanceId)) return false;
      }
      recordCostPaid(ctx, 'removeSetCard', { ids: removedIds, kinds: removedIds.map(id => readDef.card(id)?.kind) });
      return true;
    }
    case 'removeStackedCards': {
      const host = state.players[p].scene.find(char => char.uid === ctx.source.uid);
      if (!host) return false;
      const stacked = Array.isArray(host.stackedCards)
        ? host.stackedCards
        : Array.from({ length: host.stackedCards }, (_, index) => ({ cardId: 'back-card', instanceId: `legacy:${host.uid}:${index}` }));
      if (stacked.length < cost.n) return false;
      if (!Array.isArray(host.stackedCards)) host.stackedCards = stacked;
      const explicit = readRemoveStackedCardInstanceIds(ctx);
      if (hasCostParam(ctx, 'removeStackedCards') && (!explicit || explicit.length !== cost.n || new Set(explicit).size !== explicit.length)) return false;
      const entries = explicit ? explicit.map(id => stacked.find(entry => entry.instanceId === id)).filter(Boolean) : stacked.slice(0, cost.n);
      if (entries.length !== cost.n) return false;
      const removeStart = state.players[p].remove.length;
      for (const entry of entries) {
        stacked.splice(stacked.indexOf(entry!), 1);
        addToRemove(state, p, [entry!.cardId]);
      }
      recordCostPaid(ctx, 'removeStackedCards', { entries: entries.map((entry, offset) => ({
        cardId: entry!.cardId, instanceId: entry!.instanceId, removeIndex: removeStart + offset,
      })) });
      return true;
    }
    case 'flipFaceUpEvidence': {
      const indices = hasCostParam(ctx, 'flipFaceUpEvidence') ? readFlipIndices(ctx)
        : state.players[p].evidence.map((entry, index) => ({ entry, index })).filter(x => !x.entry.faceUp).slice(0, cost.n.min).map(x => x.index);
      if (indices.length < cost.n.min || indices.length > cost.n.max) return false;
      for (const index of indices) {
        const entry = state.players[p].evidence[index];
        if (!entry || entry.faceUp) return false;
        entry.faceUp = true;
        advanceIndexedZoneEpoch(state, p, 'evidence');
      }
      const ids = indices.map(index => state.players[p].evidence[index]!.cardId);
      recordCostPaid(ctx, 'flipFaceUpEvidence', { count: indices.length, ids });
      const occurrenceWitness = cardOccurrenceWitness(state, p, 'evidence');
      ctx.bindings['$costFlipped'] = indices.map(index => ({ kind: 'card', cardId: state.players[p].evidence[index]!.cardId, area: 'evidence', player: p, index, occurrenceWitness }));
      return true;
    }
    case 'removeFromHandDownTo': {
      const ids = state.players[p].hand.splice(0, Math.max(0, state.players[p].hand.length - cost.n));
      addToRemove(state, p, ids);
      recordCostPaid(ctx, 'removeFromHandDownTo', { ids, levelSum: ids.reduce((sum, id) => sum + (readDef.card(id)?.level ?? 0), 0) });
      return true;
    }
    case 'sceneToDeckBottom': {
      const explicit = readSceneToDeckUids(ctx);
      const uids = hasCostParam(ctx, 'sceneToDeckBottom') ? explicit
        : selected(cost.target, cost.n).filter((c): c is Candidate & { kind: 'char' } => c.kind === 'char').map(c => c.uid);
      const allowed = new Set(candidates(state, cost.target, ctx).filter((c): c is Candidate & { kind: 'char' } => c.kind === 'char').map(c => c.uid));
      if (uids.length !== cost.n || new Set(uids).size !== uids.length || uids.some(uid => !allowed.has(uid))) return false;
      const ids: string[] = [];
      for (const uid of uids) { const found = detachScene(uid); if (!found || found.player !== p) return false; state.players[p].deck.push(found.char.cardId); ids.push(found.char.cardId); }
      recordCostPaid(ctx, 'sceneToDeckBottom', { ids, level: readDef.card(ids[0])?.level });
      return true;
    }
    case 'removeAreaToDeckBottom': {
      const explicit = readRemoveAreaToDeckIds(ctx);
      const ids = hasCostParam(ctx, 'removeAreaToDeckBottom') ? explicit
        : selected(cost.target, cost.n).filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card').map(c => c.cardId);
      const allowed = candidates(state, cost.target, ctx).filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card').map(c => c.cardId);
      if (ids.length !== cost.n || !isMultisetSubset(ids, allowed)) return false;
      for (const id of ids) { const index = state.players[p].remove.indexOf(id); if (index < 0) return false; state.players[p].remove.splice(index, 1); advanceIndexedZoneEpoch(state, p, 'remove'); }
      state.players[p].deck.push(...ids); return true;
    }
    case 'partnerAreaRemove': {
      const explicit = readPartnerAreaRemoveIds(ctx);
      const ids = hasCostParam(ctx, 'partnerAreaRemove') ? explicit
        : candidates(state, cost.target, ctx).filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card').slice(0, cost.n).map(c => c.cardId);
      const allowed = candidates(state, cost.target, ctx).filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card').map(c => c.cardId);
      if (ids.length !== cost.n || !isMultisetSubset(ids, allowed)) return false;
      const area = state.players[p].partnerAreaCards ?? [];
      for (const id of ids) { const index = area.indexOf(id); if (index < 0) return false; area.splice(index, 1); addToRemove(state, p, [id]); }
      return true;
    }
    case 'fileFrom': {
      let paid = 0;
      while (paid < cost.n) { const index = state.players[p].file.findIndex(entry => entry.type !== 'assisted-partner'); if (index < 0) return false; const [entry] = state.players[p].file.splice(index, 1); if (entry?.cardId) addToRemove(state, p, [entry.cardId]); paid++; }
      return true;
    }
    case 'selfLpDeltaTurn': {
      const char = findChar(state, ctx.source.uid ?? ''); if (!char) return false;
      char.turnEffects['lpMod_turn'] = ((char.turnEffects['lpMod_turn'] as number | undefined) ?? 0) + cost.delta;
      return true;
    }
  }
  const _exhaustive: never = cost;
  void _exhaustive;
  return false;
}

function cloneForAuthorization<T>(value: T): T {
  if (Array.isArray(value)) {
    const clone = new Array(value.length);
    for (let index = 0; index < value.length; index++) {
      if (Object.prototype.hasOwnProperty.call(value, index)) clone[index] = cloneForAuthorization(value[index]);
    }
    return clone as T;
  }
  if (value !== null && typeof value === 'object') {
    const clone: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      clone[key] = cloneForAuthorization((value as Record<string, unknown>)[key]);
    }
    return clone as T;
  }
  return value;
}

function findChar(state: GameState, uid: string): GameState['players']['self']['scene'][number] | undefined {
  return state.players.self.scene.find(char => char.uid === uid)
    ?? state.players.opp.scene.find(char => char.uid === uid);
}

function recordCostPaid(ctx: EffectCtx, key: string, value: unknown): void {
  ctx.costPaid ??= {};
  ctx.costPaid[key] = value;
}

function simulateRefreshAfterTake(state: GameState, player: 'self' | 'opp'): void {
  if (state.players[player].deck.length > 0 || state.gameResult !== undefined) return;
  if (state.players[player].remove.length === 0) {
    mutate.gameResult.set(state, player === 'self' ? 'opp' : 'self', 'deck-out');
    return;
  }
  state.players[player].deck.push(...state.players[player].remove);
  state.players[player].remove = [];
  advanceIndexedZoneEpoch(state, player, 'remove');
  state.refreshCount[player] = (state.refreshCount[player] ?? 0) + 1;
  const opponent = player === 'self' ? 'opp' : 'self';
  if (!readChar.restrictsOpponent(state, player, 'refreshEvidence')) {
    state.players[opponent].evidence.push({
      cardId: 'penalty-card', faceUp: false,
      origin: { turn: state.turn.number, via: 'refresh-penalty' },
    });
    advanceIndexedZoneEpoch(state, opponent, 'evidence');
  }
  state.scratchTrace[opponent] = '発見済';
}

export function isWellFormedCost(cost: Cost): boolean {
  const whole = (n: number, min = 0) => Number.isInteger(n) && n >= min;
  const upper = (n: number) => n === Infinity || whole(n);
  const selfTarget = (target: TargetingRef, allowedAreas: readonly string[], allowSelf = false, exactN?: number | { min: number; max: number }): boolean => {
    if (target.kind === 'self') return allowSelf;
    if (target.kind === 'fromBound') return false;
    if (target.query.side !== 'self') return false;
    const areas = target.query.area === undefined ? [] : Array.isArray(target.query.area) ? target.query.area : [target.query.area];
    if (areas.length === 0 || areas.some(area => !allowedAreas.includes(area))) return false;
    if (target.kind !== 'pick') return exactN === undefined;
    if (!(whole(target.n.min) && upper(target.n.max) && target.n.min <= target.n.max)) return false;
    if (exactN === undefined) return true;
    const expected = typeof exactN === 'number' ? { min: exactN, max: exactN } : exactN;
    return target.n.min === expected.min && target.n.max === expected.max;
  };
  switch (cost.kind) {
    case 'custom': return false;
    case 'pay': return cost.items.every(isWellFormedCost);
    case 'choice': return cost.items.length > 0 && cost.items.every(isWellFormedCost);
    case 'sleepChar':
    case 'stunChar': return selfTarget(cost.target, ['scene'], true)
      && (cost.target.kind !== 'pick' || cost.target.n.min >= 1);
    case 'removeFromHand':
    case 'revealHandToDeckTop': return whole(cost.n) && selfTarget(cost.target, ['hand'], false, cost.n);
    case 'removeFromScene':
    case 'sceneStackUnderSelf':
    case 'sceneToDeckBottom': return whole(cost.n) && selfTarget(cost.target, ['scene'], true, cost.n);
    case 'removeAreaToDeckBottom': return whole(cost.n) && selfTarget(cost.target, ['remove'], false, cost.n);
    case 'partnerAreaRemove': return whole(cost.n) && selfTarget(cost.target, ['partner-area'], false, cost.n);
    case 'revealFromHand': {
      const range = typeof cost.n === 'number' ? { min: cost.n, max: cost.n } : cost.n;
      return whole(range.min) && upper(range.max) && range.min <= range.max
        && selfTarget(cost.target, ['hand'], false, range);
    }
    case 'handStackUnder': return selfTarget(cost.cardTarget, ['hand'], false, 1) && selfTarget(cost.hostTarget, ['scene'], false, 1);
    // BUG-180 verifies the runtime contract for opponent deck payment. Preserve
    // that contract even though shipped card definitions only declare self here.
    case 'removeDeckTop': return (cost.player === 'self' || (cost.player as string) === 'opp')
      && (typeof cost.n !== 'number' || whole(cost.n));
    case 'removeDeckAll': return cost.player === 'self' || (cost.player as string) === 'opp';
    case 'discardEvidence':
    case 'removeSetCard':
    case 'removeStackedCards':
    case 'fileFrom': return whole(cost.n, 1);
    case 'removeFromHandDownTo': return whole(cost.n);
    case 'flipFaceUpEvidence': return whole(cost.n.min)
      && upper(cost.n.max)
      && cost.n.min <= cost.n.max;
    case 'sleepSelf':
    case 'selfToDeckBottom':
    case 'selfToRemove': return true;
    case 'selfToPartnerArea': return true;
    case 'selfLpDeltaTurn': return Number.isFinite(cost.delta);
  }
}

function payInner(state: GameState, cost: Cost, ctx: EffectCtx, acc: PayResult, choiceCursor = { value: 0 }): void {
  if (cost.kind !== 'pay' && cost.kind !== 'choice' && !canPay(state, cost, ctx)) {
    throw new Error(`cost.pay: ${cost.kind} is not payable`);
  }
  switch (cost.kind) {
    case 'sleepSelf': {
      const uid = ctx.source.uid;
      if (!uid) throw new Error('cost.pay: sleepSelf requires ctx.source.uid');
      mutate.scene.setState(state, uid, 'sleep');
      acc.paidItems.push({ kind: 'sleepSelf', details: { uid } });
      return;
    }
    // BUG-156 修正 (2026-06-27): 旧実装は `targets = ctx.picked ?? cands` を全件 sleep していた。
    //   ctx.picked は cost 経路で production 未配線 (UI/AI が surface する cost picker は flipFaceUpEvidence
    //   のみ、ctx.picked は全 cost で dead) → cands=候補全 active 一致を sleep し、cost.target.n.max を
    //   honor せず 2+ active 候補で全 sleep (rules/15「1枚」違反 = over-pay)。
    //   stunChar (下記 case) と完全同形に是正: n.max cap + active gate + head-fixed。
    //   (1) active gate — canPay が ≥1 active を要求 (evaluate.ts sleepChar) ゆえ pay 時 active 保証。
    //       非 active cand は元々 setState(sleep) が no-op (sleep=同状態 / stun=rules/03 でスタン維持) → skip しても挙動不変。
    //   (2) maxN — ctx.picked 配線後はその選択を優先 (Infinity)、未配線時は pick の n.max ぶんだけ sleep。
    //   「どの active を sleep するか」の player-choice は全 target-pick cost 共通の pre-existing 制約 (別 initiative)。
    case 'sleepChar': {
      const targets = selectActiveCharRangeCostCandidates(state, cost.target, ctx, cost.kind);
      let slept = 0;
      for (const cand of targets) {
        if (cand.kind !== 'char') continue;
        const c = state.players.self.scene.find(x => x.uid === cand.uid)
          ?? state.players.opp.scene.find(x => x.uid === cand.uid);
        if (!c || c.state !== 'active') continue;
        mutate.scene.setState(state, cand.uid, 'sleep');
        acc.paidItems.push({ kind: 'sleepChar', details: { uid: cand.uid } });
        slept++;
      }
      const minN = cost.target.kind === 'pick' ? cost.target.n.min : 1;
      if (slept < minN) throw new Error('cost.pay: sleepChar is not payable');
      return;
    }
    // engine additive wave (2026-06-24): stunChar — sleepChar と対称だが新規ゆえ「N枚」counts を faithful に守る。
    //   (1) active なターゲットのみ stun 化 (コスト文「アクティブ状態の[X]」、mixed-state で非active を誤らない)。
    //   (2) ctx.picked 未配線 (sleepChar 由来の over-pay = BUG-156) の現状で、pick の n.max ぶんだけ stun し
    //       複数 active 候補の全スタン (「1枚」違反) を防ぐ。ctx.picked 配線後はその選択を優先 (maxN=∞)。
    case 'stunChar': {
      const targets = selectActiveCharRangeCostCandidates(state, cost.target, ctx, cost.kind);
      let stunned = 0;
      for (const cand of targets) {
        if (cand.kind !== 'char') continue;
        const c = state.players.self.scene.find(x => x.uid === cand.uid)
          ?? state.players.opp.scene.find(x => x.uid === cand.uid);
        if (!c || c.state !== 'active') continue;
        mutate.scene.setState(state, cand.uid, 'stun');
        acc.paidItems.push({ kind: 'stunChar', details: { uid: cand.uid } });
        stunned++;
      }
      const minN = cost.target.kind === 'pick' ? cost.target.n.min : 1;
      if (stunned < minN) throw new Error('cost.pay: stunChar is not payable');
      return;
    }
    case 'removeFromHand': {
      const targets = selectRemoveFromHandCandidates(state, cost, ctx);
      const ids = targets.map(c => c.cardId);
      if (ids.length !== cost.n) throw new Error('cost.pay: removeFromHand is not payable');
      // Exact occurrence witnesses are removed by index, preserving duplicate
      // hand-card identity. Legacy/AI fallback still uses the old id path.
      const explicit = readRemoveFromHandIndices(ctx);
      if (explicit !== undefined) {
        for (const index of [...explicit].sort((a, b) => b - a)) {
          state.players[ctx.source.player].hand.splice(index, 1);
        }
        addToRemove(state, ctx.source.player, ids);
      } else {
        // W3 (r17): 宣言コスト由来は hand:removed を emit しない (rules/21)
        mutate.hand.discardToRemove(state, ctx.source.player, ids, { viaCost: true });
      }
      acc.paidItems.push({ kind: 'removeFromHand', details: { ids } });
      // attribution mini-wave (2026-07-10): costRemovedMatches{key:'removeFromHand'} (B09060) と
      // dyn $cost.removeFromHand.level (B09050「リムーブしたカードとレベルが同じか低い」) が読む。
      // level は先頭 1 枚の印字値 (対象カードは n=1 のみ。removeDeckTop の ids 記録と同型)。
      if (!ctx.costPaid) ctx.costPaid = {};
      ctx.costPaid['removeFromHand'] = { ids, level: readDef.card(ids[0])?.level };
      return;
    }
    // engine additive wave (2026-06-28): revealFromHand — 手札公開 presence-check cost (B08093 a1)。
    // pay() は no-op: 公開のみでカードは手札に残る (mutate しない、消費なし)。paidItems に log のみ。
    case 'revealFromHand': {
      // n: {min,max} (attribution mini-wave 2026-07-10): B08068「好きな枚数公開」= 可変枚数。
      // picked (UI/AI 選択) が min 以上あればそれを max まで採用、無ければ filter 一致全部を max まで
      // (公開は多いほど利益 = AI fallback 最大公開)。number は従来 pickCandidates と同一挙動。
      const rfhMin = typeof cost.n === 'number' ? cost.n : cost.n.min;
      const rfhMax = typeof cost.n === 'number' ? cost.n : cost.n.max;
      const targets = selectRangeCostCandidates(state, cost.target, ctx);
      const ids = targets
        .filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card')
        .map(c => c.cardId);
      if (ids.length < rfhMin || ids.length > rfhMax) throw new Error('cost.pay: revealFromHand is not payable');
      // W3 (r18): コスト経路の公開も hand:reveal を emit (B09004「【宣言】能力のコストによって」)
      mutate.hand.emitReveal(state, ctx.source.player, ids, { byPlayer: ctx.source.player, cause: 'cost' });
      acc.paidItems.push({ kind: 'revealFromHand', details: { ids } });
      // attribution mini-wave (2026-07-10): dyn $cost.revealFromHand.count (B08068「公開した枚数」) と
      // costRevealedMatches (B09005「公開したカードが〜の場合」) が読む。
      // S1 wave (2026-07-11, B09109 a2): cardName — 「カード名を公開したキャラのカード名に書き換える」が
      // charSetTurnEffect{key:'nameOverride', val:'$cost.revealFromHand.cardName'} で読む (先頭 1 枚の
      // 印字名。複数名カードは names[0]=複合名 — nameOverride は完全置換、rules/19 分割 override は
      // 公式裁定なしの既存設計判断と同 posture)。
      if (!ctx.costPaid) ctx.costPaid = {};
      const rfhName = ids.length > 0 ? readDef.card(ids[0])?.names?.[0] : undefined;
      ctx.costPaid['revealFromHand'] = { ids, count: ids.length, cardName: rfhName };
      return;
    }
    // engine mega-wave W1 (2026-07-03, P29): revealHandToDeckTop — 手札公開→デッキ上 cost (B05049 a1)。
    // revealFromHand との差 = 手札から抜いてデッキ上へ移す 2 mutate のみ (公式Q&A B05049:
    // 「裏向きでデッキの上に移す」= deck は CardId[] で不可視ゆえ表現済)。
    case 'revealHandToDeckTop': {
      const targets = pickCandidates(state, cost.target, ctx, cost.n);
      const ids = targets
        .filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card')
        .map(c => c.cardId);
      if (ids.length !== cost.n) throw new Error('cost.pay: revealHandToDeckTop is not payable');
      // W3 (r18) 混成 review nit 反映: 「公開して…移す」cost も手札公開 — emit は移動前 (カードが
      // 手札に在る時点、hand:reveal の on-hand scan 契約)。B09004「【宣言】能力のコストによって」を
      // method-agnostic に被覆する (emitReveal 単一ソースの残 site)。
      mutate.hand.emitReveal(state, ctx.source.player, ids, { byPlayer: ctx.source.player, cause: 'cost' });
      mutate.hand.remove(state, ctx.source.player, ids);
      mutate.deck.toTop(state, ctx.source.player, ids);
      acc.paidItems.push({ kind: 'revealHandToDeckTop', details: { ids } });
      return;
    }
    case 'removeFromScene': {
      const targets = pickCandidates(state, cost.target, ctx, cost.n);
      const chars = targets.filter((cand): cand is Candidate & { kind: 'char' } => cand.kind === 'char');
      if (chars.length !== cost.n || new Set(chars.map(char => char.uid)).size !== cost.n) {
        throw new Error('cost.pay: removeFromScene is not payable');
      }
      // One removeFromScene cost pays all selected characters simultaneously.
      // This preserves leave-trigger auras when bearer and recipient leave together.
      const results = mutate.scene.removeToRemoveBatch(state, chars.map(cand => cand.uid), 'cost');
      if (results.length !== cost.n || results.some(result => result.deferred || result.prevented || !result.removed.cardId)) {
        throw new Error('cost.pay: removeFromScene was replaced or deferred');
      }
      for (const cand of chars) acc.paidItems.push({ kind: 'removeFromScene', details: { uid: cand.uid } });
      return;
    }
    // engine mega-wave W4 (2026-07-03, r6): 現場キャラを能力使用キャラ自身の下に重ねる cost (B09048 a2)。
    // mutate.scene.toStack = 非リムーブ離場 (rules/16 cascade + B09048 Q&A MR 非redirect)。
    case 'sceneStackUnderSelf': {
      const hostUid = ctx.source.uid;
      if (typeof hostUid !== 'string') throw new Error('cost.pay: sceneStackUnderSelf requires ctx.source.uid');
      const targets = pickCandidates(state, cost.target, ctx, cost.n);
      const chars = targets.filter((cand): cand is Candidate & { kind: 'char' } => cand.kind === 'char');
      if (chars.length !== cost.n || new Set(chars.map(char => char.uid)).size !== cost.n || chars.some(char => char.uid === hostUid)) {
        throw new Error('cost.pay: sceneStackUnderSelf is not payable');
      }
      for (const cand of chars) {
        if (!mutate.scene.toStack(state, cand.uid, hostUid)) {
          throw new Error('cost.pay: sceneStackUnderSelf was replaced or deferred');
        }
        acc.paidItems.push({ kind: 'sceneStackUnderSelf', details: { uid: cand.uid, hostUid } });
      }
      return;
    }
    // engine mega-wave W4 (2026-07-03, r7): 手札公開→現場キャラ下に重ねる cost (B08006 a1)。
    // 公開 emit は移動前 (revealHandToDeckTop と同契約、hand:reveal on-hand scan)。
    // host 選択も cost pick (現状 deterministic first-candidate = 出荷済 cost 群と同じ既知 gap)。
    case 'handStackUnder': {
      const cardCands = pickCandidates(state, cost.cardTarget, ctx, 1);
      const hostCands = pickCandidates(state, cost.hostTarget, ctx, 1);
      const cardCand = cardCands.find((c): c is Candidate & { kind: 'card' } => c.kind === 'card');
      const hostCand = hostCands.find((c): c is Candidate & { kind: 'char' } => c.kind === 'char');
      if (!cardCand || !hostCand) throw new Error('cost.pay: handStackUnder is not payable');
      mutate.hand.emitReveal(state, ctx.source.player, [cardCand.cardId], { byPlayer: ctx.source.player, cause: 'cost' });
      mutate.hand.remove(state, ctx.source.player, [cardCand.cardId]);
      mutate.char.stackCard(state, hostCand.uid, 1);
      acc.paidItems.push({ kind: 'handStackUnder', details: { cardId: cardCand.cardId, hostUid: hostCand.uid } });
      return;
    }
    // Task D E2 (2026-06-12): 〚現場にいる…を n 枚デッキの下に移す〛コスト。
    // UI 選択 (ctx.dyn.costParams.sceneToDeckBottom.uids) を優先し、無ければ
    // pickCandidates (ctx.picked → 先頭 n) fallback。rules/09・23: リムーブではない
    // ため leave:to-remove は発火しない (scene.toDeck 経由、rules/16 set/stacked 清掃込み)。
    case 'sceneToDeckBottom': {
      const explicit = readSceneToDeckUids(ctx);
      const uids: string[] = [];
      if (hasCostParam(ctx, 'sceneToDeckBottom')) {
        const allowed = new Set(candidates(state, cost.target, ctx)
          .filter((cand): cand is Candidate & { kind: 'char' } => cand.kind === 'char')
          .map(cand => cand.uid));
        if (explicit.length !== cost.n || new Set(explicit).size !== explicit.length || explicit.some(uid => !allowed.has(uid))) {
          throw new Error('cost.pay: invalid sceneToDeckBottom picks');
        }
        uids.push(...explicit);
      } else {
        const targets = pickCandidates(state, cost.target, ctx, cost.n);
        for (const cand of targets) {
          if (cand.kind === 'char') uids.push(cand.uid);
        }
      }
      if (uids.length !== cost.n || new Set(uids).size !== cost.n) {
        throw new Error('cost.pay: sceneToDeckBottom is not payable');
      }
      // attribution mini-wave (2026-07-10): dyn $cost.sceneToDeckBottom.level (B07025「移した
      // キャラとレベルが同じか低い」) が読む。cardId は toDeck (splice) 前に捕捉する。
      const stdbIds: string[] = [];
      for (const uid of uids) {
        const ch = state.players[ctx.source.player].scene.find(c => c.uid === uid);
        if (!ch || !mutate.scene.toDeck(state, uid, 'bottom')) {
          throw new Error('cost.pay: sceneToDeckBottom was replaced or deferred');
        }
        stdbIds.push(ch.cardId);
        acc.paidItems.push({ kind: 'sceneToDeckBottom', details: { uid } });
      }
      if (!ctx.costPaid) ctx.costPaid = {};
      ctx.costPaid['sceneToDeckBottom'] = { ids: stdbIds, level: readDef.card(stdbIds[0])?.level };
      return;
    }
    // cluster4 (2026-06-14): 〚リムーブエリアにある…を n 枚デッキの下に移す〛コスト。
    // sceneToDeckBottom の area:'remove' 版。UI 選択 (ctx.dyn.costParams.removeAreaToDeckBottom.ids)
    // 優先、無ければ pickCandidates (ctx.picked → 先頭 n) fallback。p は自分のリムーブエリアのみ
    // (rules/21「自分の」省略 + cost.target は query.side:'self')。
    // rules/09・23: (現場からの) デッキ下移動は scene-removal ではない (leave:to-remove /【現場リムーブ時】
    // hook は発火しない)。デッキは増えるだけなので refresh は起きない (rules/14/26)。
    // ⚠ engine additive wave-4 (2026-07-01): mutate.remove.removeFromHere は **リムーブエリアからの離脱** に
    // 対し remove:exit hook を emit する (B05087/B05088、原因非依存 rules/17 類推)。本コスト経路もコストで
    // remove→deck下 へ移すため remove:exit が発火する。コスト由来発火を card 側が拾うべきか (rules/21 コスト
    // 免除) は B05087/B05088 出荷時に官報 Q&A で確定 (engine 側は method-agnostic に発火 = 正しい既定)。
    case 'removeAreaToDeckBottom': {
      const p = ctx.source.player;
      const explicit = readRemoveAreaToDeckIds(ctx);
      const ids: string[] = [];
      if (hasCostParam(ctx, 'removeAreaToDeckBottom')) {
        const allowed = candidates(state, cost.target, ctx)
          .filter((cand): cand is Candidate & { kind: 'card' } => cand.kind === 'card')
          .map(cand => cand.cardId);
        if (explicit.length !== cost.n || !isMultisetSubset(explicit, allowed)) {
          throw new Error('cost.pay: invalid removeAreaToDeckBottom picks');
        }
        ids.push(...explicit);
      } else {
        const targets = pickCandidates(state, cost.target, ctx, cost.n);
        for (const cand of targets) {
          if (cand.kind === 'card') ids.push(cand.cardId);
        }
      }
      mutate.remove.removeFromHere(state, p, ids);
      mutate.deck.toBottom(state, p, ids);
      for (const id of ids) acc.paidItems.push({ kind: 'removeAreaToDeckBottom', details: { id } });
      return;
    }
    // engine defer-unlock mini-wave (2026-07-09): 〚パートナーエリアにある…のカードを n 枚リムーブする〛
    // コスト (B07039 アン王女)。removeAreaToDeckBottom と同型: UI 選択 (ctx.dyn.costParams.
    // partnerAreaRemove.ids) 優先、無ければ pickCandidates fallback (AI/smoke)。p は自分の PA のみ
    // (rules/21「自分の」省略 + 公式Q&A B07039: コストでは自分のカードしか使えない)。移動は
    // mutate.partner.removeAreaCardsToRemove (atom verb partnerAreaRemove と同 mutate = lastIndexOf
    // splice + remove:exit なし — PA は remove エリアでないため exit hook 対象外、G39 契約)。
    case 'partnerAreaRemove': {
      const p = ctx.source.player;
      const explicit = readPartnerAreaRemoveIds(ctx);
      const ids: string[] = [];
      if (hasCostParam(ctx, 'partnerAreaRemove')) {
        const allowed = candidates(state, cost.target, ctx)
          .filter((cand): cand is Candidate & { kind: 'card' } => cand.kind === 'card')
          .map(cand => cand.cardId);
        if (explicit.length !== cost.n || !isMultisetSubset(explicit, allowed)) {
          throw new Error('cost.pay: invalid partnerAreaRemove picks');
        }
        ids.push(...explicit);
      } else {
        // partner 本体 candidate を除いた上で n 枚 (canPay と対称 — pickCandidates の先頭 slice に
        // {kind:'partner'} が混ざると支払い枚数が n を割るため)。
        const patTargets = candidates(state, cost.target, ctx).filter(c => c.kind === 'card').slice(0, cost.n);
        for (const cand of patTargets) {
          if (cand.kind === 'card') ids.push(cand.cardId);
        }
      }
      mutate.partner.removeAreaCardsToRemove(state, p, ids);
      for (const id of ids) acc.paidItems.push({ kind: 'partnerAreaRemove', details: { id } });
      return;
    }
    // engine additive wave (2026-06-24): 〚現場にいるキャラに裏向きでセットされているカードを合わせて n 枚
    //   リムーブする〛コスト (B08033 a2)。UI 選択 (ctx.dyn.costParams.removeSetCard.hostUids — 1 removal=1
    //   entry、repeat で同一 host から複数枚=2-from-1) を優先、無ければ self scene 順に face-down set card を
    //   n 枚 fallback (AI/smoke)。p は自分のみ (rules/21「自分の」省略、canPay も ctx.source.player 限定)。
    // 各 removal は removeOneSetCard(faceDownOnly:true, cause:'cost') 経由で表向きリムーブ + setcard:leave emit
    //   → B07034 等「離れるたび」observer が発火 (faithful: 当該 observer に ability/effect gate 無)。
    case 'removeSetCard': {
      mutate.char.ensureSetCardInstanceIds(state);
      const eligible = eligibleRemoveSetCards(state, cost, ctx);
      // rules/21「自分の」省略 → コストで使えるのは自分のカードのみ。removeOneSetCard→findChar は
      // self/opp 両 scene を探索するため、explicit hostUids を **自陣 scene の uid に filter** して
      // 相手 set card の誤リムーブを防ぐ (self-only 不変条件を engine 側で担保、review concern #3)。
      // hostSelf (attribution mini-wave 2026-07-10, B08041「このキャラに〜」): host を能力使用
      // キャラ自身に限定 (explicit / fallback 両経路。canPay evaluate.ts と対)。
      const witness = readRemoveSetCardWitness(ctx);
      if (witness.kind === 'invalid') throw new Error('cost.pay: invalid removeSetCard picks');
      const explicit: { hostUids: string[]; instanceIds?: string[] } = witness.kind === 'valid'
        ? witness
        : { hostUids: [] };
      const picks: Array<{ uid: string; instanceId?: string; faceUp: boolean }> = [];
      if (witness.kind === 'valid') {
        const seen = new Set<string>();
        for (let index = 0; index < explicit.hostUids.length; index++) {
          const uid = explicit.hostUids[index]!;
          const instanceId = explicit.instanceIds?.[index];
          const found = instanceId === undefined
            ? eligible.find(candidate => candidate.host.uid === uid && !seen.has(candidate.entry.instanceId ?? ''))
            : eligible.find(candidate => candidate.host.uid === uid && candidate.entry.instanceId === instanceId);
          if (!found || !found.entry.instanceId || seen.has(found.entry.instanceId)) throw new Error('cost.pay: invalid removeSetCard picks');
          seen.add(found.entry.instanceId);
          picks.push({ uid, instanceId: found.entry.instanceId, faceUp: found.entry.faceUp });
        }
        if (picks.length !== cost.n) throw new Error('cost.pay: invalid removeSetCard picks');
      } else {
        for (const candidate of eligible.slice(0, cost.n)) {
          picks.push({ uid: candidate.host.uid, instanceId: candidate.entry.instanceId, faceUp: candidate.entry.faceUp });
        }
      }
      // attribution mini-wave (2026-07-10): costRemovedMatches{key:'removeSetCard'} (B08041
      // 「リムーブしたカードがキャラ/イベントの場合」) が読む。kinds は各除去カードの印字種別。
      const rscIds: string[] = [];
      for (const pick of picks) {
        const removed = mutate.char.removeOneSetCard(
          state, pick.uid,
          pick.faceUp
            ? { cause: 'cost', ...(pick.instanceId ? { setCardInstanceId: pick.instanceId } : {}) }
            : { faceDownOnly: true, cause: 'cost', ...(pick.instanceId ? { setCardInstanceId: pick.instanceId } : {}) },
        );
        if (removed) {
          rscIds.push(removed);
          acc.paidItems.push({ kind: 'removeSetCard', details: { hostUid: pick.uid, setCardId: removed } });
        }
      }
      if (rscIds.length !== cost.n) throw new Error('cost.pay: removeSetCard was replaced or deferred');
      if (!ctx.costPaid) ctx.costPaid = {};
      ctx.costPaid['removeSetCard'] = { ids: rscIds, kinds: rscIds.map(id => readDef.card(id)?.kind) };
      return;
    }
    case 'removeStackedCards': {
      const hostUid = ctx.source.uid;
      if (typeof hostUid !== 'string') throw new Error('cost.pay: removeStackedCards requires ctx.source.uid');
      const selected = readRemoveStackedCardInstanceIds(ctx);
      if (hasCostParam(ctx, 'removeStackedCards')
        && (!selected || selected.length !== cost.n || new Set(selected).size !== selected.length)) {
        throw new Error('cost.pay: removeStackedCards is not payable');
      }
      // Cost witnesses are identity-aware. Normalize legacy count-only stacks
      // before payment so the live mutation has the same identities as dry-run.
      if (!mutate.char.ensureStackedCardEntries(state, hostUid)) {
        throw new Error('cost.pay: removeStackedCards is not payable');
      }
      const entries = mutate.char.removeStackedCards(state, hostUid, cost.n, selected);
      if (entries.length !== cost.n) throw new Error('cost.pay: removeStackedCards is not payable');
      const removeStart = state.players[ctx.source.player].remove.length;
      const paidEntries = entries.map((entry, offset) => ({
        cardId: entry.cardId, instanceId: entry.instanceId, removeIndex: removeStart + offset,
      }));
      addToRemove(state, ctx.source.player, paidEntries.map(entry => entry.cardId));
      acc.paidItems.push({ kind: 'removeStackedCards', details: { hostUid, entries: paidEntries } });
      if (!ctx.costPaid) ctx.costPaid = {};
      ctx.costPaid['removeStackedCards'] = { entries: paidEntries };
      return;
    }
    case 'removeDeckTop': {
      // mega-wave W5 (r37): n は number | {dyn} — canPay と同一式で解決 (evaluate.ts と対)。
      const rdN = resolveDynNumber(cost.n, state, ctx);
      const removed = mutate.deck.removeFromTop(state, cost.player, rdN);
      acc.paidItems.push({ kind: 'removeDeckTop', details: { removed } });
      // engine additive wave (2026-06-29d): costRemovedMatches cond (B03003/B04077/B06078
      // 「コストによって〚X〛がリムーブされた場合」) が参照する除去 cardId を ctx.costPaid へ記録。
      // flipFaceUpEvidence の count 記録と同型。複数 removeDeckTop コストは ids を accumulate (rare)。
      if (!ctx.costPaid) ctx.costPaid = {};
      const prior = (ctx.costPaid['removeDeckTop'] as { ids?: string[] } | undefined)?.ids ?? [];
      ctx.costPaid['removeDeckTop'] = { ids: [...prior, ...removed] };
      // BUG-180: exact payment has no next deck operation to trigger the old
      // pre-take guard. The paid cards are already in remove and participate in
      // this immediate refresh (rules/14, rules/21, rules/26).
      if (removed.length > 0) mutate.deck.refreshAfterTake(state, cost.player);
      return;
    }
    // engine A3 wave (2026-07-11, B09107): デッキ全部リムーブ。removeFromTop(deck.length) で全除去。
    //   player は controller 相対 (ctx.source.player = 「自分の」rules/21)。cost.player は shape のみ。
    //   ★T2 review BLOCK (両 lens 一致、night-wA): 公式Q&A (B09107 TSV) 「リフレッシュはコストを
    //   支払った時点で (この【宣言】能力の効果を解決するより前に) 行います」— 全除去でデッキ 0 に
    //   なるため rules/14 の refresh をここで即時発火する (mill の BUG-137 guard と同 idiom)。
    //   リムーブエリア 0 (=支払前の deck が空で removed も 0) なら refresh 不能 → 支払者敗北 (rules/14)。
    case 'removeDeckAll': {
      const p = ctx.source.player;
      const removed = mutate.deck.removeFromTop(state, p, state.players[p].deck.length);
      acc.paidItems.push({ kind: 'removeDeckAll', details: { removed } });
      mutate.deck.refreshAfterTake(state, p);
      return;
    }
    case 'discardEvidence': {
      const p = ctx.source.player;
      const ids: string[] = [];
      for (let i = 0; i < cost.n; i++) {
        const top = mutate.evidence.removeTop(state, p);
        if (top) ids.push(top.cardId);
      }
      acc.paidItems.push({ kind: 'discardEvidence', details: { ids } });
      return;
    }
    // M2後半 (2026-07-10, B06003 a1): 〚ターン終了時までLP-2する〛— lpMod_turn 書込のみ。
    // emit なし (rules/21: コストで行ったことは「効果によって」条件を満たさない。modifyLP は
    // event を発しない mutator なので追加抑止も不要)。clearTurnEffects で失効。
    case 'selfLpDeltaTurn': {
      const uid = ctx.source.uid;
      if (!uid) throw new Error('cost.pay: selfLpDeltaTurn requires ctx.source.uid');
      mutate.char.modifyLP(state, uid, cost.delta, 'turn');
      acc.paidItems.push({ kind: 'selfLpDeltaTurn', details: { uid, delta: cost.delta } });
      return;
    }
    // M2後半 (2026-07-10, B08047 a2): 〚手札が n 枚になるまで手札をリムーブする〛。
    // count = max(0, hand - n)。0 枚は no-op 成功 (公式Q&A: 実質支払なし)。head-fixed
    // (全 target-pick cost 共通の既存制約と同 posture)。viaCost で hand:removed 非 emit (rules/21)。
    case 'removeFromHandDownTo': {
      const p = ctx.source.player;
      const cnt = Math.max(0, state.players[p].hand.length - cost.n);
      const ids = state.players[p].hand.slice(0, cnt);
      if (ids.length > 0) mutate.hand.discardToRemove(state, p, ids, { viaCost: true });
      acc.paidItems.push({ kind: 'removeFromHandDownTo', details: { ids } });
      if (!ctx.costPaid) ctx.costPaid = {};
      ctx.costPaid['removeFromHandDownTo'] = {
        ids,
        levelSum: ids.reduce((sum, id) => sum + (readDef.card(id)?.level ?? 0), 0),
      };
      return;
    }
    case 'selfToDeckBottom': {
      const uid = ctx.source.uid;
      if (!uid) throw new Error('cost.pay: selfToDeckBottom requires ctx.source.uid');
      if (!mutate.scene.toDeck(state, uid, 'bottom')) {
        throw new Error('cost.pay: selfToDeckBottom was replaced or deferred');
      }
      acc.paidItems.push({ kind: 'selfToDeckBottom', details: { uid } });
      return;
    }
    case 'selfToRemove': {
      const uid = ctx.source.uid;
      if (!uid) throw new Error('cost.pay: selfToRemove requires source uid');
      if (ctx.source.area === 'scene') {
        const source = state.players[ctx.source.player].scene.find(char => char.uid === uid);
        if (!source || source.cardId !== ctx.source.cardId) throw new Error('cost.pay: selfToRemove scene source is stale');
        const result = mutate.scene.removeToRemove(state, uid, 'cost');
        if (result.deferred || result.prevented || result.removed.uid !== uid || result.removed.cardId !== ctx.source.cardId) {
          throw new Error('cost.pay: selfToRemove scene removal failed');
        }
        acc.paidItems.push({ kind: 'selfToRemove', details: { uid, area: 'scene' } });
        return;
      }
      const index = sourceOccurrenceIndex(ctx);
      if (index === null) throw new Error('cost.pay: selfToRemove requires source occurrence index');
      if (ctx.source.area === 'evidence') {
        const entry = state.players[ctx.source.player].evidence[index];
        if (!entry || !entry.faceUp || entry.cardId !== ctx.source.cardId) throw new Error('cost.pay: selfToRemove evidence occurrence is stale');
        const removed = mutate.evidence.removeAt(state, ctx.source.player, index);
        if (!removed || removed.cardId !== ctx.source.cardId) throw new Error('cost.pay: selfToRemove evidence removal failed');
        acc.paidItems.push({ kind: 'selfToRemove', details: { uid, area: 'evidence', index } });
        return;
      }
      if (ctx.source.area === 'file') {
        const entry = state.players[ctx.source.player].file[index];
        if (!entry || entry.type !== 'card-back' || entry.faceUp !== true || entry.cardId !== ctx.source.cardId) throw new Error('cost.pay: selfToRemove FILE occurrence is stale');
        state.players[ctx.source.player].file.splice(index, 1);
        addToRemove(state, ctx.source.player, [entry.cardId]);
        acc.paidItems.push({ kind: 'selfToRemove', details: { uid, area: 'file', index } });
        return;
      }
      throw new Error('cost.pay: selfToRemove requires evidence or FILE source');
    }
    case 'selfToPartnerArea': {
      const uid = ctx.source.uid;
      const cardId = ctx.source.cardId;
      if (!uid || !cardId || ctx.source.area !== 'scene') throw new Error('cost.pay: selfToPartnerArea requires scene source uid');
      if (!mutate.scene.selfToPartnerArea(state, ctx.source.player, uid, cardId)) {
        throw new Error('cost.pay: selfToPartnerArea source is stale or PA is occupied');
      }
      acc.paidItems.push({ kind: 'selfToPartnerArea', details: { uid } });
      return;
    }
    case 'pay': {
      for (const item of cost.items) {
        payInner(state, item, ctx, acc, choiceCursor);
      }
      return;
    }
    case 'choice': {
      // Use ctx.dyn['costChoice'] (number index) if present, else first payable branch.
      const chooseIdx = readChosenIndex(ctx, choiceCursor.value++);
      const chosen = chooseIdx !== undefined ? cost.items[chooseIdx] : cost.items.find(i => canPayAtomicallyAtChoiceCursor(state, i, ctx, choiceCursor.value));
      if (!chosen || !canPayAtomicallyAtChoiceCursor(state, chosen, ctx, choiceCursor.value)) throw new Error('cost.pay: choice has no payable branch');
      payInner(state, chosen, ctx, acc, choiceCursor);
      return;
    }
    case 'fileFrom': {
      // BUG-129 (Task D E3, 2026-06-12): 旧実装は popTop の戻り値を破棄しカードがゲームから
      // 消失していた (リフレッシュ母数バグ、rules/03/14)。FILE 所有者のリムーブエリアへ移す。
      const p = ctx.source.player;
      const ffIds: string[] = [];
      for (let i = 0; i < cost.n; i++) {
        const popped = mutate.file.popTop(state, p);
        if (popped) ffIds.push(popped.cardId);
      }
      if (ffIds.length > 0) {
        mutate.remove.add(state, p, ffIds);
      }
      acc.paidItems.push({ kind: 'fileFrom', details: { n: cost.n, ids: ffIds } });
      return;
    }
    case 'flipFaceUpEvidence': {
      const p = ctx.source.player;
      const indices = hasCostParam(ctx, 'flipFaceUpEvidence')
        ? readFlipIndices(ctx)
        : state.players[p].evidence
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => !entry.faceUp)
          .slice(0, cost.n.min)
          .map(({ index }) => index);
      if (indices.length < cost.n.min || indices.length > cost.n.max) {
        throw new Error(
          `cost.pay: flipFaceUpEvidence picks ${indices.length} out of [${cost.n.min}, ${cost.n.max}]`,
        );
      }
      for (const idx of indices) {
        mutate.evidence.flipFaceUp(state, p, idx);
      }
      // Record count for $cost.flipFaceUpEvidence.count placeholder access.
      // WC2b (2026-07-11): ids も記録 — 「コストによって表向きになった【ヒラメキ】持ちカードの
      // その【ヒラメキ】を発動」(B06023/B06036) が $cost.flipFaceUpEvidence.ids で識別する。
      // flip は既に適用済みなので state.players[p].evidence[idx].cardId が表向き化した cardId (removeDeckTop.ids 同型)。
      if (!ctx.costPaid) ctx.costPaid = {};
      const flippedIds = indices
        .map(i => state.players[p].evidence[i]?.cardId)
        .filter((id): id is string => typeof id === 'string');
      const occurrences = indices
        .filter(i => typeof state.players[p].evidence[i]?.cardId === 'string')
        .map(i => ({
          kind: 'card' as const,
          uid: `evidence:${p}:${i}`,
          cardId: state.players[p].evidence[i].cardId,
          area: 'evidence' as const,
          player: p,
          index: i,
          occurrenceWitness: cardOccurrenceWitness(state, p, 'evidence'),
        }));
      ctx.costPaid['flipFaceUpEvidence'] = { count: indices.length, ids: flippedIds, occurrences };
      // S1 wave (2026-07-11, B06036): fromGroupCards 用の bound 集合も書く — 「コストによって表向きに
      // なった〜のカードを1枚まで選び」が pick query {area:'evidence', fromGroupCards:'$costFlipped'}
      // で母集合を「今回 flip した証拠」に限定する (照合キー = player:evidence:index、candidates.ts
      // fromGroupCardKeys と対)。ids (cardId) だけでは同名証拠の位置区別ができないため index を持つ。
      (ctx.bindings as Record<string, unknown>)['$costFlipped'] = occurrences;
      acc.paidItems.push({ kind: 'flipFaceUpEvidence', details: { count: indices.length, indices } });
      return;
    }
    case 'custom': {
      cost.pay(state, ctx);
      acc.paidItems.push({ kind: 'custom', details: {} });
      return;
    }
    // refactor 2b: payInner は void 戻りのため case 追加漏れが TS で検知されなかった
    // (Task D wave#1 で実証)。never 代入で compile-time 検出する。到達不能。
    default: {
      const _exhaustive: never = cost;
      void _exhaustive;
      return;
    }
  }
}

function pickCandidates(
  state: GameState,
  ref: import('@/engine/types').TargetingRef,
  ctx: EffectCtx,
  n: number,
): Candidate[] {
  return selectCostCandidates(state, ref, ctx, n);
}

/** Extract only candidates authorized by this cost's own targeting reference. */
function selectCostCandidates(
  state: GameState,
  ref: TargetingRef,
  ctx: EffectCtx,
  n: number,
): Candidate[] {
  const allowed = candidates(state, ref, ctx);
  // `ctx.picked` may originate in a prior effect. Never treat it as a cost
  // witness unless every selected occurrence belongs to this exact ref.
  if (ctx.picked !== undefined) {
    if (ctx.picked.length !== n) return [];
    return candidateMultisetSubset(ctx.picked, allowed) ? ctx.picked : [];
  }
  return allowed.slice(0, n);
}

/**
 * Human remove-from-hand costs carry physical hand indices. A supplied
 * witness is authoritative and never falls back to the first matching card.
 */
function selectRemoveFromHandCandidates(
  state: GameState,
  cost: Extract<Cost, { kind: 'removeFromHand' }>,
  ctx: EffectCtx,
): Array<Candidate & { kind: 'card'; index: number }> {
  const indices = readRemoveFromHandIndices(ctx);
  if (indices === undefined) {
    return selectCostCandidates(state, cost.target, ctx, cost.n)
      .filter((candidate): candidate is Candidate & { kind: 'card'; index: number } =>
        candidate.kind === 'card' && typeof candidate.index === 'number');
  }
  if (indices.length !== cost.n || new Set(indices).size !== indices.length) return [];
  const allowed = candidates(state, cost.target, ctx)
    .filter((candidate): candidate is Candidate & { kind: 'card'; index: number } =>
      candidate.kind === 'card' && candidate.player === ctx.source.player && typeof candidate.index === 'number');
  return indices.map(index => allowed.find(candidate => candidate.index === index))
    .filter((candidate): candidate is Candidate & { kind: 'card'; index: number } => candidate !== undefined);
}

/** Canonical ranged target extraction for sleep/stun costs. */
function selectRangeCostCandidates(state: GameState, ref: TargetingRef, ctx: EffectCtx): Candidate[] {
  const min = ref.kind === 'pick' ? ref.n.min : 1;
  const max = ref.kind === 'pick' ? ref.n.max : 1;
  const allowed = candidates(state, ref, ctx);
  if (ctx.picked) {
    if (ctx.picked.length < min || ctx.picked.length > max) return [];
    return candidateMultisetSubset(ctx.picked, allowed) ? ctx.picked : [];
  }
  return allowed.slice(0, max);
}

/** Sleep/stun costs choose only payable active characters before applying n.max. */
function selectActiveCharRangeCostCandidates(
  state: GameState,
  ref: TargetingRef,
  ctx: EffectCtx,
  kind: 'sleepChar' | 'stunChar',
): Array<Candidate & { kind: 'char' }> {
  const min = ref.kind === 'pick' ? ref.n.min : 1;
  const max = ref.kind === 'pick' ? ref.n.max : 1;
  const allowed = candidates(state, ref, ctx).filter(
    (candidate): candidate is Candidate & { kind: 'char' } =>
      candidate.kind === 'char' && findChar(state, candidate.uid)?.state === 'active',
  );
  const explicitUids = readCharacterStateCostUids(ctx, kind);
  if (explicitUids !== undefined) {
    if (explicitUids === null
      || explicitUids.length < min
      || explicitUids.length > max
      || new Set(explicitUids).size !== explicitUids.length) return [];
    const allowedByUid = new Map(allowed.map(candidate => [candidate.uid, candidate]));
    const selected = explicitUids.map(uid => allowedByUid.get(uid));
    return selected.every((candidate): candidate is Candidate & { kind: 'char' } => candidate !== undefined)
      ? selected
      : [];
  }
  if (ctx.picked !== undefined) {
    if (ctx.picked.length < min || ctx.picked.length > max) return [];
    return candidateMultisetSubset(ctx.picked, allowed)
      ? ctx.picked.filter((candidate): candidate is Candidate & { kind: 'char' } => candidate.kind === 'char')
      : [];
  }
  return allowed.slice(0, max);
}

function candidateMultisetSubset(selected: readonly Candidate[], allowed: readonly Candidate[]): boolean {
  const counts = new Map<string, number>();
  for (const candidate of allowed) {
    const key = candidateKey(candidate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const candidate of selected) {
    const key = candidateKey(candidate);
    const remaining = counts.get(key) ?? 0;
    if (remaining < 1) return false;
    counts.set(key, remaining - 1);
  }
  return true;
}

function candidateKey(candidate: Candidate): string {
  switch (candidate.kind) {
    case 'char': return `char:${candidate.player}:${candidate.uid}`;
    case 'partner': return `partner:${candidate.player}`;
    case 'card': return `card:${candidate.player}:${candidate.area}:${candidate.index ?? '*'}:${candidate.cardId}`;
    case 'evidence': return `evidence:${candidate.player}:${candidate.index}`;
    case 'file': return `file:${candidate.player}:${candidate.index}`;
  }
}

// Task D E2 (2026-06-12): UI が選んだ sceneToDeckBottom コスト対象 (readFlipIndices と同型)
function readSceneToDeckUids(ctx: EffectCtx): string[] {
  const dyn = ctx.dyn;
  const params = dyn && (dyn['costParams'] as Record<string, unknown> | undefined);
  const std = params && (params['sceneToDeckBottom'] as { uids?: string[] } | undefined);
  if (std && Array.isArray(std.uids)) {
    return std.uids;
  }
  return [];
}

// engine defer-unlock mini-wave (2026-07-09): UI が選んだ partnerAreaRemove コスト対象 cardId
// (readRemoveAreaToDeckIds と同型)。
function readPartnerAreaRemoveIds(ctx: EffectCtx): string[] {
  const dyn = ctx.dyn;
  const params = dyn && (dyn['costParams'] as Record<string, unknown> | undefined);
  const r = params && (params['partnerAreaRemove'] as { ids?: string[] } | undefined);
  if (r && Array.isArray(r.ids)) {
    return r.ids;
  }
  return [];
}

// cluster4 (2026-06-14): UI が選んだ removeAreaToDeckBottom コスト対象 cardId (readSceneToDeckUids と同型)
function readRemoveAreaToDeckIds(ctx: EffectCtx): string[] {
  const dyn = ctx.dyn;
  const params = dyn && (dyn['costParams'] as Record<string, unknown> | undefined);
  const r = params && (params['removeAreaToDeckBottom'] as { ids?: string[] } | undefined);
  if (r && Array.isArray(r.ids)) {
    return r.ids;
  }
  return [];
}

// engine additive wave (2026-06-24): UI が選んだ removeSetCard コスト対象の host uid 列
//   (readSceneToDeckUids と同型)。1 removal=1 entry、同一 uid の repeat で 2-from-1-char を表す。
function readRemoveStackedCardInstanceIds(ctx: EffectCtx): string[] | undefined {
  const params = ctx.dyn?.['costParams'] as Record<string, unknown> | undefined;
  const selected = params?.['removeStackedCards'] as { instanceIds?: unknown } | undefined;
  return Array.isArray(selected?.instanceIds) && selected.instanceIds.every(id => typeof id === 'string')
    ? selected.instanceIds
    : undefined;
}

function readChosenIndex(ctx: EffectCtx, choiceDepth = 0): number | undefined {
  const dyn = ctx.dyn;
  if (dyn && Array.isArray(dyn['costChoicePath'])) {
    const path = dyn['costChoicePath'];
    if (!path.every(index => typeof index === 'number' && Number.isInteger(index) && index >= 0)) return NaN;
    return path[choiceDepth] as number | undefined;
  }
  if (dyn && typeof dyn['costChoice'] === 'number') {
    return dyn['costChoice'] as number;
  }
  return undefined;
}

/** A supplied nested path must select every and only encountered cost choice. */
function hasExactCostChoicePath(cost: Cost, ctx: EffectCtx): boolean {
  const path = ctx.dyn?.['costChoicePath'];
  if (path === undefined) {
    // Legacy scalar may encode exactly one encountered choice only.  It must
    // never select an outer choice and let a nested choice silently default.
    if (ctx.dyn?.['costChoice'] === undefined) return true;
    let count = 0;
    const countChoices = (node: Cost): void => {
      if (node.kind === 'choice') {
        count += 1;
        for (const item of node.items) countChoices(item);
      } else if (node.kind === 'pay') {
        for (const item of node.items) countChoices(item);
      }
    };
    countChoices(cost);
    return count === 1;
  }
  if (!Array.isArray(path) || !path.every(index => typeof index === 'number' && Number.isInteger(index) && index >= 0)) return false;
  let cursor = 0;
  const visit = (node: Cost): boolean => {
    if (node.kind === 'pay') return node.items.every(visit);
    if (node.kind !== 'choice') return true;
    const selected = path[cursor++];
    return selected !== undefined && selected < node.items.length && visit(node.items[selected]!);
  };
  return visit(cost) && cursor === path.length;
}

function readFlipIndices(ctx: EffectCtx): number[] {
  const dyn = ctx.dyn;
  const params = dyn && (dyn['costParams'] as Record<string, unknown> | undefined);
  const fpu = params && (params['flipFaceUpEvidence'] as { indices?: number[] } | undefined);
  if (fpu && Array.isArray(fpu.indices)) {
    return fpu.indices;
  }
  return [];
}

function readRemoveFromHandIndices(ctx: EffectCtx): number[] | undefined {
  const params = ctx.dyn?.['costParams'] as Record<string, unknown> | undefined;
  const selected = params?.['removeFromHand'] as { indices?: unknown } | undefined;
  if (selected === undefined) return undefined;
  return Array.isArray(selected.indices)
    && selected.indices.every(index => typeof index === 'number' && Number.isInteger(index) && index >= 0)
    ? selected.indices
    : [];
}

/** Read an explicit human sleep/stun payment witness without falling back on malformed input. */
function readCharacterStateCostUids(
  ctx: EffectCtx,
  kind: 'sleepChar' | 'stunChar',
): string[] | null | undefined {
  const rawParams = ctx.dyn?.['costParams'];
  if (rawParams !== undefined && !isPlainRecord(rawParams)) return null;
  const params = rawParams as Record<string, unknown> | undefined;
  if (params === undefined || !Object.prototype.hasOwnProperty.call(params, kind)) return undefined;
  const selected = params[kind];
  if (selected === null || typeof selected !== 'object' || Array.isArray(selected)) return null;
  const uids = (selected as Record<string, unknown>)['uids'];
  return Array.isArray(uids) && uids.every(uid => typeof uid === 'string') ? uids : null;
}

function hasCostParam(ctx: EffectCtx, key: string): boolean {
  const params = ctx.dyn?.['costParams'];
  if (params === undefined) return false;
  if (!isPlainRecord(params)) return true;
  return Object.prototype.hasOwnProperty.call(params, key);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isMultisetSubset(selected: readonly string[], available: readonly string[]): boolean {
  const counts = new Map<string, number>();
  for (const id of available) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const id of selected) {
    const remaining = counts.get(id) ?? 0;
    if (remaining < 1) return false;
    counts.set(id, remaining - 1);
  }
  return true;
}
