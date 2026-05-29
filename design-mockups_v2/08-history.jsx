// 08-history.jsx
// 対戦履歴画面 — マッチリスト + フィルター + 集計サマリ
// 1920×1080

function HistoryScreen() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: T.fontJp, color: T.textPrimary }}>
      <MetaBg theme="noir" scene="history">
        <AppTopBar page="HOME" />
        <HistorySubToolbar />

        <div style={{
          position: 'absolute', left: 24, right: 24, top: 130, bottom: 24,
          display: 'flex', gap: 16, zIndex: 5,
        }}>
          {/* LEFT: Filters */}
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <HistoryFilters />
          </div>

          {/* CENTER: Match list */}
          <div style={{ flex: 1 }}>
            <HistoryList />
          </div>

          {/* RIGHT: Aggregate stats */}
          <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <WinRateSummary />
            <DeckPerformance />
            <OpponentHeatmap />
          </div>
        </div>
      </MetaBg>
    </div>
  );
}

function HistorySubToolbar() {
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
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>HISTORY</div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, letterSpacing: '0.06em' }}>対戦履歴</div>
        <div style={{ padding: '3px 10px', background: 'rgba(78,195,255,0.15)', border: `1px solid ${T.neonBlue}66`, borderRadius: 2, fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, color: T.neonBlue, letterSpacing: '0.15em' }}>
          128 戦
        </div>
        <div style={{ padding: '3px 10px', background: 'rgba(68,221,153,0.15)', border: `1px solid ${T.green}66`, borderRadius: 2, fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, color: T.green, letterSpacing: '0.15em' }}>
          82 W
        </div>
        <div style={{ padding: '3px 10px', background: 'rgba(200,64,64,0.15)', border: `1px solid ${T.red}66`, borderRadius: 2, fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, color: T.red, letterSpacing: '0.15em' }}>
          46 L
        </div>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <SmallButton label="今日" sub="TODAY" />
        <SmallButton label="今週" sub="WEEK" active />
        <SmallButton label="今月" sub="MONTH" />
        <SmallButton label="全期間" sub="ALL" />
        <div style={{ width: 1, height: 22, background: 'rgba(78,195,255,0.2)', margin: '0 6px' }} />
        <SmallButton label="エクスポート" sub="CSV" />
      </div>
    </div>
  );
}

