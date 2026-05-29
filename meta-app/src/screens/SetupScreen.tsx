// spec: .claude/specs/meta-ui/06-screens-play-flow.md + 10-integration-with-src.md + 12-screens-rebuild.md
// 原典: design-mockups_v2/08-setup.jsx
// Phase 11-C ロジック (performGameStart async + setGameState + setSpectatorMode + toDeckId + nav('match') 先実行) は保持
// Phase 13-B: UI rebuild (ModeTile + PlayerConfigPanel + ConfigRow + MiniMetric + SwapButton + SetupMatchOptions)

import { useState } from 'react';
import { T, shade } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { SetupButton, SetupReadyButton } from '../shared/Button';
import { MetaCard } from '../shared/MetaCard';
import { useDecksStore } from '../state/decksStore';
import { CARD_POOL } from '../data/cardPool';
import type { Route } from '../router/routes';
import type { DeckRecord } from '../data/types';
import { useGameStateStore } from '@/ui/state/store';
import { isPlayable } from '../util/deckBridge';
import { customGameStart } from '../util/customGameStart';
import { useTutorialStore } from '@/ui/state/tutorialStore';

interface Props {
  onNav: (r: Route) => void;
}

type Mode = 'solo' | 'observe';

export function SetupScreen({ onNav }: Props) {
  const decks = useDecksStore((s) => s.decks);
  const [mode, setMode] = useState<Mode>('solo');
  const [selfDeckId, setSelfDeckId] = useState<string>(decks[0]?.id ?? '');
  const [oppDeckId, setOppDeckId] = useState<string>(decks[1]?.id ?? decks[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const selfDeck = decks.find((d) => d.id === selfDeckId);
  const oppDeck = decks.find((d) => d.id === oppDeckId);
  const ready = isPlayable(selfDeck) && isPlayable(oppDeck);

  const handleReady = () => {
    if (!selfDeck || !oppDeck) return;
    if (!isPlayable(selfDeck) || !isPlayable(oppDeck)) {
      setError('デッキ検証エラー: 40 枚ちょうど + 同 ID ≤ 3 + パートナー必須を満たす必要があります');
      return;
    }
    setError(null);
    useGameStateStore.getState().setSpectatorMode(mode === 'observe');
    useTutorialStore.getState().exit(); // 通常対戦はガイド overlay を出さない (Phase 17-D)
    onNav('match');
    // Phase 14-A: customGameStart で任意 DeckRecord ペアから実機対戦を開始
    customGameStart(selfDeck, oppDeck)
      .then((gs) => useGameStateStore.getState().setGameState(gs))
      .catch((err: unknown) => {
        console.error('[Phase 14] customGameStart failed:', err);
        setError(String(err));
        onNav('setup');
      });
  };

  const handleSwap = () => {
    const tmp = selfDeckId;
    setSelfDeckId(oppDeckId);
    setOppDeckId(tmp);
  };

  const handleRandomize = () => {
    if (decks.length < 1) return;
    const self = decks[Math.floor(Math.random() * decks.length)]!;
    const opp = decks[Math.floor(Math.random() * decks.length)]!;
    setSelfDeckId(self.id);
    setOppDeckId(opp.id);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: T.fontJp, color: T.textPrimary }}>
      <AppTopBar page="setup" onNav={(r) => onNav(r as Route)} />

      <div style={{ position: 'absolute', left: 0, right: 0, top: 84, textAlign: 'center' }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.gold, letterSpacing: '0.4em' }}>
          MATCH SETUP
        </div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, letterSpacing: '0.18em', marginTop: 4 }}>
          対 戦 準 備
        </div>
      </div>

      <div style={{ position: 'absolute', left: '50%', top: 156, transform: 'translateX(-50%)', display: 'flex', gap: 22 }}>
        <ModeTile active={mode === 'solo'} title="単独捜査" sub="SOLO INVESTIGATION"
          tag="あなたが探偵側" desc="あなたが操作。相手は AI。標準のプレイモード。"
          iconLeft="YOU" iconRight="AI" accentLeft={T.green} accentRight={T.purple}
          onClick={() => setMode('solo')} />
        <ModeTile active={mode === 'observe'} title="観察ルーム" sub="OBSERVE MODE"
          tag="AI 同士の検証" desc="両プレイヤーを AI が操作。デッキ検証や AI 挙動の観察に。"
          iconLeft="AI" iconRight="AI" accentLeft={T.neonBlue} accentRight={T.purple}
          onClick={() => setMode('observe')} />
      </div>

      <div style={{
        position: 'absolute', left: 60, right: 60, top: 440,
        display: 'flex', gap: 18, justifyContent: 'center', alignItems: 'flex-start',
      }}>
        <PlayerConfigPanel slot="P1" label="プレイヤー 1" mode={mode === 'observe' ? 'cpu' : 'human'}
          deck={selfDeck} decks={decks} onSelectDeck={setSelfDeckId} />
        <SwapButton onClick={handleSwap} />
        <PlayerConfigPanel slot="P2" label="プレイヤー 2" mode="cpu"
          deck={oppDeck} decks={decks} onSelectDeck={setOppDeckId} />
      </div>

      <SetupMatchOptions />

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 48,
        display: 'flex', justifyContent: 'center', gap: 14, alignItems: 'center',
      }}>
        <SetupButton label="戻る" sub="BACK" onClick={() => onNav('home')} />
        <SetupButton label="ランダム" sub="RANDOMIZE" onClick={handleRandomize} />
        {ready ? (
          <SetupReadyButton onClick={handleReady} />
        ) : (
          <div style={{
            padding: '8px 14px', color: T.red,
            background: 'rgba(200,64,64,0.12)',
            border: `1px solid ${T.red}66`, borderRadius: 3,
            fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em',
          }}>
            検証 NG · 40 枚 + ID ≤ 3 + パートナー必須
          </div>
        )}
      </div>

      {error && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)',
          padding: '6px 12px', color: T.red, maxWidth: 600, textAlign: 'center',
          background: 'rgba(200,64,64,0.12)', border: `1px solid ${T.red}66`, borderRadius: 3,
          fontFamily: T.fontMono, fontSize: 11,
        }}>{error}</div>
      )}
    </div>
  );
}

