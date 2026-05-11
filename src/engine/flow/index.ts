// engine.flow namespace barrel
// spec: .claude/specs/engine-api-flow-setup.md
// spec: .claude/specs/engine-api-flow-control.md

export { setup } from './setup.js';
export type { Deck, DeckPair } from './setup.js';
export { runAutoPhase } from './auto-phase.js';
export {
  canHandUseCard,
  handUseCard,
  canStartNextHint,
  runNextHint,
  canPartnerAbility,
  usePartnerAbility,
  canDeclaredAbility,
  useDeclaredAbility,
  canReason,
  doReasoning,
  canAction,
  canActionAgainstChar,
  canActionAgainstCase,
} from './main/index.js';

import { setup } from './setup.js';
import { runAutoPhase } from './auto-phase.js';
import { main } from './main/index.js';

export const flow = {
  setup,
  runAutoPhase,
  ...main,
};
