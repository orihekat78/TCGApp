// 08-tutorial.jsx
// チュートリアル画面 — 章リスト + 選択章の学習ステップ + 練習試合ボタン
// 1920×1080

function TutorialScreen() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: T.fontJp, color: T.textPrimary }}>
      <MetaBg theme="noir" scene="tutorial">
        <AppTopBar page="TUTORIAL" />
        <TutorialSubToolbar />

        <div style={{
          position: 'absolute', left: 24, right: 24, top: 130, bottom: 24,
          display: 'flex', gap: 16, zIndex: 5,
        }}>
          {/* LEFT: chapter rail */}
          <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ChapterProgress />
            <ChapterList />
          </div>

          {/* CENTER: selected chapter content */}
          <div style={{ flex: 1 }}>
            <ChapterContent />
          </div>

          {/* RIGHT: hints / illustration */}
          <div style={{ width: 380 }}>
            <ChapterIllustration />
          </div>
        </div>
      </MetaBg>
    </div>
  );
}

function TutorialSubToolbar() {
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
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>TUTORIAL</div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, letterSpacing: '0.06em' }}>探偵養成講座</div>
      </div>

      <div style={{ marginLeft: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.18em' }}>進捗</div>
        <div style={{ width: 220, height: 8, background: 'rgba(0,0,0,0.5)', border: `1px solid rgba(78,195,255,0.2)`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: '45%', height: '100%', background: `linear-gradient(90deg, ${T.gold}, ${T.neonYellow})` }} />
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.gold, fontWeight: 800, letterSpacing: '0.1em' }}>
          9 / 20 完了
        </div>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <SmallButton label="リセット" sub="RESET" />
        <SmallButton label="練習試合" sub="PRACTICE" accent={T.gold} solid navTo="match" />
      </div>
    </div>
  );
}

// ── LEFT: progress + chapter list ──────────────────────────────────────
function ChapterProgress() {
  return (
    <div style={{
      padding: '14px 16px',
      background: `linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))`,
      border: `1px solid ${T.gold}55`,
      borderRadius: 4,
    }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{
          width: 60, height: 60,
          background: `radial-gradient(circle, ${T.gold}66, ${T.gold}22)`,
          border: `2px solid ${T.gold}`,
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fontSerif, fontSize: 24, fontWeight: 900,
          color: T.gold,
          boxShadow: `0 0 16px ${T.gold}44`,
        }}>
          II
        </div>
        <div style={{ lineHeight: 1.2, flex: 1 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.2em' }}>RANK</div>
          <div style={{ fontFamily: T.fontSerif, fontSize: 20, fontWeight: 800, color: T.gold, marginTop: 2 }}>見習い探偵</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textSecondary, marginTop: 2, letterSpacing: '0.1em' }}>NOVICE DETECTIVE</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>NEXT</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 14, fontWeight: 800, color: T.textPrimary, marginTop: 2 }}>
            3 / 5 章
          </div>
        </div>
      </div>
    </div>
  );
}

