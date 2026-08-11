// spec: .claude/specs/meta-ui/07-screens-library.md + 12-screens-rebuild.md + 13-md-deck-editor.md
// Phase 18 → MD 風 3 ペイン リデザイン (spec 13):
//   左 (~290px) 詳細: 大カード(click→CardExpandModal) + 名前/種別/特徴 + C/AP/LP + 効果文 + [－][n/3][＋]
//   中央 (flex) デッキ: パートナー/事件スロット + 40/40 + cost曲線 + 種別内訳 + 検証バナー
//                       + 40枚カード画像グリッド (1タイル+×nバッジ, type→cost→name 自動整列, ホバー－で除外)
//   右 (flex) 手持ち POOL: 🔍検索 + 並べ替え(num/cost/ap/lp/name) + 「フィルタ N」(slide-over の FilterRail)
//                          + プール画像グリッド (click=追加+詳細, 同 ID 上限到達は atMax で灰・追加不可)
//   ツールバー: デッキ名 / 切替 / 新規・複製・削除 / コード入出力 / テストハンド / 保存 (現行 SubToolbar 流用)
//   ロジック/state/ハンドラ/検証は全て現状流用・挙動不変。手動並べ替え(D&D)は廃止 (自動整列のみ)。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T, shade, COLOR_TOKEN } from '../shared/tokens';
import { PrimaryHeader } from '../shared/PrimaryHeader';
import { MetaCard } from '../shared/MetaCard';
import { FilterRail } from '../shared/FilterRail';
import { FilterGroup } from '../shared/FilterGroup';
import { SetupButton } from '../shared/Button';
import { WarningBanner } from '../shared/WarningBanner';
import { CatalogCardExpandModal } from '../components/CatalogCardExpandModal';
import { HomeDeckSelectorDialog } from './HomeDeckSelectorDialog';
import { engineStub } from '../stubs/engineStub';
import { useDecksStore } from '../state/decksStore';
import { useFiltersStore } from '../state/filtersStore';
import { useWindowedCollection } from '../hooks/useWindowedCollection';
import {
  CARD_POOL, cardIdOf, countsByCardId, defaultCaseForPartner,
  PARTNER_CARDS, CASE_CARDS,
} from '../data/cardPool';
import {
  COLOR_META, matchesFilter, sortCards, activeFilterCount, toggleIn,
  type SortKey, type SortDir,
} from '../data/cardFilter';
import { encodeDeck, decodeDeck, type DecodedDeck } from '../util/deckCode';
import type { CardColor, CardDef, CardKind, DeckRecord } from '../data/types';
import type { Route } from '../router/routes';
import type { RegisterNavigationBlocker } from '../router/navigationBlocker';

interface Props {
  onNav: (r: Route) => void;
  registerNavigationBlocker?: RegisterNavigationBlocker;
}

const NOOP_REGISTER_NAVIGATION_BLOCKER: RegisterNavigationBlocker = () => () => {};

const DEFAULT_MAX_PER_ID = 3;
const POOL_TYPES: CardKind[] = ['character', 'event'];
const poolCardNumber = (card: CardDef) => card.num;

const SORTS: { k: SortKey; label: string }[] = [
  { k: 'num',  label: '番号' },
  { k: 'cost', label: 'コスト' },
  { k: 'ap',   label: 'AP' },
  { k: 'lp',   label: 'LP' },
  { k: 'name', label: '名前' },
];

const panelBg: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
  border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
};

function emptyDeck(): DeckRecord {
  return { id: `deck-${Date.now()}`, name: '新しいデッキ', partner: '', case: '', cards: [], modified: Date.now() };
}

type ModalKind = 'partner' | 'case' | 'code' | 'testhand' | null;

