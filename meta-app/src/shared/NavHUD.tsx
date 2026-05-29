// spec: .claude/specs/meta-ui/03-routing.md
// 開発用フローティング HUD: BACK / 現画面 / JUMP / HOME / NetworkStatus
// 本番ビルドでは import.meta.env.PROD で非表示にできる

import type { Route } from '../router/routes';
import { ROUTES } from '../router/routes';
import { T } from './tokens';
import { NetworkStatus } from './NetworkStatus';

interface Props {
  route: Route;
  onNav: (r: Route) => void;
  visible?: boolean;
}

export function NavHUD({ route, onNav, visible = true }: Props) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', left: 16, bottom: 16, zIndex: 100,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px',
      background: 'rgba(0,0,0,0.75)',
      border: `1px solid ${T.gold}55`,
      borderRadius: 4,
      fontFamily: T.fontMono, fontSize: 10,
      color: T.textPrimary, letterSpacing: '0.1em',
      backdropFilter: 'blur(4px)',
    }}>
      <button
        onClick={() => window.history.back()}
        title="戻る (Esc)"
        style={hudBtnStyle}>
        ← BACK
      </button>
      <div style={{ color: T.gold, fontWeight: 800, padding: '0 6px' }}>
        {route.toUpperCase()}
      </div>
      <details style={{ position: 'relative' }}>
        <summary style={hudBtnStyle as React.CSSProperties}>JUMP</summary>
        <div style={{
          position: 'absolute', bottom: 28, left: 0,
          background: 'rgba(0,0,0,0.92)',
          border: `1px solid ${T.gold}66`,
          borderRadius: 3,
          padding: 4,
          display: 'flex', flexDirection: 'column', gap: 2,
          minWidth: 100,
        }}>
          {ROUTES.map((r) => (
            <button key={r} onClick={() => onNav(r)} style={{
              ...hudBtnStyle,
              textAlign: 'left',
              padding: '4px 8px',
              background: r === route ? `${T.gold}22` : 'transparent',
              color: r === route ? T.gold : T.textPrimary,
            }}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </details>
      <button onClick={() => onNav('home')} style={hudBtnStyle}>HOME</button>
      <NetworkStatus state="offline" />
    </div>
  );
}

const hudBtnStyle = {
  padding: '4px 8px',
  background: 'rgba(78,195,255,0.10)',
  border: '1px solid rgba(78,195,255,0.35)',
  borderRadius: 2,
  fontFamily: T.fontMono,
  fontSize: 10,
  color: T.textPrimary,
  letterSpacing: '0.12em',
  cursor: 'pointer',
};
