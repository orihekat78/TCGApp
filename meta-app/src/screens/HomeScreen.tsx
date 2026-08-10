import { useRef, useState } from 'react';
import { CardArt } from '@/ui/components/CardArt';
import type { Route } from '../router/routes';
import { CARD_POOL } from '../data/cardPool';
import type { CardDef, MatchRecord } from '../data/types';
import { useOfficialNews } from '../hooks/useOfficialNews';
import { useDecksStore } from '../state/decksStore';
import { useHistoryStore } from '../state/historyStore';
import { PrimaryHeader } from '../shared/PrimaryHeader';
import { HomeDeckSelectorDialog } from './HomeDeckSelectorDialog';

interface Props {
  onNav: (route: Route) => void;
}

export function HomeScreen({ onNav }: Props) {
  const decks = useDecksStore((state) => state.decks);
  const activeDeckId = useDecksStore((state) => state.activeDeckId);
  const setActiveDeck = useDecksStore((state) => state.setActiveDeck);
  const history = useHistoryStore((state) => state.history);
  const news = useOfficialNews();
  const [deckSelectorOpen, setDeckSelectorOpen] = useState(false);
  const changeDeckRef = useRef<HTMLButtonElement>(null);
  const deck = decks.find((candidate) => candidate.id === activeDeckId);
  const partner = deck ? CARD_POOL.find((card) => card.num === deck.partner) : undefined;
  const incident = deck ? CARD_POOL.find((card) => card.num === deck.case) : undefined;

  const navigate = (route: Route) => onNav(route);
  const closeDeckSelector = () => {
    setDeckSelectorOpen(false);
  };

  return (
    <div className="home-screen">
      <PrimaryHeader current="home" onNav={navigate} />

      <main className="home-main">
        <aside className="home-rail" aria-label="お知らせと最近の対戦">
          <OfficialNewsSection result={news} />
          <RecentMatchesSection history={history.slice(0, 12)} onSeeAll={() => navigate('history')} />
        </aside>

        <section className="home-deck-stage" aria-labelledby="home-deck-name">
          {deck && partner && incident ? (
            <>
              <div className="home-deck-heading">
                <h1 id="home-deck-name" title={deck.name}>{deck.name}</h1>
                <button
                  ref={changeDeckRef}
                  className="home-change-deck"
                  type="button"
                  onClick={() => setDeckSelectorOpen(true)}
                >
                  使用デッキを変更
                </button>
              </div>
              <div className="home-deck-media">
                <IdentityCard card={partner} role="partner" />
                <IdentityCard card={incident} role="incident" />
              </div>
            </>
          ) : (
            <div className="home-empty-deck">
              <h1 id="home-deck-name">デッキがありません</h1>
              <p>対戦に使用するデッキを作成してください。</p>
              <button type="button" onClick={() => navigate('deck')}>デッキを作成</button>
            </div>
          )}
        </section>
      </main>
      {deckSelectorOpen && (
        <HomeDeckSelectorDialog
          decks={decks}
          selectedId={activeDeckId}
          onClose={closeDeckSelector}
          onConfirm={(id) => {
            setActiveDeck(id);
            closeDeckSelector();
          }}
          returnFocus={changeDeckRef.current}
        />
      )}
    </div>
  );
}

function IdentityCard({ card, role }: { card: CardDef; role: 'partner' | 'incident' }) {
  const captionId = `home-card-${card.num}-name`;
  return (
    <figure className={`home-identity-card home-identity-card--${role}`} aria-labelledby={captionId}>
      <div className="home-identity-art">
        <CardArt cardId={card.num} alt="" className="home-card-art" />
      </div>
      <figcaption>
        <strong id={captionId}>{card.name}</strong>
        <span>{card.num}</span>
      </figcaption>
    </figure>
  );
}

function OfficialNewsSection({ result }: { result: ReturnType<typeof useOfficialNews> }) {
  return (
    <section className="home-rail-section" aria-labelledby="home-news-title">
      <div className="home-section-heading">
        <h2 id="home-news-title">公式NEWS</h2>
        <a href="https://www.takaratomy.co.jp/products/conan-cardgame/" target="_blank" rel="noopener noreferrer">
          公式サイト
          <span className="home-sr-only">（新しいタブで開く）</span>
        </a>
      </div>
      {result.items.length ? (
        <ul className="home-news-list">
          {result.items.map((item) => (
            <li key={item.id}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <span className="home-news-category">{item.category}</span>
                <strong>{item.title}</strong>
                <time dateTime={item.date}>{item.date.replaceAll('-', '.')}</time>
                <span className="home-sr-only">（新しいタブで開く）</span>
              </a>
            </li>
          ))}
        </ul>
      ) : result.source === 'loading' ? (
        <p className="home-rail-empty">更新を確認しています。</p>
      ) : (
        <p className="home-rail-empty">公式NEWSを読み込めませんでした。公式サイトで最新情報をご確認ください。</p>
      )}
      {result.source === 'stale' && <p className="home-sync-note">前回取得した情報を表示中</p>}
    </section>
  );
}

function RecentMatchesSection({ history, onSeeAll }: { history: MatchRecord[]; onSeeAll: () => void }) {
  return (
    <section className="home-rail-section" aria-labelledby="home-history-title">
      <div className="home-section-heading">
        <h2 id="home-history-title">最近の対戦</h2>
        <button type="button" onClick={onSeeAll}>すべて見る</button>
      </div>
      {history.length ? (
        <ul className="home-match-list">
          {history.map((match) => {
            const recorded = getSafeRecordedDate(match.recorded);
            const observed = match.mode === 'observe';
            return (
              <li key={match.id}>
                <span className={`home-match-result ${observed ? 'is-observe' : match.won ? 'is-win' : 'is-loss'}`}>
                  {observed ? `CPU ${match.won ? '1' : '2'}勝利` : match.won ? '勝利' : '敗北'}
                </span>
                <span title={match.oppDeckName ?? 'CPU'}>{match.oppDeckName ?? 'CPU'}</span>
                {recorded ? (
                  <time dateTime={recorded.toISOString()}>
                    {new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit' }).format(recorded)}
                  </time>
                ) : (
                  <span className="home-match-date">日時不明</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="home-rail-empty">対戦履歴はまだありません。</p>
      )}
    </section>
  );
}

function getSafeRecordedDate(recorded: unknown): Date | null {
  if (typeof recorded !== 'number' || !Number.isFinite(recorded)) return null;
  const date = new Date(recorded);
  return Number.isNaN(date.getTime()) ? null : date;
}
