// 06-home.jsx — Master Duel-style home screen for the conan TCG.
// 1920×1080. Composition:
//   - Top: AppTopBar (currencies, player, nav)
//   - Center stage: dramatic hero panel with main partner character + giant DUEL CTA
//   - Left rail: news / patch carousel + recent activity
//   - Right rail: daily missions + login bonus + season pass
//   - Bottom rail: secondary actions + tip

function HomeScreen() {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      fontFamily: T.fontJp,
      color: T.textPrimary,
    }}>
      <MetaBg theme="noir" scene="home">
        {/* Background hero — big partner silhouette + scenic backdrop */}
        <HeroBackdrop />

        <AppTopBar page="HOME" />

        {/* Left rail: news + recent activity */}
        <div style={{
          position: 'absolute', left: 32, top: 96, width: 360, bottom: 220,
          display: 'flex', flexDirection: 'column', gap: 16,
          zIndex: 5,
        }}>
          <NewsPanel />
          <RecentMatches />
        </div>

        {/* Right rail: my decks + campaign progress */}
        <div style={{
          position: 'absolute', right: 32, top: 96, width: 380, bottom: 220,
          display: 'flex', flexDirection: 'column', gap: 16,
          zIndex: 5,
        }}>
          <MyDecksPanel />
          <CampaignPanel />
        </div>

        {/* Center hero — partner showcase + chapter title */}
        <CenterHero />

        {/* Bottom main CTA row */}
        <BottomCTAs />

        {/* Bottom-left version + status */}
        <div style={{
          position: 'absolute', left: 36, bottom: 16,
          fontFamily: T.fontMono, fontSize: 10,
          color: T.textMuted, letterSpacing: '0.18em',
          zIndex: 5,
        }}>
          v0.8.3 · phase 9 polish · 47 cards
        </div>
        <div style={{
          position: 'absolute', right: 36, bottom: 16,
          fontFamily: T.fontMono, fontSize: 10,
          color: T.textMuted, letterSpacing: '0.18em',
          zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}` }} />
          ENGINE READY · 1377 tests green
        </div>
      </MetaBg>
    </div>
  );
}

// ── Background hero — full-bleed scenic backdrop (city + magnifier) ────
function HeroBackdrop() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Skyline silhouette */}
      <svg style={{ position: 'absolute', left: 0, right: 0, bottom: 120, width: '100%', height: 320 }} viewBox="0 0 1920 320" preserveAspectRatio="none">
        <defs>
          <linearGradient id="skyfade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0a1a28" stopOpacity="0" />
            <stop offset="100%" stopColor="#02050b" stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Far buildings */}
        <path d="M0 200 L60 200 L80 160 L160 160 L180 140 L260 140 L290 170 L380 170 L420 130 L520 130 L560 170 L640 170 L680 150 L780 150 L820 110 L900 110 L940 150 L1040 150 L1080 130 L1180 130 L1220 170 L1320 170 L1360 130 L1460 130 L1500 170 L1600 170 L1640 110 L1720 110 L1760 150 L1860 150 L1920 130 L1920 320 L0 320 Z" fill="#0a1a28" opacity="0.7" />
        {/* Nearer buildings */}
        <path d="M0 240 L100 240 L130 200 L220 200 L260 220 L340 220 L380 180 L460 180 L500 220 L600 220 L640 180 L740 180 L790 230 L890 230 L930 190 L1050 190 L1090 230 L1180 230 L1230 200 L1320 200 L1370 230 L1480 230 L1530 200 L1620 200 L1670 240 L1780 240 L1820 220 L1920 220 L1920 320 L0 320 Z" fill="#05101c" opacity="0.85" />
        {/* Windows (dotted) */}
        {Array.from({ length: 80 }, (_, i) => {
          const x = (i * 137) % 1920;
          const y = 200 + ((i * 47) % 80);
          return <rect key={i} x={x} y={y} width="2" height="3" fill="#ffd75e" opacity={((i * 13) % 100) / 200 + 0.1} />;
        })}
        <rect x="0" y="0" width="1920" height="320" fill="url(#skyfade)" />
      </svg>

      {/* Giant magnifier watermark to the right */}
      <svg style={{ position: 'absolute', right: -80, top: 180, width: 560, height: 560, opacity: 0.10 }} viewBox="0 0 200 200">
        <circle cx="80" cy="80" r="60" stroke={T.gold} strokeWidth="3" fill="none" />
        <circle cx="80" cy="80" r="50" stroke={T.gold} strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
        <line x1="124" y1="124" x2="184" y2="184" stroke={T.gold} strokeWidth="8" strokeLinecap="round" />
        <line x1="60" y1="65" x2="100" y2="65" stroke={T.gold} strokeWidth="1" opacity="0.6" />
        <line x1="60" y1="80" x2="100" y2="80" stroke={T.gold} strokeWidth="1" opacity="0.6" />
        <line x1="60" y1="95" x2="100" y2="95" stroke={T.gold} strokeWidth="1" opacity="0.6" />
      </svg>

      {/* Light beam from above-center */}
      <div style={{
        position: 'absolute', left: 760, top: 0, width: 400, height: 700,
        background: 'linear-gradient(180deg, rgba(255,215,0,0.18) 0%, rgba(255,215,0,0) 80%)',
        filter: 'blur(30px)',
      }} />
    </div>
  );
}

// ── Center hero — main partner showcase ────────────────────────────────
function CenterHero() {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: 110,
      transform: 'translateX(-50%)',
      width: 720, height: 760,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      zIndex: 3,
    }}>
      {/* Chapter banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4,
      }}>
        <div style={{ width: 80, height: 1, background: `linear-gradient(90deg, transparent, ${T.gold})` }} />
        <div style={{
          fontFamily: T.fontMono, fontSize: 12,
          color: T.gold, letterSpacing: '0.4em',
        }}>
          CHAPTER 03
        </div>
        <div style={{ width: 80, height: 1, background: `linear-gradient(-90deg, transparent, ${T.gold})` }} />
      </div>
      <div style={{
        fontFamily: T.fontSerif,
        fontSize: 42, fontWeight: 900,
        color: T.textPrimary,
        letterSpacing: '0.2em',
        textShadow: `0 0 30px rgba(255,215,0,0.4), 0 4px 8px rgba(0,0,0,0.6)`,
        marginBottom: 2,
      }}>
        真実はいつも一つ
      </div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 12,
        color: T.textSecondary,
        letterSpacing: '0.5em',
        marginBottom: 22,
      }}>
        SHIBUYA · APARTMENT SUITE
      </div>

      {/* Partner artwork card stack */}
      <div style={{
        position: 'relative', width: 460, height: 480,
        marginBottom: 26,
      }}>
        <HeroPartner />
      </div>

      {/* Giant DUEL CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <DuelButton />
      </div>
    </div>
  );
}

function HeroPartner() {
  // Stack of 3 cards: hero partner in front, 2 supporting characters behind.
  // Make it dramatic — front card large with halo glow.
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* halo */}
      <div style={{
        position: 'absolute', left: '50%', top: '52%',
        width: 460, height: 460,
        marginLeft: -230, marginTop: -230,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.35) 0%, rgba(255,215,0,0.1) 30%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* back-left supporting card */}
      <div style={{
        position: 'absolute', left: 6, top: 60,
        width: 200, height: 280,
        transform: 'rotate(-12deg)',
        filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.8))',
      }}>
        <MetaCard card={window.CARD_POOL.find((c) => c.num === 'D08005')} w={200} hoverable={false} />
      </div>
      {/* back-right supporting card */}
      <div style={{
        position: 'absolute', right: 6, top: 60,
        width: 200, height: 280,
        transform: 'rotate(12deg)',
        filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.8))',
      }}>
        <MetaCard card={window.CARD_POOL.find((c) => c.num === 'D08019')} w={200} hoverable={false} />
      </div>
      {/* Front hero card — partner */}
      <div style={{
        position: 'absolute', left: '50%', top: 0,
        marginLeft: -150,
        width: 300, height: 420,
        filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.85)) drop-shadow(0 0 28px rgba(255,215,0,0.45))',
      }}>
        <MetaCard
          card={window.CARD_POOL.find((c) => c.num === 'D08001')}
          w={300} badge="partner" hoverable={false}
        />
      </div>
      {/* Sparkle particles */}
      {[
        [60, 90], [380, 110], [220, 30], [410, 220], [40, 250], [240, 470], [400, 340],
      ].map(([x, y], i) => (
        <div key={i} style={{
          position: 'absolute', left: x, top: y,
          width: 6, height: 6,
          background: T.gold,
          borderRadius: '50%',
          boxShadow: `0 0 12px ${T.gold}, 0 0 4px #fff`,
          opacity: 0.8,
        }} />
      ))}
    </div>
  );
}

