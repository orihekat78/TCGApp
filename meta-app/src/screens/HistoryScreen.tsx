import { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../shared/tokens';
import { PrimaryHeader } from '../shared/PrimaryHeader';
import { EmptyState } from '../shared/EmptyState';
import { useHistoryStore } from '../state/historyStore';
import { useDecksStore } from '../state/decksStore';
import type { Route } from '../router/routes';
import type { MatchRecord } from '../data/types';
import { HistoryDeckDialog } from './HistoryDeckDialog';
import { buildReplayHash } from '../router/useHashRoute';
import {
  clearReplayReturnFocus,
  markReplayReturnFocus,
  pendingReplayReturnFocus,
} from '../services/replayReturnFocus';
import './HistoryScreen.css';

interface Props { onNav: (r: Route) => void; }
type ResultFilter = 'all' | 'win' | 'loss';

export function HistoryScreen({ onNav }: Props) {
  const allHistory = useHistoryStore((state) => state.history);
  const canonicalHistoryLoaded = useHistoryStore((state) => state._hasCanonicalLoaded);
  const decks = useDecksStore((state) => state.decks);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [deckFilter, setDeckFilter] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<MatchRecord | null>(null);
  const deckDialogTriggerRef = useRef<HTMLButtonElement | null>(null);
  const filtered = useMemo(() => allHistory.filter((match) => {
    if (match.mode === 'observe' && resultFilter !== 'all') return false;
    if (resultFilter === 'win' && !match.won) return false;
    if (resultFilter === 'loss' && match.won) return false;
    return !deckFilter || match.deckName === deckFilter;
  }), [allHistory, deckFilter, resultFilter]);

  useEffect(() => {
    const returnTarget = pendingReplayReturnFocus();
    if (!returnTarget) return;
    const target = returnTarget.kind === 'artifact'
      ? Array.from(document.querySelectorAll<HTMLButtonElement>('[data-replay-artifact-id]'))
        .find((button) => button.dataset.replayArtifactId === returnTarget.artifactId)
      : undefined;
    if (returnTarget.kind === 'artifact' && !target && !canonicalHistoryLoaded) return;
    const frame = requestAnimationFrame(() => {
      if (target) {
        target.focus();
      } else {
        const heading = document.getElementById('history-title');
        heading?.setAttribute('tabindex', '-1');
        heading?.focus();
      }
      clearReplayReturnFocus();
    });
    return () => cancelAnimationFrame(frame);
  }, [allHistory, canonicalHistoryLoaded]);

  return <div className="history-screen" style={{ fontFamily: T.fontJp, color: T.textPrimary }}>
    <PrimaryHeader current="history" onNav={onNav} />
    <section aria-labelledby="history-title" className="history-toolbar">
      <h1 id="history-title" style={titleStyle}>対戦履歴</h1>
      <div aria-label="結果で絞り込み" className="history-result-filters">
        <FilterButton active={resultFilter === 'all'} onClick={() => setResultFilter('all')}>すべて</FilterButton>
        <FilterButton active={resultFilter === 'win'} tone={T.green} onClick={() => setResultFilter('win')}>勝利</FilterButton>
        <FilterButton active={resultFilter === 'loss'} tone={T.red} onClick={() => setResultFilter('loss')}>敗北</FilterButton>
      </div>
      <label style={deckLabelStyle}>
        <span style={visuallyHiddenStyle}>使用デッキで絞り込み</span>
        <select aria-label="使用デッキで絞り込み" value={deckFilter} onChange={(event) => setDeckFilter(event.target.value)} style={selectStyle}>
          <option value="">すべてのデッキ</option>
          {[...new Set([...decks.map((deck) => deck.name), ...allHistory.map((match) => match.deckName)])]
            .map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
    </section>
    <main className="history-content">{allHistory.length === 0
      ? <EmptyState icon="history" title="記録なし" body="対戦すると履歴がここに表示されます。" cta="対戦を開始 →" onCta={() => onNav('setup')} />
      : filtered.length === 0
        ? <EmptyState
            icon="search"
            title="該当する対戦なし"
            body="現在の絞り込み条件に一致する対戦はありません。"
            cta="絞り込みを解除"
            onCta={() => { setResultFilter('all'); setDeckFilter(''); }}
          />
        : <HistoryTable history={filtered} onOpenReplay={(match) => {
          if (match.replayRef) {
            markReplayReturnFocus(match.replayRef.artifactId);
            window.location.hash = buildReplayHash(match.replayRef.artifactId);
          }
        }} onOpenDecks={(match, trigger) => {
        deckDialogTriggerRef.current = trigger;
        setSelectedMatch(match);
      }} />}
    </main>
    {selectedMatch && <HistoryDeckDialog match={selectedMatch} returnFocus={deckDialogTriggerRef.current} onClose={() => {
      setSelectedMatch(null);
      deckDialogTriggerRef.current = null;
    }} />}
  </div>;
}

function FilterButton({ active, children, onClick, tone = T.gold }: { active: boolean; children: string; onClick: () => void; tone?: string }) {
  return <button type="button" aria-pressed={active} onClick={onClick} onKeyDown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  }} style={{ minWidth: 44, minHeight: 44, padding: '5px 10px', border: `1px solid ${active ? tone : `${tone}55`}`, borderRadius: 2, background: active ? `${tone}22` : 'rgba(0,0,0,0.28)', color: active ? tone : T.textMuted, fontFamily: T.fontJp, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{children}</button>;
}

function HistoryTable({ history, onOpenDecks, onOpenReplay }: {
  history: MatchRecord[];
  onOpenDecks: (match: MatchRecord, trigger: HTMLButtonElement) => void;
  onOpenReplay: (match: MatchRecord) => void;
}) {
  const hasUnavailableReplay = history.some((match) => !match.replayRef);
  return <div className="history-table-frame">
    {hasUnavailableReplay && <p id="history-replay-unavailable" className="history-replay-notice">
      完全なイベント記録が保存されていないため、この対戦はリプレイできません。
    </p>}
    <div className="history-table-scroll"><table aria-label="対戦履歴一覧" style={tableStyle}>
    <thead><tr>{['日時', '結果', '形式', '使用デッキ', '対戦相手デッキ', 'ターン数', 'デッキ内容', 'リプレイ'].map((label) => <th key={label} scope="col" style={label === 'ターン数' ? { ...headerCellStyle, textAlign: 'right' } : headerCellStyle}>{label}</th>)}</tr></thead>
    <tbody>{history.map((match) => <HistoryRow key={match.id} match={match} onOpenDecks={onOpenDecks} onOpenReplay={onOpenReplay} />)}</tbody>
    </table></div>
  </div>;
}

function HistoryRow({ match, onOpenDecks, onOpenReplay }: {
  match: MatchRecord;
  onOpenDecks: (match: MatchRecord, trigger: HTMLButtonElement) => void;
  onOpenReplay: (match: MatchRecord) => void;
}) {
  const isObserve = match.mode === 'observe';
  const result = isObserve ? (match.won ? 'CPU 1 勝利' : 'CPU 2 勝利') : (match.won ? '勝利' : '敗北');
  const resultColor = isObserve ? T.neonBlue : (match.won ? T.green : T.red);
  return <tr>
    <td style={cellStyle}>{formatRecordedAt(match.recorded)}</td>
    <td style={cellStyle}><span style={{ ...resultBadgeStyle, color: resultColor, borderColor: `${resultColor}88` }}>{result}</span></td>
    <td style={cellStyle}>{isObserve ? '観戦' : 'CPU'}</td>
    <td style={cellStyle}><span style={truncateStyle}>{match.deckName}</span></td>
    <td style={cellStyle}><span style={truncateStyle}>{match.oppDeckName ?? '—'}</span></td>
    <td style={{ ...cellStyle, textAlign: 'right', fontFamily: T.fontMono }}>{match.turns}</td>
    <td style={cellStyle}>
      {match.selfDeckSnapshot && match.oppDeckSnapshot ? (
        <button
          type="button"
          className="history-deck-open-button"
          aria-label={`${formatRecordedAt(match.recorded)}の対戦デッキを見る`}
          onClick={(event) => onOpenDecks(match, event.currentTarget)}
        >デッキを見る</button>
      ) : <span className="history-deck-unavailable">デッキ内容未保存</span>}
    </td>
    <td style={cellStyle}>
      <button
        type="button"
        className="history-replay-button"
        data-replay-artifact-id={match.replayRef?.artifactId}
        aria-label={match.replayRef ? `${formatRecordedAt(match.recorded)}のリプレイを開く` : 'リプレイ利用不可'}
        disabled={!match.replayRef}
        aria-describedby={match.replayRef ? undefined : 'history-replay-unavailable'}
        onClick={(event) => {
          if (match.replayRef) onOpenReplay(match);
          else event.preventDefault();
        }}
        style={match.replayRef ? replayReadyButtonStyle : replayButtonStyle}
      >
        {match.replayRef ? 'リプレイを開く' : '利用不可'}
      </button>
    </td>
  </tr>;
}

function formatRecordedAt(recorded: number): string {
  const date = new Date(recorded);
  return Number.isNaN(date.getTime()) ? '日時不明' : date.toLocaleString('ja-JP');
}

const titleStyle = { margin: 0, fontFamily: T.fontSerif, fontSize: 22, letterSpacing: '0.06em', whiteSpace: 'nowrap' as const };
const deckLabelStyle = { position: 'relative' as const, display: 'flex' };
const visuallyHiddenStyle = { position: 'absolute' as const, width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' };
const selectStyle = { width: 164, minHeight: 44, padding: '6px 8px', background: 'rgba(0,0,0,0.42)', color: T.textPrimary, border: '1px solid rgba(78,195,255,0.42)', borderRadius: 2, fontFamily: T.fontJp, fontSize: 12 };
const tableStyle = { width: '100%', minWidth: 820, borderCollapse: 'collapse' as const, tableLayout: 'fixed' as const, fontSize: 12 };
const headerCellStyle = { position: 'sticky' as const, top: 0, zIndex: 1, padding: '9px 8px', textAlign: 'left' as const, background: '#102d48', borderBottom: '1px solid rgba(78,195,255,0.25)', color: '#789ac0', fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', whiteSpace: 'nowrap' as const };
const cellStyle = { padding: '9px 8px', borderBottom: '1px solid rgba(78,195,255,0.10)', color: T.textSecondary, verticalAlign: 'middle' as const, whiteSpace: 'nowrap' as const };
const resultBadgeStyle = { display: 'inline-block', minWidth: 34, padding: '2px 5px', textAlign: 'center' as const, border: '1px solid', borderRadius: 2, fontFamily: T.fontMono, fontWeight: 800, fontSize: 10 };
const truncateStyle = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const };
const replayButtonStyle = { minWidth: 44, minHeight: 44, padding: '4px 9px', border: `1px solid ${T.textMuted}66`, borderRadius: 2, background: 'rgba(5,17,29,0.45)', color: T.textMuted, fontFamily: T.fontJp, fontSize: 12, fontWeight: 700, cursor: 'not-allowed', whiteSpace: 'nowrap' as const };
const replayReadyButtonStyle = { ...replayButtonStyle, borderColor: `${T.neonBlue}99`, color: T.neonBlue, cursor: 'pointer' };
