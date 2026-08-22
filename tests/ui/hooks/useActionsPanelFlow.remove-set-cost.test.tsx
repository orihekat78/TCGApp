// BUG-248: 人間の removeSetCard 宣言コストは、裏面の物理 occurrence を明示選択する。
// rules: 16-card-set.md, 21-declared-ability-cost.md

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { B02023 } from '@/cards/ct-p02/B02023';
import { B03035 } from '@/cards/ct-p03/B03035';
import { B05052 } from '@/cards/ct-p05/B05052';
import { B07048 } from '@/cards/ct-p07/B07048';
import { B08033 } from '@/cards/ct-p08/B08033';
import { B08041 } from '@/cards/ct-p08/B08041';
import { B09027 } from '@/cards/ct-p09/B09027';
import { PR234 } from '@/cards/pr-01/PR234';
import { PR240 } from '@/cards/pr-01/PR240';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';
import { runDeclaredAbilityFlow } from '@/ui/hooks/useActionsPanelFlow';
import { findRemoveSetCardCost } from '@/ui/hooks/useActionsPanelFlow/cost';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { useChoicePicker, useChoicePickerStore } from '@/ui/hooks/useChoicePicker';
import { confirmSetCardCostChoice, toggleSetCardCostChoice } from '@/ui/hooks/useSetCardCostPicker';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { EffectDecisionModalHosts } from '@/ui/components/EffectDecisionModalHosts';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function card(id: string): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 1, ap: 1000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

function namedCard(id: string, name: string): CardDef {
  return { ...card(id), names: [name] };
}

function whitePartner(id: string): CardDef {
  return { ...card(id), kind: 'partner', colors: ['白'] } as CardDef;
}

async function chooseSource(uid: string): Promise<void> {
  const store = useTargetPickerStore.getState();
  const resolve = store._resolver!;
  await act(async () => {
    store._setPhase({ phase: 'idle' });
    store._setResolver(null);
    resolve(uid);
    await tick();
  });
}

async function confirmAbility(): Promise<void> {
  const store = useConfirmationStore.getState();
  const resolve = store._resolver!;
  await act(async () => {
    store._setCurrent(null);
    store._setResolver(null);
    resolve(true);
    await tick();
  });
}

async function chooseCostBranch(index: number): Promise<void> {
  await act(async () => {
    useChoicePicker().choose(index);
    await tick();
  });
}

async function confirmSetCardCost(...instanceIds: string[]): Promise<void> {
  await act(async () => {
    for (const instanceId of instanceIds) toggleSetCardCostChoice(instanceId);
    confirmSetCardCostChoice();
    await tick();
  });
}

