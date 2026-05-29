// 08-settings.jsx
// 設定画面 — カテゴリタブ + 設定詳細
// 1920×1080

function SettingsScreen() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: T.fontJp, color: T.textPrimary }}>
      <MetaBg theme="noir" scene="settings">
        <AppTopBar page="SETTINGS" />
        <SettingsHeader />
        <div style={{
          position: 'absolute', left: 24, right: 24, top: 130, bottom: 24,
          display: 'flex', gap: 16, zIndex: 5,
        }}>
          <SettingsCategoryRail />
          <SettingsDetail />
          <SettingsRightRail />
        </div>
      </MetaBg>
    </div>
  );
}

function SettingsHeader() {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 64, height: 60,
      display: 'flex', alignItems: 'center', padding: '0 32px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
      borderBottom: `1px solid rgba(78,195,255,0.15)`, zIndex: 8,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>SETTINGS</div>
      <div style={{ marginLeft: 14, fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, letterSpacing: '0.06em' }}>設定</div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <SmallButton label="初期化" sub="RESET" />
        <SmallButton label="設定をエクスポート" sub="EXPORT" />
        <SmallButton label="保存" sub="SAVE" accent={T.gold} solid />
      </div>
    </div>
  );
}

function SettingsCategoryRail() {
  const cats = [
    { id: 'play',     label: '対戦',       sub: 'GAMEPLAY', icon: '⚔', n: 8 },
    { id: 'visual',   label: '画面',       sub: 'VISUAL',   icon: '◐', n: 6, active: true },
    { id: 'audio',    label: '音声',       sub: 'AUDIO',    icon: '♪', n: 5 },
    { id: 'control',  label: '操作',       sub: 'CONTROL',  icon: '⌘', n: 7 },
    { id: 'lang',     label: '言語 / 表記', sub: 'LOCALE',   icon: '亜', n: 3 },
    { id: 'account',  label: 'アカウント', sub: 'ACCOUNT',  icon: '人', n: 4 },
    { id: 'data',     label: 'データ',     sub: 'DATA',     icon: '⌧', n: 5 },
    { id: 'about',    label: 'このアプリ', sub: 'ABOUT',    icon: 'i',  n: 0 },
  ];
  return (
    <div style={{
      width: 280, padding: '14px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em', marginBottom: 8, padding: '0 6px' }}>
        CATEGORY
      </div>
      {cats.map((c) => (
        <div key={c.id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px',
          background: c.active ? `linear-gradient(90deg, ${T.gold}22, transparent 80%)` : 'transparent',
          border: c.active ? `1px solid ${T.gold}66` : '1px solid transparent',
          borderRadius: 3, cursor: 'pointer',
        }}>
          <div style={{
            width: 28, height: 28,
            background: c.active ? T.gold : 'rgba(0,0,0,0.4)',
            color: c.active ? '#1a1208' : T.textSecondary,
            border: c.active ? 'none' : `1px solid rgba(78,195,255,0.3)`,
            borderRadius: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.fontSerif, fontSize: 14, fontWeight: 800,
          }}>{c.icon}</div>
          <div style={{ flex: 1, lineHeight: 1.2 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.active ? T.gold : T.textPrimary }}>{c.label}</div>
            <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em', marginTop: 1 }}>{c.sub}</div>
          </div>
          {c.n > 0 && (
            <div style={{ fontFamily: T.fontMono, fontSize: 10, color: c.active ? T.gold : T.textMuted, fontWeight: 700 }}>{c.n}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function SettingsDetail() {
  return (
    <div style={{
      flex: 1, padding: '20px 24px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.70))',
      border: `1px solid ${T.gold}55`,
      borderRadius: 4,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.3em' }}>VISUAL</div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 26, fontWeight: 800, marginTop: 2 }}>画面 / グラフィック</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>盤面の表示密度・演出強度・カード裏柄など。</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
        <SettingsGroup label="演出">
          <SettingRow label="演出速度" desc="ヒラメキ・コンタクト等の演出時間を倍率で調整" control={
            <SegmentedControl options={['0.5×', '1.0×', '1.5×', '2.0×', 'スキップ']} active={1} />
          } />
          <SettingRow label="画面シェイク" desc="ミスリード等で画面が揺れる効果" control={<Toggle on />} />
          <SettingRow label="パーティクル量" desc="ヒラメキの粒子エフェクト密度" control={<Slider value={70} />} />
          <SettingRow label="背景アニメーション" desc="ロビー背景の動きを停止すると軽量化" control={<Toggle on />} />
        </SettingsGroup>

        <SettingsGroup label="盤面密度">
          <SettingRow label="情報密度" desc="盤面に表示する情報量。低くするとアイコンが大きくなる。" control={
            <SegmentedControl options={['低', '標準', '高', '競技']} active={2} />
          } />
          <SettingRow label="効果スタック表示" desc="解決待ちの効果スタックを常時表示する" control={<Toggle on />} />
        </SettingsGroup>

        <SettingsGroup label="カード裏柄">
          <CardBackSelector />
        </SettingsGroup>
      </div>
    </div>
  );
}

function SettingsGroup({ label, children }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid rgba(78,195,255,0.15)`, borderRadius: 3,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 10, fontWeight: 800, color: T.gold, letterSpacing: '0.25em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, desc, control }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '7px 4px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{label}</div>
        {desc && <div style={{ fontFamily: T.fontJp, fontSize: 11, color: T.textMuted, marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}

function SegmentedControl({ options, active }) {
  return (
    <div style={{ display: 'flex', border: `1px solid rgba(78,195,255,0.3)`, borderRadius: 2, overflow: 'hidden' }}>
      {options.map((o, i) => (
        <div key={i} style={{
          padding: '5px 12px',
          background: i === active ? T.gold : 'rgba(0,0,0,0.35)',
          color: i === active ? '#1a1208' : T.textSecondary,
          fontFamily: T.fontJp, fontSize: 11, fontWeight: 700,
          cursor: 'pointer',
          borderRight: i < options.length - 1 ? `1px solid rgba(78,195,255,0.2)` : 'none',
        }}>{o}</div>
      ))}
    </div>
  );
}

function Toggle({ on }) {
  return (
    <div style={{
      width: 48, height: 24, borderRadius: 12,
      background: on ? `linear-gradient(180deg, ${T.green}, ${shade(T.green, -0.3)})` : 'rgba(0,0,0,0.5)',
      border: `1px solid ${on ? T.green : 'rgba(78,195,255,0.3)'}`,
      position: 'relative', cursor: 'pointer',
      boxShadow: on ? `0 0 8px ${T.green}55` : 'none',
    }}>
      <div style={{
        position: 'absolute', top: 2, [on ? 'right' : 'left']: 2,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
      }} />
    </div>
  );
}

function Slider({ value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 220 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 3, position: 'relative', border: `1px solid rgba(78,195,255,0.2)` }}>
        <div style={{ width: `${value}%`, height: '100%', background: `linear-gradient(90deg, ${T.gold}, ${T.neonYellow})`, borderRadius: 2 }} />
        <div style={{
          position: 'absolute', left: `${value}%`, top: '50%',
          width: 14, height: 14, borderRadius: '50%',
          background: '#fff', border: `2px solid ${T.gold}`,
          transform: 'translate(-50%, -50%)',
          boxShadow: `0 0 6px ${T.gold}88, 0 2px 4px rgba(0,0,0,0.6)`,
        }} />
      </div>
      <div style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 800, color: T.gold, width: 30, textAlign: 'right' }}>{value}</div>
    </div>
  );
}

function CardBackSelector() {
  const backs = [
    { id: 'classic', name: 'クラシック', color: T.blue, active: true },
    { id: 'noir',    name: 'ノワール',   color: T.purple },
    { id: 'gold',    name: 'ゴールド',   color: T.gold },
    { id: 'red',     name: '深紅',       color: T.red },
    { id: 'green',   name: '事件解決',   color: T.green },
  ];
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {backs.map((b) => (
        <div key={b.id} style={{
          textAlign: 'center', cursor: 'pointer',
          opacity: b.active ? 1 : 0.7,
        }}>
          <div style={{
            width: 60, height: 84,
            background: `linear-gradient(135deg, ${b.color}, ${shade(b.color, -0.5)})`,
            border: b.active ? `2px solid ${T.gold}` : `1px solid ${shade(b.color, -0.6)}`,
            borderRadius: 4,
            boxShadow: b.active ? `0 0 14px ${T.gold}66` : '0 4px 8px rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="13" cy="13" r="9" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
              <line x1="19" y1="19" x2="26" y2="26" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {b.active && (
              <div style={{
                position: 'absolute', right: -6, top: -6,
                width: 18, height: 18,
                background: T.gold, color: '#1a1208',
                borderRadius: '50%',
                border: '2px solid #050810',
                fontSize: 11, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✓</div>
            )}
          </div>
          <div style={{ fontFamily: T.fontJp, fontSize: 11, color: b.active ? T.gold : T.textSecondary, marginTop: 6, fontWeight: 700 }}>{b.name}</div>
        </div>
      ))}
    </div>
  );
}

function SettingsRightRail() {
  return (
    <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        padding: '14px 16px',
        background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
        border: `1px solid rgba(78,195,255,0.25)`,
        borderRadius: 4,
      }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em', marginBottom: 10 }}>
          PREVIEW
        </div>
        <div style={{
          padding: '14px 12px',
          background: 'radial-gradient(ellipse at 50% 30%, #15263e 0%, #0a1424 75%)',
          border: `1px solid rgba(78,195,255,0.15)`,
          borderRadius: 3,
          height: 220, position: 'relative', overflow: 'hidden',
        }}>
          {/* Mini board preview */}
          <div style={{ position: 'absolute', left: 8, right: 8, top: 8, height: 30, border: `1px solid rgba(170,102,221,0.4)`, borderRadius: 2, display: 'flex', alignItems: 'center', padding: '0 6px', gap: 3 }}>
            {[0,1,2].map((i) => (
              <div key={i} style={{ width: 16, height: 22, background: 'linear-gradient(180deg, #aa66dd44, #8a4cc088)', border: '1px solid rgba(170,102,221,0.6)', borderRadius: 1 }} />
            ))}
          </div>
          <div style={{ position: 'absolute', left: 20, right: 20, top: 48, height: 32, display: 'flex', gap: 3 }}>
            {[0,1,2,3,4].map((i) => (
              <div key={i} style={{ flex: 1, background: i === 2 ? 'rgba(255,215,0,0.25)' : 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,215,0,0.4)', borderRadius: 1 }} />
            ))}
          </div>
          <div style={{ position: 'absolute', left: 8, right: 8, top: 88, height: 36, border: `1px solid rgba(68,221,153,0.4)`, borderRadius: 2, display: 'flex', alignItems: 'center', padding: '0 6px', gap: 3 }}>
            <div style={{ width: 22, height: 28, background: 'linear-gradient(180deg, #ffd700, #d4a425)', borderRadius: 1, border: '1px solid #b9930a' }} />
            <div style={{ width: 16, height: 24, background: 'linear-gradient(180deg, #4ec3ff44, #2b6cb588)', border: '1px solid rgba(78,195,255,0.6)', borderRadius: 1 }} />
          </div>
          <div style={{ position: 'absolute', left: 50, right: 50, bottom: 8, display: 'flex', gap: 2, justifyContent: 'center' }}>
            {[0,1,2,3,4].map((i) => (
              <div key={i} style={{ width: 18, height: 26, background: 'linear-gradient(180deg, #4ec3ff44, #2b6cb588)', border: '1px solid rgba(78,195,255,0.6)', borderRadius: 1, transform: `rotate(${(i-2)*4}deg)` }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.12em' }}>
          <span>密度: 高</span>
          <span>演出: 1.0×</span>
          <span>背景: ON</span>
        </div>
      </div>

      <div style={{
        flex: 1,
        padding: '14px 16px',
        background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
        border: `1px solid rgba(78,195,255,0.25)`,
        borderRadius: 4,
      }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em', marginBottom: 12 }}>
          SYSTEM
        </div>
        <SysRow label="バージョン" value="v0.8.3" />
        <SysRow label="エンジン" value="phase-9-polish" />
        <SysRow label="カード総数" value="47 種" />
        <SysRow label="テスト" value="1,377 GREEN" valueColor={T.green} />
        <SysRow label="言語" value="日本語" />
        <SysRow label="ストレージ" value="14.2 MB / ∞" />
        <SysRow label="最終同期" value="2026.05.20 15:42" />
        <div style={{ marginTop: 12, padding: 10, background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.red}44`, borderRadius: 2 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.red, letterSpacing: '0.2em', marginBottom: 4 }}>DANGER ZONE</div>
          <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>
            全データを初期化すると、デッキ・履歴・チュートリアル進捗がすべて失われます。
          </div>
          <div style={{
            marginTop: 8, padding: '6px 12px', textAlign: 'center',
            background: 'rgba(200,64,64,0.15)',
            border: `1px solid ${T.red}88`, borderRadius: 2,
            fontFamily: T.fontMono, fontSize: 11, fontWeight: 800,
            color: T.red, letterSpacing: '0.18em', cursor: 'pointer',
          }}>全データ初期化</div>
        </div>
      </div>
    </div>
  );
}

function SysRow({ label, value, valueColor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '5px 0',
      borderBottom: `1px solid rgba(78,195,255,0.1)`,
      fontFamily: T.fontMono, fontSize: 11,
    }}>
      <span style={{ color: T.textMuted, letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ color: valueColor || T.textPrimary, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

window.SettingsScreen = SettingsScreen;