export function DeckEditor({
  onNav,
  registerNavigationBlocker = NOOP_REGISTER_NAVIGATION_BLOCKER,
}: Props) {
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
  // MD 風: プール並べ替えキー (新規 UI、render ローカル state)。手動 D&D 並べ替えは廃止。
  const [poolSort, setPoolSort] = useState<SortKey>('cost');
  const [poolSortDir, setPoolSortDir] = useState<SortDir>('asc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [deckSelectorOpen, setDeckSelectorOpen] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [draggingNum, setDraggingNum] = useState<string | null>(null);
  const [dropState, setDropState] = useState<'idle' | 'active' | 'accepted' | 'rejected'>('idle');
  const [announcement, setAnnouncement] = useState('');
  const [announcementTone, setAnnouncementTone] = useState<'info' | 'error'>('info');
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const detailCloseRef = useRef<HTMLButtonElement | null>(null);
  const slotPickerReturnFocusRef = useRef<HTMLElement | null>(null);
  const validationRef = useRef<HTMLDivElement | null>(null);
  const deckSelectorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [poolDropActive, setPoolDropActive] = useState(false);

  const original = decks.find((d) => d.id === draft.id);
  const dirty = !original || JSON.stringify(original) !== JSON.stringify({ ...draft, modified: original.modified });
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const confirmDiscard = useCallback(() => (
    !dirtyRef.current || window.confirm('未保存の変更があります。破棄してよろしいですか?')
  ), []);

  useEffect(() => registerNavigationBlocker({
    confirmRouteLeave: ({ from, to }) => from !== 'deck' || to === 'deck' || confirmDiscard(),
    shouldWarnBeforeUnload: () => dirtyRef.current,
  }), [confirmDiscard, registerNavigationBlocker]);

  const filteredPool = useMemo(() => {
    const base = CARD_POOL
      .filter((c) => POOL_TYPES.includes(c.type))
      .filter((c) => matchesFilter(c, filter));
    return sortCards(base, poolSort, poolSortDir);
  }, [filter, poolSort, poolSortDir]);
  // FilterRail のカウントはプールに出るカード (キャラ/イベント) のみを母集団にする
  // (パートナー/事件を含めると 色/レアリティ/キーワード のカウントが実数と食い違う)。
  const poolForRail = useMemo(() => CARD_POOL.filter((c) => POOL_TYPES.includes(c.type)), []);

  const idCounts = useMemo(() => countsByCardId(draft.cards), [draft.cards]);
  const validation = engineStub.cards.validateDeck(draft);
  const selectedCard = CARD_POOL.find((c) => c.num === selectedNum);

  const announce = (message: string, tone: 'info' | 'error' = 'info') => {
    setAnnouncement(message);
    setAnnouncementTone(tone);
  };

  // ---- mutations ----
  const addCard = (num: string) => {
    const card = CARD_POOL.find((c) => c.num === num);
    if (!card || !POOL_TYPES.includes(card.type)) {
      announce('このカードはデッキに追加できません。キャラまたはイベントを選んでください。', 'error');
      return false;
    }
    const sameId = idCounts.get(card.id) ?? 0;
    const limit = card.deckLimit ?? DEFAULT_MAX_PER_ID;
    if (limit !== 'unlimited' && sameId >= limit) {
      announce(`${card.name}は追加できません。同一IDは${limit}枚までです。デッキから1枚除いて再試行してください。`, 'error');
      return false;
    }
    setDraft((d) => {
      const currentSameId = d.cards.reduce((s, e) => s + (cardIdOf(e.num) === card.id ? e.count : 0), 0);
      if (limit !== 'unlimited' && currentSameId >= limit) return d; // 同 ID 上限 (rules/02)
      const idx = d.cards.findIndex((e) => e.num === num);
      if (idx >= 0) {
        const next = [...d.cards];
        next[idx] = { ...next[idx]!, count: next[idx]!.count + 1 };
        return { ...d, cards: next };
      }
      return { ...d, cards: [...d.cards, { num, count: 1 }] };
    });
    setSelectedNum(num);
    announce(`${card.name}を1枚追加しました`);
    return true;
  };

  const removeCard = (num: string) => {
    const card = CARD_POOL.find((candidate) => candidate.num === num);
    const current = draft.cards.find((entry) => entry.num === num)?.count ?? 0;
    if (!card || current <= 0) {
      announce('デッキから除けるカードがありません。採用中のカードを選んでください。', 'error');
      return false;
    }
    setDraft((d) => {
      const idx = d.cards.findIndex((e) => e.num === num);
      if (idx < 0) return d;
      const cur = d.cards[idx]!;
      if (cur.count <= 1) return { ...d, cards: d.cards.filter((e) => e.num !== num) };
      const next = [...d.cards];
      next[idx] = { ...cur, count: cur.count - 1 };
      return { ...d, cards: next };
    });
    setDropState('idle');
    announce(`${card.name}を1枚除きました`);
    return true;
  };

  const openDetail = (num: string, trigger?: HTMLElement | null) => {
    setSelectedNum(num);
    detailTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    const target = detailTriggerRef.current;
    detailTriggerRef.current = null;
    if (target?.isConnected) target.focus();
  };

  const openSlotPicker = (kind: 'partner' | 'case', returnFocus: HTMLElement | null = null) => {
    slotPickerReturnFocusRef.current = returnFocus;
    setModal(kind);
  };

  const openSlotPickerFromDetail = (kind: 'partner' | 'case') => {
    setDetailOpen(false);
    openSlotPicker(kind, detailTriggerRef.current);
  };

  useEffect(() => {
    if (detailOpen) requestAnimationFrame(() => detailCloseRef.current?.focus());
  }, [detailOpen, selectedNum]);

  useEffect(() => {
    if (!announcement || announcementTone === 'error') return undefined;
    const timer = window.setTimeout(() => setAnnouncement((current) => current === announcement ? '' : current), 2400);
    return () => window.clearTimeout(timer);
  }, [announcement, announcementTone]);

  const addDroppedCard = (num: string) => {
    const accepted = addCard(num);
    setDropState(accepted ? 'accepted' : 'rejected');
    if (accepted) {
      window.setTimeout(() => setDropState((current) => current === 'accepted' ? 'idle' : current), 650);
    }
  };

  const setPartner = (num: string) => {
    setDraft((d) => ({ ...d, partner: num, case: d.case || defaultCaseForPartner(num) }));
    setModal(null);
  };
  const setCase = (num: string) => { setDraft((d) => ({ ...d, case: num })); setModal(null); };

  // ---- deck management ----
  const loadDeck = (id: string) => {
    if (!confirmDiscard()) return false;
    setEditingId(id);
    const target = decks.find((d) => d.id === id);
    if (target) setDraft(structuredClone(target));
    return Boolean(target);
  };
  const closeDeckSelector = () => {
    setDeckSelectorOpen(false);
    deckSelectorTriggerRef.current = null;
  };
  const selectDeckForEditing = (id: string) => {
    if (!loadDeck(id)) return;
    closeDeckSelector();
  };
  const newDeck = () => { if (!confirmDiscard()) return; const d = emptyDeck(); setEditingId(d.id); setDraft(d); setSelectedNum(''); };
  const duplicateDeck = () => {
    const d: DeckRecord = { ...structuredClone(draft), id: `deck-${Date.now()}`, name: `${draft.name} のコピー`, modified: Date.now() };
    setEditingId(d.id); setDraft(d);
  };
  const deleteDeck = async () => {
    if (!window.confirm(`「${draft.name}」を削除しますか?`)) return;
    try {
      await removeDeck(draft.id);
    } catch {
      announce('デッキ削除の保存に失敗しました。もう一度お試しください。', 'error');
      return;
    }
    const remaining = decks.filter((d) => d.id !== draft.id);
    if (remaining[0]) { setEditingId(remaining[0].id); setDraft(structuredClone(remaining[0])); }
    else { const d = emptyDeck(); setEditingId(d.id); setDraft(d); }
  };
  const onSave = () => {
    if (!validation.ok) {
      validationRef.current?.scrollIntoView({ block: 'nearest' });
      validationRef.current?.focus();
      announce(`保存できません。${validation.errors[0] ?? 'デッキを確認してください。'}`, 'error');
      return;
    }
    if (decks.find((d) => d.id === draft.id)) update(draft.id, draft);
    else { add({ ...draft, id: draft.id || `deck-${Date.now()}` }); setEditingId(draft.id); }
    announce('デッキを保存しました');
  };
  const importDeck = (decoded: { name: string; partner: string; case: string; cards: { num: string; count: number }[] }) => {
    if (!confirmDiscard()) return;
    const d: DeckRecord = { id: `deck-${Date.now()}`, name: decoded.name, partner: decoded.partner, case: decoded.case, cards: decoded.cards, modified: Date.now() };
    setEditingId(d.id); setDraft(d); setModal(null);
    announce('デッキコードを読み込みました');
  };

  const showValidation = () => {
    if (announcementTone === 'info') setAnnouncement('');
    validationRef.current?.scrollIntoView({ block: 'nearest' });
    validationRef.current?.focus();
  };

  return (
    <div className="home-screen deck-editor-screen" data-testid="deck-editor">
      <PrimaryHeader current="deck" onNav={onNav} />

      <SubToolbar
        deckName={draft.name}
        onRename={(name) => setDraft((d) => ({ ...d, name }))}
        onChooseDeck={(trigger) => {
          deckSelectorTriggerRef.current = trigger;
          setDeckSelectorOpen(true);
        }}
        onNew={newDeck} onDuplicate={duplicateDeck} onDelete={deleteDeck}
        onCode={() => setModal('code')} onTestHand={() => setModal('testhand')}
        onSave={onSave} onCancel={() => onNav('home')}
        ok={validation.ok} dirty={dirty}
        validationError={validation.errors[0]}
        onShowValidation={showValidation}
      />

      <main className="deck-workspace" data-testid="deck-workspace">
        <section className="deck-main-pane" aria-label="編集中のデッキ">
          <div className="deck-overview" data-testid="deck-overview">
            <SlotsRow
              partner={CARD_POOL.find((c) => c.num === draft.partner)}
              caseCard={CARD_POOL.find((c) => c.num === draft.case)}
              onPickPartner={() => openSlotPicker('partner')} onPickCase={() => openSlotPicker('case')}
              onOpenDetail={openDetail}
              onExpand={setExpandedCardId}
            />
            <DeckStats deck={draft} />
          </div>
          <DeckGrid
            deck={draft} idCounts={idCounts} selectedNum={selectedNum}
            dropState={dropState}
            onDropAdd={addDroppedCard}
            onDeckDragEnd={() => setPoolDropActive(false)}
            onSelect={(num, trigger) => openDetail(num, trigger)}
            onExpand={setExpandedCardId}
          />
          <div ref={validationRef} className="deck-validation" data-testid="deck-validation" tabIndex={-1}>
            {validation.ok ? (
              <WarningBanner tone="info" title="検証 OK" body="40 枚 / カード別枚数上限 / パートナー 1 / 事件 1 を満たしています" />
            ) : (
              <WarningBanner tone="error" title="検証エラー" items={validation.errors} />
            )}
          </div>
          {detailOpen && selectedCard && (
            <DetailDrawer
              card={selectedCard}
              count={idCounts.get(selectedCard.id) ?? 0}
              printCount={draft.cards.find((entry) => entry.num === selectedCard.num)?.count ?? 0}
              closeRef={detailCloseRef}
              onClose={closeDetail}
              onAdd={() => addCard(selectedCard.num)}
              onRemove={() => removeCard(selectedCard.num)}
              onExpand={() => setExpandedCardId(selectedCard.num)}
              onChangeCard={selectedCard.type === 'partner'
                ? () => openSlotPickerFromDetail('partner')
                : selectedCard.type === 'case'
                  ? () => openSlotPickerFromDetail('case')
                  : undefined}
            />
          )}
        </section>

        <aside
          className="deck-pool-pane"
          data-testid="deck-pool"
          data-remove-drop-state={poolDropActive ? 'active' : 'idle'}
          aria-label="カード一覧"
          onDragEnter={(event) => {
            if (!Array.from(event.dataTransfer.types).includes('application/x-conan-deck-card')) return;
            event.preventDefault();
            setPoolDropActive(true);
          }}
          onDragOver={(event) => {
            if (!Array.from(event.dataTransfer.types).includes('application/x-conan-deck-card')) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setPoolDropActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setPoolDropActive(false);
            const num = event.dataTransfer.getData('application/x-conan-deck-card');
            if (num) removeCard(num);
          }}
        >
          <PoolPane
            cards={filteredPool}
            selectedNum={selectedNum}
            idCounts={idCounts}
            draggingNum={draggingNum}
            onOpenDetail={openDetail}
            onDragStart={(num) => setDraggingNum(num)}
            onDragEnd={() => setDraggingNum(null)}
            q={filter.q}
            onQ={(q) => setFilter({ q })}
            sortKey={poolSort} sortDir={poolSortDir}
            onSort={(k, d) => { setPoolSort(k); setPoolSortDir(d ?? 'asc'); }}
            filterCount={activeFilterCount(filter)}
            onOpenFilter={() => setFilterOpen(true)}
            onExpand={setExpandedCardId}
          />
        </aside>
      </main>

      {announcement && (
        <div
          className={`deck-editor-feedback${announcementTone === 'error' ? ' is-error' : ''}`}
          data-testid="deck-feedback"
          role="status"
          aria-label="デッキ編集結果"
          aria-live="polite"
        >
          <span>{announcement}</span>
          <button type="button" aria-label="通知を閉じる" onClick={() => { setAnnouncement(''); setDropState('idle'); }}>×</button>
        </div>
      )}

      <FilterSlideOver open={filterOpen} onClose={() => setFilterOpen(false)}>
        <FilterRail filter={filter} onChange={setFilter} onReset={resetFilter} pool={poolForRail} typeOptions={POOL_TYPES} showMatchModes={false} hideUnavailable />
      </FilterSlideOver>

      {deckSelectorOpen && (
        <HomeDeckSelectorDialog
          decks={decks}
          selectedId={editingId}
          title="編集するデッキを選択"
          description="編集するデッキを選びます"
          confirmLabel="このデッキを編集"
          radioName="deck-editor-selection"
          onConfirm={selectDeckForEditing}
          onClose={closeDeckSelector}
          returnFocus={deckSelectorTriggerRef.current}
        />
      )}

      {modal === 'partner' && (
        <SlotPickerModal title="パートナーを選択" cards={PARTNER_CARDS} selected={draft.partner}
          onPick={setPartner} onClose={() => setModal(null)} onExpand={setExpandedCardId}
          returnFocus={slotPickerReturnFocusRef.current} />
      )}
      {modal === 'case' && (
        <SlotPickerModal title="事件を選択" cards={CASE_CARDS} selected={draft.case}
          onPick={setCase} onClose={() => setModal(null)} onExpand={setExpandedCardId}
          returnFocus={slotPickerReturnFocusRef.current} />
      )}
      {modal === 'code' && (
        <DeckCodeModal deck={draft} onImport={importDeck} onClose={() => setModal(null)} />
      )}
      {modal === 'testhand' && (
        <TestHandModal deck={draft} onClose={() => setModal(null)} />
      )}

      <CatalogCardExpandModal
        card={expandedCardId ? CARD_POOL.find((card) => card.num === expandedCardId) ?? null : null}
        onClose={() => setExpandedCardId(null)}
      />
    </div>
  );
}

// ---- SubToolbar ----

function SubToolbar({
  deckName, onRename, onChooseDeck,
  onNew, onDuplicate, onDelete, onCode, onTestHand, onSave, onCancel, ok, dirty,
  validationError, onShowValidation,
}: {
  deckName: string; onRename: (s: string) => void;
  onChooseDeck: (trigger: HTMLButtonElement) => void;
  onNew: () => void; onDuplicate: () => void; onDelete: () => void;
  onCode: () => void; onTestHand: () => void; onSave: () => void; onCancel: () => void;
  ok: boolean; dirty: boolean; validationError?: string; onShowValidation: () => void;
}) {
  const validationSummary = summarizeValidationError(validationError);
  return (
    <section className="deck-toolbar" aria-label="デッキ編集操作">
      <input className="deck-name-input" aria-label="デッキ名" value={deckName} onChange={(e) => onRename(e.target.value)} />
      <button
        type="button"
        className="deck-change-button"
        onClick={(event) => onChooseDeck(event.currentTarget)}
      >デッキを変更</button>
      <ToolBtn label="新規" onClick={onNew} />
      <ToolBtn label="複製" onClick={onDuplicate} />
      <ToolBtn label="削除" onClick={onDelete} danger />
      <ToolBtn label="コード" onClick={onCode} />
      <ToolBtn label="テスト" onClick={onTestHand} />

      <div className="deck-toolbar-save-group">
        {dirty && <span className="deck-unsaved">● 未保存</span>}
        <SetupButton label="キャンセル" sub="CANCEL" onClick={onCancel} />
        <button
          className={`deck-save-button${dirty ? ' is-dirty' : ''}${!ok ? ' is-invalid' : ''}`}
          aria-label={!ok
            ? `保存不可: ${validationError ?? 'デッキを確認してください。'}`
            : dirty ? '保存（未保存の変更あり）' : '保存'}
          onClick={ok ? onSave : onShowValidation}
        >
          {ok ? '保存' : <><span>保存不可</span><strong>{validationSummary}</strong></>}
        </button>
      </div>
    </section>
  );
}

function summarizeValidationError(error?: string): string {
  if (!error) return '要確認';
  return error.match(/\(([^)]+)\)/)?.[1] ?? error.replace(/^[^:：]+[:：]\s*/, '');
}

