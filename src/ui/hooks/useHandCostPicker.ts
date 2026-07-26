import { create } from 'zustand';

export type HandCostRequest = {
  side: 'self' | 'opp';
  sourceName: string;
  candidates: Array<{ index: number; cardId: string }>;
  n: number;
};
export type HandCostChoice = { kind: 'confirm'; indices: number[] } | { kind: 'cancel' };

type Store = {
  current: HandCostRequest | null;
  resolver: ((choice: HandCostChoice) => void) | null;
  setCurrent: (current: HandCostRequest | null) => void;
  setResolver: (resolver: ((choice: HandCostChoice) => void) | null) => void;
  _reset: () => void;
};

export const useHandCostPickerStore = create<Store>((set) => ({
  current: null, resolver: null,
  setCurrent: (current) => set({ current }),
  setResolver: (resolver) => set({ resolver }),
  _reset: () => set({ current: null, resolver: null }),
}));

function settle(choice: HandCostChoice): void {
  const store = useHandCostPickerStore.getState();
  if (!store.current) return;
  const resolver = store.resolver;
  store.setCurrent(null);
  store.setResolver(null);
  resolver?.(choice);
}

export function cancelHandCostPicker(): void { settle({ kind: 'cancel' }); }

export function useHandCostPicker() {
  return {
    ask: (request: HandCostRequest) => {
      const store = useHandCostPickerStore.getState();
      store.resolver?.({ kind: 'cancel' });
      return new Promise<HandCostChoice>((resolve) => {
        store.setResolver(resolve);
        store.setCurrent(request);
      });
    },
    confirm: (indices: number[]) => settle({ kind: 'confirm', indices }),
    cancel: cancelHandCostPicker,
  };
}
