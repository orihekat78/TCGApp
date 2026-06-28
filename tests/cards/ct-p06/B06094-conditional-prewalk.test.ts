// B06094 高木君のおごり — conditional pre-walk over-fire 回帰テスト (BUG-145、card-level)。
//
// a1.effect = conditional{ if: sceneHas(self, 喫茶ポアロ>=3),
//   then: sequence[optActive($pick), optSleep($pick)],   // 代わりに2つとも
//   else: choice[optActive, optSleep] }                  // 以下から1つ選んで行う
//
// BUG: 旧 resolve-picks は then/else 両枝を無条件 walk → if=TRUE でも else-choice が
//   pendingEffectChoice として eager-surface (= 余計な modal)。binding-aware fix で
//   stable な if (sceneHas は board-state、binding 非依存) は taken 枝のみ walk。
// rules: 03-field-areas.md(スタン), 15-abilities-effects.md, 17-icons.md

import { describe, it, expect, beforeEach } from 'vitest';
import { B06094 } from '@/cards/ct-p06/B06094';
import {
  resolveEffectPicks,
  _drainPendingEffectChoiceSide,
  _clearPendingEffectChoiceSide,
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickQueueLength,
} from '@/engine/effect/resolve-picks';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EffectCtx, GameState, Effect } from '@/engine/types';
import { makeChar } from '../../helpers/fixtures';

function poaro(uid: string): ReturnType<typeof makeChar> {
  return makeChar({ uid, cardId: 'POARO', state: 'active' });
}
const POARO_DEF = {
  id: 'POARO', no: '9/POARO', kind: 'character', names: ['喫茶ポアロ店員'], colors: ['黄'],
  level: 3, ap: 1000, lp: 1, traits: ['喫茶ポアロ'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
} as unknown as CardDef;

const a1Effect = B06094.abilities.find((a) => a.id === 'a1')!.effect as Effect;
const ctx = (): EffectCtx =>
  ({ source: { player: 'self', cardId: 'B06094', abilityId: 'a1' }, bindings: {} } as unknown as EffectCtx);
const walkOpts = { humanChooser: true, byPlayer: 'self' as const, source: { cardId: 'B06094', abilityId: 'a1' } };

beforeEach(() => {
  resetDefRegistry();
  registerCardDef(B06094);
  registerCardDef(POARO_DEF);
  _clearPendingEffectPickQueue();
  _clearPendingEffectChoiceSide();
});

describe('B06094 conditional pre-walk over-fire 回帰 (BUG-145)', () => {
  it('喫茶ポアロ3枚 (if=TRUE) → else-choice は surface せず then-sequence の pick のみ', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [poaro('p1'), poaro('p2'), poaro('p3')]; // active 3枚
    resolveEffectPicks(s, a1Effect, ctx(), walkOpts);
    expect(_drainPendingEffectChoiceSide(), 'if=TRUE: else-choice 抑止 (over-fire 修正)').toBeNull();
    expect(_peekPendingEffectPickQueueLength(), 'then-sequence の optActive pick は surface').toBeGreaterThan(0);
  });

  it('喫茶ポアロ2枚 (if=FALSE) → else-choice が正しく surface する', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [poaro('p1'), poaro('p2')]; // 3枚未満
    resolveEffectPicks(s, a1Effect, ctx(), walkOpts);
    expect(_drainPendingEffectChoiceSide(), 'if=FALSE: else-choice 発火').not.toBeNull();
  });
});
