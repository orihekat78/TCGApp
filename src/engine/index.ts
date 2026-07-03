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
import { registerTriggeredListener } from './listeners/triggered.js';
import { registerReservedEffectListener } from './listeners/reserved-effects.js';

const effect = { runAtom, run: effectRun, validate: effectValidate };

// Phase 8 完全クローズ Commit 3a/3b: engine init 時に listener を登録。
// listener registry はモジュールレベル singleton (event/registry.ts) なので
// 1 回だけ呼べばよい (各 register 関数内部でも _registered ガード)。
registerHiramekiListener();
registerMisreadListener();
registerTriggeredListener();
// mega-wave W6 step8 (row75): 離場後予約効果 listener。triggered との登録順は無関係 (対象 domain が
// 排他 — reservedEffects field のみを見る)。
registerReservedEffectListener();

export const engine = { read, mutate, invariant, event, effect, dyn, target, cost, cond, resolve, flow, cards };

// re-export namespace components for direct import
export { read } from './read/index.js';
export { mutate } from './mutate/index.js';
export { invariant } from './invariant/index.js';
export { event } from './event/index.js';
export { runAtom, run as effectRun, validate as effectValidate, validateCards } from './effect/index.js';
export { cards } from './cards/index.js';
export { parseTsv } from './cards/index.js';
// `loadSet` は Node 専用 (`./cards/tsv-loader-fs.js`)。ブラウザバンドル汚染回避のため
// engine/index からは re-export しない。
export { dyn } from './dyn/index.js';
export { target } from './target/index.js';
export { cost } from './cost/index.js';
export { cond } from './cond/index.js';
export { resolve } from './resolve/index.js';
export { flow } from './flow/index.js';

// Round 4j-fix (BUG-034): hirameki/misread side-channel drain/reset を engine namespace で
// re-export。vite dev mode で `'@/engine/listeners/*.js'` 直接 import と `'./listeners/*.js'`
// 相対 import が別 module instance に分裂する問題を回避するため、UI 側からは必ず `@/engine`
// 経由 (engine/index.ts → 同 module から再 export) で取得させる。
export {
  _drainPendingHirameki,
  _resetPendingHirameki,
  _resetHiramekiRegistered,
  // mega-wave W6 step7 (row70): actionJudge の defer 判定用 (peek = 非消費 / mark = gainDeferred 焼込)
  _peekPendingHirameki,
  _markPendingHiramekiGainDeferred,
} from './listeners/hirameki.js';
export {
  _drainPendingMisread,
  _resetPendingMisread,
} from './listeners/misread.js';
