// spec: .claude/specs/meta-ui/02-design-system.md + 13-implementations.md
// Phase 14-pre: chrome (グラデーション / 上部ストライプ / 下部フッター / 色枠) を削除
// 対戦画面では src/ の CardArt がそのまま使われる。メタ画面では CardArt 素表示 + overlay のみ。
// Phase 18: キーボード a11y / 同 ID 上限到達 (atMax) のグレーアウト / double-click・right-click 対応
//
// 残す要素:
//   - selected outline (gold ring)
//   - count badge (右上 ×N / 上限超過は赤)
//   - atMax overlay (上限到達: 減光 + MAX タグ)
//   - favorited star (右上 ★)
//   - partner / case badge (左上 小ラベル)

import { T } from './tokens';
import type { CardDef } from '../data/types';
import { ensureInteractionStyles } from './interactionStyles';
import { CardArt } from '@/ui/components/CardArt';
import { useCardOrientation } from '@/ui/hooks/useCardOrientation';

interface Props {
  card: CardDef;
  w?: number;
  selected?: boolean;
  dimmed?: boolean;
  count?: number;
  /** 同 ID 上限 (count バッジの "/N" と超過判定に使用、既定 3)。 */
  maxCount?: number;
  /** count バッジを "n/N" 形式 (デッキ枚数) で出す。false なら "×n" (採用数など)。 */
  showMax?: boolean;
  /** 同 ID 上限に到達して追加不可 (グレーアウト + MAX タグ)。 */
  atMax?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  /** 右クリック。指定時は既定のコンテキストメニューを抑止する。 */
  onContextMenu?: () => void;
  hoverable?: boolean;
  badge?: 'partner' | 'case' | string;
  isFavorited?: boolean;
}

export function MetaCard({
  card, w = 90, selected = false, dimmed = false,
  count, maxCount = 3, showMax = false, atMax = false,
  onClick, onDoubleClick, onContextMenu,
  hoverable = true, badge, isFavorited = false,
}: Props) {
  ensureInteractionStyles();
  // 事件カードは縦/横 (portrait/landscape) が混在する (rules/06 + Phase 9-D)。
  // 画像の natural サイズで向きを検出し、横向き時はタイル比率を landscape (≈116:84) に切替。
  // 検出は case カードのみ (非 case は null を渡して Image 読込を行わない = 大量カードでも軽量)。
  const isCase = card.type === 'case';
  const orient = useCardOrientation(isCase ? card.num : null);
  const landscape = isCase && orient === 'landscape';
  const h = landscape ? Math.round(w * 0.72) : Math.round(w * 1.4);
  const interactive = !!(onClick || onDoubleClick);
  const over = showMax && count != null && count > maxCount;
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(); } : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      } : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={onClick ? selected : undefined}
      aria-label={count != null ? `${card.name} ${count}/${maxCount}` : card.name}
      className={hoverable ? 'meta-card-hover' : undefined}
      style={{
        position: 'relative',
        width: w, height: h,
        borderRadius: w >= 90 ? 6 : 4,
        overflow: 'hidden',
        cursor: interactive ? 'pointer' : 'default',
        outline: selected ? `2.5px solid ${T.gold}` : 'none',
        outlineOffset: 1,
        opacity: dimmed ? 0.42 : atMax ? 0.6 : 1,
        boxShadow: selected
          ? `0 0 14px ${T.gold}88, 0 4px 10px rgba(0,0,0,0.55)`
          : '0 3px 8px rgba(0,0,0,0.55)',
        flexShrink: 0,
        background: '#0a1a28',
      }}
    >
      {/* 素の CardArt のみ。chrome (色枠/グラデ/ストライプ/フッター) は廃止。
          事件カードは縦/横どちらも見切れないよう object-fit:contain (--contain)。 */}
      <CardArt
        cardId={card.num}
        alt={card.name}
        className={isCase ? 'meta-card-art meta-card-art--contain' : 'meta-card-art'}
      />

      {/* ---- atMax: 上限到達のグレーアウト + MAX タグ ---- */}
      {atMax && !over && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,18,30,0.45)', pointerEvents: 'none' }} />
          <div style={{
            position: 'absolute', left: '50%', bottom: 6, transform: 'translateX(-50%)',
            padding: '1px 8px', background: T.gold, color: '#1a1208',
            fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, letterSpacing: '0.16em',
            borderRadius: 2, pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>MAX 3</div>
        </>
      )}

      {/* ---- Overlays (対戦画面では使われないので残す) ---- */}

      {count != null && (
        <div style={{
          position: 'absolute', right: -4, top: -4,
          minWidth: 24, height: 22,
          padding: '0 5px',
          background: over ? T.red : atMax ? T.gold : `${T.gold}`,
          color: over ? '#fff' : '#1a1208',
          borderRadius: 11,
          border: `1.5px solid ${T.bgDeep}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
        }}>
          {showMax ? `${count}/${maxCount}` : `×${count}`}
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
          right: count != null ? 26 : 4,
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
