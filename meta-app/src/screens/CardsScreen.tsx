// spec: .claude/specs/meta-ui/07-screens-library.md + 11-cards-rebuild.md
// 原典: design-mockups_v2/08-cards.jsx
// Phase 18: Master Duel 風リデザイン
//   - 「種類」は cardId 単位 (パラレルを畳む)。CATALOG は所有率ではなくカタログ概要に。
//   - 共有 FilterRail (色/種別/コスト/レアリティ/特徴/キーワード, OR/AND, sticky)
//   - 検索は 名前/番号/ID/特徴/効果テキスト
//   - ソート 番号/コスト/AP/LP/名前 (昇降) + ★お気に入り/採用中フィルタ
//   - 表示 グリッド大/小 + リスト行 + パラレルまとめトグル + キーボード操作 (MetaCard)

import {
  useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type RefObject,
} from 'react';
import { T, COLOR_TOKEN } from '../shared/tokens';
import { PrimaryHeader } from '../shared/PrimaryHeader';
import { MetaCard } from '../shared/MetaCard';
import { CardExpandModal } from '@/ui/components/CardExpandModal';
import { FilterRail } from '../shared/FilterRail';
import {
  CARD_POOL, DISTINCT_CARDS, cardIdOf, variantsOfId,
} from '../data/cardPool';
import { useMetaStore } from '../state/metaStore';
import { useFiltersStore } from '../state/filtersStore';
import {
  activeFilterCount, matchesFilter, sortCards, rarityHex,
  type CardFilterState, type SortKey, type SortDir,
} from '../data/cardFilter';
import type { CardDef, CardKind } from '../data/types';
import type { Route } from '../router/routes';

interface Props {
  onNav: (r: Route) => void;
}

type ViewMode = 'large' | 'grid' | 'list';

const SORTS: { k: SortKey; label: string }[] = [
  { k: 'num',  label: '番号' },
  { k: 'cost', label: 'コスト' },
  { k: 'ap',   label: 'AP' },
  { k: 'lp',   label: 'LP' },
  { k: 'name', label: '名前' },
];

