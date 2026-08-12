import { useCloudSyncStatusStore } from '../cloud/statusStore';
import type { CloudSyncPhase, CloudSyncStatus } from '../cloud/types';
import type { Route } from '../router/routes';
import { NetworkStatus, type NetState } from './NetworkStatus';

const NETWORK_STATE: Record<CloudSyncPhase, NetState> = {
  disabled: 'offline',
  idle: 'syncing',
  syncing: 'syncing',
  online: 'online',
  offline: 'offline',
  conflict: 'error',
  error: 'error',
};

const STATUS_LABEL: Record<CloudSyncPhase, string> = {
  disabled: 'クラウド同期は無効。ローカル保存中',
  idle: 'クラウド同期を待機中',
  syncing: 'クラウド同期中',
  online: 'クラウド同期済み',
  offline: 'オフライン。ローカル保存中',
  conflict: 'クラウド同期に競合あり',
  error: 'クラウド同期に失敗。ローカル保存中',
};

type Props = {
  statusOverride?: CloudSyncStatus;
};

export function shouldShowCloudSyncIndicator(route: Route): boolean {
  return route !== 'match';
}

export function CloudSyncIndicator({ statusOverride }: Props = {}) {
  const storedStatus = useCloudSyncStatusStore((state) => state.status);
  const status = statusOverride ?? storedStatus;
  const pending = status.pendingCount > 0 ? `。保留${status.pendingCount}件` : '';
  const label = `${STATUS_LABEL[status.phase]}${pending}`;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      title={label}
      data-cloud-sync-phase={status.phase}
      className="cloud-sync-indicator"
    >
      <NetworkStatus state={NETWORK_STATE[status.phase]} compact />
    </div>
  );
}
