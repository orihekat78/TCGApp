import type { Condition } from '../types/index.js';

/** Binding names a condition needs before it can be evaluated or resumed. */
export function bindingKeysReadByCondition(condition: Condition): string[] {
  const keys: string[] = [];
  const add = (key: string | undefined): void => {
    if (key !== undefined && !keys.includes(key)) keys.push(key);
  };
  const visit = (cond: Condition): void => {
    switch (cond.kind) {
      case 'bound':
        add(cond.key);
        return;
      case 'boundMatchesFilter':
      case 'boundAnyMatchesFilter':
      case 'boundDistinctColorCount':
      case 'boundNameMatchesDeclared':
      case 'boundIsMr':
      case 'boundCharStateIs':
        add(cond.bindKey);
        return;
      case 'boundMatchCountAtLeast':
        add(cond.bindKey);
        add(cond.traitBind);
        return;
      case 'not':
        visit(cond.c);
        return;
      case 'and':
      case 'or':
        cond.cs.forEach(visit);
        return;
      default:
        return;
    }
  };
  visit(condition);
  return keys;
}