function ToolBtn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  const c = danger ? T.red : T.neonBlue;
  return (
    <button onClick={onClick} className={`meta-btn-small deck-tool-button${danger ? ' is-danger' : ''}`} style={{ color: c }}>{label}</button>
  );
}

function SearchBox({ q, onChange, ariaLabel = 'カードを検索', placeholder = '名前 / 効果 / 番号 / 特徴' }: {
  q: string;
  onChange: (q: string) => void;
  ariaLabel?: string;
  placeholder?: string;
}) {
  return (
    <div className="deck-search-box">
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="6" cy="6" r="4" stroke={T.gold} strokeWidth="1.4" fill="none" />
        <line x1="9" y1="9" x2="13" y2="13" stroke={T.gold} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input aria-label={ariaLabel} value={q} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {q && <button type="button" onClick={() => onChange('')} aria-label="検索をクリア" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textMuted, fontSize: 13 }}>×</button>}
    </div>
  );
}

// ---- LEFT: selected card detail drawer ----

function DetailDrawer({ card, count, printCount, closeRef, onClose, onAdd, onRemove, onExpand, onChangeCard }: {
  card: CardDef; count: number; printCount: number;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void; onAdd: () => void; onRemove: () => void; onExpand: () => void;
  onChangeCard?: () => void;
}) {
  const c = COLOR_TOKEN[card.color] || T.blue;
  const limit = card.deckLimit ?? DEFAULT_MAX_PER_ID;
  const limitLabel = limit === 'unlimited' ? '∞' : String(limit);
  const atMax = limit !== 'unlimited' && count >= limit;
  const stats = visibleDeckStatsFor(card);
  const isSlotCard = card.type === 'partner' || card.type === 'case';
  const dialogRef = useRef<HTMLElement | null>(null);

  const onDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
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
    <div className="deck-detail-layer">
      <div
        className="deck-detail-backdrop"
        onMouseDown={(event) => {
          event.preventDefault();
          onClose();
        }}
        aria-hidden="true"
      />
      <aside
        ref={dialogRef}
        className="deck-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`カード詳細: ${card.name}`}
        onKeyDown={onDialogKeyDown}
        style={{ '--deck-card-accent': c } as React.CSSProperties}
      >
        <header className="deck-detail-header">
          <div><span>カード詳細</span><strong>{card.name}</strong></div>
          <button ref={closeRef} type="button" aria-label="カード詳細を閉じる" onClick={onClose}>×</button>
        </header>

        <div className="deck-detail-scroll">
          <div className="deck-detail-summary" data-testid="deck-detail-summary">
            <button type="button" className="deck-detail-art" onClick={onExpand}
              title="クリックで拡大表示" aria-label={`${card.name} を拡大表示`}>
              <MetaCard card={card} w={170} hoverable={false} />
            </button>

            <div className="deck-detail-summary-copy">
              <div className="deck-detail-identity">
                <div>
                  <span>{card.num}</span><span>ID {card.id}</span>
                  <span data-card-colors={(card.colors ?? [card.color]).join(',')} aria-label={`色: ${(card.colors ?? [card.color]).join(',')}`}>
                    {(card.colors ?? [card.color]).map((color) => <Pill key={color} color={COLOR_TOKEN[color]} label={color.toUpperCase()} />)}
                  </span>
                  {card.rarity && <Pill color={T.gold} label={card.rarity} />}
                </div>
                <strong>{card.name}</strong>
                <span>{typeLabel(card.type)}{(card.features ?? []).length > 0 && ` · ${(card.features ?? []).join(' / ')}`}</span>
              </div>

              <div className="deck-detail-stats" role="group" aria-label="カードの能力値">
                {stats.map((stat) => <StatBox key={stat.label} label={stat.label} value={stat.value} accent={stat.accent} />)}
              </div>
            </div>
          </div>

          {card.effectShort && <div className="deck-detail-effect" data-testid="deck-detail-effect">{card.effectShort}</div>}
          {(card.keywords ?? []).length > 0 && (
            <div className="deck-detail-keywords">
              {(card.keywords ?? []).map((keyword) => <span key={keyword}>{keyword}</span>)}
            </div>
          )}
          {!isSlotCard && (
            <div className="deck-detail-count-row">
              <span className="deck-detail-count">採用数 {count} / {limitLabel}</span>
              {atMax && <span className="deck-detail-limit">同 ID 上限</span>}
            </div>
          )}
        </div>

        <footer className={`deck-detail-actions${isSlotCard ? ' deck-detail-actions-change' : ''}`} data-testid="deck-detail-actions">
          {isSlotCard ? (
            <button type="button" className="deck-detail-change" onClick={onChangeCard}>カードを変更</button>
          ) : (
            <>
              <button type="button" className="deck-detail-remove" onClick={onRemove} disabled={printCount <= 0}
                aria-label={`${card.name}をデッキから1枚除く`}>－ 1枚除く</button>
              <button type="button" className="deck-detail-add" onClick={onAdd} disabled={atMax}
                aria-label={`1枚追加: ${card.name}をデッキに追加`}>＋ 1枚追加</button>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}

// ---- Partner / Case slots ----

function SlotsRow({ partner, caseCard, onPickPartner, onPickCase, onOpenDetail, onExpand }: {
  partner: CardDef | undefined; caseCard: CardDef | undefined;
  onPickPartner: () => void; onPickCase: () => void;
  onOpenDetail: (num: string, trigger?: HTMLElement | null) => void;
  onExpand: (num: string) => void;
}) {
  return (
    <div className="deck-slots-row" style={{
      padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'stretch',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.7))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
    }}>
      <Slot label="パートナー" card={partner} accent={T.gold} onPick={onPickPartner} onOpenDetail={onOpenDetail} onExpand={onExpand} />
      <Slot label="事件" card={caseCard} accent={T.red} onPick={onPickCase} onOpenDetail={onOpenDetail} onExpand={onExpand} />
    </div>
  );
}

