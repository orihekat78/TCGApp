// engine.flow namespace barrel
// spec: .claude/specs/engine-api-flow-setup.md
// spec: .claude/specs/engine-api-flow-control.md
// spec: .claude/specs/engine-api-flow-contact.md

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
export { action } from './action/state-machine.js';
export { guard } from './guard.js';

import { setup } from './setup.js';
import { runAutoPhase } from './auto-phase.js';
import { main } from './main/index.js';
import { action } from './action/state-machine.js';
import { guard } from './guard.js';

export const flow = {
  setup,
  runAutoPhase,
  ...main,
  action,
  guard,
};
