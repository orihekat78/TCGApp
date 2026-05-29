// spec: .claude/specs/meta-ui/07-screens-library.md + 12-screens-rebuild.md
// 原典: design-mockups_v2/06-deck-3col.jsx (733 行)
// Phase 13-D: 全面 rebuild
//   左: FilterRail (色/種別/コスト/特徴/キーワード)
//   中央上: SubToolbar + CardListGrid
//   中央下: CardDetailPanel (選択カード詳細)
//   右: DeckHeader + DeckStats (CostCurve + Color/Type) + DeckList + ValidationBanner

import { useMemo, useState } from 'react';
import { T, shade, COLOR_TOKEN } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { MetaCard } from '../shared/MetaCard';
import { SetupButton } from '../shared/Button';
import { FilterGroup } from '../shared/FilterGroup';
import { WarningBanner } from '../shared/WarningBanner';
import { engineStub } from '../stubs/engineStub';
import { useDecksStore } from '../state/decksStore';
import { CARD_POOL } from '../data/cardPool';
import { SAMPLE_DECK } from '../data/sampleDeck';
import type { CardColor, CardDef, CardKind, DeckRecord } from '../data/types';
import type { Route } from '../router/routes';

interface Props {
  onNav: (r: Route) => void;
}

const COLORS: { c: CardColor; label: string; hex: string }[] = [
  { c: 'blue',   label: '青', hex: T.blue },
  { c: 'yellow', label: '黄', hex: T.yellow },
  { c: 'red',    label: '赤', hex: T.red },
  { c: 'green',  label: '緑', hex: T.green },
  { c: 'purple', label: '紫', hex: T.purple },
];

const TYPES: { t: CardKind; label: string; hex: string }[] = [
  { t: 'character', label: 'キャラ', hex: T.neonBlue },
  { t: 'event',     label: 'イベント', hex: T.purple },
];

