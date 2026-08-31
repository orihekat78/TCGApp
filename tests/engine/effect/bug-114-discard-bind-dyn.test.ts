// BUG-114 primitive: discard で除去した手札カードを bind し、その level/AP を dyn で参照する。
// 「リムーブした手札カードのレベル1につきAP+1000」(B05040) / 「...AP1000につきAP+1000」(B08055) 用。
// 既存 dyn root は $self/$contact/$cost/$dyn のみで、discard したカードの属性を読む手段が無かった。
//
// rules: 09-cutin-disguise.md, 15-abilities-effects.md
import { describe, it, expect, beforeAll } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import { evalDyn } from '@/engine/dyn/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { EffectCtx, GameState } from '@/engine/types';

describe('BUG-114 primitive — discard bind + $discarded dyn root', () => {
  beforeAll(() => registerAll());

  it('discard{bind} は除去した cardId と離れる直前の実効レベルを ctx.bindings に書く', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['D11012'];
    const ctx: EffectCtx = { source: { player: 'self', cardId: 'X', abilityId: 'a1' }, bindings: {} } as EffectCtx;
    // target を直接解決して渡す (pick 経路を経ずに handler の bind 書き込みを検証)
    runEffect(s, { kind: 'atom', verb: 'discard' as never, args: { player: 'self', target: ['D11012'], bind: '$discarded' } }, ctx);
    expect((ctx.bindings as Record<string, unknown>)['$discarded']).toEqual([{ cardId: 'D11012', snapLevel: 4 }]);
    expect(s.players.self.hand).not.toContain('D11012');
  });

  it('discard{bind} は重複・不存在targetから実在occurrenceだけをremoveとbindingへ移す', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['D11012'];
    const ctx: EffectCtx = { source: { player: 'self', cardId: 'X', abilityId: 'a1' }, bindings: {} } as EffectCtx;

    runEffect(s, {
      kind: 'atom', verb: 'discard' as never,
      args: { player: 'self', target: ['D11012', 'D11012', 'MISSING'], bind: '$discarded' },
    }, ctx);

    expect(s.players.self.hand).toEqual([]);
    expect(s.players.self.remove).toEqual(['D11012']);
    expect((ctx.bindings as Record<string, unknown>)['$discarded']).toEqual([{ cardId: 'D11012', snapLevel: 4 }]);
  });

  it('$discarded.level / $discarded.ap が bind した cardId の printed 値を返す', () => {
    const s: GameState = createEmptyGameState();
    const ctx: EffectCtx = {
      source: { player: 'self', cardId: 'X', abilityId: 'a1' },
      bindings: { '$discarded': [{ cardId: 'D11012' }] }, // D11012 = level 4, ap 4000
    } as unknown as EffectCtx;
    expect(evalDyn(s, '$discarded.level', ctx)).toBe(4);
    expect(evalDyn(s, '$discarded.ap', ctx)).toBe(4000);
    expect(evalDyn(s, '$discarded.level * 1000', ctx)).toBe(4000);
  });

  it('$discarded が未 bind なら 0 (no-op、scaling 0)', () => {
    const s: GameState = createEmptyGameState();
    const ctx: EffectCtx = { source: { player: 'self', cardId: 'X', abilityId: 'a1' }, bindings: {} } as EffectCtx;
    expect(evalDyn(s, '$discarded.level', ctx)).toBe(0);
  });
});
