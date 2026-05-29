// spec: .claude/specs/meta-ui/02-design-system.md + 03-routing.md
// 原典: design-mockups_v2/06-shared.jsx の AppTopBar + StatInline
// CurrencyChip は memory.md 命名規則に従い削除 (F2P スキャフォールド)

import { T } from './tokens';
import { ensureInteractionStyles } from './interactionStyles';

type Route = string;

interface Props {
  playerName?: string;
  playerRank?: string;
  winRate?: number;
  played?: number;
  page?: Route;
  onNav?: (r: Route) => void;
}

const NAV_ITEMS = ['HOME', 'DECK', 'CARDS', 'TUTORIAL', 'SETTINGS'] as const;

export function AppTopBar({
  playerName = 'TANTEI_01',
  playerRank = '探偵 II',
  winRate = 0,
  played = 0,
  page = 'home',
  onNav,
}: Props) {
  ensureInteractionStyles();
  const activeUpper = page.toUpperCase();
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 0, height: 64,
      display: 'flex', alignItems: 'center',
      padding: '0 32px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.45) 70%, transparent)',
      borderBottom: `1px solid rgba(78,195,255,0.20)`,
      zIndex: 10,
      fontFamily: T.fontJp,
      color: T.textPrimary,
    }}>
      {/* Left: logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{
          width: 44, height: 44, position: 'relative',
          border: `2px solid ${T.gold}`,
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(78,195,255,0.1))',
          boxShadow: `0 0 12px rgba(255,215,0,0.3)`,
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="logo">
            <circle cx="11" cy="11" r="7" stroke={T.gold} strokeWidth="1.8" />
            <circle cx="11" cy="11" r="4" stroke={T.gold} strokeWidth="0.8" opacity="0.5" />
            <line x1="16" y1="16" x2="24" y2="24" stroke={T.gold} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.fontMono, letterSpacing: '0.18em' }}>
            CONAN TCG
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, letterSpacing: '0.04em' }}>
            探偵 名鑑
          </div>
        </div>
      </div>

      {/* Center: nav */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4 }}>
        {NAV_ITEMS.map((p) => {
          const active = p === activeUpper;
          return (
            <button
              key={p}
              className="meta-nav-item"
              onClick={() => onNav?.(p.toLowerCase())}
              style={{
                padding: '8px 22px',
                fontFamily: T.fontMono,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: active ? T.gold : T.textSecondary,
                borderBottom: active ? `2px solid ${T.gold}` : '2px solid transparent',
                cursor: 'pointer',
                position: 'relative',
                background: 'transparent',
              }}>
              {p}
            </button>
          );
        })}
      </div>

      {/* Right: stats + profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', gap: 18, paddingRight: 14, borderRight: '1px solid rgba(78,195,255,0.15)' }}>
          <StatInline label="勝率" value={`${winRate}%`} color={T.green} />
          <StatInline label="対戦" value={String(played)} color={T.neonBlue} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 14px 6px 6px',
          background: 'rgba(78,195,255,0.08)',
          border: '1px solid rgba(78,195,255,0.25)',
          borderRadius: 22,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `linear-gradient(135deg, ${T.blue}, ${T.purple})`,
            border: `1.5px solid ${T.gold}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: T.textPrimary,
          }}>
            🕵
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, fontFamily: T.fontMono, letterSpacing: '0.05em' }}>{playerName}</div>
            <div style={{ fontSize: 10, color: T.gold, fontFamily: T.fontJp, letterSpacing: '0.12em', marginTop: 1 }}>{playerRank}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatInline({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'right', lineHeight: 1.1 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 16, fontWeight: 800, color, letterSpacing: '0.04em', marginTop: 1 }}>{value}</div>
    </div>
  );
}
