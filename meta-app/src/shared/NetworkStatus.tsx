// spec: .claude/specs/meta-ui/02-design-system.md
// 原典: design-mockups_v2/06-shared.jsx の NetworkStatus

import { T } from './tokens';
import { ensureInteractionStyles } from './interactionStyles';

export type NetState = 'online' | 'syncing' | 'offline' | 'error';

interface Props {
  state?: NetState;
}

const CONFIG: Record<NetState, { color: string; label: string; sub: string }> = {
  online:  { color: T.green, label: 'ONLINE',      sub: '同期 OK' },
  syncing: { color: T.gold,  label: 'SYNCING',     sub: '同期中' },
  offline: { color: T.red,   label: 'OFFLINE',     sub: 'ローカル動作' },
  error:   { color: T.red,   label: 'SYNC FAILED', sub: '再試行 →' },
};

export function NetworkStatus({ state = 'online' }: Props) {
  ensureInteractionStyles();
  const cfg = CONFIG[state];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '4px 10px',
      background: 'rgba(0,0,0,0.5)',
      border: `1px solid ${cfg.color}66`,
      borderRadius: 12,
      fontFamily: T.fontMono, fontSize: 10,
      letterSpacing: '0.18em',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: cfg.color,
        boxShadow: state === 'online' ? `0 0 6px ${cfg.color}` : 'none',
        animation: state === 'syncing' ? 'meta-pulse 1.2s infinite' : 'none',
      }} />
      <span style={{ color: cfg.color, fontWeight: 800 }}>{cfg.label}</span>
      {cfg.sub && <span style={{ color: T.textMuted }}>· {cfg.sub}</span>}
    </div>
  );
}