function Slot({ label, card, accent, onPick, onOpenDetail, onExpand }: {
  label: string; card: CardDef | undefined; accent: string; onPick: () => void;
  onOpenDetail: (num: string, trigger?: HTMLElement | null) => void;
  onExpand: (num: string) => void;
}) {
  return (
    <button onClick={(event) => {
      if (card) onOpenDetail(card.num, event.currentTarget);
      else onPick();
    }} onContextMenu={(e) => {
      if (!card) return;
      e.preventDefault();
      e.currentTarget.focus();
      onExpand(card.num);
    }} className="meta-card-hover" style={{
      width: 64, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'center',
    }}>
      <div className="deck-slot-content">
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
      </div>
    </button>
  );
}

// ---- Deck stats (cost curve + color/type) ----

function DeckStats({ deck }: { deck: DeckRecord }) {
  const stats = useMemo(() => computeDeckStats(deck), [deck]);
  const maxCost = Math.max(1, ...Object.values(stats.costs));
  const costBars = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ cost: n, count: stats.costs[n] ?? 0 }));
  return (
    <div className="deck-stats-panel" style={{
      padding: '10px 14px', display: 'flex', gap: 18,
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
    }}>
      <div className="deck-cost-chart" data-testid="deck-cost-chart" style={{ flex: 1, minWidth: 0 }}>
        <div data-testid="deck-cost-heading" style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, color: T.gold, letterSpacing: '0.25em' }}>COST</div>
        <div className="deck-cost-bars" data-testid="deck-cost-bars" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 62 }}>
          {costBars.map((b) => (
            <div key={b.cost} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, color: b.count > 0 ? T.textPrimary : T.textDisabled }}>{b.count > 0 ? b.count : ''}</div>
              <div style={{
                width: '100%', maxWidth: 74, height: `${(b.count / maxCost) * 42 + (b.count > 0 ? 5 : 1)}px`,
                background: b.count > 0 ? `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.4)})` : 'rgba(78,195,255,0.1)',
                borderRadius: 1,
              }} />
              <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, marginTop: 2 }}>{b.cost}{b.cost === 8 ? '+' : ''}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="deck-type-summary" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7 }}>
        <TypeRow label="キャラ" value={stats.types.character} max={40} color={T.neonBlue} />
        <TypeRow label="イベント" value={stats.types.event} max={40} color={T.apColor} />
      </div>
    </div>
  );
}

function TypeRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 52, fontSize: 9, color: T.textSecondary }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: 'rgba(0,0,0,0.4)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, color: T.textPrimary, width: 18, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ---- CENTER: deck card grid (自動整列 type→cost→name, ×n バッジ) ----

function DeckGrid({ deck, idCounts, selectedNum, dropState, onDropAdd, onDeckDragEnd, onSelect, onExpand }: {
  deck: DeckRecord; idCounts: Map<string, number>; selectedNum: string;
  dropState: 'idle' | 'active' | 'accepted' | 'rejected';
  onDropAdd: (n: string) => void;
  onDeckDragEnd: () => void;
  onSelect: (n: string, trigger: HTMLElement) => void;
  onExpand: (n: string) => void;
}) {
  // 自動整列のみ: 種別(キャラ→イベント) → コスト → 名前。手動 D&D 並べ替えは廃止 (spec 13)。
  const rows = useMemo(() => {
    const withCard = deck.cards
      .map((e) => ({ ...e, card: CARD_POOL.find((c) => c.num === e.num) }))
      .filter((e): e is typeof e & { card: CardDef } => !!e.card);
    return withCard.sort((a, b) => {
      if (a.card.type !== b.card.type) return a.card.type === 'character' ? -1 : 1;
      return (a.card.cost ?? 99) - (b.card.cost ?? 99) || a.card.name.localeCompare(b.card.name, 'ja');
    });
  }, [deck.cards]);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className="deck-card-workarea"
      data-testid="deck-dropzone"
      data-drop-state={dragOver ? 'active' : dropState}
      onDragEnter={(event) => { event.preventDefault(); setDragOver(true); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const num = event.dataTransfer.getData('application/x-conan-card') || event.dataTransfer.getData('text/plain');
        if (num) onDropAdd(num);
      }}
      style={{
      flex: 1, padding: '10px 12px', ...panelBg,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>
          DECK
        </span>
        <span className="deck-grid-instruction" style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.1em' }}>
          右から追加 · 右へ戻して1枚除外
        </span>
      </div>
      <div className="deck-card-grid" data-testid="deck-card-grid" style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
        gap: 8, alignContent: 'start', paddingRight: 4, minWidth: 0,
      }}>
        {rows.map((e) => (
          <DeckTile key={e.num} entry={e} idTotal={idCounts.get(e.card.id) ?? e.count}
            selected={e.num === selectedNum}
            onSelect={(trigger) => onSelect(e.num, trigger)} onExpand={() => onExpand(e.num)}
            onDragEnd={onDeckDragEnd} />
        ))}
        {rows.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: T.textMuted, fontFamily: T.fontMono, fontSize: 11, padding: 24 }}>
            プールからカードを追加してください
          </div>
        )}
      </div>
    </div>
  );
}

