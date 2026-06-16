// spec: .claude/specs/meta-ui/07-screens-library.md + 11-cards-rebuild.md
// 原典: design-mockups_v2/08-cards.jsx
// Phase 18: Master Duel 風リデザイン
//   - 「種類」は cardId 単位 (パラレルを畳む)。CATALOG は所有率ではなくカタログ概要に。
//   - 共有 FilterRail (色/種別/コスト/レアリティ/特徴/キーワード, OR/AND, sticky)
//   - 検索は 名前/番号/ID/特徴/効果テキスト
//   - ソート 番号/コスト/AP/LP/名前 (昇降) + ★お気に入り/採用中フィルタ
//   - 表示 グリッド大/小 + リスト行 + パラレルまとめトグル + キーボード操作 (MetaCard)

import { useMemo, useState } from 'react';
import { T, COLOR_TOKEN } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { MetaCard } from '../shared/MetaCard';
import { CardExpandModal } from '@/ui/components/CardExpandModal';
import { FilterRail } from '../shared/FilterRail';
import {
  CARD_POOL, DISTINCT_CARDS, DISTINCT_CARD_COUNT, cardIdOf, variantsOfId,
} from '../data/cardPool';
import { useDecksStore } from '../state/decksStore';
import { useHistoryStore } from '../state/historyStore';
import { useMetaStore } from '../state/metaStore';
import { useFiltersStore } from '../state/filtersStore';
import {
  matchesFilter, sortCards, ALL_RARITIES, COLOR_META, rarityHex, type SortKey, type SortDir,
} from '../data/cardFilter';
import type { CardColor, CardDef, CardKind } from '../data/types';
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

const TOTAL_PRINTS = CARD_POOL.length;
const PARALLEL_GROUPS = TOTAL_PRINTS - DISTINCT_CARD_COUNT;

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
  const [onlyAdopted, setOnlyAdopted] = useState(false);
  const [selectedNum, setSelectedNum] = useState<string>(DISTINCT_CARDS[0]?.num ?? '');

  const favorites = useMetaStore((s) => s.settings.favorites ?? []);
  const toggleFavorite = useMetaStore((s) => s.toggleFavorite);
  const decks = useDecksStore((s) => s.decks);
  const history = useHistoryStore((s) => s.history);

  const favSet = useMemo(() => new Set(favorites), [favorites]);
  // cardId が採用されているデッキ数 (パラレルを合算)。
  const adoptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of decks) {
      const ids = new Set(d.cards.map((e) => cardIdOf(e.num)));
      for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [decks]);

  const isFav = (c: CardDef) => variantsOfId(c.id).some((v) => favSet.has(v.num));

  const filtered = useMemo(() => {
    const base = foldParallels ? DISTINCT_CARDS : CARD_POOL;
    let arr = base.filter((c) => matchesFilter(c, filter));
    if (onlyFav) arr = arr.filter(isFav);
    if (onlyAdopted) arr = arr.filter((c) => (adoptions.get(c.id) ?? 0) > 0);
    return sortCards(arr, sortKey, sortDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sortKey, sortDir, foldParallels, onlyFav, onlyAdopted, adoptions, favSet]);

  const selected = CARD_POOL.find((c) => c.num === selectedNum) ?? DISTINCT_CARDS[0]!;

  const usage = useMemo(() => {
    const inDecks = decks.filter((d) => d.cards.some((e) => cardIdOf(e.num) === selected.id));
    const deckNames = new Set(inDecks.map((d) => d.name));
    const related = history.filter((m) => deckNames.has(m.deckName));
    const wins = related.filter((m) => m.won).length;
    const rate = related.length > 0 ? Math.round((wins / related.length) * 100) : 0;
    const mvpCount = history.filter((m) => m.mvp && cardIdOf(m.mvp) === selected.id).length;
    return { inDecks: inDecks.length, totalDecks: decks.length, winRate: rate, mvp: mvpCount };
  }, [selected.id, decks, history]);

  const catalog = useMemo(() => computeCatalog(), []);

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
      <AppTopBar page="cards" onNav={(r) => onNav(r as Route)} />

      <SubToolbar
        q={filter.q} setQ={(q) => setFilter({ q })}
        matched={filtered.length}
        distinct={DISTINCT_CARD_COUNT} total={TOTAL_PRINTS}
      />

      <div style={{
        position: 'absolute', left: 24, right: 24, top: 134, bottom: 16,
        display: 'grid', gridTemplateColumns: '260px 1fr 360px', gap: 14,
      }}>
        {/* LEFT: CATALOG + FILTERS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', minHeight: 0 }}>
          <CatalogPanel catalog={catalog} />
          <FilterRail filter={filter} onChange={setFilter} onReset={resetFilter}
            pool={foldParallels ? DISTINCT_CARDS : CARD_POOL} />
        </div>

        {/* CENTER: grid */}
        <CardGrid
          cards={filtered}
          selectedNum={selectedNum}
          onSelect={setSelectedNum}
          isFav={isFav}
          adoptions={adoptions}
          viewMode={viewMode} setViewMode={setViewMode}
          sortKey={sortKey} sortDir={sortDir} onSort={setSort}
          foldParallels={foldParallels} setFoldParallels={setFoldParallels}
          onlyFav={onlyFav} setOnlyFav={setOnlyFav}
          onlyAdopted={onlyAdopted} setOnlyAdopted={setOnlyAdopted}
        />

        {/* RIGHT: detail */}
        <SelectedDetail
          card={selected}
          usage={usage}
          isFavorited={isFav(selected)}
          onToggleFavorite={() => {
            // ★ は cardId 単位 (グリッド表示と一致)。解除時は登録済みの全印刷を外す。
            const nums = variantsOfId(selected.id).map((v) => v.num);
            if (isFav(selected)) nums.filter((n) => favSet.has(n)).forEach((n) => toggleFavorite(n));
            else toggleFavorite(nums[0]!);
          }}
          onSelectVariant={setSelectedNum}
          onAddToDeck={() => onNav('deck')}
        />
      </div>
    </div>
  );
}

