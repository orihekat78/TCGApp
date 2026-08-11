interface GameRuntimeModule {
  registerAll(): void;
  endMatchSession(options?: { preserveGameState?: boolean }): void;
}

type GameRuntimeLoader = () => Promise<GameRuntimeModule>;

const loadGameRuntime: GameRuntimeLoader = () => import('./gameRuntimeBundle');

export function createGameRuntime(load: GameRuntimeLoader = loadGameRuntime) {
  let runtime: Promise<void> | undefined;
  let endMatchSession: GameRuntimeModule['endMatchSession'] | undefined;

  return {
    ensureReady(): Promise<void> {
      if (runtime) return runtime;

      const attempt = load().then((loaded) => {
        loaded.registerAll();
        endMatchSession = loaded.endMatchSession;
      });
      const ownedAttempt = attempt.catch((error: unknown) => {
        if (runtime === ownedAttempt) runtime = undefined;
        throw error;
      });
      runtime = ownedAttempt;
      return ownedAttempt;
    },
    endMatchSession(options: { preserveGameState?: boolean } = {}): void {
      endMatchSession?.(options);
    },
  };
}

const gameRuntime = createGameRuntime();

export const ensureGameRuntimeReady = () => gameRuntime.ensureReady();
export const endLoadedMatchSession = (options: { preserveGameState?: boolean } = {}) => {
  gameRuntime.endMatchSession(options);
};
