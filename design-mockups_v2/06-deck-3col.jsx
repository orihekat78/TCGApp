// 06-deck-3col.jsx
// Deck editor — 3-column competitive-density layout
// 1920×1080. Composition:
//   - TopBar (DECK selected)
//   - Sub-toolbar: deck name + save / duplicate / export
//   - Left col (560px):  filter rail + card list grid (large, searchable)
//   - Center col (520px): selected card detail preview
//   - Right col (660px): current deck with cost curve + color balance + list

function DeckEditor3Col() {
  const deck = window.SAMPLE_DECK;
  const cards = window.CARD_POOL;
  const selected = cards.find((c) => c.num === 'D08005'); // 灰原哀 7-cost
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      fontFamily: T.fontJp, color: T.textPrimary,
    }}>
      <MetaBg theme="noir" scene="deck">
        <AppTopBar page="DECK" />
        <DeckSubToolbar deck={deck} />

        {/* 3 columns */}
        <div style={{
          position: 'absolute',
          left: 24, right: 24, top: 130, bottom: 24,
          display: 'flex', gap: 16,
          zIndex: 5,
        }}>
          {/* LEFT */}
          <div style={{ width: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FilterRail />
            <CardListGrid cards={cards} selectedNum={selected.num} />
          </div>

          {/* CENTER */}
          <div style={{ width: 520, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CardDetailPanel card={selected} />
            <ActionStrip />
          </div>

          {/* RIGHT */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DeckHeader deck={deck} />
            <DeckValidationBanner />
            <DeckStats deck={deck} />
            <DeckList deck={deck} highlightNum={selected.num} />
          </div>
        </div>
      </MetaBg>
    </div>
  );
}

// ── Sub toolbar ────────────────────────────────────────────────────────
function DeckSubToolbar({ deck }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 64, height: 60,
      display: 'flex', alignItems: 'center',
      padding: '0 32px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
      borderBottom: `1px solid rgba(78,195,255,0.15)`,
      zIndex: 8,
    }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.2em' }}>
        <span style={{ color: T.textMuted }}>DECK</span>
        <span style={{ color: T.textDisabled }}>/</span>
        <span style={{ color: T.gold }}>少年探偵団・標準</span>
        <span style={{ color: T.textDisabled }}>/</span>
        <span style={{ color: T.textMuted }}>EDIT</span>
      </div>

      <div style={{ marginLeft: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Pill color={T.blue} label="青 100%" />
        <Pill color={T.gold} label="40 / 40" />
        <Pill color={T.green} label="競技 LEGAL" />
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <SmallButton label="複製" sub="DUPE" />
        <SmallButton label="シェアコード" sub="EXPORT" />
        <SmallButton label="テスト対戦" sub="PLAYTEST" navTo="match" />
        <SmallButton label="保存して戻る" sub="SAVE" accent={T.gold} solid navTo="home" />
      </div>
    </div>
  );
}

function Pill({ color, label }) {
  return (
    <div style={{
      padding: '4px 10px',
      background: `${color}22`,
      border: `1px solid ${color}66`,
      borderRadius: 12,
      fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
      color, letterSpacing: '0.12em',
    }}>
      {label}
    </div>
  );
}

function SmallButton({ label, sub, accent = T.neonBlue, solid = false, active = false, onClick }) {
  const base = solid
    ? { background: `linear-gradient(180deg, ${accent}, ${shade(accent, -0.35)})`, color: shade(accent, -0.7), border: `1px solid ${shade(accent, -0.4)}` }
    : { background: active ? `${accent}22` : 'rgba(0,0,0,0.35)', color: accent, border: `1px solid ${accent}55` };
  return (
    <div onClick={onClick} style={{
      ...base,
      padding: '6px 14px',
      borderRadius: 3,
      fontFamily: T.fontJp, fontWeight: 700, fontSize: 12,
      letterSpacing: '0.08em',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 8,
      lineHeight: 1,
    }}>
      <span>{label}</span>
      {sub && (
        <span style={{
          fontFamily: T.fontMono, fontSize: 9, opacity: 0.55,
          letterSpacing: '0.16em', fontWeight: 800,
        }}>{sub}</span>
      )}
    </div>
  );
}

// ── LEFT: filter rail + card grid ──────────────────────────────────────
function FilterRail() {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
    }}>
      {/* Search box */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.45)',
        border: `1px solid ${T.gold}44`,
        borderRadius: 3, marginBottom: 12,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4" stroke={T.gold} strokeWidth="1.4" fill="none"/><line x1="9" y1="9" x2="13" y2="13" stroke={T.gold} strokeWidth="1.6" strokeLinecap="round"/></svg>
        <input
          defaultValue="少年探偵団"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: T.textPrimary, fontFamily: T.fontJp, fontSize: 13,
          }}
        />
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>
          14 件
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ChipRow label="色" chips={[
          { label: '青', color: T.blue, active: true },
          { label: '黄', color: T.yellow, active: false },
          { label: '赤', color: T.red, active: false },
          { label: '緑', color: T.green, active: false },
          { label: '紫', color: T.purple, active: false },
        ]} />
        <ChipRow label="種別" chips={[
          { label: 'パートナー', color: T.gold, active: false },
          { label: 'キャラ', color: T.neonBlue, active: true },
          { label: 'イベント', color: T.purple, active: false },
        ]} />
        <ChipRow label="コスト" chips={[1,2,3,4,5,6,7,8].map((n) => ({
          label: String(n), color: T.neonBlue, active: [2,3,4,5,6].includes(n), small: true,
        }))} />
        <ChipRow label="キーワード" chips={[
          { label: 'ヒラメキ', color: T.gold, active: false },
          { label: 'カットイン', color: T.neonBlue, active: false },
          { label: '突撃', color: T.red, active: false },
          { label: '宣言', color: T.purple, active: false },
          { label: '変装', color: T.green, active: false },
          { label: '疾風', color: T.gold, active: false },
        ]} />
      </div>
    </div>
  );
}

