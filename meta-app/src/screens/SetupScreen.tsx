import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { CardArt } from '@/ui/components/CardArt';
import { useGameStateStore } from '@/ui/state/store';
import { useTutorialStore } from '@/ui/state/tutorialStore';
import {
  beginMatchSession,
  commitMatchSession,
  endMatchSession,
  isCurrentMatchSession,
} from '@/ui/services/matchSession';
import { CARD_POOL } from '../data/cardPool';
import {
  BUG_274_PARTNER_CARD,
  BUG_274_PUBLIC_DECK,
  BUG_274_PUBLIC_DECK_ID,
} from '../data/bug274ValidationDeck';
import type { DeckRecord } from '../data/types';
import type { Route } from '../router/routes';
import { PrimaryHeader } from '../shared/PrimaryHeader';
import { useDecksStore } from '../state/decksStore';
import { matchMetaSessionId, SPECTATOR_AI_SPEED_MS, useMetaStore } from '../state/metaStore';
import { captureMatchDeckSnapshot } from '../data/matchDeckSnapshot';
import { isPlayable } from '../util/deckBridge';
import { customGameStart } from '../util/customGameStart';
import { HomeDeckSelectorDialog } from './HomeDeckSelectorDialog';

interface Props {
  onNav: (route: Route) => void;
}

type Mode = 'solo' | 'observe';
type FirstChoice = 'random' | 'p1' | 'p2';
type DeckSide = 'self' | 'opp';