function DuelButton() {
  return (
    <div data-nav-to="setup" style={{
      position: 'relative',
      width: 360, height: 92,
      cursor: 'pointer',
    }}>
      {/* glow halo behind */}
      <div style={{
        position: 'absolute', inset: -14,
        background: `radial-gradient(ellipse at 50% 50%, ${T.gold}66 0%, transparent 65%)`,
        filter: 'blur(10px)',
        pointerEvents: 'none',
      }} />
      {/* The button */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, ${T.gold} 0%, #cc9a14 100%)`,
        border: `2px solid #f0e08a`,
        borderRadius: 6,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 6px rgba(140,90,0,0.4), 0 8px 18px rgba(0,0,0,0.55)`,
        clipPath: 'polygon(20px 0, calc(100% - 20px) 0, 100% 50%, calc(100% - 20px) 100%, 20px 100%, 0 50%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <div style={{
          fontFamily: T.fontSerif,
          fontSize: 32, fontWeight: 900,
          color: '#1a1208',
          letterSpacing: '0.3em',
          textShadow: '0 2px 0 rgba(255,255,255,0.4)',
          marginRight: '-0.3em',
        }}>
          推 理 開 始
        </div>
        <div style={{
          fontFamily: T.fontMono, fontSize: 11,
          color: 'rgba(20,12,8,0.7)', letterSpacing: '0.4em',
        }}>
          START INVESTIGATION
        </div>
      </div>
    </div>
  );
}

// ── Left rail: news / patch carousel ───────────────────────────────────
function NewsPanel() {
  const items = [
    { tag: 'UPDATE', date: '2026.05.20', title: 'ct-d11 / 警察スターターデッキ実装', body: '萩原千速 / 横溝重悟 を含む 21 枚を追加。', accent: T.gold },
    { tag: 'ENGINE', date: '2026.05.18', title: '効果スタックの計算順を修正', body: 'ヒラメキ・カットインの連鎖評価タイミングを安定化。', accent: T.neonBlue },
    { tag: 'BALANCE',date: '2026.05.15', title: '怪盗キッドのエラッタ', body: '【変装】の対象指定タイミングを修正。', accent: T.red },
  ];
  return (
    <Panel title="NEWS" titleSub="お知らせ">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10,
            padding: '10px 8px',
            borderTop: i === 0 ? 'none' : `1px solid rgba(78,195,255,0.1)`,
          }}>
            <div style={{
              flexShrink: 0,
              width: 64,
              fontFamily: T.fontMono, fontSize: 9,
              color: it.accent, letterSpacing: '0.12em',
              borderLeft: `2px solid ${it.accent}`,
              paddingLeft: 6,
              alignSelf: 'flex-start',
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 800 }}>{it.tag}</div>
              <div style={{ color: T.textMuted, marginTop: 1 }}>{it.date}</div>
            </div>
            <div style={{ flex: 1, lineHeight: 1.4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{it.title}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{it.body}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RecentMatches() {
  const matches = [
    { result: 'W', deck: '少年探偵団', opp: '黒の組織', time: '15:42', turns: 7, accent: T.green },
    { result: 'W', deck: '少年探偵団', opp: '警察', time: '15:18', turns: 9, accent: T.green },
    { result: 'L', deck: '少年探偵団', opp: '怪盗', time: '14:51', turns: 12, accent: T.red },
    { result: 'W', deck: '警察 (R)', opp: '少年探偵団', time: '14:28', turns: 8, accent: T.green },
  ];
  return (
    <Panel title="RECENT" titleSub="戦績" flex={1}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {matches.map((m, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 4px',
            borderTop: i === 0 ? 'none' : `1px solid rgba(78,195,255,0.08)`,
          }}>
            <div style={{
              width: 24, height: 24,
              background: m.result === 'W' ? 'rgba(58,166,122,0.18)' : 'rgba(200,64,64,0.18)',
              border: `1.5px solid ${m.accent}`,
              borderRadius: 3,
              fontFamily: T.fontMono, fontSize: 12, fontWeight: 800,
              color: m.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{m.result}</div>
            <div style={{ flex: 1, lineHeight: 1.3 }}>
              <div style={{ fontSize: 12, color: T.textPrimary, fontWeight: 600 }}>
                <span style={{ color: T.gold }}>{m.deck}</span>
                <span style={{ color: T.textMuted, margin: '0 6px' }}>vs</span>
                <span>{m.opp}</span>
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontMono, letterSpacing: '0.1em' }}>
                {m.time} · {m.turns} ターン
              </div>
            </div>
          </div>
        ))}
        <div style={{
          marginTop: 6, padding: '6px 4px',
          textAlign: 'right',
          fontFamily: T.fontMono, fontSize: 10,
          color: T.neonBlue, letterSpacing: '0.15em',
          cursor: 'pointer',
        }}>
          全戦績を見る →
        </div>
      </div>
    </Panel>
  );
}

// ── Right rail: my decks + campaign progress ──────────────────────────
function MyDecksPanel() {
  // Read decks from engine stub (localStorage-backed) when available.
  // Falls back to a static curated list for first-run / static render.
  const stub = window.engineStub;
  const stored = stub ? stub.decks.list() : null;
  const decks = stored && stored.length > 0
    ? stored.map((d, i) => {
        const partner = window.CARD_POOL.find((c) => c.num === d.partner);
        const wr = stub.history.winRate(d.name);
        return {
          name: d.name,
          partnerNum: d.partner,
          color: partner?.color || 'blue',
          winRate: wr.rate,
          plays: wr.total,
          selected: i === 0,
          draft: false,
        };
      })
    : [
        { name: '少年探偵団・標準', partnerNum: 'D08001', color: 'blue',   winRate: 72, plays: 48, selected: true },
        { name: '警察 (R) 高重タッチメン', partnerNum: 'D11002', color: 'yellow', winRate: 58, plays: 24 },
        { name: '怪盗キッド・変装型', partnerNum: 'D08001', color: 'blue',   winRate: 41, plays: 9 },
        { name: '中所 (試作)',     partnerNum: 'D11001', color: 'yellow', plays: 0, draft: true },
      ];
  return (
    <Panel title="DECKS" titleSub="デッキを選択">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {decks.map((d, i) => {
          const partner = window.CARD_POOL.find((c) => c.num === d.partnerNum);
          const c = COLOR_TOKEN[d.color] || T.blue;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 8px 7px 6px',
              background: d.selected ? `linear-gradient(90deg, ${T.gold}22, transparent 70%)` : 'transparent',
              border: `1px solid ${d.selected ? T.gold : 'transparent'}`,
              borderRadius: 3, cursor: 'pointer',
            }}>
              {/* Mini partner thumb */}
              <div style={{
                width: 38, height: 50,
                background: `linear-gradient(180deg, ${c}, ${shade(c, -0.5)})`,
                border: `1px solid ${shade(c, -0.5)}`,
                borderRadius: 2, flexShrink: 0, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', inset: '6px 4px 12px',
                  background: `radial-gradient(circle, ${shade(c, 0.2)}, ${shade(c, -0.5)})`,
                  borderRadius: 1,
                }} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  fontSize: 6, color: '#fff', textAlign: 'center',
                  background: 'rgba(0,0,0,0.7)', padding: '1px 0',
                  fontFamily: T.fontMono, letterSpacing: '0.05em',
                }}>{partner.num.slice(-3)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: d.selected ? T.gold : T.textPrimary,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    flex: 1, minWidth: 0,
                  }}>{d.name}</div>
                  {d.draft && (
                    <div style={{
                      padding: '1px 5px',
                      background: 'rgba(255,93,93,0.2)',
                      border: `1px solid ${T.red}66`,
                      borderRadius: 1,
                      fontFamily: T.fontMono, fontSize: 8, fontWeight: 800,
                      color: T.red, letterSpacing: '0.12em',
                    }}>DRAFT</div>
                  )}
                </div>
                <div style={{
                  fontFamily: T.fontMono, fontSize: 9, color: T.textMuted,
                  letterSpacing: '0.08em', marginTop: 1,
                  display: 'flex', gap: 10,
                }}>
                  <span>P: {partner.name}</span>
                  {d.plays > 0 && (
                    <span style={{ color: d.winRate >= 60 ? T.green : d.winRate >= 50 ? T.gold : T.red }}>
                      {d.winRate}% · {d.plays}戦
                    </span>
                  )}
                </div>
              </div>
              {d.selected && (
                <div style={{
                  fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
                  color: T.gold, letterSpacing: '0.18em',
                  padding: '2px 6px',
                  background: 'rgba(255,215,0,0.15)',
                  borderRadius: 2,
                }}>USE</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 8, padding: '7px 10px',
        background: 'rgba(78,195,255,0.05)',
        border: `1px dashed ${T.neonBlue}55`,
        borderRadius: 2,
        fontFamily: T.fontMono, fontSize: 10,
        color: T.neonBlue, letterSpacing: '0.15em',
        textAlign: 'center', cursor: 'pointer',
      }}>+ 新規デッキを作る</div>
    </Panel>
  );
}

function CampaignPanel() {
  const chapters = [
    { num: '01', title: 'ジェットコースター事件', state: 'cleared' },
    { num: '02', title: '残留思念の少女', state: 'cleared' },
    { num: '03', title: '渋谷スイートの不面目', state: 'current', progress: 3, total: 5 },
    { num: '04', title: '他トリノキシ事件', state: 'locked' },
    { num: '05', title: '黒衛息子の遺言', state: 'locked' },
  ];
  return (
    <Panel title="CASES" titleSub="ストーリー・チャプター" flex={1}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {chapters.map((c, i) => {
          const isCleared = c.state === 'cleared';
          const isCurrent = c.state === 'current';
          const isLocked = c.state === 'locked';
          const accent = isCurrent ? T.gold : isCleared ? T.green : T.textDisabled;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 8px',
              background: isCurrent ? 'rgba(255,215,0,0.08)' : 'transparent',
              border: `1px solid ${isCurrent ? `${T.gold}55` : 'transparent'}`,
              borderRadius: 3,
              opacity: isLocked ? 0.4 : 1,
            }}>
              <div style={{
                width: 32, height: 32, flexShrink: 0,
                background: isCleared ? `${T.green}22` : isCurrent ? `${T.gold}22` : 'rgba(0,0,0,0.45)',
                border: `1.5px solid ${accent}`, borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: T.fontMono, fontWeight: 800, fontSize: 12,
                color: accent, position: 'relative',
              }}>
                {isLocked ? '🔒' : c.num}
                {isCleared && (
                  <div style={{
                    position: 'absolute', right: -3, bottom: -3,
                    width: 12, height: 12,
                    background: T.green, borderRadius: '50%',
                    border: '1.5px solid #050810',
                    fontSize: 8, color: '#050810', fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✓</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700,
                  color: isCurrent ? T.textPrimary : isCleared ? T.textSecondary : T.textMuted,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.title}</div>
                {isCurrent && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <div style={{ flex: 1, height: 3, background: 'rgba(0,0,0,0.45)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(c.progress / c.total) * 100}%`, height: '100%', background: T.gold }} />
                    </div>
                    <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: '0.08em' }}>
                      {c.progress}/{c.total}
                    </div>
                  </div>
                )}
                {isCleared && (
                  <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.green, letterSpacing: '0.12em', marginTop: 1 }}>SOLVED</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Panel({ title, titleSub, children, flex }) {
  return (
    <div style={{
      flex: flex,
      padding: '12px 14px 14px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10,
        paddingBottom: 8, marginBottom: 6,
        borderBottom: `1px solid rgba(78,195,255,0.20)`,
      }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
          color: T.gold, letterSpacing: '0.28em',
        }}>{title}</div>
        <div style={{
          fontFamily: T.fontJp, fontSize: 11,
          color: T.textMuted, letterSpacing: '0.08em',
        }}>{titleSub}</div>
      </div>
      {children}
    </div>
  );
}

