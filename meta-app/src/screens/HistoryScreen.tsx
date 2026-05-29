// spec: .claude/specs/meta-ui/08-screens-reference.md + 12-screens-rebuild.md
// 原典: design-mockups_v2/08-history.jsx
// Phase 13-E: WinRateSummary (sparkline) + Filters + List + DeckPerformance + OpponentHeatmap

import { useMemo, useState } from 'react';
import { T, shade } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { SetupButton } from '../shared/Button';
import { EmptyState } from '../shared/EmptyState';
import { engineStub } from '../stubs/engineStub';
import { useHistoryStore } from '../state/historyStore';
import { useDecksStore } from '../state/decksStore';
import type { Route } from '../router/routes';
import type { MatchRecord } from '../data/types';

interface Props {
  onNav: (r: Route) => void;
  onReplay: (matchId: string) => void;
}

type ResultFilter = 'all' | 'win' | 'loss';

export function HistoryScreen({ onNav, onReplay }: Props) {
  const allHistory = useHistoryStore((s) => s.history);
  const decks = useDecksStore((s) => s.decks);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [deckFilter, setDeckFilter] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(allHistory[0]?.id ?? null);

  const filtered = useMemo(() => allHistory.filter((m) => {
    if (resultFilter === 'win' && !m.won) return false;
    if (resultFilter === 'loss' && m.won) return false;
    if (deckFilter && m.deckName !== deckFilter) return false;
    return true;
  }), [allHistory, resultFilter, deckFilter]);

  const wr = engineStub.history.winRate();
  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0];
  const deckPerf = computeDeckPerformance(allHistory);

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
      <AppTopBar page="history" onNav={(r) => onNav(r as Route)} />

      <HistorySubToolbar
        result={resultFilter} onResult={setResultFilter}
        deck={deckFilter} onDeck={setDeckFilter}
        deckOptions={decks.map((d) => d.name)}
        matched={filtered.length}
      />

      <div style={{
        position: 'absolute', left: 24, right: 24, top: 134, bottom: 16,
        display: 'grid', gridTemplateColumns: '320px 1fr 320px', gap: 14,
      }}>
        {/* LEFT: WinRate + DeckPerformance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          <WinRateSummary winRate={wr.rate} totalWins={wr.wins} total={wr.total} history={allHistory} />
          <DeckPerformance entries={deckPerf} />
        </div>

        {/* CENTER: list + detail panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          <HistoryList
            history={filtered}
            selectedId={selected?.id ?? ''}
            onSelect={setSelectedId}
            onReplay={onReplay}
          />
        </div>

        {/* RIGHT: detail + heatmap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {selected ? (
            <MatchDetail match={selected} onReplay={() => onReplay(selected.id)} />
          ) : (
            <EmptyState icon="history" title="記録なし" body="対戦すると履歴がここに表示されます。" cta="対戦準備 →" onCta={() => onNav('setup')} />
          )}
          <OpponentHeatmap />
        </div>
      </div>
    </div>
  );
}

// ---- SubToolbar ----

function HistorySubToolbar({ result, onResult, deck, onDeck, deckOptions, matched }: {
  result: ResultFilter; onResult: (r: ResultFilter) => void;
  deck: string; onDeck: (s: string) => void;
  deckOptions: string[]; matched: number;
}) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 64, height: 60,
      display: 'flex', alignItems: 'center', padding: '0 24px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
      borderBottom: `1px solid rgba(78,195,255,0.15)`, zIndex: 8,
    }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>HISTORY</span>
      <span style={{ fontFamily: T.fontSerif, fontSize: 20, fontWeight: 800, marginLeft: 12, letterSpacing: '0.06em' }}>対戦履歴</span>
      <div style={{ marginLeft: 20, display: 'flex', gap: 6 }}>
        <FilterChip label="すべて"  active={result === 'all'}  onClick={() => onResult('all')} />
        <FilterChip label="勝ち"    active={result === 'win'}  onClick={() => onResult('win')}  accent={T.green} />
        <FilterChip label="負け"    active={result === 'loss'} onClick={() => onResult('loss')} accent={T.red} />
      </div>
      <select value={deck} onChange={(e) => onDeck(e.target.value)} style={{
        marginLeft: 12, padding: '6px 10px',
        background: 'rgba(0,0,0,0.5)', color: T.textPrimary,
        border: `1px solid ${T.neonBlue}55`, borderRadius: 3,
        fontFamily: T.fontJp, fontSize: 12, cursor: 'pointer',
      }}>
        <option value="">すべてのデッキ</option>
        {deckOptions.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.18em' }}>
        {matched} 件
      </span>
    </div>
  );
}

function FilterChip({ label, active, onClick, accent = T.gold }: { label: string; active: boolean; onClick: () => void; accent?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px',
      background: active ? `${accent}22` : 'rgba(0,0,0,0.4)',
      border: `1px solid ${active ? accent : accent + '33'}`,
      color: active ? accent : T.textMuted,
      fontFamily: T.fontJp, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      borderRadius: 2, cursor: 'pointer',
    }}>
      {label}
    </button>
  );
}

// ---- Win rate summary ----

function WinRateSummary({ winRate, totalWins, total, history }: { winRate: number; totalWins: number; total: number; history: MatchRecord[] }) {
  // Sparkline: last 14 matches' rolling win rate
  const sparkData = useMemo(() => {
    const recent = history.slice(0, 14).reverse();
    return recent.length === 0
      ? Array.from({ length: 14 }, (_, i) => 50 + ((i * 13) % 30) - 15)
      : recent.map((_, i) => {
        const sub = recent.slice(0, i + 1);
        return Math.round((sub.filter((m) => m.won).length / sub.length) * 100);
      });
  }, [history]);
  const max = 100;
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>WIN RATE</span>
        <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>直近 14 戦</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>OVERALL</div>
          <div>
            <span style={{ fontFamily: T.fontSerif, fontSize: 38, fontWeight: 900, color: T.gold, lineHeight: 1 }}>{winRate}</span>
            <span style={{ fontFamily: T.fontMono, fontSize: 14, color: T.gold, marginLeft: 2 }}>%</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          <Trend label="勝" value={`${totalWins}`} highlight={T.green} />
          <Trend label="負" value={`${total - totalWins}`} highlight={T.red} />
          <Trend label="計" value={`${total}`} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48 }}>
        {sparkData.map((v, i) => (
          <div key={i} style={{
            flex: 1, height: `${Math.max(8, (v / max) * 100)}%`,
            background: `linear-gradient(180deg, ${v >= 60 ? T.gold : v >= 50 ? T.neonBlue : T.red}, ${shade(v >= 60 ? T.gold : v >= 50 ? T.neonBlue : T.red, -0.5)})`,
            opacity: i === sparkData.length - 1 ? 1 : 0.55,
            borderRadius: '1px 1px 0 0',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.1em', marginTop: 4 }}>
        <span>−14 戦</span>
        <span>最新</span>
      </div>
    </div>
  );
}

function Trend({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div style={{ lineHeight: 1.2 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.15em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 13, fontWeight: 800, color: highlight ?? T.textPrimary, marginTop: 1 }}>
        {value}
      </div>
    </div>
  );
}

// ---- Deck performance ----

function DeckPerformance({ entries }: { entries: { name: string; plays: number; wr: number; color: string }[] }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em', marginBottom: 10 }}>
        BY DECK
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 11, color: T.textMuted }}>まだデッキ別の記録がありません</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 22, background: d.color, borderRadius: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <div style={{ flex: 1, height: 3, background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${d.wr}%`, height: '100%', background: d.wr >= 60 ? T.green : d.wr >= 50 ? T.gold : T.red }} />
                  </div>
                  <span style={{ fontFamily: T.fontMono, fontSize: 10, fontWeight: 700, color: d.wr >= 60 ? T.green : d.wr >= 50 ? T.gold : T.red, width: 30, textAlign: 'right' }}>{d.wr}%</span>
                  <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, width: 30, textAlign: 'right' }}>{d.plays}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- History list ----

function HistoryList({ history, selectedId, onSelect, onReplay }: {
  history: MatchRecord[]; selectedId: string;
  onSelect: (id: string) => void; onReplay: (id: string) => void;
}) {
  return (
    <div style={{
      flex: 1,
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid rgba(78,195,255,0.15)` }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>MATCHES</span>
        <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.15em' }}>{history.length} 件</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {history.length === 0 ? (
          <EmptyState icon="history" title="記録なし" body="フィルタを変えるか、対戦を開始してください。" />
        ) : (
          history.map((m, i) => (
            <button key={m.id} onClick={() => onSelect(m.id)}
              className="meta-row"
              onDoubleClick={() => onReplay(m.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px',
                background: m.id === selectedId ? 'rgba(78,195,255,0.10)' : 'transparent',
                border: 'none', borderBottom: i < history.length - 1 ? `1px solid rgba(78,195,255,0.08)` : 'none',
                color: T.textPrimary, cursor: 'pointer',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  padding: '3px 7px', minWidth: 26, textAlign: 'center',
                  background: m.won ? `${T.green}33` : `${T.red}33`,
                  color: m.won ? T.green : T.red,
                  fontFamily: T.fontMono, fontWeight: 800, fontSize: 11,
                  border: `1px solid ${m.won ? T.green : T.red}55`, borderRadius: 2,
                }}>{m.won ? 'W' : 'L'}</div>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{m.deckName}</span>
                <span style={{ color: T.textMuted, fontSize: 11 }}>vs {m.oppDeckName ?? '—'}</span>
                <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted }}>
                  {new Date(m.recorded).toLocaleString('ja-JP')}
                </span>
              </div>
              <div style={{ marginTop: 3, fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.08em' }}>
                {m.turns}T · 自証拠 {m.evidGot}/{m.p1Target} · 敵 {m.evidLost}/{m.p2Target} · C{m.contacts} · H{m.hirameki}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ---- Match detail (right) ----

function MatchDetail({ match, onReplay }: { match: MatchRecord; onReplay: () => void }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.gold, letterSpacing: '0.28em' }}>MATCH</span>
        <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 9, color: T.textMuted }}>{match.id}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: match.won ? T.gold : T.textPrimary, marginBottom: 6 }}>
        {match.won ? '🏆 真相解明' : '🕯 迷宮入り'}
      </div>
      <DetailRow k="デッキ"     v={match.deckName} />
      <DetailRow k="vs"         v={match.oppDeckName ?? '—'} />
      <DetailRow k="モード"     v={match.mode === 'observe' ? '観察ルーム' : '単独捜査'} />
      <DetailRow k="ターン"     v={`${match.turns}`} />
      <DetailRow k="証拠 (自)"  v={`${match.evidGot}/${match.p1Target}`} />
      <DetailRow k="証拠 (敵)"  v={`${match.evidLost}/${match.p2Target}`} />
      <DetailRow k="コンタクト" v={`${match.contacts}`} />
      <DetailRow k="ヒラメキ"   v={`${match.hirameki}`} />
      <DetailRow k="ミスリード" v={`${match.misread}`} />
      <div style={{ marginTop: 10 }}>
        <SetupButton label="盤面を見直す" sub="REPLAY" onClick={onReplay} />
      </div>
    </div>
  );
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '3px 0', borderBottom: '1px dashed rgba(78,195,255,0.12)',
      fontSize: 11,
    }}>
      <span style={{ color: T.textMuted, fontFamily: T.fontMono, letterSpacing: '0.16em' }}>{k}</span>
      <span style={{ color: T.textPrimary, fontWeight: 700 }}>{v}</span>
    </div>
  );
}

// ---- Opponent heatmap ----

function OpponentHeatmap() {
  // 静的サンプル (実 history からの集計は将来 phase)
  const ourDecks = ['少年探偵団', '警察', '怪盗キッド'];
  const oppDecks = ['少年', '警察', '怪盗', '組織', '上級AI'];
  const grid = [
    [62, 78, 55, 40, 48],
    [70, 60, 50, 45, 40],
    [55, 50, 30, 25, 35],
  ];
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>MATCHUPS</span>
        <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.15em' }}>
          自(縦) × 相手(横)
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(${oppDecks.length}, 1fr)`, gap: 3, marginBottom: 3 }}>
        <div />
        {oppDecks.map((o) => (
          <div key={o} style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, textAlign: 'center', letterSpacing: '0.1em' }}>{o}</div>
        ))}
      </div>
      {ourDecks.map((our, ri) => (
        <div key={our} style={{ display: 'grid', gridTemplateColumns: `52px repeat(${oppDecks.length}, 1fr)`, gap: 3, marginBottom: 3 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textSecondary, fontWeight: 700, display: 'flex', alignItems: 'center' }}>{our}</div>
          {(grid[ri] ?? []).map((v, ci) => {
            const hue = v >= 60 ? T.green : v >= 50 ? T.gold : v >= 40 ? T.neonBlue : T.red;
            return (
              <div key={ci} style={{
                padding: '6px 0',
                background: hue, opacity: 0.4 + (v / 200),
                border: `1px solid ${hue}55`, borderRadius: 2,
                fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
                color: hue === T.gold ? '#1a1208' : '#fff', textAlign: 'center',
              }}>{v}%</div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---- helpers ----

function computeDeckPerformance(history: MatchRecord[]): { name: string; plays: number; wr: number; color: string }[] {
  const by = new Map<string, { wins: number; total: number }>();
  for (const m of history) {
    const cur = by.get(m.deckName) ?? { wins: 0, total: 0 };
    cur.total += 1;
    if (m.won) cur.wins += 1;
    by.set(m.deckName, cur);
  }
  const palette = [T.blue, T.yellow, T.green, T.purple, T.red];
  return [...by.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([name, s], i) => ({
      name, plays: s.total,
      wr: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0,
      color: palette[i % palette.length]!,
    }));
}
