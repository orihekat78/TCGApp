// spec: .claude/specs/meta-ui/16-tutorial-real-board.md
// Phase 17-B (+Phase 17 refine): 実カードを拡大表示し、各パーツを region ハイライトで指し示す。
// - rects 省略 = テキストのみ (カード上に強調を描かない。例: 色 = 縁の色)
// - rects 複数 = 複数箇所を同時強調 (例: 事件レベル 先/後 の 2 箇所)
// 事件カードは横向き (116:84)。region 座標は公式実画像を Playwright で目視確定。

import { CardArt } from '@/ui/components/CardArt';
import { T } from '../../shared/tokens';

interface RegionRect { t: number; l: number; w: number; h: number }

export interface CardRegion {
  key: string;
  num: number;
  label: string;
  /** カード枠に対する正規化矩形 (%) の配列。省略/空 = テキストのみ (カード上に強調しない) */
  rects?: RegionRect[];
}

export interface CardAnnotation {
  cardNum: string;
  orientation: 'portrait' | 'landscape';
  regions: CardRegion[];
}

interface Props {
  data: CardAnnotation;
  activeKey: string | null;
  onHover: (key: string | null) => void;
  /** 表示幅 (px) */
  width: number;
}

export function AnnotatedCard({ data, activeKey, onHover, width }: Props) {
  const ratio = data.orientation === 'landscape' ? 84 / 116 : 1.4;
  const height = Math.round(width * ratio);

  return (
    <div
      className="tutorial-annotated-card"
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 8px 26px rgba(0,0,0,0.72)',
        flexShrink: 0,
      }}
    >
      <CardArt cardId={data.cardNum} alt={data.cardNum} />

      {data.regions.flatMap((r) => {
        const rects = r.rects ?? [];
        const active = r.key === activeKey;
        const dim = activeKey !== null && !active;
        return rects.map((rect, i) => (
          <div
            key={`${r.key}-${i}`}
            data-region={r.key}
            onMouseEnter={() => onHover(r.key)}
            onMouseLeave={() => onHover(null)}
            style={{
              position: 'absolute',
              top: `${rect.t}%`,
              left: `${rect.l}%`,
              width: `${rect.w}%`,
              height: `${rect.h}%`,
              border: `2px solid ${active ? T.gold : T.neonBlue}`,
              borderRadius: 4,
              background: active ? `${T.gold}26` : 'transparent',
              boxShadow: active ? `0 0 0 2px ${T.gold}66, 0 0 16px ${T.gold}` : `0 0 6px ${T.neonBlue}55`,
              opacity: dim ? 0.22 : 1,
              transition: 'opacity 150ms, box-shadow 150ms, border-color 150ms, background 150ms',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: active ? T.gold : 'rgba(0,0,0,0.82)',
                border: `1.5px solid ${T.gold}`,
                color: active ? '#1a1208' : T.gold,
                fontFamily: T.fontMono,
                fontWeight: 800,
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {r.num}
            </span>
          </div>
        ));
      })}
    </div>
  );
}

// ── ステップ別カード注釈データ (rects は公式実画像を Playwright で目視確定) ──
export const STEP_CARD_ANNOTATIONS: Record<string, CardAnnotation> = {
  // ch2-1 キャラ (D08005「灰原哀」縦 716×1000)
  'ch2-1': {
    cardNum: 'D08005',
    orientation: 'portrait',
    regions: [
      { key: 'type', num: 1, label: 'カードの種類 / コスト・Lv', rects: [{ t: 1.5, l: 3, w: 12, h: 7.5 }] },
      { key: 'color', num: 2, label: 'カードの色 — カードの縁 (フレーム) の色が色を表す (このカードは青)' },
      { key: 'name', num: 3, label: 'カード名', rects: [{ t: 1.5, l: 17, w: 50, h: 7 }] },
      { key: 'effect', num: 6, label: '能力 (効果テキスト)', rects: [{ t: 75, l: 5, w: 90, h: 13 }] },
      { key: 'ap', num: 4, label: 'AP (攻撃力)', rects: [{ t: 89, l: 55, w: 28, h: 9.5 }] },
      { key: 'lp', num: 5, label: 'LP (推理=証拠枚数)', rects: [{ t: 89, l: 85, w: 13, h: 9.5 }] },
      { key: 'no', num: 7, label: 'カードNo', rects: [{ t: 94, l: 3, w: 14, h: 3.6 }] },
    ],
  },
  // ch2-2 イベント (D11019 縦) — AP/LP なし・効果テキストが大きい
  'ch2-2': {
    cardNum: 'D11019',
    orientation: 'portrait',
    regions: [
      { key: 'type', num: 1, label: 'カードの種類 / コスト・Lv', rects: [{ t: 1.5, l: 3, w: 12, h: 7.5 }] },
      { key: 'color', num: 2, label: 'カードの色 — カードの縁 (フレーム) の色が色を表す' },
      { key: 'name', num: 3, label: 'カード名', rects: [{ t: 1.5, l: 17, w: 50, h: 7 }] },
      { key: 'effect', num: 4, label: '能力 (中央テキスト)', rects: [{ t: 64, l: 5, w: 90, h: 30 }] },
      { key: 'no', num: 5, label: 'カードNo', rects: [{ t: 94, l: 3, w: 14, h: 3.6 }] },
    ],
  },
  // ch2-3 事件 (D08026「青の古城探索事件」横向き 1000×716)
  'ch2-3': {
    cardNum: 'D08026',
    orientation: 'landscape',
    regions: [
      { key: 'type', num: 1, label: 'カードの種類 (事件)', rects: [{ t: 0, l: 7, w: 22, h: 4.5 }] },
      { key: 'color', num: 2, label: 'カードの色 — カードの縁 (フレーム) の色が色を表す' },
      { key: 'name', num: 3, label: 'カード名 (事件名)', rects: [{ t: 4, l: 9, w: 44, h: 9.5 }] },
      {
        key: 'level', num: 4, label: '事件レベル (=必要証拠数 / 先攻7・後攻6)',
        rects: [
          { t: 70, l: 0.5, w: 14, h: 17 }, // 先:7 (左下)
          { t: 67, l: 86, w: 13, h: 31 },  // 6後 (右下)
        ],
      },
      { key: 'effect', num: 5, label: '事件編 / 解決編 能力', rects: [{ t: 69, l: 15, w: 70, h: 28 }] },
    ],
  },
  // ch2-4 パートナー (D08001「江戸川コナン」縦) — 「P」マーカー / LP のみ (AP なし)
  'ch2-4': {
    cardNum: 'D08001',
    orientation: 'portrait',
    regions: [
      { key: 'type', num: 1, label: 'カードの種類 (P = パートナー)', rects: [{ t: 1.5, l: 3, w: 12, h: 7.5 }] },
      { key: 'color', num: 2, label: 'カードの色 — カードの縁 (フレーム) の色が色を表す' },
      { key: 'name', num: 3, label: 'カード名', rects: [{ t: 1.5, l: 17, w: 50, h: 7 }] },
      { key: 'effect', num: 5, label: '能力【アシスト】【事件解決】', rects: [{ t: 76, l: 5, w: 90, h: 14 }] },
      { key: 'lp', num: 4, label: 'LP (推理=証拠枚数)', rects: [{ t: 89, l: 84, w: 13, h: 9.5 }] },
      { key: 'no', num: 6, label: 'カードNo', rects: [{ t: 94, l: 3, w: 14, h: 3.6 }] },
    ],
  },
};
