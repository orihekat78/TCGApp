// spec: .claude/specs/meta-ui/03-routing.md
// `?` キーで開く キーボードショートカット一覧オーバーレイ

import { T } from './tokens';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ROWS: { key: string; action: string }[] = [
  { key: 'H', action: 'HOME · ホーム' },
  { key: 'P', action: 'SETUP · 対戦準備' },
  { key: 'M', action: 'MATCH · 対戦中 (loading)' },
  { key: 'R', action: 'RESULT · 対戦結果' },
  { key: 'D', action: 'DECK · デッキ編集' },
  { key: 'C', action: 'CARDS · カード一覧' },
  { key: 'Y', action: 'HISTORY · 対戦履歴' },
  { key: 'L', action: 'REPLAY · リプレイ' },
  { key: 'T', action: 'TUTORIAL · チュートリアル' },
  { key: 'S', action: 'SETTINGS · 設定' },
  { key: 'Enter', action: '推理開始 (HOME 時)' },
  { key: 'Esc / Backspace', action: '戻る (HOME へ)' },
  { key: '?', action: 'このヘルプ' },
];

export function HelpOverlay({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, backdropFilter: 'blur(4px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'rgba(10,26,40,0.95)',
        border: `1px solid ${T.gold}66`,
        borderRadius: 6, padding: 32, minWidth: 480,
        boxShadow: `0 0 40px rgba(255,215,0,0.18)`,
        fontFamily: T.fontJp, color: T.textPrimary,
      }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 11, color: T.gold,
          letterSpacing: '0.3em', marginBottom: 8,
        }}>
          KEYBOARD SHORTCUTS
        </div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, marginBottom: 18 }}>
          キーボードショートカット
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ROWS.map((r) => (
            <div key={r.key} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '4px 0', borderBottom: '1px dashed rgba(255,215,0,0.10)',
              fontSize: 13,
            }}>
              <kbd style={{
                minWidth: 90, padding: '2px 10px',
                background: 'rgba(255,215,0,0.10)',
                border: `1px solid ${T.gold}55`,
                color: T.gold, borderRadius: 2,
                fontFamily: T.fontMono, fontWeight: 700, fontSize: 11,
                letterSpacing: '0.14em', textAlign: 'center',
              }}>{r.key}</kbd>
              <span style={{ color: T.textSecondary }}>{r.action}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, textAlign: 'right' }}>
          <button onClick={onClose} style={{
            padding: '6px 14px',
            background: 'transparent',
            border: `1px solid ${T.neonBlue}66`,
            color: T.neonBlue,
            fontFamily: T.fontMono, fontSize: 11,
            letterSpacing: '0.2em', cursor: 'pointer', borderRadius: 2,
          }}>
            CLOSE (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
