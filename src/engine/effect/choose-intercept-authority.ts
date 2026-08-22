import type { GameState } from '../types/index.js';
import type { PendingChooseInterceptResponseSide } from './pending-state.js';

const WITNESS_KEY = 'chooseInterceptBatchWitnesses';

type BatchWitness = {
  token: number;
  response: PendingChooseInterceptResponseSide;
  effectCancelled: boolean;
  selectedUids: string[];
};

function ownerOf(response: PendingChooseInterceptResponseSide): 'self' | 'opp' {
  return response.ownerPlayer ?? (response.player === 'self' ? 'opp' : 'self');
}

function cloneResponse(response: PendingChooseInterceptResponseSide): PendingChooseInterceptResponseSide {
  return { ...response, protector: { ...response.protector } };
}

function witnesses(value: unknown): BatchWitness[] {
  return Array.isArray(value) ? value as BatchWitness[] : [];
}

export function chooseInterceptReactionKey(response: PendingChooseInterceptResponseSide): string {
  return JSON.stringify([
    response.resolution ?? 'discard-or-cancel',
    response.player,
    ownerOf(response),
    response.publicHandRevealToken ?? null,
    response.protector.uid,
    response.protector.cardId,
    response.protector.abilityId,
    response.protector.setCardInstanceId ?? null,
    response.targetUid,
  ]);
}

/** Bind one simultaneous reaction batch to the physical characters that produced it. */
export function createChooseInterceptBatchAuthority(
  state: GameState,
  responses: PendingChooseInterceptResponseSide[],
  selectedUids: string[],
): number {
  const token = (state.chooseInterceptBatchSeq ?? 0) + 1;
  state.chooseInterceptBatchSeq = token;
  for (const response of responses) {
    const owner = ownerOf(response);
    const witness = state.players[owner].scene.find(char => char.uid === response.protector.uid);
    if (!witness) throw new Error('chooseIntercept: missing physical batch witness');
    if ((response.resolution ?? 'discard-or-cancel') === 'cancel') {
      const instanceId = response.protector.setCardInstanceId;
      const entry = instanceId
        ? witness.setCards.find(card => (
          card.instanceId === instanceId
          && card.cardId === response.protector.cardId
          && card.faceUp
        ))
        : undefined;
      if (!entry) throw new Error('chooseIntercept: missing physical set-card witness');
    }
    const current = witnesses(witness.turnEffects[WITNESS_KEY]);
    witness.turnEffects[WITNESS_KEY] = [
      ...current,
      {
        token,
        response: cloneResponse(response),
        effectCancelled: false,
        selectedUids: [...selectedUids],
      },
    ];
  }
  return token;
}

/** Read the exact ordered selection shared by every unresolved physical witness. */
export function readChooseInterceptBatchSelection(
  state: GameState,
  token: number,
): string[] | undefined {
  let authoritative: string[] | undefined;
  for (const player of ['self', 'opp'] as const) {
    for (const char of state.players[player].scene) {
      for (const witness of witnesses(char.turnEffects[WITNESS_KEY])) {
        if (witness.token !== token) continue;
        if (!Array.isArray(witness.selectedUids)
          || witness.selectedUids.length === 0
          || witness.selectedUids.some(uid => typeof uid !== 'string')) {
          return undefined;
        }
        if (authoritative === undefined) {
          authoritative = [...witness.selectedUids];
          continue;
        }
        if (witness.selectedUids.length !== authoritative.length
          || witness.selectedUids.some((uid, index) => uid !== authoritative?.[index])) {
          return undefined;
        }
      }
    }
  }
  return authoritative;
}

/** Read the exact unresolved reaction multiset owned by one live batch. */
export function readChooseInterceptBatchAuthority(
  state: GameState,
  token: number,
): PendingChooseInterceptResponseSide[] {
  const responses: PendingChooseInterceptResponseSide[] = [];
  for (const player of ['self', 'opp'] as const) {
    for (const char of state.players[player].scene) {
      for (const witness of witnesses(char.turnEffects[WITNESS_KEY])) {
        if (witness.token === token) responses.push(cloneResponse(witness.response));
      }
    }
  }
  return responses;
}

