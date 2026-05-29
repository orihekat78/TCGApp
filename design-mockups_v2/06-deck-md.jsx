// 06-deck-md.jsx
// Deck editor — Master Duel-style layout
// 1920×1080. Composition:
//   - TopBar (DECK selected)
//   - Sub-toolbar: deck name / save / undo
//   - LEFT (840px): card pool — 5×N grid of large card sprites + search
//   - RIGHT (1004px): the deck shown as a panoramic spread of all 40 card
//     sprites, grouped by cost. Hover/select shows detail tooltip card.

function DeckEditorMD() {
  const deck = window.SAMPLE_DECK;
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      fontFamily: T.fontJp, color: T.textPrimary,
    }}>
      <MetaBg theme="noir" scene="deck">
        <AppTopBar page="DECK" />
        <MDSubToolbar deck={deck} />

        {/* Layout */}
        <div style={{
          position: 'absolute',
          left: 24, right: 24, top: 130, bottom: 24,
          display: 'flex', gap: 14,
          zIndex: 5,
        }}>
          {/* LEFT: card pool */}
          <div style={{ width: 880, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MDPoolFilters />
            <MDCardPool />
          </div>

          {/* RIGHT: deck spread + hovered detail */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MDDeckHeader deck={deck} />
            <MDDeckSpread deck={deck} />
          </div>
        </div>

        {/* Floating hover preview - always visible to show interaction */}
        <MDHoverPreview />
      </MetaBg>
    </div>
  );
}

// ── Sub toolbar ────────────────────────────────────────────────────────
function MDSubToolbar({ deck }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 64, height: 60,
      display: 'flex', alignItems: 'center',
      padding: '0 32px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
      borderBottom: `1px solid rgba(78,195,255,0.15)`,
      zIndex: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 11,
          color: T.textMuted, letterSpacing: '0.18em',
        }}>EDITING</div>
        <div style={{
          fontFamily: T.fontSerif, fontSize: 18, fontWeight: 800,
          color: T.gold, letterSpacing: '0.08em',
        }}>少年探偵団・標準</div>
        <div style={{
          padding: '2px 8px', marginLeft: 6,
          background: 'rgba(255,215,0,0.12)',
          border: `1px solid ${T.gold}66`,
          borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 10, color: T.gold,
          letterSpacing: '0.15em',
        }}>修正あり</div>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        <SmallButton label="戻る" sub="UNDO" />
        <SmallButton label="やり直し" sub="REDO" />
        <div style={{ width: 1, height: 22, background: 'rgba(78,195,255,0.2)', margin: '0 6px' }} />
        <SmallButton label="シェアコード" sub="EXPORT" />
        <SmallButton label="テスト対戦" sub="PLAY" />
        <SmallButton label="保存" sub="SAVE" accent={T.gold} solid />
      </div>
    </div>
  );
}

