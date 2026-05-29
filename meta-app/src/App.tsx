// spec: .claude/specs/meta-ui/03-routing.md
// 全画面の配線 + キーボードショートカット + ヘルプオーバーレイ

import { useState } from 'react';
import { useHashRoute } from './router/useHashRoute';
import { useGlobalShortcuts } from './router/useGlobalShortcuts';
import type { Route } from './router/routes';
import { MetaShell } from './MetaShell';
import { HelpOverlay } from './shared/HelpOverlay';
import { NavHUD } from './shared/NavHUD';
import { HomeScreen } from './screens/HomeScreen';
import { SetupScreen } from './screens/SetupScreen';
import { RealMatchView } from './screens/RealMatchView';
import { ResultScreen } from './screens/ResultScreen';
import { DeckEditor } from './screens/DeckEditor';
import { CardsScreen } from './screens/CardsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ReplayScreen } from './screens/ReplayScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export function App() {
  const [route, nav] = useHashRoute();
  // Phase 11-C: SETUP→MATCH 遷移は SetupScreen 内で performGameStart + setGameState 経由
  // で完結するため、matchId の受け渡しは不要 (ResultScreen は useGameStateStore 直読)
  const [selectedReplayId, setSelectedReplayId] = useState<string | undefined>(undefined);
  const { helpOpen, setHelpOpen } = useGlobalShortcuts({ route, onNav: nav });

  const onReplay = (matchId: string) => {
    setSelectedReplayId(matchId);
    nav('replay');
  };

  return (
    <>
      <MetaShell route={route}>
        {renderScreen(route, nav, selectedReplayId, onReplay)}
      </MetaShell>
      <NavHUD route={route} onNav={nav} visible={import.meta.env.DEV} />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

function renderScreen(
  route: Route,
  nav: (r: Route) => void,
  selectedReplayId: string | undefined,
  onReplay: (id: string) => void
) {
  switch (route) {
    case 'home':
      return <HomeScreen onNav={nav} />;
    case 'setup':
      return <SetupScreen onNav={nav} />;
    case 'match':
      // Phase 11-D: src/ の Playmat + 14 modals + 4 driver hooks を 5174 内に配置
      return <RealMatchView onMatchEnd={() => nav('result')} />;
    case 'result':
      return (
        <ResultScreen
          onNav={nav}
          onNext={() => nav('setup')}
          onRematch={() => nav('setup')}
        />
      );
    case 'deck':
      return <DeckEditor onNav={nav} />;
    case 'cards':
      return <CardsScreen onNav={nav} />;
    case 'history':
      return <HistoryScreen onNav={nav} onReplay={onReplay} />;
    case 'replay':
      return <ReplayScreen matchId={selectedReplayId} onNav={nav} />;
    case 'tutorial':
      return <TutorialScreen onNav={nav} />;
    case 'settings':
      return <SettingsScreen onNav={nav} />;
  }
}