// ---- SubToolbar (title + search) ----

function SubToolbar({ q, setQ, matched, distinct, total }: {
  q: string; setQ: (s: string) => void; matched: number; distinct: number; total: number;
}) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 64, height: 60,
      display: 'flex', alignItems: 'center', padding: '0 32px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
      borderBottom: `1px solid rgba(78,195,255,0.15)`, zIndex: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>COLLECTION</span>
        <span style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.06em' }}>証拠ファイル</span>
        <span style={{
          padding: '3px 10px',
          background: 'rgba(255,215,0,0.15)', border: `1px solid ${T.gold}66`, borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, color: T.gold, letterSpacing: '0.1em',
        }}>
          {distinct} 種類 · 全 {total} 種
        </span>
      </div>

      <div style={{
        marginLeft: 36, flex: 1, maxWidth: 420,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', background: 'rgba(0,0,0,0.45)',
        border: `1px solid ${T.gold}44`, borderRadius: 3,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="6" cy="6" r="4" stroke={T.gold} strokeWidth="1.4" fill="none" />
          <line x1="9" y1="9" x2="13" y2="13" stroke={T.gold} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前 / 効果 / 番号 / 特徴 で検索"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: T.textPrimary, fontFamily: T.fontJp, fontSize: 13 }}
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="検索クリア" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: T.textMuted, fontFamily: T.fontMono, fontSize: 14, lineHeight: 1,
          }}>×</button>
        )}
      </div>
      <span style={{ marginLeft: 14, fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.12em' }}>
        {matched} 件
      </span>
    </div>
  );
}

// ---- CATALOG panel (replaces fake 100% COVERAGE) ----

interface Catalog {
  byColor: Map<CardColor, number>;
  byType: Map<CardKind, number>;
  byRarity: Map<string, number>;
}
function computeCatalog(): Catalog {
  const byColor = new Map<CardColor, number>();
  const byType = new Map<CardKind, number>();
  const byRarity = new Map<string, number>();
  const inc = <K,>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const c of DISTINCT_CARDS) {
    for (const col of c.colors ?? [c.color]) inc(byColor, col); // 混色は各色に計上
    inc(byType, c.type);
    if (c.rarity) inc(byRarity, c.rarity);
  }
  return { byColor, byType, byRarity };
}