export function SetupScreen({ onNav }: Props) {
  const decks = useDecksStore((state) => state.decks);
  const activeDeckId = useDecksStore((state) => state.activeDeckId);
  const initialSelfDeckId = decks.some((deck) => deck.id === activeDeckId && isPlayable(deck))
    ? activeDeckId
    : decks.find((deck) => isPlayable(deck))?.id ?? '';
  const [mode, setMode] = useState<Mode>('solo');
  const [firstChoice, setFirstChoice] = useState<FirstChoice>('random');
  const [selfDeckId, setSelfDeckId] = useState(initialSelfDeckId);
  const [oppDeckId, setOppDeckId] = useState(decks[1]?.id ?? decks[0]?.id ?? '');
  const [deckDialogSide, setDeckDialogSide] = useState<DeckSide | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const startInFlightRef = useRef(false);
  const setupStartError = useMetaStore((state) => state._setupStartError);
  const setSetupStartError = useMetaStore((state) => state.setSetupStartError);
  const selfChangeRef = useRef<HTMLButtonElement>(null);
  const oppChangeRef = useRef<HTMLButtonElement>(null);
  const readyRef = useRef<HTMLButtonElement>(null);
  const selectableDecks = decks.some((deck) => deck.id === BUG_274_PUBLIC_DECK_ID)
    ? decks
    : [...decks, BUG_274_PUBLIC_DECK];
  const selfDeck = selectableDecks.find((deck) => deck.id === selfDeckId);
  const oppDeck = selectableDecks.find((deck) => deck.id === oppDeckId);
  const ready = isPlayable(selfDeck) && isPlayable(oppDeck);
  const selfSeatLabel = mode === 'observe' ? 'CPU 1' : 'PLAYER';
  const oppSeatLabel = mode === 'observe' ? 'CPU 2' : 'CPU';

  useEffect(() => {
    if (!setupStartError) return;
    requestAnimationFrame(() => readyRef.current?.focus());
  }, [setupStartError]);

  const closeDeckDialog = () => {
    const trigger = deckDialogSide === 'self' ? selfChangeRef.current : oppChangeRef.current;
    setDeckDialogSide(null);
    trigger?.focus();
    requestAnimationFrame(() => trigger?.focus());
  };

  const handleReady = () => {
    if (startInFlightRef.current) return;
    if (!selfDeck || !oppDeck || !isPlayable(selfDeck) || !isPlayable(oppDeck)) {
      setSetupStartError('デッキ検証エラー: 対戦可能なデッキを選択してください');
      readyRef.current?.focus();
      return;
    }
    startInFlightRef.current = true;
    setSetupStartError(null);
    setIsStarting(true);
    const meta = useMetaStore.getState();
    meta.clearMatchMeta();
    meta.clearPendingPractice();
    const session = beginMatchSession(mode === 'observe' ? null : 'self');
    const sessionId = matchMetaSessionId(session);
    useGameStateStore.getState().setSpectatorMode(mode === 'observe');
    if (mode === 'observe') {
      useGameStateStore.getState().setAiSpeedMs(
        SPECTATOR_AI_SPEED_MS[useMetaStore.getState().settings.spectatorAi],
      );
    } else {
      // `spectatorAi` is an observe-only preference. Do not leak the previous
      // observation speed into a later player-vs-CPU match.
      useGameStateStore.getState().setAiSpeedMs(SPECTATOR_AI_SPEED_MS.standard);
    }
    meta.setMatchMeta({
      sessionId,
      mode,
      selfDeckName: selfDeck.name,
      oppDeckName: oppDeck.name,
      selfDeckSnapshot: captureMatchDeckSnapshot(selfDeck),
      oppDeckSnapshot: captureMatchDeckSnapshot(oppDeck),
    });
    useTutorialStore.getState().exit();
    onNav('match');
    const firstPlayer = firstChoice === 'p1' ? 'self' : firstChoice === 'p2' ? 'opp' : undefined;
    customGameStart(selfDeck, oppDeck, {
      sessionId,
      spectator: mode === 'observe',
      firstPlayer,
      isSessionCurrent: () => isCurrentMatchSession(session),
    })
      .then((gameState) => {
        if (!commitMatchSession(session, gameState) && isCurrentMatchSession(session)) {
          throw new Error('対戦状態を読み込めませんでした。');
        }
      })
      .catch((reason: unknown) => {
        if (!isCurrentMatchSession(session)) return;
        console.error('[Phase 14] customGameStart failed:', reason);
        setSetupStartError(String(reason));
        startInFlightRef.current = false;
        setIsStarting(false);
        endMatchSession();
        const failedMeta = useMetaStore.getState();
        failedMeta.clearMatchMeta();
        failedMeta.clearPendingPractice();
        onNav('setup');
        requestAnimationFrame(() => readyRef.current?.focus());
      });
  };

  return (
    <div className="setup-screen">
      <PrimaryHeader current="setup" onNav={onNav} />
      <main className="setup-main" aria-labelledby="setup-title">
        <header className="setup-heading">
          <h1 id="setup-title">対戦準備</h1>
        </header>

        <section className="setup-stage" aria-label="対戦設定">
          <SetupPlayerPanel
            side="self"
            label={selfSeatLabel}
            deck={selfDeck}
            triggerRef={selfChangeRef}
            onChangeDeck={() => setDeckDialogSide('self')}
          />

          <SetupPlayerPanel
            side="opp"
            label={oppSeatLabel}
            deck={oppDeck}
            triggerRef={oppChangeRef}
            onChangeDeck={() => setDeckDialogSide('opp')}
          />

          <div className="setup-controls">
            <SelectControl icon="mode" label="プレイモード" value={mode} onChange={(value) => setMode(value as Mode)}>
              <option value="solo">CPU対戦</option>
              <option value="observe">観戦</option>
            </SelectControl>
            <SelectControl icon="first" label="先攻" value={firstChoice} onChange={(value) => setFirstChoice(value as FirstChoice)}>
              <option value="random">ランダム</option>
              <option value="p1">{selfSeatLabel}</option>
              <option value="p2">{oppSeatLabel}</option>
            </SelectControl>
            <SelectControl
              icon="cpu"
              label="CPU難易度"
              description="現在はノーマル固定"
              descriptionId="setup-cpu-difficulty-note"
              value="normal"
              disabled
              onChange={() => undefined}
            >
              <option value="normal">ノーマル</option>
            </SelectControl>
            <button
              ref={readyRef}
              className="meta-btn-ready setup-start"
              type="button"
              disabled={!ready || isStarting}
              aria-label="対戦を開始"
              aria-busy={isStarting}
              aria-describedby="setup-status"
              onClick={handleReady}
            >
              <span aria-hidden="true">▶</span>
              {isStarting ? '対戦を準備中' : '対戦を開始'}
            </button>
            <p id="setup-status" className={`setup-status${setupStartError ? ' is-error' : ''}`} aria-live="polite">
              {setupStartError ?? (!ready ? '対戦可能なデッキを両方に選択してください' : isStarting ? '対戦を準備しています' : '')}
            </p>
          </div>
        </section>

      </main>

      {deckDialogSide && (
        <HomeDeckSelectorDialog
          decks={selectableDecks}
          selectedId={deckDialogSide === 'self' ? selfDeckId : oppDeckId}
          onClose={closeDeckDialog}
          onConfirm={(id) => {
            if (deckDialogSide === 'self') {
              setSelfDeckId(id);
              if (id === BUG_274_PUBLIC_DECK_ID) setFirstChoice('p1');
            } else {
              setOppDeckId(id);
            }
            closeDeckDialog();
          }}
        />
      )}
    </div>
  );
}

