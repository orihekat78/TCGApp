import { create } from 'zustand';
import type { CloudSyncStatus } from './types';

const DISABLED_STATUS: CloudSyncStatus = {
  phase: 'disabled',
  email: null,
  pendingCount: 0,
  lastSyncedAt: null,
  message: null,
};

type CloudSyncStatusState = {
  status: CloudSyncStatus;
  setStatus: (status: CloudSyncStatus) => void;
  reset: () => void;
};

export const useCloudSyncStatusStore = create<CloudSyncStatusState>((set) => ({
  status: { ...DISABLED_STATUS },
  setStatus: (status) => set({ status: { ...status } }),
  reset: () => set({ status: { ...DISABLED_STATUS } }),
}));
