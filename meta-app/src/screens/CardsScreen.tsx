// spec: .claude/specs/meta-ui/07-screens-library.md + 11-cards-rebuild.md
// 原典: design-mockups_v2/08-cards.jsx (479 行)
// Phase 12-C: COVERAGE パネル + 検索 + ソート + フィルター + リッチ詳細 + USAGE

import { useMemo, useState } from 'react';
import { T, COLOR_TOKEN } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { MetaCard } from '../shared/MetaCard';
import { CARD_POOL } from '../data/cardPool';
import { useDecksStore } from '../state/decksStore';
import { useHistoryStore } from '../state/historyStore';
import { useMetaStore } from '../state/metaStore';
import type { CardColor, CardDef, CardKind } from '../data/types';
import type { Route } from '../router/routes';

interface Props {
  onNav: (r: Route) => void;
}

type SortMode = 'new' | 'cost';
type ViewMode = 'grid' | 'list' | 'stack';

const COLORS: { c: CardColor; label: string; hex: string }[] = [
  { c: 'blue',   label: '青', hex: T.blue },
  { c: 'yellow', label: '黄', hex: T.yellow },
  { c: 'red',    label: '赤', hex: T.red },
  { c: 'green',  label: '緑', hex: T.green },
  { c: 'purple', label: '紫', hex: T.purple },
];

const TYPES: { t: CardKind; label: string; hex: string }[] = [
  { t: 'partner',   label: 'パートナー', hex: T.gold },
  { t: 'character', label: 'キャラ',     hex: T.neonBlue },
  { t: 'event',     label: 'イベント',   hex: T.purple },
  { t: 'case',      label: '事件',       hex: T.red },
];

const RARITIES: { label: string; hex: string }[] = [
  { label: 'D',  hex: T.textSecondary },
  { label: 'C',  hex: T.green },
  { label: 'R',  hex: T.neonBlue },
  { label: 'SR', hex: T.gold },
];

