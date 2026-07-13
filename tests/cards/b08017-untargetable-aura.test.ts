import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B08017 } from '@/cards/ct-p08/B08017';
import { createEmptyGameState } from '@/engine/state-factory';
import { register, _resetRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import type { CardDef, Effect, EffectCtx } from '@/engine/types';

const char = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const HAI = char('B08017_HAI', { names: ['灰原哀'] });
const CONAN = char('B08017_CONAN', { names: ['江戸川コナン'] });
const EFFECT_EVENT = { ...char('B08017_EFFECT_EVENT'), kind: 'event' as const };
const EFFECT_CHAR = char('B08017_EFFECT_CHAR');

const selectOne: Effect = {
  kind: 'atom', verb: 'sceneRemove',
  args: { player: 'self', max: 1, side: 'opp' },
};

const ctx = (player: 'self' | 'opp', cardId: string, area: EffectCtx['source']['area'] = 'scene'): EffectCtx => ({
  source: { player, cardId, abilityId: 'a1', uid: `src:${player}`, area }, bindings: {},
});

function runPick(state: ReturnType<typeof createEmptyGameState>, source: EffectCtx) {
  const resolved = resolveEffectPicks(state, selectOne, source, { humanChooser: true, byPlayer: source.source.player, source: { cardId: source.source.cardId!, abilityId: 'a1' } });
  return produce(state, draft => runEffect(draft, resolved, source));
}

beforeEach(() => {
  _resetRegistry(); _clearPendingEffectPickQueue();
  [B08017, HAI, CONAN, EFFECT_EVENT, EFFECT_CHAR].forEach(register);
});

describe('B08017 set-host untargetableByOppEffect aura', () => {
  it('sleep hostの表向きset riderは、相手event/cutin/hirameki由来のeffect pickから自分の灰原哀を除外する', () => {
    const state = createEmptyGameState();
    const host = mutate.scene.enter(state, 'self', CONAN.id, {});
    mutate.scene.setState(state, host.uid, 'sleep');
    mutate.char.setCard(state, host.uid, B08017.id, true);
    mutate.scene.enter(state, 'self', HAI.id, {});

    runPick(state, ctx('opp', EFFECT_EVENT.id));
    expect(_drainPendingEffectPickSide()?.candidates.map(c => c.cardId)).toEqual([CONAN.id]);
  });
});
