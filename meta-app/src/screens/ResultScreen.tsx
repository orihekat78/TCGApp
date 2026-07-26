// spec: .claude/specs/meta-ui/06-screens-play-flow.md + 10-integration-with-src.md + 12-screens-rebuild.md
// 原典: design-mockups_v2/08-result.jsx
// Phase 11-E ロジック (gameState 直読 + 自動記録 + クリア) は保持
// Phase 13-A: UI 全面 rebuild (Backdrop + Verdict + MVPShowcase + Stats grid + PROGRESS + Actions)

import { useEffect, useMemo, useRef } from 'react';
import { T, shade } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { SetupButton, SetupReadyButton } from '../shared/Button';
import { EmptyState } from '../shared/EmptyState';
import { MetaCard } from '../shared/MetaCard';
import { useGameStateStore } from '@/ui/state/store';
import { engine } from '@/engine';
import { useHistoryStore } from '../state/historyStore';
import { useMetaStore } from '../state/metaStore';
import { TUTORIAL_CHAPTERS } from './TutorialScreen';
import { CARD_POOL } from '../data/cardPool';
import type { Route } from '../router/routes';
import type { CardDef, MatchRecord } from '../data/types';

interface Props {
  onNav: (r: Route) => void;
  onNext: () => void;
  onRematch: () => void;
}

export function ResultScreen({ onNav, onNext, onRematch }: Props) {
  const gameState = useGameStateStore((s) => s.gameState);
  const history = useHistoryStore((s) => s.history);
  const recordedRef = useRef(false);
  const recordHistory = useHistoryStore((s) => s.record);

  // Phase 11-E: 終局確定で historyStore に 1 件記録 (StrictMode dedup)
  // Phase 15-E: 練習試合 (_pendingPracticeChapter 設定済) の場合、勝利で該当章を自動クリア
  useEffect(() => {
    if (!gameState || recordedRef.current) return;
    const result = engine.read.game.result(gameState);
    if (!result) return;
    recordedRef.current = true;
    recordHistory(buildMatchRecord(gameState, result));
    // Phase 15-E: 練習試合連携 (consume してクリア)
    const practiceChapter = useMetaStore.getState().consumePendingPractice();
    if (practiceChapter !== null && result.winner === 'self') {
      const ch = TUTORIAL_CHAPTERS.find((c) => c.num === practiceChapter);
      if (ch) {
        const stepIds = ch.steps.map((s) => s.id);
        useMetaStore.getState().markChapterStepsCleared(stepIds);
      }
    }
  }, [gameState, recordHistory]);

  const stats = useMemo(() => gameState ? computeStats(gameState) : null, [gameState]);

  if (!gameState || !stats) {
    return (
      <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
        <AppTopBar page="result" onNav={(r) => onNav(r as Route)} />
        <EmptyState icon="history" title="対戦結果がありません"
          body="SETUP から対戦を開始してください。"
          cta="対戦準備 →" onCta={() => onNav('setup')} />
      </div>
    );
  }

  const won = stats.winner === 'self';
  const mvpCard = pickMvpCard(gameState);
  const deckStats = computeDeckStats(history, gameState);

  const handleClear = (next: () => void) => {
    // Phase 11-E: 次対戦に備えて state クリア (これらの呼出は壊さない)
    useGameStateStore.setState({ gameState: null });
    useGameStateStore.getState().setSpectatorMode(false);
    next();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
      <ResultBackdrop won={won} />
      <AppTopBar page="result" onNav={(r) => handleClear(() => onNav(r as Route))} />
      <ResultVerdict won={won} reason={stats.reason} />
      <MVPShowcase mvp={mvpCard} stats={stats} />
      <ResultStats won={won} stats={stats} deckStats={deckStats} />
      <ResultActions
        onReplay={() => handleClear(() => onNav('replay'))}
        onReview={() => handleClear(() => onNav('replay'))}
        onRematch={() => handleClear(onRematch)}
        onNext={() => handleClear(onNext)}
        onHome={() => handleClear(() => onNav('home'))}
      />
    </div>
  );
}

// ---- Backdrop ----

