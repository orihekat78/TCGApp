// spec: .claude/specs/meta-ui/14-tutorial-complete.md + 15-tutorial-lesson-viewer.md
// Phase 16-C: ハブ (章リスト + ステップカード + 章概要) + ステップクリックで LessonViewer 起動
// 公式「初めての方へ」(beginner) + ルールマニュアル Ver 2.4 参照

import { useEffect, useMemo, useRef, useState } from 'react';
import './TutorialScreen.css';
import { T, shade } from '../shared/tokens';
import { PrimaryHeader } from '../shared/PrimaryHeader';
import { SetupButton } from '../shared/Button';
import { matchMetaSessionId, useMetaStore } from '../state/metaStore';
import { useGameStateStore } from '@/ui/state/store';
import { useDecksStore } from '../state/decksStore';
import { customGameStart } from '../util/customGameStart';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../data/sampleDeck';
import { captureMatchDeckSnapshot } from '../data/matchDeckSnapshot';
import type { Route } from '../router/routes';
import type { TutorialChapter } from './tutorial/types';
import { PRACTICE_STEP_ID, TUTORIAL_CHAPTERS } from './tutorial/curriculum';
import { TutorialLessonViewer } from './tutorial/TutorialLessonViewer';
import { useTutorialStore } from '@/ui/state/tutorialStore';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps';
import { beginMatchSession, commitMatchSession, endMatchSession, isCurrentMatchSession } from '@/ui/services/matchSession';

interface Props {
  onNav: (r: Route) => void;
}

export { TUTORIAL_CHAPTERS } from './tutorial/curriculum';

function isChapterCleared(chapter: TutorialChapter, cleared: Set<string>): boolean {
  return chapter.steps.every((s) => cleared.has(s.id));
}

interface ViewerState { chapterNum: number; stepIndex: number }

