import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runDeclaredAbilityFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { useStackedCardCostPicker, useStackedCardCostPickerStore } from '@/ui/hooks/useStackedCardCostPicker';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { B08003 } from '@/cards/ct-p08/B08003';
import { D08001 } from '@/cards/ct-d08/D08001';
import type { CardDef, GameState } from '@/engine/types';

const character = (id: string, level: number): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['青'], level, ap: 0, lp: 1,
  traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});

async function flush(): Promise<void> { await new Promise<void>((resolve) => setTimeout(resolve, 0)); }
async function pickSource(uid: string): Promise<void> {
  const store = useTargetPickerStore.getState();
  const resolve = store._resolver!;
  store._setPhase({ phase: 'idle' }); store._setResolver(null); resolve(uid);
  await flush();
}
async function accept(): Promise<void> {
  const store = useConfirmationStore.getState();
  const resolve = store._resolver!;
  store._setCurrent(null); store._setResolver(null); resolve(true);
  await flush();
}

function setup(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner.cardId = 'D08001';
  state.players.self.partner.state = 'active';
  state.players.self.scene.push({
    uid: 'agasa', cardId: 'B08003', state: 'active', isNamed: false, enterOrder: 1,
    setCards: [], stackedCards: [
      { cardId: 'A', instanceId: 'stack:agasa:a' },
      { cardId: 'DUP', instanceId: 'stack:agasa:b' },
      { cardId: 'DUP', instanceId: 'stack:agasa:c' },
      { cardId: 'D', instanceId: 'stack:agasa:d' },
    ], keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  return state;
}

beforeEach(() => {
  _resetRegistry();
  [B08003, D08001, character('A', 8), character('DUP', 8), character('D', 8)].forEach(registerCardDef);
  useGameStateStore.setState({ gameState: setup(), pendingEffectPick: null });
  useTargetPickerStore.getState()._reset(); useConfirmationStore.getState()._reset();
  useStackedCardCostPickerStore.setState({ current: null, _resolver: null });
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});
afterEach(() => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null; });

describe('runDeclaredAbilityFlow removeStackedCards', () => {
  it('does not expose a2 when the partner is not blue', async () => {
    registerCardDef({ ...D08001, id: 'RED_PARTNER', no: 'RED_PARTNER', colors: ['赤'] });
    useGameStateStore.getState().gameState!.players.self.partner.cardId = 'RED_PARTNER';
    expect(await runDeclaredAbilityFlow({ player: 'self' })).toMatchObject({ ok: false, reason: 'not-allowed' });
  });

  it('requires exact non-first stacked identities and lets the AI opponent resolve only those cards', async () => {
    const pending = runDeclaredAbilityFlow({ player: 'self' });
    await pickSource('agasa');
    await accept();
    expect(useStackedCardCostPickerStore.getState().current?.candidates.map((c) => c.instanceId))
      .toEqual(['stack:agasa:a', 'stack:agasa:b', 'stack:agasa:c', 'stack:agasa:d']);
    useStackedCardCostPicker().confirm(['stack:agasa:b', 'stack:agasa:c', 'stack:agasa:d']);
    await flush();
    expect((await pending).ok).toBe(true);
    const state = useGameStateStore.getState().gameState!;
    expect(state.players.self.scene.find((c) => c.uid === 'agasa')).toBeUndefined();
    expect(state.players.self.scene.map((c) => c.cardId)).toEqual(['DUP']);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('cancel does not sleep or remove any stacked card', async () => {
    const pending = runDeclaredAbilityFlow({ player: 'self' });
    await pickSource('agasa'); await accept();
    useStackedCardCostPicker().cancel(); await flush();
    expect(await pending).toMatchObject({ ok: false, reason: 'cancelled' });
    const source = useGameStateStore.getState().gameState!.players.self.scene.find((c) => c.uid === 'agasa')!;
    expect(source.state).toBe('active');
    expect(source.stackedCards).toHaveLength(4);
  });
});
