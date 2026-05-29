// 08-result.jsx
// 対戦結果画面 — 勝敗 + MVP カード + 統計サマリ + 次へ
// 1920×1080. Two states wrapped by `won` flag — default victory.

function ResultScreen({ won }) {
  // Prefer live match data from engine stub; fall back to demo values
  const m = window.__currentMatch;
  const wonFinal = m ? m.won : (won !== undefined ? won : true);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: T.fontJp, color: T.textPrimary }}>
      <MetaBg theme={wonFinal ? 'noir' : 'noir'} scene="result">
        <ResultBackdrop won={wonFinal} />

        {/* Big verdict text */}
        <ResultVerdict won={wonFinal} />

        {/* Center MVP showcase */}
        <MVPShowcase won={wonFinal} match={m} />

        {/* Right side: stats panel */}
        <ResultStats won={wonFinal} match={m} />

        {/* Bottom action row */}
        <ResultActions won={wonFinal} />

        {/* Top-left meta */}
        <div style={{
          position: 'absolute', left: 36, top: 28,
          fontFamily: T.fontMono, fontSize: 11, color: T.textMuted,
          letterSpacing: '0.18em', zIndex: 5,
        }}>
          MATCH #{m?.id?.slice?.(-4) || '1248'} · {m?.date || '2026.05.20 15:42'} · vs CPU {m?.difficulty || '標準'}
        </div>
        <div style={{
          position: 'absolute', right: 36, top: 28,
          fontFamily: T.fontMono, fontSize: 11, color: T.textMuted,
          letterSpacing: '0.18em', zIndex: 5,
        }}>
          DURATION {m?.dur || '12:34'} · {m?.turns || 9} TURNS
        </div>
      </MetaBg>
    </div>
  );
}

function ResultBackdrop({ won }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Radial bloom */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 1600, height: 1600, marginLeft: -800, marginTop: -800,
        borderRadius: '50%',
        background: won
          ? `radial-gradient(circle, ${T.gold}22 0%, ${T.gold}08 25%, transparent 60%)`
          : `radial-gradient(circle, rgba(120,150,180,0.18) 0%, transparent 60%)`,
        filter: 'blur(20px)',
      }} />
      {/* Light rays (only for victory) */}
      {won && (
        <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0.18 }} viewBox="0 0 1920 1080" preserveAspectRatio="none">
          {Array.from({ length: 14 }, (_, i) => {
            const angle = (i / 14) * Math.PI * 2;
            const cx = 960, cy = 380;
            const x = cx + Math.cos(angle) * 1400;
            const y = cy + Math.sin(angle) * 1400;
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={T.gold} strokeWidth="3" />;
          })}
        </svg>
      )}
      {/* Particle dots */}
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

function ResultVerdict({ won }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 80,
      textAlign: 'center', zIndex: 5,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.gold, letterSpacing: '0.5em', marginBottom: 4 }}>
        {won ? 'CASE SOLVED · CHAPTER 03' : 'UNSOLVED · CHAPTER 03'}
      </div>
      <div style={{
        fontFamily: T.fontSerif,
        fontSize: 100, fontWeight: 900,
        color: won ? T.gold : '#8aa8c8',
        letterSpacing: '0.3em',
        textShadow: won
          ? `0 0 40px ${T.gold}88, 6px 6px 0 rgba(140,90,0,0.55), 0 4px 12px rgba(0,0,0,0.7)`
          : `0 4px 14px rgba(0,0,0,0.95)`,
        WebkitTextStroke: won ? '2px rgba(140,90,0,0.45)' : 'none',
        marginRight: '-0.3em',
      }}>
        {won ? '真 相 解 明' : '迷 宮 入 り'}
      </div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 18,
        color: won ? T.neonYellow : 'rgba(140,170,200,0.85)',
        letterSpacing: '0.6em',
        marginTop: 4,
      }}>
        {won ? 'VICTORY' : 'DEFEAT'}
      </div>
    </div>
  );
}

