// spec: .claude/specs/meta-ui/02-design-system.md
// 原典: design-mockups_v2/06-shared.jsx の LoadingDots
// keyframe `meta-pulse` は interactionStyles.ts に統合済

import { T } from './tokens';
import { ensureInteractionStyles } from './interactionStyles';

interface Props {
  label?: string;
  color?: string;
}

export function LoadingDots({ label = '読み込み中', color = T.gold }: Props) {
  ensureInteractionStyles();
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="meta-loading-dot" style={{
            width: 6, height: 6, borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            animationDelay: `${i * 0.16}s`,
          }} />
        ))}
      </div>
      {label && (
        <span style={{
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
          color, letterSpacing: '0.18em',
        }}>{label}</span>
      )}
    </div>
  );
}