export function CardsScreen({ onNav }: Props) {
  const filter = useFiltersStore((s) => s.cards);
  const setFilter = useFiltersStore((s) => s.setCards);
  const resetFilter = useFiltersStore((s) => s.resetCards);
  const sortKey = useFiltersStore((s) => s.cardsSort);
  const sortDir = useFiltersStore((s) => s.cardsSortDir);
  const setSort = useFiltersStore((s) => s.setCardsSort);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [foldParallels, setFoldParallels] = useState(true);
  const [onlyFav, setOnlyFav] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedNum, setSelectedNum] = useState<string>(DISTINCT_CARDS[0]?.num ?? '');
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterCloseRef = useRef<HTMLButtonElement>(null);
  const selectedPrintRef = useRef<HTMLButtonElement>(null);

  const favorites = useMetaStore((s) => s.settings.favorites ?? []);
  const toggleFavorite = useMetaStore((s) => s.toggleFavorite);

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const isFav = (c: CardDef) => variantsOfId(c.id).some((v) => favSet.has(v.num));

  const filtered = useMemo(() => {
    let arr = foldParallels
      ? DISTINCT_CARDS.flatMap((card) => {
        const matchingPrint = variantsOfId(card.id).find((variant) => matchesFilter(variant, filter));
        return matchingPrint ? [matchingPrint] : [];
      })
      : CARD_POOL.filter((card) => matchesFilter(card, filter));
    if (onlyFav) arr = arr.filter(isFav);
    return sortCards(arr, sortKey, sortDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sortKey, sortDir, foldParallels, onlyFav, favSet]);

  useEffect(() => {
    if (filtered.length === 0) return;
    setSelectedNum((currentNum) => {
      const selectedCard = CARD_POOL.find((card) => card.num === currentNum);
      const selectionIsVisible = filtered.some((card) => (
        foldParallels
          ? cardIdOf(card.num) === cardIdOf(currentNum)
          : card.num === currentNum
      ));
      const selectedPrintMatches = selectedCard ? matchesFilter(selectedCard, filter) : false;
      if (selectionIsVisible && (!foldParallels || selectedPrintMatches)) return currentNum;
      const sameCard = filtered.find((card) => cardIdOf(card.num) === cardIdOf(currentNum));
      return (sameCard ?? filtered[0]!).num;
    });
  }, [filter, filtered, foldParallels]);

  const selected = CARD_POOL.find((c) => c.num === selectedNum) ?? DISTINCT_CARDS[0]!;
  const drawerFilterCount = activeFilterCount({ ...filter, q: '' }) + (onlyFav ? 1 : 0) + (!foldParallels ? 1 : 0);

  const closeFilters = () => {
    setFilterOpen(false);
    filterTriggerRef.current?.focus();
    requestAnimationFrame(() => filterTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!filterOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setFilterOpen(false);
        filterTriggerRef.current?.focus();
        requestAnimationFrame(() => filterTriggerRef.current?.focus());
      }
    };
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => filterCloseRef.current?.focus());
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [filterOpen]);

  return (
    <div className="home-screen cards-screen">
      <PrimaryHeader current="cards" onNav={onNav} />

      <main className="cards-main">
        <CardsToolbar
          q={filter.q}
          setQ={(q) => setFilter({ q })}
          filterCount={drawerFilterCount}
          filterOpen={filterOpen}
          filterTriggerRef={filterTriggerRef}
          onOpenFilters={() => setFilterOpen(true)}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={setSort}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        <div className="cards-workspace">
        <CardGrid
          cards={filtered}
          selectedNum={selectedNum}
          onSelect={setSelectedNum}
          onKeyboardSelect={() => {
            requestAnimationFrame(() => selectedPrintRef.current?.focus());
          }}
          isFav={isFav}
          viewMode={viewMode}
          foldParallels={foldParallels}
        />

          <aside className="cards-detail-panel" aria-label="選択中のカード">
            <SelectedDetail
              card={selected}
              isFavorited={isFav(selected)}
              onToggleFavorite={() => {
                // ★ は cardId 単位 (グリッド表示と一致)。解除時は登録済みの全印刷を外す。
                const nums = variantsOfId(selected.id).map((v) => v.num);
                if (isFav(selected)) nums.filter((n) => favSet.has(n)).forEach((n) => toggleFavorite(n));
                else toggleFavorite(nums[0]!);
              }}
              onSelectVariant={setSelectedNum}
              activePrintRef={selectedPrintRef}
            />
          </aside>
        </div>
      </main>

      {filterOpen && (
        <FilterDrawer
          closeRef={filterCloseRef}
          filterCount={drawerFilterCount}
          filter={filter}
          onChange={setFilter}
          onReset={() => {
            resetFilter();
            setOnlyFav(false);
            setFoldParallels(true);
          }}
          pool={CARD_POOL}
          foldParallels={foldParallels}
          setFoldParallels={setFoldParallels}
          onlyFav={onlyFav}
          setOnlyFav={setOnlyFav}
          onClose={closeFilters}
        />
      )}
    </div>
  );
}

function CardsToolbar({
  q, setQ, filterCount, filterOpen, filterTriggerRef, onOpenFilters,
  sortKey, sortDir, onSort, viewMode, setViewMode,
}: {
  q: string;
  setQ: (value: string) => void;
  filterCount: number;
  filterOpen: boolean;
  filterTriggerRef: RefObject<HTMLButtonElement | null>;
  onOpenFilters: () => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey, dir?: SortDir) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}) {
  return (
    <header className="cards-toolbar" aria-label="カード一覧の操作">
      <label className="cards-search">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <line x1="9" y1="9" x2="13" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          aria-label="カードを検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="カード名・番号・効果で検索"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="検索をクリア">×</button>
        )}
      </label>

      <button
        ref={filterTriggerRef}
        type="button"
        className="cards-filter-trigger"
        aria-haspopup="dialog"
        aria-expanded={filterOpen}
        onClick={onOpenFilters}
      >
        <span aria-hidden="true">▽</span>
        絞り込み
        {filterCount > 0 && <strong aria-label={`${filterCount}件の絞り込み`}>{filterCount}</strong>}
      </button>

      <SortControl sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
      <ViewSelector value={viewMode} onChange={setViewMode} />
    </header>
  );
}