export function CardsScreen({ onNav }: Props) {
  const [colorFilter, setColorFilter] = useState<Set<CardColor>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<CardKind>>(new Set());
  const [keywordFilter, setKeywordFilter] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('new');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedNum, setSelectedNum] = useState<string>(CARD_POOL[0]?.num ?? '');

  const favorites = useMetaStore((s) => s.settings.favorites ?? []);
  const toggleFavorite = useMetaStore((s) => s.toggleFavorite);
  const decks = useDecksStore((s) => s.decks);
  const history = useHistoryStore((s) => s.history);

  const filtered = useMemo(() => {
    let arr = CARD_POOL.slice();
    if (colorFilter.size) arr = arr.filter((c) => colorFilter.has(c.color));
    if (typeFilter.size) arr = arr.filter((c) => typeFilter.has(c.type));
    if (keywordFilter.size) {
      arr = arr.filter((c) =>
        (c.keywords ?? []).some((k) => keywordFilter.has(k))
      );
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      arr = arr.filter((c) =>
        c.name.toLowerCase().includes(needle) ||
        c.num.toLowerCase().includes(needle) ||
        (c.features ?? []).some((f) => f.toLowerCase().includes(needle))
      );
    }
    if (sortMode === 'cost') {
      arr.sort((a, b) => (a.cost ?? 99) - (b.cost ?? 99));
    } else {
      arr.sort((a, b) => b.num.localeCompare(a.num));
    }
    return arr;
  }, [colorFilter, typeFilter, keywordFilter, q, sortMode]);

  const selected = CARD_POOL.find((c) => c.num === selectedNum) ?? CARD_POOL[0]!;

  const adoptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of decks) for (const e of d.cards) m.set(e.num, (m.get(e.num) ?? 0) + 1);
    return m;
  }, [decks]);

  const usage = useMemo(() => {
    const inDecks = decks.filter((d) => d.cards.some((e) => e.num === selected.num));
    const deckNames = new Set(inDecks.map((d) => d.name));
    const related = history.filter((m) => deckNames.has(m.deckName));
    const wins = related.filter((m) => m.won).length;
    const rate = related.length > 0 ? Math.round((wins / related.length) * 100) : 0;
    const mvpCount = history.filter((m) => m.mvp === selected.num).length;
    return { inDecks: inDecks.length, totalDecks: decks.length, winRate: rate, mvp: mvpCount };
  }, [selected.num, decks, history]);

  const totals = useMemo(() => {
    const byColor = new Map<CardColor, number>();
    const byRarity = new Map<string, number>();
    const byType = new Map<CardKind, number>();
    for (const c of CARD_POOL) {
      byColor.set(c.color, (byColor.get(c.color) ?? 0) + 1);
      const r = c.rarity ?? 'C';
      byRarity.set(r, (byRarity.get(r) ?? 0) + 1);
      byType.set(c.type, (byType.get(c.type) ?? 0) + 1);
    }
    return { byColor, byRarity, byType };
  }, []);

  const allKeywords = useMemo(() => {
    const s = new Set<string>();
    for (const c of CARD_POOL) for (const k of c.keywords ?? []) s.add(k);
    return [...s];
  }, []);

  const toggleSet = <V,>(set: Set<V>, v: V, setter: (s: Set<V>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    setter(next);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
      <AppTopBar page="cards" onNav={(r) => onNav(r as Route)} />

      <SubToolbar
        q={q} setQ={setQ} matched={filtered.length} total={CARD_POOL.length}
        sortMode={sortMode} setSortMode={setSortMode}
        viewMode={viewMode} setViewMode={setViewMode}
      />

      <div style={{
        position: 'absolute', left: 24, right: 24, top: 134, bottom: 16,
        display: 'grid', gridTemplateColumns: '260px 1fr 360px', gap: 14,
      }}>
        {/* LEFT: COVERAGE + FILTERS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          <CoveragePanel total={CARD_POOL.length} byColor={totals.byColor} byRarity={totals.byRarity} />
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
            border: `1px solid rgba(78,195,255,0.25)`,
            borderRadius: 4,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <Label gold>FILTERS</Label>
            <ChipRow label="色" items={COLORS.map((x) => ({
              hex: x.hex, label: x.label, n: totals.byColor.get(x.c) ?? 0,
              active: colorFilter.has(x.c),
              onClick: () => toggleSet(colorFilter, x.c, setColorFilter),
            }))} />
            <ChipRow label="種別" items={TYPES.map((x) => ({
              hex: x.hex, label: x.label, n: totals.byType.get(x.t) ?? 0,
              active: typeFilter.has(x.t),
              onClick: () => toggleSet(typeFilter, x.t, setTypeFilter),
            }))} />
            <ChipRow label="キーワード" items={allKeywords.map((k) => ({
              hex: T.gold, label: k,
              n: CARD_POOL.filter((c) => (c.keywords ?? []).includes(k)).length,
              active: keywordFilter.has(k),
              onClick: () => toggleSet(keywordFilter, k, setKeywordFilter),
            }))} />
            <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={() => {
                setColorFilter(new Set()); setTypeFilter(new Set()); setKeywordFilter(new Set()); setQ('');
              }} style={btnReset}>リセット</button>
              <div style={btnApply}>結果 · {filtered.length} 件</div>
            </div>
          </div>
        </div>

        {/* CENTER: card grid */}
        <CardGrid
          cards={filtered}
          selectedNum={selectedNum}
          onSelect={setSelectedNum}
          favorites={new Set(favorites)}
          adoptions={adoptions}
          favoritesCount={favorites.length}
          viewMode={viewMode}
        />

        {/* RIGHT: selected card detail */}
        <SelectedDetail
          card={selected}
          usage={usage}
          isFavorited={favorites.includes(selected.num)}
          onToggleFavorite={() => toggleFavorite(selected.num)}
          onAddToDeck={() => onNav('deck')}
        />
      </div>
    </div>
  );
}

// ---- SubToolbar ----

function SubToolbar({ q, setQ, matched, total, sortMode, setSortMode, viewMode, setViewMode }: {
  q: string; setQ: (s: string) => void;
  matched: number; total: number;
  sortMode: SortMode; setSortMode: (m: SortMode) => void;
  viewMode: ViewMode; setViewMode: (m: ViewMode) => void;
}) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 64, height: 60,
      display: 'flex', alignItems: 'center', padding: '0 32px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
      borderBottom: `1px solid rgba(78,195,255,0.15)`,
      zIndex: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>COLLECTION</span>
        <span style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.06em' }}>証拠ファイル</span>
        <span style={{
          padding: '3px 10px',
          background: 'rgba(255,215,0,0.15)',
          border: `1px solid ${T.gold}66`, borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
          color: T.gold, letterSpacing: '0.15em',
        }}>
          {total} / {total} 種類
        </span>
      </div>

      <div style={{
        marginLeft: 36, flex: 1, maxWidth: 380,
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
          placeholder="カード名 / 番号 / 特徴で検索"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: T.textPrimary, fontFamily: T.fontJp, fontSize: 13 }}
        />
        <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>
          {matched} 件
        </span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>表示</span>
        <ViewSelector value={viewMode} onChange={setViewMode} />
        <span style={{ width: 1, height: 22, background: 'rgba(78,195,255,0.2)', margin: '0 6px' }} />
        <SortChip label="新着順" sub="↓" active={sortMode === 'new'} onClick={() => setSortMode('new')} />
        <SortChip label="コスト順" sub="C" active={sortMode === 'cost'} onClick={() => setSortMode('cost')} />
      </div>
    </div>
  );
}

