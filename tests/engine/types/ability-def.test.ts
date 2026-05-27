// AbilityDef 型のコンパイル時テスト
// spec: .claude/specs/engine-api-card-abilities.md

import { describe, it, expect } from 'vitest';
import type {
  AbilityDef,
  AbilityType,
  AbilityScope,
  AbilityLimit,
  TriggerDef,
  ContinuousModifier,
  GameState,
  SceneCharacter,
} from '@/engine/types';

describe('AbilityDef type system', () => {
  it('accepts each AbilityType', () => {
    const types: AbilityType[] = [
      'continuous',
      'triggered',
      'declared',
      'icon-cutin',
      // 'icon-flash' は 2026-05-27 Option C 移行で廃止 (triggered + trigger:{hook,optional} に統合)
      'icon-disguise',
      'icon-misread',
    ];
    expect(types).toHaveLength(6);
  });

  it('accepts each AbilityScope', () => {
    const scopes: AbilityScope[] = [
      'on-scene',
      'on-partner-area',
      'on-hand',
      'on-evidence',
      'always',
    ];
    expect(scopes).toHaveLength(5);
  });

  it('AbilityLimit supports turn/game/null', () => {
    const a: AbilityLimit = { kind: 'turn', n: 1 };
    const b: AbilityLimit = { kind: 'turn', n: 2 };
    const c: AbilityLimit = { kind: 'game', n: 3 };
    const d: AbilityLimit = null;
    expect([a, b, c, d]).toHaveLength(4);
  });

  it('TriggerDef matcher signature is callable with payload+state', () => {
    const trig: TriggerDef = {
      hook: 'turn:start',
      matcher: (payload: unknown, state: GameState) => {
        // exercise both args
        return state !== undefined && payload !== undefined;
      },
      selfOnly: true,
      ignoreCostInduced: false,
    };
    expect(trig.hook).toBe('turn:start');
    expect(typeof trig.matcher).toBe('function');
  });

  it('ContinuousModifier signature is callable', () => {
    const mod: ContinuousModifier = {
      apDelta: (_s: GameState, ctx: { uid: string }) => {
        return ctx.uid ? 1000 : 0;
      },
      lpDelta: () => 0,
      grantKeywords: () => ['迅速'],
      customSelectorPatch: (_s: GameState, uid: string, _base: SceneCharacter): Partial<SceneCharacter> => {
        return { uid };
      },
    };
    expect(typeof mod.apDelta).toBe('function');
    expect(typeof mod.lpDelta).toBe('function');
    expect(typeof mod.grantKeywords).toBe('function');
    expect(typeof mod.customSelectorPatch).toBe('function');
  });

  it('AbilityDef accepts a minimal declared ability', () => {
    const ab: AbilityDef = {
      id: 'a1',
      type: 'declared',
      cost: { kind: 'sleepSelf' },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
      description: '【宣言】 自身をスリープ: カードを2枚引く',
      ruleRefs: ['rules/21-declared-ability-cost.md'],
    };
    expect(ab.id).toBe('a1');
    expect(ab.type).toBe('declared');
  });

  it('AbilityDef accepts a continuous ability with continuousModifier', () => {
    const ab: AbilityDef = {
      id: 'a1',
      type: 'continuous',
      scope: 'on-scene',
      continuousModifier: {
        apDelta: () => 1000,
      },
      description: 'AP+1000',
    };
    expect(ab.type).toBe('continuous');
    expect(ab.continuousModifier?.apDelta).toBeTypeOf('function');
  });

  it('AbilityDef accepts a triggered ability with TriggerDef', () => {
    const ab: AbilityDef = {
      id: 'a1',
      type: 'triggered',
      trigger: { hook: 'enter', selfOnly: true },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      limit: { kind: 'turn', n: 1 },
      description: '【登場時】 カードを1枚引く',
    };
    expect(ab.trigger?.hook).toBe('enter');
    expect(ab.limit).toEqual({ kind: 'turn', n: 1 });
  });
});
