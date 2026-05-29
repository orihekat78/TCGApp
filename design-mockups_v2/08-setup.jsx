// 08-setup.jsx
// 対戦準備画面 — モード選択 + デッキ選択 + AI 設定 + READY
// 1920×1080

function SetupScreen() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: T.fontJp, color: T.textPrimary }}>
      <MetaBg theme="noir" scene="setup">
        <AppTopBar page="HOME" />

        {/* Page title */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 92, height: 70,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
        }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.4em' }}>
            MATCH SETUP
          </div>
          <div style={{ fontFamily: T.fontSerif, fontSize: 24, fontWeight: 800, letterSpacing: '0.18em', marginTop: 2 }}>
            対 戦 準 備
          </div>
        </div>

        {/* Mode tiles */}
        <div style={{
          position: 'absolute', left: '50%', top: 192,
          transform: 'translateX(-50%)',
          display: 'flex', gap: 28,
        }}>
          <ModeTile
            active
            title="単独捜査"
            sub="SOLO INVESTIGATION"
            tag="あなたが探偵側"
            desc="あなたが操作。相手は AI。標準のプレイモード。"
            iconLeft="YOU" iconRight="AI"
            accentLeft={T.green} accentRight={T.purple}
          />
          <ModeTile
            title="観察ルーム"
            sub="OBSERVE MODE"
            tag="AI 同士の検証"
            desc="両プレイヤーを AI が操作。デッキ検証や AI 挙動の観察に。"
            iconLeft="AI" iconRight="AI"
            accentLeft={T.neonBlue} accentRight={T.purple}
          />
        </div>

        {/* Player config panels */}
        <div style={{
          position: 'absolute', left: 80, right: 80, top: 510,
          display: 'flex', gap: 28, justifyContent: 'center',
        }}>
          <PlayerConfigPanel
            slot="P1"
            label="プレイヤー 1"
            mode="human"
            deckName="少年探偵団・標準"
            partnerNum="D08001"
          />
          <SwapButton />
          <PlayerConfigPanel
            slot="P2"
            label="プレイヤー 2"
            mode="cpu"
            difficulty="標準"
            strategy="少年探偵団・標準"
            partnerNum="D11001"
          />
        </div>

        {/* Match options */}
        <SetupMatchOptions />

        {/* Bottom action */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 50,
          display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center',
        }}>
          <SetupButton label="戻る" sub="BACK" navTo="home" />
          <SetupButton label="ランダム設定" sub="RANDOMIZE" />
          <SetupReadyButton navTo="match" />
        </div>
      </MetaBg>
    </div>
  );
}

