// 09-placeholders.jsx
// Simple placeholder screens for routes that haven't been mocked in full.
// MATCH (game board) — the real implementation lives in conan/src/ui/
// REPLAY — a quick "replay player" stub.

function MatchPlaceholder() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: T.fontJp, color: T.textPrimary, background: '#000' }}>
      {/* Real board (snapshot of conan/design-mockups/01-board-mockup.html) */}
      <iframe
        src="match-board.html"
        title="match-board"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          border: 'none',
          display: 'block',
        }}
      />

      {/* Floating top label */}
      <div style={{
        position: 'absolute', left: 24, top: 14, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 12px',
        background: 'rgba(0,0,0,0.7)',
        border: `1px solid ${T.gold}66`,
        borderRadius: 3,
        fontFamily: T.fontMono, fontSize: 11, color: T.gold,
        letterSpacing: '0.18em',
      }}>
        <span style={{ width: 6, height: 6, background: T.red, borderRadius: '50%', boxShadow: `0 0 6px ${T.red}` }} />
        MATCH · LIVE BOARD (snapshot)
      </div>

      {/* Glossary chip — distinguishes case cards from FILE area */}
      <div style={{
        position: 'absolute', right: 24, top: 14, zIndex: 20,
        padding: '5px 10px',
        background: 'rgba(0,0,0,0.7)',
        border: `1px solid ${T.neonBlue}55`,
        borderRadius: 3,
        fontFamily: T.fontMono, fontSize: 10, color: T.textSecondary,
        letterSpacing: '0.12em', lineHeight: 1.4,
      }}>
        <span style={{ color: T.gold }}>事件カード</span> = 中央の 4-5 枚 / <span style={{ color: T.neonBlue }}>FILE</span> = 自陣下部 7 枠
      </div>

      {/* Floating bottom-right control panel */}
      <div style={{
        position: 'absolute', right: 24, bottom: 24, zIndex: 20,
        padding: '12px 14px',
        background: 'rgba(8,16,28,0.92)',
        border: `1px solid ${T.gold}66`,
        borderRadius: 4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', gap: 8,
        minWidth: 260,
      }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
          color: T.gold, letterSpacing: '0.25em', marginBottom: 2,
        }}>
          PROTOTYPE NAV
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <SmallButton label="投了" sub="SURRENDER" navTo="result" />
          <SmallButton label="セットアップへ" sub="BACK" navTo="setup" />
        </div>
        <SmallButton label="決着 (RESULT へ)" sub="JUMP TO END" accent={T.gold} solid navTo="result" />
        <div style={{
          paddingTop: 6, borderTop: `1px solid rgba(78,195,255,0.15)`,
          fontFamily: T.fontMono, fontSize: 9, color: T.textMuted,
          letterSpacing: '0.1em', lineHeight: 1.5,
        }}>
          盤面は <span style={{ color: T.gold }}>conan/design-mockups/01-board-mockup</span> から取得した実装スナップショット
        </div>
      </div>
    </div>
  );
}

