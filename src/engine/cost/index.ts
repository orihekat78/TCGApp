// engine.cost — Cost evaluator barrel
// spec: Phase 3 Group B Task 3.5

export { canPay } from './evaluate.js';
export { pay } from './pay.js';

import { canPay } from './evaluate.js';
import { pay } from './pay.js';

export const cost = {
  canPay,
  pay,
};
