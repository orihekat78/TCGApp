// spec: .claude/specs/meta-ui/02-design-system.md + 07-screens-library.md
// 原典: design-mockups_v2/06-shared.jsx の FilterGroup

import { T } from './tokens';
import { ensureInteractionStyles } from './interactionStyles';

export interface FilterItem {
  label: string;
  c: string;
  active?: boolean;
  n?: number;
  /** 他フィルタ適用後に 0 件 = 選んでも結果が無い option。グレーアウト + クリック不可。 */
  disabled?: boolean;
  onClick?: () => void;
}

interface Props {
  label: string;
  items: FilterItem[];
  small?: boolean;
  showCounts?: boolean;
  hideDisabled?: boolean;
}

export function FilterGroup({ label, items, small = false, showCounts = true, hideDisabled = false }: Props) {
  ensureInteractionStyles();
  const visibleItems = hideDisabled ? items.filter((item) => !item.disabled || item.active) : items;
  if (visibleItems.length === 0) return null;
  return (
    <div>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {visibleItems.map((it, i) => (
          <button key={i}
            onClick={it.disabled ? undefined : it.onClick}
            disabled={it.disabled}
            aria-pressed={it.active === undefined ? undefined : it.active}
            className="meta-chip"
            style={{
              padding: small ? '3px 7px' : '4px 8px',
              background: it.active ? `${it.c}33` : 'rgba(0,0,0,0.3)',
              border: `1px solid ${it.active ? it.c : `${it.c}33`}`,
              borderRadius: 2,
              display: 'flex', alignItems: 'center', gap: 5,
              cursor: it.disabled ? 'not-allowed' : 'pointer',
              opacity: it.disabled ? 0.3 : 1,
            }}>
            <div style={{
              fontSize: 11,
              fontWeight: it.active ? 700 : 500,
              color: it.active ? it.c : T.textMuted,
            }}>
              {it.label}
            </div>
            {showCounts && it.n != null && (
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