function DeckTile({ entry, idTotal, selected, onSelect, onExpand, onDragEnd }: {
  entry: { num: string; count: number; card: CardDef };
  idTotal: number; selected: boolean; onSelect: (trigger: HTMLElement) => void; onExpand: () => void;
  onDragEnd: () => void;
}) {
  const limit = entry.card.deckLimit ?? DEFAULT_MAX_PER_ID;
  const limitLabel = limit === 'unlimited' ? '∞' : String(limit);
  const over = limit !== 'unlimited' && idTotal > limit;
  return (
    <div
      className="deck-card-tile"
      data-testid={`deck-entry-${entry.num}`}
      draggable
      title="カード一覧へドラッグして1枚除外"
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-conan-deck-card', entry.num);
      }}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        className="deck-card-open"
        aria-label={`${entry.card.name} ${idTotal}/${limitLabel}。詳細を開く。詳細画面からデッキに追加できます`}
        aria-pressed={selected}
        onClick={(event) => onSelect(event.currentTarget)}
        onContextMenu={(event) => { event.preventDefault(); event.currentTarget.focus(); onExpand(); }}
      >
        <MetaCard card={entry.card} w={72} selected={selected}
          count={entry.count} maxCount={limit} hoverable={false} />
      </button>
      <span className="deck-visually-hidden" data-testid={`deck-count-${entry.num}`} data-count={entry.count}>
        {entry.card.name} {entry.count}枚
      </span>
      {over && (
        <span style={{
          position: 'absolute', left: '50%', bottom: 4, transform: 'translateX(-50%)',
          padding: '1px 5px', background: T.red, color: '#fff', borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 8, fontWeight: 800, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 6,
        }}>ID {idTotal} ⚠</span>
      )}
    </div>
  );
}

// ---- RIGHT: card pool ----

