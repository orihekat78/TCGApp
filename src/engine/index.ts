// engine — エンジン public API
// 現在: read のみ。将来 mutate/effect/event/cost/target/cond/flow/resolve を追加

import { read } from './read/index.js';

export const engine = { read };

// re-export read namespace components for direct import
export { read } from './read/index.js';
