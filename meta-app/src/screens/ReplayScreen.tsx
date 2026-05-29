// spec: .claude/specs/meta-ui/08-screens-reference.md + 12-screens-rebuild.md
// 原典: design-mockups_v2/09-placeholders.jsx (ReplayPlaceholder)
// Phase 13-H: BoardZone snapshot + Scrubber + Action log

import { useState } from 'react';
import { T } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { SetupButton } from '../shared/Button';
import { EmptyState } from '../shared/EmptyState';
import { useHistoryStore } from '../state/historyStore';
import type { Route } from '../router/routes';
import type { MatchRecord } from '../data/types';

interface Props {
  matchId?: string;
  onNav: (r: Route) => void;
}

export function ReplayScreen({ matchId, onNav }: Props) {
  const match = useHistoryStore((s) => matchId ? s.byId(matchId) : s.history[0]);
  const [turn, setTurn] = useState(1);

  if (!match) {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <AppTopBar page="replay" onNav={(r) => onNav(r as Route)} />
        <EmptyState icon="search" title="リプレイ対象がありません"
          body="HISTORY から対戦を選択してください。" cta="履歴 →" onCta={() => onNav('history')} />
      </div>
    );
  }

  const totalTurns = match.turns;
  const progress = totalTurns > 0 ? turn / totalTurns : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
      <AppTopBar page="replay" onNav={(r) => onNav(r as Route)} />

      <div style={{ position: 'absolute', left: 0, right: 0, top: 86, textAlign: 'center', zIndex: 5 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.gold, letterSpacing: '0.4em' }}>
          REPLAY · {match.id}
        </div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 26, fontWeight: 800, letterSpacing: '0.1em', marginTop: 4 }}>
          リプレイ詳細
        </div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
          {match.deckName} vs {match.oppDeckName ?? '—'} · {totalTurns} ターン
        </div>
      </div>

      {/* Mini board snapshot */}
      <div style={{
        position: 'absolute', left: '50%', top: 180, transform: 'translateX(-50%)',
        width: '88%', maxWidth: 1100, height: 360,
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${T.gold}33`, borderRadius: 4, padding: 20,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        zIndex: 4,
      }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.gold, letterSpacing: '0.2em' }}>
          TURN {turn} / {totalTurns} · MAIN PHASE (静的スナップショット)
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
          <BoardZone label="OPP · CPU" labelColor={T.purple} border={T.purple} cards={2} cardColor={T.purple} />
          <BoardZone label="YOU" labelColor={T.green} border={T.green} cards={3} cardColor={T.blue} partner />
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.12em', textAlign: 'right' }}>
          ※ 実盤面再生は Phase 14+ 予定 (engine.event.applyUntil 利用)
        </div>
      </div>

      {/* Scrubber + log */}
      <div style={{
        position: 'absolute', left: '50%', bottom: 110, transform: 'translateX(-50%)',
        width: '88%', maxWidth: 1100,
        background: 'rgba(0,0,0,0.6)',
        border: `1px solid ${T.gold}55`, borderRadius: 3, padding: '14px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <PlayerCtrl icon="⏮" onClick={() => setTurn(1)} />
            <PlayerCtrl icon="◀" onClick={() => setTurn(Math.max(1, turn - 1))} />
            <PlayerCtrl icon="▶" big onClick={() => setTurn(Math.min(totalTurns, turn + 1))} />
            <PlayerCtrl icon="⏭" onClick={() => setTurn(totalTurns)} />
          </div>
          <div style={{ fontFamily: T.fontMono, fontSize: 13, color: T.gold, fontWeight: 800, minWidth: 64 }}>
            T{turn} / T{totalTurns}
          </div>
          <div style={{
            flex: 1, height: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 4,
            position: 'relative', border: `1px solid ${T.gold}33`,
          }}>
            <div style={{
              width: `${progress * 100}%`, height: '100%',
              background: `linear-gradient(90deg, ${T.gold}, ${T.neonYellow})`, borderRadius: 3,
            }} />
            <div style={{
              position: 'absolute', left: `${progress * 100}%`, top: '50%',
              width: 14, height: 14, background: '#fff', border: `2px solid ${T.gold}`,
              borderRadius: '50%', transform: 'translate(-50%, -50%)',
              boxShadow: `0 0 8px ${T.gold}`,
            }} />
          </div>
        </div>
        <ActionLog match={match} turn={turn} />
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 32,
        display: 'flex', justifyContent: 'center', gap: 10, zIndex: 10,
      }}>
        <SetupButton label="履歴へ戻る" sub="HISTORY · Esc" onClick={() => onNav('history')} />
        <SetupButton label="ホーム" sub="HOME · H" onClick={() => onNav('home')} />
      </div>
    </div>
  );
}

// ---- Board zone (static mock) ----

function BoardZone({ label, labelColor, border, cards, cardColor, partner }: {
  label: string; labelColor: string; border: string; cards: number; cardColor: string; partner?: boolean;
}) {
  return (
    <div style={{
      padding: '10px 14px',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${border}55`, borderRadius: 3,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
        color: labelColor, letterSpacing: '0.2em',
        padding: '4px 10px',
        background: `${labelColor}22`, border: `1px solid ${labelColor}66`, borderRadius: 2,
      }}>{label}</div>
      {partner && (
        <div style={{
          width: 50, height: 70, background: `linear-gradient(180deg, ${T.gold}, ${T.goldDim})`,
          border: `2px solid ${T.gold}`, borderRadius: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fontSerif, fontSize: 18, fontWeight: 900, color: '#1a1208',
          boxShadow: `0 0 12px ${T.gold}66`,
        }}>P</div>
      )}
      <div style={{ flex: 1, display: 'flex', gap: 8 }}>
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} style={{
            width: 50, height: 70,
            background: `linear-gradient(180deg, ${cardColor}aa, ${cardColor}55)`,
            border: `1.5px solid ${cardColor}`, borderRadius: 3,
            boxShadow: `0 0 8px ${cardColor}33`,
          }} />
        ))}
      </div>
      <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em' }}>
        現場 {cards} 枚
      </div>
    </div>
  );
}

