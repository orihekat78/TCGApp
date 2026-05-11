// engine — エンジン public API

import { read } from './read/index.js';
import { mutate } from './mutate/index.js';
import { invariant } from './invariant/index.js';
import { event } from './event/index.js';
import { runAtom } from './effect/index.js';
import { dyn } from './dyn/index.js';
import { target } from './target/index.js';
import { cost } from './cost/index.js';

const effect = { runAtom };

export const engine = { read, mutate, invariant, event, effect, dyn, target, cost };

// re-export namespace components for direct import
export { read } from './read/index.js';
export { mutate } from './mutate/index.js';
export { invariant } from './invariant/index.js';
export { event } from './event/index.js';
export { runAtom } from './effect/index.js';
export { dyn } from './dyn/index.js';
export { target } from './target/index.js';
export { cost } from './cost/index.js';