/** Read the cancellation fact shared by every unresolved physical witness. */
export function readChooseInterceptBatchCancellation(
  state: GameState,
  token: number,
): boolean | undefined {
  let found = false;
  let authoritative: boolean | undefined;
  for (const player of ['self', 'opp'] as const) {
    for (const char of state.players[player].scene) {
      for (const witness of witnesses(char.turnEffects[WITNESS_KEY])) {
        if (witness.token !== token) continue;
        if (typeof witness.effectCancelled !== 'boolean') return undefined;
        if (found && witness.effectCancelled !== authoritative) return undefined;
        found = true;
        authoritative = witness.effectCancelled;
      }
    }
  }
  return found ? authoritative : undefined;
}

/** Persist source cancellation on every unresolved physical witness in the batch. */
export function markChooseInterceptBatchCancelled(state: GameState, token: number | undefined): void {
  if (token === undefined) return;
  let found = false;
  for (const player of ['self', 'opp'] as const) {
    for (const char of state.players[player].scene) {
      const current = witnesses(char.turnEffects[WITNESS_KEY]);
      for (const witness of current) {
        if (witness.token !== token) continue;
        witness.effectCancelled = true;
        found = true;
      }
    }
  }
  if (!found) throw new Error('chooseIntercept: missing physical cancellation authority');
}

/** Resolve exactly one physical witness while leaving every simultaneous sibling authoritative. */
export function consumeChooseInterceptBatchAuthority(
  state: GameState,
  token: number | undefined,
  response: PendingChooseInterceptResponseSide,
): void {
  if (token === undefined) return;
  if ((response.resolution ?? 'discard-or-cancel') === 'cancel') {
    const owner = ownerOf(response);
    const host = state.players[owner].scene.find(char => char.uid === response.protector.uid);
    const instanceId = response.protector.setCardInstanceId;
    const entry = instanceId
      ? host?.setCards.find(card => (
        card.instanceId === instanceId
        && card.cardId === response.protector.cardId
        && card.faceUp
      ))
      : undefined;
    if (!entry) throw new Error('chooseIntercept: stale physical set-card witness');
  }
  const key = chooseInterceptReactionKey(response);
  for (const player of ['self', 'opp'] as const) {
    for (const char of state.players[player].scene) {
      const current = witnesses(char.turnEffects[WITNESS_KEY]);
      const index = current.findIndex(witness => (
        witness.token === token && chooseInterceptReactionKey(witness.response) === key
      ));
      if (index < 0) continue;
      const next = current.filter((_, candidateIndex) => candidateIndex !== index);
      if (next.length > 0) char.turnEffects[WITNESS_KEY] = next;
      else delete char.turnEffects[WITNESS_KEY];
      return;
    }
  }
  throw new Error('chooseIntercept: stale physical batch witness');
}

export function clearChooseInterceptBatchAuthority(state: GameState, token: number | undefined): void {
  if (token === undefined) return;
  for (const player of ['self', 'opp'] as const) {
    for (const char of state.players[player].scene) {
      const current = witnesses(char.turnEffects[WITNESS_KEY]);
      const next = current.filter(witness => witness.token !== token);
      if (next.length > 0) char.turnEffects[WITNESS_KEY] = next;
      else delete char.turnEffects[WITNESS_KEY];
    }
  }
}

/** Terminal states cannot retain any resumable physical reaction witness. */
export function clearAllChooseInterceptBatchAuthorities(state: GameState): void {
  for (const player of ['self', 'opp'] as const) {
    for (const char of state.players[player].scene) {
      if (char.turnEffects === undefined) continue;
      delete char.turnEffects[WITNESS_KEY];
    }
  }
}