// ---- Player ctrl ----

function PlayerCtrl({ icon, big, onClick }: { icon: string; big?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: big ? 36 : 28, height: big ? 36 : 28,
      background: big ? T.gold : 'rgba(0,0,0,0.4)',
      border: `1px solid ${T.gold}66`, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: big ? 14 : 11, color: big ? '#1a1208' : T.gold, cursor: 'pointer',
    }}>{icon}</button>
  );
}

// ---- Action log ----

function ActionLog({ match, turn }: { match: MatchRecord; turn: number }) {
  // 静的な行データを turn に応じて生成 (実 engine.log 引きは Phase 14+)
  const lines = [
    { color: T.green,    text: `[T${turn} · 自分] ターン開始 → オートフェイズ` },
    { color: T.textMuted, text: `[T${turn} · 自分] 1 ドロー、FILE +2 枚` },
    { color: T.gold,     text: `[T${turn} · 自分] アクション宣言 → コンタクト判定` },
    { color: T.neonBlue, text: `[T${turn} · 自分] 証拠 ${Math.min(turn, match.evidGot)}/${match.p1Target} 達成中` },
  ];
  return (
    <div style={{
      marginTop: 10, padding: '8px 10px',
      background: 'rgba(0,0,0,0.5)',
      border: `1px solid rgba(78,195,255,0.2)`, borderRadius: 2,
      fontFamily: T.fontMono, fontSize: 11, lineHeight: 1.65,
      maxHeight: 88, overflow: 'auto',
    }}>
      {lines.map((l, i) => (
        <div key={i} style={{ color: l.color }}>{l.text}</div>
      ))}
    </div>
  );
}
