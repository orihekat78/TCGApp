// spec: .claude/specs/meta-ui/16-tutorial-real-board.md
// Phase 17-C: 実対戦盤面 (src の Playmat) を読み取り専用でチュートリアル左ペインに静的描画。
// - FitScaleBox: Playmat の実描画サイズを測ってペイン幅にフィット縮小 (内部 useStageScale と二重 transform でも実測で吸収)
// - scoped zone highlight: snapshot root 内の .scene-area 等を querySelector して発光ボックスを重ねる
// すべて src/ から import — src/ には触らない。

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Playmat } from '@/ui/components/Playmat';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import '@/ui/styles/tokens.css';
import { resolveCard, resolveCase, resolveHandCard } from '../../util/tutorialResolvers';
import { T } from '../../shared/tokens';

export interface ZoneHint {
  /** Playmat 内のゾーン CSS セレクタ (例: '.scene-area.side-self') */
  selector: string;
  label: string;
}

// 盤面スナップショットは全 step 共通の populated 状態 (turn4)。表示専用。
// registerAll() 後に初回参照されるよう遅延生成 (module-load 時に engine 未登録だと困るため)。
let _snapshot: ReturnType<typeof createSampleGameState> | null = null;
function getSnapshot() {
  if (_snapshot === null) _snapshot = createSampleGameState();
  return _snapshot;
}

interface Box { top: number; left: number; width: number; height: number; key: string }

interface Props {
  zones: ZoneHint[];
  activeKey: string | null;
  /** 左ペインの実利用幅 (px)。viewer 側から渡す */
  paneWidth: number;
}

export function TutorialBoardSnapshot({ zones, activeKey, paneWidth }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState(0);
  const [boxes, setBoxes] = useState<Box[]>([]);

  const selectorKeys = useMemo(() => zones.map((z) => z.selector).join('|'), [zones]);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const recompute = (): void => {
      // inner は transform を一旦無視した自然サイズで測る (scale state は別 div に当てる)
      const naturalW = inner.scrollWidth || inner.offsetWidth;
      const naturalH = inner.scrollHeight || inner.offsetHeight;
      if (naturalW === 0) return;
      const fit = Math.min(1, paneWidth / naturalW);
      setScale(fit);
      setInnerH(naturalH * fit);

      // ゾーン強調ボックス: scoped querySelector → outer 基準の相対座標へ
      const outerRect = outer.getBoundingClientRect();
      const next: Box[] = [];
      for (const z of zones) {
        const el = inner.querySelector(z.selector) as HTMLElement | null;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        next.push({
          key: z.selector,
          top: r.top - outerRect.top,
          left: r.left - outerRect.left,
          width: r.width,
          height: r.height,
        });
      }
      setBoxes(next);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(inner);
    const raf = requestAnimationFrame(recompute);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', recompute);
    };
    // scale を依存に入れると無限ループするため除外 (recompute 内で setScale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneWidth, selectorKeys]);

  return (
    <div
      ref={outerRef}
      className="tutorial-board-snapshot"
      style={{ position: 'relative', width: paneWidth, height: innerH || undefined, overflow: 'hidden' }}
    >
      <div
        ref={innerRef}
        inert
        aria-hidden="true"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: 'max-content',
          pointerEvents: 'none', // 読み取り専用
        }}
      >
        <Playmat
          gameState={getSnapshot()}
          replayReadOnly
          resolveCard={resolveCard}
          resolveCase={resolveCase}
          resolveHandCard={resolveHandCard}
        />
      </div>

      {/* ゾーン強調ボックス */}
      {boxes.map((b) => {
        const active = b.key === activeKey;
        const dim = activeKey !== null && !active;
        return (
          <div
            key={b.key}
            data-zone={b.key}
            style={{
              position: 'absolute',
              top: b.top - 3,
              left: b.left - 3,
              width: b.width + 6,
              height: b.height + 6,
              borderRadius: 6,
              border: `2px solid ${active ? T.gold : T.neonBlue}`,
              boxShadow: active
                ? `0 0 0 3px ${T.gold}55, 0 0 18px ${T.gold}aa`
                : `0 0 10px ${T.neonBlue}66`,
              background: active ? `${T.gold}1f` : 'transparent',
              opacity: dim ? 0.28 : 1,
              transition: 'opacity 160ms, box-shadow 160ms, border-color 160ms',
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </div>
  );
}