function FilterDrawer({
  closeRef, filterCount, filter, onChange, onReset, pool,
  foldParallels, setFoldParallels, onlyFav, setOnlyFav, onClose,
}: {
  closeRef: RefObject<HTMLButtonElement | null>;
  filterCount: number;
  filter: CardFilterState;
  onChange: (patch: Partial<CardFilterState>) => void;
  onReset: () => void;
  pool: readonly CardDef[];
  foldParallels: boolean;
  setFoldParallels: (value: boolean) => void;
  onlyFav: boolean;
  setOnlyFav: (value: boolean) => void;
  onClose: () => void;
}) {
  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="cards-filter-layer">
      <div className="cards-filter-backdrop" aria-hidden="true" onMouseDown={onClose} />
      <aside
        className="cards-filter-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="カードを絞り込む"
        onKeyDown={trapFocus}
      >
        <header>
          <div>
            <span>FILTER</span>
            <h2>絞り込み</h2>
          </div>
          {filterCount > 0 && <strong>{filterCount}</strong>}
          <button ref={closeRef} type="button" onClick={onClose} aria-label="絞り込みを閉じる">×</button>
        </header>

        <div className="cards-filter-options" aria-label="表示条件">
          <Toggle label="別イラストをまとめる" active={foldParallels}
            onClick={() => setFoldParallels(!foldParallels)} accent={T.neonBlue} />
          <Toggle label="★ お気に入りのみ" active={onlyFav}
            onClick={() => setOnlyFav(!onlyFav)} accent={T.gold} />
        </div>

        <div className="cards-filter-scroll">
          <FilterRail
            filter={filter}
            onChange={onChange}
            onReset={onReset}
            pool={pool}
            showCounts={false}
            showMatchModes={false}
          />
        </div>

        <footer>
          <button type="button" className="cards-filter-reset" onClick={onReset}>条件をリセット</button>
          <button type="button" className="cards-filter-apply" onClick={onClose}>一覧を見る</button>
        </footer>
      </aside>
    </div>
  );
}

// ---- Card grid (center) ----

