import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeScreen } from '../../meta-app/src/screens/HomeScreen';
import { useDecksStore } from '../../meta-app/src/state/decksStore';
import { useHistoryStore } from '../../meta-app/src/state/historyStore';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';

const { newsMock } = vi.hoisted(() => ({ newsMock: vi.fn() }));

vi.mock('../../meta-app/src/hooks/useOfficialNews', () => ({
  useOfficialNews: () => newsMock(),
}));

describe('HOME deck identity', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    localStorage.clear();
    newsMock.mockReturnValue({
      source: 'network',
      fetchedAt: Date.UTC(2026, 7, 2, 12),
      items: [{
        id: 'https://www.takaratomy.co.jp/products/conan-cardgame/news/20260731.html',
        category: 'イベント',
        title: '探偵サミット2026',
        date: '2026-07-31',
        url: 'https://www.takaratomy.co.jp/products/conan-cardgame/news/20260731.html',
      }],
    });
    useDecksStore.setState({
      decks: [
        { ...SAMPLE_DECK, modified: 2 },
        { ...SAMPLE_DECK_OPP, modified: 1 },
      ],
      activeDeckId: SAMPLE_DECK.id,
      _hasHydrated: true,
    });
    useHistoryStore.setState({ history: [], _hasHydrated: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders the required header order with the supplied brand logo and a single new-game entry', () => {
    act(() => root.render(<HomeScreen onNav={() => undefined} />));

    const nav = container.querySelector('nav[aria-label="メインナビゲーション"]');
    expect(nav).not.toBeNull();
    expect(Array.from(nav!.querySelectorAll('button')).map((button) => button.textContent?.trim())).toEqual([
      'ホーム', 'デッキ', 'カード', 'ゲーム開始', 'チュートリアル', '履歴', '設定',
    ]);
    expect(container.querySelector('img[alt="DETECTIVE CONAN"]')).not.toBeNull();
    expect(nav!.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(7);
    expect(nav!.querySelector('button[data-route="setup"]')?.classList.contains('home-nav-start')).toBe(true);
    expect(Array.from(container.querySelectorAll('button')).filter((button) => button.textContent?.trim() === 'ゲーム開始')).toHaveLength(1);
  });

  it('makes deck name the only H1 and shows partner plus incident identity without redundant labels', () => {
    act(() => root.render(<HomeScreen onNav={() => undefined} />));

    expect(Array.from(container.querySelectorAll('h1')).map((node) => node.textContent)).toEqual(['少年探偵団・標準']);
    expect(container.querySelector('figure[aria-labelledby="home-card-D08001-name"]')).not.toBeNull();
    expect(container.querySelector('figure[aria-labelledby="home-card-D08026-name"]')).not.toBeNull();
    for (const removed of ['対戦準備', 'デッキを確認して対戦を始めます', 'メインデッキ40枚', 'パートナーカード', '事件カード', 'CPU対戦を始める']) {
      expect(container.textContent).not.toContain(removed);
    }
    expect(container.textContent).toContain('使用デッキを変更');
    expect(container.textContent).not.toContain('前回の対戦を再開');
  });

  it('opens the HOME-owned deck selector without navigating away and keeps official NEWS links external', () => {
    const onNav = vi.fn();
    act(() => root.render(<HomeScreen onNav={onNav} />));

    const gameStart = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'ゲーム開始');
    const changeDeck = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === '使用デッキを変更');
    act(() => gameStart?.click());
    act(() => changeDeck?.click());

    expect(onNav.mock.calls).toEqual([['setup']]);
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    const newsLink = container.querySelector<HTMLAnchorElement>('.home-news-list a');
    expect(newsLink?.href).toBe('https://www.takaratomy.co.jp/products/conan-cardgame/news/20260731.html');
    expect(newsLink?.rel).toContain('noopener');
  });

  it('shows formal partner and incident names from each saved deck', () => {
    act(() => root.render(<HomeScreen onNav={() => undefined} />));
    const changeDeck = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === '使用デッキを変更')!;
    act(() => changeDeck.click());

    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('江戸川コナン');
    expect(dialog.textContent).toContain('青の古城探索事件');
    expect(dialog.textContent).toContain('萩原千速');
    expect(dialog.textContent).toContain('千速と重悟の婚活パーティー');
  });

  it('keeps a deck choice provisional until confirmation', () => {
    act(() => root.render(<HomeScreen onNav={() => undefined} />));
    const changeDeck = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === '使用デッキを変更')!;
    act(() => changeDeck.click());

    const choices = container.querySelectorAll<HTMLInputElement>('input[name="home-active-deck"]');
    expect(choices).toHaveLength(2);
    act(() => choices[1]!.click());
    expect(useDecksStore.getState().activeDeckId).toBe(SAMPLE_DECK.id);
    expect(container.querySelector('#home-deck-name')?.textContent).toBe(SAMPLE_DECK.name);

    const confirm = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'このデッキを使用')!;
    act(() => confirm.click());
    expect(useDecksStore.getState().activeDeckId).toBe(SAMPLE_DECK_OPP.id);
    expect(container.querySelector('#home-deck-name')?.textContent).toBe(SAMPLE_DECK_OPP.name);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('discards a provisional choice on Escape and restores focus to the trigger', () => {
    act(() => root.render(<HomeScreen onNav={() => undefined} />));
    const changeDeck = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === '使用デッキを変更')!;
    act(() => changeDeck.click());
    const choices = container.querySelectorAll<HTMLInputElement>('input[name="home-active-deck"]');
    act(() => choices[1]!.click());

    const dialog = container.querySelector<HTMLDialogElement>('dialog')!;
    act(() => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));

    expect(useDecksStore.getState().activeDeckId).toBe(SAMPLE_DECK.id);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(changeDeck);
  });

  it('keeps an unplayable saved deck visible but unavailable for selection', () => {
    useDecksStore.setState({
      decks: [
        { ...SAMPLE_DECK, modified: 2 },
        { ...SAMPLE_DECK_OPP, id: 'needs-adjustment', name: '調整中デッキ', cards: [], modified: 1 },
      ],
    });
    act(() => root.render(<HomeScreen onNav={() => undefined} />));
    const changeDeck = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === '使用デッキを変更')!;
    act(() => changeDeck.click());

    const invalidChoice = container.querySelector<HTMLInputElement>('input[value="needs-adjustment"]');
    expect(invalidChoice?.disabled).toBe(true);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('調整中デッキ');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('調整が必要');
  });

  it('maps every header label to the required internal route', () => {
    const onNav = vi.fn();
    act(() => root.render(<HomeScreen onNav={onNav} />));
    const nav = container.querySelector('nav[aria-label="メインナビゲーション"]')!;

    for (const button of Array.from(nav.querySelectorAll('button'))) {
      act(() => button.click());
    }

    expect(onNav.mock.calls).toEqual([
      ['home'], ['deck'], ['cards'], ['setup'], ['tutorial'], ['history'], ['settings'],
    ]);
  });

  it('distinguishes NEWS loading from an unavailable result and keeps the official recovery link', () => {
    newsMock.mockReturnValue({ source: 'empty', items: [] });
    act(() => root.render(<HomeScreen onNav={() => undefined} />));

    expect(container.textContent).toContain('公式NEWSを読み込めませんでした');
    expect(container.textContent).not.toContain('更新を確認しています');
    expect(container.querySelector<HTMLAnchorElement>('a[href="https://www.takaratomy.co.jp/products/conan-cardgame/"]')).not.toBeNull();
  });

  it('keeps HOME usable when persisted history contains an invalid timestamp', () => {
    useHistoryStore.setState({
      history: [{
        id: 'broken-history',
        recorded: 'not-a-date' as unknown as number,
        won: true,
        deckName: 'test',
        oppDeckName: 'CPU',
        turns: 1,
        duration: 1,
        evidGot: 0,
        evidLost: 0,
        contacts: 0,
        hirameki: 0,
        misread: 0,
        p1Target: 7,
        p2Target: 7,
      }],
      _hasHydrated: true,
    });

    expect(() => act(() => root.render(<HomeScreen onNav={() => undefined} />))).not.toThrow();
    expect(container.textContent).toContain('日時不明');
  });
});
