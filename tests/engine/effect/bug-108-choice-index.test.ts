// BUG-108: choice effect の choiceIndex が production の人間/AI どちらでも set されず
// 常に option 0 に固定される問題。engine 側の解決機構として、resolveEffectPicks が
// ctx.dyn.choiceIndex 指定時に「選択 option のみ」へ unwrap する挙動を検証する。
//
// rules: 15-abilities-effects.md, 17-icons.md
//
// 根本: resolver.run の choice は ctx.dyn.choiceIndex を読むが、effect は event.queue →
//   entryToCtx で ctx.dyn が落ちるため runtime に choiceIndex が届かない。choiceIndex は
//   dyn-arg / pick と同様に resolveEffectPicks (= ctx.dyn 保持) の walk 中に bake する。

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveEffectPicks, _peekPendingEffectChoiceSide, _clearPendingEffectChoiceSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { D11012 } from '@/cards/ct-d11/D11012';
import type { EffectCtx } from '@/engine/types';

function ctxWithChoice(choiceIndex?: number): EffectCtx {
  return {
    source: { player: 'self', cardId: 'D11012', uid: 'shigo', abilityId: 'a1', area: 'scene' },
    bindings: {},
    ...(choiceIndex === undefined ? {} : { dyn: { choiceIndex } }),
  } as unknown as EffectCtx;
}

describe('BUG-108: resolveEffectPicks choice unwrap by ctx.dyn.choiceIndex', () => {
  const choiceEff = D11012.abilities[0].effect; // { kind:'choice', options:[charModifyLP, charModifyAP] }
  const opts = { humanChooser: true as const, byPlayer: 'self' as const, source: { cardId: 'D11012', abilityId: 'a1' } };

  // BUG-121: humanChooser 経路は choiceIndex 未供給時に pause するようになったため、
  // pause を生む test の前後で choice side-channel をクリアする。
  beforeEach(() => _clearPendingEffectChoiceSide());

  it('choiceEff は 2 option の choice (前提確認)', () => {
    const e = choiceEff as { kind: string; options: unknown[] };
    expect(e.kind).toBe('choice');
    expect(e.options.length).toBe(2);
  });

  it('choiceIndex=0 → option0 (charModifyLP) に unwrap', () => {
    const s = createEmptyGameState();
    const r = resolveEffectPicks(s, choiceEff as never, ctxWithChoice(0), opts) as { kind: string; verb?: string };
    expect(r.kind).toBe('atom');
    expect(r.verb).toBe('charModifyLP');
  });

  it('choiceIndex=1 → option1 (charModifyAP) に unwrap', () => {
    const s = createEmptyGameState();
    const r = resolveEffectPicks(s, choiceEff as never, ctxWithChoice(1), opts) as { kind: string; verb?: string };
    expect(r.kind).toBe('atom');
    expect(r.verb).toBe('charModifyAP');
  });

  // BUG-121: humanChooser=true + choiceIndex 未指定 + 複数 option → pause (option 0 既定化しない)。
  // pendingEffectChoice を side-channel に set し、effect は no-op (空 parallel) を返す。
  it('choiceIndex 未指定 + humanChooser → pause (空 effect + pendingEffectChoice set)', () => {
    const s = createEmptyGameState();
    const r = resolveEffectPicks(s, choiceEff as never, ctxWithChoice(undefined), opts) as { kind: string; steps?: unknown[] };
    expect(r.kind, 'no-op (空 parallel) を返す').toBe('parallel');
    expect(r.steps?.length).toBe(0);
    const side = _peekPendingEffectChoiceSide();
    expect(side, 'pendingEffectChoice が surface される').not.toBeNull();
    expect(side?.options.length, '2 option が運ばれる').toBe(2);
    expect(side?.player).toBe('self');
  });

  // BUG-121: AI 経路 (humanChooser=false) は従来通り全 option walk → resolver.run default 0。
  it('choiceIndex 未指定 + humanChooser=false (AI) → choice のまま (default 0 据え置き)', () => {
    const s = createEmptyGameState();
    const aiOpts = { humanChooser: false as const, byPlayer: 'self' as const, source: { cardId: 'D11012', abilityId: 'a1' } };
    const r = resolveEffectPicks(s, choiceEff as never, ctxWithChoice(undefined), aiOpts) as { kind: string; options?: unknown[] };
    expect(r.kind, 'AI は walk のまま (pause しない)').toBe('choice');
    expect(r.options?.length).toBe(2);
    expect(_peekPendingEffectChoiceSide(), 'AI は side-channel に積まない').toBeNull();
  });

  it('choiceIndex 範囲外 + humanChooser → pause (防御: 不正値で unwrap せず pause)', () => {
    const s = createEmptyGameState();
    const r = resolveEffectPicks(s, choiceEff as never, ctxWithChoice(5), opts) as { kind: string };
    expect(r.kind).toBe('parallel');
    expect(_peekPendingEffectChoiceSide()).not.toBeNull();
  });
});
