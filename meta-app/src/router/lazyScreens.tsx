import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ensureGameRuntimeReady } from '../services/gameRuntime';

type ScreenModule<ExportName extends string, Props> = Record<ExportName, ComponentType<Props>>;

function RouteLoading() {
  const loadingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadingRef.current?.focus();
  }, []);

  return (
    <main ref={loadingRef} aria-label="画面を読み込み中" aria-live="polite" tabIndex={-1}>
      画面を読み込んでいます…
    </main>
  );
}

function RouteLoadError({ onRetry }: { onRetry(): void }) {
  const errorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    errorRef.current?.focus();
  }, []);

  return (
    <main ref={errorRef} role="alert" tabIndex={-1}>
      <p>画面を読み込めませんでした。通信状態を確認して、もう一度お試しください。</p>
      <button type="button" onClick={onRetry}>再試行</button>
    </main>
  );
}

function RouteReady({ children }: { children: ReactNode }) {
  const readyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) {
      readyRef.current?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <div
      ref={readyRef}
      data-testid="lazy-route-content"
      tabIndex={-1}
      style={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', minHeight: 0, minWidth: 0 }}
    >
      {children}
    </div>
  );
}

class RouteErrorBoundary extends Component<{
  children: ReactNode;
  onRetry(): void;
}, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <RouteLoadError onRetry={this.props.onRetry} />;
    }
    return this.props.children;
  }
}

export function createLazyRoute<Props, ExportName extends string>(
  load: () => Promise<ScreenModule<ExportName, Props>>,
  exportName: ExportName,
  prepare?: () => Promise<void>,
): ComponentType<Props> {
  return function LazyRoute(props: Props) {
    const [attempt, setAttempt] = useState(0);
    const Screen = useMemo(() => {
      // A new Lazy component is the retry boundary after a rejected import.
      void attempt;
      return lazy(async () => {
        if (prepare) await prepare();
        const screen = await load();
        const LoadedScreen = screen[exportName];
        return {
          default: (loadedProps: Props) => (
            <RouteReady>
              <LoadedScreen {...loadedProps} />
            </RouteReady>
          ),
        };
      });
    }, [attempt]);

    return (
      <RouteErrorBoundary key={attempt} onRetry={() => setAttempt((value) => value + 1)}>
        <Suspense fallback={<RouteLoading />}>
          <Screen {...props} />
        </Suspense>
      </RouteErrorBoundary>
    );
  };
}

export const lazyScreens = {
  setup: createLazyRoute(() => import('../screens/SetupScreen'), 'SetupScreen', ensureGameRuntimeReady),
  match: createLazyRoute(() => import('../screens/RealMatchView'), 'RealMatchView', ensureGameRuntimeReady),
  result: createLazyRoute(() => import('../screens/ResultScreen'), 'ResultScreen', ensureGameRuntimeReady),
  deck: createLazyRoute(() => import('../screens/DeckEditor'), 'DeckEditor'),
  cards: createLazyRoute(() => import('../screens/CardsScreen'), 'CardsScreen'),
  history: createLazyRoute(() => import('../screens/HistoryScreen'), 'HistoryRoute'),
  replay: createLazyRoute(() => import('../screens/ReplayScreen'), 'ReplayScreen', ensureGameRuntimeReady),
  tutorial: createLazyRoute(() => import('../screens/TutorialScreen'), 'TutorialScreen', ensureGameRuntimeReady),
  settings: createLazyRoute(() => import('../screens/SettingsScreen'), 'SettingsScreen'),
};
