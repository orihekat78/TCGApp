// engine.flow.main namespace barrel — メインフェイズ 6 行動 (rules/05)

export { canHandUseCard, canHandUseCardSwitch, handUseCard } from './hand-use-card.js';
export { canStartNextHint, runNextHint } from './next-hint.js';
export { canPartnerAbility, usePartnerAbility } from './partner-ability.js';
export { canDeclaredAbility, useDeclaredAbility, grantedDeclaredAbilitiesOf } from './declared-ability.js';
// Phase 2c (BUG-116 構造解消): cost+ctx 構築 + pay を engine 側に一元化した activate 系
export { activateDeclaredAbility, activatePartnerAbility } from './ability-activate.js';
export type { AbilityCostParams } from './ability-activate.js';
export { canReason, doReasoning } from './reasoning.js';
export { canAction, canActionAgainstChar, canActionAgainstCase } from './action.js';

import { canHandUseCard, canHandUseCardSwitch, handUseCard } from './hand-use-card.js';
import { canStartNextHint, runNextHint } from './next-hint.js';
import { canPartnerAbility, usePartnerAbility } from './partner-ability.js';
import { canDeclaredAbility, useDeclaredAbility, grantedDeclaredAbilitiesOf } from './declared-ability.js';
import { activateDeclaredAbility, activatePartnerAbility } from './ability-activate.js';
import { canReason, doReasoning } from './reasoning.js';
import { canAction, canActionAgainstChar, canActionAgainstCase } from './action.js';

export const main = {
  canHandUseCard,
  canHandUseCardSwitch,
  handUseCard,
  canStartNextHint,
  runNextHint,
  canPartnerAbility,
  usePartnerAbility,
  canDeclaredAbility,
  useDeclaredAbility,
  grantedDeclaredAbilitiesOf,
  activateDeclaredAbility,
  activatePartnerAbility,
  canReason,
  doReasoning,
  canAction,
  canActionAgainstChar,
  canActionAgainstCase,
};
