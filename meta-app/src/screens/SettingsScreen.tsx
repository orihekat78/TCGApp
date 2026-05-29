// spec: .claude/specs/meta-ui/08-screens-reference.md + 12-screens-rebuild.md
// 原典: design-mockups_v2/08-settings.jsx
// Phase 13-G: SettingsHeader + CategoryRail + Detail + SegmentedControl + Toggle + Slider + RightRail (SYSTEM)

import { useState } from 'react';
import { T, shade } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { SetupButton } from '../shared/Button';
import { useMetaStore, type ThemeName, type DensityName, type CardBackId } from '../state/metaStore';
import { useDecksStore } from '../state/decksStore';
import { useHistoryStore } from '../state/historyStore';
import type { Route } from '../router/routes';

interface Props {
  onNav: (r: Route) => void;
}

type Category = 'play' | 'visual' | 'audio' | 'control' | 'data' | 'about';

const CATEGORIES: { id: Category; label: string; sub: string; icon: string }[] = [
  { id: 'play',    label: '対戦',       sub: 'GAMEPLAY', icon: '⚔' },
  { id: 'visual',  label: '画面',       sub: 'VISUAL',   icon: '◐' },
  { id: 'audio',   label: '音声',       sub: 'AUDIO',    icon: '♪' },
  { id: 'control', label: '操作',       sub: 'CONTROL',  icon: '⌘' },
  { id: 'data',    label: 'データ',     sub: 'DATA',     icon: '⌧' },
  { id: 'about',   label: 'このアプリ', sub: 'ABOUT',    icon: 'i' },
];

export function SettingsScreen({ onNav }: Props) {
  const settings = useMetaStore((s) => s.settings);
  const setSettings = useMetaStore((s) => s.setSettings);
  const decksCount = useDecksStore((s) => s.decks.length);
  const historyCount = useHistoryStore((s) => s.history.length);
  const [cat, setCat] = useState<Category>('visual');

  const onReset = () => {
    if (confirm('localStorage の meta-app データを全削除します。よろしいですか?')) {
      ['conan.meta.v1.settings', 'conan.meta.v1.decks', 'conan.meta.v1.history']
        .forEach((k) => localStorage.removeItem(k));
      window.location.reload();
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
      <AppTopBar page="settings" onNav={(r) => onNav(r as Route)} />
      <Header onReset={onReset} onBack={() => onNav('home')} />

      <div style={{
        position: 'absolute', left: 24, right: 24, top: 134, bottom: 16,
        display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: 14,
      }}>
        <CategoryRail current={cat} onSelect={setCat} />
        <DetailPanel cat={cat}
          theme={settings.theme} density={settings.density} speed={settings.speed} spectatorAi={settings.spectatorAi}
          cardBack={settings.cardBack} bgmVolume={settings.bgmVolume} seEnabled={settings.seEnabled}
          onSettings={setSettings}
        />
        <RightRail decksCount={decksCount} historyCount={historyCount} cardBack={settings.cardBack} />
      </div>
    </div>
  );
}

// ---- Header ----

function Header({ onReset, onBack }: { onReset: () => void; onBack: () => void }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 64, height: 60,
      display: 'flex', alignItems: 'center', padding: '0 24px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
      borderBottom: `1px solid rgba(78,195,255,0.15)`, zIndex: 8,
    }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.18em' }}>SETTINGS</span>
      <span style={{ marginLeft: 12, fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, letterSpacing: '0.06em' }}>設定</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <SetupButton label="戻る" sub="BACK · Esc" onClick={onBack} />
        <button onClick={onReset} style={{
          padding: '8px 14px',
          background: 'rgba(200,64,64,0.15)',
          border: `1px solid ${T.red}66`,
          color: T.red, cursor: 'pointer',
          fontFamily: T.fontJp, fontSize: 12, fontWeight: 700, borderRadius: 3, letterSpacing: '0.08em',
        }}>
          データ削除 · DESTRUCTIVE
        </button>
      </div>
    </div>
  );
}

// ---- Category rail ----