function CatalogPanel({ catalog }: { catalog: Catalog }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
        <Label gold>CATALOG</Label>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>カタログ</span>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: T.fontSerif, fontSize: 50, fontWeight: 900, color: T.gold, lineHeight: 1 }}>
          {DISTINCT_CARD_COUNT}<span style={{ fontSize: 22, marginLeft: 4 }}>種類</span>
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.14em', marginTop: 4 }}>
          全 {TOTAL_PRINTS} 種 (パラレル {PARALLEL_GROUPS} 組を含む)
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label muted>BY COLOR</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {COLOR_META.map((x) => (
            <BreakdownRow key={x.c} color={x.hex} label={x.label}
              value={catalog.byColor.get(x.c) ?? 0} total={DISTINCT_CARD_COUNT} />
          ))}
        </div>
      </div>
      {ALL_RARITIES.length > 0 && (
        <div>
          <Label muted>BY RARITY</Label>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {ALL_RARITIES.map((r) => (
              <div key={r} style={{
                flex: 1, padding: '6px 4px', textAlign: 'center',
                background: 'rgba(0,0,0,0.4)', border: `1px solid ${rarityHex(r)}44`, borderRadius: 2,
              }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: rarityHex(r), letterSpacing: '0.15em' }}>{r}</div>
                <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textPrimary, marginTop: 1 }}>{catalog.byRarity.get(r) ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 14, height: 14, background: color, borderRadius: 2 }} />
      <div style={{ width: 28, fontFamily: T.fontJp, fontSize: 12, color: T.textPrimary, fontWeight: 700 }}>{label}</div>
      <div style={{ flex: 1, height: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, minWidth: 20, textAlign: 'right' }}>{value}</div>
    </div>
  );
}

// ---- Card grid (center) ----

