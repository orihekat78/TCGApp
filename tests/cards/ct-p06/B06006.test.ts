// tests/cards/ct-p06/B06006 江戸川コナン
// card-authoring vein 解禁 (engine変更0, 2026-07-03)。
// 主眼: a1「【解決編】突撃」= caseStatus grantKeywords / a2「【自分ターン中】重ね1枚につきAP+1000」
//   = apDelta dyn $self.stackedCount (D08021 a1 stack + B05030 a2 apDelta-dyn の合成、engine変更0)。

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { char as charRead } from '@/engine/read/char';
import { B06006 } from '@/cards/ct-p06/B06006';
import type { GameState } from '@/engine/types';

describe('B06006 江戸川コナン (shape)', () => {
  it('shape: id, kind, level=5, ap=4000, lp=1, traits探偵+毛利探偵事務所+少年探偵団', () => {
    expect(B06006.id).toBe('B06006');
    expect(B06006.no).toBe('0631/B06006');
    expect(B06006.kind).toBe('character');
    expect(B06006.names).toEqual(['江戸川コナン']);
    expect(B06006.colors).toEqual(['青']);
    expect(B06006.level).toBe(5);
    expect(B06006.ap).toBe(4000);
    expect(B06006.lp).toBe(1);
    expect(B06006.traits).toEqual(['探偵', '毛利探偵事務所', '少年探偵団']);
    expect(B06006.abilities.length).toBe(3);
  });

  it('a1: continuous caseStatus解決編 → grant 突撃', () => {
    const a1 = B06006.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'caseStatus', status: '解決編' });
    expect(a1.continuousModifier?.grantKeywords).toBeDefined();
  });

  it('a2: continuous 自分ターン中 × apDelta dyn = stackedCount * 1000', () => {
    const a2 = B06006.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('continuous');
    expect(a2.condition).toEqual({ kind: 'turn', player: 'self' });
    expect(a2.continuousModifier?.apDelta).toEqual({ dyn: '$self.stackedCount * 1000' });
  });

  it('a3: 【登場時】chain[ mill n:1, charStackCard pick remove trait[探偵|少年探偵団] 0-2 ]', () => {
    const a3 = B06006.abilities[2];
    expect(a3.id).toBe('a3');
    expect(a3.type).toBe('triggered');
    expect(a3.trigger).toEqual({ hook: 'enter', selfOnly: true });
    const eff = a3.effect as { kind: string; steps: Array<{ verb: string; args: Record<string, unknown> }> };
    expect(eff.kind).toBe('chain');
    expect(eff.steps[0].verb).toBe('mill');
    expect(eff.steps[0].args).toEqual({ player: 'self', n: 1, gate: false });
    const stack = eff.steps[1];
    expect(stack.verb).toBe('charStackCard');
    expect(stack.args.uid).toBe('$self');
    expect(stack.args.cardIds).toBe('$pick.cardIds');
    const target = stack.args.target as {
      kind: string;
      query: { area: string; side: string; filter: { kind: string; trait: string[] } };
      n: { min: number; max: number };
    };
    expect(target.kind).toBe('pick');
    expect(target.query.area).toBe('remove');
    expect(target.query.side).toBe('self');
    expect(target.query.filter.kind).toBe('character');
    expect(target.query.filter.trait).toEqual(['探偵', '少年探偵団']); // 配列 = any-match (candidates.ts wants.some)
    expect(target.n).toEqual({ min: 0, max: 2 });
  });
});

// 実機オラクル: engine.read が continuousModifier を read 時に走査・合算する。
describe('B06006 behavioral — a2 AP が重ね枚数でスケール / a1 突撃 は解決編のみ', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    engine.cards.register(B06006);
  });

  function makeState(opts: {
    stacked: number;
    setCards?: number;
    turnPlayer: 'self' | 'opp';
    caseStatus?: '事件編' | '解決編';
  }): GameState {
    return produce(createEmptyGameState(), (d) => {
      d.turn.player = opts.turnPlayer;
      if (opts.caseStatus) d.players.self.case.status = opts.caseStatus;
      d.players.self.scene.push({
        cardId: 'B06006',
        uid: 'B06006#0',
        state: 'active',
        isNamed: false,
        enterOrder: 1,
        enterOrderThisTurn: 1,
        setCards: Array.from({ length: opts.setCards ?? 0 }, (_, i) => ({ cardId: `set${i}`, faceUp: false })),
        stackedCards: opts.stacked,
        keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: null,
        lpOverride: null,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false },
        declaredUseCount: {},
      });
    });
  }

  it('自分ターン中・重ね2枚 → AP = base4000 + 2*1000 = 6000', () => {
    expect(charRead.ap(makeState({ stacked: 2, turnPlayer: 'self' }), 'B06006#0')).toBe(6000);
  });

  it('重ね0枚 → AP = 4000', () => {
    expect(charRead.ap(makeState({ stacked: 0, turnPlayer: 'self' }), 'B06006#0')).toBe(4000);
  });

  it('相手ターン中 → condition {turn:self} false で加算なし (AP = 4000)', () => {
    expect(charRead.ap(makeState({ stacked: 3, turnPlayer: 'opp' }), 'B06006#0')).toBe(4000);
  });

  it('setCards は数えない (set2 + stacked1 → AP = 5000、重ねのみ計上)', () => {
    expect(charRead.ap(makeState({ stacked: 1, setCards: 2, turnPlayer: 'self' }), 'B06006#0')).toBe(5000);
  });

  it('a1: 事件編 (default) → 突撃 を持たない', () => {
    const kws = charRead.keywords(makeState({ stacked: 0, turnPlayer: 'self' }), 'B06006#0');
    expect(kws).not.toContain('突撃');
  });

  it('a1: 解決編 → 突撃 を持つ', () => {
    const kws = charRead.keywords(
      makeState({ stacked: 0, turnPlayer: 'self', caseStatus: '解決編' }),
      'B06006#0',
    );
    expect(kws).toContain('突撃');
  });
});