export function DeckEditor({ onNav }: Props) {
  const decks = useDecksStore((s) => s.decks);
  const add = useDecksStore((s) => s.add);
  const update = useDecksStore((s) => s.update);

  const [editingId, setEditingId] = useState<string>(decks[0]?.id ?? '');
  const [draft, setDraft] = useState<DeckRecord>(() => {
    const initial = decks.find((d) => d.id === editingId);
    return initial ? structuredClone(initial) : { ...SAMPLE_DECK, modified: Date.now() };
  });
  const [colorFilter, setColorFilter] = useState<Set<CardColor>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<CardKind>>(new Set());
  const [costFilter, setCostFilter] = useState<Set<number>>(new Set());
  const [featureFilter, setFeatureFilter] = useState<Set<string>>(new Set());
  const [keywordFilter, setKeywordFilter] = useState<Set<string>>(new Set());
  const [selectedNum, setSelectedNum] = useState<string>('');

  const filteredPool = useMemo(() => {
    let arr = CARD_POOL.slice();
    if (colorFilter.size) arr = arr.filter((c) => colorFilter.has(c.color));
    if (typeFilter.size) arr = arr.filter((c) => typeFilter.has(c.type));
    if (costFilter.size) arr = arr.filter((c) => c.cost != null && costFilter.has(Math.min(c.cost, 8)));
    if (featureFilter.size) arr = arr.filter((c) => (c.features ?? []).some((f) => featureFilter.has(f)));
    if (keywordFilter.size) arr = arr.filter((c) => (c.keywords ?? []).some((k) => keywordFilter.has(k)));
    return arr;
  }, [colorFilter, typeFilter, costFilter, featureFilter, keywordFilter]);

  const allFeatures = useMemo(() => {
    const s = new Set<string>();
    for (const c of CARD_POOL) for (const f of (c.features ?? [])) s.add(f);
    return [...s];
  }, []);
  const allKeywords = useMemo(() => {
    const s = new Set<string>();
    for (const c of CARD_POOL) for (const k of (c.keywords ?? [])) s.add(k);
    return [...s];
  }, []);

  const validation = engineStub.cards.validateDeck(draft);
  const totalCards = draft.cards.reduce((s, e) => s + e.count, 0);
  const selectedCard = CARD_POOL.find((c) => c.num === selectedNum);

  const addCard = (num: string) => {
    const card = CARD_POOL.find((c) => c.num === num);
    if (!card || card.type === 'partner' || card.type === 'case') return;
    setDraft((d) => {
      const idx = d.cards.findIndex((e) => e.num === num);
      if (idx >= 0) {
        const cur = d.cards[idx]!;
        if (cur.count >= 3) return d;
        const next = [...d.cards];
        next[idx] = { ...cur, count: cur.count + 1 };
        return { ...d, cards: next };
      }
      return { ...d, cards: [...d.cards, { num, count: 1 }] };
    });
    setSelectedNum(num);
  };

  const removeCard = (num: string) => {
    setDraft((d) => {
      const idx = d.cards.findIndex((e) => e.num === num);
      if (idx < 0) return d;
      const cur = d.cards[idx]!;
      if (cur.count <= 1) {
        return { ...d, cards: d.cards.filter((e) => e.num !== num) };
      }
      const next = [...d.cards];
      next[idx] = { ...cur, count: cur.count - 1 };
      return { ...d, cards: next };
    });
  };

  const onSave = () => {
    if (!validation.ok) return;
    if (decks.find((d) => d.id === draft.id)) {
      update(draft.id, draft);
    } else {
      add({ ...draft, id: draft.id || `deck-${Date.now()}` });
    }
  };

  const toggleFilter = <V,>(set: Set<V>, v: V, setter: (s: Set<V>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    setter(next);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
      <AppTopBar page="deck" onNav={(r) => onNav(r as Route)} />

      <SubToolbar
        deckName={draft.name}
        onRename={(name) => setDraft((d) => ({ ...d, name }))}
        decks={decks}
        editingId={editingId}
        onSelectDeck={(id) => {
          setEditingId(id);
          const target = decks.find((d) => d.id === id);
          if (target) setDraft(structuredClone(target));
        }}
        onSave={onSave}
        onCancel={() => onNav('home')}
        ok={validation.ok}
      />

      <div style={{
        position: 'absolute', left: 24, right: 24, top: 134, bottom: 16,
        display: 'grid', gridTemplateColumns: '240px 1fr 380px', gap: 14,
      }}>
        {/* LEFT: Filter rail */}
        <FilterRail
          colors={colorFilter} types={typeFilter}
          costs={costFilter} features={featureFilter} keywords={keywordFilter}
          allFeatures={allFeatures} allKeywords={allKeywords}
          onToggleColor={(c) => toggleFilter(colorFilter, c, setColorFilter)}
          onToggleType={(t) => toggleFilter(typeFilter, t, setTypeFilter)}
          onToggleCost={(c) => toggleFilter(costFilter, c, setCostFilter)}
          onToggleFeature={(f) => toggleFilter(featureFilter, f, setFeatureFilter)}
          onToggleKeyword={(k) => toggleFilter(keywordFilter, k, setKeywordFilter)}
          onReset={() => {
            setColorFilter(new Set()); setTypeFilter(new Set());
            setCostFilter(new Set()); setFeatureFilter(new Set()); setKeywordFilter(new Set());
          }}
        />

        {/* CENTER: pool + detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <CardListGrid
            cards={filteredPool}
            selectedNum={selectedNum}
            onSelect={setSelectedNum}
            onAdd={addCard}
            draftCounts={new Map(draft.cards.map((e) => [e.num, e.count]))}
          />
          {selectedCard && <CardDetailPanel card={selectedCard} />}
        </div>

        {/* RIGHT: deck overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <DeckHeader deck={draft} total={totalCards} />
          <DeckStats deck={draft} />
          <DeckList deck={draft} highlightNum={selectedNum} onRemove={removeCard} />
          {validation.ok ? (
            <WarningBanner tone="info" title="検証 OK" body="40 枚 / 同 ID ≤ 3 / パートナー 1 枚を満たしています" />
          ) : (
            <WarningBanner tone="error" title="検証エラー" items={validation.errors} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- SubToolbar ----

function SubToolbar({ deckName, onRename, decks, editingId, onSelectDeck, onSave, onCancel, ok }: {
  deckName: string; onRename: (s: string) => void;
  decks: DeckRecord[]; editingId: string; onSelectDeck: (id: string) => void;
  onSave: () => void; onCancel: () => void; ok: boolean;
}) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 64, height: 60,
      display: 'flex', alignItems: 'center', padding: '0 24px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
      borderBottom: `1px solid rgba(78,195,255,0.15)`, zIndex: 8,
    }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>DECK EDIT</span>
      <input value={deckName} onChange={(e) => onRename(e.target.value)} style={{
        marginLeft: 14, padding: '6px 12px', minWidth: 280,
        background: 'rgba(0,0,0,0.5)', color: T.textPrimary,
        border: `1px solid ${T.gold}55`, borderRadius: 3,
        fontFamily: T.fontJp, fontSize: 16, fontWeight: 700,
      }} />
      <select value={editingId} onChange={(e) => onSelectDeck(e.target.value)} style={{
        marginLeft: 12, padding: '6px 10px',
        background: 'rgba(0,0,0,0.5)', color: T.textPrimary,
        border: `1px solid ${T.neonBlue}55`, borderRadius: 3,
        fontFamily: T.fontJp, fontSize: 12, cursor: 'pointer',
      }}>
        {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <SetupButton label="キャンセル" sub="CANCEL" onClick={onCancel} />
        <button onClick={onSave} disabled={!ok} style={{
          padding: '8px 18px',
          background: ok ? `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.3)})` : 'rgba(78,195,255,0.05)',
          color: ok ? '#1a1208' : T.textDisabled,
          border: `1px solid ${ok ? T.gold : T.textMuted}66`, borderRadius: 3,
          fontFamily: T.fontJp, fontSize: 13, fontWeight: 800, letterSpacing: '0.1em',
          cursor: ok ? 'pointer' : 'not-allowed',
        }}>
          保存 · SAVE
        </button>
      </div>
    </div>
  );
}

// ---- Filter rail ----

function FilterRail({
  colors, types, costs, features, keywords,
  allFeatures, allKeywords,
  onToggleColor, onToggleType, onToggleCost, onToggleFeature, onToggleKeyword, onReset,
}: {
  colors: Set<CardColor>; types: Set<CardKind>;
  costs: Set<number>; features: Set<string>; keywords: Set<string>;
  allFeatures: string[]; allKeywords: string[];
  onToggleColor: (c: CardColor) => void;
  onToggleType: (t: CardKind) => void;
  onToggleCost: (c: number) => void;
  onToggleFeature: (f: string) => void;
  onToggleKeyword: (k: string) => void;
  onReset: () => void;
}) {
  return (
    <div style={{
      padding: '14px 14px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto',
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>
        FILTERS
      </div>
      <FilterGroup label="色" items={COLORS.map((x) => ({
        c: x.hex, label: x.label, active: colors.has(x.c),
        n: CARD_POOL.filter((c) => c.color === x.c).length,
        onClick: () => onToggleColor(x.c),
      }))} />
      <FilterGroup label="種別" items={TYPES.map((x) => ({
        c: x.hex, label: x.label, active: types.has(x.t),
        n: CARD_POOL.filter((c) => c.type === x.t).length,
        onClick: () => onToggleType(x.t),
      }))} />
      <FilterGroup label="コスト" items={[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
        c: T.neonBlue, label: n === 8 ? '8+' : String(n), active: costs.has(n),
        n: CARD_POOL.filter((c) => c.cost != null && Math.min(c.cost, 8) === n).length,
        onClick: () => onToggleCost(n),
      }))} />
      {allFeatures.length > 0 && (
        <FilterGroup label="特徴" items={allFeatures.map((f) => ({
          c: T.green, label: f, active: features.has(f),
          n: CARD_POOL.filter((c) => (c.features ?? []).includes(f)).length,
          onClick: () => onToggleFeature(f),
        }))} />
      )}
      {allKeywords.length > 0 && (
        <FilterGroup label="キーワード" items={allKeywords.map((k) => ({
          c: T.gold, label: k, active: keywords.has(k),
          n: CARD_POOL.filter((c) => (c.keywords ?? []).includes(k)).length,
          onClick: () => onToggleKeyword(k),
        }))} />
      )}
      <button onClick={onReset} style={{
        padding: '6px', textAlign: 'center', cursor: 'pointer',
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${T.textMuted}55`, borderRadius: 2,
        fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.18em',
      }}>
        リセット
      </button>
    </div>
  );
}

// ---- Card list grid (pool) ----

function CardListGrid({ cards, selectedNum, onSelect, onAdd, draftCounts }: {
  cards: CardDef[]; selectedNum: string;
  onSelect: (n: string) => void; onAdd: (n: string) => void;
  draftCounts: Map<string, number>;
}) {
  return (
    <div style={{
      padding: '12px 14px', flex: 1,
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>
          CARD POOL · {cards.length} 件
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>
          クリックで詳細 / ダブルクリックで追加
        </span>
      </div>
      <div style={{
        flex: 1, overflow: 'auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
        gap: 8, paddingRight: 4,
      }}>
        {cards.map((card) => {
          const isPartner = card.type === 'partner';
          const isCase = card.type === 'case';
          const cnt = draftCounts.get(card.num);
          return (
            <MetaCard key={card.num} card={card} w={80}
              selected={card.num === selectedNum}
              count={cnt}
              dimmed={isPartner || isCase}
              badge={isPartner ? 'partner' : isCase ? 'case' : undefined}
              onClick={() => onSelect(card.num)}
              hoverable
            />
          );
        })}
      </div>
      <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => selectedNum && onAdd(selectedNum)} style={{
          padding: '6px 14px',
          background: selectedNum ? `${T.gold}22` : 'rgba(0,0,0,0.3)',
          color: selectedNum ? T.gold : T.textDisabled,
          border: `1px solid ${selectedNum ? T.gold : T.textMuted}66`, borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, letterSpacing: '0.18em',
          cursor: selectedNum ? 'pointer' : 'not-allowed',
        }}>
          ＋ デッキへ追加
        </button>
        <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em' }}>
          {selectedNum || '— カードを選択してください —'}
        </span>
      </div>
    </div>
  );
}

// ---- Card detail panel ----

function CardDetailPanel({ card }: { card: CardDef }) {
  const c = COLOR_TOKEN[card.color] || T.blue;
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.7))',
      border: `1px solid ${c}55`, borderRadius: 4,
      boxShadow: `inset 0 0 40px ${c}11`,
      display: 'flex', gap: 16,
    }}>
      <div style={{ filter: `drop-shadow(0 0 24px ${c}66) drop-shadow(0 8px 16px rgba(0,0,0,0.7))` }}>
        <MetaCard card={card} w={150} hoverable={false} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>{card.num}</span>
          <Pill color={c} label={card.color.toUpperCase()} />
          {card.rarity && <Pill color={T.gold} label={card.rarity} />}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.textPrimary }}>{card.name}</div>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.12em', marginBottom: 8 }}>
          {typeLabel(card.type)}{(card.features ?? []).length > 0 && ` · ${(card.features ?? []).join(' / ')}`}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <StatBox label="COST" value={card.cost ?? '—'} accent={T.neonBlue} />
          <StatBox label="AP"   value={card.ap ? card.ap.toLocaleString() : '—'} accent={T.apColor} />
          <StatBox label="LP"   value={card.lp ?? '—'} accent={T.green} />
        </div>
        <div style={{
          padding: '8px 12px', flex: 1,
          background: 'rgba(0,0,0,0.45)',
          border: `1px solid ${c}33`, borderRadius: 3,
          fontSize: 12, color: T.textPrimary, lineHeight: 1.5,
          whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'auto',
        }}>
          {card.effectShort}
        </div>
        {(card.keywords ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {(card.keywords ?? []).map((k) => (
              <span key={k} style={{
                padding: '2px 8px',
                background: 'rgba(255,215,0,0.15)', border: `1px solid ${T.gold}66`,
                borderRadius: 2, fontFamily: T.fontJp, fontSize: 11, fontWeight: 700, color: T.gold,
              }}>{k}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Deck header (partner + count) ----

function DeckHeader({ deck, total }: { deck: DeckRecord; total: number }) {
  const partner = CARD_POOL.find((c) => c.num === deck.partner);
  return (
    <div style={{
      padding: '12px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.7))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {partner && (
        <div style={{ filter: `drop-shadow(0 0 12px ${T.gold}66)` }}>
          <MetaCard card={partner} w={70} badge="partner" hoverable={false} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.gold, letterSpacing: '0.28em' }}>MY DECK</div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 16, fontWeight: 800, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {deck.name}
        </div>
        <div style={{ fontSize: 10, color: T.textMuted }}>
          パートナー: {partner?.name ?? '—'}
        </div>
      </div>
      <div style={{
        padding: '8px 14px', textAlign: 'center',
        background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}66`, borderRadius: 3,
      }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em' }}>枚数</div>
        <div>
          <span style={{ fontFamily: T.fontMono, fontSize: 22, fontWeight: 800, color: total === 40 ? T.gold : T.red }}>{total}</span>
          <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.textMuted, marginLeft: 4 }}>/40</span>
        </div>
      </div>
    </div>
  );
}

// ---- Deck stats (cost curve + color/type) ----

function DeckStats({ deck }: { deck: DeckRecord }) {
  const stats = useMemo(() => computeDeckStats(deck), [deck]);
  const maxCost = Math.max(1, ...Object.values(stats.costs));
  const costBars = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ cost: n, count: stats.costs[n] ?? 0 }));
  return (
    <div style={{
      padding: '10px 12px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
      display: 'flex', gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, color: T.gold, letterSpacing: '0.25em' }}>COST</span>
          <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 9, color: T.textMuted }}>
            avg <span style={{ color: T.textPrimary, fontWeight: 700 }}>{stats.avgCost.toFixed(1)}</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56 }}>
          {costBars.map((b) => (
            <div key={b.cost} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                fontFamily: T.fontMono, fontSize: 9, fontWeight: 700,
                color: b.count > 0 ? T.textPrimary : T.textDisabled,
              }}>{b.count > 0 ? b.count : ''}</div>
              <div style={{
                width: '100%',
                height: `${(b.count / maxCost) * 38 + (b.count > 0 ? 4 : 1)}px`,
                background: b.count > 0
                  ? `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.4)})`
                  : 'rgba(78,195,255,0.1)',
                borderRadius: 1,
                boxShadow: b.count > 0 ? `0 0 8px ${T.gold}33` : 'none',
              }} />
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, marginTop: 2 }}>
                {b.cost}{b.cost === 8 ? '+' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: 130, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, color: T.gold, letterSpacing: '0.25em', marginBottom: 3 }}>COLOR</div>
          <ColorBar segments={COLORS.map((x) => ({ color: x.hex, value: stats.colors[x.c] ?? 0, label: x.label }))} />
        </div>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, color: T.gold, letterSpacing: '0.25em', marginBottom: 3 }}>TYPE</div>
          <TypeRow label="キャラ"   value={stats.types.character} max={40} color={T.neonBlue} />
          <TypeRow label="イベント" value={stats.types.event}     max={40} color={T.purple} />
        </div>
      </div>
    </div>
  );
}

function ColorBar({ segments }: { segments: { color: string; value: number; label: string }[] }) {
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(78,195,255,0.2)' }}>
        {visible.map((s, i) => (
          <div key={i} style={{ flex: s.value, background: s.color }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
        {visible.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 7, height: 7, background: s.color, borderRadius: 1 }} />
            <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textSecondary }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
      <span style={{ width: 56, fontSize: 9, color: T.textSecondary }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.4)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, color: T.textPrimary, width: 18, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ---- Deck list (right column rows) ----

function DeckList({ deck, highlightNum, onRemove }: {
  deck: DeckRecord; highlightNum: string; onRemove: (num: string) => void;
}) {
  const entries = useMemo(() => deck.cards
    .map((e) => ({ ...e, card: CARD_POOL.find((c) => c.num === e.num) }))
    .filter((e): e is typeof e & { card: CardDef } => !!e.card)
    .sort((a, b) => (a.card.cost ?? 0) - (b.card.cost ?? 0)),
  [deck]);
  return (
    <div style={{
      flex: 1,
      padding: '10px 12px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>DECK LIST</span>
        <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.1em' }}>
          {entries.length} 種類 · クリックで -1
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entries.map((e) => (
          <DeckRow key={e.num} entry={e} highlight={e.num === highlightNum} onRemove={() => onRemove(e.num)} />
        ))}
      </div>
    </div>
  );
}

function DeckRow({ entry, highlight, onRemove }: {
  entry: { num: string; count: number; card: CardDef }; highlight: boolean; onRemove: () => void;
}) {
  const c = COLOR_TOKEN[entry.card.color] || T.blue;
  return (
    <button onClick={onRemove} className="meta-row" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 6px',
      background: highlight ? `${T.gold}11` : 'transparent',
      border: highlight ? `1px solid ${T.gold}55` : '1px solid transparent',
      borderRadius: 2, cursor: 'pointer', textAlign: 'left',
      color: T.textPrimary,
    }}>
      <div style={{
        width: 20, height: 20, flexShrink: 0,
        background: `linear-gradient(180deg, ${c}, ${shade(c, -0.4)})`,
        border: `1px solid ${shade(c, -0.5)}`, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontMono, fontWeight: 800, fontSize: 10, color: '#fff',
      }}>{entry.card.cost ?? '—'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {entry.card.name}
          {entry.card.ap != null && (
            <span style={{ marginLeft: 5, fontSize: 9, color: T.gold, fontFamily: T.fontMono, fontWeight: 700 }}>
              AP {entry.card.ap.toLocaleString()}
            </span>
          )}
        </div>
        <div style={{ fontSize: 9, color: T.textMuted, fontFamily: T.fontMono }}>
          {entry.num} · {(entry.card.features ?? []).join(' / ') || entry.card.type}
        </div>
      </div>
      <div style={{
        width: 28, textAlign: 'center',
        padding: '1px 0',
        background: entry.count > 3 ? T.red : 'rgba(255,215,0,0.18)',
        border: `1px solid ${entry.count > 3 ? T.red : T.gold}66`, borderRadius: 2,
        fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
        color: entry.count > 3 ? '#fff' : T.gold,
      }}>×{entry.count}</div>
    </button>
  );
}

// ---- helpers ----

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      padding: '1px 6px',
      background: color, color: '#fff',
      fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
      letterSpacing: '0.15em', borderRadius: 1,
    }}>{label}</span>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{
      flex: 1, padding: '6px 8px', textAlign: 'center',
      background: `${accent}11`, border: `1px solid ${accent}44`, borderRadius: 2,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function typeLabel(t: CardKind): string {
  return ({ partner: 'パートナー', character: 'キャラ', event: 'イベント', case: '事件' } as const)[t];
}

function computeDeckStats(deck: DeckRecord) {
  let total = 0, costSum = 0, costCount = 0;
  const costs: Record<number, number> = {};
  const colors: Record<string, number> = {};
  const types: Record<string, number> = { character: 0, event: 0, partner: 0, case: 0 };
  for (const e of deck.cards) {
    const card = CARD_POOL.find((c) => c.num === e.num);
    if (!card) continue;
    total += e.count;
    colors[card.color] = (colors[card.color] ?? 0) + e.count;
    types[card.type] = (types[card.type] ?? 0) + e.count;
    if (card.cost != null) {
      const k = Math.min(card.cost, 8);
      costs[k] = (costs[k] ?? 0) + e.count;
      costSum += card.cost * e.count;
      costCount += e.count;
    }
  }
  return {
    total, costs, colors, types,
    avgCost: costCount > 0 ? costSum / costCount : 0,
  };
}
