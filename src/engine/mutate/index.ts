// engine.mutate namespace — 全 mutate モジュールを束ねる
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

export { deck } from './deck.js';
export { hand } from './hand.js';
export { scene } from './scene.js';
export { char } from './char.js';

import { deck } from './deck.js';
import { hand } from './hand.js';
import { scene } from './scene.js';
import { char } from './char.js';

export const mutate = {
  deck,
  hand,
  scene,
  char,
};
