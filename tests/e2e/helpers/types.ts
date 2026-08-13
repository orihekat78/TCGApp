// E2E test 共通型定義 — bug-006 / bug-029 / 47cards pattern spec で再利用
// window.__game の expose は src/main.tsx (DEV 限定) を参照

export type GameWindow = {
  __game: {
    getState: () => { gameState: unknown; activeActionId: string | null };
    setGameState: (gs: unknown) => void;
    createSampleGameState: () => unknown;
    dispatch: (action: unknown) => unknown;
    getActionContext: (id: string) => {
      id: string;
      phase: string;
      byPlayer?: 'self' | 'opp';
      byUid?: string;
      firstUid?: string;
      secondUid?: string;
      cutInUsed?: Record<string, boolean>;
    } | null;
    flow: unknown;
    testApi: Promise<{
      persistPendingRuntimeState: (state: unknown) => void;
      produce: (state: unknown, recipe: (draft: unknown) => void) => unknown;
      resetPendingRuntimeState: () => void;
      resetPresentationQueue: (sessionId: string) => void;
      runAtom: (state: unknown, verb: string, args: unknown, ctx: unknown) => void;
      startCausalSession: (state: unknown, sessionId: string) => void;
    }>;
    read: {
      char: {
        keywords: (state: unknown, uid: string) => string[];
        hasKeyword: (state: unknown, uid: string, kw: string) => boolean;
      };
    };
  };
};

export type Side = 'self' | 'opp';

export type SceneChar = {
  uid: string;
  cardId: string;
  state: 'active' | 'sleep' | 'stun';
  isNamed: boolean;
};

export type GameStateLike = {
  players: {
    self: {
      scene: SceneChar[];
      evidence: unknown[];
      deck: unknown[];
      hand: string[];
      partner: { state: string };
    };
    opp: {
      scene: SceneChar[];
      evidence: unknown[];
      deck: unknown[];
      hand: string[];
      partner: { state: string };
    };
  };
};