function ViewSelector({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const modes: { v: ViewMode; icon: string }[] = [
    { v: 'grid',  icon: '▦' },
    { v: 'list',  icon: '☰' },
    { v: 'stack', icon: '◫' },
  ];
  return (
    <div style={{ display: 'flex', border: `1px solid rgba(78,195,255,0.3)`, borderRadius: 2, overflow: 'hidden' }}>
      {modes.map((m, i) => (
        <button key={m.v} onClick={() => onChange(m.v)} style={{
          padding: '5px 10px',
          background: value === m.v ? T.gold : 'rgba(0,0,0,0.3)',
          color: value === m.v ? '#1a1208' : T.textSecondary,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, cursor: 'pointer',
          borderRight: i < modes.length - 1 ? `1px solid rgba(78,195,255,0.2)` : 'none',
        }}>{m.icon}</button>
      ))}
    </div>
  );
}

function SortChip({ label, sub, active, onClick }: { label: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 10px', borderRadius: 2, cursor: 'pointer',
      background: active ? `${T.gold}22` : 'rgba(0,0,0,0.35)',
      border: `1px solid ${active ? T.gold : T.neonBlue + '55'}`,
      color: active ? T.gold : T.neonBlue,
      fontFamily: T.fontJp, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: T.fontMono, fontSize: 9, opacity: 0.55, letterSpacing: '0.16em', fontWeight: 800 }}>{sub}</span>
    </button>
  );
}

// ---- Coverage panel ----

function CoveragePanel({ total, byColor, byRarity }: {
  total: number; byColor: Map<CardColor, number>; byRarity: Map<string, number>;
}) {
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
        <Label gold>COVERAGE</Label>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>コレクション率</span>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: T.fontSerif, fontSize: 56, fontWeight: 900, color: T.gold, lineHeight: 1 }}>
          100<span style={{ fontSize: 28 }}>%</span>
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.18em', marginTop: 2 }}>
          {total} / {total} 種類
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label muted>BY COLOR</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {COLORS.map((x) => (
            <CoverageRow key={x.c} color={x.hex} label={x.label}
              owned={byColor.get(x.c) ?? 0} total={byColor.get(x.c) ?? 0} />
          ))}
        </div>
      </div>
      <div>
        <Label muted>BY RARITY</Label>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {RARITIES.map((r) => {
            const n = byRarity.get(r.label) ?? 0;
            return (
              <div key={r.label} style={{
                flex: 1, padding: '6px 4px', textAlign: 'center',
                background: 'rgba(0,0,0,0.4)',
                border: `1px solid ${r.hex}44`, borderRadius: 2,
              }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: r.hex, letterSpacing: '0.15em' }}>{r.label}</div>
                <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textPrimary, marginTop: 1 }}>{n}/{n}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CoverageRow({ color, label, owned, total }: { color: string; label: string; owned: number; total: number }) {
  const pct = total > 0 ? (owned / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 14, height: 14, background: color, borderRadius: 2 }} />
      <div style={{ width: 28, fontFamily: T.fontJp, fontSize: 12, color: T.textPrimary, fontWeight: 700 }}>{label}</div>
      <div style={{ flex: 1, height: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, minWidth: 36, textAlign: 'right' }}>
        {owned}/{total}
      </div>
    </div>
  );
}

// ---- Card grid ----