// ── LEFT: Filters ──────────────────────────────────────────────────────
function HistoryFilters() {
  return (
    <div style={{
      flex: 1,
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>
        FILTER
      </div>

      <FilterGroup label="結果" items={[
        { c: T.green, label: '勝利', n: 82, active: true },
        { c: T.red, label: '敗北', n: 46, active: true },
        { c: T.gold, label: '引分', n: 0 },
      ]} />

      <FilterGroup label="モード" items={[
        { c: T.green, label: '単独捜査', n: 98, active: true },
        { c: T.purple, label: '観察ルーム', n: 30 },
      ]} />

      <FilterGroup label="使用デッキ" items={[
        { c: T.blue, label: '少年探偵団・標準', n: 48, active: true },
        { c: T.yellow, label: '警察(R)', n: 24 },
        { c: T.blue, label: '怪盗キッド型', n: 9 },
        { c: T.textMuted, label: 'その他 11 デッキ', n: 47 },
      ]} />

      <FilterGroup label="難易度" items={[
        { c: T.green, label: '初級', n: 12 },
        { c: T.gold, label: '標準', n: 64, active: true },
        { c: T.red, label: '上級', n: 41 },
        { c: T.purple, label: 'カスタム', n: 11 },
      ]} />

      <FilterGroup label="ターン数" items={[
        { c: T.neonBlue, label: '〜6', n: 18 },
        { c: T.neonBlue, label: '7-9', n: 64, active: true },
        { c: T.neonBlue, label: '10-12', n: 32 },
        { c: T.neonBlue, label: '13+', n: 14 },
      ]} />

      <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, padding: '7px', textAlign: 'center', background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.textMuted}55`, borderRadius: 2, fontSize: 11, color: T.textMuted, fontFamily: T.fontMono, letterSpacing: '0.18em', cursor: 'pointer' }}>
          リセット
        </div>
        <div style={{ flex: 1, padding: '7px', textAlign: 'center', background: T.gold, color: '#1a1208', borderRadius: 2, fontSize: 11, fontWeight: 800, fontFamily: T.fontMono, letterSpacing: '0.18em', cursor: 'pointer' }}>
          適用
        </div>
      </div>
    </div>
  );
}

// ── CENTER: Match list ─────────────────────────────────────────────────
function HistoryList() {
  // Prefer real history from engineStub when available
  const realMatches = window.engineStub ? window.engineStub.history.list() : [];
  const demoMatches = [
    { id: 1248, won: true,  date: '今日 15:42', deck: '少年探偵団・標準', partnerNum: 'D08001', oppDeck: '警察 標準',     oppPartnerNum: 'D11001', turns: 9, dur: '12:34', mode: 'solo', mvp: '灰原哀', evid: '5/4', evidL: '2/4', highlight: 'MVP' },
    { id: 1247, won: true,  date: '今日 15:18', deck: '少年探偵団・標準', partnerNum: 'D08001', oppDeck: '少年探偵団 標準', oppPartnerNum: 'D08002', turns: 7, dur: '08:21', mode: 'solo', mvp: '江戸川コナン', evid: '5/4', evidL: '3/4', highlight: 'FAST' },
    { id: 1246, won: false, date: '今日 14:51', deck: '少年探偵団・標準', partnerNum: 'D08001', oppDeck: '怪盗 標準',    oppPartnerNum: 'D08001', turns: 12, dur: '18:02', mode: 'solo', mvp: '—', evid: '3/4', evidL: '4/4', highlight: 'CLOSE' },
    { id: 1245, won: true,  date: '今日 14:28', deck: '警察 (R)',       partnerNum: 'D11002', oppDeck: '少年探偵団 標準', oppPartnerNum: 'D08001', turns: 8, dur: '10:48', mode: 'observe', mvp: '安室透', evid: '4/4', evidL: '2/4', highlight: '' },
    { id: 1244, won: true,  date: '今日 13:55', deck: '少年探偵団・標準', partnerNum: 'D08001', oppDeck: '警察 上級',    oppPartnerNum: 'D11001', turns: 10, dur: '14:11', mode: 'solo', mvp: '怪盗キッド', evid: '5/4', evidL: '3/4', highlight: 'MISDIR' },
    { id: 1243, won: false, date: '昨日 22:14', deck: '怪盗キッド型',   partnerNum: 'D08001', oppDeck: '黒の組織 上級', oppPartnerNum: 'D08001', turns: 11, dur: '16:27', mode: 'solo', mvp: '—', evid: '2/5', evidL: '5/5', highlight: '' },
    { id: 1242, won: true,  date: '昨日 21:48', deck: '少年探偵団・標準', partnerNum: 'D08001', oppDeck: '少年探偵団 標準', oppPartnerNum: 'D08001', turns: 9, dur: '11:53', mode: 'solo', mvp: '阿笠博士', evid: '5/4', evidL: '4/4', highlight: '' },
    { id: 1241, won: true,  date: '昨日 21:22', deck: '警察 (R)',       partnerNum: 'D11001', oppDeck: '警察 上級',    oppPartnerNum: 'D11002', turns: 9, dur: '12:08', mode: 'solo', mvp: '横溝重悟', evid: '4/4', evidL: '3/4', highlight: '' },
  ];
  // Map real matches to row shape if any exist
  const matches = realMatches.length > 0
    ? realMatches.slice(0, 12).map((m) => ({
        id: m.id?.replace?.('m-', '').slice(-4) || '???',
        won: m.won,
        date: m.date || '直近',
        deck: m.deck,
        partnerNum: m.partnerNum,
        oppDeck: m.opp,
        oppPartnerNum: m.oppPartnerNum,
        turns: m.turns,
        dur: m.dur,
        mode: m.mode === 'observe' ? 'observe' : 'solo',
        mvp: m.mvp,
        evid: `${m.evidGot}/${m.p1Target || m.targetEv}`,
        evidL: `${m.evidLost}/${m.p2Target || m.targetEv}`,
        highlight: m.highlight,
      }))
    : demoMatches;
  return (
    <div style={{
      height: '100%',
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>MATCHES</div>
        <div style={{ marginLeft: 14, fontSize: 11, color: T.textMuted }}>クリックで詳細リプレイ表示</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>
          <span>SHOWING 8 / 128</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
        {matches.map((m) => <MatchRow key={m.id} match={m} />)}
      </div>
    </div>
  );
}

function MatchRow({ match }) {
  const partner = window.CARD_POOL.find((c) => c.num === match.partnerNum);
  const oppPartner = window.CARD_POOL.find((c) => c.num === match.oppPartnerNum);
  const c = match.won ? T.green : T.red;
  return (
    <div className="meta-row" style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px',
      background: match.won ? 'rgba(68,221,153,0.06)' : 'rgba(200,64,64,0.06)',
      border: `1px solid ${c}33`,
      borderRadius: 3,
      cursor: 'pointer',
    }}>
      {/* W/L badge */}
      <div style={{
        width: 36, height: 50, flexShrink: 0,
        background: `linear-gradient(180deg, ${c}aa, ${shade(c, -0.3)})`,
        border: `1.5px solid ${shade(c, 0.2)}`,
        borderRadius: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        boxShadow: `0 0 6px ${c}55`,
      }}>
        <div style={{ fontFamily: T.fontSerif, fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{match.won ? 'W' : 'L'}</div>
        <div style={{ fontFamily: T.fontMono, fontSize: 8, color: '#fff', opacity: 0.85, marginTop: 2, letterSpacing: '0.15em' }}>#{match.id}</div>
      </div>

      {/* Match details */}
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{
            padding: '1px 5px',
            background: match.mode === 'human' ? `${T.green}22` : `${T.purple}22`,
            border: `1px solid ${match.mode === 'human' ? T.green : T.purple}66`,
            fontFamily: T.fontMono, fontSize: 8, fontWeight: 800,
            color: match.mode === 'human' ? T.green : T.purple,
            letterSpacing: '0.15em', borderRadius: 1,
          }}>{match.mode === 'human' ? 'SOLO' : 'OBSERVE'}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
            <span style={{ color: T.gold }}>{match.deck}</span>
            <span style={{ color: T.textMuted, margin: '0 6px', fontFamily: T.fontMono, fontSize: 11 }}>VS</span>
            <span>{match.oppDeck}</span>
          </div>
          {match.highlight && (
            <div style={{
              marginLeft: 'auto',
              padding: '1px 6px',
              fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
              background: 'rgba(255,215,0,0.15)',
              border: `1px solid ${T.gold}66`,
              borderRadius: 1,
              color: T.gold, letterSpacing: '0.18em',
            }}>
              ★ {match.highlight}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 14, fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.08em' }}>
          <span>{match.date}</span>
          <span>· {match.turns}T / {match.dur}</span>
          <span>· 証拠 {match.evid} vs {match.evidL}</span>
          {match.mvp !== '—' && <span>· MVP <span style={{ color: T.gold }}>{match.mvp}</span></span>}
        </div>
      </div>

      {/* Partner thumbs */}
      <div style={{ display: 'flex', gap: 4 }}>
        <MetaCard card={partner} w={42} badge={null} hoverable={false} />
        <div style={{ display: 'flex', alignItems: 'center', color: T.textMuted, fontFamily: T.fontMono, fontSize: 10 }}>vs</div>
        <MetaCard card={oppPartner} w={42} badge={null} hoverable={false} />
      </div>

      {/* View button */}
      <div
        data-nav-to="replay"
        style={{
        flexShrink: 0,
        padding: '8px 14px',
        background: 'rgba(0,0,0,0.5)',
        border: `1px solid ${T.neonBlue}55`,
        borderRadius: 2,
        fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
        color: T.neonBlue, letterSpacing: '0.18em',
        cursor: 'pointer',
      }}>
        詳細 ▸
      </div>
    </div>
  );
}

// ── RIGHT: aggregate stats ─────────────────────────────────────────────
function WinRateSummary() {
  // Last 14 days win-rate trend
  const data = [55, 62, 58, 71, 68, 75, 70, 62, 58, 64, 72, 78, 66, 64];
  const max = 100;
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid ${T.gold}55`,
      borderRadius: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>WIN RATE</div>
        <div style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>過去 14 日</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>OVERALL</div>
          <div>
            <span style={{ fontFamily: T.fontSerif, fontSize: 42, fontWeight: 900, color: T.gold, lineHeight: 1 }}>64</span>
            <span style={{ fontFamily: T.fontMono, fontSize: 16, color: T.gold, marginLeft: 2 }}>%</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <Trend label="勝率" value="+4.2%" up />
          <Trend label="ストリーク" value="3W" />
          <Trend label="最高" value="9W" />
        </div>
      </div>

      {/* Sparkline chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56 }}>
        {data.map((v, i) => (
          <div key={i} style={{
            flex: 1, height: `${(v / max) * 100}%`,
            background: `linear-gradient(180deg, ${v >= 60 ? T.gold : T.neonBlue}, ${shade(v >= 60 ? T.gold : T.neonBlue, -0.5)})`,
            opacity: i === data.length - 1 ? 1 : 0.55,
            borderRadius: '1px 1px 0 0',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.1em', marginTop: 4 }}>
        <span>5/7</span>
        <span>5/14</span>
        <span>今日</span>
      </div>
    </div>
  );
}

function Trend({ label, value, up }) {
  return (
    <div style={{ lineHeight: 1.2 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.15em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 13, fontWeight: 800, color: up ? T.green : T.textPrimary, marginTop: 1 }}>
        {up && '▲ '}{value}
      </div>
    </div>
  );
}

function DeckPerformance() {
  const decks = [
    { name: '少年探偵団・標準', plays: 48, wr: 72, color: T.blue },
    { name: '警察 (R)', plays: 24, wr: 58, color: T.yellow },
    { name: '怪盗キッド型', plays: 9, wr: 41, color: T.blue },
    { name: 'その他 11 デッキ', plays: 47, wr: 55, color: T.textMuted },
  ];
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em', marginBottom: 10 }}>
        BY DECK
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {decks.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 24, background: d.color, borderRadius: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${d.wr}%`, height: '100%', background: d.wr >= 60 ? T.green : d.wr >= 50 ? T.gold : T.red }} />
                </div>
                <div style={{ fontFamily: T.fontMono, fontSize: 10, color: d.wr >= 60 ? T.green : d.wr >= 50 ? T.gold : T.red, fontWeight: 700, width: 32, textAlign: 'right' }}>{d.wr}%</div>
                <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, width: 32, textAlign: 'right' }}>{d.plays} 戦</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpponentHeatmap() {
  // 5x5 matrix: our deck vs opp deck win rates
  const ourDecks = ['少年', '警察', '怪盗'];
  const oppDecks = ['少年', '警察', '怪盗', '組織', '上級AI'];
  const grid = [
    [62, 78, 55, 40, 48],
    [70, 60, 50, 45, 40],
    [55, 50, 30, 25, 35],
  ];
  return (
    <div style={{
      flex: 1,
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>
          MATCHUPS
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.15em' }}>
          自分(縦) × 相手(横)
        </div>
      </div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${oppDecks.length}, 1fr)`, gap: 4, marginBottom: 4 }}>
        <div />
        {oppDecks.map((o, i) => (
          <div key={i} style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, textAlign: 'center', letterSpacing: '0.1em' }}>{o}</div>
        ))}
      </div>
      {ourDecks.map((our, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: `60px repeat(${oppDecks.length}, 1fr)`, gap: 4, marginBottom: 4 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textSecondary, fontWeight: 700, display: 'flex', alignItems: 'center' }}>{our}</div>
          {grid[ri].map((v, ci) => {
            const hue = v >= 60 ? T.green : v >= 50 ? T.gold : v >= 40 ? T.neonBlue : T.red;
            return (
              <div key={ci} style={{
                padding: '8px 0',
                background: `linear-gradient(180deg, ${hue}${Math.round(v * 0.6).toString(16).padStart(2, '0')}, ${hue}${Math.round(v * 0.3).toString(16).padStart(2, '0')})`,
                border: `1px solid ${hue}55`,
                borderRadius: 2,
                fontFamily: T.fontMono, fontSize: 13, fontWeight: 800,
                color: hue === T.gold ? '#1a1208' : '#fff',
                textAlign: 'center',
              }}>{v}%</div>
            );
          })}
        </div>
      ))}
      <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', gap: 8, fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.1em' }}>
        <span style={{ color: T.red }}>■ 苦手 &lt;50</span>
        <span style={{ color: T.gold }}>■ 互角 50-60</span>
        <span style={{ color: T.green }}>■ 得意 60+</span>
      </div>
    </div>
  );
}

window.HistoryScreen = HistoryScreen;
