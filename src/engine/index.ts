// engine — エンジン public API

import { read } from './read/index.js';
import { mutate } from './mutate/index.js';

export const engine = { read, mutate };

// re-export namespace components for direct import
export { read } from './read/index.js';
export { mutate } from './mutate/index.js';
