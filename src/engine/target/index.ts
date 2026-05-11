// engine.target — Targeting API barrel
// spec: Phase 3 Group B Task 3.4

export { candidates, legalCount } from './candidates.js';
export { resolve } from './resolve.js';
export {
  setCardDefLookup,
  resetCardDefLookup,
  cardNameComponents,
  allCardNameComponentsForDef,
} from './card-def-registry.js';

import { candidates, legalCount } from './candidates.js';
import { resolve } from './resolve.js';

export const target = {
  candidates,
  legalCount,
  resolve,
};
