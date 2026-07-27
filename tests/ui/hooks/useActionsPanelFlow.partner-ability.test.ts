// Phase 8.8a: runPartnerAbilityFlow tests
//
// rules: 13-keywords.md (パートナー共通能力) / 21-declared-ability-cost.md
// spec: .claude/specs/2026-05-11-ui-action-flows.md ③パートナー能力
//
// 仕様:
//   - パートナーの declared ability を engine.cards から列挙
//   - 0 件 → not-allowed
//   - 1 件 → 即 confirm modal → accept で dispatch
//   - 2 件以上 → useTargetPicker で 1 つ選択 → confirm → dispatch

import { describe, it, expect, beforeEach } from 'vitest';
import { runPartnerAbilityFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { useChoicePickerStore } from '@/ui/hooks/useChoicePicker';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  register as registerCardDef,
  _resetRegistry as resetDefRegistry,
} from '@/engine/read/def';
import type { CardDef, GameState } from '@/engine/types';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: opts.kind ?? 'partner',
    names: opts.names ?? [id],
    colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    ap: opts.ap ?? 1000,
    lp: opts.lp ?? 2,
    traits: opts.traits ?? [],
    rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '',
    abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function makeDeclaredAbil(id: string, name: string = id) {
  return {
    id,
    name,
    type: 'declared' as const,
    description: `${id} desc`,
  };
}

function setupWithPartner(cardId: string): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner = { cardId, state: 'active', location: 'partner-area' };
  return s;
}

async function pickAndConfirmPicker(uid: string): Promise<void> {
  const r = useTargetPickerStore.getState()._resolver!;
  useTargetPickerStore.getState()._setPhase({ phase: 'idle' });
  useTargetPickerStore.getState()._setResolver(null);
  r(uid);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function cancelPicker(): Promise<void> {
  const r = useTargetPickerStore.getState()._resolver!;
  useTargetPickerStore.getState()._setPhase({ phase: 'idle' });
  useTargetPickerStore.getState()._setResolver(null);
  r(null);
  await new Promise<void>((r2) => setTimeout(r2, 0));
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

async function chooseAbility(index: number): Promise<void> {
  const r = useChoicePickerStore.getState()._resolver!;
  useChoicePickerStore.getState()._setCurrent(null);
  useChoicePickerStore.getState()._setResolver(null);
  r({ kind: 'choose', index });
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function cancelAbilityChoice(): Promise<void> {
  const r = useChoicePickerStore.getState()._resolver!;
  useChoicePickerStore.getState()._setCurrent(null);
  useChoicePickerStore.getState()._setResolver(null);
  r({ kind: 'cancel' });
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

describe('runPartnerAbilityFlow', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    useTargetPickerStore.getState()._reset();
    useConfirmationStore.getState()._reset();
    useChoicePickerStore.getState()._reset();
    resetDefRegistry();
  });

  it('returns not-allowed when partner has no declared abilities', async () => {
    registerCardDef(makeCard('P-NONE', { abilities: [] }));
    useGameStateStore.setState({ gameState: setupWithPartner('P-NONE') });
    const result = await runPartnerAbilityFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('with 1 ability: shows confirm modal → accept → dispatch', async () => {
    registerCardDef(makeCard('P-ONE', { abilities: [makeDeclaredAbil('a1')] }));
    useGameStateStore.setState({ gameState: setupWithPartner('P-ONE') });
    const promise = runPartnerAbilityFlow({ player: 'self' });

    // picker は呼ばれない (1 件のみ)
    expect(useTargetPickerStore.getState().phase.phase).toBe('idle');
    expect(useConfirmationStore.getState().current?.kind).toBe('standard');
    expect(useConfirmationStore.getState().current?.title).toContain('パートナー');

    await acceptConfirmation();
    const result = await promise;
    expect(result.ok).toBe(true);
    // usePartnerAbility は log に追記する → dispatch が走った証拠
    const after = useGameStateStore.getState().gameState!;
    const lastLog = after.log[after.log.length - 1];
    expect(lastLog?.action).toBe('partnerAbility');
    expect(lastLog?.target).toBe('a1');
  });

  it('with 1 ability: reject → cancelled / state unchanged', async () => {
    registerCardDef(makeCard('P-ONE', { abilities: [makeDeclaredAbil('a1')] }));
    useGameStateStore.setState({ gameState: setupWithPartner('P-ONE') });
    const before = useGameStateStore.getState().gameState;
    const promise = runPartnerAbilityFlow({ player: 'self' });
    await rejectConfirmation();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('with multiple abilities: visible choice picker → choose → confirm → dispatch', async () => {
    registerCardDef(
      makeCard('P-MULTI', {
        abilities: [makeDeclaredAbil('a1'), makeDeclaredAbil('a2'), makeDeclaredAbil('a3')],
      }),
    );
    useGameStateStore.setState({ gameState: setupWithPartner('P-MULTI') });
    const promise = runPartnerAbilityFlow({ player: 'self' });

    // picker が起動
    expect(useTargetPickerStore.getState().phase).toEqual({ phase: 'idle' });
    expect(useChoicePickerStore.getState().current?.options.map((option) => option.label))
      .toEqual(['a1 desc', 'a2 desc', 'a3 desc']);

    await chooseAbility(1);
    expect(useConfirmationStore.getState().current).not.toBeNull();
    await acceptConfirmation();

    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    const lastLog = after.log[after.log.length - 1];
    expect(lastLog?.action).toBe('partnerAbility');
    expect(lastLog?.target).toBe('a2');
  });

  it('with multiple abilities: visible choice cancel → cancelled', async () => {
    registerCardDef(
      makeCard('P-MULTI', {
        abilities: [makeDeclaredAbil('a1'), makeDeclaredAbil('a2')],
      }),
    );
    useGameStateStore.setState({ gameState: setupWithPartner('P-MULTI') });
    const promise = runPartnerAbilityFlow({ player: 'self' });
    await cancelAbilityChoice();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
  });
});
