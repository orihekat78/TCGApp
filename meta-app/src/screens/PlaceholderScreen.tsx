// spec: .claude/specs/meta-ui/03-routing.md
// 10-D 用プレースホルダー — 10-E〜10-H で各画面が個別実装される

import { T } from '../shared/tokens';
import { AppTopBar } from '../shared/AppTopBar';
import { SetupReadyButton } from '../shared/Button';
import type { Route } from '../router/routes';

interface Props {
  route: Route;
  onNav: (r: Route) => void;
}

const LABELS: Record<Route, string> = {
  home:     'HOME · ホーム',
  setup:    'SETUP · 対戦準備',
  match:    'MATCH · 対戦中',
  result:   'RESULT · 対戦結果',
  deck:     'DECK · デッキ編集',
  cards:    'CARDS · カードリスト',
  history:  'HISTORY · 対戦履歴',
  replay:   'REPLAY · リプレイ',
  tutorial: 'TUTORIAL · チュートリアル',
  settings: 'SETTINGS · 設定',
};

export function PlaceholderScreen({ route, onNav }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <AppTopBar page={route} onNav={(r) => onNav(r as Route)} />
      <div style={{
        position: 'absolute', inset: '64px 0 0 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 24,
      }}>
        <div style={{
          fontFamily: T.fontSerif,
          fontSize: 28,
          fontWeight: 800,
          color: T.gold,
          letterSpacing: '0.08em',
        }}>
          {LABELS[route]}
        </div>
        <div style={{
          fontFamily: T.fontMono,
          fontSize: 11,
          color: T.textMuted,
          letterSpacing: '0.2em',
        }}>
          Phase 10-D ROUTER OK · 画面実装は 10-E〜10-H で
        </div>
        {route === 'home' && (
          <div style={{ marginTop: 16 }}>
            <SetupReadyButton onClick={() => onNav('setup')} />
          </div>
        )}
        <div style={{
          marginTop: 32,
          fontFamily: T.fontMono,
          fontSize: 10,
          color: T.textDisabled,
          textAlign: 'center',
          lineHeight: 1.8,
        }}>
          試遷移: <kbd>#home</kbd> · <kbd>#setup</kbd> · <kbd>#deck</kbd> · <kbd>#cards</kbd>
          <br />
          <kbd>#history</kbd> · <kbd>#tutorial</kbd> · <kbd>#settings</kbd>
        </div>
      </div>
    </div>
  );
}
