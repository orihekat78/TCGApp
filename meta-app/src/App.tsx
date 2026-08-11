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
import { LandscapeGate } from './shared/LandscapeGate';
import { HomeScreen } from './screens/HomeScreen';
import { lazyScreens } from './router/lazyScreens';
import { endLoadedMatchSession } from './services/gameRuntime';
import { useMetaStore } from './state/metaStore';
import { useDecksStore } from './state/decksStore';
import { useHistoryStore } from './state/historyStore';
import { listStoredHistoryRows } from './services/historyRowsRepository';
import { clearReplayReturnFocus } from './services/replayReturnFocus';
import { acquireCloudSyncRuntime } from './cloud/runtime';

const {
  setup: SetupScreen,
  match: RealMatchView,
  result: ResultScreen,
  deck: DeckEditor,
  cards: CardsScreen,
  history: HistoryScreen,
  replay: ReplayScreen,
  tutorial: TutorialScreen,
  settings: SettingsScreen,
} = lazyScreens;

function clearFinishedMatch(): void {
  const meta = useMetaStore.getState();
  meta.clearMatchMeta();
  meta.clearPendingPractice();
  endLoadedMatchSession();
}

function leaveActiveMatch(next: Route): void {
  const preserveForResult = next === 'result';
  endLoadedMatchSession({ preserveGameState: preserveForResult });
  if (preserveForResult) return;
  const meta = useMetaStore.getState();
  meta.clearMatchMeta();
  meta.clearPendingPractice();
}

export function App() {
  const decksHydrated = useDecksStore((state) => state._hasHydrated);
  const historyHydrated = useHistoryStore((state) => state._hasHydrated);
  const historyCanonicalLoaded = useHistoryStore((state) => state._hasCanonicalLoaded);
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
    if (!decksHydrated || !historyHydrated || !historyCanonicalLoaded) return undefined;
    return acquireCloudSyncRuntime();
  }, [decksHydrated, historyCanonicalLoaded, historyHydrated]);

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
    endLoadedMatchSession();
    const meta = useMetaStore.getState();
    meta.clearMatchMeta();
    meta.clearPendingPractice();
  }, []);

  return (
    <LandscapeGate>
      <MetaShell route={route}>
        {renderScreen(route, nav, registerNavigationBlocker)}
      </MetaShell>
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </LandscapeGate>
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