// ── Bottom CTA row ─────────────────────────────────────────────────────
function BottomCTAs() {
  const items = [
    { icon: 'deck',     navTo: 'deck',     label: 'デッキ編集',     sub: 'DECK',    accent: T.neonBlue, count: '4 デッキ' },
    { icon: 'cards',    navTo: 'cards',    label: 'カードリスト',   sub: 'CARDS',   accent: T.neonBlue, count: '47 / 47' },
    { icon: 'hist',     navTo: 'history',  label: '対戦履歴',       sub: 'HIST',    accent: T.green,    count: '128 戦' },
    { icon: 'tutorial', navTo: 'tutorial', label: 'チュートリアル', sub: 'TUTOR',   accent: T.green,    count: 'CH3' },
    { icon: 'settings', navTo: 'settings', label: '設定',           sub: 'CFG',     accent: T.textMuted, count: '' },
  ];
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 60,
      transform: 'translateX(-50%)',
      display: 'flex', gap: 12,
      zIndex: 5,
    }}>
      {items.map((it, i) => (
        <div key={i} data-nav-to={it.navTo} className="meta-cta-tile" style={{
          width: 168, height: 120,
          padding: '14px 14px 10px',
          background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(8,20,38,0.96))',
          border: `1px solid ${it.accent}55`,
          borderRadius: 4,
          boxShadow: `0 8px 20px rgba(0,0,0,0.6), inset 0 0 24px ${it.accent}11`,
          cursor: 'pointer',
          position: 'relative',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          '--meta-tile-accent': it.accent,
          '--meta-tile-glow': `${it.accent}66`,
        }}>
          <div style={{
            position: 'absolute', right: 8, top: 6,
            fontFamily: T.fontMono, fontSize: 9,
            color: it.accent, letterSpacing: '0.18em',
            background: `${it.accent}22`,
            padding: '2px 6px',
            borderRadius: 2,
            fontWeight: 700,
          }}>
            {it.count}
          </div>
          <div style={{ marginTop: 4 }}>
            <CTAIcon kind={it.icon} accent={it.accent} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.08em' }}>
              {it.label}
            </div>
            <div style={{
              fontFamily: T.fontMono, fontSize: 10,
              color: it.accent, letterSpacing: '0.18em', marginTop: 1,
            }}>
              {it.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CTAIcon({ kind, accent }) {
  const stroke = accent;
  const path = {
    deck: <React.Fragment>
      {/* Stack of cards */}
      <rect x="6" y="10" width="20" height="26" rx="2" fill="none" stroke={stroke} strokeWidth="1.6" transform="rotate(-6 16 23)" />
      <rect x="10" y="8" width="20" height="26" rx="2" fill="none" stroke={stroke} strokeWidth="1.6" transform="rotate(2 20 21)" />
      <rect x="14" y="6" width="20" height="26" rx="2" fill="none" stroke={stroke} strokeWidth="1.8" />
      <line x1="18" y1="14" x2="30" y2="14" stroke={stroke} strokeWidth="1.2" opacity="0.6" />
    </React.Fragment>,
    cards: <React.Fragment>
      {/* Grid of cards */}
      {[0,1,2].map((r) => [0,1,2].map((c) => (
        <rect key={`${r}-${c}`} x={5 + c * 11} y={5 + r * 11} width="9" height="9" rx="1" fill="none" stroke={stroke} strokeWidth="1.4" opacity={(r + c) % 2 === 0 ? 1 : 0.5} />
      )))}
    </React.Fragment>,
    hist: <React.Fragment>
      {/* List + checkmarks */}
      <line x1="6" y1="10" x2="34" y2="10" stroke={stroke} strokeWidth="1.6" />
      <line x1="6" y1="18" x2="28" y2="18" stroke={stroke} strokeWidth="1.6" />
      <line x1="6" y1="26" x2="32" y2="26" stroke={stroke} strokeWidth="1.6" />
      <line x1="6" y1="34" x2="24" y2="34" stroke={stroke} strokeWidth="1.6" />
      <circle cx="30" cy="34" r="4" fill={stroke} opacity="0.3" />
    </React.Fragment>,
    tutorial: <React.Fragment>
      {/* Open book */}
      <path d="M5 10 L20 14 L35 10 L35 30 L20 34 L5 30 Z" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <line x1="20" y1="14" x2="20" y2="34" stroke={stroke} strokeWidth="1.4" />
      <line x1="9" y1="16" x2="16" y2="17.5" stroke={stroke} strokeWidth="1" opacity="0.6" />
      <line x1="9" y1="20" x2="16" y2="21.5" stroke={stroke} strokeWidth="1" opacity="0.6" />
      <line x1="24" y1="17.5" x2="31" y2="16" stroke={stroke} strokeWidth="1" opacity="0.6" />
      <line x1="24" y1="21.5" x2="31" y2="20" stroke={stroke} strokeWidth="1" opacity="0.6" />
    </React.Fragment>,
    settings: <React.Fragment>
      {/* Gear */}
      <circle cx="20" cy="20" r="7" fill="none" stroke={stroke} strokeWidth="1.8" />
      <circle cx="20" cy="20" r="2.5" fill={stroke} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const x1 = 20 + Math.cos(a) * 9, y1 = 20 + Math.sin(a) * 9;
        const x2 = 20 + Math.cos(a) * 14, y2 = 20 + Math.sin(a) * 14;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="2" strokeLinecap="round" />;
      })}
    </React.Fragment>,
  }[kind];
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="meta-cta-svg">
      {path}
    </svg>
  );
}

window.HomeScreen = HomeScreen;
