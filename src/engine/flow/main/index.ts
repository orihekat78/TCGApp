// engine.flow.main namespace barrel — メインフェイズ 6 行動 (rules/05)

export { canHandUseCard, handUseCard } from './hand-use-card.js';
export { canStartNextHint, runNextHint } from './next-hint.js';
export { canPartnerAbility, usePartnerAbility } from './partner-ability.js';
export { canDeclaredAbility, useDeclaredAbility } from './declared-ability.js';
export { canReason, doReasoning } from './reasoning.js';
export { canAction, canActionAgainstChar, canActionAgainstCase } from './action.js';

import { canHandUseCard, handUseCard } from './hand-use-card.js';
import { canStartNextHint, runNextHint } from './next-hint.js';
import { canPartnerAbility, usePartnerAbility } from './partner-ability.js';
import { canDeclaredAbility, useDeclaredAbility } from './declared-ability.js';
import { canReason, doReasoning } from './reasoning.js';
import { canAction, canActionAgainstChar, canActionAgainstCase } from './action.js';

export const main = {
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
};