function CardGrid({ cards, selectedNum, onSelect, favorites, adoptions, favoritesCount, viewMode }: {
  cards: CardDef[]; selectedNum: string; onSelect: (n: string) => void;
  favorites: Set<string>; adoptions: Map<string, number>; favoritesCount: number; viewMode: ViewMode;
}) {
  const cardWidth = viewMode === 'stack' ? 100 : viewMode === 'list' ? 60 : 130;
  return (
    <div style={{
      width: '100%', height: '100%',
      padding: '16px 18px 18px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}>
        <Label gold>CARDS · {cards.length} 件 一致</Label>
        <span style={{ marginLeft: 14, fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em' }}>
          PAGE 1 / 1
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>
          ★ お気に入り {favoritesCount}
        </span>
      </div>
      <div style={{
        flex: 1, overflow: 'auto',
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth + 8}px, 1fr))`,
        gap: 14, alignContent: 'start',
      }}>
        {cards.map((c) => (
          <div key={c.num} style={{ display: 'flex', justifyContent: 'center' }}>
            <MetaCard
              card={c} w={cardWidth}
              selected={c.num === selectedNum}
              count={adoptions.get(c.num)}
              isFavorited={favorites.has(c.num)}
              onClick={() => onSelect(c.num)}
              hoverable
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Selected card detail ----

function SelectedDetail({ card, usage, isFavorited, onToggleFavorite, onAddToDeck }: {
  card: CardDef;
  usage: { inDecks: number; totalDecks: number; winRate: number; mvp: number };
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onAddToDeck: () => void;
}) {
  const color = COLOR_TOKEN[card.color];
  return (
    <div style={{
      width: '100%', height: '100%',
      padding: '20px 22px 22px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.75))',
      border: `1px solid ${color}66`, borderRadius: 4,
      boxShadow: `inset 0 0 40px ${color}15`,
      display: 'flex', flexDirection: 'column', overflow: 'auto', gap: 10,
    }}>
      <div style={{
        alignSelf: 'center',
        filter: `drop-shadow(0 0 24px ${color}66) drop-shadow(0 8px 16px rgba(0,0,0,0.7))`,
      }}>
        <MetaCard card={card} w={200} hoverable={false} />
      </div>

      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>{card.num}</span>
          {card.rarity && (
            <span style={{ padding: '1px 6px', background: T.gold, color: '#1a1208', fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, letterSpacing: '0.15em' }}>
              {card.rarity}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: T.green, letterSpacing: '0.15em' }}>
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
        <div style={{
          padding: '10px 12px',
          background: 'rgba(0,0,0,0.45)',
          border: `1px solid ${color}33`, borderRadius: 3,
        }}>
          <Label gold small>EFFECT · 効果</Label>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: T.textPrimary, marginTop: 4, whiteSpace: 'pre-wrap' }}>
            {card.effectShort}
          </div>
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
          border: `1px solid ${T.gold}${isFavorited ? 'cc' : '66'}`,
          borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
          color: T.gold, letterSpacing: '0.18em',
        }}>
          {isFavorited ? '★ お気に入り 解除' : '★ お気に入り'}
        </button>
        <button onClick={onAddToDeck} style={{
          flex: 1, padding: '8px', textAlign: 'center', cursor: 'pointer',
          background: T.neonBlue, color: '#0a1a28',
          borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
        }}>
          + デッキへ追加
        </button>
      </div>
    </div>
  );
}

// ---- Helpers ----

function Label({ children, gold, muted, small }: { children: React.ReactNode; gold?: boolean; muted?: boolean; small?: boolean }) {
  return (
    <span style={{
      fontFamily: T.fontMono,
      fontSize: small ? 9 : 11, fontWeight: 800,
      color: gold ? T.gold : muted ? T.textMuted : T.textPrimary,
      letterSpacing: small ? '0.2em' : '0.28em',
    }}>{children}</span>
  );
}

function ChipRow({ label, items }: { label: string; items: { hex: string; label: string; n: number; active: boolean; onClick: () => void }[] }) {
  return (
    <div>
      <Label muted small>{label}</Label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
        {items.map((it) => (
          <button key={it.label} onClick={it.onClick} style={{
            padding: '4px 8px', cursor: 'pointer',
            background: it.active ? `${it.hex}33` : 'rgba(0,0,0,0.3)',
            border: `1px solid ${it.active ? it.hex : it.hex + '33'}`,
            borderRadius: 2, display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ fontSize: 11, fontWeight: it.active ? 700 : 500, color: it.active ? it.hex : T.textMuted }}>{it.label}</span>
            <span style={{ fontFamily: T.fontMono, fontSize: 9, color: it.active ? it.hex : T.textDisabled, opacity: 0.7 }}>{it.n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SmallStat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{
      flex: 1, padding: '6px 8px', textAlign: 'center',
      background: `${accent}15`,
      border: `1px solid ${accent}55`, borderRadius: 2,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function UsageStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '7px 9px',
      background: 'rgba(0,0,0,0.4)',
      border: `1px solid rgba(78,195,255,0.2)`, borderRadius: 2, lineHeight: 1.2,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.15em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 14, fontWeight: 800, color: highlight ? T.gold : T.textPrimary, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function typeLabel(t: CardKind): string {
  return ({ partner: 'パートナー', character: 'キャラ', event: 'イベント', case: '事件' } as const)[t];
}

const btnReset = {
  flex: 1, padding: '7px', textAlign: 'center' as const, cursor: 'pointer' as const,
  background: 'rgba(0,0,0,0.4)',
  border: `1px solid ${T.textMuted}55`, borderRadius: 2,
  fontSize: 11, color: T.textMuted, fontFamily: T.fontMono, letterSpacing: '0.18em',
};

const btnApply = {
  flex: 1, padding: '7px', textAlign: 'center' as const,
  background: T.gold, color: '#1a1208', borderRadius: 2,
  fontSize: 11, fontWeight: 800, fontFamily: T.fontMono, letterSpacing: '0.18em',
};