// ---- ModeTile ----

function ModeTile({ active, title, sub, tag, desc, iconLeft, iconRight, accentLeft, accentRight, onClick }: {
  active: boolean; title: string; sub: string; tag: string; desc: string;
  iconLeft: string; iconRight: string; accentLeft: string; accentRight: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      width: 420, height: 252, padding: '22px 24px',
      background: active
        ? `linear-gradient(180deg, rgba(255,215,0,0.12), rgba(13,38,64,0.95))`
        : 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: active ? `2px solid ${T.gold}` : `1px solid rgba(78,195,255,0.25)`,
      borderRadius: 4,
      boxShadow: active
        ? `0 0 28px ${T.gold}33, 0 12px 24px rgba(0,0,0,0.6)`
        : `0 8px 18px rgba(0,0,0,0.5)`,
      cursor: 'pointer', position: 'relative', textAlign: 'left',
      color: T.textPrimary,
      transition: 'all 150ms',
    }}>
      {active && (
        <div style={{
          position: 'absolute', right: 14, top: 14,
          padding: '2px 8px', background: T.gold, color: '#1a1208',
          fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.18em', borderRadius: 2,
        }}>SELECTED</div>
      )}
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: active ? T.gold : T.textMuted, letterSpacing: '0.3em' }}>{sub}</div>
      <div style={{ fontFamily: T.fontSerif, fontSize: 28, fontWeight: 800, letterSpacing: '0.06em', marginTop: 2 }}>{title}</div>
      <div style={{
        display: 'inline-block', marginTop: 6, padding: '2px 10px',
        fontSize: 11, color: T.neonBlue,
        background: 'rgba(78,195,255,0.12)',
        border: `1px solid ${T.neonBlue}55`, borderRadius: 2,
      }}>{tag}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18, marginBottom: 10 }}>
        <ModeAvatar label={iconLeft} accent={accentLeft} />
        <div style={{ fontFamily: T.fontSerif, fontSize: 26, fontWeight: 800, color: T.gold, letterSpacing: '0.1em' }}>vs</div>
        <ModeAvatar label={iconRight} accent={accentRight} />
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>{desc}</div>
    </button>
  );
}

function ModeAvatar({ label, accent }: { label: string; accent: string }) {
  return (
    <div style={{
      width: 60, height: 60, borderRadius: 4,
      background: `linear-gradient(135deg, ${accent}aa, ${shade(accent, -0.4)})`,
      border: `2px solid ${shade(accent, 0.2)}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: T.fontMono, fontSize: 20, fontWeight: 800, color: '#fff',
      letterSpacing: '0.05em',
      boxShadow: `0 0 12px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
    }}>
      {label}
    </div>
  );
}

// ---- Player config panel ----

