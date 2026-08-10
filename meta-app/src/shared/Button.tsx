// spec: .claude/specs/meta-ui/02-design-system.md
// 原典: design-mockups_v2/06-shared.jsx の PrimaryButton / GhostButton / SmallButton / SetupButton / SetupReadyButton
// 全 5 種を集約

import type { CSSProperties, ReactNode } from 'react';
import { T, shade } from './tokens';
import { ensureInteractionStyles } from './interactionStyles';

interface BaseButtonProps {
  label?: string;
  sub?: string;
  onClick?: () => void;
  children?: ReactNode;
  disabled?: boolean;
  ariaBusy?: boolean;
}

// ── Primary (gold solid CTA) ──────────────────────────────────────────
interface PrimaryProps extends BaseButtonProps {
  big?: boolean;
  accent?: string;
}
export function PrimaryButton({ children, label, sub, big = false, accent = T.gold, onClick }: PrimaryProps) {
  return (
    <button onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
        padding: big ? '18px 56px' : '12px 32px',
        background: `linear-gradient(180deg, ${accent}, ${shade(accent, -0.4)})`,
        color: shade(accent, -0.7),
        fontFamily: T.fontJp,
        fontWeight: 800,
        fontSize: big ? 22 : 16,
        letterSpacing: '0.06em',
        borderRadius: 4,
        cursor: 'pointer',
        boxShadow: `0 0 18px ${accent}55, 0 6px 12px rgba(0,0,0,0.5), inset 0 1px 0 ${shade(accent, 0.4)}`,
        border: `1px solid ${shade(accent, -0.6)}`,
      }}>
      <div>{label || children}</div>
      {sub && (
        <div style={{ fontSize: big ? 11 : 10, fontFamily: T.fontMono, opacity: 0.7, letterSpacing: '0.15em', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </button>
  );
}

// ── Ghost (translucent secondary) ─────────────────────────────────────
interface GhostProps extends BaseButtonProps {
  accent?: string;
  big?: boolean;
}
export function GhostButton({ children, label, sub, accent = T.neonBlue, onClick, big = false }: GhostProps) {
  return (
    <button onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
        padding: big ? '14px 36px' : '10px 22px',
        background: `linear-gradient(180deg, rgba(78,195,255,0.10), rgba(78,195,255,0.03))`,
        color: accent,
        fontFamily: T.fontJp,
        fontWeight: 700,
        fontSize: big ? 16 : 13,
        letterSpacing: '0.08em',
        borderRadius: 3,
        cursor: 'pointer',
        border: `1px solid ${accent}66`,
        boxShadow: `inset 0 0 12px ${accent}11`,
      }}>
      <div>{label || children}</div>
      {sub && (
        <div style={{ fontSize: 9, fontFamily: T.fontMono, opacity: 0.55, letterSpacing: '0.15em', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </button>
  );
}

// ── Small (toolbar) ────────────────────────────────────────────────────
interface SmallProps extends BaseButtonProps {
  accent?: string;
  solid?: boolean;
  active?: boolean;
}
export function SmallButton({ label, sub, accent = T.neonBlue, solid = false, active = false, onClick }: SmallProps) {
  ensureInteractionStyles();
  const base: CSSProperties = solid
    ? {
        background: `linear-gradient(180deg, ${accent}, ${shade(accent, -0.35)})`,
        color: shade(accent, -0.7),
        border: `1px solid ${shade(accent, -0.4)}`,
      }
    : {
        background: active ? `${accent}22` : 'rgba(0,0,0,0.35)',
        color: accent,
        border: `1px solid ${accent}55`,
      };
  // CSS custom properties for :hover (interaction stylesheet reads these)
  const cssVars = {
    '--meta-hover-bg': `${accent}22`,
    '--meta-hover-border': accent,
    '--meta-hover-glow': `${accent}55`,
  } as CSSProperties;
  return (
    <button onClick={onClick} className="meta-btn-small" style={{
      ...base, ...cssVars,
      padding: '6px 14px',
      borderRadius: 3,
      fontFamily: T.fontJp, fontWeight: 700, fontSize: 12,
      letterSpacing: '0.08em',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 8,
      lineHeight: 1,
    }}>
      <span>{label}</span>
      {sub && (
        <span style={{ fontFamily: T.fontMono, fontSize: 9, opacity: 0.55, letterSpacing: '0.16em', fontWeight: 800 }}>
          {sub}
        </span>
      )}
    </button>
  );
}

// ── Setup (BACK / EXPORT) ─────────────────────────────────────────────
type SetupProps = BaseButtonProps;
export function SetupButton({ label, sub, onClick, disabled = false, ariaBusy = false }: SetupProps) {
  ensureInteractionStyles();
  return (
    <button onClick={onClick} disabled={disabled} aria-busy={ariaBusy} className="meta-btn-setup" style={{
      padding: '12px 30px',
      background: 'rgba(0,0,0,0.5)',
      border: `1px solid ${T.neonBlue}55`,
      borderRadius: 3,
      fontFamily: T.fontJp, fontWeight: 700, fontSize: 14,
      color: T.neonBlue, letterSpacing: '0.1em',
      cursor: disabled ? 'wait' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span>{label}</span>
      {sub && (
        <span style={{ fontFamily: T.fontMono, fontSize: 10, opacity: 0.5, letterSpacing: '0.18em' }}>
          {sub}
        </span>
      )}
    </button>
  );
}

// ── SetupReady (chevron CTA) ──────────────────────────────────────────
interface ReadyProps {
  label?: string;
  sub?: string;
  onClick?: () => void;
}
export function SetupReadyButton({
  label = '推 理 開 始',
  sub = 'READY · BEGIN MATCH',
  onClick,
}: ReadyProps) {
  ensureInteractionStyles();
  return (
    <button onClick={onClick} className="meta-btn-ready" style={{
      position: 'relative',
      width: 340, height: 64,
      cursor: 'pointer',
      background: 'transparent',
      padding: 0,
      border: 'none',
    }}>
      <div style={{
        position: 'absolute', inset: -10,
        background: `radial-gradient(ellipse, ${T.gold}55, transparent 60%)`,
        filter: 'blur(8px)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.4)})`,
        border: `2px solid #f0e08a`,
        borderRadius: 4,
        clipPath: 'polygon(18px 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 18px 100%, 0 50%)',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 14px rgba(0,0,0,0.5)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <div style={{
          fontFamily: T.fontSerif, fontSize: 22, fontWeight: 900,
          color: '#1a1208', letterSpacing: '0.3em', marginRight: '-0.3em',
        }}>
          {label}
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: 'rgba(20,12,8,0.7)', letterSpacing: '0.35em' }}>
          {sub}
        </div>
      </div>
    </button>
  );
}
