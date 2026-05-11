// engine.mutate namespace — 全 mutate モジュールを束ねる
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

export { deck } from './deck.js';
export { hand } from './hand.js';
export { scene } from './scene.js';
export { char } from './char.js';
export { evidence } from './evidence.js';
export { file } from './file.js';
export { remove } from './remove.js';
export { partner } from './partner.js';
export { caseOp } from './case.js';
export { scratchTrace } from './scratchTrace.js';
export { flag } from './flag.js';
export { gameResult } from './gameResult.js';
export { log } from './log.js';

import { deck } from './deck.js';
import { hand } from './hand.js';
import { scene } from './scene.js';
import { char } from './char.js';
import { evidence } from './evidence.js';
import { file } from './file.js';
import { remove } from './remove.js';
import { partner } from './partner.js';
import { caseOp } from './case.js';
import { scratchTrace } from './scratchTrace.js';
import { flag } from './flag.js';
import { gameResult } from './gameResult.js';
import { log } from './log.js';

export const mutate = {
  deck,
  hand,
  scene,
  char,
  evidence,
  file,
  remove,
  partner,
  case: caseOp,
  scratchTrace,
  flag,
  gameResult,
  log,
};
