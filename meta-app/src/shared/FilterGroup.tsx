// spec: .claude/specs/meta-ui/02-design-system.md + 07-screens-library.md
// 原典: design-mockups_v2/06-shared.jsx の FilterGroup

import { T } from './tokens';
import { ensureInteractionStyles } from './interactionStyles';

export interface FilterItem {
  label: string;
  c: string;
  active?: boolean;
  n?: number;
  onClick?: () => void;
}

interface Props {
  label: string;
  items: FilterItem[];
  small?: boolean;
}

export function FilterGroup({ label, items, small = false }: Props) {
  ensureInteractionStyles();
  return (
    <div>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {items.map((it, i) => (
          <button key={i}
            onClick={it.onClick}
            className="meta-chip"
            style={{
              padding: small ? '3px 7px' : '4px 8px',
              background: it.active ? `${it.c}33` : 'rgba(0,0,0,0.3)',
              border: `1px solid ${it.active ? it.c : `${it.c}33`}`,
              borderRadius: 2,
              display: 'flex', alignItems: 'center', gap: 5,
              cursor: 'pointer',
            }}>
            <div style={{
              fontSize: 11,
              fontWeight: it.active ? 700 : 500,
              color: it.active ? it.c : T.textMuted,
            }}>
              {it.label}
            </div>
            {it.n != null && (
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: it.active ? it.c : T.textDisabled, opacity: 0.7 }}>
                {it.n}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