function CategoryRail({ current, onSelect }: { current: Category; onSelect: (c: Category) => void }) {
  return (
    <div style={{
      padding: '14px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        fontFamily: T.fontMono, fontSize: 10, fontWeight: 800, color: T.gold,
        letterSpacing: '0.28em', marginBottom: 6, padding: '0 6px',
      }}>
        CATEGORY
      </div>
      {CATEGORIES.map((c) => {
        const active = c.id === current;
        return (
          <button key={c.id} onClick={() => onSelect(c.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px',
            background: active ? `linear-gradient(90deg, ${T.gold}22, transparent 80%)` : 'transparent',
            border: active ? `1px solid ${T.gold}66` : '1px solid transparent',
            borderRadius: 3, cursor: 'pointer', textAlign: 'left', color: T.textPrimary,
          }}>
            <div style={{
              width: 26, height: 26,
              background: active ? T.gold : 'rgba(0,0,0,0.4)',
              color: active ? '#1a1208' : T.textSecondary,
              border: active ? 'none' : `1px solid rgba(78,195,255,0.3)`,
              borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.fontSerif, fontSize: 13, fontWeight: 800,
            }}>{c.icon}</div>
            <div style={{ flex: 1, lineHeight: 1.2 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: active ? T.gold : T.textPrimary }}>{c.label}</div>
              <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em', marginTop: 1 }}>{c.sub}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---- Detail panel ----

function DetailPanel({ cat, theme, density, speed, spectatorAi, cardBack, bgmVolume, seEnabled, onSettings }: {
  cat: Category;
  theme: ThemeName; density: DensityName; speed: number; spectatorAi: number;
  cardBack: CardBackId; bgmVolume: number; seEnabled: boolean;
  onSettings: (patch: Partial<{ theme: ThemeName; density: DensityName; speed: number; spectatorAi: number; cardBack: CardBackId; bgmVolume: number; seEnabled: boolean }>) => void;
}) {
  return (
    <div style={{
      padding: '18px 20px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.70))',
      border: `1px solid ${T.gold}55`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', overflow: 'auto', gap: 14,
    }}>
      <div>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.3em' }}>
          {CATEGORIES.find((c) => c.id === cat)?.sub}
        </div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, marginTop: 2 }}>
          {CATEGORIES.find((c) => c.id === cat)?.label}
        </div>
      </div>

      {cat === 'visual' && (
        <>
          <Group label="表示テーマ">
            <Row label="テーマ" desc="背景・アクセント色のスキーム" control={
              <SegmentedControl options={[
                { v: 'noir', label: 'NOIR' }, { v: 'crimson', label: 'CRIMSON' },
              ]} value={theme} onChange={(v) => onSettings({ theme: v as ThemeName })} />
            } />
            <Row label="情報密度" desc="盤面の余白量" control={
              <SegmentedControl options={[
                { v: 'compact', label: 'COMPACT' }, { v: 'comfortable', label: 'COMFORTABLE' },
              ]} value={density} onChange={(v) => onSettings({ density: v as DensityName })} />
            } />
          </Group>
          <Group label="演出">
            <Row label={`演出速度: ${speed.toFixed(1)}×`} desc="ヒラメキ/コンタクト演出の倍率" control={
              <Slider value={speed} min={0.5} max={2.0} step={0.1} onChange={(v) => onSettings({ speed: v })} />
            } />
          </Group>
          <Group label="カード裏柄">
            <CardBackSelector value={cardBack} onChange={(v) => onSettings({ cardBack: v })} />
          </Group>
        </>
      )}

      {cat === 'play' && (
        <Group label="観戦 / AI">
          <Row label={`観戦 AI 思考時間: ${spectatorAi}ms`} desc="観察モードでの AI 1 手の所要時間" control={
            <Slider value={spectatorAi} min={200} max={2000} step={100} onChange={(v) => onSettings({ spectatorAi: v })} />
          } />
        </Group>
      )}

      {cat === 'audio' && (
        <Group label="音声 (persist のみ — 実音は Phase 15+)">
          <Row label={`BGM 音量: ${bgmVolume}`} desc="メタゲームの BGM 音量 (将来 audio 実装時に参照)" control={
            <Slider value={bgmVolume} min={0} max={100} step={5} onChange={(v) => onSettings({ bgmVolume: v })} />
          } />
          <Row label="効果音" desc="ボタン押下等の SE" control={
            <Toggle on={seEnabled} onToggle={() => onSettings({ seEnabled: !seEnabled })} />
          } />
        </Group>
      )}

      {cat === 'control' && (
        <Group label="キーボード">
          <Row label="ショートカット" desc="H/D/C/T/S/P/M/R/Y/L で各画面遷移、? でヘルプ" control={<Toggle on onToggle={() => undefined} />} />
        </Group>
      )}

      {cat === 'data' && (
        <Group label="保存データ">
          <Row label="localStorage キー" desc="conan.meta.v1.{settings,decks,history}" control={
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold }}>3 keys</span>
          } />
        </Group>
      )}

      {cat === 'about' && (
        <Group label="このアプリ">
          <Row label="version" desc="meta-app/package.json" control={<span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.textPrimary }}>0.13.0-phase13</span>} />
          <Row label="port" desc="独立 Vite dev server" control={<span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.gold }}>5174</span>} />
          <Row label="原典" desc="design-mockups_v2/" control={<span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.textMuted }}>10 files</span>} />
        </Group>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: T.fontMono, fontSize: 10, fontWeight: 800, color: T.gold, letterSpacing: '0.25em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Row({ label, desc, control }: { label: string; desc: string; control: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '8px 12px',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid rgba(78,195,255,0.15)`, borderRadius: 3,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{label}</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{desc}</div>
      </div>
      <div>{control}</div>
    </div>
  );
}

// ---- SegmentedControl ----

