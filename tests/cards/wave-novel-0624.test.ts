// wave novel-0624 (engine変更0): novel-tail 9枚 — classify(59) → certify+adversarial-verify(15) →
// verified-ok green 9枚を出荷。残 6 (refuted 3 / yellow 3) は engine gate で DEFER。
//
// 本テストの 2 本柱:
//  (1) structural: 9 枚が REUSE_CARDS に登録され、公式テキスト→DSL の要 invariant
//      (hook / condition / filter kind / 量指定子 / Pattern-B short-form) を固定する。
//  (2) BUG-145 over-fire guard: effect 側 `conditional` の枝に pick を持つ 3 枚
//      (B09066 / B08092 / D01008) が、初期 pre-walk で human pick/choice/optional を
//      surface しない (= Pattern-B short-form のみ) ことを実証する。
//      Pattern-A($pick)/optional/choice を枝に持つと if 条件と独立に prompt が eager-surface する
//      (BUG-145、B05062 が同 gate で refute 済) ため、その回帰を機械的に塞ぐ。
// rules: 03-field-areas.md, 05-turn-phases.md, 13-keywords.md, 15-abilities-effects.md,
//        16-card-set.md, 17-icons.md, 20-color-and-switch.md
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { registerAll, REUSE_CARDS } from '@/cards';
import {
  resolveEffectPicks,
  _peekPendingEffectPickQueueLength,
  _peekPendingEffectChoiceSide,
  _peekPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectChoiceSide,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';

import { B02033 } from '@/cards/ct-p02/B02033';
import { B03095 } from '@/cards/ct-p03/B03095';
import { B04019 } from '@/cards/ct-p04/B04019';
import { B04079 } from '@/cards/ct-p04/B04079';
import { B05014 } from '@/cards/ct-p05/B05014';
import { B08092 } from '@/cards/ct-p08/B08092';
import { B09063 } from '@/cards/ct-p09/B09063';
import { B09066 } from '@/cards/ct-p09/B09066';
import { D01008 } from '@/cards/ct-d01/D01008';

const WAVE: Array<[string, CardDef]> = [
  ['B02033', B02033], ['B03095', B03095], ['B04019', B04019], ['B04079', B04079],
  ['B05014', B05014], ['B08092', B08092], ['B09063', B09063], ['B09066', B09066],
  ['D01008', D01008],
];

// 再帰: effect tree が optional / choice / uid:'$pick' (Pattern A) を含むか
function hasPreWalkSurface(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const x = e as { kind?: string; effect?: unknown; steps?: unknown[]; then?: unknown; else?: unknown; do?: unknown; options?: unknown[]; args?: { uid?: unknown } };
  if (x.kind === 'optional' || x.kind === 'choice') return true;
  if (x.kind === 'atom' && x.args?.uid === '$pick') return true;
  if (Array.isArray(x.steps)) return x.steps.some(hasPreWalkSurface);
  if (Array.isArray(x.options)) return x.options.some(hasPreWalkSurface);
  for (const k of ['effect', 'then', 'else', 'do'] as const) if (x[k] && hasPreWalkSurface(x[k])) return true;
  return false;
}

describe('wave novel-0624 — structural', () => {
  beforeAll(() => registerAll());

  it('9 枚すべて REUSE_CARDS に登録済み', () => {
    const ids = new Set(REUSE_CARDS.map((c) => c.id));
    for (const [id] of WAVE) expect(ids.has(id), `${id} registered`).toBe(true);
  });

  it('B08092 出来損ないの名探偵: event-use, 事件青&黒 gate, draw→現場リムーブ時 enter→絆 conditional remove', () => {
    const a = B08092.abilities[0]!;
    expect(B08092.kind).toBe('event');
    expect(a.scope).toBe('on-hand');
    expect(a.trigger?.hook).toBe('effect:declared');
    expect(a.condition).toMatchObject({ kind: 'caseColor', color: ['青', '黒'], combine: 'and' });
    const steps = (a.effect as { steps: Array<{ kind: string; verb?: string; args?: Record<string, unknown>; if?: unknown }> }).steps;
    expect(steps[0]).toMatchObject({ verb: 'draw' });
    expect(steps[1]).toMatchObject({ verb: 'sceneEnter', args: { from: 'hand', enterSleep: true, filter: { keyword: '現場リムーブ時', kind: 'character', levelMax: 4 } } });
    expect(steps[2]!.kind).toBe('conditional');
    expect((steps[2] as { if: unknown }).if).toMatchObject({ kind: 'bond', cardName: ['シェリー', '灰原哀'] });
  });

  it('B02033 死力を尽くして: optional{chain[charRemoveSetCard n:2, sceneRemove max:1]} (してもよい+そうした場合)', () => {
    const a = B02033.abilities[0]!;
    expect(a.effect?.kind).toBe('optional');
    const chain = (a.effect as { effect: { kind: string; steps: Array<{ verb?: string; args?: Record<string, unknown> }> } }).effect;
    expect(chain.kind).toBe('chain');
    expect(chain.steps[0]).toMatchObject({ verb: 'charRemoveSetCard', args: { n: 2, filter: { hasSetCards: true } } });
    expect(chain.steps[1]).toMatchObject({ verb: 'sceneRemove', args: { max: 1, side: 'either' } });
  });

  it('B03095: 【ターン1】action:declare observer (opp攻撃) + 自スリープ gate → 警察 reactivate', () => {
    const a = B03095.abilities[0]!;
    expect(a.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a.trigger?.hook).toBe('action:declare');
    const cs = (a.condition as { kind: string; cs: Array<Record<string, unknown>> });
    expect(cs.kind).toBe('and');
    expect(cs.cs).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'triggerCharMatches', side: 'opp' }),
      expect.objectContaining({ kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' }),
    ]));
    expect(a.effect).toMatchObject({ verb: 'sceneSetState', args: { state: 'active', side: 'self', max: 1, filter: { trait: '警察' } } });
  });

  it('B04019: 【宣言】【ターン1】cost sceneToDeckBottom(filterAny OR) → sceneRemove apMax8000 + revive remove 警察', () => {
    const a = B04019.abilities[0]!;
    expect(a.type).toBe('declared');
    expect(a.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect((a.cost as { kind: string }).kind).toBe('sceneToDeckBottom');
    const q = (a.cost as { target: { query: { filterAny: unknown; filter: unknown; excludeSelf: boolean } } }).target.query;
    expect(q.excludeSelf).toBe(true);
    expect(q.filter).toMatchObject({ levelMin: 7, kind: 'character' });
    expect(q.filterAny).toEqual([{ cardName: '服部平次' }, { trait: '警察' }]);
    const steps = (a.effect as { steps: Array<{ verb?: string; args?: Record<string, unknown> }> }).steps;
    expect(steps[0]).toMatchObject({ verb: 'sceneRemove', args: { filter: { apMax: 8000 }, cause: 'effect' } });
    expect(steps[1]).toMatchObject({ verb: 'sceneEnter', args: { from: 'remove', enterSleep: true, filter: { trait: '警察', levelMax: 5, kind: 'character' } } });
  });

  it('B04079: a1=ミスリード1 (shared), a2=【登場時】scry1 + optional deckToBottom', () => {
    expect(B04079.abilities.length).toBe(2);
    const a2 = B04079.abilities[1]!;
    expect(a2.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const steps = (a2.effect as { steps: Array<{ kind: string; verb?: string }> }).steps;
    expect(steps[0]).toMatchObject({ verb: 'deckRevealUntil' });
    expect(steps[1]!.kind).toBe('optional');
  });

  it('B05014 工藤新一: 突撃 innate + phase-end 自スリープ gate → bounce self + revive コナン Lv3-', () => {
    expect(B05014.keywords).toContain('突撃');
    const a = B05014.abilities[0]!;
    expect(a.trigger?.hook).toBe('phase:end:start');
    expect(a.condition).toMatchObject({ kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' });
    const steps = (a.effect as { steps: Array<{ verb?: string; args?: Record<string, unknown> }> }).steps;
    expect(steps[0]).toMatchObject({ verb: 'sceneToHand', args: { uid: '$self' } });
    expect(steps[1]).toMatchObject({ verb: 'sceneEnter', args: { from: 'remove', enterSleep: true, filter: { cardName: '江戸川コナン', levelMax: 3, kind: 'character' } } });
  });

  it('B09063 谷森棋士: a1=ミスリード1, a2=【自分ターン中】【ターン1】Lv8 enter observer + opp無Lv7 → draw', () => {
    expect(B09063.abilities.length).toBe(2);
    const a2 = B09063.abilities[1]!;
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a2.trigger?.hook).toBe('enter');
    expect(a2.trigger?.matcherCondition).toMatchObject({ kind: 'triggerCharMatches', side: 'self', filter: { levelMin: 8, levelMax: 8 } });
    expect(a2.condition).toEqual({ kind: 'turn', player: 'self' });
    expect(a2.effect).toMatchObject({
      kind: 'conditional', if: { kind: 'not', c: { kind: 'sceneHas', query: { side: 'opp' } } },
      then: { verb: 'draw' },
    });
  });

  it('B09066 メアリー: a1=【登場時】絆(赤井家excludeSelf) conditional sleep, a2=【パートナー赤】phase-end 自スリープ draw+discard', () => {
    expect(B09066.abilities.length).toBe(2);
    const a1 = B09066.abilities[0]!;
    expect(a1.effect?.kind).toBe('conditional');
    expect((a1.effect as { if: unknown }).if).toMatchObject({ kind: 'sceneHas', query: { side: 'self', filter: { trait: '赤井家' }, excludeSelf: true } });
    const a2 = B09066.abilities[1]!;
    expect(a2.trigger?.hook).toBe('phase:end:start');
    expect((a2.condition as { cs: unknown[] }).cs).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'partnerColor', color: '赤' }),
      expect.objectContaining({ kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' }),
    ]));
  });

  it('D01008 阿笠博士: 【登場時】0-1 enter(少年探偵団 Lv4-) else(未登場) AP+1000', () => {
    const a = D01008.abilities[0]!;
    const steps = (a.effect as { steps: Array<{ kind: string; verb?: string; args?: Record<string, unknown>; if?: unknown }> }).steps;
    expect(steps[0]).toMatchObject({ verb: 'sceneEnter', args: { from: 'hand', enterSleep: true } });
    // 「1枚まで…してもよい」= n.min:0
    expect((steps[0]!.args!.target as { n: { min: number } }).n.min).toBe(0);
    expect(steps[1]!.kind).toBe('conditional');
    expect((steps[1] as { if: { kind: string; c: unknown } }).if).toMatchObject({ kind: 'not', c: { kind: 'bound', key: '$matched' } });
  });
});

