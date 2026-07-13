import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B01006 } from '@/cards/ct-p01/B01006';
import { B03030 } from '@/cards/ct-p03/B03030';
import { B05008 } from '@/cards/ct-p05/B05008';
import { B05048 } from '@/cards/ct-p05/B05048';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetRegistry, register } from '@/engine/read/def';
import { mutate } from '@/engine/mutate';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import type { CardDef, Effect, EffectCtx } from '@/engine/types';

const char = (id: string, names = [id]): CardDef => ({ id, no: id, kind: 'character', names, colors: ['青'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
const CONAN = char('WAVE_D_CONAN', ['江戸川コナン']);
const MOMIJI = char('WAVE_D_MOMIJI', ['大岡紅葉']);
const AOKO = char('WAVE_D_AOKO', ['中森青子']);
const OPP_EVENT = { ...char('WAVE_D_EVENT'), kind: 'event' as const };
const ctx: EffectCtx = { source: { player: 'opp', cardId: OPP_EVENT.id, abilityId: 'a1', uid: 'opp-event', area: 'remove' }, bindings: {} };

function select(state: ReturnType<typeof createEmptyGameState>, cardName: string) {
  const pick: Effect = { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'opp', max: 1, filter: { cardName } } };
  const resolved = resolveEffectPicks(state, pick, ctx, { humanChooser: true, byPlayer: 'opp', source: { cardId: OPP_EVENT.id, abilityId: 'a1' } });
  return produce(state, draft => runEffect(draft, resolved, ctx));
}

beforeEach(() => { _resetRegistry(); _clearPendingEffectPickQueue(); [B01006, B03030, B05008, B05048, CONAN, MOMIJI, AOKO, OPP_EVENT].forEach(register); });

describe('Wave D untargetableByOppEffect', () => {
  it('bond-protected B01006/B03030/B05008 are excluded only while their named bond is present', () => {
    const assertProtected = (protectedId: string, protectedName: string, bondId: string) => {
      const state = createEmptyGameState();
      mutate.scene.enter(state, 'self', protectedId, {});
      mutate.scene.enter(state, 'self', bondId, {});
      select(state, protectedName);
      expect(_drainPendingEffectPickSide()).toBeNull();
    };
    assertProtected(B01006.id, '灰原哀', CONAN.id);
    assertProtected(B03030.id, '伊織無我', MOMIJI.id);
    assertProtected(B05008.id, '灰原哀', CONAN.id);
    assertProtected(B05048.id, '中森青子', AOKO.id);
  });
});
