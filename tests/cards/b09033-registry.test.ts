import { describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { def, _resetRegistry } from '@/engine/read/def';

describe('B09033 production registry', () => {
  it('registerAll exposes both printings', () => {
    _resetRegistry();
    registerAll();
    expect(def.card('B09033')?.id).toBe('B09033');
    expect(def.card('B09033P')?.id).toBe('B09033P');
  });
});
