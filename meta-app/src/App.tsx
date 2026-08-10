// spec: .claude/specs/meta-ui/03-routing.md
// 全画面の配線 + キーボードショートカット + ヘルプオーバーレイ

import { useCallback, useEffect, useRef } from 'react';
import { useHashRoute } from './router/useHashRoute';
import { useGlobalShortcuts } from './router/useGlobalShortcuts';
import type { Route } from './router/routes';
import type {
  NavigationBlocker,
  RegisterNavigationBlocker,
  RouteLeaveGuard,
} from './router/navigationBlocker';
import { MetaShell } from './MetaShell';
import { HelpOverlay } from './shared/HelpOverlay';
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
import { endMatchSession } from '@/ui/services/matchSession';
import { useMetaStore } from './state/metaStore';
import { useHistoryStore } from './state/historyStore';
import { listStoredHistoryRows } from './services/historyReplayRepository';
import { clearReplayReturnFocus } from './services/replayReturnFocus';

function clearFinishedMatch(): void {
  const meta = useMetaStore.getState();
  meta.clearMatchMeta();
  meta.clearPendingPractice();
  endMatchSession();
}

function leaveActiveMatch(next: Route): void {
  const preserveForResult = next === 'result';
  endMatchSession({ preserveGameState: preserveForResult });
  if (preserveForResult) return;
  const meta = useMetaStore.getState();
  meta.clearMatchMeta();
  meta.clearPendingPractice();
}

export function App() {
  const navigationBlocker = useRef<NavigationBlocker | null>(null);
  const confirmRouteLeave = useCallback<RouteLeaveGuard>((change) => (
    navigationBlocker.current?.confirmRouteLeave(change) ?? true
  ), []);
  const registerNavigationBlocker = useCallback<RegisterNavigationBlocker>((blocker) => {
    navigationBlocker.current = blocker;
    return () => {
      if (navigationBlocker.current === blocker) navigationBlocker.current = null;
    };
  }, []);
  const [route, rawNav] = useHashRoute(confirmRouteLeave);
  const previousRoute = useRef(route);
  const currentRoute = useRef(route);
  currentRoute.current = route;

  const nav = useCallback((next: Route) => {
    if (!rawNav(next)) return;
    // Settle mulligan/picker promises before the route owner unmounts. The
    // passive effect below remains a backstop for browser/hash navigation.
    if (currentRoute.current === 'match' && next !== 'match') {
      leaveActiveMatch(next);
    }
    if (currentRoute.current === 'result' && next !== 'result') clearFinishedMatch();
    if (currentRoute.current === 'replay' && next !== 'history') clearReplayReturnFocus();
    previousRoute.current = next;
  }, [rawNav]);
  const { helpOpen, setHelpOpen } = useGlobalShortcuts({ route, onNav: nav });

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!navigationBlocker.current?.shouldWarnBeforeUnload()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listStoredHistoryRows().then((records) => {
      if (!cancelled) {
        const history = useHistoryStore.getState();
        history.mergeCanonical(records);
        history._setCanonicalLoaded(true);
      }
    }).catch(() => {
      if (!cancelled) useHistoryStore.getState()._setCanonicalLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const previous = previousRoute.current;
    previousRoute.current = route;
    if (previous === 'match' && route !== 'match') {
      leaveActiveMatch(route);
    }
    if (previous === 'result' && route !== 'result') clearFinishedMatch();
    if (previous === 'replay' && route !== 'history') clearReplayReturnFocus();
  }, [route]);

  useEffect(() => () => {
    endMatchSession();
    const meta = useMetaStore.getState();
    meta.clearMatchMeta();
    meta.clearPendingPractice();
  }, []);

  return (
    <>
      <MetaShell route={route}>
        {renderScreen(route, nav, registerNavigationBlocker)}
      </MetaShell>
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

function renderScreen(
  route: Route,
  nav: (r: Route) => void,
  registerNavigationBlocker: RegisterNavigationBlocker,
) {
  switch (route) {
    case 'home':
      return <HomeScreen onNav={nav} />;
    case 'setup':
      return <SetupScreen onNav={nav} />;
    case 'match':
      // Phase 11-D: src/ の Playmat + 14 modals + 4 driver hooks を 5174 内に配置
      return (
        <RealMatchView
          onMatchEnd={() => nav('result')}
          onReturnToSetup={() => nav('setup')}
        />
      );
    case 'result':
      return (
        <ResultScreen
          onNav={nav}
          onRematch={() => nav('setup')}
        />
      );
    case 'deck':
      return <DeckEditor onNav={nav} registerNavigationBlocker={registerNavigationBlocker} />;
    case 'cards':
      return <CardsScreen onNav={nav} />;
    case 'history':
      return <HistoryScreen onNav={nav} />;
    case 'replay':
      return <ReplayScreen onNav={nav} />;
    case 'tutorial':
      return <TutorialScreen onNav={nav} />;
    case 'settings':
      return <SettingsScreen onNav={nav} registerNavigationBlocker={registerNavigationBlocker} />;
  }
}