function CardGrid({
  cards, selectedNum, onSelect, onKeyboardSelect, isFav, viewMode, foldParallels,
}: {
  cards: CardDef[]; selectedNum: string; onSelect: (n: string) => void;
  onKeyboardSelect: () => void;
  isFav: (c: CardDef) => boolean;
  viewMode: ViewMode;
  foldParallels: boolean;
}) {
  const cardWidth = viewMode === 'large' ? 150 : viewMode === 'grid' ? 104 : 0;
  // 折り畳み時は選択中印刷がグリッドに無い (別イラスト選択) ことがあるので cardId 一致で判定。
  const isSel = (c: CardDef) => foldParallels ? cardIdOf(c.num) === cardIdOf(selectedNum) : c.num === selectedNum;
  return (
    <section className="cards-grid-panel" aria-label="カード一覧">
      <span className="home-sr-only" role="status" aria-live="polite">{cards.length}件のカード</span>
      {cards.length === 0 ? (
        <div className="cards-empty">
          条件に一致するカードがありません
        </div>
      ) : viewMode === 'list' ? (
        <div className="cards-list-scroll">
          {cards.map((c) => (
            <CardListRow key={c.num} card={c} selected={isSel(c)}
              fav={isFav(c)} onClick={() => onSelect(c.num)}
              onKeyboardSelect={onKeyboardSelect} />
          ))}
        </div>
      ) : (
        <div className="cards-grid-scroll" data-view={viewMode}>
          <div className="cards-card-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth + 8}px, 1fr))` }}>
            {cards.map((c) => (
              <div
                className="cards-grid-item"
                data-card-num={c.num}
                key={c.num}
                onKeyDownCapture={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    requestAnimationFrame(onKeyboardSelect);
                  }
                }}
              >
                <MetaCard card={c} w={cardWidth} selected={isSel(c)}
                  isFavorited={isFav(c)}
                  onClick={() => onSelect(c.num)} hoverable />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function visibleStatsFor(card: CardDef) {
  if (card.type === 'character') {
    return [
      { label: 'C', value: card.cost ?? '-', accent: T.neonBlue },
      { label: 'AP', value: card.ap != null ? card.ap.toLocaleString() : '-', accent: T.apColor },
      { label: 'LP', value: card.lp ?? '-', accent: T.lpColor },
    ];
  }
  if (card.type === 'event') {
    return [{ label: 'C', value: card.cost ?? '-', accent: T.neonBlue }];
  }
  if (card.type === 'partner') {
    return [{ label: 'LP', value: card.lp ?? '-', accent: T.lpColor }];
  }
  return [
    { label: '先攻', value: card.difficultyFirst != null ? `${card.difficultyFirst}枚` : '-', accent: T.neonBlue },
    { label: '後攻', value: card.difficultySecond != null ? `${card.difficultySecond}枚` : '-', accent: T.apColor },
  ];
}

function CardListRow({ card, selected, fav, onClick, onKeyboardSelect }: {
  card: CardDef; selected: boolean; fav: boolean; onClick: () => void;
  onKeyboardSelect: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
          requestAnimationFrame(onKeyboardSelect);
        }
      }}
      className="meta-row"
      style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px',
      background: selected ? `${T.gold}11` : 'transparent',
      border: selected ? `1px solid ${T.gold}55` : '1px solid transparent',
      borderRadius: 3, cursor: 'pointer', textAlign: 'left', color: T.textPrimary,
    }}>
      <div style={{ width: 30, height: 42, borderRadius: 2, overflow: 'hidden', flexShrink: 0, background: '#0a1a28' }}>
        <MetaCard card={card} w={30} hoverable={false} />
      </div>
      <ColorPills card={card} compact />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fav && <span style={{ color: T.gold, marginRight: 4 }}>★</span>}{card.name}
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted }}>
          {card.num} · {typeLabel(card.type)}{(card.features ?? []).length ? ' · ' + (card.features ?? []).join('/') : ''}
        </div>
      </div>
      {visibleStatsFor(card).map((stat) => (
        <StatChip key={stat.label} label={stat.label} value={stat.value} hex={stat.accent} />
      ))}
    </button>
  );
}

function StatChip({ label, value, hex }: { label: string; value: string | number; hex: string }) {
  return (
    <div role="group" aria-label={`${label} ${value}`} style={{ width: 46, textAlign: 'center' }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted }}>{label} </span>
      <span style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 700, color: hex }}>{value}</span>
    </div>
  );
}

