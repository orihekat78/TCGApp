import type { AbilityCostParams } from './ability-activate.js';

/** Convert public cost witnesses to the channels consumed by cost pay/evaluate. */
export function declaredCostParamsToDyn(costParams?: AbilityCostParams): Record<string, unknown> | undefined {
  if (!costParams) return undefined;
  const dyn: Record<string, unknown> = {};
  const params: Record<string, unknown> = {};
  for (const key of [
    'flipFaceUpEvidence',
    'removeFromHand',
    'sceneToDeckBottom',
    'removeAreaToDeckBottom',
    'partnerAreaRemove',
    'removeSetCard',
    'removeStackedCards',
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(costParams, key)) params[key] = costParams[key];
  }
  if (Object.keys(params).length > 0) dyn['costParams'] = params;
  if (costParams.costChoice !== undefined) dyn['costChoice'] = costParams.costChoice;
  if (costParams.costChoicePath !== undefined) dyn['costChoicePath'] = costParams.costChoicePath;
  if (costParams.choiceIndex !== undefined) dyn['choiceIndex'] = costParams.choiceIndex;
  if (costParams.declaredName !== undefined) {
    dyn['declaredName'] = typeof costParams.declaredName === 'string'
      ? costParams.declaredName.trim()
      : costParams.declaredName;
  }
  return Object.keys(dyn).length > 0 ? dyn : undefined;
}
