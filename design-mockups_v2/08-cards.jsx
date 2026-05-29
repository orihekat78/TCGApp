// 08-cards.jsx
// カードリスト(コレクション)画面 — 全所持カードの閲覧 + 検索 + 詳細
// 1920×1080

function CardsScreen() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: T.fontJp, color: T.textPrimary }}>
      <MetaBg theme="noir" scene="cards">
        <AppTopBar page="CARDS" />
        <CardsSubToolbar />

        {/* Layout */}
        <div style={{
          position: 'absolute', left: 24, right: 24, top: 130, bottom: 24,
          display: 'flex', gap: 16, zIndex: 5,
        }}>
          {/* LEFT: filters + collection summary */}
          <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CollectionStatsPanel />
            <FiltersPanel />
          </div>

          {/* CENTER: big card grid */}
          <div style={{ flex: 1 }}>
            <CardGridPanel />
          </div>

          {/* RIGHT: selected card detail */}
          <div style={{ width: 420 }}>
            <SelectedCardDetail />
          </div>
        </div>
      </MetaBg>
    </div>
  );
}

function CardsSubToolbar() {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 64, height: 60,
      display: 'flex', alignItems: 'center',
      padding: '0 32px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
      borderBottom: `1px solid rgba(78,195,255,0.15)`,
      zIndex: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>
          COLLECTION
        </div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.06em' }}>
          証拠ファイル
        </div>
        <div style={{
          padding: '3px 10px',
          background: 'rgba(255,215,0,0.15)',
          border: `1px solid ${T.gold}66`,
          borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
          color: T.gold, letterSpacing: '0.15em',
        }}>
          47 / 47 種類
        </div>
      </div>

      {/* Search */}
      <div style={{
        marginLeft: 36, flex: 1, maxWidth: 380,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.45)',
        border: `1px solid ${T.gold}44`,
        borderRadius: 3,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4" stroke={T.gold} strokeWidth="1.4" fill="none"/><line x1="9" y1="9" x2="13" y2="13" stroke={T.gold} strokeWidth="1.6" strokeLinecap="round"/></svg>
        <input
          defaultValue="灰原"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.textPrimary, fontFamily: T.fontJp, fontSize: 13 }}
        />
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>
          2 件
        </div>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>表示</div>
        <ViewSelector />
        <div style={{ width: 1, height: 22, background: 'rgba(78,195,255,0.2)', margin: '0 6px' }} />
        <SmallButton label="新着順" sub="↓" />
        <SmallButton label="コスト順" sub="C" active />
      </div>
    </div>
  );
}

function ViewSelector() {
  return (
    <div style={{ display: 'flex', gap: 0, border: `1px solid rgba(78,195,255,0.3)`, borderRadius: 2, overflow: 'hidden' }}>
      {[
        { icon: '▦', active: true, label: 'GRID' },
        { icon: '☰', active: false, label: 'LIST' },
        { icon: '◫', active: false, label: 'STACK' },
      ].map((v, i) => (
        <div key={i} style={{
          padding: '5px 10px',
          background: v.active ? T.gold : 'rgba(0,0,0,0.3)',
          color: v.active ? '#1a1208' : T.textSecondary,
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
          cursor: 'pointer',
          borderRight: i < 2 ? `1px solid rgba(78,195,255,0.2)` : 'none',
        }}>{v.icon}</div>
      ))}
    </div>
  );
}

// ── LEFT: collection stats ─────────────────────────────────────────────
function CollectionStatsPanel() {
  const colorStats = [
    { color: T.blue, label: '青', owned: 18, total: 18 },
    { color: T.yellow, label: '黄', owned: 12, total: 12 },
    { color: T.red, label: '赤', owned: 9, total: 9 },
    { color: T.green, label: '緑', owned: 5, total: 5 },
    { color: T.purple, label: '紫', owned: 3, total: 3 },
  ];
  const rarityStats = [
    { label: 'D', owned: 22, total: 22, color: T.textSecondary },
    { label: 'C', owned: 14, total: 14, color: T.green },
    { label: 'R', owned: 8, total: 8, color: T.neonBlue },
    { label: 'SR', owned: 3, total: 3, color: T.gold },
  ];
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid ${T.gold}55`,
      borderRadius: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.28em', fontWeight: 800 }}>
          COVERAGE
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>
          コレクション率
        </div>
      </div>

      {/* Big % */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: T.fontSerif, fontSize: 56, fontWeight: 900, color: T.gold, lineHeight: 1 }}>
          100<span style={{ fontSize: 28 }}>%</span>
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.18em', marginTop: 2 }}>
          47 / 47 種類 · 188 枚所持
        </div>
      </div>

      {/* By color */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em', marginBottom: 6 }}>BY COLOR</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {colorStats.map((s, i) => (
            <CoverageRow key={i} {...s} />
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em', marginBottom: 6 }}>BY RARITY</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {rarityStats.map((r, i) => (
            <div key={i} style={{
              flex: 1,
              padding: '6px 4px',
              background: 'rgba(0,0,0,0.4)',
              border: `1px solid ${r.color}44`,
              borderRadius: 2,
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: r.color, letterSpacing: '0.15em' }}>{r.label}</div>
              <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textPrimary, marginTop: 1 }}>{r.owned}/{r.total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoverageRow({ color, label, owned, total }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 14, height: 14, background: color, borderRadius: 2 }} />
      <div style={{ width: 28, fontFamily: T.fontJp, fontSize: 12, color: T.textPrimary, fontWeight: 700 }}>{label}</div>
      <div style={{ flex: 1, height: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${(owned / total) * 100}%`, height: '100%', background: color }} />
      </div>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, minWidth: 36, textAlign: 'right' }}>
        {owned}/{total}
      </div>
    </div>
  );
}

