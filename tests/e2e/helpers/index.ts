// E2E test helpers re-export hub

export type { GameWindow, GameStateLike, SceneChar, Side } from './types';
export { setupGamePage } from './setup';
export {
  buildGameState,
  getGameState,
  dispatchAction,
  getActionContext,
  getActiveActionId,
  waitForPhase,
  waitForActionEnd,
} from './state';
export {
  expectEvidenceCount,
  expectActorState,
  expectActorRemoved,
  expectCutInUsed,
  expectActionPhase,
  expectNoConsoleErrors,
} from './assertions';