function SegmentedControl<V extends string>({ options, value, onChange }: {
  options: { v: V; label: string }[]; value: V; onChange: (v: V) => void;
}) {
  return (
    <div style={{ display: 'flex', borderRadius: 2, overflow: 'hidden', border: `1px solid rgba(78,195,255,0.3)` }}>
      {options.map((o, i) => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          padding: '5px 12px',
          background: value === o.v ? T.gold : 'rgba(0,0,0,0.3)',
          color: value === o.v ? '#1a1208' : T.textSecondary,
          fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.12em', cursor: 'pointer',
          borderRight: i < options.length - 1 ? `1px solid rgba(78,195,255,0.2)` : 'none',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

// ---- Toggle ----

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 44, height: 22, position: 'relative',
      background: on ? `linear-gradient(180deg, ${T.green}, ${shade(T.green, -0.4)})` : 'rgba(0,0,0,0.4)',
      border: `1px solid ${on ? T.green : T.textMuted}55`, borderRadius: 11, cursor: 'pointer',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 22 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff',
        boxShadow: on ? `0 0 8px ${T.green}` : '0 1px 3px rgba(0,0,0,0.5)',
        transition: 'left 140ms',
      }} />
    </button>
  );
}

// ---- Slider ----

function Slider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input type="range" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: 200 }}
      />
      <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, minWidth: 50, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

// ---- Right rail (SYSTEM) ----

// ---- Card back selector ----

const CARD_BACKS: { id: CardBackId; label: string; gradient: string }[] = [
  { id: 'gold',    label: 'GOLD',    gradient: 'linear-gradient(135deg, #ffd700, #a88a1a)' },
  { id: 'azure',   label: 'AZURE',   gradient: 'linear-gradient(135deg, #4ec3ff, #2b6cb5)' },
  { id: 'crimson', label: 'CRIMSON', gradient: 'linear-gradient(135deg, #ff7ab8, #c84040)' },
  { id: 'jade',    label: 'JADE',    gradient: 'linear-gradient(135deg, #44dd99, #3aa67a)' },
  { id: 'noir',    label: 'NOIR',    gradient: 'linear-gradient(135deg, #2a1b3c, #050a14)' },
];

function CardBackSelector({ value, onChange }: { value: CardBackId; onChange: (v: CardBackId) => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {CARD_BACKS.map((b) => {
        const active = b.id === value;
        return (
          <button key={b.id} onClick={() => onChange(b.id)} style={{
            width: 70, height: 96, padding: 4,
            background: 'rgba(0,0,0,0.4)',
            border: active ? `2px solid ${T.gold}` : `1px solid rgba(78,195,255,0.3)`,
            borderRadius: 4, cursor: 'pointer',
            boxShadow: active ? `0 0 12px ${T.gold}66` : 'none',
            position: 'relative',
          }}>
            <div style={{
              width: '100%', height: 70, background: b.gradient, borderRadius: 2,
              border: '1px solid rgba(0,0,0,0.5)',
            }} />
            <div style={{
              marginTop: 4, fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
              color: active ? T.gold : T.textSecondary, letterSpacing: '0.15em',
            }}>{b.label}</div>
            {active && (
              <div style={{
                position: 'absolute', right: 4, top: 4,
                fontFamily: T.fontMono, fontSize: 9, fontWeight: 800,
                color: '#1a1208', background: T.gold,
                padding: '1px 5px', borderRadius: 1, letterSpacing: '0.1em',
              }}>✓</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function RightRail({ decksCount, historyCount, cardBack }: { decksCount: number; historyCount: number; cardBack: CardBackId }) {
  const back = CARD_BACKS.find((b) => b.id === cardBack)!;
  return (
    <div style={{
      padding: '14px 16px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>SYSTEM</div>
      <SysRow label="meta-app version" value="0.13.0-phase13" />
      <SysRow label="port" value="5174 · localhost" valueColor={T.gold} />
      <SysRow label="保存デッキ" value={`${decksCount}`} valueColor={T.neonBlue} />
      <SysRow label="履歴件数" value={`${historyCount}`} valueColor={T.green} />
      <SysRow label="namespace" value="conan.meta.v1.*" />
      <SysRow label="src/ 不変" value="✓" valueColor={T.green} />
      <SysRow label="既存 5173" value="port 5173" />
      <div style={{
        marginTop: 4, padding: '6px 8px',
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid rgba(78,195,255,0.2)`, borderRadius: 3,
      }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.16em', marginBottom: 4 }}>
          CARD BACK · 現在
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 44, background: back.gradient,
            border: '1px solid rgba(0,0,0,0.5)', borderRadius: 2,
          }} />
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, fontWeight: 700 }}>{back.label}</span>
        </div>
      </div>
      <div style={{
        marginTop: 4, padding: '8px 10px',
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${T.gold}33`, borderRadius: 3,
        fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em', lineHeight: 1.5,
      }}>
        meta-app は src/ を完全不変のまま import で再利用しています。
      </div>
    </div>
  );
}

function SysRow({ label, value, valueColor = '#e0ecf8' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '3px 0', borderBottom: '1px dashed rgba(78,195,255,0.12)',
      fontSize: 11,
    }}>
      <span style={{ color: T.textMuted, fontFamily: T.fontMono, letterSpacing: '0.12em' }}>{label}</span>
      <span style={{ color: valueColor, fontFamily: T.fontMono, fontWeight: 700 }}>{value}</span>
    </div>
  );
}
