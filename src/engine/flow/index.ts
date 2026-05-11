// engine.flow namespace barrel
// spec: .claude/specs/engine-api-flow-setup.md
// spec: .claude/specs/engine-api-flow-control.md

export { setup } from './setup.js';
export type { Deck, DeckPair } from './setup.js';
export { runAutoPhase } from './auto-phase.js';

import { setup } from './setup.js';
import { runAutoPhase } from './auto-phase.js';

export const flow = {
  setup,
  runAutoPhase,
};
