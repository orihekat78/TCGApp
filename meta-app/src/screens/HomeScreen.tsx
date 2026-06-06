// spec: .claude/specs/meta-ui/06-screens-play-flow.md + 12-screens-rebuild.md
// 原典: design-mockups_v2/06-home.jsx
// Phase 13-C: HeroBackdrop (skyline + magnifier + light beam) + CenterHero (3 card stack + DuelButton)
// + 左 News/Recent + 右 MyDecks/Campaign + 下部 5 CTA

import { T, shade } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { MetaCard } from '../shared/MetaCard';
import { EmptyState } from '../shared/EmptyState';
import { engineStub } from '../stubs/engineStub';
import { useDecksStore } from '../state/decksStore';
import { useHistoryStore } from '../state/historyStore';
import { CARD_POOL, cardIdOf } from '../data/cardPool';
import type { Route } from '../router/routes';

interface Props {
  onNav: (r: Route) => void;
}

export function HomeScreen({ onNav }: Props) {
  const decks = useDecksStore((s) => s.decks);
  const allHistory = useHistoryStore((s) => s.history);
  const winRate = engineStub.history.winRate();

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
      <HeroBackdrop />
      <AppTopBar page="home" onNav={(r) => onNav(r as Route)} winRate={winRate.rate} played={winRate.total} />

      <CenterHero onStart={() => onNav('setup')} />

      <div style={{
        position: 'absolute', left: 32, top: 88, width: 340, bottom: 220,
        display: 'flex', flexDirection: 'column', gap: 12, zIndex: 5,
      }}>
        <NewsPanel />
        <RecentMatchesPanel history={allHistory.slice(0, 3)} />
      </div>

      <div style={{
        position: 'absolute', right: 32, top: 88, width: 360, bottom: 220,
        display: 'flex', flexDirection: 'column', gap: 12, zIndex: 5,
      }}>
        <MyDecksPanel decks={decks.slice(0, 3)} onSeeAll={() => onNav('deck')} />
        <CampaignPanel winRate={winRate.rate} />
      </div>

      <BottomCTAs onNav={onNav} />

      <div style={{
        position: 'absolute', left: 36, bottom: 14,
        fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.18em', zIndex: 5,
      }}>
        meta-app · port 5174 · DESIGN PROTOTYPE
      </div>
      <div style={{
        position: 'absolute', right: 36, bottom: 14,
        fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.18em', zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}` }} />
        ENGINE READY · {CARD_POOL.length} cards
      </div>
    </div>
  );
}

// ---- Backdrop (skyline + magnifier + light beam) ----

function HeroBackdrop() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      <svg style={{ position: 'absolute', left: 0, right: 0, bottom: 120, width: '100%', height: 320 }} viewBox="0 0 1920 320" preserveAspectRatio="none">
        <defs>
          <linearGradient id="skyfade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0a1a28" stopOpacity="0" />
            <stop offset="100%" stopColor="#02050b" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d="M0 200 L60 200 L80 160 L160 160 L180 140 L260 140 L290 170 L380 170 L420 130 L520 130 L560 170 L640 170 L680 150 L780 150 L820 110 L900 110 L940 150 L1040 150 L1080 130 L1180 130 L1220 170 L1320 170 L1360 130 L1460 130 L1500 170 L1600 170 L1640 110 L1720 110 L1760 150 L1860 150 L1920 130 L1920 320 L0 320 Z" fill="#0a1a28" opacity="0.7" />
        <path d="M0 240 L100 240 L130 200 L220 200 L260 220 L340 220 L380 180 L460 180 L500 220 L600 220 L640 180 L740 180 L790 230 L890 230 L930 190 L1050 190 L1090 230 L1180 230 L1230 200 L1320 200 L1370 230 L1480 230 L1530 200 L1620 200 L1670 240 L1780 240 L1820 220 L1920 220 L1920 320 L0 320 Z" fill="#05101c" opacity="0.85" />
        {Array.from({ length: 80 }, (_, i) => {
          const x = (i * 137) % 1920;
          const y = 200 + ((i * 47) % 80);
          return <rect key={i} x={x} y={y} width="2" height="3" fill="#ffd75e" opacity={((i * 13) % 100) / 200 + 0.1} />;
        })}
        <rect x="0" y="0" width="1920" height="320" fill="url(#skyfade)" />
      </svg>
      <svg style={{ position: 'absolute', right: -80, top: 180, width: 560, height: 560, opacity: 0.10 }} viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="80" cy="80" r="60" stroke={T.gold} strokeWidth="3" fill="none" />
        <circle cx="80" cy="80" r="50" stroke={T.gold} strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
        <line x1="124" y1="124" x2="184" y2="184" stroke={T.gold} strokeWidth="8" strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', left: '50%', top: 0, width: 400, height: 700,
        marginLeft: -200,
        background: 'linear-gradient(180deg, rgba(255,215,0,0.18) 0%, rgba(255,215,0,0) 80%)',
        filter: 'blur(30px)',
      }} />
    </div>
  );
}