function SortControl({ sortKey, sortDir, onSort }: {
  sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey, d?: SortDir) => void;
}) {
  return (
    <div className="cards-sort-control">
      <select value={sortKey} aria-label="カードの並び順"
        onChange={(event) => onSort(event.target.value as SortKey, sortDir)}>
        {SORTS.map((sort) => <option key={sort.k} value={sort.k}>{sort.label}順</option>)}
      </select>
      <button type="button"
        aria-label={sortDir === 'asc' ? '昇順。降順へ切り替える' : '降順。昇順へ切り替える'}
        onClick={() => onSort(sortKey, sortDir === 'asc' ? 'desc' : 'asc')}>
        {sortDir === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  );
}

function ViewSelector({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const modes: { v: ViewMode; title: string }[] = [
    { v: 'large', title: '大きいタイル' },
    { v: 'grid',  title: '小さいタイル' },
    { v: 'list',  title: 'リスト' },
  ];
  return (
    <div className="cards-view-selector" role="group" aria-label="カードの表示形式">
      {modes.map((m, i) => (
        <button key={m.v} type="button" onClick={() => onChange(m.v)} title={m.title}
          aria-label={m.title} aria-pressed={value === m.v}
          data-last={i === modes.length - 1 ? 'true' : undefined}>
          <ViewModeIcon mode={m.v} />
        </button>
      ))}
    </div>
  );
}

function ViewModeIcon({ mode }: { mode: ViewMode }) {
  if (mode === 'list') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 5h3M8 5h9M3 10h3M8 10h9M3 15h3M8 15h9" />
      </svg>
    );
  }
  const cells = mode === 'large'
    ? [[3, 3, 6, 6], [11, 3, 6, 6], [3, 11, 6, 6], [11, 11, 6, 6]]
    : Array.from({ length: 9 }, (_, index) => [3 + (index % 3) * 5.5, 3 + Math.floor(index / 3) * 5.5, 3, 3]);
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {cells.map(([x, y, width, height], index) => (
        <rect key={index} x={x} y={y} width={width} height={height} rx="0.6" />
      ))}
    </svg>
  );
}

function Toggle({ label, active, onClick, accent }: { label: string; active: boolean; onClick: () => void; accent: string }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{
      padding: '4px 10px', borderRadius: 2, cursor: 'pointer',
      background: active ? `${accent}22` : 'rgba(0,0,0,0.3)',
      border: `1px solid ${active ? accent : accent + '33'}`,
      color: active ? accent : T.textMuted,
      fontFamily: T.fontJp, fontSize: 11, fontWeight: active ? 700 : 500,
    }}>{label}</button>
  );
}

// ---- Selected card detail ----