function ModeTile({ active, title, sub, tag, desc, iconLeft, iconRight, accentLeft, accentRight }) {
  return (
    <div style={{
      width: 480, height: 280,
      padding: '24px 28px',
      background: active
        ? `linear-gradient(180deg, rgba(255,215,0,0.12), rgba(13,38,64,0.95))`
        : 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: active ? `2px solid ${T.gold}` : `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      boxShadow: active
        ? `0 0 28px ${T.gold}33, 0 12px 24px rgba(0,0,0,0.6)`
        : `0 8px 18px rgba(0,0,0,0.5)`,
      cursor: 'pointer',
      position: 'relative',
      transition: 'all 150ms',
    }}>
      {active && (
        <div style={{
          position: 'absolute', right: 16, top: 16,
          padding: '2px 8px',
          background: T.gold, color: '#1a1208',
          fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.18em', borderRadius: 2,
        }}>SELECTED</div>
      )}

      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: active ? T.gold : T.textMuted, letterSpacing: '0.3em' }}>
        {sub}
      </div>
      <div style={{ fontFamily: T.fontSerif, fontSize: 32, fontWeight: 800, letterSpacing: '0.06em', marginTop: 2 }}>
        {title}
      </div>
      <div style={{
        display: 'inline-block', marginTop: 6, padding: '2px 10px',
        fontSize: 12, color: T.neonBlue,
        background: 'rgba(78,195,255,0.12)',
        border: `1px solid ${T.neonBlue}55`,
        borderRadius: 2,
      }}>
        {tag}
      </div>

      {/* Player avatars */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 18,
        marginTop: 24, marginBottom: 12,
      }}>
        <ModeAvatar label={iconLeft} accent={accentLeft} />
        <div style={{
          fontFamily: T.fontSerif, fontSize: 28, fontWeight: 800,
          color: T.gold, letterSpacing: '0.1em',
        }}>vs</div>
        <ModeAvatar label={iconRight} accent={accentRight} />
      </div>

      <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  );
}

function ModeAvatar({ label, accent }) {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: 4,
      background: `linear-gradient(135deg, ${accent}aa, ${shade(accent, -0.4)})`,
      border: `2px solid ${shade(accent, 0.2)}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: T.fontMono, fontSize: 22, fontWeight: 800, color: '#fff',
      letterSpacing: '0.05em',
      boxShadow: `0 0 12px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
    }}>
      {label}
    </div>
  );
}

function PlayerConfigPanel({ slot, label, mode, deckName, difficulty, strategy, partnerNum }) {
  const partner = window.CARD_POOL.find((c) => c.num === partnerNum);
  const isHuman = mode === 'human';
  const accent = isHuman ? T.green : T.purple;
  return (
    <div style={{
      width: 520, padding: '20px 22px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1.5px solid ${accent}66`,
      borderRadius: 4,
      boxShadow: `0 0 18px ${accent}22, 0 8px 18px rgba(0,0,0,0.5)`,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 14, fontWeight: 800,
          color: accent, letterSpacing: '0.2em',
          padding: '4px 10px',
          background: `${accent}22`,
          borderRadius: 2,
        }}>{slot}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>{label}</div>
        <div style={{
          marginLeft: 'auto',
          padding: '3px 10px',
          background: `${accent}22`,
          border: `1px solid ${accent}66`,
          borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
          color: accent, letterSpacing: '0.2em',
        }}>
          {isHuman ? 'DETECTIVE' : 'AI'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Partner card */}
        <div style={{ filter: `drop-shadow(0 0 10px ${accent}55)` }}>
          <MetaCard card={partner} w={130} badge="partner" hoverable={false} />
        </div>

        {/* Settings */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ConfigRow label="デッキ" value={deckName || strategy} accent={T.neonBlue} editable />
          <ConfigRow label="パートナー" value={partner.name} accent={T.gold} />
          {!isHuman && (
            <React.Fragment>
              <ConfigRow label="AI 難易度" value={difficulty} accent={T.purple} editable />
              <ConfigRow label="戦略" value="少年探偵団に最適化" accent={T.purple} editable />
            </React.Fragment>
          )}
          {isHuman && (
            <ConfigRow label="プレイヤー" value="TANTEI_01 · 探偵 II" accent={T.green} />
          )}
        </div>
      </div>

      {/* Recent stats */}
      <div style={{ marginTop: 14, padding: '10px 12px',
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${accent}33`,
        borderRadius: 3,
        display: 'flex', gap: 18,
      }}>
        <MiniMetric label="勝率" value={isHuman ? '64%' : '—'} accent={T.green} />
        <MiniMetric label="平均ターン" value={isHuman ? '8.4' : '8.0'} accent={T.neonBlue} />
        <MiniMetric label="平均コスト" value="3.6" accent={T.gold} />
        <MiniMetric label="この組合せ" value={isHuman ? '48 戦' : 'シード未設定'} accent={T.textMuted} />
      </div>
    </div>
  );
}

function ConfigRow({ label, value, accent, editable }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 10px',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${accent}33`,
      borderRadius: 2,
    }}>
      <div style={{
        width: 84, flexShrink: 0,
        fontFamily: T.fontMono, fontSize: 10, fontWeight: 700,
        color: T.textMuted, letterSpacing: '0.15em',
      }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>{value}</div>
      {editable && (
        <div style={{
          padding: '2px 6px',
          fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
          color: accent, letterSpacing: '0.15em',
          background: `${accent}15`,
          border: `1px solid ${accent}55`,
          borderRadius: 2,
          cursor: 'pointer',
        }}>変更 ▾</div>
      )}
    </div>
  );
}

function MiniMetric({ label, value, accent }) {
  return (
    <div style={{ lineHeight: 1.2 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 14, fontWeight: 800, color: accent, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function SwapButton() {
  return (
    <div style={{
      width: 50, alignSelf: 'center',
      padding: '20px 0',
      background: 'rgba(0,0,0,0.5)',
      border: `1px solid ${T.gold}66`,
      borderRadius: 4,
      cursor: 'pointer', textAlign: 'center',
    }}>
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ margin: '0 auto', display: 'block' }}>
        <path d="M3 8 L17 8 L13 4 M19 14 L5 14 L9 18" stroke={T.gold} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.gold, letterSpacing: '0.2em', marginTop: 4 }}>SWAP</div>
    </div>
  );
}

function SetupMatchOptions() {
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 150,
      transform: 'translateX(-50%)',
      display: 'flex', gap: 24,
      padding: '14px 24px',
      background: 'rgba(0,0,0,0.5)',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
    }}>
      <OptionToggle label="先攻" value="P1 先攻" options={['P1 先攻', 'P2 先攻', 'ランダム']} active={0} />
      <OptionToggle label="演出速度" value="1.0×" options={['0.5×', '1.0×', '1.5×', '2.0×']} active={1} />
      <OptionToggle label="自動進行" value="ON" options={['ON', 'OFF']} active={0} />
      <OptionToggle label="効果ログ" value="詳細" options={['簡易', '詳細', '非表示']} active={1} />
    </div>
  );
}

function OptionToggle({ label, options, active }) {
  return (
    <div>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 0, borderRadius: 2, overflow: 'hidden', border: `1px solid rgba(78,195,255,0.3)` }}>
        {options.map((o, i) => (
          <div key={i} style={{
            padding: '4px 10px',
            background: i === active ? T.gold : 'rgba(0,0,0,0.3)',
            color: i === active ? '#1a1208' : T.textSecondary,
            fontFamily: T.fontJp, fontSize: 11, fontWeight: 700,
            cursor: 'pointer',
            borderRight: i < options.length - 1 ? `1px solid rgba(78,195,255,0.2)` : 'none',
          }}>{o}</div>
        ))}
      </div>
    </div>
  );
}

function SetupButton_unused_local() { return null; }
function SetupReadyButton_unused_local() { return null; }

window.SetupScreen = SetupScreen;