// ---- Center hero ----

function CenterHero({ onStart }: { onStart: () => void }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: 100, transform: 'translateX(-50%)',
      width: 720, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 60, height: 1, background: `linear-gradient(90deg, transparent, ${T.gold})` }} />
        <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.gold, letterSpacing: '0.4em' }}>CASE FILE · CT-D08</div>
        <div style={{ width: 60, height: 1, background: `linear-gradient(-90deg, transparent, ${T.gold})` }} />
      </div>
      <div style={{
        fontFamily: T.fontSerif, fontSize: 38, fontWeight: 900,
        color: T.textPrimary, letterSpacing: '0.2em',
        textShadow: `0 0 30px rgba(255,215,0,0.4), 0 4px 8px rgba(0,0,0,0.6)`,
        marginTop: 4, marginBottom: 2,
      }}>
        青の古城探索事件
      </div>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textSecondary, letterSpacing: '0.5em', marginBottom: 18 }}>
        SHIBUYA · APARTMENT SUITE
      </div>

      <HeroPartner />

      <div style={{ marginTop: 18 }}>
        <DuelButton onClick={onStart} />
      </div>
    </div>
  );
}

function HeroPartner() {
  const partner = CARD_POOL.find((c) => c.num === 'D08001');
  const support1 = CARD_POOL.find((c) => c.num === 'D08005');
  const support2 = CARD_POOL.find((c) => c.num === 'D08019');
  return (
    <div style={{ position: 'relative', width: 460, height: 380 }}>
      <div style={{
        position: 'absolute', left: '50%', top: '52%',
        width: 460, height: 460, marginLeft: -230, marginTop: -230,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.30) 0%, rgba(255,215,0,0.08) 30%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      {support1 && (
        <div style={{
          position: 'absolute', left: 6, top: 60, transform: 'rotate(-12deg)',
          filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.8))',
        }}>
          <MetaCard card={support1} w={150} hoverable={false} />
        </div>
      )}
      {support2 && (
        <div style={{
          position: 'absolute', right: 6, top: 60, transform: 'rotate(12deg)',
          filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.8))',
        }}>
          <MetaCard card={support2} w={150} hoverable={false} />
        </div>
      )}
      {partner && (
        <div style={{
          position: 'absolute', left: '50%', top: 0, marginLeft: -120,
          filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.85)) drop-shadow(0 0 28px rgba(255,215,0,0.45))',
        }}>
          <MetaCard card={partner} w={240} badge="partner" hoverable={false} />
        </div>
      )}
      {[[60, 90], [380, 110], [220, 30], [410, 220], [40, 250], [240, 360], [400, 320]].map(([x, y], i) => (
        <div key={i} style={{
          position: 'absolute', left: x, top: y, width: 5, height: 5,
          background: T.gold, borderRadius: '50%',
          boxShadow: `0 0 12px ${T.gold}, 0 0 4px #fff`, opacity: 0.8,
        }} />
      ))}
    </div>
  );
}

function DuelButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="meta-btn-ready" style={{
      position: 'relative', width: 340, height: 80, cursor: 'pointer',
      background: 'transparent', padding: 0, border: 'none',
    }}>
      <div style={{
        position: 'absolute', inset: -12,
        background: `radial-gradient(ellipse at 50% 50%, ${T.gold}66 0%, transparent 65%)`,
        filter: 'blur(10px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, ${T.gold} 0%, ${shade(T.gold, -0.4)} 100%)`,
        border: `2px solid #f0e08a`, borderRadius: 6,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 6px rgba(140,90,0,0.4), 0 8px 18px rgba(0,0,0,0.55)`,
        clipPath: 'polygon(20px 0, calc(100% - 20px) 0, 100% 50%, calc(100% - 20px) 100%, 20px 100%, 0 50%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      }}>
        <div style={{
          fontFamily: T.fontSerif, fontSize: 28, fontWeight: 900,
          color: '#1a1208', letterSpacing: '0.3em',
          textShadow: '0 2px 0 rgba(255,255,255,0.4)', marginRight: '-0.3em',
        }}>
          推 理 開 始
        </div>
        <div style={{
          fontFamily: T.fontMono, fontSize: 10, color: 'rgba(20,12,8,0.7)', letterSpacing: '0.4em',
        }}>
          START INVESTIGATION
        </div>
      </div>
    </button>
  );
}

// ---- Side rail panels ----

function NewsPanel() {
  const items = [
    { tag: 'UPDATE',  date: '2026.05.28', title: 'Phase 13 — 全画面 元モック忠実化', accent: T.gold },
    { tag: 'ENGINE',  date: '2026.05.27', title: 'カットイン declared effect 配線完了', accent: T.neonBlue },
    { tag: 'BALANCE', date: '2026.05.22', title: 'cards-data 19 パッケージ拡張', accent: T.red },
  ];
  return (
    <Panel title="NEWS" sub="お知らせ">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it, i) => (
          <div key={i} className="meta-row" style={{
            display: 'flex', gap: 10, padding: '8px 12px',
            borderTop: i === 0 ? 'none' : `1px solid rgba(78,195,255,0.08)`, cursor: 'pointer',
          }}>
            <div style={{
              padding: '2px 7px', alignSelf: 'flex-start',
              fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
              color: it.accent, letterSpacing: '0.16em',
              background: `${it.accent}22`, border: `1px solid ${it.accent}66`, borderRadius: 1,
            }}>{it.tag}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.12em' }}>{it.date}</div>
              <div style={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, lineHeight: 1.3 }}>{it.title}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RecentMatchesPanel({ history }: { history: import('../data/types').MatchRecord[] }) {
  return (
    <Panel title="RECENT" sub="最近の対戦">
      {history.length === 0 ? (
        <EmptyState icon="history" body="まだ対戦記録はありません" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {history.map((m, i) => (
            <div key={m.id} className="meta-row" style={{
              padding: '8px 12px',
              borderTop: i === 0 ? 'none' : `1px solid rgba(78,195,255,0.08)`,
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            }}>
              <div style={{
                padding: '2px 6px', minWidth: 24, textAlign: 'center',
                background: m.won ? `${T.green}33` : `${T.red}33`,
                color: m.won ? T.green : T.red,
                fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
                border: `1px solid ${m.won ? T.green : T.red}55`, borderRadius: 1,
              }}>{m.won ? 'W' : 'L'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: T.textPrimary,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{m.deckName}</div>
                <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.1em' }}>
                  {m.turns}T · 証拠 {m.evidGot}/{m.p1Target}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function MyDecksPanel({ decks, onSeeAll }: { decks: import('../data/types').DeckRecord[]; onSeeAll: () => void }) {
  return (
    <Panel title="MY DECKS" sub="マイデッキ">
      {decks.length === 0 ? (
        <EmptyState icon="deck" body="デッキがまだありません" cta="作成 →" onCta={onSeeAll} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {decks.map((d, i) => {
            const partner = CARD_POOL.find((c) => c.num === d.partner);
            const total = d.cards.reduce((s, e) => s + e.count, 0);
            return (
              <div key={d.id} className="meta-row" style={{
                padding: '8px 12px',
                borderTop: i === 0 ? 'none' : `1px solid rgba(78,195,255,0.08)`,
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              }}>
                {partner && <MetaCard card={partner} w={38} hoverable={false} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: T.textPrimary,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{d.name}</div>
                  <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em' }}>
                    {total} 枚 · {new Set(d.cards.map((e) => cardIdOf(e.num))).size} 種類
                  </div>
                </div>
              </div>
            );
          })}
          <button onClick={onSeeAll} style={{
            padding: '6px 12px', textAlign: 'right',
            fontFamily: T.fontMono, fontSize: 10, color: T.gold,
            background: 'transparent', cursor: 'pointer', letterSpacing: '0.18em',
          }}>
            ALL DECKS →
          </button>
        </div>
      )}
    </Panel>
  );
}

function CampaignPanel({ winRate }: { winRate: number }) {
  return (
    <Panel title="CAMPAIGN" sub="ストーリー進捗">
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.16em' }}>CHAPTER 03</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, marginTop: 2 }}>青の古城探索事件</div>
        </div>
        <div style={{ height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            width: `${winRate}%`, height: '100%',
            background: `linear-gradient(90deg, ${T.gold}, ${shade(T.gold, 0.2)})`,
            boxShadow: `0 0 6px ${T.gold}55`,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em' }}>
          <span>勝率 {winRate}%</span>
          <span>次の目標: 70%</span>
        </div>
      </div>
    </Panel>
  );
}

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'rgba(0,0,0,0.5)',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4, overflow: 'hidden',
      boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{
        padding: '8px 14px', background: 'rgba(0,0,0,0.35)',
        borderBottom: `1px solid rgba(78,195,255,0.15)`,
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>{title}</span>
        <span style={{ fontFamily: T.fontJp, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em' }}>{sub}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
    </div>
  );
}

// ---- Bottom CTAs ----

function BottomCTAs({ onNav }: { onNav: (r: Route) => void }) {
  const tiles: { route: Route; label: string; sub: string; accent: string }[] = [
    { route: 'deck',     label: 'デッキ編集',     sub: 'DECK',     accent: T.neonBlue },
    { route: 'cards',    label: 'カード一覧',     sub: 'CARDS',    accent: T.gold },
    { route: 'history',  label: '対戦履歴',       sub: 'HISTORY',  accent: T.green },
    { route: 'tutorial', label: 'チュートリアル', sub: 'TUTORIAL', accent: T.neonYellow },
    { route: 'settings', label: '設定',           sub: 'SETTINGS', accent: T.textSecondary },
  ];
  return (
    <div style={{
      position: 'absolute', left: 32, right: 32, bottom: 56,
      display: 'flex', gap: 12, zIndex: 5,
    }}>
      {tiles.map((t) => (
        <button key={t.route} onClick={() => onNav(t.route)} className="meta-cta-tile" style={{
          flex: 1, padding: '16px 14px',
          background: 'rgba(0,0,0,0.6)',
          border: `1px solid ${t.accent}66`, borderRadius: 4, cursor: 'pointer',
          color: T.textPrimary, textAlign: 'left',
          '--meta-tile-accent': t.accent,
          '--meta-tile-glow': `${t.accent}44`,
        } as React.CSSProperties}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: t.accent, letterSpacing: '0.22em' }}>{t.sub}</div>
          <div style={{ fontFamily: T.fontJp, fontSize: 15, fontWeight: 700, marginTop: 4 }}>{t.label}</div>
        </button>
      ))}
    </div>
  );
}
