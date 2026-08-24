import { create } from 'zustand';
import { areTerminalInteractionsBlocked } from '@/ui/services/terminalInteractionGate.js';

export type StackedCardCostCandidate = {
  instanceId: string;
  cardId: string;
  ordinal: number;
  hidden?: boolean;
};
export type StackedCardCostRequest = {
  sourceName: string;
  candidates: StackedCardCostCandidate[];
  nMin: number;
  nMax: number;
};
export type StackedCardCostChoice =
  | { kind: 'confirm'; instanceIds: string[] }
  | { kind: 'cancel' };

type Resolver = (choice: StackedCardCostChoice) => void;
type Store = {
  current: StackedCardCostRequest | null;
  _resolver: Resolver | null;
  _setCurrent: (request: StackedCardCostRequest | null) => void;
  _setResolver: (resolver: Resolver | null) => void;
};

export const useStackedCardCostPickerStore = create<Store>((set) => ({
  current: null,
  _resolver: null,
  _setCurrent: (current) => set({ current }),
  _setResolver: (_resolver) => set({ _resolver }),
}));

function settle(choice: StackedCardCostChoice): void {
  const store = useStackedCardCostPickerStore.getState();
  if (store.current === null) return;
  const resolver = store._resolver;
  store._setCurrent(null);
  store._setResolver(null);
  resolver?.(choice);
}

export function cancelStackedCardCostPicker(): void {
  settle({ kind: 'cancel' });
}

function ask(request: StackedCardCostRequest): Promise<StackedCardCostChoice> {
  if (areTerminalInteractionsBlocked()) return Promise.resolve({ kind: 'cancel' });
  const store = useStackedCardCostPickerStore.getState();
  store._resolver?.({ kind: 'cancel' });
  return new Promise((resolve) => {
    store._setResolver(resolve);
    store._setCurrent(request);
  });
}

export function useStackedCardCostPicker(): {
  current: StackedCardCostRequest | null;
  ask: (request: StackedCardCostRequest) => Promise<StackedCardCostChoice>;
  confirm: (instanceIds: string[]) => void;
  cancel: () => void;
} {
  return {
    current: useStackedCardCostPickerStore.getState().current,
    ask,
    confirm: (instanceIds) => settle({ kind: 'confirm', instanceIds }),
    cancel: cancelStackedCardCostPicker,
  };
}