function PoolPane({ cards, selectedNum, idCounts, draggingNum, onOpenDetail, onDragStart, onDragEnd, q, onQ, sortKey, sortDir, onSort, filterCount, onOpenFilter, onExpand }: {
  cards: CardDef[]; selectedNum: string; idCounts: Map<string, number>;
  draggingNum: string | null;
  onOpenDetail: (n: string, trigger?: HTMLElement | null) => void;
  onDragStart: (n: string) => void; onDragEnd: () => void; onExpand: (n: string) => void;
  q: string; onQ: (q: string) => void;
  sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey, d?: SortDir) => void;
  filterCount: number; onOpenFilter: () => void;
}) {
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [focusedNum, setFocusedNum] = useState<string | null>(null);
  const windowed = useWindowedCollection({
    items: cards,
    getKey: poolCardNumber,
    scrollElement,
    layoutKey: cards.map((card) => card.num).join(','),
    selectedKey: selectedNum,
    focusedKey: focusedNum,
  });
  const { visibleItems, registerItem, start } = windowed;
  const poolItemRefs = useMemo(
    () => visibleItems.map((_, index) => registerItem(start + index)),
    [registerItem, start, visibleItems],
  );
  return (
    <div className="deck-pool-surface" style={{
      flex: 1, minHeight: 0, padding: '10px 12px', ...panelBg,
      display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', minHeight: 12 }}>
        <span className="deck-pool-instruction" style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.1em' }}>
          ドラッグで追加 · クリックで詳細
        </span>
      </div>

      <div className="deck-pool-controls-stack">
        <div className="deck-pool-search-row">
          <div style={{ flex: 1, minWidth: 0 }}><SearchBox q={q} onChange={onQ} /></div>
          <button className="deck-pool-filter" onClick={onOpenFilter} aria-label="フィルタを開く" style={{
            padding: '7px 12px', whiteSpace: 'nowrap', cursor: 'pointer',
            background: filterCount > 0 ? `${T.gold}22` : 'rgba(0,0,0,0.4)',
            border: `1px solid ${filterCount > 0 ? T.gold : T.neonBlue + '55'}`,
            color: filterCount > 0 ? T.gold : T.neonBlue, fontFamily: T.fontJp, fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M1 2 h12 l-4.5 5.5 V12 l-3 1.5 V7.5 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            フィルタ{filterCount > 0 ? ` ${filterCount}` : ''}
          </button>
        </div>

        <div className="deck-pool-sort-row" style={{ display: 'flex', alignItems: 'center' }}>
          <span className="deck-pool-sort-label" style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.12em' }}>並べ替え</span>
          <PoolSortControl sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        </div>
      </div>

      <div className="deck-pool-grid" style={{
        flex: 1, overflow: 'auto', paddingRight: 4,
      }} ref={setScrollElement}>
        <PoolWindowSpacer height={windowed.beforePx} />
        <div className="deck-pool-window-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
          gap: 8, alignContent: 'start',
        }}>
          {windowed.visibleItems.map((card, index) => {
          const cnt = idCounts.get(card.id) ?? 0;
          const limit = card.deckLimit ?? DEFAULT_MAX_PER_ID;
          const limitLabel = limit === 'unlimited' ? '∞' : String(limit);
          const atMax = limit !== 'unlimited' && cnt >= limit;
          return (
            <div className="deck-pool-window-item" key={card.num} ref={poolItemRefs[index]}>
            <button
              type="button"
              className="deck-pool-card"
              data-testid={`deck-pool-card-${card.num}`}
              data-dragging={draggingNum === card.num ? 'true' : undefined}
              data-at-max={atMax ? 'true' : undefined}
              draggable
              aria-label={`${card.name} ${cnt}/${limitLabel}。詳細を開く。詳細画面からデッキに追加できます`}
              aria-pressed={card.num === selectedNum}
              onFocus={() => setFocusedNum(card.num)}
              onClick={(event) => onOpenDetail(card.num, event.currentTarget)}
              onContextMenu={(event) => { event.preventDefault(); event.currentTarget.focus(); onExpand(card.num); }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('application/x-conan-card', card.num);
                event.dataTransfer.setData('text/plain', card.num);
                onDragStart(card.num);
              }}
              onDragEnd={onDragEnd}
            >
              <MetaCard card={card} w={70}
                selected={card.num === selectedNum}
                count={cnt || undefined} maxCount={limit} showMax atMax={atMax}
                hoverable={false} />
            </button>
            </div>
          );
          })}
        </div>
        <PoolWindowSpacer height={windowed.afterPx} />
        {cards.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: T.textMuted, fontFamily: T.fontMono, fontSize: 11, padding: 24 }}>
            条件に一致するカードがありません
          </div>
        )}
      </div>
    </div>
  );
}

function PoolWindowSpacer({ height }: { height: number }) {
  return <div className="deck-pool-window-spacer" aria-hidden="true" inert style={{ height }} />;
}

