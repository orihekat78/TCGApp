import { describe, expect, it } from 'vitest';
import { bindingKeysReadByCondition } from '@/engine/cond/binding-keys';
import type { Condition } from '@/engine/types';

describe('bindingKeysReadByCondition', () => {
  it('collects every binding reader, including the trait binding, once in encounter order', () => {
    const condition: Condition = {
      kind: 'and', cs: [
        { kind: 'bound', key: '$present' },
        { kind: 'boundMatchesFilter', bindKey: '$matches', filter: { kind: 'character' } },
        { kind: 'boundAnyMatchesFilter', bindKey: '$any', filter: { kind: 'character' } },
        { kind: 'boundMatchCountAtLeast', bindKey: '$count', traitBind: '$trait', filter: { kind: 'character' }, n: 1 },
        { kind: 'boundDistinctColorCount', bindKey: '$colors', n: 2 },
        { kind: 'boundNameMatchesDeclared', bindKey: '$named', declareKey: 'name' },
        { kind: 'boundIsMr', bindKey: '$mr' },
        { kind: 'boundCharStateIs', bindKey: '$state', state: 'active' },
        { kind: 'not', c: { kind: 'bound', key: '$present' } },
      ],
    };

    expect(bindingKeysReadByCondition(condition)).toEqual([
      '$present', '$matches', '$any', '$count', '$trait', '$colors', '$named', '$mr', '$state',
    ]);
  });
});
