import { useEffect, useRef, useState } from 'react';
import { CARD_POOL } from '../data/cardPool';
import type { MatchDeckSnapshotV1, MatchRecord } from '../data/types';
import { MetaCard } from '../shared/MetaCard';
import { encodeDeck } from '../util/deckCode';

interface Props {
  match: MatchRecord;
  onClose: () => void;
  returnFocus?: HTMLElement | null;
}

type DeckSide = 'self' | 'opp';
const IMAGE_LOAD_BLOCKING_MS = 2_500;

export function HistoryDeckDialog({ match, onClose, returnFocus }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const selfTabRef = useRef<HTMLButtonElement>(null);
  const oppTabRef = useRef<HTMLButtonElement>(null);
  const [activeSide, setActiveSide] = useState<DeckSide>('self');
  const isObserve = match.mode === 'observe';
  const selfLabel = isObserve ? 'CPU 1' : 'PLAYER';
  const oppLabel = isObserve ? 'CPU 2' : 'CPU';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    returnFocusRef.current = returnFocus
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    closeRef.current?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      const target = returnFocusRef.current;
      returnFocusRef.current = null;
      if (target?.isConnected) target.focus();
    };
  }, [returnFocus]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const candidates = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    const focusable = candidates ? Array.from(candidates).filter((element) => element.getClientRects().length > 0) : [];
    if (focusable.length === 0) return;
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? (current <= 0 ? focusable.length - 1 : current - 1)
      : (current < 0 || current === focusable.length - 1 ? 0 : current + 1);
    event.preventDefault();
    focusable[next]?.focus();
  };

  const selectTab = (side: DeckSide, focus = false) => {
    setActiveSide(side);
    if (focus) requestAnimationFrame(() => (side === 'self' ? selfTabRef : oppTabRef).current?.focus());
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    let next: DeckSide | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'Home') next = 'self';
    if (event.key === 'ArrowRight' || event.key === 'End') next = 'opp';
    if (!next) return;
    event.preventDefault();
    selectTab(next, true);
  };

  return (
    <dialog
      ref={dialogRef}
      className="history-deck-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-deck-dialog-title"
      onKeyDown={handleKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="history-deck-dialog-shell">
        <header className="history-deck-dialog-header">
          <div>
            <span>{match.mode === 'observe' ? '観戦履歴' : 'CPU対戦履歴'}</span>
            <h2 id="history-deck-dialog-title">対戦デッキ</h2>
          </div>
          <dl>
            <div><dt>結果</dt><dd>{resultLabel(match)}</dd></div>
            <div><dt>日時</dt><dd>{formatRecordedAt(match.recorded)}</dd></div>
            <div><dt>ターン</dt><dd>{match.turns}</dd></div>
          </dl>
          <button ref={closeRef} type="button" aria-label="対戦デッキを閉じる" onClick={onClose}>×</button>
        </header>

        <div className="history-deck-tabs" role="tablist" aria-label="表示するデッキ">
          <button
            ref={selfTabRef}
            id="history-self-deck-tab"
            type="button"
            role="tab"
            aria-selected={activeSide === 'self'}
            aria-controls="history-self-deck-panel"
            tabIndex={activeSide === 'self' ? 0 : -1}
            onClick={() => selectTab('self')}
            onKeyDown={handleTabKeyDown}
          >{selfLabel}のデッキ<span className="home-sr-only">内容</span></button>
          <button
            ref={oppTabRef}
            id="history-opp-deck-tab"
            type="button"
            role="tab"
            aria-selected={activeSide === 'opp'}
            aria-controls="history-opp-deck-panel"
            tabIndex={activeSide === 'opp' ? 0 : -1}
            onClick={() => selectTab('opp')}
            onKeyDown={handleTabKeyDown}
          >{oppLabel}のデッキ<span className="home-sr-only">内容</span></button>
        </div>
        <p className="history-deck-live home-sr-only" aria-live="polite">
          {activeSide === 'self' ? selfLabel : oppLabel}のデッキを表示
        </p>

        <div className="history-deck-compare">
          <HistoryDeckPanel
            id="history-self-deck-panel"
            label={selfLabel}
            fallbackName={match.deckName}
            snapshot={match.selfDeckSnapshot}
            active={activeSide === 'self'}
            labelledBy="history-self-deck-tab"
          />
          <HistoryDeckPanel
            id="history-opp-deck-panel"
            label={oppLabel}
            fallbackName={match.oppDeckName ?? '対戦相手デッキ'}
            snapshot={match.oppDeckSnapshot}
            active={activeSide === 'opp'}
            labelledBy="history-opp-deck-tab"
          />
        </div>
      </section>
    </dialog>
  );
}

