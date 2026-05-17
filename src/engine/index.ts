// engine — エンジン public API

import { read } from './read/index.js';
import { mutate } from './mutate/index.js';
import { invariant } from './invariant/index.js';
import { event } from './event/index.js';
import { runAtom, run as effectRun, validate as effectValidate } from './effect/index.js';
import { dyn } from './dyn/index.js';
import { target } from './target/index.js';
import { cost } from './cost/index.js';
import { cond } from './cond/index.js';
import { resolve } from './resolve/index.js';
import { flow } from './flow/index.js';
import { cards } from './cards/index.js';
import { registerHiramekiListener } from './listeners/hirameki.js';
import { registerMisreadListener } from './listeners/misread.js';

const effect = { runAtom, run: effectRun, validate: effectValidate };

// Phase 8 完全クローズ Commit 3a/3b: engine init 時に listener を登録。
// listener registry はモジュールレベル singleton (event/registry.ts) なので
// 1 回だけ呼べばよい (各 register 関数内部でも _registered ガード)。
registerHiramekiListener();
registerMisreadListener();

export const engine = { read, mutate, invariant, event, effect, dyn, target, cost, cond, resolve, flow, cards };

// re-export namespace components for direct import
export { read } from './read/index.js';
export { mutate } from './mutate/index.js';
export { invariant } from './invariant/index.js';
export { event } from './event/index.js';
export { runAtom, run as effectRun, validate as effectValidate, validateCards } from './effect/index.js';
export { cards } from './cards/index.js';
export { parseTsv, loadSet } from './cards/index.js';
export { dyn } from './dyn/index.js';
export { target } from './target/index.js';
export { cost } from './cost/index.js';
export { cond } from './cond/index.js';
export { resolve } from './resolve/index.js';
export { flow } from './flow/index.js';