function CardGrid({
  cards, selectedNum, onSelect, isFav, adoptions,
  viewMode, setViewMode, sortKey, sortDir, onSort,
  foldParallels, setFoldParallels, onlyFav, setOnlyFav, onlyAdopted, setOnlyAdopted,
}: {
  cards: CardDef[]; selectedNum: string; onSelect: (n: string) => void;
  isFav: (c: CardDef) => boolean; adoptions: Map<string, number>;
  viewMode: ViewMode; setViewMode: (m: ViewMode) => void;
  sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey, d?: SortDir) => void;
  foldParallels: boolean; setFoldParallels: (b: boolean) => void;
  onlyFav: boolean; setOnlyFav: (b: boolean) => void;
  onlyAdopted: boolean; setOnlyAdopted: (b: boolean) => void;
}) {
  const cardWidth = viewMode === 'large' ? 150 : viewMode === 'grid' ? 104 : 0;
  // 折り畳み時は選択中印刷がグリッドに無い (別イラスト選択) ことがあるので cardId 一致で判定。
  const isSel = (c: CardDef) => foldParallels ? cardIdOf(c.num) === cardIdOf(selectedNum) : c.num === selectedNum;
  return (
    <div style={{
      width: '100%', height: '100%', padding: '12px 16px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* header row 1: count + view + sort */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Label gold>CARDS · {cards.length} 件 一致</Label>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.15em' }}>並び</span>
          <SortControl sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          <span style={{ width: 1, height: 20, background: 'rgba(78,195,255,0.2)' }} />
          <ViewSelector value={viewMode} onChange={setViewMode} />
        </div>
      </div>
      {/* header row 2: toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Toggle label="パラレルまとめ" active={foldParallels} onClick={() => setFoldParallels(!foldParallels)} accent={T.neonBlue} />
        <Toggle label="★ お気に入りのみ" active={onlyFav} onClick={() => setOnlyFav(!onlyFav)} accent={T.gold} />
        <Toggle label="採用中のみ" active={onlyAdopted} onClick={() => setOnlyAdopted(!onlyAdopted)} accent={T.green} />
      </div>

      {cards.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted, fontFamily: T.fontMono, fontSize: 12 }}>
          条件に一致するカードがありません
        </div>
      ) : viewMode === 'list' ? (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {cards.map((c) => (
            <CardListRow key={c.num} card={c} selected={isSel(c)}
              fav={isFav(c)} adopt={adoptions.get(c.id) ?? 0} onClick={() => onSelect(c.num)} />
          ))}
        </div>
      ) : (
        <div style={{
          flex: 1, overflow: 'auto',
          display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth + 8}px, 1fr))`,
          gap: 12, alignContent: 'start',
        }}>
          {cards.map((c) => (
            <div key={c.num} style={{ display: 'flex', justifyContent: 'center' }}>
              <MetaCard card={c} w={cardWidth} selected={isSel(c)}
                count={adoptions.get(c.id) || undefined} isFavorited={isFav(c)}
                onClick={() => onSelect(c.num)} hoverable />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardListRow({ card, selected, fav, adopt, onClick }: {
  card: CardDef; selected: boolean; fav: boolean; adopt: number; onClick: () => void;
}) {
  const c = COLOR_TOKEN[card.color] || T.blue;
  return (
    <button onClick={onClick} className="meta-row" style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px',
      background: selected ? `${T.gold}11` : 'transparent',
      border: selected ? `1px solid ${T.gold}55` : '1px solid transparent',
      borderRadius: 3, cursor: 'pointer', textAlign: 'left', color: T.textPrimary,
    }}>
      <div style={{ width: 30, height: 42, borderRadius: 2, overflow: 'hidden', flexShrink: 0, background: '#0a1a28' }}>
        <MetaCard card={card} w={30} hoverable={false} />
      </div>
      <div style={{ width: 18, height: 18, flexShrink: 0, borderRadius: '50%',
        background: c, border: `1px solid ${T.bgDeep}` }} title={card.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fav && <span style={{ color: T.gold, marginRight: 4 }}>★</span>}{card.name}
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted }}>
          {card.num} · {typeLabel(card.type)}{(card.features ?? []).length ? ' · ' + (card.features ?? []).join('/') : ''}
        </div>
      </div>
      <StatChip label="C" value={card.cost ?? '—'} hex={T.neonBlue} />
      <StatChip label="AP" value={card.ap != null ? card.ap.toLocaleString() : '—'} hex={T.apColor} />
      <StatChip label="LP" value={card.lp ?? '—'} hex={T.lpColor} />
      <div style={{ width: 50, textAlign: 'right', fontFamily: T.fontMono, fontSize: 9, color: adopt > 0 ? T.green : T.textDisabled }}>
        {adopt > 0 ? `採用 ${adopt}` : '未採用'}
      </div>
    </button>
  );
}

function StatChip({ label, value, hex }: { label: string; value: string | number; hex: string }) {
  return (
    <div style={{ width: 46, textAlign: 'center' }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted }}>{label} </span>
      <span style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 700, color: hex }}>{value}</span>
    </div>
  );
}

function SortControl({ sortKey, sortDir, onSort }: {
  sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey, d?: SortDir) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {SORTS.map((s) => {
        const active = sortKey === s.k;
        return (
          <button key={s.k} onClick={() => onSort(s.k, active ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc')} style={{
            padding: '4px 8px', borderRadius: 2, cursor: 'pointer',
            background: active ? `${T.gold}22` : 'rgba(0,0,0,0.35)',
            border: `1px solid ${active ? T.gold : T.neonBlue + '44'}`,
            color: active ? T.gold : T.neonBlue,
            fontFamily: T.fontJp, fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            {s.label}{active && <span style={{ fontFamily: T.fontMono, fontSize: 9 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ViewSelector({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const modes: { v: ViewMode; icon: string; title: string }[] = [
    { v: 'large', icon: '▢', title: '大きいタイル' },
    { v: 'grid',  icon: '▦', title: '小さいタイル' },
    { v: 'list',  icon: '☰', title: 'リスト' },
  ];
  return (
    <div style={{ display: 'flex', border: `1px solid rgba(78,195,255,0.3)`, borderRadius: 2, overflow: 'hidden' }}>
      {modes.map((m, i) => (
        <button key={m.v} onClick={() => onChange(m.v)} title={m.title} aria-label={m.title} style={{
          padding: '5px 9px',
          background: value === m.v ? T.gold : 'rgba(0,0,0,0.3)',
          color: value === m.v ? '#1a1208' : T.textSecondary,
          fontFamily: T.fontMono, fontSize: 12, fontWeight: 800, cursor: 'pointer',
          borderRight: i < modes.length - 1 ? `1px solid rgba(78,195,255,0.2)` : 'none',
        }}>{m.icon}</button>
      ))}
    </div>
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

function SelectedDetail({ card, usage, isFavorited, onToggleFavorite, onSelectVariant, onAddToDeck }: {
  card: CardDef;
  usage: { inDecks: number; totalDecks: number; winRate: number; mvp: number };
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onSelectVariant: (num: string) => void;
  onAddToDeck: () => void;
}) {
  const color = COLOR_TOKEN[card.color];
  const variants = variantsOfId(card.id);
  // クリックで拡大表示 (対戦画面と同じ CardExpandModal を流用)。
  const [expanded, setExpanded] = useState(false);
  return (
    <>
    <div style={{
      width: '100%', height: '100%', padding: '18px 20px 20px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.75))',
      border: `1px solid ${color}66`, borderRadius: 4,
      boxShadow: `inset 0 0 40px ${color}15`,
      display: 'flex', flexDirection: 'column', overflow: 'auto', gap: 10,
    }}>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        title="クリックで拡大表示"
        aria-label={`${card.name} を拡大表示`}
        style={{
          alignSelf: 'center', padding: 0, border: 'none', background: 'transparent', cursor: 'zoom-in',
          filter: `drop-shadow(0 0 24px ${color}66) drop-shadow(0 8px 16px rgba(0,0,0,0.7))`,
        }}
      >
        <MetaCard card={card} w={190} hoverable={false} />
      </button>

      {variants.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.12em' }}>別イラスト</span>
          {variants.map((v) => (
            <button key={v.num} onClick={() => onSelectVariant(v.num)} style={{
              padding: '2px 7px', cursor: 'pointer', borderRadius: 2,
              background: v.num === card.num ? `${T.gold}22` : 'rgba(0,0,0,0.4)',
              border: `1px solid ${v.num === card.num ? T.gold : T.textMuted + '55'}`,
              color: v.num === card.num ? T.gold : T.textMuted,
              fontFamily: T.fontMono, fontSize: 10, fontWeight: 700,
            }}>{v.num}</button>
          ))}
        </div>
      )}

      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'baseline' }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.16em' }}>{card.num}</span>
          <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textDisabled }}>ID {card.id}</span>
          {card.rarity && (
            <span style={{ padding: '1px 6px', background: rarityHex(card.rarity), color: '#1a1208', fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, letterSpacing: '0.15em' }}>
              {card.rarity}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: usage.inDecks > 0 ? T.green : T.textMuted, letterSpacing: '0.12em' }}>
            {usage.inDecks > 0 ? `採用 ${usage.inDecks}` : '未採用'}
          </span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.04em' }}>{card.name}</div>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.1em', marginTop: 2 }}>
          {typeLabel(card.type)}{card.features && card.features.length > 0 ? ' · ' + card.features.join(' / ') : ''}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <SmallStat label="C"  value={card.cost ?? '-'} accent={T.neonBlue} />
        <SmallStat label="AP" value={card.ap != null ? card.ap.toLocaleString() : '-'} accent={T.apColor} />
        <SmallStat label="LP" value={card.lp ?? '-'} accent={T.lpColor} />
      </div>

      {card.effectShort && (
        <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${color}33`, borderRadius: 3 }}>
          <Label gold small>EFFECT · 効果</Label>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: T.textPrimary, marginTop: 4, whiteSpace: 'pre-wrap' }}>
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

      <div>
        <Label muted>USAGE · このカードでの戦績</Label>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <UsageStat label="採用デッキ" value={`${usage.inDecks} / ${usage.totalDecks}`} />
          <UsageStat label="勝率(採用時)" value={`${usage.winRate}%`} highlight />
          <UsageStat label="MVP 数" value={String(usage.mvp)} highlight />
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
        <button onClick={onToggleFavorite} style={{
          flex: 1, padding: '8px', textAlign: 'center', cursor: 'pointer',
          background: isFavorited ? `${T.gold}33` : 'rgba(0,0,0,0.4)',
          border: `1px solid ${T.gold}${isFavorited ? 'cc' : '66'}`, borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.18em',
        }}>
          {isFavorited ? '★ お気に入り 解除' : '★ お気に入り'}
        </button>
        <button onClick={onAddToDeck} style={{
          flex: 1, padding: '8px', textAlign: 'center', cursor: 'pointer',
          background: T.neonBlue, color: '#0a1a28', borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
        }}>
          + デッキへ追加
        </button>
      </div>
    </div>
    <CardExpandModal cardId={expanded ? card.num : null} onClose={() => setExpanded(false)} />
    </>
  );
}

// ---- Helpers ----

function Label({ children, gold, muted, small }: { children: React.ReactNode; gold?: boolean; muted?: boolean; small?: boolean }) {
  return (
    <span style={{
      fontFamily: T.fontMono, fontSize: small ? 9 : 11, fontWeight: 800,
      color: gold ? T.gold : muted ? T.textMuted : T.textPrimary,
      letterSpacing: small ? '0.2em' : '0.28em',
    }}>{children}</span>
  );
}

function SmallStat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{ flex: 1, padding: '6px 8px', textAlign: 'center', background: `${accent}15`, border: `1px solid ${accent}55`, borderRadius: 2 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function UsageStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ flex: 1, padding: '7px 9px', background: 'rgba(0,0,0,0.4)', border: `1px solid rgba(78,195,255,0.2)`, borderRadius: 2, lineHeight: 1.2 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.15em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 14, fontWeight: 800, color: highlight ? T.gold : T.textPrimary, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function typeLabel(t: CardKind): string {
  return ({ partner: 'パートナー', character: 'キャラ', event: 'イベント', case: '事件' } as const)[t];
}