export function TutorialScreen({ onNav }: Props) {
  const clearedIds = useMetaStore((s) => s.settings.tutorialClearedStepIds ?? []);
  const markStepCleared = useMetaStore((s) => s.markStepCleared);
  const startPracticeFor = useMetaStore((s) => s.startPracticeFor);
  const startError = useMetaStore((s) => s._setupStartError);
  const setStartError = useMetaStore((s) => s.setSetupStartError);
  const decks = useDecksStore((s) => s.decks);
  const [chapterNum, setChapterNum] = useState(0);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const startInFlightRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const retryRef = useRef<HTMLButtonElement>(null);

  const clearedSet = useMemo(() => new Set(clearedIds), [clearedIds]);
  const current = TUTORIAL_CHAPTERS.find((c) => c.num === chapterNum) ?? TUTORIAL_CHAPTERS[0]!;
  const totalSteps = TUTORIAL_CHAPTERS.reduce((s, c) => s + c.steps.length, 0);
  const clearedCount = clearedIds.length;

  const openViewer = (chNum: number, stepIndex: number, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    setViewer({ chapterNum: chNum, stepIndex });
  };

  const closeViewer = () => setViewer(null);

  useEffect(() => {
    if (viewer) return;
    returnFocusRef.current?.focus();
  }, [viewer]);

  useEffect(() => { if (startError) retryRef.current?.focus(); }, [startError]);

  const claimStart = (): boolean => {
    if (startInFlightRef.current) return false;
    startInFlightRef.current = true;
    setIsStarting(true);
    return true;
  };

  const releaseStart = () => {
    startInFlightRef.current = false;
    setIsStarting(false);
  };

  const startPractice = () => {
    if (!claimStart()) return;
    setStartError(null);
    const self = decks.find((d) => d.id === 'sample-d08') ?? { ...SAMPLE_DECK, modified: Date.now() };
    const opp = decks.find((d) => d.id === 'sample-d11') ?? { ...SAMPLE_DECK_OPP, modified: Date.now() };
    const meta = useMetaStore.getState();
    meta.clearMatchMeta();
    meta.clearPendingPractice();
    const session = beginMatchSession('self');
    const sessionId = matchMetaSessionId(session);
    meta.setMatchMeta({
      sessionId, mode: 'solo', selfDeckName: self.name, oppDeckName: opp.name,
      selfDeckSnapshot: captureMatchDeckSnapshot(self),
      oppDeckSnapshot: captureMatchDeckSnapshot(opp),
    });
    useGameStateStore.getState().setSpectatorMode(false);
    useGameStateStore.getState().setAiSpeedMs(400);
    useTutorialStore.getState().exit(); // 通常の練習試合はガイド overlay を出さない
    startPracticeFor(PRACTICE_STEP_ID);
    onNav('match');
    customGameStart(self, opp, { sessionId, isSessionCurrent: () => isCurrentMatchSession(session) })
      .then((gs) => {
        if (!commitMatchSession(session, gs) && isCurrentMatchSession(session)) {
          throw new Error('チュートリアル対戦の状態を読み込めませんでした。');
        }
      })
      .catch((err: unknown) => {
        if (!isCurrentMatchSession(session)) return;
        console.error('[Phase 16] practice match failed:', err);
        endMatchSession();
        const failedMeta = useMetaStore.getState();
        failedMeta.clearMatchMeta();
        failedMeta.clearPendingPractice();
        releaseStart();
        setStartError('チュートリアル対戦を開始できませんでした。もう一度開始してください。');
        onNav('tutorial');
      });
  };

  // 選択した正本stepと同じ位置から、実盤面のTutorialOverlayを開始する。
  const startGuided = (stepId: string) => {
    const tutorialStepIndex = TUTORIAL_STEPS.findIndex((step) => step.id === stepId);
    if (tutorialStepIndex < 0) {
      setStartError('選択したチュートリアルを開始できませんでした。');
      return;
    }
    if (!claimStart()) return;
    setStartError(null);
    const self = decks.find((d) => d.id === 'sample-d08') ?? { ...SAMPLE_DECK, modified: Date.now() };
    const opp = decks.find((d) => d.id === 'sample-d11') ?? { ...SAMPLE_DECK_OPP, modified: Date.now() };
    setViewer(null);
    const meta = useMetaStore.getState();
    meta.clearMatchMeta();
    meta.clearPendingPractice();
    const session = beginMatchSession('self');
    const sessionId = matchMetaSessionId(session);
    meta.setMatchMeta({
      sessionId, mode: 'solo', selfDeckName: self.name, oppDeckName: opp.name,
      selfDeckSnapshot: captureMatchDeckSnapshot(self),
      oppDeckSnapshot: captureMatchDeckSnapshot(opp),
    });
    useGameStateStore.getState().setSpectatorMode(false);
    useGameStateStore.getState().setAiSpeedMs(400);
    useTutorialStore.setState({ currentStep: tutorialStepIndex });
    onNav('match');
    customGameStart(self, opp, { sessionId, isSessionCurrent: () => isCurrentMatchSession(session) })
      .then((gs) => {
        if (!commitMatchSession(session, gs) && isCurrentMatchSession(session)) {
          throw new Error('ガイド対戦の状態を読み込めませんでした。');
        }
      })
      .catch((err: unknown) => {
        if (!isCurrentMatchSession(session)) return;
        console.error('[Phase 17] guided match failed:', err);
        endMatchSession();
        const failedMeta = useMetaStore.getState();
        failedMeta.clearMatchMeta();
        failedMeta.clearPendingPractice();
        useTutorialStore.getState().exit();
        releaseStart();
        setStartError('ガイド対戦を開始できませんでした。もう一度開始してください。');
        onNav('tutorial');
      });
  };

  const viewerChapter = viewer ? TUTORIAL_CHAPTERS.find((c) => c.num === viewer.chapterNum) : null;

  return (
    <div className="tutorial-screen" style={{ fontFamily: T.fontJp, color: T.textPrimary }}>
      <PrimaryHeader current="tutorial" onNav={onNav} />
      <SubToolbar cleared={clearedCount} total={totalSteps} onPractice={startPractice} isStarting={isStarting} />
      {startError && (
        <div className="tutorial-start-error" role="alert">
          <span>{startError}</span>
          <button ref={retryRef} data-tutorial-retry type="button" disabled={isStarting} aria-busy={isStarting} onClick={startPractice}>もう一度開始</button>
        </div>
      )}

      <div className="tutorial-workspace">
        <div className="tutorial-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
          <ChapterProgress cleared={clearedCount} total={totalSteps} />
          <ChapterList chapters={TUTORIAL_CHAPTERS} active={chapterNum} cleared={clearedSet} onSelect={setChapterNum} />
        </div>

        <StepCardList chapter={current} cleared={clearedSet} onOpenStep={(i, trigger) => openViewer(current.num, i, trigger)} />

        <ChapterSummary chapter={current} cleared={clearedSet} onStart={(trigger) => openViewer(current.num, 0, trigger)} />
      </div>

      {viewer && viewerChapter && (
        <TutorialLessonViewer
          chapter={viewerChapter}
          stepIndex={viewer.stepIndex}
          onStepChange={(i) => setViewer({ chapterNum: viewer.chapterNum, stepIndex: i })}
          onStepComplete={(stepId) => markStepCleared(stepId)}
          onClose={closeViewer}
          onStartGuided={startGuided}
          isStarting={isStarting}
        />
      )}
    </div>
  );
}