function ResultBackdrop({ won }: { won: boolean }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 1600, height: 1600, marginLeft: -800, marginTop: -800,
        borderRadius: '50%',
        background: won
          ? `radial-gradient(circle, ${T.gold}22 0%, ${T.gold}08 25%, transparent 60%)`
          : `radial-gradient(circle, rgba(120,150,180,0.18) 0%, transparent 60%)`,
        filter: 'blur(20px)',
      }} />
      {won && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }} viewBox="0 0 1920 1080" preserveAspectRatio="none">
          {Array.from({ length: 14 }, (_, i) => {
            const angle = (i / 14) * Math.PI * 2;
            const x = 960 + Math.cos(angle) * 1400;
            const y = 380 + Math.sin(angle) * 1400;
            return <line key={i} x1={960} y1={380} x2={x} y2={y} stroke={T.gold} strokeWidth="3" />;
          })}
        </svg>
      )}
      {Array.from({ length: 40 }, (_, i) => {
        const x = (i * 137) % 1920;
        const y = ((i * 47) % 900) + 80;
        return <div key={i} style={{
          position: 'absolute', left: x, top: y,
          width: 3, height: 3, borderRadius: '50%',
          background: won ? T.gold : T.textMuted,
          opacity: (i % 3) * 0.15 + 0.2,
          boxShadow: won ? `0 0 8px ${T.gold}` : 'none',
        }} />;
      })}
    </div>
  );
}

// ---- Verdict (large banner) ----

function ResultVerdict({ won, reason }: { won: boolean; reason: string }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 80, textAlign: 'center', zIndex: 5 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.gold, letterSpacing: '0.5em', marginBottom: 4 }}>
        {won ? 'CASE SOLVED · VERDICT' : 'UNSOLVED · VERDICT'}
      </div>
      <div style={{
        fontFamily: T.fontSerif, fontSize: 88, fontWeight: 900,
        color: won ? T.gold : '#8aa8c8', letterSpacing: '0.3em',
        textShadow: won
          ? `0 0 40px ${T.gold}88, 6px 6px 0 rgba(140,90,0,0.55), 0 4px 12px rgba(0,0,0,0.7)`
          : `0 4px 14px rgba(0,0,0,0.95)`,
        WebkitTextStroke: won ? '2px rgba(140,90,0,0.45)' : 'none',
        marginRight: '-0.3em',
      }}>
        {won ? '真 相 解 明' : '迷 宮 入 り'}
      </div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 16,
        color: won ? T.neonYellow : 'rgba(140,170,200,0.85)',
        letterSpacing: '0.6em', marginTop: 6,
      }}>
        {won ? 'VICTORY' : 'DEFEAT'}
      </div>
      <div style={{ fontFamily: T.fontJp, fontSize: 12, color: T.textMuted, letterSpacing: '0.18em', marginTop: 6 }}>
        {reason}
      </div>
    </div>
  );
}

// ---- MVP Showcase ----