function SelectedDetail({
  card,
  isFavorited,
  onToggleFavorite,
  onSelectVariant,
  activePrintRef,
}: {
  card: CardDef;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onSelectVariant: (num: string) => void;
  activePrintRef: RefObject<HTMLButtonElement | null>;
}) {
  const color = COLOR_TOKEN[card.color];
  const variants = variantsOfId(card.id);
  const stats = visibleStatsFor(card);
  // クリックで拡大表示 (対戦画面と同じ CardExpandModal を流用)。
  const [expanded, setExpanded] = useState(false);
  const moveVariantFocus = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % variants.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + variants.length) % variants.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = variants.length - 1;
    }
    if (nextIndex == null) return;

    event.preventDefault();
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '.cards-print-chip',
    );
    onSelectVariant(variants[nextIndex]!.num);
    buttons?.[nextIndex]?.focus();
  };
  return (
    <>
    <div className="cards-selected-detail" style={{
      width: '100%', height: '100%', padding: '18px 20px 20px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.75))',
      border: `1px solid ${color}66`, borderRadius: 4,
      boxShadow: `inset 0 0 40px ${color}15`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 0,
    }}>
      <div className="cards-selected-scroll">
      <button
        ref={variants.length === 1 ? activePrintRef : undefined}
        type="button"
        onClick={() => setExpanded(true)}
        title="クリックで拡大表示"
        aria-label={`${card.name} を拡大表示`}
        className="cards-selected-art"
        style={{
          alignSelf: 'center', padding: 0, border: 'none', background: 'transparent', cursor: 'zoom-in',
          filter: `drop-shadow(0 0 24px ${color}66) drop-shadow(0 8px 16px rgba(0,0,0,0.7))`,
        }}
      >
        <MetaCard card={card} w={190} hoverable={false} />
      </button>

      {variants.length > 1 && (
        <div className="cards-print-selector cards-print-variants" role="radiogroup" aria-label="別イラスト">
          <div className="cards-print-summary">
            <span>{card.name} · {card.num}</span>
            <span className="cards-print-label">別イラスト ({variants.length})</span>
          </div>
          <div className="cards-print-strip">
            {variants.map((variant, index) => {
              const selected = variant.num === card.num;
              return (
              <button
                key={variant.num}
                className="cards-print-chip"
                type="button"
                role="radio"
                aria-label={`印刷番号 ${variant.num}`}
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                ref={selected ? activePrintRef : undefined}
                onClick={(event) => {
                  onSelectVariant(variant.num);
                  if (event.detail > 0) event.currentTarget.blur();
                }}
                onKeyDown={(event) => moveVariantFocus(event, index)}
              >
                <span className="cards-print-chip-inner">{variant.num}</span>
              </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="cards-selected-identity">
        <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'baseline' }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.16em' }}>{card.num}</span>
          <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textDisabled }}>ID {card.id}</span>
          {card.rarity && (
            <span style={{ padding: '1px 6px', background: rarityHex(card.rarity), color: '#1a1208', fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, letterSpacing: '0.15em' }}>
              {card.rarity}
            </span>
          )}
          <ColorPills card={card} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.04em' }}>{card.name}</div>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.1em', marginTop: 2 }}>
          {typeLabel(card.type)}{card.features && card.features.length > 0 ? ' · ' + card.features.join(' / ') : ''}
        </div>
      </div>

      <div className="cards-selected-stats" role="group" aria-label="カードの能力値" style={{ display: 'flex', gap: 6 }}>
        {stats.map((stat) => (
          <SmallStat key={stat.label} {...stat} />
        ))}
      </div>

      {card.effectShort && (
        <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${color}33`, borderRadius: 3 }}>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: T.textPrimary, whiteSpace: 'pre-wrap' }}>
            {card.effectShort}
          </div>
        </div>
      )}

      {(card.keywords ?? []).length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(card.keywords ?? []).map((k) => (
            <span key={k} style={{
              padding: '2px 8px', background: 'rgba(255,215,0,0.15)', border: `1px solid ${T.gold}66`,
              borderRadius: 2, fontFamily: T.fontJp, fontSize: 11, fontWeight: 700, color: T.gold,
            }}>{k}</span>
          ))}
        </div>
      )}

      </div>
      <div className="cards-selected-footer">
        <button className="cards-favorite-action" type="button" onClick={onToggleFavorite} aria-pressed={isFavorited} style={{
          flex: 1, padding: '8px', textAlign: 'center', cursor: 'pointer',
          background: isFavorited ? `${T.gold}33` : 'rgba(0,0,0,0.4)',
          border: `1px solid ${T.gold}${isFavorited ? 'cc' : '66'}`, borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.18em',
        }}>
          {isFavorited ? '★ お気に入り 解除' : '★ お気に入り'}
        </button>
      </div>
    </div>
    <CardExpandModal cardId={expanded ? card.num : null} onClose={() => setExpanded(false)} />
    </>
  );
}

function ColorPills({ card, compact = false }: { card: CardDef; compact?: boolean }) {
  const colors = card.colors ?? [card.color];
  return (
    <span data-card-colors={colors.join(',')} aria-label={`色: ${colors.join(',')}`} style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
      {colors.map((color) => (
        <span key={color} title={color} style={{
          width: compact ? 14 : 'auto', height: compact ? 14 : 'auto', minWidth: compact ? 14 : undefined,
          padding: compact ? 0 : '1px 5px', borderRadius: compact ? '50%' : 2,
          background: COLOR_TOKEN[color], border: `1px solid ${T.bgDeep}`,
          color: compact ? 'transparent' : '#06111d', fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
        }}>{compact ? '' : color.toUpperCase()}</span>
      ))}
    </span>
  );
}

// ---- Helpers ----

function SmallStat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div role="group" aria-label={`${label} ${value}`} style={{ flex: 1, padding: '6px 8px', textAlign: 'center', background: `${accent}15`, border: `1px solid ${accent}55`, borderRadius: 2 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function typeLabel(t: CardKind): string {
  return ({ partner: 'パートナー', character: 'キャラ', event: 'イベント', case: '事件' } as const)[t];
}