function HistoryDeckPanel({ id, label, fallbackName, snapshot, active, labelledBy }: {
  id: string;
  label: string;
  fallbackName: string;
  snapshot?: MatchDeckSnapshotV1;
  active: boolean;
  labelledBy: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [imagesReady, setImagesReady] = useState(!snapshot);
  const [imageLoadTimedOut, setImageLoadTimedOut] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const copyResetRef = useRef<number | null>(null);
  const deckCode = snapshot ? encodeSnapshot(snapshot) : '';

  useEffect(() => () => {
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
  }, []);

  const copyDeckCode = async () => {
    if (!snapshot || !navigator.clipboard?.writeText) {
      setCopyStatus('コピーできません。下のコードを選択してください');
      setCopyFailed(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(deckCode);
      setCopyStatus('コピーしました');
      setCopyFailed(false);
      if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current);
      copyResetRef.current = window.setTimeout(() => setCopyStatus(''), 1_500);
    } catch {
      setCopyStatus('コピーできません。下のコードを選択してください');
      setCopyFailed(true);
    }
  };

  useEffect(() => {
    if (!active || !snapshot || imagesReady) return;
    const images = Array.from(panelRef.current?.querySelectorAll('img') ?? []);
    if (images.length === 0) {
      setImagesReady(true);
      return;
    }
    const check = () => {
      if (images.every((image) => image.complete && image.naturalWidth > 0)) {
        setImagesReady(true);
        setImageLoadTimedOut(false);
      }
    };
    images.forEach((image) => {
      image.addEventListener('load', check);
      image.addEventListener('error', check);
    });
    check();
    return () => {
      images.forEach((image) => {
        image.removeEventListener('load', check);
        image.removeEventListener('error', check);
      });
    };
  }, [active, imagesReady, snapshot]);

  useEffect(() => {
    if (!active || !snapshot || imagesReady || imageLoadTimedOut) return;
    const timeout = window.setTimeout(() => setImageLoadTimedOut(true), IMAGE_LOAD_BLOCKING_MS);
    return () => window.clearTimeout(timeout);
  }, [active, imageLoadTimedOut, imagesReady, snapshot]);

  return (
    <article
      ref={panelRef}
      id={id}
      role="tabpanel"
      className={`history-deck-panel${active ? ' is-active' : ''}`}
      hidden={!active}
      aria-label={`${label}のデッキ内容`}
      aria-labelledby={labelledBy}
      aria-busy={active && snapshot ? !imagesReady && !imageLoadTimedOut : undefined}
    >
      <header className="history-deck-panel-header">
        <div>
          <span>{label}</span>
          <h3>{snapshot?.name ?? fallbackName}</h3>
        </div>
        {snapshot && (
          <button
            type="button"
            className="history-deck-copy-button"
            aria-label={`${label}のデッキコードをコピー`}
            onClick={copyDeckCode}
          >デッキコードをコピー</button>
        )}
      </header>
      <p className={`history-deck-copy-status${copyFailed ? ' is-error' : ''}`} role="status" aria-live="polite">{copyStatus}</p>
      {copyFailed && snapshot && (
        <label className="history-deck-code-fallback">
          <span>デッキコード</span>
          <input
            type="text"
            aria-label={`${label}のデッキコード`}
            value={deckCode}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
      {snapshot ? (
        <>
          <DeckSnapshotContents
            snapshot={snapshot}
            imageWarning={active && !imagesReady && imageLoadTimedOut}
          />
          {active && !imagesReady && !imageLoadTimedOut && (
            <div className="history-deck-loading" role="status">デッキ画像を読み込み中</div>
          )}
        </>
      ) : (
        <div className="history-deck-missing" role="status">
          <strong>デッキ内容未保存</strong>
          <p>この対戦ではデッキ内容を保存していません。現在のデッキからは推測しません。</p>
        </div>
      )}
    </article>
  );
}

function encodeSnapshot(snapshot: MatchDeckSnapshotV1): string {
  return encodeDeck({
    id: snapshot.deckId ?? `history-${snapshot.partner}-${snapshot.case}`,
    name: snapshot.name,
    partner: snapshot.partner,
    case: snapshot.case,
    cards: snapshot.cards.map((entry) => ({ ...entry })),
    modified: 0,
  });
}

function DeckSnapshotContents({ snapshot, imageWarning }: {
  snapshot: MatchDeckSnapshotV1;
  imageWarning: boolean;
}) {
  const partner = CARD_POOL.find((card) => card.num === snapshot.partner);
  const incident = CARD_POOL.find((card) => card.num === snapshot.case);
  const total = snapshot.cards.reduce((sum, entry) => sum + entry.count, 0);
  const orderedEntries = snapshot.cards
    .map((entry) => ({ ...entry, card: CARD_POOL.find((candidate) => candidate.num === entry.num) }))
    .sort((left, right) => {
      if (!left.card && !right.card) return left.num.localeCompare(right.num);
      if (!left.card) return 1;
      if (!right.card) return -1;
      if (left.card.type !== right.card.type) return left.card.type === 'character' ? -1 : 1;
      return (left.card.cost ?? 99) - (right.card.cost ?? 99)
        || left.card.name.localeCompare(right.card.name, 'ja');
    });
  return (
    <>
      <div className="history-deck-overview">
        <div className="history-deck-slots" data-testid="history-deck-slots" aria-label="パートナーと事件">
          <SnapshotSlot label="パートナー" num={snapshot.partner} card={partner} />
          <SnapshotSlot label="事件" num={snapshot.case} card={incident} />
        </div>
        <SnapshotDeckStats snapshot={snapshot} />
      </div>
      <div className="history-deck-list-heading">
        <h4>DECK</h4>
        <span className="home-sr-only">メインデッキ、合計{total}枚</span>
        {imageWarning && (
          <span className="history-deck-image-warning" role="status">一部の画像を読み込めません</span>
        )}
        <span className="history-deck-scroll-hint" aria-hidden="true">下へ続く ↓</span>
      </div>
      <div
        className="history-deck-list"
        data-testid="history-deck-card-grid"
        data-total={total}
        role="list"
        aria-label={`${snapshot.name}のメインデッキ、${total}枚`}
      >
        {orderedEntries.map((entry, index) => {
          const { card } = entry;
          return (
            <div
              className="history-deck-card"
              role="listitem"
              aria-label={`${card?.name ?? 'カード情報なし'}、${entry.num}、${entry.count}枚`}
              key={`${entry.num}-${index}`}
            >
              {card ? <MetaCard card={card} w={84} count={entry.count} hoverable={false} imageLoading="eager" /> : (
                <div className="history-deck-card-unknown"><span>カード情報なし</span><strong>{entry.num}</strong><b>×{entry.count}</b></div>
              )}
              <span className="history-deck-card-id" aria-hidden="true">{entry.num}</span>
              <span className="home-sr-only">{card?.name ?? entry.num}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SnapshotSlot({ label, num, card }: {
  label: string;
  num: string;
  card: (typeof CARD_POOL)[number] | undefined;
}) {
  return (
    <div className="history-deck-slot" role="group" aria-label={`${label}、${card?.name ?? 'カード情報なし'}、${num}`}>
      <span>{label}</span>
      {card ? <MetaCard card={card} w={62} hoverable={false} imageLoading="eager" /> : <div className="history-deck-slot-unknown">?</div>}
    </div>
  );
}

function SnapshotDeckStats({ snapshot }: { snapshot: MatchDeckSnapshotV1 }) {
  const stats = computeSnapshotStats(snapshot);
  const maxCost = Math.max(1, ...Object.values(stats.costs));
  const costBars = [1, 2, 3, 4, 5, 6, 7, 8].map((cost) => ({
    cost,
    count: stats.costs[cost] ?? 0,
  }));
  return (
    <div className="history-deck-stats">
      <div
        className="history-deck-cost-chart"
        data-testid="history-deck-cost-chart"
        aria-label={stats.unknown > 0 ? `コスト分布。確認できたカードのみ集計。カード情報なし${stats.unknown}枚` : 'コスト分布'}
      >
        <div className="history-deck-cost-heading">
          <strong>COST</strong>
          {stats.unknown > 0 && (
            <span role="status">一部カード情報なし（{stats.unknown}枚）・確認できたカードのみ集計</span>
          )}
        </div>
        <div className="history-deck-cost-bars">
          {costBars.map(({ cost, count }) => (
            <div key={cost} data-cost={cost} data-count={count}>
              <b>{count > 0 ? count : ''}</b>
              <i style={{ height: `${(count / maxCost) * 42 + (count > 0 ? 5 : 1)}px` }} />
              <span>{cost}{cost === 8 ? '+' : ''}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="history-deck-type-summary" data-testid="history-deck-type-summary">
        <SnapshotTypeRow label="キャラ" value={stats.character} />
        <SnapshotTypeRow label="イベント" value={stats.event} />
      </div>
    </div>
  );
}

function SnapshotTypeRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <i><b style={{ width: `${Math.min(100, (value / 40) * 100)}%` }} /></i>
      <strong>{value}</strong>
    </div>
  );
}

function computeSnapshotStats(snapshot: MatchDeckSnapshotV1) {
  const costs: Record<number, number> = {};
  let character = 0;
  let event = 0;
  let unknown = 0;
  for (const entry of snapshot.cards) {
    const card = CARD_POOL.find((candidate) => candidate.num === entry.num);
    if (!card) {
      unknown += entry.count;
      continue;
    }
    if (card.type === 'character') character += entry.count;
    if (card.type === 'event') event += entry.count;
    if (card.cost != null) {
      const cost = Math.min(card.cost, 8);
      costs[cost] = (costs[cost] ?? 0) + entry.count;
    }
  }
  return { costs, character, event, unknown };
}

function resultLabel(match: MatchRecord): string {
  if (match.mode === 'observe') return match.won ? 'CPU 1勝利' : 'CPU 2勝利';
  return match.won ? '勝利' : '敗北';
}

function formatRecordedAt(recorded: number): string {
  const date = new Date(recorded);
  return Number.isNaN(date.getTime()) ? '日時不明' : date.toLocaleString('ja-JP');
}
