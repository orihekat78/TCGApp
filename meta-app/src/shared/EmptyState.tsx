// spec: .claude/specs/meta-ui/02-design-system.md
// 原典: design-mockups_v2/06-shared.jsx の EmptyState + EmptyIcon

import { T } from './tokens';
import { ensureInteractionStyles } from './interactionStyles';

export type EmptyIconKind = 'box' | 'deck' | 'history' | 'search' | 'card' | 'offline';
export type EmptyTone = 'muted' | 'warn' | 'error';

interface Props {
  icon?: EmptyIconKind;
  title?: string;
  body?: string;
  cta?: string;
  onCta?: () => void;
  tone?: EmptyTone;
}

export function EmptyState({
  icon = 'box', title, body, cta, onCta, tone = 'muted',
}: Props) {
  ensureInteractionStyles();
  const accent = tone === 'warn' ? T.gold : tone === 'error' ? T.red : T.textMuted;
  return (
    <div style={{
      flex: 1,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', gap: 14,
      textAlign: 'center',
      color: T.textMuted,
    }}>
      <div style={{
        width: 72, height: 72,
        border: `1.5px dashed ${accent}66`,
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(circle, ${accent}11, transparent 70%)`,
      }}>
        <EmptyIcon kind={icon} color={accent} />
      </div>
      {title && (
        <div style={{
          fontFamily: T.fontSerif, fontSize: 16, fontWeight: 700,
          color: T.textSecondary, letterSpacing: '0.06em',
        }}>{title}</div>
      )}
      {body && (
        <div style={{ fontSize: 12, color: T.textMuted, maxWidth: 280, lineHeight: 1.5 }}>{body}</div>
      )}
      {cta && (
        <button onClick={onCta} className="meta-btn-small" style={{
          marginTop: 4,
          padding: '6px 16px',
          background: `${T.gold}22`,
          border: `1px solid ${T.gold}88`,
          borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
          color: T.gold, letterSpacing: '0.18em',
          cursor: 'pointer',
        }}>{cta}</button>
      )}
    </div>
  );
}

function EmptyIcon({ kind, color }: { kind: EmptyIconKind; color: string }) {
  switch (kind) {
    case 'deck':
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="8" y="4" width="20" height="28" rx="2" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="13" y1="14" x2="23" y2="14" stroke={color} strokeWidth="1" opacity="0.5" />
          <line x1="13" y1="20" x2="23" y2="20" stroke={color} strokeWidth="1" opacity="0.5" />
          <line x1="13" y1="26" x2="20" y2="26" stroke={color} strokeWidth="1" opacity="0.5" />
        </svg>
      );
    case 'history':
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="13" stroke={color} strokeWidth="1.5" />
          <path d="M18 9 L18 18 L24 22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'search':
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="15" cy="15" r="9" stroke={color} strokeWidth="1.5" />
          <line x1="22" y1="22" x2="30" y2="30" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="11" y1="15" x2="19" y2="15" stroke={color} strokeWidth="1" opacity="0.5" />
        </svg>
      );
    case 'card':
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="10" y="6" width="16" height="24" rx="2" stroke={color} strokeWidth="1.5" />
          <line x1="14" y1="14" x2="22" y2="14" stroke={color} strokeWidth="0.8" opacity="0.5" />
        </svg>
      );
    case 'offline':
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M6 14 Q18 6 30 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 19 Q18 14 26 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <path d="M14 24 Q18 22 22 24" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
          <circle cx="18" cy="29" r="1.5" fill={color} />
          <line x1="6" y1="6" x2="30" y2="30" stroke={color} strokeWidth="2" />
        </svg>
      );
    case 'box':
    default:
      return (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M6 12 L18 6 L30 12 L30 26 L18 32 L6 26 Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M6 12 L18 18 L30 12" stroke={color} strokeWidth="1.5" />
          <line x1="18" y1="18" x2="18" y2="32" stroke={color} strokeWidth="1.5" />
        </svg>
      );
  }
}
