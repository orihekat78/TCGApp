// engine.resolve namespace barrel
// spec: .claude/specs/engine-api-resolver.md

export * as resolve from './stack.js';
export {
  queue,
  next,
  runOne,
  runAllUntilEmpty,
  cancel,
  replace,
  peek,
  lock,
  unlock,
  isLocked,
} from './stack.js';
