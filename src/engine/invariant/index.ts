// engine.invariant namespace — 全 invariant を束ねる

export { sceneAtMost5 } from './sceneAtMost5.js';
export { partnerExists } from './partnerExists.js';
export { caseExists } from './caseExists.js';
export { caseMonotonic } from './caseMonotonic.js';
export { scratchTraceMonotonic } from './scratchTraceMonotonic.js';
export { stunSemantics } from './stunSemantics.js';
export { effectIsSerializable } from './effectIsSerializable.js';
export { frozenSurface, assertFrozen } from './frozenSurface.js';

import { sceneAtMost5 } from './sceneAtMost5.js';
import { partnerExists } from './partnerExists.js';
import { caseExists } from './caseExists.js';
import { caseMonotonic } from './caseMonotonic.js';
import { scratchTraceMonotonic } from './scratchTraceMonotonic.js';
import { stunSemantics } from './stunSemantics.js';
import { effectIsSerializable } from './effectIsSerializable.js';
import { frozenSurface, assertFrozen } from './frozenSurface.js';

export const invariant = {
  sceneAtMost5,
  partnerExists,
  caseExists,
  caseMonotonic,
  scratchTraceMonotonic,
  stunSemantics,
  effectIsSerializable,
  frozenSurface,
  assertFrozen,
};
