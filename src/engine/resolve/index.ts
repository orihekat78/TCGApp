// engine.resolve namespace barrel
// spec: .claude/specs/engine-api-resolver.md

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

import {
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

export const resolve = {
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
};
