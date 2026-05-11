// engine — エンジン public API

import { read } from './read/index.js';
import { mutate } from './mutate/index.js';
import { invariant } from './invariant/index.js';
import { event } from './event/index.js';
import { runAtom } from './effect/index.js';

const effect = { runAtom };

export const engine = { read, mutate, invariant, event, effect };

// re-export namespace components for direct import
export { read } from './read/index.js';
export { mutate } from './mutate/index.js';
export { invariant } from './invariant/index.js';
export { event } from './event/index.js';
export { runAtom } from './effect/index.js';