function MVPShowcase({ won, match }) {
  const mvpNum = match?.mvpNum || 'D08005';
  const mvp = window.CARD_POOL.find((c) => c.num === mvpNum) || window.CARD_POOL.find((c) => c.num === 'D08005');
  return (
    <div style={{
      position: 'absolute', left: 120, top: 400,
      width: 480, zIndex: 5,
    }}>
      {/* "MVP" badge above */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
      }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${T.gold})` }} />
        <div style={{
          padding: '4px 14px',
          background: T.gold, color: '#1a1208',
          fontFamily: T.fontMono, fontSize: 12, fontWeight: 800,
          letterSpacing: '0.4em', borderRadius: 2,
        }}>
          ⭐ MVP
        </div>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(-90deg, transparent, ${T.gold})` }} />
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        {/* Big card */}
        <div style={{ filter: `drop-shadow(0 0 24px ${T.gold}88) drop-shadow(0 16px 30px rgba(0,0,0,0.9))` }}>
          <MetaCard card={mvp} w={230} hoverable={false} />
        </div>
        {/* MVP stats */}
        <div style={{ flex: 1, lineHeight: 1.4 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.18em' }}>{mvp.num}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.gold, letterSpacing: '0.04em', marginTop: 2 }}>{mvp.name}</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textSecondary, letterSpacing: '0.1em', marginBottom: 16 }}>
            {mvp.features.join(' / ')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ContribRow label="貢献 AP" value="14,000" color={T.red} bar={88} />
            <ContribRow label="撃破数" value="3" color={T.gold} bar={72} />
            <ContribRow label="ヒラメキ発動" value="2" color={T.neonBlue} bar={60} />
            <ContribRow label="場滞在" value="6 ターン" color={T.green} bar={70} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContribRow({ label, value, color, bar }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 100, fontSize: 12, color: T.textSecondary, fontFamily: T.fontJp }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden', border: `1px solid ${color}33` }}>
        <div style={{ width: `${bar}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${shade(color, 0.2)})`, boxShadow: `0 0 8px ${color}55` }} />
      </div>
      <div style={{ minWidth: 70, textAlign: 'right', fontFamily: T.fontMono, fontSize: 14, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function ResultStats({ won, match }) {
  const m = match || {};
  const turns = m.turns || 9;
  const contacts = m.contacts || 6;
  const hirameki = m.hirameki || 3;
  const misread = m.misread || 0;
  // 公式 rules/01: 先攻 7 / 後攻 6
  const p1Target = m.p1Target || 7;
  const p2Target = m.p2Target || 6;
  const evidGot = m.evidGot || p1Target;
  const evidLost = m.evidLost || Math.max(1, p2Target - 2);
  return (
    <div style={{
      position: 'absolute', right: 80, top: 400, width: 520,
      padding: '24px 26px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid ${T.gold}55`,
      borderRadius: 4,
      boxShadow: `0 8px 24px rgba(0,0,0,0.5)`,
      zIndex: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.28em' }}>
          MATCH SUMMARY
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.1em' }}>
          少年探偵団・標準 vs 警察・標準
        </div>
      </div>

      {/* Score banner */}
      <div style={{ display: 'flex', marginBottom: 18, gap: 12 }}>
        <ScoreSide label="P1 · あなた" value={won ? '勝利' : '敗北'} sub={`証拠 ${evidGot} / ${p1Target}`} accent={T.green} winner={won} />
        <div style={{ display: 'flex', alignItems: 'center', fontFamily: T.fontSerif, fontSize: 28, fontWeight: 900, color: T.gold, padding: '0 10px' }}>VS</div>
        <ScoreSide label={`P2 · ${m.opp || 'CPU 標準'}`} value={won ? '敗北' : '勝利'} sub={`証拠 ${evidLost} / ${p2Target}`} accent={T.purple} winner={!won} />
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCompare label="ターン数" v1={String(turns)} v2={String(turns)} />
        <StatCompare label="コンタクト数" v1={String(contacts)} v2={String(Math.max(0, contacts - 2))} highlight="v1" />
        <StatCompare label="ヒラメキ発動" v1={String(hirameki)} v2={String(Math.max(0, hirameki - 2))} highlight={hirameki > 0 ? 'v1' : undefined} />
        <StatCompare label="ミスリード" v1={String(misread)} v2={String(misread > 0 ? 0 : 2)} highlight={misread === 0 ? 'v2-bad' : 'v1'} />
        <StatCompare label="証拠獲得" v1={String(evidGot)} v2={String(evidLost)} highlight="v1" />
        <StatCompare label="解決編到達" v1={won ? `T${Math.max(5, turns - 2)}` : '—'} v2={!won ? `T${Math.max(5, turns - 2)}` : '—'} highlight={won ? 'v1' : 'v2'} />
        <StatCompare label="使用ヒラメキ枚数" v1={`${hirameki + 2}/12`} v2={`${hirameki}/9`} />
        <StatCompare label="効率(AP/コスト)" v1="2,580" v2="2,140" highlight="v1" />
      </div>

      {/* Rewards (no currency — instead: progress) */}
      <div style={{
        marginTop: 16, padding: '12px 14px',
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${T.gold}33`,
        borderRadius: 3,
      }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.gold, letterSpacing: '0.2em', marginBottom: 6 }}>
          PROGRESS · この対戦の影響
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <ProgressLine label="ストーリー" before="03-2 / 5" after="03-3 / 5" />
          <ProgressLine label="このデッキの戦績" before="47 戦 (W31/L16)" after="48 戦 (W32/L16) · 67%" />
          <ProgressLine label="灰原哀の活躍度" before="A" after="S" tier />
        </div>
      </div>
    </div>
  );
}

function ScoreSide({ label, value, sub, accent, winner }) {
  return (
    <div style={{
      flex: 1, padding: '12px 14px',
      background: winner ? `linear-gradient(180deg, ${accent}33, ${accent}11)` : 'rgba(0,0,0,0.35)',
      border: `1.5px solid ${winner ? accent : `${accent}33`}`,
      borderRadius: 3,
      position: 'relative',
    }}>
      {winner && (
        <div style={{
          position: 'absolute', right: 8, top: 8,
          padding: '1px 6px',
          background: T.gold, color: '#1a1208',
          fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
          letterSpacing: '0.18em', borderRadius: 1,
        }}>WIN</div>
      )}
      <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.18em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, color: winner ? accent : T.textPrimary, letterSpacing: '0.06em' }}>{value}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function StatCompare({ label, v1, v2, highlight }) {
  const h1 = highlight === 'v1';
  const h2 = highlight === 'v2' || highlight === 'v2-bad';
  const badV2 = highlight === 'v2-bad';
  return (
    <div style={{
      padding: '7px 10px',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid rgba(78,195,255,0.15)`,
      borderRadius: 2,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <div style={{ flex: 1, fontSize: 11, color: T.textMuted }}>{label}</div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 14, fontWeight: 800,
        color: h1 ? T.gold : T.textSecondary,
        textShadow: h1 ? `0 0 6px ${T.gold}55` : 'none',
        width: 50, textAlign: 'right',
      }}>{v1}</div>
      <div style={{ width: 8, textAlign: 'center', color: T.textDisabled, fontFamily: T.fontMono, fontSize: 11 }}>·</div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 14, fontWeight: 800,
        color: badV2 ? T.red : h2 ? T.gold : T.textMuted,
        width: 50, textAlign: 'right',
      }}>{v2}</div>
    </div>
  );
}

function ProgressLine({ label, before, after, tier }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <div style={{ width: 130, color: T.textMuted, fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.12em' }}>{label}</div>
      <div style={{ color: T.textDisabled }}>{before}</div>
      <svg width="14" height="10" viewBox="0 0 14 10"><path d="M0 5 L10 5 L7 2 M10 5 L7 8" stroke={T.gold} strokeWidth="1.6" fill="none" /></svg>
      <div style={{ color: tier ? T.gold : T.textPrimary, fontWeight: 700 }}>{after}</div>
      {tier && (
        <div style={{
          padding: '1px 5px',
          background: T.gold, color: '#1a1208',
          fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
          letterSpacing: '0.15em', borderRadius: 1, marginLeft: 4,
        }}>RANK UP</div>
      )}
    </div>
  );
}

function ResultActions({ won }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 64,
      display: 'flex', justifyContent: 'center', gap: 14,
      zIndex: 6,
    }}>
      <SetupButton label="リプレイ保存" sub="REPLAY" />
      <SetupButton label="盤面を見直す" sub="REVIEW" navTo="replay" />
      <SetupButton label="このデッキで再戦" sub="REMATCH" navTo="match" />
      <SetupReadyButton label="次の対戦" sub="NEXT MATCH" navTo="setup" />
      <SetupButton label="ホームへ" sub="HOME" navTo="home" />
    </div>
  );
}

window.ResultScreen = ResultScreen;
