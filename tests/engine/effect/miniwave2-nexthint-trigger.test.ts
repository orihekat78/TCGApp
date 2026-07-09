// engine mini-wave #2 (2026-07-10): next-hint 判別 (viaNextHint payload flag + triggerViaNextHint cond)
// + triggerCardMatches (使用カード def filter) + $trigger.cardLevel dyn (元のレベル参照)。
// rules: 12-next-hint.md / 15 / 17。解禁 consumer: B01005 / B03002 / B05005 (cluster ④)。
// QA (B01005): 「元のレベルを参照する」= CardDef 印字 level。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runNextHint } from '@/engine/flow/main/next-hint';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { evalCond } from '@/engine/cond/eval';
import { evalDyn } from '@/engine/dyn/eval';
import { event } from '@/engine/event/index';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

const LV4: CardDef = { id: 'LV4', no: 'LV4', kind: 'character', names: ['四'], colors: ['青'], level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const HOST: CardDef = { id: 'HOST', no: 'HOST', kind: 'character', names: ['主'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.case = { ...s.players.self.case, colors: ['青'] } as never;
  return s;
}
function ctxWith(s: GameState, payload: Record<string, unknown>): EffectCtx {
  const c = mutate.scene.enter(s, 'self', 'HOST', {});
  return { source: { player: 'self', uid: c.uid, cardId: 'HOST' }, bindings: {}, dyn: {}, triggerPayload: payload } as unknown as EffectCtx;
}

beforeEach(() => { resetDefRegistry(); registerCardDef(LV4); registerCardDef(HOST); });

describe('viaNextHint payload flag (miniwave2)', () => {
  it('runNextHint の effect:declared payload に viaNextHint:true が乗る / 手札の使用には乗らない', () => {
    const seen: Record<string, unknown>[] = [];
    event.on('effect:declared', (_s, p) => { seen.push(p as Record<string, unknown>); });
    const s0 = base();
    s0.players.self.file = [{ type: 'card-back', cardId: 'LV4' } as never, { type: 'card-back', cardId: 'LV4' } as never, { type: 'card-back', cardId: 'LV4' } as never, { type: 'card-back', cardId: 'LV4' } as never, { type: 'card-back', cardId: 'LV4' } as never];
    const s = produce(s0, (d) => { runNextHint(d as GameState, 'self', 'LV4'); });
    void s;
    const nh = seen.find((p) => p['cardId'] === 'LV4');
    expect(nh?.['viaNextHint'], 'next-hint 経由は viaNextHint:true').toBe(true);
    seen.length = 0;
    const s1 = base();
    s1.players.self.hand = ['LV4'];
    // case colors は base() で設定済
    s1.players.self.file = [{ type: 'card-back', cardId: 'LV4' } as never, { type: 'card-back', cardId: 'LV4' } as never, { type: 'card-back', cardId: 'LV4' } as never, { type: 'card-back', cardId: 'LV4' } as never];
    const s2 = produce(s1, (d) => { handUseCard(d as GameState, 'self', 'LV4'); });
    void s2;
    const hu = seen.find((p) => p['cardId'] === 'LV4');
    expect(hu && 'viaNextHint' in hu, '手札の使用は flag 無し').toBe(false);
  });
});

describe('triggerViaNextHint / triggerCardMatches cond (miniwave2)', () => {
  it('triggerViaNextHint: payload flag で判別', () => {
    const s = base();
    expect(evalCond(s, { kind: 'triggerViaNextHint' } as never, ctxWith(s, { kind: 'character-use', cardId: 'LV4', player: 'self', viaNextHint: true }))).toBe(true);
    expect(evalCond(s, { kind: 'triggerViaNextHint' } as never, ctxWith(s, { kind: 'character-use', cardId: 'LV4', player: 'self' }))).toBe(false);
  });
  it('triggerCardMatches: 使用カード def を filter 照合 (color/level)', () => {
    const s = base();
    const p = { kind: 'character-use', cardId: 'LV4', player: 'self', viaNextHint: true };
    expect(evalCond(s, { kind: 'triggerCardMatches', filter: { color: '青' } } as never, ctxWith(s, p))).toBe(true);
    expect(evalCond(s, { kind: 'triggerCardMatches', filter: { color: '赤' } } as never, ctxWith(s, p))).toBe(false);
    expect(evalCond(s, { kind: 'triggerCardMatches', filter: { levelMax: 3 } } as never, ctxWith(s, p))).toBe(false);
  });
});

describe('$trigger.cardLevel dyn (miniwave2)', () => {
  it('payload.cardId の印字レベル (元のレベル、QA4)', () => {
    const s = base();
    expect(evalDyn(s, '$trigger.cardLevel', ctxWith(s, { cardId: 'LV4' }))).toBe(4);
  });
});
