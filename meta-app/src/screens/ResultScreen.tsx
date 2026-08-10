import { useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '@/engine';
import { useGameStateStore } from '@/ui/state/store';
import type { GameState } from '@/engine/types/game-state';
import type { MatchRecord } from '../data/types';
import type { Route } from '../router/routes';
import { PrimaryHeader } from '../shared/PrimaryHeader';
import { useHistoryStore } from '../state/historyStore';
import { useMetaStore } from '../state/metaStore';
import { PRACTICE_STEP_ID } from './tutorial/curriculum';
import { normalizedGameLogForUi } from '@/ui/presentation/normalizedLog';
import { usePresentationStore } from '@/ui/presentation/store';
import {
  discardLiveReplayRecording,
  getFinalizedReplay,
} from '@/ui/services/liveReplayRecorder';
import { saveHistoryReplay } from '../services/historyReplayRepository';
import { buildReplayHash } from '../router/useHashRoute';
import { markReplayReturnFocus } from '../services/replayReturnFocus';
import './ResultScreen.css';

interface Props {
  onNav: (route: Route) => void;
  onRematch: () => void;
}

export function ResultScreen({ onNav, onRematch }: Props) {
  const gameState = useGameStateStore((state) => state.gameState);
  const recordHistory = useHistoryStore((state) => state.record);
  const presentationCompletionNotice = usePresentationStore((state) => state.presentationCompletionNotice);
  const recordedSessionRef = useRef<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [replayArtifactId, setReplayArtifactId] = useState<string | null>(null);
  const [replayStatus, setReplayStatus] = useState<'saving' | 'ready' | 'unavailable' | 'error'>('saving');
  const [saveAttempt, setSaveAttempt] = useState(0);

  useEffect(() => {
    if (!gameState) return;
    const result = engine.read.game.result(gameState);
    if (!result) return;

    const record = buildMatchRecord(gameState, result);
    if (recordedSessionRef.current === record.sessionId) return;
    const sessionId = record.sessionId!;
    recordedSessionRef.current = sessionId;
    const practiceStepId = useMetaStore.getState().consumePendingPractice();
    if (practiceStepId === PRACTICE_STEP_ID && result.winner === 'self') {
      useMetaStore.getState().markStepCleared(PRACTICE_STEP_ID);
    }
    const replay = getFinalizedReplay(sessionId);
    if (replay === null) {
      recordHistory(record);
      setReplayStatus('unavailable');
    } else {
      void saveHistoryReplay(record, replay).then((savedRecord) => {
        recordHistory(savedRecord);
        discardLiveReplayRecording(sessionId);
        setReplayArtifactId(savedRecord.replayRef?.artifactId ?? null);
        setReplayStatus('ready');
      }).catch(() => {
        recordedSessionRef.current = null;
        setReplayStatus('error');
      });
    }
  }, [gameState, recordHistory, saveAttempt]);

  const summary = useMemo(() => gameState ? buildSummary(gameState) : null, [gameState]);

  useEffect(() => { titleRef.current?.focus(); }, [gameState]);

  if (!gameState || !summary) {
    return (
      <div className="result-screen">
        <PrimaryHeader current="result" onNav={(route) => onNav(route)} />
        <main className="result-empty">
          <h1>対戦結果がありません</h1>
          <p>ゲーム開始から対戦を始めてください。</p>
          <button type="button" onClick={() => onNav('setup')}>ゲーム開始へ</button>
        </main>
      </div>
    );
  }

  const won = summary.winner === 'self';
  const matchMeta = useMetaStore.getState().getMatchMeta();
  const isObserve = matchMeta?.mode === 'observe';
  const verdictLabel = isObserve
    ? `${won ? 'CPU 1' : 'CPU 2'} 勝利`
    : won ? '勝利' : '敗北';

  return (
    <div className={`result-screen ${won ? 'is-win' : 'is-loss'}`}>
      <PrimaryHeader current="result" onNav={onNav} />
      <main className="result-main" aria-labelledby="result-title">
        <section className="result-panel" aria-label="対戦結果">
          <header className="result-verdict">
            <p>RESULT</p>
            <h1 id="result-title" ref={titleRef} tabIndex={-1}>{verdictLabel}</h1>
            <p role="status" aria-live="polite" style={visuallyHiddenStyle}>{`${verdictLabel}、${reasonLabel(summary.reason)}`}</p>
            <div className="result-end-reason">
              <span>END REASON</span>
              <strong>{reasonLabel(summary.reason)}</strong>
            </div>
            <div className="result-mode"><span />{isObserve ? '観戦' : 'CPU対戦'}<span /></div>
          </header>

          {presentationCompletionNotice && (
            <p
              className="result-presentation-notice"
              data-testid="result-presentation-notice"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {presentationCompletionNotice.kind === 'skip'
                ? `${presentationCompletionNotice.count}件の処理をスキップしました`
                : `${presentationCompletionNotice.count}件の処理を最終要約にまとめました`}
            </p>
          )}

          <footer className="result-actions">
            <p id="result-replay-note" className="result-replay-note" role={replayStatus === 'error' ? 'alert' : undefined}>
              {replayStatus === 'error'
                ? '対戦履歴とリプレイを保存できませんでした。'
                : replayStatus === 'ready'
                  ? 'この対戦の完全なリプレイを再生できます。'
                  : replayStatus === 'unavailable'
                    ? 'この対戦には完全なリプレイ記録がありません。'
                    : 'リプレイを保存しています。'}
            </p>
            <button className="result-rematch" type="button" onClick={onRematch}>
              <span aria-hidden="true">◆</span>もう一度対戦
            </button>
            <button
              className="result-replay"
              type="button"
              disabled={!replayArtifactId && replayStatus !== 'error'}
              aria-describedby="result-replay-note"
              onClick={() => {
                if (replayArtifactId) {
                  markReplayReturnFocus(replayArtifactId);
                  window.location.hash = buildReplayHash(replayArtifactId);
                } else if (replayStatus === 'error') {
                  setReplayStatus('saving');
                  setSaveAttempt((attempt) => attempt + 1);
                }
              }}
            >
              <span aria-hidden="true">▷</span>{replayArtifactId
                ? 'リプレイを見る'
                : replayStatus === 'saving'
                  ? '保存中'
                  : replayStatus === 'error'
                    ? '保存を再試行'
                    : '利用不可'}
            </button>
          </footer>
        </section>
      </main>
    </div>
  );
}

const visuallyHiddenStyle = { position: 'absolute' as const, width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' };

type ResultSummary = {
  winner: 'self' | 'opp';
  reason: 'evidence' | 'deck-out' | 'concede' | 'alt-lose';
  turns: number;
  selfEvidence: number;
  oppEvidence: number;
  selfTarget: number;
  oppTarget: number;
  selfRefresh: number;
  oppRefresh: number;
};

function buildSummary(gameState: GameState): ResultSummary | null {
  const result = engine.read.game.result(gameState);
  if (!result) return null;
  return {
    winner: result.winner,
    reason: result.reason,
    turns: gameState.turn.number,
    selfEvidence: gameState.players.self.evidence.length,
    oppEvidence: gameState.players.opp.evidence.length,
    selfTarget: gameState.players.self.case.requiredEvidence,
    oppTarget: gameState.players.opp.case.requiredEvidence,
    selfRefresh: gameState.refreshCount.self,
    oppRefresh: gameState.refreshCount.opp,
  };
}

function reasonLabel(reason: ResultSummary['reason']): string {
  switch (reason) {
    case 'evidence': return '必要証拠数達成';
    case 'deck-out': return 'デッキ切れ';
    case 'concede': return '投了';
    case 'alt-lose': return 'カード効果';
  }
}

function buildMatchRecord(
  gameState: GameState,
  result: NonNullable<ReturnType<typeof engine.read.game.result>>,
): MatchRecord {
  const summary = buildSummary(gameState);
  const counters = countLogActions(gameState);
  const matchMeta = useMetaStore.getState().getMatchMeta();
  const graph = normalizedGameLogForUi(gameState);
  const sessionId = matchMeta?.sessionId
    ?? (graph.nodes.some((node) => node.origin === 'causal') ? graph.sessionId : fallbackSessionId(gameState));
  return {
    id: sessionId,
    sessionId,
    recorded: Date.now(),
    won: result.winner === 'self',
    mode: matchMeta?.mode ?? 'solo',
    deckName: matchMeta?.selfDeckName ?? '使用デッキ',
    oppDeckName: matchMeta?.oppDeckName,
    ...(matchMeta?.selfDeckSnapshot ? { selfDeckSnapshot: matchMeta.selfDeckSnapshot } : {}),
    ...(matchMeta?.oppDeckSnapshot ? { oppDeckSnapshot: matchMeta.oppDeckSnapshot } : {}),
    turns: gameState.turn.number,
    duration: 0,
    evidGot: gameState.players.self.evidence.length,
    evidLost: gameState.players.opp.evidence.length,
    contacts: counters.contacts,
    hirameki: counters.hirameki,
    misread: counters.misread,
    p1Target: (summary?.selfTarget ?? 7) as 7 | 6,
    p2Target: (summary?.oppTarget ?? 6) as 7 | 6,
  };
}

const fallbackSessionIds = new WeakMap<GameState, string>();
let fallbackSessionSequence = 0;

function fallbackSessionId(gameState: GameState): string {
  const existing = fallbackSessionIds.get(gameState);
  if (existing) return existing;
  const sessionId = `untracked-result-${++fallbackSessionSequence}`;
  fallbackSessionIds.set(gameState, sessionId);
  return sessionId;
}

function countLogActions(gameState: GameState): Pick<MatchRecord, 'contacts' | 'hirameki' | 'misread'> {
  const nodes = normalizedGameLogForUi(gameState).nodes;
  const tags = nodes.flatMap((node) => node.tags);
  return {
    contacts: nodes.filter((node) => (
      (node.origin === 'causal' && node.kind === 'declare' && node.tags.includes('contact'))
      || (node.origin === 'legacy' && node.label === 'contact:detail')
    )).length,
    hirameki: tags.filter((tag) => tag === 'hirameki').length,
    misread: tags.filter((tag) => tag === 'misread').length,
  };
}