// BUG-145 over-fire guard: effect 側 conditional の枝に pick を持つカードは、初期 pre-walk で
// human pick/choice/optional を surface してはならない (Pattern-B short-form なら dispatch 時のみ surface)。
describe('wave novel-0624 — BUG-145 over-fire guard (conditional 枝の pick は pre-walk で surface しない)', () => {
  beforeAll(() => registerAll());
  beforeEach(() => {
    _clearPendingEffectPickQueue();
    _clearPendingEffectChoiceSide();
    _clearPendingEffectOptionalSide();
  });

  function ctx(cardId: string, bindings: Record<string, unknown> = {}): EffectCtx {
    return { source: { player: 'self', cardId, abilityId: 'a1' }, bindings } as unknown as EffectCtx;
  }
  function prewalk(s: GameState, e: Effect, c: EffectCtx) {
    resolveEffectPicks(s, e, c, { humanChooser: true, byPlayer: 'self', source: { cardId: c.source.cardId, abilityId: 'a1' } });
    return {
      picks: _peekPendingEffectPickQueueLength(),
      choice: _peekPendingEffectChoiceSide() !== null,
      optional: _peekPendingEffectOptionalSide() !== null,
    };
  }

  // 静的: 3 枚の conditional 枝は optional/choice/Pattern-A($pick) を含まない (= short-form のみ)
  it('B09066/B08092/D01008 の conditional 枝に optional/choice/$pick は無い (短縮形 Pattern-B のみ)', () => {
    expect(hasPreWalkSurface(B09066.abilities[0]!.effect)).toBe(false);
    const b08092Cond = (B08092.abilities[0]!.effect as { steps: Effect[] }).steps[2]!;
    expect(hasPreWalkSurface(b08092Cond)).toBe(false);
    const d01008Cond = (D01008.abilities[0]!.effect as { steps: Effect[] }).steps[1]!;
    expect(hasPreWalkSurface(d01008Cond)).toBe(false);
  });

  it('B09066 a1: 赤井家 decoy 不在 (if=false) でも pre-walk で pick/choice/optional は 0', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('B09066', 'm0')]; // 自身のみ = 他の赤井家 なし
    const r = prewalk(s, B09066.abilities[0]!.effect!, ctx('B09066'));
    expect(r).toEqual({ picks: 0, choice: false, optional: false });
  });

  it('B09066 a1: 赤井家 decoy 在 (if=true) でも 初期 pre-walk は surface しない (short-form は dispatch 時 surface)', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('B09066', 'm0'), sceneChar('B09066', 'm1')]; // m1 も赤井家
    const r = prewalk(s, B09066.abilities[0]!.effect!, ctx('B09066'));
    // 初期 pre-walk では Pattern-B は suppress (BUG-077)。over-fire 無しの核心。
    expect(r).toEqual({ picks: 0, choice: false, optional: false });
  });

  it('B08092 a1 step3 / D01008 a1 step2: conditional 単体を pre-walk しても surface 0', () => {
    const s = createEmptyGameState();
    const b08092Cond = (B08092.abilities[0]!.effect as { steps: Effect[] }).steps[2]!;
    expect(prewalk(s, b08092Cond, ctx('B08092'))).toEqual({ picks: 0, choice: false, optional: false });
    _clearPendingEffectPickQueue();
    const d01008Cond = (D01008.abilities[0]!.effect as { steps: Effect[] }).steps[1]!;
    // $matched bound (= 登場済 → if=false) でも surface 0
    expect(prewalk(s, d01008Cond, ctx('D01008', { matched: [{ uid: 'x', cardId: 'C' }] }))).toEqual({ picks: 0, choice: false, optional: false });
  });
});
