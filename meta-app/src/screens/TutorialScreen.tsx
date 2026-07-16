// spec: .claude/specs/meta-ui/14-tutorial-complete.md + 15-tutorial-lesson-viewer.md
// Phase 16-C: ハブ (章リスト + ステップカード + 章概要) + ステップクリックで LessonViewer 起動
// 公式「初めての方へ」(beginner) + ルールマニュアル Ver 2.4 参照

import { useMemo, useState } from 'react';
import { T, shade } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { SetupButton } from '../shared/Button';
import { useMetaStore } from '../state/metaStore';
import { useGameStateStore } from '@/ui/state/store';
import { useDecksStore } from '../state/decksStore';
import { customGameStart } from '../util/customGameStart';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../data/sampleDeck';
import type { Route } from '../router/routes';
import type { TutorialChapter } from './tutorial/types';
import { TutorialLessonViewer } from './tutorial/TutorialLessonViewer';
import { useTutorialStore } from '@/ui/state/tutorialStore';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps';
import { beginMatchSession, commitMatchSession, isCurrentMatchSession } from '@/ui/services/matchSession';

interface Props {
  onNav: (r: Route) => void;
}

/** Phase 16: 8 章 (各 step は STEP_ILLUSTRATIONS のキー id を持つ。illustration は viewer が id 引き) */
export const TUTORIAL_CHAPTERS: TutorialChapter[] = [
  {
    num: 1, title: '基本ルール', subtitle: 'デッキ構築 + 場のエリア', group: 'beginner',
    steps: [
      { id: 'ch1-1', num: 1, title: 'デッキ構成', body: '40 枚ちょうど · 同 ID ≤ 3 枚 · パートナー 1 + 事件 1 + デッキ 40 = 計 42 枚 (rules/02)' },
      { id: 'ch1-2', num: 2, title: '場のエリア', body: '現場 ≤ 5 枚 / パートナー / 事件 / FILE / 証拠 / リムーブ / 手札 — 7 エリア (rules/03)' },
    ],
  },
  {
    num: 2, title: 'カードの読み方', subtitle: 'キャラ / イベント / 事件 / パートナー', group: 'beginner',
    steps: [
      { id: 'ch2-1', num: 1, title: 'キャラカード', body: 'コスト / AP / LP / 特徴 / 効果 / キーワード — 番号で示した位置を確認しよう' },
      { id: 'ch2-2', num: 2, title: 'イベントカード', body: 'コスト / 効果テキスト — 1 回使用でリムーブエリアへ' },
      { id: 'ch2-3', num: 3, title: '事件カード', body: '事件レベル = 必要証拠数 / FILE 7+ で解決編へ移行可能' },
      { id: 'ch2-4', num: 4, title: 'パートナーカード', body: 'LP / 共通能力【アシスト】【事件解決】/ 色がカード効果に影響' },
    ],
  },
  {
    num: 3, title: 'ゲーム開始からターン進行', subtitle: 'マリガン + 3 フェイズ', group: 'beginner',
    steps: [
      { id: 'ch3-1', num: 1, title: 'ゲーム開始', body: '事件 / パートナーを裏向き配置 → シャッフル → 先攻決定 → 5 ドロー → マリガン 1 回 → 事件 / パートナー 表向き (rules/04)' },
      { id: 'ch3-2', num: 2, title: '3 フェイズ', body: 'オート (アクティブ + 1 ドロー + FILE 2 枚) → メイン (推理/アクション等) → エンド (rules/05)' },
    ],
  },
  {
    num: 4, title: 'キャラ行動とリソース管理', subtitle: '推理 / アクション / NH / リフレッシュ', group: 'beginner',
    steps: [
      { id: 'ch4-1', num: 1, title: '推理', body: 'スリープ → LP 分の証拠を獲得。⚠ LP ≤ 0 では 0 枚 (rules/11)' },
      { id: 'ch4-2', num: 2, title: 'アクション + ガード', body: '対象選び → 自キャラスリープ → 相手ガード可 → コンタクト (rules/07-08)' },
      { id: 'ch4-3', num: 3, title: 'コンタクト判定', body: 'AP 同値以上で対象リムーブ。低 AP が 1 番目、高 AP が 2 番目に行動 (rules/08)' },
      { id: 'ch4-4', num: 4, title: 'ネクストヒント', body: 'FILE 上 1 枚を手札へ → そのまま FILE 枚数以下の手札カードを即使用可 (rules/12)' },
      { id: 'ch4-5', num: 5, title: 'リフレッシュ + 敗北条件', body: 'デッキ 0 → リムーブシャッフル + 相手証拠 +1。⚠ リムーブ 0 枚で敗北 (rules/14)' },
    ],
  },
  {
    num: 5, title: '解決編とアシスト勝利不可', subtitle: '⚠ ハマりやすい裁定', group: 'advanced',
    steps: [
      { id: 'ch5-1', num: 1, title: '事件編 → 解決編', body: 'FILE 7 枚以上 + アシストで移行 (一方通行) (rules/01)' },
      { id: 'ch5-2', num: 2, title: '必要証拠数', body: '先攻 7 / 後攻 6' },
      { id: 'ch5-3', num: 3, title: '【事件解決】', body: 'アクティブパートナー → スリープで勝利' },
      { id: 'ch5-4', num: 4, title: '⚠ アシスト勝利不可', body: 'アシスト = FILE 移動でスリープ → 同ターン中は事件解決の前提を満たさない' },
      { id: 'ch5-5', num: 5, title: '練習試合', body: '上部「練習試合 PRACTICE」ボタンから AI と対戦して理解を深める' },
    ],
  },
  {
    num: 6, title: '効果と能力', subtitle: 'アイコン + 宣言 + タイミング', group: 'advanced',
    steps: [
      { id: 'ch6-1', num: 1, title: 'アイコン能力', body: 'カットイン / 変装 / ヒラメキ / ミスリード (rules/09, 10, 13)' },
      { id: 'ch6-2', num: 2, title: '宣言能力 + コスト', body: '【宣言】+「:」の左がコスト (スリープアイコン等)、右が効果 (rules/21)' },
      { id: 'ch6-3', num: 3, title: 'タイミングアイコン', body: '登場時 / 現場リムーブ時 / 変装時 / 疾風 N (rules/17)' },
      { id: 'ch6-4', num: 4, title: '解決順', body: '同タイミング複数発動はターンプレイヤー優先 / 未解決待機 / 「代わりに」「無効」は即時解決 (rules/15, 25)' },
    ],
  },
  {
    num: 7, title: 'キーワード能力', subtitle: '疾風 / 突撃 / 迅速 / ブレット / 捜査 / 痕跡', group: 'advanced',
    steps: [
      { id: 'ch7-1', num: 1, title: '疾風 N', body: '自分の現場にこのターン N 番目に登場時発動 (rules/17)' },
      { id: 'ch7-2', num: 2, title: '突撃 / 突撃[キャラ] / 突撃[事件]', body: '名乗り中でも対象アクション可 (rules/13)' },
      { id: 'ch7-3', num: 3, title: '迅速', body: '名乗り中でも推理 or アクション可 (rules/13)' },
      { id: 'ch7-4', num: 4, title: 'ブレット', body: 'このキャラのアクションはガードできない' },
      { id: 'ch7-5', num: 5, title: '捜査 X', body: '相手はデッキ上 X 枚を公開→好きな順でデッキ下へ' },
      { id: 'ch7-6', num: 6, title: '痕跡 (発見済 / 未発見)', body: '相手のリフレッシュで「発見済」へ。自分のリフレッシュは対象外 (rules/13, 26)' },
    ],
  },
  {
    num: 8, title: '上級者向け', subtitle: 'MR / 色制限 / スタン / 数値修正 / セット', group: 'advanced',
    steps: [
      { id: 'ch8-1', num: 1, title: 'MR (ミステリーレア)', body: '相手ターン中に現場離脱でパートナーエリアへ帰還 (rules/18)' },
      { id: 'ch8-2', num: 2, title: '色制限 + スイッチ', body: '手札使用 / NH は事件と同色のみ。現場 5 枚埋まり時にスイッチ可 (rules/20)' },
      { id: 'ch8-3', num: 3, title: 'スタン特殊挙動', body: 'スタン中に「アクティブにする」効果 → 代わりにスリープになる (rules/03)' },
      { id: 'ch8-4', num: 4, title: '数値修正', body: '元 AP/LP を 0 にする / AP/LP/レベルは下限なしマイナス可 (rules/19)' },
      { id: 'ch8-5', num: 5, title: 'カードセット vs 下に重ねる', body: 'セット = 情報参照可 / 下に重ねる = 枚数のみ (rules/16)' },
    ],
  },
];