function MVPShowcase({ mvp, stats }: { mvp: CardDef | undefined; stats: ResultStats }) {
  if (!mvp) {
    return (
      <div style={{ position: 'absolute', left: 80, top: 380, width: 520, zIndex: 5, textAlign: 'center' }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.textMuted, letterSpacing: '0.28em' }}>
          MVPなし
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', left: 80, top: 380, width: 520, zIndex: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${T.gold})` }} />
        <div style={{
          padding: '4px 14px', background: T.gold, color: '#1a1208',
          fontFamily: T.fontMono, fontSize: 12, fontWeight: 800,
          letterSpacing: '0.4em', borderRadius: 2,
        }}>
          ⭐ MVP
        </div>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(-90deg, transparent, ${T.gold})` }} />
      </div>
      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        <div style={{ filter: `drop-shadow(0 0 24px ${T.gold}88) drop-shadow(0 16px 30px rgba(0,0,0,0.9))` }}>
          <MetaCard card={mvp} w={200} hoverable={false} />
        </div>
        <div style={{ flex: 1, lineHeight: 1.4 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.18em' }}>{mvp.num}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.gold, letterSpacing: '0.04em', marginTop: 2 }}>{mvp.name}</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textSecondary, letterSpacing: '0.1em', marginBottom: 12 }}>
            {(mvp.features ?? []).join(' / ') || '—'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ContribRow label="貢献 AP"   value={`${(mvp.ap ?? 0).toLocaleString()}`} color={T.apColor} bar={Math.min(100, ((mvp.ap ?? 0) / 9000) * 100)} />
            <ContribRow label="ターン数" value={`${stats.turns}`}              color={T.gold}    bar={Math.min(100, stats.turns * 8)} />
            <ContribRow label="自証拠"   value={`${stats.selfEvid}/${stats.selfTarget}`} color={T.green}   bar={(stats.selfEvid / stats.selfTarget) * 100} />
            <ContribRow label="敵証拠"   value={`${stats.oppEvid}/${stats.oppTarget}`}   color={T.red}     bar={(stats.oppEvid / stats.oppTarget) * 100} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContribRow({ label, value, color, bar }: { label: string; value: string; color: string; bar: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 90, fontSize: 11, color: T.textSecondary, fontFamily: T.fontJp }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden', border: `1px solid ${color}33` }}>
        <div style={{
          width: `${Math.max(0, Math.min(100, bar))}%`, height: '100%',
          background: `linear-gradient(90deg, ${color}, ${shade(color, 0.2)})`,
          boxShadow: `0 0 8px ${color}55`,
        }} />
      </div>
      <div style={{ minWidth: 70, textAlign: 'right', fontFamily: T.fontMono, fontSize: 13, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ---- Match summary stats (right panel) ----

function ResultStats({ won, stats, deckStats }: { won: boolean; stats: ResultStats; deckStats: { before: string; after: string } }) {
  return (
    <div style={{
      position: 'absolute', right: 60, top: 380, width: 540,
      padding: '20px 22px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
      boxShadow: `0 8px 24px rgba(0,0,0,0.5)`,
      zIndex: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 14 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.28em' }}>MATCH SUMMARY</span>
        <span style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em' }}>
          {stats.reason}
        </span>
      </div>

      <div style={{ display: 'flex', marginBottom: 16, gap: 10 }}>
        <ScoreSide label="P1 · あなた" value={won ? '勝利' : '敗北'} sub={`証拠 ${stats.selfEvid} / ${stats.selfTarget}`} accent={T.green} winner={won} />
        <div style={{ display: 'flex', alignItems: 'center', fontFamily: T.fontSerif, fontSize: 26, fontWeight: 900, color: T.gold, padding: '0 8px' }}>VS</div>
        <ScoreSide label="P2 · CPU" value={won ? '敗北' : '勝利'} sub={`証拠 ${stats.oppEvid} / ${stats.oppTarget}`} accent={T.purple} winner={!won} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCompare label="ターン数"     v1={`${stats.turns}`}  v2={`${stats.turns}`} />
        <StatCompare label="自リフレッシュ" v1={`${stats.selfRefresh}`} v2={`${stats.oppRefresh}`} highlight={stats.selfRefresh < stats.oppRefresh ? 'v1' : undefined} />
        <StatCompare label="自証拠"        v1={`${stats.selfEvid}`} v2={`${stats.oppEvid}`} highlight={won ? 'v1' : 'v2'} />
        <StatCompare label="目標証拠"      v1={`${stats.selfTarget}`} v2={`${stats.oppTarget}`} />
        <StatCompare label="痕跡 (自)"     v1={stats.selfScratch} v2="—" highlight={stats.selfScratch === '発見済' ? 'v1' : undefined} />
        <StatCompare label="解決編到達"    v1={won ? `T${stats.turns}` : '—'} v2={!won ? `T${stats.turns}` : '—'} highlight={won ? 'v1' : 'v2'} />
      </div>

      <div style={{
        marginTop: 14, padding: '10px 12px',
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${T.gold}33`, borderRadius: 3,
      }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.gold, letterSpacing: '0.2em', marginBottom: 6 }}>
          PROGRESS · この対戦の影響
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ProgressLine label="このデッキ戦績" before={deckStats.before} after={deckStats.after} />
          <ProgressLine label="痕跡"           before={stats.selfScratch === '発見済' ? '発見済' : '未発見'} after={stats.selfScratch} tier={stats.selfScratch === '発見済'} />
        </div>
      </div>
    </div>
  );
}

