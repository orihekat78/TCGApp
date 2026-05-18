// Phase 9a-1: TutorialOverlay
//
// 画面下部に字幕バー (title + body) を表示し、次へ / 戻る / 終了 ボタンを提供。
// currentStep===null のときは非表示。

import { useEffect, useState, type JSX } from 'react';
import { useTutorialStore } from '@/ui/state/tutorialStore.js';
import { TUTORIAL_STEPS } from '@/ui/services/tutorialSteps.js';
import './TutorialOverlay.css';

export function TutorialOverlay(): JSX.Element | null {
  // Round 2 修正: 旧コードは `useTutorialStore.getState()` だけで Zustand subscription
  // を行っていなかったため、next() 呼出で state は更新されるが component が再描画
  // されず「次へ」を押しても 1/33 のまま stuck していた (root cause)。
  //
  // 解決策: getState() を render 時に毎回読む + useEffect で subscribe して forceUpdate。
  //   - SSR (test) では useEffect が走らないが getState で初期 state を取れる → 表示 OK
  //   - 本番 (browser) では subscribe 経由で state 変化を検知 → forceUpdate で再描画
  const [, forceUpdate] = useState({});
  useEffect(() => useTutorialStore.subscribe(() => forceUpdate({})), []);
  const { currentStep, next, prev, exit } = useTutorialStore.getState();
  if (currentStep === null) return null;
  const step = TUTORIAL_STEPS[currentStep];
  if (!step) return null;

  const total = TUTORIAL_STEPS.length;
  const canPrev = currentStep > 0;

  return (
    <div className="tutorial-overlay" role="dialog" data-testid="tutorial-overlay">
      <div className="tutorial-bar">
        <div className="tutorial-content">
          <div className="tutorial-meta">
            <span className="tutorial-id">{step.id}</span>
            <span className="tutorial-progress">{currentStep + 1} / {total}</span>
          </div>
          <h2 className="tutorial-title">{step.title}</h2>
          <p className="tutorial-body">{step.body}</p>
        </div>
        <div className="tutorial-actions">
          <button
            type="button"
            className="tutorial-btn tutorial-btn-prev"
            onClick={prev}
            disabled={!canPrev}
            data-testid="tutorial-prev"
          >
            戻る
          </button>
          <button
            type="button"
            className="tutorial-btn tutorial-btn-next"
            onClick={next}
            data-testid="tutorial-next"
          >
            {currentStep + 1 === total ? '完了' : '次へ'}
          </button>
          <button
            type="button"
            className="tutorial-btn tutorial-btn-exit"
            onClick={exit}
            data-testid="tutorial-exit"
            aria-label="チュートリアルを終了"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
