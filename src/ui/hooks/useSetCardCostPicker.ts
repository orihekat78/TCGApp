// BUG-248: removeSetCard 宣言コストの物理 occurrence picker。
// 既存 pendingSetCardChoice / SetCardChoiceModalHost を再利用し、裏向き cardId はUIへ渡さない。

import { useGameStateStore } from '@/ui/state/store.js';
import { areTerminalInteractionsBlocked } from '@/ui/services/terminalInteractionGate.js';

export type SetCardCostCandidate = {
  hostUid: string;
  hostLabel: string;
  instanceId: string;
  ordinal: number;
  hidden: boolean;
  /** 表向きカードだけが持つ公開情報。 */
  cardId?: string;
};

export type SetCardCostRequest = {
  player: 'self' | 'opp';
  source: { uid: string; cardId: string; abilityId: string };
  candidates: SetCardCostCandidate[];
  n: number;
};

export type SetCardCostChoice =
  | { kind: 'confirm'; picks: Array<{ hostUid: string; instanceId: string }> }
  | { kind: 'cancel' };

let resolver: ((choice: SetCardCostChoice) => void) | null = null;

function ask(request: SetCardCostRequest): Promise<SetCardCostChoice> {
  if (areTerminalInteractionsBlocked()) return Promise.resolve({ kind: 'cancel' });
  if (resolver) resolver({ kind: 'cancel' });
  return new Promise((resolve) => {
    resolver = resolve;
    useGameStateStore.getState().setPendingSetCardChoice({
      player: request.player,
      hostUid: '',
      purpose: 'cost',
      entries: request.candidates,
      nMin: request.n,
      nMax: request.n,
      selectedInstanceIds: [],
      source: request.source,
    });
  });
}

function settle(choice: SetCardCostChoice): void {
  const pending = useGameStateStore.getState().pendingSetCardChoice;
  if (pending?.purpose === 'cost') useGameStateStore.getState().setPendingSetCardChoice(null);
  const current = resolver;
  resolver = null;
  current?.(choice);
}

export function toggleSetCardCostChoice(instanceId: string): void {
  const store = useGameStateStore.getState();
  const pending = store.pendingSetCardChoice;
  if (pending?.purpose !== 'cost' || !pending.entries.some((entry) => entry.instanceId === instanceId)) return;
  const selected = pending.selectedInstanceIds ?? [];
  const next = selected.includes(instanceId)
    ? selected.filter((id) => id !== instanceId)
    : selected.length < (pending.nMax ?? 1) ? [...selected, instanceId] : selected;
  store.setPendingSetCardChoice({ ...pending, selectedInstanceIds: next });
}

export function confirmSetCardCostChoice(): void {
  const pending = useGameStateStore.getState().pendingSetCardChoice;
  if (pending?.purpose !== 'cost') return;
  const selected = pending.selectedInstanceIds ?? [];
  if (selected.length < (pending.nMin ?? 0) || selected.length > (pending.nMax ?? 0)) return;
  const byInstance = new Map(pending.entries.map((entry) => [entry.instanceId, entry]));
  const picks = selected.map((instanceId) => byInstance.get(instanceId))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined && typeof entry.hostUid === 'string')
    .map((entry) => ({ hostUid: entry.hostUid!, instanceId: entry.instanceId }));
  if (picks.length !== selected.length) return;
  settle({ kind: 'confirm', picks });
}

export function cancelSetCardCostChoice(): void {
  settle({ kind: 'cancel' });
}

export function useSetCardCostPicker() {
  return { ask, cancel: cancelSetCardCostChoice, confirm: confirmSetCardCostChoice };
}