// ── LEFT: pool filters + card grid ─────────────────────────────────────
function MDPoolFilters() {
  return (
    <div style={{
      padding: '10px 14px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px',
        width: 240,
        background: 'rgba(0,0,0,0.45)',
        border: `1px solid ${T.gold}44`,
        borderRadius: 3,
      }}>
        <svg width="13" height="13" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4" stroke={T.gold} strokeWidth="1.4" fill="none"/><line x1="9" y1="9" x2="13" y2="13" stroke={T.gold} strokeWidth="1.6" strokeLinecap="round"/></svg>
        <input defaultValue="" placeholder="カード名で検索" style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: T.textPrimary, fontFamily: T.fontJp, fontSize: 12,
        }} />
      </div>

      {/* Color filter — color swatches */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { c: T.blue, label: '青', active: true },
          { c: T.yellow, label: '黄', active: false },
          { c: T.red, label: '赤', active: false },
          { c: T.green, label: '緑', active: false },
          { c: T.purple, label: '紫', active: false },
        ].map((s, i) => (
          <div key={i} style={{
            width: 30, height: 30,
            background: s.active ? s.c : `${s.c}33`,
            border: `1.5px solid ${s.active ? '#fff' : s.c}`,
            borderRadius: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            fontFamily: T.fontJp, fontSize: 13, fontWeight: 800,
            color: '#fff',
            boxShadow: s.active ? `0 0 8px ${s.c}` : 'none',
          }}>
            {s.label}
          </div>
        ))}
      </div>

      {/* Cost filter */}
      <div style={{ display: 'flex', gap: 3 }}>
        {[1,2,3,4,5,6,7,8].map((n) => (
          <div key={n} style={{
            width: 26, height: 26,
            background: 'rgba(0,0,0,0.4)',
            border: `1px solid rgba(78,195,255,0.3)`,
            borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.fontMono, fontSize: 12, fontWeight: 700,
            color: T.textSecondary, cursor: 'pointer',
          }}>{n}</div>
        ))}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.18em' }}>
          ALL · 14 / 47
        </div>
        <div style={{ width: 1, height: 18, background: 'rgba(78,195,255,0.2)' }} />
        <div style={{ display: 'flex', gap: 3 }}>
          {[
            { label: 'コスト', active: true },
            { label: 'AP', active: false },
            { label: 'カラー', active: false },
            { label: '入手日', active: false },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '4px 10px',
              fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.12em',
              color: s.active ? T.gold : T.textMuted,
              background: s.active ? `${T.gold}22` : 'transparent',
              border: `1px solid ${s.active ? T.gold : 'transparent'}`,
              borderRadius: 2, cursor: 'pointer',
            }}>{s.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MDCardPool() {
  // 5 cols, sized to fit
  const blueCards = window.CARD_POOL.filter((c) => c.color === 'blue' && c.type === 'character');
  const deckMap = {};
  window.SAMPLE_DECK.cards.forEach((e) => { deckMap[e.num] = e.count; });

  // Pick a "hovered" card to demonstrate visual treatment
  const hoveredNum = 'D08005';
  return (
    <div style={{
      flex: 1,
      padding: '16px 18px 18px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
          color: T.gold, letterSpacing: '0.28em',
        }}>POOL · カードプール</div>
        <div style={{ fontSize: 11, color: T.textMuted }}>左クリックでデッキに追加 · 右クリックで詳細</div>
        <div style={{
          marginLeft: 'auto',
          fontFamily: T.fontMono, fontSize: 10,
          color: T.textMuted, letterSpacing: '0.18em',
        }}>
          PAGE 1 / 3
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 14,
        alignContent: 'start',
      }}>
        {blueCards.slice(0, 15).map((c) => (
          <div key={c.num} style={{
            display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: 4,
            transform: c.num === hoveredNum ? 'translateY(-4px) scale(1.04)' : 'none',
            transition: 'transform 150ms',
            position: 'relative',
            zIndex: c.num === hoveredNum ? 2 : 1,
          }}>
            <div style={{
              filter: c.num === hoveredNum ? `drop-shadow(0 0 16px ${T.gold}88)` : 'none',
            }}>
              <MetaCard
                card={c}
                w={144}
                count={deckMap[c.num]}
                selected={c.num === hoveredNum}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RIGHT: deck header + spread ────────────────────────────────────────
function MDDeckHeader({ deck }) {
  const partner = window.CARD_POOL.find((c) => c.num === deck.partner);
  const stats = window.deckStats(deck);
  const avgCost = (() => {
    let total = 0, n = 0;
    for (const e of deck.cards) {
      const card = window.CARD_POOL.find((c) => c.num === e.num);
      if (card?.cost != null) { total += card.cost * e.count; n += e.count; }
    }
    return n ? (total / n).toFixed(1) : '0.0';
  })();
  return (
    <div style={{
      padding: '10px 14px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.7))',
      border: `1px solid ${T.gold}55`,
      borderRadius: 4,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ filter: `drop-shadow(0 0 8px ${T.gold}55)` }}>
        <MetaCard card={partner} w={70} badge="partner" hoverable={false} />
      </div>
      <div style={{ flex: 1, lineHeight: 1.2 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, letterSpacing: '0.25em' }}>
          MY DECK
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.05em', marginTop: 1 }}>
          {deck.name}
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
          パートナー: {partner.name}
        </div>
      </div>
      {/* Quick stats grid */}
      <div style={{ display: 'flex', gap: 8 }}>
        <QuickStat label="枚数" value="40" sub="/40" accent={T.gold} />
        <QuickStat label="種類" value="14" accent={T.neonBlue} />
        <QuickStat label="平均" value={avgCost} sub="cost" accent={T.green} />
        <QuickStat label="色" value="青" accent={T.blue} />
      </div>
    </div>
  );
}

function QuickStat({ label, value, sub, accent }) {
  return (
    <div style={{
      padding: '6px 12px',
      background: `${accent}11`,
      border: `1px solid ${accent}44`,
      borderRadius: 3,
      textAlign: 'center',
      minWidth: 60,
    }}>
      <div style={{
        fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em', marginBottom: 1,
      }}>{label}</div>
      <div>
        <span style={{ fontFamily: T.fontMono, fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</span>
        {sub && <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, marginLeft: 2 }}>{sub}</span>}
      </div>
    </div>
  );
}

function MDDeckSpread({ deck }) {
  // For each entry, render `count` card sprites laid out, grouped by cost.
  // This is the visual hallmark of the Master Duel deck builder.
  const entries = deck.cards
    .map((e) => ({ ...e, card: window.CARD_POOL.find((c) => c.num === e.num) }))
    .filter((e) => e.card);

  // Group by cost
  const buckets = {};
  for (const e of entries) {
    const cost = e.card.cost ?? '—';
    if (!buckets[cost]) buckets[cost] = [];
    for (let i = 0; i < e.count; i++) buckets[cost].push(e.card);
  }

  const costsSorted = Object.keys(buckets).sort((a, b) => Number(a) - Number(b));

  return (
    <div style={{
      flex: 1,
      padding: '14px 16px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
          color: T.gold, letterSpacing: '0.28em',
        }}>DECK · 構成</div>
        <div style={{ fontSize: 11, color: T.textMuted }}>クリックで除去 · ドラッグで並べ替え</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <SmallButton label="ソート" sub="COST" active />
          <SmallButton label="シャッフル試行" sub="SIM" />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        {costsSorted.map((cost) => (
          <CostRow key={cost} cost={cost} cards={buckets[cost]} />
        ))}
      </div>
    </div>
  );
}

function CostRow({ cost, cards }) {
  // Show each card as a small sprite. Each row has a cost gutter on the left.
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 10,
    }}>
      {/* Cost gutter */}
      <div style={{
        width: 40, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '6px 0',
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid rgba(255,215,0,0.25)`,
        borderRadius: 3,
      }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.12em' }}>COST</div>
        <div style={{ fontFamily: T.fontMono, fontSize: 22, fontWeight: 800, color: T.gold, lineHeight: 1 }}>
          {cost}
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textSecondary, marginTop: 2 }}>×{cards.length}</div>
      </div>

      {/* Card sprites */}
      <div style={{
        flex: 1,
        display: 'flex', gap: 4, flexWrap: 'wrap', alignContent: 'center',
        padding: '6px 8px',
        background: 'rgba(0,0,0,0.25)',
        border: `1px dashed rgba(78,195,255,0.15)`,
        borderRadius: 3,
      }}>
        {cards.map((card, i) => (
          <MetaCard key={i} card={card} w={62} hoverable={true} />
        ))}
      </div>
    </div>
  );
}

// ── Floating hover preview ─────────────────────────────────────────────
function MDHoverPreview() {
  const card = window.CARD_POOL.find((c) => c.num === 'D08005');
  return (
    <div style={{
      position: 'absolute',
      left: 740, top: 270,
      width: 280, padding: 0,
      pointerEvents: 'none',
      zIndex: 50,
      animation: 'none',
    }}>
      {/* Pointer arrow */}
      <svg style={{ position: 'absolute', left: -14, top: 100, pointerEvents: 'none' }} width="14" height="20" viewBox="0 0 14 20">
        <path d="M14 0 L0 10 L14 20 Z" fill={`${T.gold}cc`} />
      </svg>
      <div style={{
        background: 'linear-gradient(180deg, rgba(13,30,52,0.98), rgba(8,18,32,0.98))',
        border: `1.5px solid ${T.gold}aa`,
        borderRadius: 4,
        padding: 12,
        boxShadow: `0 12px 32px rgba(0,0,0,0.7), 0 0 24px ${T.gold}33`,
        display: 'flex', gap: 12,
      }}>
        <MetaCard card={card} w={100} hoverable={false} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, letterSpacing: '0.2em' }}>
            {card.num}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.textPrimary, marginTop: 2, marginBottom: 2 }}>
            {card.name}
          </div>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.12em', marginBottom: 6 }}>
            {card.features.join(' · ')}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <MiniStat label="C" value={card.cost} color={T.neonBlue} />
            <MiniStat label="AP" value={card.ap ? (card.ap / 1000) + 'K' : '—'} color={T.red} />
            <MiniStat label="LP" value={card.lp} color={T.green} />
          </div>
          <div style={{
            fontSize: 11, lineHeight: 1.45, color: T.textSecondary,
            padding: '6px 7px',
            background: 'rgba(0,0,0,0.45)',
            border: `1px solid ${T.gold}33`,
            borderRadius: 2,
          }}>
            {card.effectShort}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{
      flex: 1,
      padding: '3px 0',
      textAlign: 'center',
      background: `${color}15`,
      border: `1px solid ${color}55`,
      borderRadius: 2,
      lineHeight: 1.1,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, letterSpacing: '0.15em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 13, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

window.DeckEditorMD = DeckEditorMD;