// ---- SubToolbar ----

function SubToolbar({ cleared, total, onPractice, isStarting }: {
  cleared: number;
  total: number;
  onPractice: () => void;
  isStarting: boolean;
}) {
  const pct = total > 0 ? (cleared / total) * 100 : 0;
  return (
    <div className="tutorial-toolbar">
      <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>TUTORIAL</span>
      <span style={{ fontFamily: T.fontSerif, fontSize: 20, fontWeight: 800, marginLeft: 12, letterSpacing: '0.06em' }}>探偵学校</span>
      <div style={{ marginLeft: 24, flex: 1, maxWidth: 460, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>進捗</span>
        <div style={{ flex: 1, height: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: `linear-gradient(90deg, ${T.gold}, ${shade(T.gold, 0.2)})`,
            boxShadow: `0 0 8px ${T.gold}55`, transition: 'width 200ms',
          }} />
        </div>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, color: T.gold, letterSpacing: '0.1em' }}>
          {cleared} / {total}
        </span>
      </div>
      <div style={{ marginLeft: 'auto' }}>
        <SetupButton label="練習試合" sub="PRACTICE" onClick={onPractice} disabled={isStarting} ariaBusy={isStarting} />
      </div>
    </div>
  );
}

// ---- Chapter progress (rank) ----

function ChapterProgress({ cleared, total }: { cleared: number; total: number }) {
  const ranks = [
    { name: '見習い探偵', threshold: 0 },
    { name: '助手', threshold: Math.ceil(total * 0.25) },
    { name: '探偵', threshold: Math.ceil(total * 0.5) },
    { name: '名探偵', threshold: Math.ceil(total * 0.75) },
    { name: '伝説の探偵', threshold: total },
  ];
  const currentRank = [...ranks].reverse().find((r) => cleared >= r.threshold) ?? ranks[0]!;
  const nextRank = ranks.find((r) => r.threshold > cleared);
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, letterSpacing: '0.28em' }}>RANK</div>
      <div style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, color: T.textPrimary, marginTop: 4 }}>
        {currentRank.name}
      </div>
      {nextRank && (
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em', marginTop: 4 }}>
          次: {nextRank.name} まで {nextRank.threshold - cleared} step
        </div>
      )}
    </div>
  );
}

// ---- Chapter list ----

function ChapterList({ chapters, active, cleared, onSelect }: {
  chapters: TutorialChapter[]; active: number; cleared: Set<string>; onSelect: (n: number) => void;
}) {
  const beginner = chapters.filter((c) => c.group === 'beginner');
  const advanced = chapters.filter((c) => c.group === 'advanced');
  return (
    <div style={{
      flex: 1,
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4, overflow: 'auto',
    }}>
      <GroupLabel>基礎 L0〜L5</GroupLabel>
      {beginner.map((ch) => (
        <ChapterRow key={ch.num} chapter={ch} active={ch.num === active}
          chapterCleared={isChapterCleared(ch, cleared)} onClick={() => onSelect(ch.num)} />
      ))}
      <GroupLabel>応用 L6〜L13</GroupLabel>
      {advanced.map((ch) => (
        <ChapterRow key={ch.num} chapter={ch} active={ch.num === active}
          chapterCleared={isChapterCleared(ch, cleared)} onClick={() => onSelect(ch.num)} />
      ))}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '10px 14px 6px',
      fontFamily: T.fontMono, fontSize: 10, color: T.gold,
      letterSpacing: '0.24em', borderTop: '1px solid rgba(78,195,255,0.08)',
    }}>{children}</div>
  );
}