function BoardZone({ label, labelColor, border, cards, cardColor, partner }) {
  return (
    <div style={{
      flex: 1, position: 'relative',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${border}55`,
      borderRadius: 4,
      padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        position: 'absolute', top: 6, left: 10,
        fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
        color: labelColor, letterSpacing: '0.2em',
      }}>{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {partner && (
          <div style={{
            width: 90, height: 126,
            background: `linear-gradient(180deg, ${T.gold}, ${shade(T.gold, -0.4)})`,
            border: `2px solid ${T.gold}`,
            borderRadius: 3,
            boxShadow: `0 0 16px ${T.gold}66`,
          }} />
        )}
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} style={{
            width: 80, height: 112,
            background: `linear-gradient(180deg, ${cardColor}, ${shade(cardColor, -0.4)})`,
            border: `1px solid ${shade(cardColor, -0.5)}`,
            borderRadius: 3,
          }} />
        ))}
      </div>
    </div>
  );
}

function ReplayPlaceholder() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: T.fontJp, color: T.textPrimary }}>
      <MetaBg theme="noir" scene="replay">
        <AppTopBar page="HOME" />

        <div style={{
          position: 'absolute', left: 0, right: 0, top: 100,
          textAlign: 'center', zIndex: 5,
        }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.gold, letterSpacing: '0.4em' }}>
            REPLAY · MATCH #1248
          </div>
          <div style={{ fontFamily: T.fontSerif, fontSize: 32, fontWeight: 800, letterSpacing: '0.1em', marginTop: 4 }}>
            リプレイ詳細
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
            少年探偵団・標準 (TANTEI_01) vs 警察 標準 (CPU) · 9 ターン · 12:34
          </div>
        </div>

        {/* Mini board snapshot */}
        <div style={{
          position: 'absolute', left: '50%', top: 240,
          transform: 'translateX(-50%)',
          width: 1100, height: 460,
          background: 'rgba(0,0,0,0.4)',
          border: `1px solid ${T.gold}33`,
          borderRadius: 4,
          padding: 20,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          zIndex: 4,
        }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.gold, letterSpacing: '0.2em' }}>TURN 6 / 9 · MAIN PHASE</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
            <BoardZone label="OPP · CPU" labelColor={T.purple} border={T.purple} cards={2} cardColor={T.purple} />
            <BoardZone label="YOU" labelColor={T.green} border={T.green} cards={3} cardColor={T.blue} partner />
          </div>
        </div>

        {/* Scrubber */}
        <div style={{
          position: 'absolute', left: '50%', top: 720,
          transform: 'translateX(-50%)',
          width: 1100,
          background: 'rgba(0,0,0,0.6)',
          border: `1px solid ${T.gold}55`,
          borderRadius: 3,
          padding: '14px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <PlayerCtrl icon="⏮" />
              <PlayerCtrl icon="⏸" big />
              <PlayerCtrl icon="⏭" />
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 14, color: T.gold, fontWeight: 800 }}>
              T6 / T9
            </div>
            <div style={{
              flex: 1, height: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 4, position: 'relative', border: `1px solid ${T.gold}33`,
            }}>
              <div style={{ width: '66%', height: '100%', background: `linear-gradient(90deg, ${T.gold}, ${T.neonYellow})`, borderRadius: 3 }} />
              <div style={{
                position: 'absolute', left: '66%', top: '50%',
                width: 16, height: 16, background: '#fff', border: `2px solid ${T.gold}`,
                borderRadius: '50%', transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 8px ${T.gold}`,
              }} />
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textSecondary }}>
              08:24 / 12:34
            </div>
          </div>
          {/* Log */}
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'rgba(0,0,0,0.5)',
            border: `1px solid rgba(78,195,255,0.2)`,
            borderRadius: 2,
            fontFamily: T.fontMono, fontSize: 11,
            color: T.textSecondary, lineHeight: 1.7,
            maxHeight: 80, overflow: 'hidden',
          }}>
            <div style={{ color: T.green }}>[T6 · 自分] 灰原哀(7) を場に出す</div>
            <div style={{ color: T.textMuted }}>[T6 · 自分] コンタクト宣言 → 安室透 vs 横溝重悟</div>
            <div style={{ color: T.gold }}>[T6 · 自分] AP 5 vs 3 → 勝利 / 証拠 +1</div>
            <div style={{ color: T.neonBlue }}>[T6 · 自分] ヒラメキ発動: キャラ1枚をアクティブにする</div>
          </div>
        </div>

        {/* Back */}
        <div style={{
          position: 'absolute', left: 32, bottom: 30,
          display: 'flex', gap: 10, zIndex: 10,
        }}>
          <SetupButton label="履歴へ戻る" sub="BACK" navTo="history" />
        </div>
      </MetaBg>
    </div>
  );
}

function PlayerCtrl({ icon, big }) {
  return (
    <div style={{
      width: big ? 38 : 30, height: big ? 38 : 30,
      background: big ? T.gold : 'rgba(0,0,0,0.4)',
      border: `1px solid ${big ? T.gold : T.gold}66`,
      borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: big ? 16 : 12,
      color: big ? '#1a1208' : T.gold,
      cursor: 'pointer',
    }}>
      {icon}
    </div>
  );
}

window.MatchPlaceholder = MatchPlaceholder;
window.ReplayPlaceholder = ReplayPlaceholder;
