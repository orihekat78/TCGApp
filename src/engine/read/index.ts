// engine.read namespace — 全セレクタを束ねる
// 各モジュールは純粋関数のみ (副作用なし)

export { turn } from './turn.js';
export { player } from './player.js';
export { scene } from './scene.js';
export { char } from './char.js';
export { def } from './def.js';
export { game } from './game.js';
export { log } from './log.js';

import { turn } from './turn.js';
import { player } from './player.js';
import { scene } from './scene.js';
import { char } from './char.js';
import { def } from './def.js';
import { game } from './game.js';
import { log } from './log.js';

export const read = {
  turn,
  player,
  scene,
  char,
  def,
  game,
  log,
};
