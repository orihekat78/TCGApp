// spec: .claude/specs/meta-ui/07-screens-library.md + 12-screens-rebuild.md
// Phase 18: Master Duel 風 全面リデザイン
//   左: 検索 + 共有 FilterRail (色/種別/コスト/レアリティ/特徴/キーワード, OR/AND, sticky)
//   中央上: プールグリッド (キャラ/イベントのみ。ダブルクリック/右クリック/＋で追加、
//           同 ID 3 枚到達はグレーアウト+MAX 表示で追加不可 ← 同 ID 上限を UI で可視化)
//   中央下: 選択カード詳細
//   右: パートナー枠 + 事件枠 (クリックで選択) / n/40・種類 / コストカーブ /
//       デッキリスト (自動グルーピング or 手動ドラッグ並べ替え、±) / 検証バナー
//   ツールバー: デッキ名 / デッキ切替 / 新規・複製・削除 / デッキコード入出力 / テストハンド / 保存

import { useMemo, useRef, useState } from 'react';
import { T, shade, COLOR_TOKEN } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { MetaCard } from '../shared/MetaCard';
import { FilterRail } from '../shared/FilterRail';
import { SetupButton } from '../shared/Button';
import { WarningBanner } from '../shared/WarningBanner';
import { engineStub } from '../stubs/engineStub';
import { useDecksStore } from '../state/decksStore';
import { useFiltersStore } from '../state/filtersStore';
import {
  CARD_POOL, cardIdOf, countsByCardId, defaultCaseForPartner,
  PARTNER_CARDS, CASE_CARDS,
} from '../data/cardPool';
import { matchesFilter } from '../data/cardFilter';
import { encodeDeck, decodeDeck, type DecodedDeck } from '../util/deckCode';
import type { CardDef, CardKind, DeckRecord } from '../data/types';
import type { Route } from '../router/routes';

interface Props {
  onNav: (r: Route) => void;
}

const MAX_PER_ID = 3;
const POOL_TYPES: CardKind[] = ['character', 'event'];

function emptyDeck(): DeckRecord {
  return { id: `deck-${Date.now()}`, name: '新しいデッキ', partner: '', case: '', cards: [], modified: Date.now() };
}

type ModalKind = 'partner' | 'case' | 'code' | 'testhand' | null;

