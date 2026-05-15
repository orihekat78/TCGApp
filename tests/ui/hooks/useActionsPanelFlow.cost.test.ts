// Phase 8.8c: Ability cost resolution UI tests
//
// rules: 21-declared-ability-cost.md
// spec: ui-action-flows.md ③ / ④ (cost 表示 + 支払)
//
// 仕様:
//   - modal body に cost テキストが含まれる ("コスト: ...")
//   - 支払不能 (canPay=false) なら candidates から除外 → not-allowed
//   - confirm reject → cost.pay 呼ばれず / state 不変
//   - accept → cost.pay → flow.use*Ability の順で atomic に実行

import { describe, it, expect, beforeEach } from 'vitest';
import {
  runDeclaredAbilityFlow,
  runPartnerAbilityFlow,
} from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { produce } from '@/engine/produce';
import type { CardDef, Cost, GameState } from '@/engine/types';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id], colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1, ap: opts.ap ?? 1000, lp: opts.lp ?? 1000,
    traits: opts.traits ?? [], rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '', abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function declAbil(id: string, cost?: Cost) {
  return { id, name: id, type: 'declared' as const, description: '', cost };
}

function setupBase(): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    d.players.self.partner = { cardId: 'PS', state: 'active', location: 'partner-area' };
  });
}

async function acceptConfirmation(): Promise<void> {
  const r = useConfirmationStore.getState()._resolver!;
  useConfirmationStore.getState()._setCurrent(null);
  useConfirmationStore.getState()._setResolver(null);
  r(true);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function rejectConfirmation(): Promise<void> {
  const r = useConfirmationStore.getState()._resolver!;
  useConfirmationStore.getState()._setCurrent(null);
  useConfirmationStore.getState()._setResolver(null);
  r(false);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

beforeEach(() => {
  useGameStateStore.setState({ gameState: null });
  useTargetPickerStore.getState()._reset();
  useConfirmationStore.getState()._reset();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('PS', { kind: 'partner' }));
});

describe('Phase 8.8c: ability cost in confirm modal', () => {
  it('ability with no cost: modal body says "コスト: 無し"', async () => {
    registerCardDef(makeCard('NoCost', { abilities: [declAbil('a1')] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'NoCost', { active: true });
    });
    useGameStateStore.setState({ gameState: s });
    const promise = runDeclaredAbilityFlow({ player: 'self' });
    const body = useConfirmationStore.getState().current?.body ?? '';
    expect(body).toContain('コスト');
    expect(body).toContain('無し');
    await acceptConfirmation();
    const result = await promise;
    expect(result.ok).toBe(true);
  });

  it('declared ability with sleepSelf cost: modal shows cost text + char becomes sleep after dispatch', async () => {
    const cost: Cost = { kind: 'sleepSelf' };
    registerCardDef(makeCard('SleepCost', { abilities: [declAbil('a1', cost)] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'SleepCost', { active: true });
    });
    useGameStateStore.setState({ gameState: s });
    const charUid = s.players.self.scene[0].uid;

    const promise = runDeclaredAbilityFlow({ player: 'self' });
    const body = useConfirmationStore.getState().current?.body ?? '';
    expect(body).toContain('スリープ'); // costToText('sleepSelf')

    await acceptConfirmation();
    const result = await promise;
    expect(result.ok).toBe(true);

    // cost.pay が走り、char が sleep 状態に
    const after = useGameStateStore.getState().gameState!;
    const charAfter = after.players.self.scene.find((c) => c.uid === charUid);
    expect(charAfter?.state).toBe('sleep');
  });

  it('declared ability with sleepSelf cost but char already sleeping: filtered out (not-allowed)', async () => {
    const cost: Cost = { kind: 'sleepSelf' };
    registerCardDef(makeCard('AlreadySleep', { abilities: [declAbil('a1', cost)] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'AlreadySleep', { active: false }); // sleep
    });
    useGameStateStore.setState({ gameState: s });
    const result = await runDeclaredAbilityFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('reject confirmation: cost not paid, state unchanged', async () => {
    const cost: Cost = { kind: 'sleepSelf' };
    registerCardDef(makeCard('SleepCost', { abilities: [declAbil('a1', cost)] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'SleepCost', { active: true });
    });
    useGameStateStore.setState({ gameState: s });
    const before = useGameStateStore.getState().gameState;
    const promise = runDeclaredAbilityFlow({ player: 'self' });
    await rejectConfirmation();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    // 状態は不変 (cost.pay も flow.use* も呼ばれていない)
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('partner ability with no cost: modal shows "コスト: 無し" + dispatch', async () => {
    registerCardDef(makeCard('PS', { kind: 'partner', abilities: [declAbil('p1')] }));
    useGameStateStore.setState({ gameState: setupBase() });
    const promise = runPartnerAbilityFlow({ player: 'self' });
    const body = useConfirmationStore.getState().current?.body ?? '';
    expect(body).toContain('コスト');
    await acceptConfirmation();
    const result = await promise;
    expect(result.ok).toBe(true);
  });
});