function ChapterList() {
  const chapters = [
    { id: 1, num: '01', title: 'ようこそ、探偵', subtitle: 'ゲームの目的と勝利条件', steps: 5, done: 5, state: 'cleared' },
    { id: 2, num: '02', title: 'カードを場に出す', subtitle: '手札・コスト・キャラクター召喚', steps: 6, done: 6, state: 'cleared' },
    { id: 3, num: '03', title: '推理とコンタクト', subtitle: 'AP 比較・ガード・ヒラメキ', steps: 8, done: 8, state: 'cleared' },
    { id: 4, num: '04', title: '証拠と解決編', subtitle: 'FILE エリア・解決編突入・勝利条件', steps: 7, done: 4, state: 'current' },
    { id: 5, num: '05', title: 'ミスリード', subtitle: '誤誘導と切り返し', steps: 6, done: 0, state: 'locked' },
    { id: 6, num: '06', title: '上級戦略', subtitle: 'デッキ構築・色配分・シナジー', steps: 8, done: 0, state: 'locked' },
  ];
  return (
    <div style={{
      flex: 1,
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column', gap: 8,
      overflow: 'hidden',
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em', marginBottom: 4 }}>
        CHAPTERS
      </div>
      {chapters.map((ch) => <ChapterRow key={ch.id} chapter={ch} />)}
    </div>
  );
}

function ChapterRow({ chapter }) {
  const isCleared = chapter.state === 'cleared';
  const isCurrent = chapter.state === 'current';
  const isLocked = chapter.state === 'locked';
  const accent = isCurrent ? T.gold : isCleared ? T.green : T.textDisabled;
  return (
    <div className="meta-row" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 10px',
      background: isCurrent ? `linear-gradient(90deg, ${T.gold}11, transparent 80%)` : 'transparent',
      border: `1px solid ${isCurrent ? `${T.gold}55` : isLocked ? 'transparent' : 'rgba(78,195,255,0.08)'}`,
      borderRadius: 3,
      opacity: isLocked ? 0.45 : 1,
      cursor: 'pointer',
    }}>
      <div style={{
        width: 40, height: 40, flexShrink: 0,
        background: isCleared ? `${T.green}22` : isCurrent ? `${T.gold}22` : 'rgba(0,0,0,0.4)',
        border: `1.5px solid ${accent}`,
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        fontFamily: T.fontMono, fontWeight: 800, fontSize: 14,
        color: accent,
      }}>
        {isLocked ? '🔒' : chapter.num}
        {isCleared && (
          <div style={{
            position: 'absolute', right: -4, bottom: -4,
            width: 14, height: 14,
            background: T.green, borderRadius: '50%',
            border: '1.5px solid #050810',
            fontSize: 9, color: '#050810', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✓</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: isCurrent ? T.gold : isCleared ? T.textSecondary : T.textMuted,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{chapter.title}</div>
        <div style={{ fontFamily: T.fontJp, fontSize: 11, color: T.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {chapter.subtitle}
        </div>
      </div>
      <div style={{ textAlign: 'right', lineHeight: 1.2, minWidth: 60 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: accent }}>
          {chapter.done} / {chapter.steps}
        </div>
        {!isLocked && (
          <div style={{ width: 60, height: 3, background: 'rgba(0,0,0,0.5)', borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(chapter.done / chapter.steps) * 100}%`, height: '100%', background: accent }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── CENTER: chapter content ────────────────────────────────────────────
function ChapterContent() {
  const steps = [
    { num: 1, title: '証拠とは', state: 'cleared', body: '推理によってデッキの上から LP 枚数分を裏向きで証拠エリアに置く。証拠エリアと FILE エリアは別物だ。' },
    { num: 2, title: 'FILE エリアとは何か', state: 'cleared', body: 'オートフェイズで 2 枚(先攻1ターン目は1枚)裏向きで置かれる。アシストしたパートナーもここに移動。事件カード(中央)とは別エリア — 混同注意。' },
    { num: 3, title: '【アシスト】能力', state: 'cleared', body: 'パートナーをスリープさせ FILE へ移動。FILE が 7 枚以上になると事件を解決編にできる。' },
    { num: 4, title: '解決編への移行', state: 'cleared', body: 'FILE 7 枚以上 × アシスト で事件カードが解決編に裏返し。「事件編」には二度と戻らない(一方通行)。' },
    { num: 5, title: '勝利条件と必要証拠数', state: 'current', body: '先攻 7 / 後攻 6 枚の証拠を集める + パートナーアクティブ → 【事件解決】でスリープして勝利。' },
    { num: 6, title: '⚠ アシストしたターンは勝てない', state: 'locked', body: 'アシスト = パートナーをスリープ → FILE 移動。事件解決はアクティブパートナーが前提なので、同ターン中は勝利不可。' },
    { num: 7, title: '練習: 解決編への道筋', state: 'locked', body: 'AI とチュートリアル対戦。FILE 7 枚を揃えて解決編へ、次ターンで勝利を狙う。' },
  ];
  return (
    <div style={{
      width: '100%', height: '100%',
      padding: '24px 28px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.7))',
      border: `1px solid ${T.gold}55`,
      borderRadius: 4,
      boxShadow: `inset 0 0 40px rgba(255,215,0,0.05)`,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Chapter header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.3em' }}>
          CHAPTER 04
        </div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 32, fontWeight: 800, color: T.textPrimary, letterSpacing: '0.06em', marginTop: 2 }}>
          証拠と解決編
        </div>
        <div style={{ fontFamily: T.fontJp, fontSize: 13, color: T.textSecondary, marginTop: 4 }}>
          FILE 7 枚集めて解決編に、証拠 7/6 枚をで事件解決。【アシスト】のタイミングに注意。
        </div>
      </div>

      {/* Steps list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' }}>
        {steps.map((s) => <TutorialStep key={s.num} step={s} />)}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 14,
        display: 'flex', gap: 10, alignItems: 'center',
        padding: '12px 14px',
        background: 'rgba(0,0,0,0.45)',
        border: `1px solid ${T.gold}33`,
        borderRadius: 3,
      }}>
        <div style={{ flex: 1, lineHeight: 1.4 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, letterSpacing: '0.2em' }}>CURRENT STEP</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginTop: 1 }}>Step 5 / 7 · 勝利条件と必要証拠数</div>
        </div>
        <SetupButton label="前へ" sub="PREV" />
        <SetupReadyButton label="次へ" sub="NEXT STEP" navTo="match" />
      </div>
    </div>
  );
}

function TutorialStep({ step }) {
  const isCleared = step.state === 'cleared';
  const isCurrent = step.state === 'current';
  const isLocked = step.state === 'locked';
  const accent = isCurrent ? T.gold : isCleared ? T.green : T.textDisabled;
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 12,
      padding: '8px 12px',
      background: isCurrent ? 'rgba(255,215,0,0.06)' : 'rgba(0,0,0,0.15)',
      border: `1px solid ${isCurrent ? `${T.gold}55` : 'rgba(78,195,255,0.1)'}`,
      borderRadius: 3,
      opacity: isLocked ? 0.45 : 1,
    }}>
      <div style={{
        width: 28, height: 28, flexShrink: 0, alignSelf: 'center',
        background: isCleared ? T.green : isCurrent ? T.gold : 'rgba(0,0,0,0.4)',
        border: `1.5px solid ${accent}`,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontMono, fontWeight: 800, fontSize: 11,
        color: isCleared || isCurrent ? '#0a1208' : accent,
      }}>
        {isCleared ? '✓' : isLocked ? '·' : step.num}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: isCurrent ? T.gold : T.textPrimary }}>
            {step.title}
          </div>
          {isCurrent && (
            <div style={{
              padding: '1px 6px',
              background: T.gold, color: '#1a1208',
              fontFamily: T.fontMono, fontSize: 8, fontWeight: 800,
              letterSpacing: '0.18em', borderRadius: 1,
            }}>NOW</div>
          )}
        </div>
        <div style={{ fontFamily: T.fontJp, fontSize: 11, color: T.textMuted, marginTop: 2, lineHeight: 1.5 }}>
          {step.body}
        </div>
      </div>
    </div>
  );
}

// ── RIGHT: illustration + key concept ──────────────────────────────────
function ChapterIllustration() {
  return (
    <div style={{
      width: '100%', height: '100%',
      padding: '20px 22px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em', marginBottom: 14 }}>
        VISUAL · ヒラメキの流れ
      </div>

      {/* Visual mini-diagram of contact */}
      <div style={{
        padding: '18px 14px',
        background: 'rgba(0,0,0,0.45)',
        border: `1px solid ${T.gold}33`,
        borderRadius: 3,
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <CardDiagram color={T.red} name="安室透" ap="5" stage="attacker" />
          <div style={{ fontFamily: T.fontSerif, fontSize: 22, color: T.gold, fontWeight: 900 }}>vs</div>
          <CardDiagram color={T.blue} name="灰原哀" ap="3" stage="defender" />
        </div>

        {/* Arrow down */}
        <div style={{ textAlign: 'center', margin: '14px 0' }}>
          <svg width="20" height="22" viewBox="0 0 20 22" style={{ margin: '0 auto' }}>
            <path d="M10 0 L10 16 M3 12 L10 20 L17 12" stroke={T.gold} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.gold, letterSpacing: '0.2em', marginTop: 4 }}>
            灰原哀 がリムーブ
          </div>
        </div>

        {/* Result: hirameki triggered */}
        <div style={{
          padding: '10px 12px',
          background: `linear-gradient(180deg, ${T.gold}22, ${T.gold}08)`,
          border: `1.5px solid ${T.gold}88`,
          borderRadius: 3,
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.gold, letterSpacing: '0.3em' }}>
            HIRAMEKI · 閃き
          </div>
          <div style={{ fontFamily: T.fontSerif, fontSize: 16, fontWeight: 800, color: T.gold, marginTop: 4 }}>
            カード固有の効果が発動
          </div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4, lineHeight: 1.4 }}>
            証拠からリムーブされた瞬間に、各カードの【ヒラメキ】テキストが発動する。
            例)灰原哀=ドロー、萩原千速=キャラ1枚アクティブ化、など。
          </div>
        </div>
      </div>

      {/* Key terms */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em', marginBottom: 6 }}>KEY TERMS · 用語</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <TermRow term="AP" desc="Attack Power - コンタクトで比較するキャラの攻撃力" />
          <TermRow term="LP" desc="Lv Point - 推理で得る証拠枚数" />
          <TermRow term="リムーブ" desc="場・手札・証拠からリムーブエリアへ" />
          <TermRow term="ヒラメキ" desc="証拠からリムーブされる瞬間に発動する効果" />
          <TermRow term="スリープ" desc="アクション・推理を使うとなる状態。ターン開始で解除" />
        </div>
      </div>

      {/* Quick tip */}
      <div style={{
        marginTop: 'auto',
        padding: '10px 12px',
        background: `linear-gradient(135deg, ${T.neonBlue}22, transparent)`,
        border: `1px solid ${T.neonBlue}55`,
        borderRadius: 3,
        display: 'flex', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, flexShrink: 0,
          background: T.neonBlue, color: '#0a1a28',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fontSerif, fontWeight: 900, fontSize: 16,
        }}>!</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.neonBlue, letterSpacing: '0.2em' }}>POINT</div>
          <div style={{ fontSize: 12, color: T.textPrimary, marginTop: 2, lineHeight: 1.5 }}>
            ヒラメキは「リムーブされる側」で発動する。AP で負けてリムーブされても、ヒラメキで反撃できることがある。
          </div>
        </div>
      </div>
    </div>
  );
}

function CardDiagram({ color, name, ap, stage }) {
  return (
    <div style={{
      width: 88, padding: '8px 6px',
      background: `linear-gradient(180deg, ${color}, ${shade(color, -0.4)})`,
      border: `1.5px solid ${shade(color, -0.5)}`,
      borderRadius: 3,
      textAlign: 'center',
      filter: `drop-shadow(0 0 12px ${color}66)`,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.15em' }}>{stage.toUpperCase()}</div>
      <div style={{ fontFamily: T.fontSerif, fontSize: 12, fontWeight: 800, color: '#fff', marginTop: 4 }}>{name}</div>
      <div style={{
        marginTop: 6,
        padding: '4px 0',
        background: 'rgba(0,0,0,0.4)',
        borderRadius: 2,
      }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>AP</div>
        <div style={{ fontFamily: T.fontMono, fontSize: 22, fontWeight: 900, color: T.gold, lineHeight: 1 }}>{ap}</div>
      </div>
    </div>
  );
}

function TermRow({ term, desc }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(78,195,255,0.08)' }}>
      <div style={{ width: 80, fontFamily: T.fontJp, fontSize: 12, fontWeight: 700, color: T.gold }}>{term}</div>
      <div style={{ flex: 1, fontSize: 11, color: T.textSecondary, lineHeight: 1.4 }}>{desc}</div>
    </div>
  );
}

window.TutorialScreen = TutorialScreen;