function SetupPlayerPanel({ side, label, deck, triggerRef, onChangeDeck }: {
  side: DeckSide;
  label: string;
  deck: DeckRecord | undefined;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onChangeDeck: () => void;
}) {
  const partner = deck?.id === BUG_274_PUBLIC_DECK_ID
    ? BUG_274_PARTNER_CARD
    : deck ? CARD_POOL.find((card) => card.num === deck.partner) : undefined;
  const incident = deck ? CARD_POOL.find((card) => card.num === deck.case) : undefined;
  return (
    <article className={`setup-player-panel setup-player-panel--${side}`} data-deck-id={deck?.id ?? ''}>
      <h2>{label}</h2>
      <div className="setup-player-identity">
        <div className="setup-partner-art">
          {partner && <CardArt cardId={partner.num} alt="" />}
        </div>
        <div className="setup-player-copy">
          <strong title={deck?.name}>{deck?.name ?? 'デッキ未選択'}</strong>
          <span
            className="setup-player-card-name"
            aria-label={`パートナーカード ${partner?.name ?? '未設定'}`}
            title={partner?.name}
          >
            <small aria-hidden="true">PARTNER</small>
            {partner?.name ?? '未設定'}
          </span>
          <span
            className="setup-player-card-name"
            aria-label={`事件カード ${incident?.name ?? '未設定'}`}
            title={incident?.name}
          >
            <small aria-hidden="true">CASE</small>
            {incident?.name ?? '未設定'}
          </span>
        </div>
      </div>
      <button
        ref={triggerRef}
        className="setup-change-deck"
        type="button"
        aria-label={`使用デッキを変更（${label}）`}
        onClick={onChangeDeck}
      >
        使用デッキを変更
      </button>
    </article>
  );
}

type SetupControlIconName = 'mode' | 'first' | 'cpu';

function SelectControl({
  icon,
  label,
  description,
  descriptionId,
  value,
  disabled = false,
  onChange,
  children,
}: {
  icon: SetupControlIconName;
  label: string;
  description?: string;
  descriptionId?: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className={`setup-select-control${disabled ? ' is-disabled' : ''}`}>
      <SetupControlIcon name={icon} />
      <span className="setup-control-copy">
        <span className="setup-control-label">{label}</span>
        {description && <small id={descriptionId} className="setup-control-note">{description}</small>}
      </span>
      <select
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function SetupControlIcon({ name }: { name: SetupControlIconName }) {
  const commonProps = {
    className: 'setup-control-icon',
    'data-icon': name,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };

  if (name === 'mode') {
    return (
      <svg {...commonProps} data-symbol="gamepad">
        <path d="M8 8h8a4 4 0 0 1 3.8 2.8l1.1 4.4a2.4 2.4 0 0 1-4 2.3L15.4 16H8.6l-1.5 1.5a2.4 2.4 0 0 1-4-2.3l1.1-4.4A4 4 0 0 1 8 8Z" />
        <path d="M8 10.5v5M5.5 13h5" />
        <circle cx="16" cy="11.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="18.5" cy="14" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === 'first') {
    return (
      <svg {...commonProps}>
        <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
        <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12 3v3m-2-3h4" />
      <rect x="4" y="6" width="16" height="13" rx="4" />
      <path d="M4 11H2m20 0h-2M8 19v2m8-2v2" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M9 16h6" />
    </svg>
  );
}