function ChapterRow({ chapter, active, chapterCleared, onClick }: {
  chapter: TutorialChapter; active: boolean; chapterCleared: boolean; onClick: () => void;
}) {
  const accent = chapterCleared ? T.green : T.gold;
  return (
    <button onClick={onClick} className="meta-row" aria-pressed={active} style={{
      width: '100%', textAlign: 'left', padding: '11px 14px',
      background: active ? 'rgba(255,215,0,0.10)' : 'transparent',
      border: 'none', borderBottom: '1px solid rgba(78,195,255,0.08)',
      cursor: 'pointer', color: T.textPrimary,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 30, height: 30, flexShrink: 0,
        background: `linear-gradient(135deg, ${accent}, ${shade(accent, -0.4)})`,
        border: `1.5px solid ${shade(accent, 0.2)}`, borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontSerif, fontWeight: 800, fontSize: 14, color: '#1a1208',
        boxShadow: `0 0 10px ${accent}33`,
      }}>
        {chapterCleared ? '✓' : chapter.id}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: accent, letterSpacing: '0.18em' }}>
          {chapterCleared ? 'CLEARED' : `LESSON ${chapter.id}`}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {chapter.title}
        </div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{chapter.subtitle}</div>
      </div>
    </button>
  );
}

// ---- Step card list (center, clickable → viewer) ----

function StepCardList({ chapter, cleared, onOpenStep }: {
  chapter: TutorialChapter; cleared: Set<string>; onOpenStep: (index: number, trigger: HTMLElement) => void;
}) {
  return (
    <div className="tutorial-step-list" style={{
      padding: '18px 20px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.7))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
      boxShadow: 'inset 0 0 40px rgba(255,215,0,0.05)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.3em' }}>
          LESSON {chapter.id}
        </div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 24, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.06em', marginTop: 2 }}>
          {chapter.title}
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>{chapter.subtitle}</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
        {chapter.steps.map((s, i) => {
          const isCleared = cleared.has(s.id);
          const accent = isCleared ? T.green : T.gold;
          return (
            <button key={s.id} onClick={(event) => onOpenStep(i, event.currentTarget)} className="meta-row" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', textAlign: 'left',
              background: 'rgba(0,0,0,0.25)',
              border: `1px solid ${isCleared ? `${T.green}44` : 'rgba(78,195,255,0.18)'}`,
              borderRadius: 4, cursor: 'pointer', color: T.textPrimary,
            }}>
              <div style={{
                width: 28, height: 28, flexShrink: 0,
                background: `${accent}22`, border: `1.5px solid ${accent}`, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: T.fontMono, fontWeight: 800, fontSize: 12, color: accent,
              }}>
                {isCleared ? '✓' : s.num}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>{s.title}</div>
                <div style={{
                  fontSize: 11, color: T.textMuted, marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{s.body}</div>
              </div>
              <div className="meta-row-arrow" style={{
                fontFamily: T.fontMono, fontSize: 13, fontWeight: 800,
                color: T.gold, letterSpacing: '0.1em',
              }}>▸ 開く</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Lesson summary (right, "レッスンを最初から学ぶ") ----

function ChapterSummary({ chapter, cleared, onStart }: {
  chapter: TutorialChapter; cleared: Set<string>; onStart: (trigger: HTMLElement) => void;
}) {
  const clearedInCh = chapter.steps.filter((s) => cleared.has(s.id)).length;
  const total = chapter.steps.length;
  const pct = total > 0 ? (clearedInCh / total) * 100 : 0;
  return (
    <div className="tutorial-summary" style={{
      padding: '16px 18px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto',
    }}>
      <div>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.gold, letterSpacing: '0.28em' }}>OVERVIEW</div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 18, fontWeight: 800, color: T.textPrimary, marginTop: 2 }}>
          {chapter.title}
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{chapter.subtitle}</div>
      </div>

      <div>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em', marginBottom: 6 }}>
          このレッスンで学ぶこと
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {chapter.steps.map((s) => (
            <li key={s.id} style={{
              fontSize: 12, color: cleared.has(s.id) ? T.green : T.textSecondary, lineHeight: 1.4,
            }}>
              {s.title}{cleared.has(s.id) ? ' ✓' : ''}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>
          <span>進捗</span><span>{clearedInCh} / {total}</span>
        </div>
        <div style={{ height: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: `linear-gradient(90deg, ${T.gold}, ${shade(T.gold, 0.2)})`,
            boxShadow: `0 0 6px ${T.gold}55`,
          }} />
        </div>
      </div>

      <button onClick={(event) => onStart(event.currentTarget)} style={{
        marginTop: 'auto', padding: '14px',
        background: `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.35)})`,
        border: `2px solid #f0e08a`, borderRadius: 4,
        color: '#1a1208', fontFamily: T.fontJp, fontSize: 15, fontWeight: 800,
        letterSpacing: '0.1em', cursor: 'pointer',
        boxShadow: `0 0 16px ${T.gold}44`,
      }}>
        レッスンを最初から学ぶ ▸
      </button>
    </div>
  );
}