const PRACTICE_CHAPTER = 5; // 解決編の練習試合 (SubToolbar の「練習試合」ボタン用、ch5 を自動クリア)

// Phase 17-D: meta 章 → src TUTORIAL_STEPS の index (ガイド付き実戦の overlay 開始位置)。
// id 照合で解決し、無ければ 0 (先頭) にフォールバック。
const srcStepIdx = (id: string): number => {
  const i = TUTORIAL_STEPS.findIndex((s) => s.id === id);
  return i >= 0 ? i : 0;
};
const CHAPTER_TO_SRC_STEP: Record<number, number> = {
  3: srcStepIdx('L3-1'), // 3 フェイズ
  4: srcStepIdx('L4-1'), // 推理とは
  5: srcStepIdx('L5-1'), // アシスト
  6: srcStepIdx('L9-1'), // カットイン (効果と能力)
  7: srcStepIdx('L6-1'), // アクション (キーワードが関わる実戦)
  8: srcStepIdx('L13-1'), // MR (上級者向け)
};

function isChapterCleared(chapter: TutorialChapter, cleared: Set<string>): boolean {
  return chapter.steps.every((s) => cleared.has(s.id));
}

interface ViewerState { chapterNum: number; stepIndex: number }

export function TutorialScreen({ onNav }: Props) {
  const clearedIds = useMetaStore((s) => s.settings.tutorialClearedStepIds ?? []);
  const markStepCleared = useMetaStore((s) => s.markStepCleared);
  const startPracticeFor = useMetaStore((s) => s.startPracticeFor);
  const decks = useDecksStore((s) => s.decks);
  const [chapterNum, setChapterNum] = useState(1);
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const clearedSet = useMemo(() => new Set(clearedIds), [clearedIds]);
  const current = TUTORIAL_CHAPTERS.find((c) => c.num === chapterNum) ?? TUTORIAL_CHAPTERS[0]!;
  const totalSteps = TUTORIAL_CHAPTERS.reduce((s, c) => s + c.steps.length, 0);
  const clearedCount = clearedIds.length;

  const openViewer = (chNum: number, stepIndex: number) => setViewer({ chapterNum: chNum, stepIndex });

  const startPractice = () => {
    const self = decks.find((d) => d.id === 'sample-d08') ?? { ...SAMPLE_DECK, modified: Date.now() };
    const opp = decks.find((d) => d.id === 'sample-d11') ?? { ...SAMPLE_DECK_OPP, modified: Date.now() };
    const session = beginMatchSession('self');
    useGameStateStore.getState().setSpectatorMode(false);
    useTutorialStore.getState().exit(); // 通常の練習試合はガイド overlay を出さない
    startPracticeFor(PRACTICE_CHAPTER);
    onNav('match');
    customGameStart(self, opp, { isSessionCurrent: () => isCurrentMatchSession(session) })
      .then((gs) => { commitMatchSession(session, gs); })
      .catch((err: unknown) => {
        if (!isCurrentMatchSession(session)) return;
        console.error('[Phase 16] practice match failed:', err);
        onNav('tutorial');
      });
  };

  // Phase 17-D: 章ごとガイド付き実戦。実盤面を起動し、src の TutorialOverlay を該当章の step から表示。
  const startGuided = (chapterNum: number) => {
    const self = decks.find((d) => d.id === 'sample-d08') ?? { ...SAMPLE_DECK, modified: Date.now() };
    const opp = decks.find((d) => d.id === 'sample-d11') ?? { ...SAMPLE_DECK_OPP, modified: Date.now() };
    setViewer(null);
    const session = beginMatchSession('self');
    useGameStateStore.getState().setSpectatorMode(false);
    useTutorialStore.setState({ currentStep: CHAPTER_TO_SRC_STEP[chapterNum] ?? 0 });
    startPracticeFor(chapterNum);
    onNav('match');
    customGameStart(self, opp, { isSessionCurrent: () => isCurrentMatchSession(session) })
      .then((gs) => { commitMatchSession(session, gs); })
      .catch((err: unknown) => {
        if (!isCurrentMatchSession(session)) return;
        console.error('[Phase 17] guided match failed:', err);
        useTutorialStore.getState().exit();
        onNav('tutorial');
      });
  };

  const viewerChapter = viewer ? TUTORIAL_CHAPTERS.find((c) => c.num === viewer.chapterNum) : null;

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
      <AppTopBar page="tutorial" onNav={(r) => onNav(r as Route)} />
      <SubToolbar cleared={clearedCount} total={totalSteps} onPractice={startPractice} />

      <div style={{
        position: 'absolute', left: 24, right: 24, top: 134, bottom: 16,
        display: 'grid', gridTemplateColumns: '300px 1fr 360px', gap: 14,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
          <ChapterProgress cleared={clearedCount} total={totalSteps} />
          <ChapterList chapters={TUTORIAL_CHAPTERS} active={chapterNum} cleared={clearedSet} onSelect={setChapterNum} />
        </div>

        <StepCardList chapter={current} cleared={clearedSet} onOpenStep={(i) => openViewer(current.num, i)} />

        <ChapterSummary chapter={current} cleared={clearedSet} onStart={() => openViewer(current.num, 0)} />
      </div>

      {viewer && viewerChapter && (
        <TutorialLessonViewer
          chapter={viewerChapter}
          stepIndex={viewer.stepIndex}
          onStepChange={(i) => setViewer({ chapterNum: viewer.chapterNum, stepIndex: i })}
          onStepComplete={(stepId) => markStepCleared(stepId)}
          onClose={() => setViewer(null)}
          onStartGuided={startGuided}
        />
      )}
    </div>
  );
}

// ---- SubToolbar ----

function SubToolbar({ cleared, total, onPractice }: { cleared: number; total: number; onPractice: () => void }) {
  const pct = total > 0 ? (cleared / total) * 100 : 0;
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 64, height: 60,
      display: 'flex', alignItems: 'center', padding: '0 24px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
      borderBottom: `1px solid rgba(78,195,255,0.15)`, zIndex: 8,
    }}>
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
        <SetupButton label="練習試合" sub="PRACTICE" onClick={onPractice} />
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
      <GroupLabel>初めての方は ①〜{beginner.length} から</GroupLabel>
      {beginner.map((ch) => (
        <ChapterRow key={ch.num} chapter={ch} active={ch.num === active}
          chapterCleared={isChapterCleared(ch, cleared)} onClick={() => onSelect(ch.num)} />
      ))}
      <GroupLabel>詳しく知りたい方</GroupLabel>
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
    <button onClick={onClick} className="meta-row" style={{
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
        {chapterCleared ? '✓' : chapter.num}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: accent, letterSpacing: '0.18em' }}>
          {chapterCleared ? 'CLEARED' : 'CHAPTER ' + String(chapter.num).padStart(2, '0')}
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
  chapter: TutorialChapter; cleared: Set<string>; onOpenStep: (index: number) => void;
}) {
  return (
    <div style={{
      padding: '18px 20px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.7))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
      boxShadow: 'inset 0 0 40px rgba(255,215,0,0.05)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.3em' }}>
          CHAPTER {String(chapter.num).padStart(2, '0')}
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
            <button key={s.id} onClick={() => onOpenStep(i)} className="meta-row" style={{
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

// ---- Chapter summary (right, "章を最初から学ぶ") ----

function ChapterSummary({ chapter, cleared, onStart }: {
  chapter: TutorialChapter; cleared: Set<string>; onStart: () => void;
}) {
  const clearedInCh = chapter.steps.filter((s) => cleared.has(s.id)).length;
  const total = chapter.steps.length;
  const pct = total > 0 ? (clearedInCh / total) * 100 : 0;
  return (
    <div style={{
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
          この章で学ぶこと
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

      <button onClick={onStart} style={{
        marginTop: 'auto', padding: '14px',
        background: `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.35)})`,
        border: `2px solid #f0e08a`, borderRadius: 4,
        color: '#1a1208', fontFamily: T.fontJp, fontSize: 15, fontWeight: 800,
        letterSpacing: '0.1em', cursor: 'pointer',
        boxShadow: `0 0 16px ${T.gold}44`,
      }}>
        章を最初から学ぶ ▸
      </button>
    </div>
  );
}
