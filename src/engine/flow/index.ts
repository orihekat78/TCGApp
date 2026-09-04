// engine.flow namespace barrel
// spec: .claude/specs/engine-api-flow-setup.md
// spec: .claude/specs/engine-api-flow-control.md
// spec: .claude/specs/engine-api-flow-contact.md

export { setup } from './setup.js';
export type { Deck, DeckPair } from './setup.js';
export { runAutoPhase } from './auto-phase.js';
export { startTurn, endTurn, startMainPhase } from './turn.js';
export {
  canHandUseCard,
  canHandUseCardSwitch,
  handUseCard,
  canStartNextHint,
  runNextHint,
  canPartnerAbility,
  usePartnerAbility,
  canDeclaredAbility,
  canActivateDeclaredAbility,
  useDeclaredAbility,
  grantedDeclaredAbilitiesOf,
  findDeclaredAbilityOccurrence,
  findDeclaredAbilityOccurrences,
  activateDeclaredAbility,
  activatePartnerAbility,
  canReason,
  doReasoning,
  canAction,
  canActionAgainstChar,
  canActionAgainstCase,
} from './main/index.js';
export type { AbilityCostParams, DeclaredAbilityOccurrence, DeclaredAbilitySourceRef } from './main/index.js';
export { action } from './action/state-machine.js';
/** @deprecated Use `flow.action.candidates` or import directly from `./action/target-expander`. */
export {
  candidates as actionCandidates,
  mustTargetCandidates,
  registerTargetExpander,
  _resetTargetExpanders,
} from './action/target-expander.js';
export type { TargetExpander, TargetCandidate } from './action/target-expander.js';
export { guard } from './guard.js';
export { contact } from './contact.js';
export { actionCase } from './action-case.js';

import { setup } from './setup.js';
import { runAutoPhase } from './auto-phase.js';
import { startTurn, endTurn, startMainPhase } from './turn.js';
import { main } from './main/index.js';
import { action } from './action/state-machine.js';
import { guard } from './guard.js';
import { contact } from './contact.js';
import { actionCase } from './action-case.js';

export const flow = {
  setup,
  runAutoPhase,
  startTurn,
  endTurn,
  startMainPhase,
  ...main,
  action,
  guard,
  contact,
  actionCase,
};