function PlayerConfigPanel({ slot, label, mode, deck, decks, onSelectDeck }: {
  slot: string; label: string; mode: 'human' | 'cpu';
  deck: DeckRecord | undefined; decks: DeckRecord[]; onSelectDeck: (id: string) => void;
}) {
  const partner = deck ? CARD_POOL.find((c) => c.num === deck.partner) : undefined;
  const isHuman = mode === 'human';
  const accent = isHuman ? T.green : T.purple;
  return (
    <div style={{
      width: 480, padding: '16px 18px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.92), rgba(13,38,64,0.65))',
      border: `1.5px solid ${accent}66`, borderRadius: 4,
      boxShadow: `0 0 18px ${accent}22, 0 8px 18px rgba(0,0,0,0.5)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{
          fontFamily: T.fontMono, fontSize: 13, fontWeight: 800,
          color: accent, letterSpacing: '0.2em',
          padding: '4px 10px', background: `${accent}22`, borderRadius: 2,
        }}>{slot}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>{label}</span>
        <span style={{
          marginLeft: 'auto', padding: '3px 10px',
          background: `${accent}22`, border: `1px solid ${accent}66`, borderRadius: 2,
          fontFamily: T.fontMono, fontSize: 10, fontWeight: 800,
          color: accent, letterSpacing: '0.2em',
        }}>
          {isHuman ? 'DETECTIVE' : 'AI'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        {partner && (
          <div style={{ filter: `drop-shadow(0 0 10px ${accent}55)` }}>
            <MetaCard card={partner} w={110} badge="partner" hoverable={false} />
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ConfigSelect label="デッキ" value={deck?.id ?? ''} accent={T.neonBlue}
            options={decks.map((d) => ({ id: d.id, label: d.name }))}
            onChange={onSelectDeck} />
          <ConfigRow label="パートナー" value={partner?.name ?? '—'} accent={T.gold} />
          {!isHuman ? (
            <>
              <ConfigRow label="AI 難易度" value="標準" accent={T.purple} />
              <ConfigRow label="戦略" value="サンプルプリセット" accent={T.purple} />
            </>
          ) : (
            <ConfigRow label="プレイヤー" value="TANTEI_01 · 探偵 II" accent={T.green} />
          )}
        </div>
      </div>

      <div style={{
        marginTop: 12, padding: '10px 12px',
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${accent}33`, borderRadius: 3,
        display: 'flex', gap: 18,
      }}>
        <MiniMetric label="枚数" value={`${deck?.cards.reduce((s, e) => s + e.count, 0) ?? 0}`} accent={T.neonBlue} />
        <MiniMetric label="種類" value={`${deck?.cards.length ?? 0}`} accent={T.gold} />
        <MiniMetric label="モード" value={isHuman ? 'HUMAN' : 'CPU'} accent={accent} />
      </div>
    </div>
  );
}

function ConfigRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 10px', background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${accent}33`, borderRadius: 2,
    }}>
      <div style={{
        width: 80, flexShrink: 0, fontFamily: T.fontMono, fontSize: 10, fontWeight: 700,
        color: T.textMuted, letterSpacing: '0.15em',
      }}>{label}</div>
      <div style={{ flex: 1, fontSize: 12, color: T.textPrimary, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function ConfigSelect({ label, value, accent, options, onChange }: {
  label: string; value: string; accent: string;
  options: { id: string; label: string }[]; onChange: (id: string) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 10px', background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${accent}33`, borderRadius: 2,
    }}>
      <div style={{
        width: 80, flexShrink: 0, fontFamily: T.fontMono, fontSize: 10, fontWeight: 700,
        color: T.textMuted, letterSpacing: '0.15em',
      }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        flex: 1, padding: '3px 8px',
        background: 'rgba(0,0,0,0.6)', color: T.textPrimary,
        border: `1px solid ${accent}55`, borderRadius: 2,
        fontFamily: T.fontJp, fontSize: 12, cursor: 'pointer',
      }}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

function MiniMetric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ lineHeight: 1.2 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.18em' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 14, fontWeight: 800, color: accent, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function SwapButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 46, alignSelf: 'center', padding: '18px 0',
      background: 'rgba(0,0,0,0.5)', border: `1px solid ${T.gold}66`,
      borderRadius: 4, cursor: 'pointer', textAlign: 'center',
    }}>
      <svg width="20" height="20" viewBox="0 0 22 22" style={{ margin: '0 auto', display: 'block' }} aria-hidden="true">
        <path d="M3 8 L17 8 L13 4 M19 14 L5 14 L9 18" stroke={T.gold} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.gold, letterSpacing: '0.2em', marginTop: 4 }}>SWAP</div>
    </button>
  );
}

// ---- Match options ----

function SetupMatchOptions() {
  // 視覚のみ (実エンジン behavior は performGameStart の引数経由ではなく、将来カスタム options で対応)
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 110, transform: 'translateX(-50%)',
      display: 'flex', gap: 22,
      padding: '12px 22px', background: 'rgba(0,0,0,0.5)',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
    }}>
      <OptionToggle label="先攻" options={['P1', 'P2', 'ランダム']} active={2} />
      <OptionToggle label="演出速度" options={['0.5×', '1.0×', '1.5×', '2.0×']} active={1} />
      <OptionToggle label="自動進行" options={['ON', 'OFF']} active={0} />
      <OptionToggle label="効果ログ" options={['簡易', '詳細', '非表示']} active={1} />
    </div>
  );
}

function OptionToggle({ label, options, active }: { label: string; options: string[]; active: number }) {
  return (
    <div>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', borderRadius: 2, overflow: 'hidden', border: `1px solid rgba(78,195,255,0.3)` }}>
        {options.map((o, i) => (
          <span key={i} style={{
            padding: '4px 10px',
            background: i === active ? T.gold : 'rgba(0,0,0,0.3)',
            color: i === active ? '#1a1208' : T.textSecondary,
            fontFamily: T.fontJp, fontSize: 11, fontWeight: 700,
            borderRight: i < options.length - 1 ? `1px solid rgba(78,195,255,0.2)` : 'none',
          }}>{o}</span>
        ))}
      </div>
    </div>
  );
}
