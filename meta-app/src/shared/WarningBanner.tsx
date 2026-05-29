// spec: .claude/specs/meta-ui/02-design-system.md + 07-screens-library.md
// 原典: design-mockups_v2/06-shared.jsx の WarningBanner
// DECK 編集の validateDeck 結果表示で使用される

import { T } from './tokens';

export type BannerTone = 'warn' | 'error' | 'info';

interface Props {
  tone?: BannerTone;
  title?: string;
  body?: string;
  items?: string[];
}

export function WarningBanner({ tone = 'warn', title, body, items }: Props) {
  const accent = tone === 'error' ? T.red : tone === 'info' ? T.neonBlue : T.gold;
  const tonedBg =
    tone === 'error' ? 'rgba(200,64,64,0.10)'
    : tone === 'info' ? 'rgba(78,195,255,0.08)'
    : 'rgba(255,215,0,0.08)';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px',
      background: tonedBg,
      border: `1px solid ${accent}77`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 3,
    }}>
      <div style={{
        width: 22, height: 22, flexShrink: 0,
        background: accent, color: '#0a1a28',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontSerif, fontWeight: 900, fontSize: 14,
      }}>!</div>
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.45 }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 10,
          color: accent, letterSpacing: '0.2em',
          marginBottom: 2,
        }}>{tone.toUpperCase()}</div>
        {title && <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{title}</div>}
        {body && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{body}</div>}
        {items && items.length > 0 && (
          <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 11, color: T.textSecondary, lineHeight: 1.6 }}>
            {items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
