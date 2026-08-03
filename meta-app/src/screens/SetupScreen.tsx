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
import { useMetaStore } from '../state/metaStore';
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
    if (!selfDeck || !oppDeck || !isPlayable(selfDeck) || !isPlayable(oppDeck)) {
      setSetupStartError('デッキ検証エラー: 対戦可能なデッキを選択してください');
      readyRef.current?.focus();
      return;
    }
    setSetupStartError(null);
    setIsStarting(true);
    const session = beginMatchSession(mode === 'observe' ? null : 'self');
    useGameStateStore.getState().setSpectatorMode(mode === 'observe');
    useMetaStore.getState().setMatchMeta({ mode, selfDeckName: selfDeck.name, oppDeckName: oppDeck.name });
    useTutorialStore.getState().exit();
    onNav('match');
    const firstPlayer = firstChoice === 'p1' ? 'self' : firstChoice === 'p2' ? 'opp' : undefined;
    customGameStart(selfDeck, oppDeck, {
      spectator: mode === 'observe',
      firstPlayer,
      isSessionCurrent: () => isCurrentMatchSession(session),
    })
      .then((gameState) => { commitMatchSession(session, gameState); })
      .catch((reason: unknown) => {
        if (!isCurrentMatchSession(session)) return;
        console.error('[Phase 14] customGameStart failed:', reason);
        setSetupStartError(String(reason));
        setIsStarting(false);
        endMatchSession();
        onNav('setup');
        requestAnimationFrame(() => readyRef.current?.focus());
      });
  };

  const handleSwap = () => {
    setSelfDeckId(oppDeckId);
    setOppDeckId(selfDeckId);
  };

  const handleRandomize = () => {
    const playableDecks = decks.filter((deck) => isPlayable(deck));
    if (!playableDecks.length) return;
    setSelfDeckId(playableDecks[Math.floor(Math.random() * playableDecks.length)]!.id);
    setOppDeckId(playableDecks[Math.floor(Math.random() * playableDecks.length)]!.id);
  };

  return (
    <div className="setup-screen">
      <PrimaryHeader current="setup" onNav={onNav} />
      <main className="setup-main" aria-labelledby="setup-title">
        <header className="setup-heading">
          <p>対戦準備</p>
          <h1 id="setup-title">ゲームセッティング</h1>
        </header>

        <section className="setup-stage" aria-label="対戦設定">
          <SetupPlayerPanel
            side="self"
            label="あなた"
            deck={selfDeck}
            triggerRef={selfChangeRef}
            onChangeDeck={() => setDeckDialogSide('self')}
          />

          <div className="setup-controls">
            <span className="setup-vs" aria-hidden="true">VS</span>
            <ControlGroup label="プレイモード">
              <ChoiceButton selected={mode === 'solo'} onClick={() => setMode('solo')}>CPU対戦</ChoiceButton>
              <ChoiceButton selected={mode === 'observe'} onClick={() => setMode('observe')}>観戦</ChoiceButton>
            </ControlGroup>
            <ControlGroup label="先攻">
              <ChoiceButton selected={firstChoice === 'p1'} onClick={() => setFirstChoice('p1')}>あなた</ChoiceButton>
              <ChoiceButton selected={firstChoice === 'p2'} onClick={() => setFirstChoice('p2')}>CPU</ChoiceButton>
              <ChoiceButton selected={firstChoice === 'random'} onClick={() => setFirstChoice('random')}>ランダム</ChoiceButton>
            </ControlGroup>
            <div className="setup-fixed-option" aria-label="CPU難易度 ノーマル 固定">
              <span>CPU難易度</span>
              <strong>ノーマル（固定）</strong>
            </div>
            <div className="setup-deck-tools">
              <button type="button" aria-label="デッキを入れ替え" onClick={handleSwap}>⇄ <span>デッキを入れ替え</span></button>
              <button type="button" onClick={handleRandomize}>ランダムに選択</button>
            </div>
          </div>

          <SetupPlayerPanel
            side="opp"
            label="CPU"
            deck={oppDeck}
            triggerRef={oppChangeRef}
            onChangeDeck={() => setDeckDialogSide('opp')}
          />
        </section>

        <footer className="setup-actions">
          <button className="setup-back" type="button" onClick={() => onNav('home')}>‹ <span>戻る</span></button>
          <button
            ref={readyRef}
            className="meta-btn-ready setup-start"
            type="button"
            disabled={!ready}
            aria-busy={isStarting}
            aria-describedby="setup-status"
            onClick={handleReady}
          >
            <span aria-hidden="true">▶</span>
            {isStarting ? '対戦を準備中' : '対戦を開始'}
          </button>
        </footer>
        <p id="setup-status" className={`setup-status${setupStartError ? ' is-error' : ''}`} aria-live="polite">
          {setupStartError ?? (!ready ? '対戦可能なデッキを両方に選択してください' : isStarting ? '対戦を準備しています' : '')}
        </p>
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
          <span title={partner?.name}>{partner?.name ?? 'パートナー未設定'}</span>
          <span title={incident?.name}>{incident?.name ?? '事件未設定'}</span>
        </div>
        <div className="setup-incident-art">
          {incident && <CardArt cardId={incident.num} alt="" />}
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

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="setup-control-group">
      <legend>{label}</legend>
      <div>{children}</div>
    </fieldset>
  );
}

function ChoiceButton({ selected, onClick, children }: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}>{children}</button>
  );
}