function ChipRow({ label, chips }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 60, flexShrink: 0,
        fontFamily: T.fontMono, fontSize: 10,
        color: T.textMuted, letterSpacing: '0.18em',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
        {chips.map((c, i) => (
          <div key={i} style={{
            padding: c.small ? '2px 8px' : '3px 9px',
            minWidth: c.small ? 22 : 'auto',
            textAlign: 'center',
            background: c.active ? `${c.color}33` : 'rgba(0,0,0,0.3)',
            border: `1px solid ${c.active ? c.color : `${c.color}33`}`,
            borderRadius: 2,
            fontFamily: T.fontJp, fontSize: 11,
            fontWeight: c.active ? 700 : 500,
            color: c.active ? c.color : T.textMuted,
            cursor: 'pointer',
          }}>
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function CardListGrid({ cards, selectedNum }) {
  // 4 cols of mini cards (~120px wide)
  const filtered = cards.filter((c) => c.color === 'blue' && c.type === 'character');
  // Get deck quantities
  const deckMap = {};
  window.SAMPLE_DECK.cards.forEach((e) => { deckMap[e.num] = e.count; });
  return (
    <div style={{
      flex: 1,
      padding: '14px 16px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
          color: T.gold, letterSpacing: '0.28em',
        }}>CARDS</div>
        <div style={{ fontSize: 11, color: T.textMuted }}>カードプール</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <SmallButton label="名前順" sub="A→Z" />
          <SmallButton label="コスト順" sub="COST" active />
          <SmallButton label="AP順" sub="AP" />
        </div>
      </div>
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        alignContent: 'start',
        paddingTop: 8,
      }}>
        {filtered.slice(0, 16).map((c) => (
          <div key={c.num} style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <MetaCard
              card={c}
              w={110}
              count={deckMap[c.num]}
              selected={c.num === selectedNum}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CENTER: card detail preview ────────────────────────────────────────
function CardDetailPanel({ card }) {
  const c = COLOR_TOKEN[card.color] || T.blue;
  return (
    <div style={{
      padding: '20px 22px 22px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.7))',
      border: `1px solid ${c}55`,
      borderRadius: 4,
      boxShadow: `inset 0 0 40px ${c}11`,
      display: 'flex', gap: 20,
    }}>
      {/* Big card render */}
      <div style={{
        flexShrink: 0,
        filter: `drop-shadow(0 0 24px ${c}66) drop-shadow(0 8px 16px rgba(0,0,0,0.7))`,
      }}>
        <MetaCard card={card} w={220} hoverable={false} />
      </div>
      {/* Details */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>
            {card.num}
          </div>
          <div style={{
            padding: '1px 6px',
            background: c, color: '#fff',
            fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
            letterSpacing: '0.15em', borderRadius: 1,
          }}>
            {card.color.toUpperCase()}
          </div>
          <div style={{
            padding: '1px 6px',
            background: T.gold, color: '#1a1208',
            fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
            letterSpacing: '0.15em', borderRadius: 1,
          }}>
            {card.rarity}
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.04em', marginBottom: 2 }}>
          {card.name}
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.12em', marginBottom: 14 }}>
          {card.type === 'character' ? 'キャラクター' : card.type === 'partner' ? 'パートナー' : card.type === 'event' ? 'イベント' : ''}
          {card.features.length > 0 && (
            <span> · {card.features.join(' / ')}</span>
          )}
        </div>

        {/* Stat row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <StatBox label="COST" value={card.cost ?? '—'} accent={T.neonBlue} />
          <StatBox label="AP" value={card.ap ? card.ap.toLocaleString() : '—'} accent={T.red} />
          <StatBox label="LP" value={card.lp ?? '—'} accent={T.green} />
        </div>

        {/* Effect text */}
        <div style={{
          padding: '10px 12px',
          background: 'rgba(0,0,0,0.45)',
          border: `1px solid ${c}33`,
          borderRadius: 3,
          marginBottom: 10,
          flex: 1,
        }}>
          <div style={{
            fontFamily: T.fontMono, fontSize: 9, color: T.gold,
            letterSpacing: '0.2em', marginBottom: 4,
          }}>EFFECT · 効果</div>
          <div style={{ fontSize: 13, color: T.textPrimary, lineHeight: 1.6 }}>
            {card.effectShort}
          </div>
        </div>

        {/* Keywords */}
        {card.keywords.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {card.keywords.map((k, i) => (
              <div key={i} style={{
                padding: '3px 9px',
                background: 'rgba(255,215,0,0.15)',
                border: `1px solid ${T.gold}66`,
                borderRadius: 2,
                fontFamily: T.fontJp, fontSize: 11, fontWeight: 700,
                color: T.gold,
              }}>{k}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div style={{
      flex: 1,
      padding: '8px 12px',
      background: `${accent}11`,
      border: `1px solid ${accent}44`,
      borderRadius: 2,
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: T.fontMono, fontSize: 9,
        color: T.textMuted, letterSpacing: '0.2em', marginBottom: 1,
      }}>{label}</div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 22, fontWeight: 800,
        color: accent, letterSpacing: '0.04em', lineHeight: 1,
      }}>{value}</div>
    </div>
  );
}

function ActionStrip() {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.7))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ flex: 1, fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>
        <div style={{ color: T.gold, fontFamily: T.fontMono, fontSize: 9, letterSpacing: '0.2em', marginBottom: 2 }}>
          このデッキでの枚数
        </div>
        <span style={{ fontFamily: T.fontMono, fontSize: 18, fontWeight: 800, color: T.textPrimary }}>3</span>
        <span style={{ marginLeft: 6, color: T.textMuted }}>/ 3 (同名ID上限)</span>
      </div>
      <SmallButton label="ー 1枚減らす" sub="−" />
      <SmallButton label="＋ 1枚追加" sub="+" accent={T.gold} solid />
    </div>
  );
}

// ── RIGHT: deck overview ───────────────────────────────────────────────
function DeckHeader({ deck }) {
  const partner = window.CARD_POOL.find((c) => c.num === deck.partner);
  return (
    <div style={{
      padding: '14px 14px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.7))',
      border: `1px solid ${T.gold}55`,
      borderRadius: 4,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        filter: `drop-shadow(0 0 12px ${T.gold}66)`,
      }}>
        <MetaCard card={partner} w={90} badge="partner" hoverable={false} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 10,
          color: T.gold, letterSpacing: '0.28em', marginBottom: 2,
        }}>
          MY DECK · 編集中
        </div>
        <div style={{
          fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800,
          color: T.textPrimary, letterSpacing: '0.05em',
        }}>
          {deck.name}
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>
          パートナー: {partner.name} · LP {partner.lp}
        </div>
      </div>
      <div style={{
        padding: '12px 18px',
        background: 'rgba(0,0,0,0.45)',
        border: `1px solid ${T.gold}66`,
        borderRadius: 3,
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 9,
          color: T.textMuted, letterSpacing: '0.2em', marginBottom: 2,
        }}>枚数</div>
        <div>
          <span style={{ fontFamily: T.fontMono, fontSize: 28, fontWeight: 800, color: T.gold }}>40</span>
          <span style={{ fontFamily: T.fontMono, fontSize: 14, color: T.textMuted, marginLeft: 4 }}>/40</span>
        </div>
      </div>
    </div>
  );
}

function DeckStats({ deck }) {
  const stats = window.deckStats(deck);
  const costs = stats.costs;
  const maxCost = Math.max(...Object.values(costs), 1);
  // For chart: cost 1-8
  const costBars = [1,2,3,4,5,6,7,8].map((n) => ({
    cost: n, count: costs[n] ?? 0,
  }));
  const types = stats.types;
  const colors = stats.colors;

  return (
    <div style={{
      padding: '12px 14px 14px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', gap: 14,
    }}>
      {/* Cost curve */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{
            fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
            color: T.gold, letterSpacing: '0.25em',
          }}>COST CURVE</div>
          <div style={{ marginLeft: 'auto', fontSize: 10, color: T.textMuted, fontFamily: T.fontMono }}>
            平均 <span style={{ color: T.textPrimary, fontWeight: 700 }}>3.6</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 78 }}>
          {costBars.map((b) => (
            <div key={b.cost} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                fontFamily: T.fontMono, fontSize: 10, color: b.count > 0 ? T.textPrimary : T.textDisabled,
                fontWeight: 700, marginBottom: 2,
              }}>{b.count > 0 ? b.count : ''}</div>
              <div style={{
                width: '100%',
                height: `${(b.count / maxCost) * 56 + (b.count > 0 ? 6 : 1)}px`,
                background: b.count > 0
                  ? `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.4)})`
                  : 'rgba(78,195,255,0.1)',
                borderRadius: 1,
                boxShadow: b.count > 0 ? `0 0 8px ${T.gold}33` : 'none',
              }} />
              <div style={{
                fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
                marginTop: 3,
              }}>{b.cost}{b.cost === 8 ? '+' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Color/Type breakdown */}
      <div style={{ width: 170, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, fontWeight: 800, color: T.gold, letterSpacing: '0.25em', marginBottom: 6 }}>
            COLOR
          </div>
          <ColorBar segments={Object.entries(colors).map(([k, v]) => ({ color: COLOR_TOKEN[k], value: v, label: k }))} total={40} />
        </div>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, fontWeight: 800, color: T.gold, letterSpacing: '0.25em', marginBottom: 6 }}>
            TYPE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TypeRow label="キャラ" value={types.character || 0} max={40} color={T.neonBlue} />
            <TypeRow label="イベント" value={types.event || 0} max={40} color={T.purple} />
            <TypeRow label="カットイン" value={types.cutin || 0} max={40} color={T.gold} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorBar({ segments, total }) {
  return (
    <div>
      <div style={{ display: 'flex', height: 12, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(78,195,255,0.2)' }}>
        {segments.map((s, i) => (
          <div key={i} style={{
            flex: s.value,
            background: s.color,
            position: 'relative',
          }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 8, height: 8, background: s.color, borderRadius: 1 }} />
            <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textSecondary }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeRow({ label, value, max, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, fontSize: 10, color: T.textSecondary }}>{label}</div>
      <div style={{ flex: 1, height: 5, background: 'rgba(0,0,0,0.4)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${(value / max) * 100}%`,
          height: '100%',
          background: color,
        }} />
      </div>
      <div style={{ fontFamily: T.fontMono, fontSize: 10, fontWeight: 700, color: T.textPrimary, width: 22, textAlign: 'right' }}>
        {value}
      </div>
    </div>
  );
}

function DeckList({ deck, highlightNum }) {
  // List of cards in deck, sorted by cost
  const entries = deck.cards
    .map((e) => ({ ...e, card: window.CARD_POOL.find((c) => c.num === e.num) }))
    .filter((e) => e.card)
    .sort((a, b) => (a.card.cost ?? 0) - (b.card.cost ?? 0));
  return (
    <div style={{
      flex: 1,
      padding: '12px 14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
          color: T.gold, letterSpacing: '0.28em',
        }}>DECK LIST</div>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: T.textMuted, fontFamily: T.fontMono, letterSpacing: '0.1em' }}>
          {entries.length} 種類
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflow: 'hidden' }}>
        {entries.map((e) => (
          <DeckRow key={e.num} entry={e} highlight={e.num === highlightNum} />
        ))}
      </div>
    </div>
  );
}

function DeckRow({ entry, highlight }) {
  const c = COLOR_TOKEN[entry.card.color] || T.blue;
  return (
    <div className="meta-row" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '5px 8px',
      background: highlight ? `${T.gold}11` : 'transparent',
      border: highlight ? `1px solid ${T.gold}55` : '1px solid transparent',
      borderRadius: 2,
      cursor: 'pointer',
    }}>
      {/* Cost pill */}
      <div style={{
        width: 22, height: 22, flexShrink: 0,
        background: `linear-gradient(180deg, ${c}, ${shade(c, -0.4)})`,
        border: `1px solid ${shade(c, -0.5)}`,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontMono, fontWeight: 800, fontSize: 11, color: '#fff',
      }}>
        {entry.card.cost ?? '—'}
      </div>
      {/* Name + features */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: T.textPrimary, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.card.name}
          {entry.card.ap != null && (
            <span style={{ marginLeft: 6, fontSize: 10, color: T.gold, fontFamily: T.fontMono, fontWeight: 700 }}>
              AP {entry.card.ap.toLocaleString()}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontMono, letterSpacing: '0.05em' }}>
          {entry.card.num} · {entry.card.features.join(' / ') || entry.card.type}
        </div>
      </div>
      {/* Keywords mini */}
      <div style={{ display: 'flex', gap: 3 }}>
        {entry.card.keywords.slice(0, 2).map((k, i) => (
          <span key={i} style={{
            fontSize: 9, color: T.gold, fontFamily: T.fontJp,
            padding: '1px 4px',
            background: 'rgba(255,215,0,0.12)',
            borderRadius: 1,
          }}>{k}</span>
        ))}
      </div>
      {/* Count */}
      <div style={{
        width: 30, textAlign: 'center',
        padding: '2px 0',
        background: entry.count > 3 ? T.red : 'rgba(255,215,0,0.18)',
        border: `1px solid ${entry.count > 3 ? T.red : T.gold}66`,
        borderRadius: 2,
        fontFamily: T.fontMono, fontSize: 12, fontWeight: 800,
        color: entry.count > 3 ? '#fff' : T.gold,
      }}>
        ×{entry.count}
      </div>
    </div>
  );
}

window.DeckEditor3Col = DeckEditor3Col;

// ── Deck validation banner ─────────────────────────────────────────────
// Reads live validation from engineStub.cards.validateDeck() when available.
function DeckValidationBanner() {
  const stub = window.engineStub;
  if (!stub) {
    return (
      <WarningBanner
        tone="info"
        title="このデッキは公式ルールに適合しています"
        items={['枚数: 40 / 40枚ちょうど (公式 p.7)', '同ID上限: すべて 3 枚以下で OK (公式 p.7)']}
      />
    );
  }
  const result = stub.cards.validateDeck(window.SAMPLE_DECK);
  if (result.ok && result.warnings.length === 0) {
    return (
      <WarningBanner
        tone="info"
        title="このデッキは公式ルールに適合しています"
        items={[
          `枚数: ${result.total} / 40枚ちょうど ✓`,
          '同ID上限: すべて 3 枚以下で OK ✓',
          'パートナー枠 + 事件カード 1 枚を加えて 42 枚構成 ✓',
        ]}
      />
    );
  }
  if (result.ok) {
    // Warnings only
    return (
      <WarningBanner
        tone="warn"
        title="このデッキは合法ですが、いくつかの推奨に外れています"
        items={result.warnings}
      />
    );
  }
  // Errors
  return (
    <WarningBanner
      tone="error"
      title={`このデッキは公式ルールに違反しています(${result.errors.length} 件)`}
      items={[...result.errors, ...result.warnings]}
    />
  );
}