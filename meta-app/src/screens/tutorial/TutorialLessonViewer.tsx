// spec: .claude/specs/meta-ui/16-tutorial-real-board.md
// Phase 17-A: ワイド2ペイン lesson viewer。
//   左ペイン = 実カード(拡大+region強調) / 実盤面スナップショット / 概念図解 を step ごとに出し分け
//   右ペイン = STEP 解説(拡大) + パーツ/ゾーン一覧(hover で左の該当箇所を pulse 強調) + ナビ
//   フッタ = 進捗ドット + 前/次へ + 対象stepの「▶ このステップを実戦で試す」

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { T, shade } from '../../shared/tokens';
import { AnnotatedCard, type CardAnnotation } from './AnnotatedCard';
import { TutorialBoardSnapshot } from './TutorialBoardSnapshot';
import { resolveCanonicalTutorialVisual } from './canonicalVisuals';
import type { TutorialChapter } from './types';

interface Props {
  chapter: TutorialChapter;
  stepIndex: number;
  onStepChange: (index: number) => void;
  onStepComplete: (stepId: string) => void;
  onClose: () => void;
  /** 選択中の正本stepからguided live matchを起動する。 */
  onStartGuided?: (stepId: string) => void;
  isStarting?: boolean;
}

export function TutorialLessonViewer({ chapter, stepIndex, onStepChange, onStepComplete, onClose, onStartGuided, isStarting = false }: Props) {
  const total = chapter.steps.length;
  const idx = Math.max(0, Math.min(stepIndex, total - 1));
  const step = chapter.steps[idx]!;
  const isLast = idx >= total - 1;
  const isFirst = idx <= 0;

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [leftW, setLeftW] = useState(0);

  const visual = resolveCanonicalTutorialVisual(step.id);
  const cardData: CardAnnotation | undefined = undefined;
  const zones = visual?.zones;
  const canGuided = Boolean(step.target && onStartGuided);

  // step 変更で hover 強調リセット
  useEffect(() => { setActiveKey(null); }, [step.id]);

  // 左ペイン実幅を測定 (board snapshot / card 幅に使用)
  useLayoutEffect(() => {
    const el = leftRef.current;
    if (!el) return;
    const measure = () => setLeftW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => { closeRef.current?.focus(); }, []);

  // キーボード操作
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
      else if (e.key === 'ArrowLeft' && !isFirst) onStepChange(idx - 1);
      else if (e.key === 'ArrowRight' && !isLast) onStepChange(idx + 1);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [idx, isFirst, isLast, onStepChange, onClose]);

  const handleNext = () => {
    onStepComplete(step.id);
    if (isLast) onClose();
    else onStepChange(idx + 1);
  };

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusable?.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // 右ペインの「パーツ/ゾーン一覧」項目
  const listItems = cardData
    ? cardData.regions.map((r) => ({ key: r.key, num: r.num, label: r.label }))
    : zones
      ? zones.map((z, i) => ({ key: z.selector, num: i + 1, label: z.label }))
      : [];

  const cardWidth = cardData
    ? Math.min(leftW - 48, cardData.orientation === 'landscape' ? 560 : 360)
    : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="チュートリアル解説"
      onClick={onClose}
      onKeyDownCapture={trapFocus}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.84)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontJp, color: T.textPrimary,
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="meta-fade"
        style={{
          width: 'min(1280px, 97vw)', maxHeight: '94vh',
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(180deg, rgba(10,26,40,0.98), rgba(5,16,28,0.98))',
          border: `1px solid ${T.gold}66`, borderRadius: 8,
          boxShadow: `0 0 60px rgba(255,215,0,0.18), 0 24px 60px rgba(0,0,0,0.7)`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px',
          borderBottom: `1px solid rgba(78,195,255,0.2)`, background: 'rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.28em' }}>
            LESSON {chapter.id}
          </span>
          <span style={{ fontFamily: T.fontJp, fontSize: 13, fontWeight: 700, color: T.textSecondary }}>
            {chapter.title}
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 12, fontWeight: 800, color: T.gold, letterSpacing: '0.1em' }}>
            ステップ {idx + 1} / {total}
          </span>
          <button ref={closeRef} onClick={onClose} aria-label="閉じる" style={{
            width: 44, height: 44, marginLeft: 8,
            background: 'rgba(0,0,0,0.5)', border: `1px solid ${T.textMuted}66`, borderRadius: 4,
            color: T.textSecondary, fontSize: 16, cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        </div>

        {/* Body — 2 ペイン (狭幅は wrap で縦積み) */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
          {/* 左ペイン */}
          <div
            ref={leftRef}
            style={{
              flex: '1 1 54%', minWidth: 320,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px 22px', background: 'rgba(0,0,0,0.28)',
              borderRight: `1px solid rgba(78,195,255,0.12)`,
            }}
          >
            {cardData ? (
              <AnnotatedCard data={cardData} activeKey={activeKey} onHover={setActiveKey} width={Math.max(160, cardWidth)} />
            ) : zones && leftW > 0 ? (
              <TutorialBoardSnapshot zones={zones} activeKey={activeKey} paneWidth={Math.max(200, leftW - 44)} />
            ) : (
              <div style={{ width: '100%' }}>{visual?.illustration}</div>
            )}
          </div>

          {/* 右ペイン */}
          <div style={{ flex: '1 1 40%', minWidth: 300, padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.3em' }}>STEP {step.num}</div>
            <h2 style={{
              fontFamily: T.fontSerif, fontSize: 27, fontWeight: 800,
              color: T.textPrimary, letterSpacing: '0.06em', margin: '5px 0 16px',
            }}>{step.title}</h2>

            {/* 拡大本文 */}
            <div style={{
              padding: '18px 20px', background: 'rgba(0,0,0,0.4)',
              border: `1px solid rgba(78,195,255,0.2)`, borderRadius: 6,
              fontSize: 15, color: T.textPrimary, lineHeight: 1.85,
            }}>
              {step.body}
            </div>

            {/* パーツ / ゾーン一覧 (hover で左の該当箇所を強調) */}
            {listItems.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.neonBlue, letterSpacing: '0.24em', marginBottom: 8 }}>
                  {cardData ? '番号と対応する位置 (カーソルを合わせると強調)' : 'ゾーン (カーソルを合わせると強調)'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {listItems.map((it) => {
                    const active = it.key === activeKey;
                    return (
                      <button
                        type="button"
                        key={it.key}
                        onMouseEnter={() => setActiveKey(it.key)}
                        onMouseLeave={() => setActiveKey(null)}
                        onFocus={() => setActiveKey(it.key)}
                        onBlur={() => setActiveKey(null)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                          minHeight: 44, padding: '8px 9px', borderRadius: 4, cursor: 'pointer',
                          background: active ? `${T.gold}1f` : 'rgba(0,0,0,0.3)',
                          border: `1px solid ${active ? T.gold : 'rgba(78,195,255,0.18)'}`,
                          color: 'inherit', textAlign: 'left', font: 'inherit',
                          transition: 'background 140ms, border-color 140ms',
                        }}
                      >
                        <span style={{
                          width: 20, height: 20, flexShrink: 0, borderRadius: '50%',
                          background: active ? T.gold : 'rgba(0,0,0,0.6)',
                          border: `1.5px solid ${T.gold}`, color: active ? '#1a1208' : T.gold,
                          fontFamily: T.fontMono, fontWeight: 800, fontSize: 11,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                        }}>{it.num}</span>
                        <span style={{ fontSize: 12.5, color: active ? T.textPrimary : T.textSecondary, lineHeight: 1.4 }}>{it.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 20px',
          borderTop: `1px solid rgba(78,195,255,0.2)`, background: 'rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', gap: 7 }}>
            {chapter.steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => onStepChange(i)}
                aria-label={`ステップ ${i + 1}`}
                aria-current={i === idx ? 'step' : undefined}
                style={{
                width: 44, height: 44, borderRadius: 5,
                background: i === idx ? T.gold : 'rgba(255,255,255,0.25)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'background 160ms',
                }}
              />
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            {canGuided && (
              <button
                onClick={() => onStartGuided!(step.id)}
                disabled={isStarting}
                aria-busy={isStarting}
                style={{
                  minHeight: 44, padding: '9px 16px',
                  background: 'rgba(58,166,122,0.18)', border: `1px solid ${T.green}`,
                  color: T.green, fontFamily: T.fontJp, fontSize: 13, fontWeight: 800, letterSpacing: '0.06em',
                  borderRadius: 4, cursor: 'pointer',
                }}
              >▶ このステップを実戦で試す</button>
            )}
            <button onClick={() => onStepChange(idx - 1)} disabled={isFirst} style={{
              minHeight: 44, padding: '9px 18px',
              background: isFirst ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
              border: `1px solid ${isFirst ? T.textDisabled : T.neonBlue}55`,
              color: isFirst ? T.textDisabled : T.neonBlue,
              fontFamily: T.fontJp, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
              borderRadius: 4, cursor: isFirst ? 'not-allowed' : 'pointer',
            }}>← 前</button>
            <button onClick={handleNext} style={{
              minHeight: 44, padding: '9px 22px',
              background: `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.35)})`,
              border: `1px solid ${shade(T.gold, -0.5)}`, color: '#1a1208',
              fontFamily: T.fontJp, fontSize: 13, fontWeight: 800, letterSpacing: '0.1em',
              borderRadius: 4, cursor: 'pointer', boxShadow: `0 0 14px ${T.gold}44`,
            }}>{isLast ? '章を完了 ✓' : '次へ →'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