function PoolSortControl({ sortKey, sortDir, onSort }: {
  sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey, d?: SortDir) => void;
}) {
  return (
    <div className="deck-pool-sort-controls" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
      {SORTS.map((s) => {
        const active = sortKey === s.k;
        return (
          <button className="deck-pool-sort-button" key={s.k} onClick={() => onSort(s.k, active ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc')} style={{
            padding: '3px 7px', cursor: 'pointer',
            background: active ? `${T.gold}22` : 'rgba(0,0,0,0.35)',
            border: `1px solid ${active ? T.gold : T.neonBlue + '44'}`,
            color: active ? T.gold : T.neonBlue,
            fontFamily: T.fontJp, fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            {s.label}{active && <span style={{ fontFamily: T.fontMono, fontSize: 8 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---- Filter slide-over (右からスライドイン、既存 FilterRail を表示) ----

const DIALOG_FOCUSABLE = [
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function useModalFocus(active: boolean, onClose: () => void, explicitReturnFocus?: HTMLElement | null) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    returnFocusRef.current = explicitReturnFocus
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      const target = returnFocusRef.current;
      returnFocusRef.current = null;
      if (target?.isConnected) target.focus();
    };
  }, [active, explicitReturnFocus]);

  const onDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE) ?? [])]
      .filter((element) => element.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  };

  return { dialogRef, closeRef, onDialogKeyDown };
}

function FilterSlideOver({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const { dialogRef, closeRef, onDialogKeyDown } = useModalFocus(open, onClose);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(2,6,12,0.5)',
    }}>
      <div
        ref={dialogRef}
        className="deck-filter-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="フィルタ"
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        onClick={(e) => e.stopPropagation()}
        style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, maxWidth: '90vw',
        background: 'linear-gradient(180deg, rgba(10,26,40,0.99), rgba(8,20,32,0.99))',
        borderLeft: `1px solid ${T.gold}55`, boxShadow: '-12px 0 40px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', padding: '14px', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: T.fontSerif, fontSize: 15, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.06em' }}>フィルタ</span>
          <button ref={closeRef} className="deck-overlay-close" onClick={onClose} aria-label="フィルタを閉じる" style={{
            marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer',
            color: T.textMuted, fontFamily: T.fontMono, fontSize: 18,
          }}>×</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>{children}</div>
      </div>
    </div>
  );
}

// ---- Modals ----

function ModalShell({ title, onClose, width, returnFocus, children }: {
  title: string; onClose: () => void; width?: number; returnFocus?: HTMLElement | null; children: React.ReactNode;
}) {
  const { dialogRef, closeRef, onDialogKeyDown } = useModalFocus(true, onClose, returnFocus);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(2,6,12,0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div
        ref={dialogRef}
        className="deck-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        onClick={(e) => e.stopPropagation()}
        style={{
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
          <button ref={closeRef} className="deck-overlay-close" onClick={onClose} aria-label="閉じる" style={{
            marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer',
            color: T.textMuted, fontFamily: T.fontMono, fontSize: 18,
          }}>×</button>
        </div>
        <div className="deck-modal-scroll" style={{ padding: 16, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

function SlotPickerModal({ title, cards, selected, onPick, onClose, onExpand, returnFocus }: {
  title: string; cards: readonly CardDef[]; selected: string; onPick: (n: string) => void; onClose: () => void;
  onExpand: (n: string) => void; returnFocus?: HTMLElement | null;
}) {
  const [query, setQuery] = useState('');
  const [selectedColors, setSelectedColors] = useState<CardColor[]>([]);
  const kindLabel = title.replace('を選択', '');
  const nameMatches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ja');
    if (!normalized) return cards;
    return cards.filter((card) => `${card.name} ${card.num}`.toLocaleLowerCase('ja').includes(normalized));
  }, [cards, query]);
  const filteredCards = useMemo(() => nameMatches.filter((card) => {
    if (selectedColors.length === 0) return true;
    const colors = card.colors ?? [card.color];
    return selectedColors.some((color) => colors.includes(color));
  }), [nameMatches, selectedColors]);
  const colorCounts = useMemo(() => {
    const counts = new Map<CardColor, number>();
    for (const card of nameMatches) {
      for (const color of card.colors ?? [card.color]) {
        counts.set(color, (counts.get(color) ?? 0) + 1);
      }
    }
    return counts;
  }, [nameMatches]);

  return (
    <ModalShell title={title} onClose={onClose} returnFocus={returnFocus}>
      <div className="deck-slot-picker-filters">
        <SearchBox
          q={query}
          onChange={setQuery}
          ariaLabel={`${kindLabel}候補を名前で検索`}
          placeholder={`${kindLabel}名・カード番号で検索`}
        />
        <FilterGroup
          label="色"
          showCounts={false}
          items={COLOR_META.map((meta) => ({
            c: meta.hex,
            label: meta.label,
            active: selectedColors.includes(meta.c),
            disabled: !selectedColors.includes(meta.c) && (colorCounts.get(meta.c) ?? 0) === 0,
            onClick: () => setSelectedColors(toggleIn(selectedColors, meta.c)),
          }))}
        />
      </div>
      <div className="deck-slot-picker-grid">
        {filteredCards.map((card) => (
          <div
            key={card.num}
            data-slot-picker-card={card.num}
            data-card-colors={(card.colors ?? [card.color]).join(',')}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
          >
            <MetaCard card={card} w={108} selected={card.num === selected}
              onClick={() => onPick(card.num)} onContextMenu={() => onExpand(card.num)} hoverable />
            <div style={{ fontSize: 11, color: T.textSecondary, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 108 }}>{card.name}</div>
          </div>
        ))}
        {filteredCards.length === 0 && (
          <div className="deck-slot-picker-empty" role="status">条件に一致するカードがありません</div>
        )}
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
  const [copyError, setCopyError] = useState<string | null>(null);

  const doCopy = async () => {
    setCopyError(null);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API is unavailable');
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError('コピーできませんでした。コードを選択して手動でコピーしてください。');
    }
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
        {copyError && <div role="status" aria-live="polite" style={{ color: T.red, fontFamily: T.fontMono, fontSize: 11, marginTop: 6 }}>{copyError}</div>}
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
  minHeight: 44, padding: '8px 16px', background: `${T.gold}22`, color: T.gold,
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

function visibleDeckStatsFor(card: CardDef) {
  if (card.type === 'character') {
    return [
      { label: 'C', value: card.cost ?? '—', accent: T.neonBlue },
      { label: 'AP', value: card.ap != null ? card.ap.toLocaleString() : '—', accent: T.apColor },
      { label: 'LP', value: card.lp ?? '—', accent: T.lpColor },
    ];
  }
  if (card.type === 'event') {
    return [{ label: 'C', value: card.cost ?? '—', accent: T.neonBlue }];
  }
  if (card.type === 'partner') {
    return [{ label: 'LP', value: card.lp ?? '—', accent: T.lpColor }];
  }
  return [
    { label: '先攻', value: card.difficultyFirst != null ? `${card.difficultyFirst}枚` : '—', accent: T.neonBlue },
    { label: '後攻', value: card.difficultySecond != null ? `${card.difficultySecond}枚` : '—', accent: T.apColor },
  ];
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