function FiltersPanel() {
  return (
    <div style={{
      flex: 1,
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column', gap: 14,
      overflow: 'hidden',
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>
        FILTERS
      </div>

      <FilterGroup label="色" items={[
        { c: T.blue, label: '青', n: 18, active: true },
        { c: T.yellow, label: '黄', n: 12, active: true },
        { c: T.red, label: '赤', n: 9 },
        { c: T.green, label: '緑', n: 5 },
        { c: T.purple, label: '紫', n: 3 },
      ]} />

      <FilterGroup label="種別" items={[
        { c: T.gold, label: 'パートナー', n: 4, active: true },
        { c: T.neonBlue, label: 'キャラ', n: 38, active: true },
        { c: T.purple, label: 'イベント', n: 5 },
      ]} />

      <FilterGroup label="コスト" small items={[
        { label: '0', n: 0 },
        { label: '1', n: 4 },
        { label: '2', n: 8 },
        { label: '3', n: 7 },
        { label: '4', n: 6 },
        { label: '5', n: 6 },
        { label: '6', n: 5 },
        { label: '7', n: 4 },
        { label: '8+', n: 7 },
      ].map((c) => ({ ...c, c: T.neonBlue, active: ['2','3','4'].includes(c.label) }))} />

      <FilterGroup label="特徴" items={[
        { c: T.neonBlue, label: '少年探偵団', n: 12, active: true },
        { c: T.yellow, label: '警察', n: 9 },
        { c: T.gold, label: '探偵', n: 5 },
        { c: T.purple, label: '怪盗', n: 2 },
        { c: T.green, label: '科学者', n: 3 },
      ]} />

      <FilterGroup label="キーワード" items={[
        { c: T.gold, label: 'ヒラメキ', n: 14 },
        { c: T.neonBlue, label: 'カットイン', n: 11 },
        { c: T.red, label: '突撃', n: 6 },
        { c: T.purple, label: '宣言', n: 8 },
      ]} />

      <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, padding: '7px', textAlign: 'center', background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.textMuted}55`, borderRadius: 2, fontSize: 11, color: T.textMuted, fontFamily: T.fontMono, letterSpacing: '0.18em', cursor: 'pointer' }}>
          リセット
        </div>
        <div style={{ flex: 1, padding: '7px', textAlign: 'center', background: T.gold, color: '#1a1208', borderRadius: 2, fontSize: 11, fontWeight: 800, fontFamily: T.fontMono, letterSpacing: '0.18em', cursor: 'pointer' }}>
          APPLY · 32 件
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, items, small }) {
  return (
    <div>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {items.map((it, i) => (
          <div key={i} style={{
            padding: small ? '3px 7px' : '4px 8px',
            background: it.active ? `${it.c}33` : 'rgba(0,0,0,0.3)',
            border: `1px solid ${it.active ? it.c : `${it.c}33`}`,
            borderRadius: 2,
            display: 'flex', alignItems: 'center', gap: 5,
            cursor: 'pointer',
          }}>
            <div style={{ fontSize: 11, fontWeight: it.active ? 700 : 500, color: it.active ? it.c : T.textMuted }}>{it.label}</div>
            <div style={{ fontFamily: T.fontMono, fontSize: 9, color: it.active ? it.c : T.textDisabled, opacity: 0.7 }}>{it.n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CENTER: card grid ──────────────────────────────────────────────────
function CardGridPanel() {
  // Show many cards from CARD_POOL
  const cards = window.CARD_POOL;
  const selectedNum = 'D08005';
  return (
    <div style={{
      width: '100%', height: '100%',
      padding: '16px 18px 18px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>
          CARDS · 32 件 一致
        </div>
        <div style={{ marginLeft: 14, fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em' }}>
          PAGE 1 / 1
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em', display: 'flex', gap: 12 }}>
          <span>★ お気に入り 4</span>
          <span>★ 新着 0</span>
        </div>
      </div>
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 14,
        alignContent: 'start',
      }}>
        {cards.slice(0, 24).map((c) => (
          <div key={c.num} style={{ display: 'flex', justifyContent: 'center' }}>
            <CardGridItem card={c} selected={c.num === selectedNum} owned={(c.num === 'D11015' ? false : true)} count={4} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardGridItem({ card, selected, owned, count }) {
  return (
    <div style={{
      position: 'relative',
      transform: selected ? 'translateY(-3px) scale(1.03)' : 'none',
      transition: 'transform 150ms',
      opacity: owned ? 1 : 0.35,
      filter: selected ? `drop-shadow(0 0 12px ${T.gold}88)` : 'none',
    }}>
      <MetaCard card={card} w={140} selected={selected} count={count} hoverable={true} />
      {!owned && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5,8,16,0.6)',
          borderRadius: 6,
        }}>
          <div style={{
            fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
            color: T.red, letterSpacing: '0.2em',
            padding: '3px 10px',
            background: 'rgba(0,0,0,0.7)',
            border: `1px solid ${T.red}88`,
            borderRadius: 2,
          }}>未所持</div>
        </div>
      )}
    </div>
  );
}

// ── RIGHT: detail panel ────────────────────────────────────────────────
function SelectedCardDetail() {
  const card = window.CARD_POOL.find((c) => c.num === 'D08005');
  return (
    <div style={{
      width: '100%', height: '100%',
      padding: '20px 22px 22px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.95), rgba(13,38,64,0.75))',
      border: `1px solid ${COLOR_TOKEN[card.color]}66`,
      borderRadius: 4,
      boxShadow: `inset 0 0 40px ${COLOR_TOKEN[card.color]}15`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Big card */}
      <div style={{
        alignSelf: 'center', marginBottom: 16,
        filter: `drop-shadow(0 0 24px ${COLOR_TOKEN[card.color]}66) drop-shadow(0 8px 16px rgba(0,0,0,0.7))`,
      }}>
        <MetaCard card={card} w={250} hoverable={false} />
      </div>

      {/* Meta + stats */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>{card.num}</div>
          <div style={{ padding: '1px 6px', background: T.gold, color: '#1a1208', fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, letterSpacing: '0.15em' }}>{card.rarity}</div>
          <div style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: T.green, letterSpacing: '0.15em' }}>所持 ×4</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.04em' }}>{card.name}</div>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.1em', marginTop: 2 }}>
          キャラ · {card.features.join(' / ')}
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <SmallStat label="C" value={card.cost} accent={T.neonBlue} />
        <SmallStat label="AP" value={card.ap?.toLocaleString()} accent={T.red} />
        <SmallStat label="LP" value={card.lp} accent={T.green} />
      </div>

      {/* Effect */}
      <div style={{
        padding: '10px 12px', marginBottom: 10,
        background: 'rgba(0,0,0,0.45)',
        border: `1px solid ${COLOR_TOKEN[card.color]}33`,
        borderRadius: 3,
      }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, letterSpacing: '0.2em', marginBottom: 4 }}>EFFECT · 効果</div>
        <div style={{ fontSize: 12, lineHeight: 1.55, color: T.textPrimary }}>
          {card.effectShort}
        </div>
      </div>

      {/* Usage / appearances */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em', marginBottom: 6 }}>USAGE · このカードでの戦績</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <UsageStat label="採用デッキ" value="3 / 4" />
          <UsageStat label="勝率(採用時)" value="71%" highlight />
          <UsageStat label="MVP 数" value="12" highlight />
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, padding: '8px', textAlign: 'center', background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.gold}66`, borderRadius: 2, fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.18em', cursor: 'pointer' }}>
          ★ お気に入り
        </div>
        <div data-nav-to="deck" style={{ flex: 1, padding: '8px', textAlign: 'center', background: T.neonBlue, color: '#0a1a28', borderRadius: 2, fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', cursor: 'pointer' }}>
          + デッキへ追加
        </div>
      </div>
    </div>
  );
}

function SmallStat({ label, value, accent }) {
  return (
    <div style={{
      flex: 1, padding: '6px 8px',
      background: `${accent}15`,
      border: `1px solid ${accent}55`,
      borderRadius: 2,
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function UsageStat({ label, value, highlight }) {
  return (
    <div style={{
      flex: 1, padding: '7px 9px',
      background: 'rgba(0,0,0,0.4)',
      border: `1px solid rgba(78,195,255,0.2)`,
      borderRadius: 2, lineHeight: 1.2,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.15em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 14, fontWeight: 800, color: highlight ? T.gold : T.textPrimary, marginTop: 1 }}>{value}</div>
    </div>
  );
}

window.CardsScreen = CardsScreen;
