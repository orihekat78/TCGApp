// engine — エンジン public API

import { read } from './read/index.js';
import { mutate } from './mutate/index.js';
import { invariant } from './invariant/index.js';
import { event } from './event/index.js';
import { runAtom, run as effectRun } from './effect/index.js';
import { dyn } from './dyn/index.js';
import { target } from './target/index.js';
import { cost } from './cost/index.js';
import { cond } from './cond/index.js';

const effect = { runAtom, run: effectRun };

export const engine = { read, mutate, invariant, event, effect, dyn, target, cost, cond };

// re-export namespace components for direct import
export { read } from './read/index.js';
export { mutate } from './mutate/index.js';
export { invariant } from './invariant/index.js';
export { event } from './event/index.js';
export { runAtom, run as effectRun } from './effect/index.js';
export { dyn } from './dyn/index.js';
export { target } from './target/index.js';
export { cost } from './cost/index.js';
export { cond } from './cond/index.js';