function ScoreSide({ label, value, sub, accent, winner }: { label: string; value: string; sub: string; accent: string; winner: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '10px 12px',
      background: winner ? `linear-gradient(180deg, ${accent}33, ${accent}11)` : 'rgba(0,0,0,0.35)',
      border: `1.5px solid ${winner ? accent : `${accent}33`}`, borderRadius: 3,
      position: 'relative',
    }}>
      {winner && (
        <div style={{
          position: 'absolute', right: 8, top: 8,
          padding: '1px 6px', background: T.gold, color: '#1a1208',
          fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
          letterSpacing: '0.18em', borderRadius: 1,
        }}>WIN</div>
      )}
      <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.18em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: T.fontSerif, fontSize: 20, fontWeight: 800, color: winner ? accent : T.textPrimary, letterSpacing: '0.06em' }}>{value}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function StatCompare({ label, v1, v2, highlight }: { label: string; v1: string; v2: string; highlight?: 'v1' | 'v2' }) {
  const h1 = highlight === 'v1';
  const h2 = highlight === 'v2';
  return (
    <div style={{
      padding: '6px 10px',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid rgba(78,195,255,0.15)`, borderRadius: 2,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <div style={{ flex: 1, fontSize: 11, color: T.textMuted }}>{label}</div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 13, fontWeight: 800,
        color: h1 ? T.gold : T.textSecondary,
        textShadow: h1 ? `0 0 6px ${T.gold}55` : 'none',
        width: 60, textAlign: 'right',
      }}>{v1}</div>
      <div style={{ width: 8, textAlign: 'center', color: T.textDisabled, fontFamily: T.fontMono, fontSize: 11 }}>·</div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 13, fontWeight: 800,
        color: h2 ? T.gold : T.textMuted,
        width: 60, textAlign: 'right',
      }}>{v2}</div>
    </div>
  );
}

function ProgressLine({ label, before, after, tier }: { label: string; before: string; after: string; tier?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
      <div style={{ width: 130, color: T.textMuted, fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.12em' }}>{label}</div>
      <div style={{ color: T.textDisabled }}>{before}</div>
      <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
        <path d="M0 5 L10 5 L7 2 M10 5 L7 8" stroke={T.gold} strokeWidth="1.6" fill="none" />
      </svg>
      <div style={{ color: tier ? T.gold : T.textPrimary, fontWeight: 700 }}>{after}</div>
      {tier && (
        <div style={{
          padding: '1px 5px', background: T.gold, color: '#1a1208',
          fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
          letterSpacing: '0.15em', borderRadius: 1, marginLeft: 4,
        }}>RANK UP</div>
      )}
    </div>
  );
}

// ---- Actions footer ----

function ResultActions({ onReplay, onReview, onRematch, onNext, onHome }: {
  onReplay: () => void; onReview: () => void; onRematch: () => void; onNext: () => void; onHome: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 56,
      display: 'flex', justifyContent: 'center', gap: 12, zIndex: 6,
    }}>
      <SetupButton label="リプレイ保存"    sub="REPLAY" onClick={onReplay} />
      <SetupButton label="盤面を見直す"    sub="REVIEW" onClick={onReview} />
      <SetupButton label="このデッキで再戦" sub="REMATCH" onClick={onRematch} />
      <SetupReadyButton label="次の対戦" sub="NEXT MATCH" onClick={onNext} />
      <SetupButton label="ホームへ"        sub="HOME" onClick={onHome} />
    </div>
  );
}

// ---- helpers ----

interface ResultStats {
  winner: 'self' | 'opp';
  reason: string;
  turns: number;
  selfEvid: number;
  oppEvid: number;
  selfTarget: 7 | 6;
  oppTarget: 7 | 6;
  selfRefresh: number;
  oppRefresh: number;
  selfScratch: '未発見' | '発見済';
}

const REASON_LABELS: Record<'evidence' | 'deck-out' | 'concede', string> = {
  evidence: '必要証拠数達成',
  'deck-out': 'リフレッシュ不可',
  concede: '投了',
};

function computeStats(gs: import('@/engine/types/game-state').GameState): ResultStats | null {
  const result = engine.read.game.result(gs);
  if (!result) return null;
  // エンジンが確定させた必要証拠数 (先攻7/後攻6) を直接参照する。
  // ターン偶奇からの再構成は終局のターン状態によって崩れうるため使わない (rules/01,04)。
  const selfTarget = engine.read.player.requiredEvidence(gs, 'self') as 7 | 6;
  const oppTarget = engine.read.player.requiredEvidence(gs, 'opp') as 7 | 6;
  return {
    winner: result.winner,
    reason: REASON_LABELS[result.reason],
    turns: gs.turn.number,
    selfEvid: gs.players.self.evidence.length,
    oppEvid: gs.players.opp.evidence.length,
    selfTarget, oppTarget,
    selfRefresh: gs.refreshCount.self,
    oppRefresh: gs.refreshCount.opp,
    selfScratch: gs.scratchTrace.self,
  };
}

function pickMvpCard(gs: import('@/engine/types/game-state').GameState): CardDef | undefined {
  const result = engine.read.game.result(gs);
  if (!result) return undefined;
  const winner = result.winner;
  const player = gs.players[winner];
  const ownedCardIds = new Set<string>([
    player.partner.cardId,
    player.partnerAreaMR?.cardId ?? '',
    ...(player.partnerAreaCards ?? []),
    player.case.cardId,
    ...player.scene.map((entry) => entry.cardId),
    ...player.scene.flatMap((entry) => entry.setCards.map((setCard) => setCard.cardId)),
    ...player.hand,
    ...player.deck,
    ...player.evidence.map((entry) => entry.cardId),
    ...player.remove,
    ...player.file.map((entry) => entry.cardId),
  ]);
  const candidateIds: string[] = player.scene.map((entry) => entry.cardId);
  const participationActions = new Set(['handUseCard', 'effect:sceneEnter', 'contact-cutin']);
  for (const entry of gs.log) {
    if (entry.player !== winner || !participationActions.has(entry.action) || !entry.target) continue;
    if (ownedCardIds.has(entry.target)) candidateIds.push(entry.target);
  }

  // 勝者の最終盤面、または勝者側の構造化ログに実参加が残るキャラから選ぶ。
  // 他sideだけに属するカード、単なる全カードカタログの先頭へは fallback しない。
  let best: CardDef | undefined;
  for (const cardId of candidateIds) {
    const card = CARD_POOL.find((candidate) => candidate.num === cardId && candidate.type === 'character');
    if (!card) continue;
    if (!best || (card.ap ?? 0) > (best.ap ?? 0)) best = card;
  }
  return best;
}

function computeDeckStats(history: MatchRecord[], gs: import('@/engine/types/game-state').GameState): { before: string; after: string } {
  // 簡易: 今までの履歴 (この対戦含まず) と含む を比較表示
  const _ = gs;
  void _;
  const wins = history.filter((m) => m.won).length;
  const total = history.length;
  return {
    before: `${total} 戦 (W${wins}/L${total - wins})`,
    after: `${total + 1} 戦 進行中`,
  };
}

function buildMatchRecord(
  gs: import('@/engine/types/game-state').GameState,
  result: NonNullable<ReturnType<typeof engine.read.game.result>>,
): MatchRecord {
  const stats = computeStats(gs);
  // Phase 14-C: engine.log から contacts/hirameki/misread を集計
  const counters = countLogActions(gs.log);
  // Phase 18: SetupScreen が控えた対戦種別・デッキ名を履歴に反映 (consume して次戦への持ち越しを防ぐ)
  const matchMeta = useMetaStore.getState().consumeMatchMeta();
  return {
    id: `m-${Date.now()}`,
    recorded: Date.now(),
    won: result.winner === 'self',
    mode: matchMeta?.mode ?? 'solo',
    deckName: matchMeta?.selfDeckName ?? '実機対戦',
    oppDeckName: matchMeta?.oppDeckName,
    turns: gs.turn.number,
    duration: 0,
    evidGot: gs.players.self.evidence.length,
    evidLost: gs.players.opp.evidence.length,
    contacts: counters.contacts,
    hirameki: counters.hirameki,
    misread:  counters.misread,
    p1Target: stats?.selfTarget ?? 7,
    p2Target: stats?.oppTarget ?? 6,
  };
}

/** gs.log から戦闘イベント数を集計 (Phase 14-C) */
function countLogActions(log: import('@/engine/types/game-state').LogEntry[]): { contacts: number; hirameki: number; misread: number } {
  let contacts = 0, hirameki = 0, misread = 0;
  for (const e of log) {
    const a = e.action ?? '';
    if (/^contact[-:]judge/.test(a)) contacts++;
    if (/hirameki/i.test(a)) hirameki++;
    if (/misread/i.test(a)) misread++;
    // result field にも該当ワードがあれば加算
    const r = e.result ?? '';
    if (/hirameki/i.test(r) && !/hirameki/i.test(a)) hirameki++;
    if (/misread/i.test(r) && !/misread/i.test(a)) misread++;
  }
  return { contacts, hirameki, misread };
}
