import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CloudSyncIndicator,
  shouldShowCloudSyncIndicator,
} from '../../meta-app/src/shared/CloudSyncIndicator';
import type { CloudSyncStatus } from '../../meta-app/src/cloud/types';
import { useCloudSyncStatusStore } from '../../meta-app/src/cloud/statusStore';

describe('CloudSyncIndicator', () => {
  beforeEach(() => useCloudSyncStatusStore.getState().reset());

  it('identifies local-only mode when cloud sync is disabled', () => {
    const html = renderToStaticMarkup(<CloudSyncIndicator />);

    expect(html).toContain('data-cloud-sync-phase="disabled"');
    expect(html).toContain('クラウド同期は無効。ローカル保存中');
    expect(html).toContain('OFFLINE');
  });

  it('announces conflicts and the pending operation count without showing the email', () => {
    const status = {
      phase: 'conflict',
      email: 'family@example.com',
      pendingCount: 3,
      lastSyncedAt: null,
      message: 'CONFLICT',
    } as const;

    const html = renderToStaticMarkup(<CloudSyncIndicator statusOverride={status} />);

    expect(html).toContain('data-cloud-sync-phase="conflict"');
    expect(html).toContain('クラウド同期に競合あり。保留3件');
    expect(html).toContain('SYNC FAILED');
    expect(html).not.toContain('family@example.com');
  });

  it('renders a compact, fully named live status for the persistent shell', () => {
    const status = {
      phase: 'syncing',
      pendingCount: 2,
      message: 'SYNCING',
    } as const;

    const html = renderToStaticMarkup(<CloudSyncIndicator statusOverride={status} />);

    expect(html).toContain('class="cloud-sync-indicator"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="クラウド同期中。保留2件"');
    expect(html).toContain('class="network-status network-status--compact"');
    expect(html).toContain('class="network-status__primary"');
    expect(html).toContain('SYNCING');
  });

  it.each([
    ['online', 'クラウド同期済み', 'online', '#3aa67a'],
    ['syncing', 'クラウド同期中', 'syncing', '#ffd700'],
    ['offline', 'オフライン。ローカル保存中', 'offline', '#ff8a8a'],
    ['error', 'クラウド同期に失敗。ローカル保存中', 'error', '#ff8a8a'],
  ] as const)(
    'renders exact compact status semantics for %s',
    (phase, label, networkState, color) => {
      const status: CloudSyncStatus = {
        phase,
        email: null,
        pendingCount: 0,
        lastSyncedAt: null,
        message: null,
      };

      const html = renderToStaticMarkup(<CloudSyncIndicator statusOverride={status} />);

      expect(html).toContain(`data-cloud-sync-phase="${phase}"`);
      expect(html).toContain(`aria-label="${label}"`);
      expect(html).toContain(`title="${label}"`);
      expect(html).toContain('network-status--compact');
      expect(html).toContain(`data-network-state="${networkState}"`);
      expect(html).toContain(`--network-status-color:${color}`);
    },
  );

  it('stays out of the active match controls', () => {
    expect(shouldShowCloudSyncIndicator('match')).toBe(false);
    expect(shouldShowCloudSyncIndicator('home')).toBe(true);
    expect(shouldShowCloudSyncIndicator('settings')).toBe(true);
  });
});
