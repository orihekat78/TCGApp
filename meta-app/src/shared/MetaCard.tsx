// spec: .claude/specs/meta-ui/02-design-system.md + 13-implementations.md
// Phase 14-pre: chrome (グラデーション / 上部ストライプ / 下部フッター / 色枠) を削除
// 対戦画面では src/ の CardArt がそのまま使われる。メタ画面では CardArt 素表示 + overlay のみ。
//
// 残す要素:
//   - selected outline (gold ring)
//   - count badge (右上 ×N)
//   - favorited star (右上 ★)
//   - partner / case badge (左上 小ラベル)

import { T } from './tokens';
import type { CardDef } from '../data/types';
import { ensureInteractionStyles } from './interactionStyles';
import { CardArt } from '@/ui/components/CardArt';

interface Props {
  card: CardDef;
  w?: number;
  selected?: boolean;
  dimmed?: boolean;
  count?: number;
  onClick?: () => void;
  hoverable?: boolean;
  badge?: 'partner' | 'case' | string;
  isFavorited?: boolean;
}

export function MetaCard({
  card, w = 90, selected = false, dimmed = false,
  count, onClick, hoverable = true, badge, isFavorited = false,
}: Props) {
  ensureInteractionStyles();
  const h = Math.round(w * 1.4);
  return (
    <div
      onClick={onClick}
      className={hoverable ? 'meta-card-hover' : undefined}
      style={{
        position: 'relative',
        width: w, height: h,
        borderRadius: w >= 90 ? 6 : 4,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        outline: selected ? `2.5px solid ${T.gold}` : 'none',
        outlineOffset: 1,
        opacity: dimmed ? 0.42 : 1,
        boxShadow: selected
          ? `0 0 14px ${T.gold}88, 0 4px 10px rgba(0,0,0,0.55)`
          : '0 3px 8px rgba(0,0,0,0.55)',
        flexShrink: 0,
        background: '#0a1a28',
      }}
    >
      {/* 素の CardArt のみ。chrome (色枠/グラデ/ストライプ/フッター) は廃止 */}
      <CardArt cardId={card.num} alt={card.name} className="meta-card-art" />

      {/* ---- Overlays (対戦画面では使われないので残す) ---- */}

      {count != null && (
        <div style={{
          position: 'absolute', right: -4, top: -4,
          minWidth: 22, height: 22,
          padding: '0 5px',
          background: count > 3 ? T.red : T.gold,
          color: count > 3 ? '#fff' : '#1a1208',
          borderRadius: 11,
          border: `1.5px solid ${T.bgDeep}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
        }}>
          ×{count}
        </div>
      )}

      {badge && (
        <div style={{
          position: 'absolute', left: 4, top: 4,
          padding: '2px 5px',
          background: badge === 'partner' ? T.gold : 'rgba(0,0,0,0.7)',
          color: badge === 'partner' ? '#1a1208' : T.neonYellow,
          fontFamily: T.fontMono, fontSize: 8, fontWeight: 800,
          letterSpacing: '0.1em',
          borderRadius: 2,
        }}>
          {badge.toUpperCase()}
        </div>
      )}

      {isFavorited && (
        <div style={{
          position: 'absolute',
          right: count != null ? 22 : 4,
          top: 4,
          fontSize: w >= 90 ? 16 : 12,
          color: T.gold,
          textShadow: `0 0 6px ${T.gold}88, 0 1px 2px rgba(0,0,0,0.9)`,
          lineHeight: 1, pointerEvents: 'none',
        }}>
          ★
        </div>
      )}
    </div>
  );
}