beforeEach(() => {
  resetDefRegistry();
  registerCardDef(B02023);
  for (const def of [B03035, B05052, B07048, B08033, B08041, B09027]) registerCardDef(def);
  registerCardDef(PR234);
  registerCardDef(PR240);
  registerCardDef(card('HOST'));
  registerCardDef(card('TARGET'));
  registerCardDef(namedCard('TWIN-A', '同名キャラ'));
  registerCardDef(namedCard('TWIN-B', '同名キャラ'));
  registerCardDef(namedCard('SHINICHI', '工藤新一'));
  registerCardDef(whitePartner('WHITE-PARTNER'));
  useTargetPickerStore.getState()._reset();
  useConfirmationStore.getState()._reset();
  useChoicePickerStore.getState()._reset();
  useGameStateStore.getState().resetMatchSessionState();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('runDeclaredAbilityFlow — removeSetCard cost', () => {
  it.each([
    [B02023, 'a2', undefined, { n: 1 }],
    [B03035, 'a1', undefined, { n: 1, anyFace: true }],
    [B05052, 'a2', 1, { n: 1, anyFace: true }],
    [B07048, 'a2', undefined, { n: 2 }],
    [B08033, 'a2', undefined, { n: 2 }],
    [B08041, 'a2', undefined, { n: 1, hostSelf: true }],
    [B09027, 'a1', 0, { n: 1 }],
  ] as const)(
    '%s public flow exposes its selected removeSetCard cost to the shared picker',
    (def, abilityId, choiceIndex, expected) => {
      const ability = def.abilities.find((candidate) => candidate.id === abilityId)!;
      expect(findRemoveSetCardCost(ability.cost, choiceIndex)).toMatchObject(expected);
    },
  );

  it('裏向きcardIdを公開せず物理instanceを選択し、その選択だけをdispatchへ渡す', async () => {
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar('B02023', 'kazuha', { setCards: [{ cardId: 'SECRET-A', faceUp: false, instanceId: 'set:101' }] }),
      sceneChar('HOST', 'host', { setCards: [
        { cardId: 'SECRET-B', faceUp: false, instanceId: 'set:102' },
        { cardId: 'PUBLIC-C', faceUp: true, instanceId: 'set:103' },
      ] }),
      sceneChar('TARGET', 'target'),
    ];
    useGameStateStore.setState({ gameState: state });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<EffectDecisionModalHosts />));

    let flow!: ReturnType<typeof runDeclaredAbilityFlow>;
    await act(async () => {
      flow = runDeclaredAbilityFlow({ player: 'self' });
      await tick();
    });
    await chooseSource('kazuha');
    await confirmAbility();

    const pending = useGameStateStore.getState().pendingSetCardChoice;
    expect(pending).toMatchObject({ player: 'self', purpose: 'cost', nMin: 1, nMax: 1 });
    expect(pending?.entries.map((entry) => entry.instanceId)).toEqual(['set:101', 'set:102']);
    expect(JSON.stringify(pending)).not.toContain('SECRET-A');
    expect(JSON.stringify(pending)).not.toContain('SECRET-B');
    expect(JSON.stringify(pending)).not.toContain('PUBLIC-C');

    const first = container.querySelector<HTMLButtonElement>('[data-instance-id="set:101"]')!;
    await act(async () => { first.click(); await tick(); });
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="set-card-cost-confirm"]')!;
    expect(confirm).toBeInstanceOf(HTMLButtonElement);
    await act(async () => { confirm.click(); await tick(); });

    expect(await flow).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.remove).toContain('SECRET-A');
    expect(after.players.self.scene.find((char) => char.uid === 'host')!.setCards.map((entry) => entry.cardId)).toEqual(['SECRET-B', 'PUBLIC-C']);
    expect(readChar.declaredUseCount(after, 'kazuha', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toBe(1);

    await act(async () => root.unmount());
    container.remove();
  });

  it('同名hostでも公開された現場位置と物理instanceで区別し、秘密は表示しない', async () => {
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar('B02023', 'source'),
      sceneChar('TWIN-A', 'twin-a', { setCards: [{ cardId: 'SECRET-ONE', faceUp: false, instanceId: 'set:twin-a' }] }),
      sceneChar('TWIN-B', 'twin-b', { setCards: [{ cardId: 'SECRET-TWO', faceUp: false, instanceId: 'set:twin-b' }] }),
    ];
    useGameStateStore.getState().setGameState(state);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<EffectDecisionModalHosts />));
    let flow!: ReturnType<typeof runDeclaredAbilityFlow>;
    await act(async () => { flow = runDeclaredAbilityFlow({ player: 'self' }); await tick(); });
    await chooseSource('source');
    await confirmAbility();

    const pending = useGameStateStore.getState().pendingSetCardChoice!;
    expect(pending.entries.map((entry) => ({ label: entry.hostLabel, ordinal: entry.ordinal }))).toEqual([
      { label: '同名キャラ（現場2）', ordinal: 1 },
      { label: '同名キャラ（現場3）', ordinal: 2 },
    ]);
    expect(JSON.stringify(pending)).not.toContain('SECRET-');
    expect(container.querySelector('[data-instance-id="set:twin-a"][aria-label*="現場2"]')).toBeTruthy();
    expect(container.querySelector('[data-instance-id="set:twin-b"][aria-label*="現場3"]')).toBeTruthy();

    await act(async () => { container.querySelector<HTMLButtonElement>('[data-instance-id="set:twin-b"]')!.click(); await tick(); });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="set-card-cost-confirm"]')!.click(); await tick(); });
    expect((await flow).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.remove).toContain('SECRET-TWO');
    expect(after.players.self.scene.find((char) => char.uid === 'twin-a')!.setCards).toHaveLength(1);
    expect(after.players.self.scene.find((char) => char.uid === 'twin-b')!.setCards).toHaveLength(0);
    await act(async () => root.unmount());
    container.remove();
  });

  it('入れ子choiceの公開経路でcostChoicePathを組み、removeSetCardの実物を支払う', async () => {
    const nested: CardDef = {
      ...B02023,
      id: 'NESTED-COST', no: 'NESTED-COST', names: ['Nested cost'],
      abilities: [{
        id: 'a1', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
        cost: { kind: 'choice', items: [
          { kind: 'removeFromHand', n: 1, target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' } },
          { kind: 'choice', items: [{ kind: 'removeFromHand', n: 1, target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' } }, { kind: 'removeSetCard', n: 1 }] },
        ] },
        effect: { kind: 'sequence', steps: [] }, description: 'nested cost', ruleRefs: [],
      }],
    };
    registerCardDef(nested);
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.hand = ['HAND'];
    state.players.self.deck = ['DRAW'];
    state.players.self.scene = [
      sceneChar('NESTED-COST', 'source'),
      sceneChar('HOST', 'host', { setCards: [{ cardId: 'SECRET-NESTED', faceUp: false, instanceId: 'set:nested' }] }),
    ];
    useGameStateStore.getState().setGameState(state);
    let flow!: ReturnType<typeof runDeclaredAbilityFlow>;
    await act(async () => { flow = runDeclaredAbilityFlow({ player: 'self' }); await tick(); });
    expect(useTargetPickerStore.getState()._resolver).toBeTypeOf('function');
    await chooseSource('source');
    await confirmAbility();
    await chooseCostBranch(1);
    await chooseCostBranch(1);
    expect(useGameStateStore.getState().pendingSetCardChoice?.entries.map((entry) => entry.instanceId)).toEqual(['set:nested']);
    await confirmSetCardCost('set:nested');
    expect(await flow).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.pendingEffects.at(-1)?.costPaid).toMatchObject({ removeSetCard: { ids: ['SECRET-NESTED'] } });
    expect(after.players.self.remove).toContain('SECRET-NESTED');
    expect(readChar.declaredUseCount(after, 'source', 'a1', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(1);
  });

  it('hydrates missing and duplicate occurrence IDs before presenting the public picker', async () => {
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.setCardInstanceSeq = 1;
    state.players.self.scene = [
      sceneChar('B02023', 'kazuha'),
      sceneChar('HOST', 'host', { setCards: [
        { cardId: 'SECRET-A', faceUp: false, instanceId: 'set:4' },
        { cardId: 'SECRET-B', faceUp: false, instanceId: 'set:4' },
        { cardId: 'SECRET-C', faceUp: false },
      ] }),
    ];
    state.players.opp.scene = [
      sceneChar('HOST', 'opp-host', { setCards: [
        { cardId: 'OPP-SECRET', faceUp: false, instanceId: 'set:4' },
      ] }),
    ];
    useGameStateStore.getState().setGameState(state);
    const hydrated = useGameStateStore.getState().gameState!;
    const ids = hydrated.players.self.scene.find((char) => char.uid === 'host')!.setCards.map((entry) => entry.instanceId);
    expect(ids).toEqual(['set:4', 'set:5', 'set:6']);
    expect(hydrated.players.opp.scene[0]!.setCards[0]!.instanceId).toBe('set:7');
    expect(hydrated.setCardInstanceSeq).toBe(8);
    expect(state.players.self.scene[1]!.setCards.map((entry) => entry.instanceId)).toEqual(['set:4', 'set:4', undefined]);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<EffectDecisionModalHosts />));

    let flow!: ReturnType<typeof runDeclaredAbilityFlow>;
    await act(async () => { flow = runDeclaredAbilityFlow({ player: 'self' }); await tick(); });
    await chooseSource('kazuha');
    await confirmAbility();
    const pending = useGameStateStore.getState().pendingSetCardChoice!;
    expect(pending.entries.map((entry) => entry.instanceId)).toEqual(ids);
    expect(JSON.stringify(pending)).not.toContain('SECRET-');

    const second = container.querySelector<HTMLButtonElement>('[data-instance-id="set:5"]')!;
    await act(async () => { second.click(); await tick(); });
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="set-card-cost-confirm"]')!;
    await act(async () => { confirm.click(); await tick(); });
    expect(await flow).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.scene.find((char) => char.uid === 'host')!.setCards.map((entry) => entry.instanceId))
      .toEqual(['set:4', 'set:6']);

    await act(async () => root.unmount());
    container.remove();
  });

  it.each(['PR234', 'PR240'])(
    'B03035 may publicly select a face-up %s set card and AI-compatible payment resolves',
    async (setCardId) => {
      const state = createEmptyGameState();
      state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      state.players.self.deck = ['DRAW'];
      state.players.self.scene = [
        sceneChar('B03035', 'otaki'),
        sceneChar('HOST', 'host', { setCards: [{ cardId: setCardId, faceUp: true, instanceId: `set:${setCardId}` }] }),
      ];
      useGameStateStore.getState().setGameState(state);

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      act(() => root.render(<EffectDecisionModalHosts />));

      let flow!: ReturnType<typeof runDeclaredAbilityFlow>;
      await act(async () => { flow = runDeclaredAbilityFlow({ player: 'self' }); await tick(); });
      await chooseSource('otaki');
      await confirmAbility();
      const pending = useGameStateStore.getState().pendingSetCardChoice!;
      expect(pending.entries).toEqual([expect.objectContaining({
        instanceId: `set:${setCardId}`,
        cardId: setCardId,
        hidden: false,
      })]);

      const tile = container.querySelector<HTMLButtonElement>(`[data-instance-id="set:${setCardId}"]`)!;
      await act(async () => { tile.click(); await tick(); });
      const confirm = container.querySelector<HTMLButtonElement>('[data-testid="set-card-cost-confirm"]')!;
      await act(async () => { confirm.click(); await tick(); });
      expect(await flow).toEqual({ ok: true });
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.scene.find((char) => char.uid === 'otaki')!.state).toBe('sleep');
      expect(after.players.self.scene.find((char) => char.uid === 'host')!.setCards).toEqual([]);
      expect(after.players.self.hand).toEqual(['DRAW']);
      expect(after.players.self.deck).toContain(setCardId);
      expect(after.pendingEffects.at(-1)?.costPaid?.removeSetCard).toMatchObject({ ids: [setCardId] });

      await act(async () => root.unmount());
      container.remove();
    },
  );

  it.each([
    ['B05052', 'a2', 1, ['set:b05052'], { bond: true }],
    ['B09027', 'a1', 0, ['set:b09027'], {}],
  ] as const)(
    '%s takes the set-card branch after the public cost choice and pays the selected occurrence',
    async (cardId, abilityId, branch, instanceIds, opts) => {
      const state = createEmptyGameState();
      state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      state.players.self.partner.cardId = 'WHITE-PARTNER';
      state.players.self.hand = ['HAND'];
      state.players.self.scene = [
        sceneChar(cardId, 'source'),
        sceneChar('HOST', 'host', { setCards: [{ cardId: 'SET-COST', faceUp: false, instanceId: instanceIds[0] }] }),
        ...(opts.bond ? [sceneChar('SHINICHI', 'shinichi')] : []),
      ];
      useGameStateStore.setState({ gameState: state });

      let flow!: ReturnType<typeof runDeclaredAbilityFlow>;
      await act(async () => { flow = runDeclaredAbilityFlow({ player: 'self' }); await tick(); });
      await chooseSource('source');
      await confirmAbility();
      expect(useChoicePickerStore.getState().current?.options.map((option) => option.index)).toContain(branch);
      await chooseCostBranch(branch);
      expect(useGameStateStore.getState().pendingSetCardChoice?.entries.map((entry) => entry.instanceId)).toEqual(instanceIds);
      await confirmSetCardCost(...instanceIds);

      expect((await flow).ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.remove).toContain('SET-COST');
      expect(after.players.self.hand).toEqual(['HAND']);
    },
  );

  it.each([
    ['B07048', 'a2', ['set:n2:one', 'set:n2:two']],
    ['B08033', 'a2', ['set:n2:one', 'set:n2:two']],
  ] as const)(
    '%s requires and pays exactly two selected set-card occurrences',
    async (cardId, abilityId, instanceIds) => {
      const state = createEmptyGameState();
      state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      state.players.self.partner.cardId = 'WHITE-PARTNER';
      state.players.self.scene = [
        sceneChar(cardId, 'source'),
        sceneChar('HOST', 'host', { setCards: instanceIds.map((instanceId, index) => ({ cardId: `SET-${index}`, faceUp: false, instanceId })) }),
      ];
      useGameStateStore.setState({ gameState: state });

      let flow!: ReturnType<typeof runDeclaredAbilityFlow>;
      await act(async () => { flow = runDeclaredAbilityFlow({ player: 'self' }); await tick(); });
      await chooseSource('source');
      await confirmAbility();
      const pending = useGameStateStore.getState().pendingSetCardChoice!;
      expect(pending).toMatchObject({ nMin: 2, nMax: 2 });
      await confirmSetCardCost(...instanceIds);

      expect((await flow).ok).toBe(true);
      expect(useGameStateStore.getState().gameState!.players.self.scene.find((char) => char.uid === 'host')!.setCards).toEqual([]);
    },
  );

  it('B08041 only exposes its own set cards and pays that exact hostSelf occurrence', async () => {
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar('B08041', 'source', { setCards: [{ cardId: 'SET-SELF', faceUp: false, instanceId: 'set:self' }] }),
      sceneChar('HOST', 'decoy', { setCards: [{ cardId: 'SET-DECOY', faceUp: false, instanceId: 'set:decoy' }] }),
    ];
    useGameStateStore.setState({ gameState: state });

    let flow!: ReturnType<typeof runDeclaredAbilityFlow>;
    await act(async () => { flow = runDeclaredAbilityFlow({ player: 'self' }); await tick(); });
    await chooseSource('source');
    await confirmAbility();
    expect(useGameStateStore.getState().pendingSetCardChoice?.entries.map((entry) => entry.instanceId)).toEqual(['set:self']);
    await confirmSetCardCost('set:self');

    expect((await flow).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.find((char) => char.uid === 'source')!.setCards).toEqual([]);
    expect(after.players.self.scene.find((char) => char.uid === 'decoy')!.setCards.map((entry) => entry.instanceId)).toEqual(['set:decoy']);
  });
});
