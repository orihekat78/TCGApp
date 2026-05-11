// engine.effect namespace barrel
// spec: .claude/specs/engine-api-effect-descriptor.md
// Phase 3 Group A: runAtom
// Phase 3 Group C: run (resolver), validate

export { runAtom } from './atom-handlers.js';
export { run } from './resolver.js';
export { validate, validateCards } from './validate.js';
