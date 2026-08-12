// spec: .claude/specs/meta-ui/02-design-system.md
// 原典: design-mockups_v2/06-shared.jsx の NetworkStatus

import type { CSSProperties } from 'react';
import { T } from './tokens';
import { ensureInteractionStyles } from './interactionStyles';

export type NetState = 'online' | 'syncing' | 'offline' | 'error';

interface Props {
  state?: NetState;
  compact?: boolean;
}

const CONFIG: Record<NetState, { color: string; label: string; sub: string }> = {
  online:  { color: T.green, label: 'ONLINE',      sub: '同期 OK' },
  syncing: { color: T.gold,  label: 'SYNCING',     sub: '同期中' },
  offline: { color: T.red,   label: 'OFFLINE',     sub: 'ローカル動作' },
  error:   { color: T.red,   label: 'SYNC FAILED', sub: '再試行 →' },
};

export function NetworkStatus({ state = 'online', compact = false }: Props) {
  ensureInteractionStyles();
  const cfg = CONFIG[state];
  return (
    <div
      className={`network-status${compact ? ' network-status--compact' : ''}`}
      data-network-state={state}
      style={{ '--network-status-color': cfg.color } as CSSProperties}
    >
      <span className="network-status__dot" />
      <span className="network-status__primary">{cfg.label}</span>
      {cfg.sub && <span className="network-status__secondary">· {cfg.sub}</span>}
    </div>
  );
}