export function DeckEditor({ onNav }: Props) {
  const decks = useDecksStore((s) => s.decks);
  const add = useDecksStore((s) => s.add);
  const update = useDecksStore((s) => s.update);
  const removeDeck = useDecksStore((s) => s.remove);

  const filter = useFiltersStore((s) => s.deck);
  const setFilter = useFiltersStore((s) => s.setDeck);
  const resetFilter = useFiltersStore((s) => s.resetDeck);

  const [editingId, setEditingId] = useState<string>(decks[0]?.id ?? '');
  const [draft, setDraft] = useState<DeckRecord>(() => {
    const initial = decks.find((d) => d.id === editingId);
    return initial ? structuredClone(initial) : emptyDeck();
  });
  const [selectedNum, setSelectedNum] = useState<string>('');
  const [modal, setModal] = useState<ModalKind>(null);
  const [manualOrder, setManualOrder] = useState(false);

  const original = decks.find((d) => d.id === draft.id);
  const dirty = !original || JSON.stringify(original) !== JSON.stringify({ ...draft, modified: original.modified });

  const filteredPool = useMemo(() => {
    return CARD_POOL
      .filter((c) => POOL_TYPES.includes(c.type))
      .filter((c) => matchesFilter(c, filter))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'character' ? -1 : 1;
        return (a.cost ?? 99) - (b.cost ?? 99) || a.num.localeCompare(b.num);
      });
  }, [filter]);
  // FilterRail のカウントはプールに出るカード (キャラ/イベント) のみを母集団にする
  // (パートナー/事件を含めると 色/レアリティ/キーワード のカウントが実数と食い違う)。
  const poolForRail = useMemo(() => CARD_POOL.filter((c) => POOL_TYPES.includes(c.type)), []);

  const idCounts = useMemo(() => countsByCardId(draft.cards), [draft.cards]);
  const validation = engineStub.cards.validateDeck(draft);
  const totalCards = draft.cards.reduce((s, e) => s + e.count, 0);
  const distinctKinds = useMemo(() => new Set(draft.cards.map((e) => cardIdOf(e.num))).size, [draft.cards]);
  const selectedCard = CARD_POOL.find((c) => c.num === selectedNum);

  // ---- mutations ----
  const addCard = (num: string) => {
    const card = CARD_POOL.find((c) => c.num === num);
    if (!card || !POOL_TYPES.includes(card.type)) return;
    setDraft((d) => {
      const sameId = d.cards.reduce((s, e) => s + (cardIdOf(e.num) === card.id ? e.count : 0), 0);
      if (sameId >= MAX_PER_ID) return d; // 同 ID 上限 (rules/02)
      const idx = d.cards.findIndex((e) => e.num === num);
      if (idx >= 0) {
        const next = [...d.cards];
        next[idx] = { ...next[idx]!, count: next[idx]!.count + 1 };
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
      if (cur.count <= 1) return { ...d, cards: d.cards.filter((e) => e.num !== num) };
      const next = [...d.cards];
      next[idx] = { ...cur, count: cur.count - 1 };
      return { ...d, cards: next };
    });
  };

  const reorder = (from: number, to: number) => {
    setDraft((d) => {
      if (from === to || from < 0 || to < 0 || from >= d.cards.length || to >= d.cards.length) return d;
      const next = [...d.cards];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return { ...d, cards: next };
    });
  };

  const setPartner = (num: string) => {
    setDraft((d) => ({ ...d, partner: num, case: d.case || defaultCaseForPartner(num) }));
    setModal(null);
  };
  const setCase = (num: string) => { setDraft((d) => ({ ...d, case: num })); setModal(null); };

  // ---- deck management ----
  const confirmDiscard = () => !dirty || window.confirm('未保存の変更があります。破棄してよろしいですか?');
  const loadDeck = (id: string) => {
    if (!confirmDiscard()) return;
    setEditingId(id);
    const target = decks.find((d) => d.id === id);
    if (target) setDraft(structuredClone(target));
  };
  const newDeck = () => { if (!confirmDiscard()) return; const d = emptyDeck(); setEditingId(d.id); setDraft(d); setSelectedNum(''); };
  const duplicateDeck = () => {
    const d: DeckRecord = { ...structuredClone(draft), id: `deck-${Date.now()}`, name: `${draft.name} のコピー`, modified: Date.now() };
    setEditingId(d.id); setDraft(d);
  };
  const deleteDeck = () => {
    if (!window.confirm(`「${draft.name}」を削除しますか?`)) return;
    removeDeck(draft.id);
    const remaining = decks.filter((d) => d.id !== draft.id);
    if (remaining[0]) { setEditingId(remaining[0].id); setDraft(structuredClone(remaining[0])); }
    else { const d = emptyDeck(); setEditingId(d.id); setDraft(d); }
  };
  const onSave = () => {
    if (!validation.ok) return;
    if (decks.find((d) => d.id === draft.id)) update(draft.id, draft);
    else { add({ ...draft, id: draft.id || `deck-${Date.now()}` }); setEditingId(draft.id); }
  };
  const importDeck = (decoded: { name: string; partner: string; case: string; cards: { num: string; count: number }[] }) => {
    const d: DeckRecord = { id: `deck-${Date.now()}`, name: decoded.name, partner: decoded.partner, case: decoded.case, cards: decoded.cards, modified: Date.now() };
    setEditingId(d.id); setDraft(d); setModal(null);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
      <AppTopBar page="deck" onNav={(r) => onNav(r as Route)} />

      <SubToolbar
        deckName={draft.name}
        onRename={(name) => setDraft((d) => ({ ...d, name }))}
        decks={decks} editingId={editingId} onSelectDeck={loadDeck}
        onNew={newDeck} onDuplicate={duplicateDeck} onDelete={deleteDeck}
        onCode={() => setModal('code')} onTestHand={() => setModal('testhand')}
        onSave={onSave} onCancel={() => { if (confirmDiscard()) onNav('home'); }}
        ok={validation.ok} dirty={dirty}
      />

      <div style={{
        position: 'absolute', left: 24, right: 24, top: 134, bottom: 16,
        display: 'grid', gridTemplateColumns: '240px 1fr 380px', gap: 14,
      }}>
        {/* LEFT: search + filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <SearchBox q={filter.q} onChange={(q) => setFilter({ q })} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            <FilterRail filter={filter} onChange={setFilter} onReset={resetFilter} pool={poolForRail} typeOptions={POOL_TYPES} />
          </div>
        </div>

        {/* CENTER: pool + detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <PoolGrid
            cards={filteredPool}
            selectedNum={selectedNum}
            idCounts={idCounts}
            onSelect={setSelectedNum}
            onAdd={addCard}
          />
          {selectedCard ? (
            <CardDetailPanel
              card={selectedCard}
              count={idCounts.get(selectedCard.id) ?? 0}
              onAdd={() => addCard(selectedCard.num)}
              onRemove={() => removeCard(selectedCard.num)}
            />
          ) : (
            <div style={{
              padding: '14px', textAlign: 'center', color: T.textMuted, fontFamily: T.fontMono, fontSize: 11,
              background: 'rgba(13,38,64,0.6)', border: `1px dashed rgba(78,195,255,0.25)`, borderRadius: 4,
            }}>
              カードを選択すると詳細が表示されます
            </div>
          )}
        </div>

        {/* RIGHT: deck overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <SlotsRow
            partner={CARD_POOL.find((c) => c.num === draft.partner)}
            caseCard={CARD_POOL.find((c) => c.num === draft.case)}
            total={totalCards} distinct={distinctKinds}
            onPickPartner={() => setModal('partner')} onPickCase={() => setModal('case')}
          />
          <DeckStats deck={draft} />
          <DeckList
            deck={draft} highlightNum={selectedNum}
            manualOrder={manualOrder} onToggleOrder={() => setManualOrder((v) => !v)}
            onAdd={addCard} onRemove={removeCard} onSelect={setSelectedNum} onReorder={reorder}
            idCounts={idCounts}
          />
          {validation.ok ? (
            <WarningBanner tone="info" title="検証 OK" body="40 枚 / 同 ID ≤ 3 / パートナー 1 / 事件 1 を満たしています" />
          ) : (
            <WarningBanner tone="error" title="検証エラー" items={validation.errors} />
          )}
        </div>
      </div>

      {modal === 'partner' && (
        <SlotPickerModal title="パートナーを選択" cards={PARTNER_CARDS} selected={draft.partner}
          onPick={setPartner} onClose={() => setModal(null)} />
      )}
      {modal === 'case' && (
        <SlotPickerModal title="事件を選択" cards={CASE_CARDS} selected={draft.case}
          onPick={setCase} onClose={() => setModal(null)} />
      )}
      {modal === 'code' && (
        <DeckCodeModal deck={draft} onImport={importDeck} onClose={() => setModal(null)} />
      )}
      {modal === 'testhand' && (
        <TestHandModal deck={draft} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ---- SubToolbar ----

function SubToolbar({
  deckName, onRename, decks, editingId, onSelectDeck,
  onNew, onDuplicate, onDelete, onCode, onTestHand, onSave, onCancel, ok, dirty,
}: {
  deckName: string; onRename: (s: string) => void;
  decks: DeckRecord[]; editingId: string; onSelectDeck: (id: string) => void;
  onNew: () => void; onDuplicate: () => void; onDelete: () => void;
  onCode: () => void; onTestHand: () => void; onSave: () => void; onCancel: () => void;
  ok: boolean; dirty: boolean;
}) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 64, height: 60,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 8,
      background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
      borderBottom: `1px solid rgba(78,195,255,0.15)`, zIndex: 8,
    }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>DECK EDIT</span>
      <input value={deckName} onChange={(e) => onRename(e.target.value)} style={{
        marginLeft: 6, padding: '6px 12px', minWidth: 220,
        background: 'rgba(0,0,0,0.5)', color: T.textPrimary,
        border: `1px solid ${T.gold}55`, borderRadius: 3,
        fontFamily: T.fontJp, fontSize: 15, fontWeight: 700,
      }} />
      <select value={editingId} onChange={(e) => onSelectDeck(e.target.value)} title="デッキ切替" style={{
        padding: '6px 8px', background: 'rgba(0,0,0,0.5)', color: T.textPrimary,
        border: `1px solid ${T.neonBlue}55`, borderRadius: 3, fontFamily: T.fontJp, fontSize: 12, cursor: 'pointer',
      }}>
        {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        {!decks.some((d) => d.id === editingId) && <option value={editingId}>{deckName} (新規)</option>}
      </select>
      <ToolBtn label="新規" onClick={onNew} />
      <ToolBtn label="複製" onClick={onDuplicate} />
      <ToolBtn label="削除" onClick={onDelete} danger />
      <ToolBtn label="コード" onClick={onCode} />
      <ToolBtn label="テスト" onClick={onTestHand} />

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {dirty && <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.neonYellow, letterSpacing: '0.1em' }}>● 未保存</span>}
        <SetupButton label="キャンセル" sub="CANCEL" onClick={onCancel} />
        <button onClick={onSave} disabled={!ok} style={{
          padding: '8px 18px',
          background: ok ? `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.3)})` : 'rgba(78,195,255,0.05)',
          color: ok ? '#1a1208' : T.textDisabled,
          border: `1px solid ${ok ? T.gold : T.textMuted}66`, borderRadius: 3,
          fontFamily: T.fontJp, fontSize: 13, fontWeight: 800, letterSpacing: '0.1em',
          cursor: ok ? 'pointer' : 'not-allowed',
        }}>保存 · SAVE</button>
      </div>
    </div>
  );
}

function ToolBtn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  const c = danger ? T.red : T.neonBlue;
  return (
    <button onClick={onClick} className="meta-btn-small" style={{
      padding: '6px 10px', background: 'rgba(0,0,0,0.4)',
      border: `1px solid ${c}55`, borderRadius: 3,
      color: c, fontFamily: T.fontJp, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    }}>{label}</button>
  );
}

function SearchBox({ q, onChange }: { q: string; onChange: (q: string) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
      background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}44`, borderRadius: 3,
    }}>
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="6" cy="6" r="4" stroke={T.gold} strokeWidth="1.4" fill="none" />
        <line x1="9" y1="9" x2="13" y2="13" stroke={T.gold} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input value={q} onChange={(e) => onChange(e.target.value)} placeholder="名前 / 効果 / 番号 / 特徴"
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: T.textPrimary, fontFamily: T.fontJp, fontSize: 12 }} />
      {q && <button onClick={() => onChange('')} aria-label="クリア" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textMuted, fontSize: 13 }}>×</button>}
    </div>
  );
}

// ---- Pool grid ----

function PoolGrid({ cards, selectedNum, idCounts, onSelect, onAdd }: {
  cards: CardDef[]; selectedNum: string; idCounts: Map<string, number>;
  onSelect: (n: string) => void; onAdd: (n: string) => void;
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
        <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em' }}>
          ダブルクリック / 右クリックで追加
        </span>
      </div>
      <div style={{
        flex: 1, overflow: 'auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
        gap: 8, paddingRight: 4,
      }}>
        {cards.map((card) => {
          const cnt = idCounts.get(card.id) ?? 0;
          const atMax = cnt >= MAX_PER_ID;
          return (
            <MetaCard key={card.num} card={card} w={82}
              selected={card.num === selectedNum}
              count={cnt || undefined} maxCount={MAX_PER_ID} showMax atMax={atMax}
              onClick={() => onSelect(card.num)}
              onDoubleClick={() => onAdd(card.num)}
              onContextMenu={() => onAdd(card.num)}
              hoverable
            />
          );
        })}
        {cards.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: T.textMuted, fontFamily: T.fontMono, fontSize: 11, padding: 24 }}>
            条件に一致するカードがありません
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Card detail panel ----

function CardDetailPanel({ card, count, onAdd, onRemove }: {
  card: CardDef; count: number; onAdd: () => void; onRemove: () => void;
}) {
  const c = COLOR_TOKEN[card.color] || T.blue;
  const atMax = count >= MAX_PER_ID;
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.7))',
      border: `1px solid ${c}55`, borderRadius: 4, boxShadow: `inset 0 0 40px ${c}11`,
      display: 'flex', gap: 16,
    }}>
      <div style={{ filter: `drop-shadow(0 0 24px ${c}66) drop-shadow(0 8px 16px rgba(0,0,0,0.7))` }}>
        <MetaCard card={card} w={140} hoverable={false} />
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
          <StatBox label="AP" value={card.ap ? card.ap.toLocaleString() : '—'} accent={T.apColor} />
          <StatBox label="LP" value={card.lp ?? '—'} accent={T.lpColor} />
        </div>
        <div style={{
          padding: '8px 12px', flex: 1, background: 'rgba(0,0,0,0.45)',
          border: `1px solid ${c}33`, borderRadius: 3,
          fontSize: 12, color: T.textPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 88, overflow: 'auto',
        }}>{card.effectShort}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button onClick={onRemove} disabled={count <= 0} aria-label="1枚減らす" style={stepBtn(count > 0)}>－</button>
          <span style={{
            fontFamily: T.fontMono, fontSize: 14, fontWeight: 800,
            color: atMax ? T.gold : T.textPrimary, minWidth: 44, textAlign: 'center',
          }}>{count} / {MAX_PER_ID}</span>
          <button onClick={onAdd} disabled={atMax} aria-label="1枚追加" style={stepBtn(!atMax)}>＋</button>
          {atMax && <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.gold, letterSpacing: '0.1em' }}>同 ID 上限</span>}
        </div>
      </div>
    </div>
  );
}

function stepBtn(enabled: boolean): React.CSSProperties {
  return {
    width: 34, height: 30, borderRadius: 3, cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled ? `${T.gold}22` : 'rgba(0,0,0,0.3)',
    border: `1px solid ${enabled ? T.gold : T.textMuted}55`,
    color: enabled ? T.gold : T.textDisabled, fontFamily: T.fontMono, fontSize: 16, fontWeight: 800,
  };
}

// ---- Partner / Case slots ----

function SlotsRow({ partner, caseCard, total, distinct, onPickPartner, onPickCase }: {
  partner: CardDef | undefined; caseCard: CardDef | undefined;
  total: number; distinct: number; onPickPartner: () => void; onPickCase: () => void;
}) {
  return (
    <div style={{
      padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'stretch',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.7))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
    }}>
      <Slot label="パートナー" card={partner} accent={T.gold} onClick={onPickPartner} />
      <Slot label="事件" card={caseCard} accent={T.red} onClick={onPickCase} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 26, fontWeight: 800, color: total === 40 ? T.gold : T.red }}>{total}</span>
          <span style={{ fontFamily: T.fontMono, fontSize: 13, color: T.textMuted }}> / 40</span>
        </div>
        <div style={{ textAlign: 'center', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.12em' }}>
          {distinct} 種類
        </div>
      </div>
    </div>
  );
}

function Slot({ label, card, accent, onClick }: { label: string; card: CardDef | undefined; accent: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="meta-card-hover" style={{
      width: 64, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'center',
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: accent, letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
      {card ? (
        <div style={{ filter: `drop-shadow(0 0 10px ${accent}55)` }}>
          <MetaCard card={card} w={62} hoverable={false} />
        </div>
      ) : (
        <div style={{
          width: 62, height: 87, borderRadius: 4,
          border: `1.5px dashed ${accent}88`, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent, fontFamily: T.fontMono, fontSize: 20, fontWeight: 800,
        }}>＋</div>
      )}
    </button>
  );
}

// ---- Deck stats (cost curve + color/type) ----

function DeckStats({ deck }: { deck: DeckRecord }) {
  const stats = useMemo(() => computeDeckStats(deck), [deck]);
  const maxCost = Math.max(1, ...Object.values(stats.costs));
  const costBars = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ cost: n, count: stats.costs[n] ?? 0 }));
  return (
    <div style={{
      padding: '10px 12px', display: 'flex', gap: 12,
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, color: T.gold, letterSpacing: '0.25em' }}>COST</span>
          <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 9, color: T.textMuted }}>
            avg <span style={{ color: T.textPrimary, fontWeight: 700 }}>{stats.avgCost.toFixed(1)}</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 50 }}>
          {costBars.map((b) => (
            <div key={b.cost} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, color: b.count > 0 ? T.textPrimary : T.textDisabled }}>{b.count > 0 ? b.count : ''}</div>
              <div style={{
                width: '100%', height: `${(b.count / maxCost) * 32 + (b.count > 0 ? 4 : 1)}px`,
                background: b.count > 0 ? `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.4)})` : 'rgba(78,195,255,0.1)',
                borderRadius: 1,
              }} />
              <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, marginTop: 2 }}>{b.cost}{b.cost === 8 ? '+' : ''}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: 120 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, color: T.gold, letterSpacing: '0.25em', marginBottom: 4 }}>TYPE</div>
        <TypeRow label="キャラ" value={stats.types.character} max={40} color={T.neonBlue} />
        <TypeRow label="イベント" value={stats.types.event} max={40} color={T.purple} />
      </div>
    </div>
  );
}

function TypeRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
      <span style={{ width: 50, fontSize: 9, color: T.textSecondary }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.4)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, color: T.textPrimary, width: 18, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ---- Deck list ----

function DeckList({ deck, highlightNum, manualOrder, onToggleOrder, onAdd, onRemove, onSelect, onReorder, idCounts }: {
  deck: DeckRecord; highlightNum: string; manualOrder: boolean; onToggleOrder: () => void;
  onAdd: (n: string) => void; onRemove: (n: string) => void; onSelect: (n: string) => void;
  onReorder: (from: number, to: number) => void; idCounts: Map<string, number>;
}) {
  const dragFrom = useRef<number | null>(null);
  // 表示用の並び。自動 = 種別(キャラ→イベント)→コスト。手動 = deck.cards の配列順。
  const rows = useMemo(() => {
    const withIdx = deck.cards.map((e, idx) => ({ ...e, idx, card: CARD_POOL.find((c) => c.num === e.num) }))
      .filter((e): e is typeof e & { card: CardDef } => !!e.card);
    if (manualOrder) return withIdx;
    return withIdx.sort((a, b) => {
      if (a.card.type !== b.card.type) return a.card.type === 'character' ? -1 : 1;
      return (a.card.cost ?? 99) - (b.card.cost ?? 99) || a.card.name.localeCompare(b.card.name, 'ja');
    });
  }, [deck.cards, manualOrder]);

  return (
    <div style={{
      flex: 1, padding: '10px 12px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>DECK LIST</span>
        <button onClick={onToggleOrder} className="meta-btn-small" style={{
          marginLeft: 'auto', padding: '2px 8px', background: 'rgba(0,0,0,0.4)',
          border: `1px solid ${T.neonBlue}55`, borderRadius: 2,
          color: T.neonBlue, fontFamily: T.fontMono, fontSize: 9, cursor: 'pointer', letterSpacing: '0.1em',
        }}>{manualOrder ? '手動並べ替え' : '自動整列'}</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {rows.map((e) => {
          const idTotal = idCounts.get(e.card.id) ?? e.count;
          return (
            <DeckRow key={e.num} entry={e} idTotal={idTotal} highlight={e.num === highlightNum}
              draggable={manualOrder}
              onSelect={() => onSelect(e.num)} onAdd={() => onAdd(e.num)} onRemove={() => onRemove(e.num)}
              onDragStart={() => { dragFrom.current = e.idx; }}
              onDrop={() => { if (dragFrom.current != null) onReorder(dragFrom.current, e.idx); dragFrom.current = null; }}
            />
          );
        })}
        {rows.length === 0 && (
          <div style={{ textAlign: 'center', color: T.textMuted, fontFamily: T.fontMono, fontSize: 11, padding: 20 }}>
            プールからカードを追加してください
          </div>
        )}
      </div>
    </div>
  );
}

function DeckRow({ entry, idTotal, highlight, draggable, onSelect, onAdd, onRemove, onDragStart, onDrop }: {
  entry: { num: string; count: number; card: CardDef };
  idTotal: number; highlight: boolean; draggable: boolean;
  onSelect: () => void; onAdd: () => void; onRemove: () => void;
  onDragStart: () => void; onDrop: () => void;
}) {
  const c = COLOR_TOKEN[entry.card.color] || T.blue;
  const over = idTotal > 3;
  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={draggable ? onDrop : undefined}
      className="meta-row"
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
        background: highlight ? `${T.gold}11` : 'transparent',
        border: highlight ? `1px solid ${T.gold}55` : '1px solid transparent',
        borderRadius: 2, cursor: draggable ? 'grab' : 'default', color: T.textPrimary,
      }}
    >
      <div style={{
        width: 20, height: 20, flexShrink: 0,
        background: `linear-gradient(180deg, ${c}, ${shade(c, -0.4)})`,
        border: `1px solid ${shade(c, -0.5)}`, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontMono, fontWeight: 800, fontSize: 10, color: '#fff',
      }}>{entry.card.cost ?? '—'}</div>
      <button onClick={onSelect} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'inherit', padding: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.card.name}
          {entry.card.ap != null && (
            <span style={{ marginLeft: 5, fontSize: 9, color: T.gold, fontFamily: T.fontMono, fontWeight: 700 }}>AP {entry.card.ap.toLocaleString()}</span>
          )}
        </div>
        <div style={{ fontSize: 9, color: T.textMuted, fontFamily: T.fontMono }}>
          {entry.num} · {(entry.card.features ?? []).join(' / ') || typeLabel(entry.card.type)}
          {over && <span style={{ color: T.red, marginLeft: 6 }}>ID合計 {idTotal} ⚠</span>}
        </div>
      </button>
      <button onClick={onRemove} className="meta-btn-small" style={miniBtn(T.textMuted)} aria-label="1枚減らす">－</button>
      <div style={{
        minWidth: 28, textAlign: 'center', padding: '1px 0',
        background: over ? T.red : 'rgba(255,215,0,0.18)',
        border: `1px solid ${over ? T.red : T.gold}66`, borderRadius: 2,
        fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: over ? '#fff' : T.gold,
      }}>×{entry.count}</div>
      <button onClick={onAdd} disabled={idTotal >= 3} className="meta-btn-small" style={miniBtn(idTotal >= 3 ? T.textDisabled : T.gold)} aria-label="1枚増やす">＋</button>
    </div>
  );
}

function miniBtn(color: string): React.CSSProperties {
  return {
    width: 22, height: 22, flexShrink: 0, borderRadius: 2,
    background: 'rgba(0,0,0,0.4)', border: `1px solid ${color}55`,
    color, fontFamily: T.fontMono, fontSize: 13, fontWeight: 800, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

// ---- Modals ----

function ModalShell({ title, onClose, width, children }: { title: string; onClose: () => void; width?: number; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(2,6,12,0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: width ?? 720, maxWidth: '92vw', maxHeight: '86vh',
        background: 'linear-gradient(180deg, rgba(13,38,64,0.98), rgba(10,26,40,0.98))',
        border: `1px solid ${T.gold}66`, borderRadius: 6, boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', padding: '12px 16px',
          borderBottom: `1px solid rgba(78,195,255,0.2)`, background: 'rgba(0,0,0,0.35)',
        }}>
          <span style={{ fontFamily: T.fontSerif, fontSize: 16, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.06em' }}>{title}</span>
          <button onClick={onClose} aria-label="閉じる" style={{
            marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer',
            color: T.textMuted, fontFamily: T.fontMono, fontSize: 18,
          }}>×</button>
        </div>
        <div style={{ padding: 16, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

function SlotPickerModal({ title, cards, selected, onPick, onClose }: {
  title: string; cards: readonly CardDef[]; selected: string; onPick: (n: string) => void; onClose: () => void;
}) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12 }}>
        {cards.map((card) => (
          <div key={card.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <MetaCard card={card} w={108} selected={card.num === selected} onClick={() => onPick(card.num)} hoverable />
            <div style={{ fontSize: 11, color: T.textSecondary, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 108 }}>{card.name}</div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function DeckCodeModal({ deck, onImport, onClose }: {
  deck: DeckRecord; onImport: (d: DecodedDeck) => void; onClose: () => void;
}) {
  const code = useMemo(() => encodeDeck(deck), [deck]);
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const doCopy = () => {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  const doImport = () => {
    const decoded = decodeDeck(input);
    if (!decoded) { setErr('デッキコードの形式が正しくありません'); return; }
    onImport(decoded);
  };

  return (
    <ModalShell title="デッキコード · 入出力" onClose={onClose} width={620}>
      <div style={{ marginBottom: 16 }}>
        <Label2>エクスポート (このデッキを共有)</Label2>
        <textarea readOnly value={code} style={textareaStyle} onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
        <button onClick={doCopy} style={primaryBtn}>{copied ? 'コピーしました ✓' : 'コードをコピー'}</button>
      </div>
      <div>
        <Label2>インポート (コードを貼り付け)</Label2>
        <textarea value={input} onChange={(e) => { setInput(e.target.value); setErr(null); }} placeholder="CONAN1:..." style={textareaStyle} />
        {err && <div style={{ color: T.red, fontFamily: T.fontMono, fontSize: 11, marginBottom: 6 }}>{err}</div>}
        <button onClick={doImport} disabled={!input.trim()} style={{ ...primaryBtn, opacity: input.trim() ? 1 : 0.5 }}>読み込む</button>
      </div>
    </ModalShell>
  );
}

function TestHandModal({ deck, onClose }: { deck: DeckRecord; onClose: () => void }) {
  const pool = useMemo(() => {
    const arr: string[] = [];
    for (const e of deck.cards) for (let i = 0; i < e.count; i++) arr.push(e.num);
    return arr;
  }, [deck.cards]);
  const [hand, setHand] = useState<string[]>(() => draw5(pool));
  return (
    <ModalShell title="テストハンド · 初手 5 枚" onClose={onClose} width={620}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, marginBottom: 12, letterSpacing: '0.1em' }}>
        40 枚デッキ ({pool.length} 枚) からランダムに 5 枚 ※パートナー/事件は含まない
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', minHeight: 150 }}>
        {hand.length === 0 ? (
          <div style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 12, padding: 30 }}>デッキにカードがありません</div>
        ) : hand.map((num, i) => {
          const card = CARD_POOL.find((c) => c.num === num);
          return card ? <MetaCard key={i} card={card} w={96} hoverable={false} /> : null;
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
        <button onClick={() => setHand(draw5(pool))} disabled={pool.length === 0} style={primaryBtn}>引き直す ⟳</button>
      </div>
    </ModalShell>
  );
}

function draw5(pool: string[]): string[] {
  const a = pool.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, 5);
}

// ---- small shared bits ----

function Label2({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: T.fontMono, fontSize: 10, fontWeight: 800, color: T.gold, letterSpacing: '0.2em', marginBottom: 6 }}>{children}</div>;
}
const textareaStyle: React.CSSProperties = {
  width: '100%', minHeight: 70, resize: 'vertical', marginBottom: 8,
  background: 'rgba(0,0,0,0.5)', color: T.textPrimary, border: `1px solid ${T.neonBlue}44`,
  borderRadius: 3, padding: '8px 10px', fontFamily: T.fontMono, fontSize: 11, lineHeight: 1.4,
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', background: `${T.gold}22`, color: T.gold,
  border: `1px solid ${T.gold}66`, borderRadius: 3,
  fontFamily: T.fontJp, fontSize: 12, fontWeight: 700, cursor: 'pointer',
};

function Pill({ color, label }: { color: string; label: string }) {
  return <span style={{ padding: '1px 6px', background: color, color: '#fff', fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', borderRadius: 1 }}>{label}</span>;
}

function StatBox({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{ flex: 1, padding: '6px 8px', textAlign: 'center', background: `${accent}11`, border: `1px solid ${accent}44`, borderRadius: 2 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function typeLabel(t: CardKind): string {
  return ({ partner: 'パートナー', character: 'キャラ', event: 'イベント', case: '事件' } as const)[t];
}

function computeDeckStats(deck: DeckRecord) {
  let costSum = 0, costCount = 0;
  const costs: Record<number, number> = {};
  const types: Record<string, number> = { character: 0, event: 0, partner: 0, case: 0 };
  for (const e of deck.cards) {
    const card = CARD_POOL.find((c) => c.num === e.num);
    if (!card) continue;
    types[card.type] = (types[card.type] ?? 0) + e.count;
    if (card.cost != null) {
      const k = Math.min(card.cost, 8);
      costs[k] = (costs[k] ?? 0) + e.count;
      costSum += card.cost * e.count;
      costCount += e.count;
    }
  }
  return { costs, types, avgCost: costCount > 0 ? costSum / costCount : 0 };
}
