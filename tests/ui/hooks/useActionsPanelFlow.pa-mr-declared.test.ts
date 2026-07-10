// M3 PA batch (2026-07-10): パートナーエリア常駐 MR の宣言能力 human 経路
// rules: 18-mr.md §パートナーエリアにいるMRキャラ / 21-declared-ability-cost.md
//
// engine 側 (declared-ability.ts:62 partnerMR uid / :147 scope gate) は mr-partner-area-core
// で出荷済。本テストは UI 層の source 列挙 + flow 一気通貫 (picker → 択一 → confirm → dispatch)。

import { describe, it, expect, beforeEach } from 'vitest';
import {
  enumDeclaredAbilitySources,
  runDeclaredAbilityFlow,
} from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useChoicePickerStore } from '@/ui/hooks/useChoicePicker';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { produce } from '@/engine/produce';
import type { CardDef, GameState, AbilityDef } from '@/engine/types';
import { makeChar } from '../../helpers/fixtures';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id], colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    ap: opts.ap ?? 1000, lp: opts.lp ?? 1000,
    traits: opts.traits ?? [], rarity: opts.rarity ?? 'MR',
    imageUrl: opts.imageUrl ?? '', abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function makeDecl(id: string, scope: AbilityDef['scope'], description = ''): AbilityDef {
  return { id, name: id, type: 'declared', scope, description } as AbilityDef;
}

function setupBase(withPaMr: { cardId: string } | null): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    d.players.self.partner = { cardId: 'PS', state: 'active', location: 'partner-area' };
    if (withPaMr) {
      d.players.self.partnerAreaMR = makeChar({ cardId: withPaMr.cardId, uid: 'partnerMR:self' });
    }
  });
}

async function pickAndConfirmPicker(uid: string): Promise<void> {
  const r = useTargetPickerStore.getState()._resolver!;
  useTargetPickerStore.getState()._setPhase({ phase: 'idle' });
  useTargetPickerStore.getState()._setResolver(null);
  r(uid);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function chooseAbilityOption(index: number): Promise<void> {
  const st = useChoicePickerStore.getState();
  const r = st._resolver!;
  st._setCurrent(null);
  st._setResolver(null);
  r({ kind: 'choose', index });
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function acceptConfirmation(): Promise<void> {
  const r = useConfirmationStore.getState()._resolver!;
  useConfirmationStore.getState()._setCurrent(null);
  useConfirmationStore.getState()._setResolver(null);
  r(true);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

beforeEach(() => {
  useGameStateStore.setState({ gameState: null });
  useTargetPickerStore.getState()._reset();
  useConfirmationStore.getState()._reset();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('PS', { kind: 'partner', rarity: 'C' }));
});

describe('enumDeclaredAbilitySources — partnerAreaMR (rules/18)', () => {
  it('PA-MR の scope on-partner-area 宣言能力 → partnerMR:self を列挙', () => {
    registerCardDef(makeCard('MR1', { abilities: [makeDecl('a1', 'on-partner-area')] }));
    const s = setupBase({ cardId: 'MR1' });
    expect(enumDeclaredAbilitySources(s, 'self')).toContain('partnerMR:self');
  });

  it('scope on-scene のみ持つ PA-MR は列挙されない (decoy: engine scope gate)', () => {
    registerCardDef(makeCard('MR2', { abilities: [makeDecl('a1', 'on-scene')] }));
    const s = setupBase({ cardId: 'MR2' });
    expect(enumDeclaredAbilitySources(s, 'self')).not.toContain('partnerMR:self');
  });

  it('partnerAreaMR 空 → partnerMR:self を列挙しない', () => {
    const s = setupBase(null);
    expect(enumDeclaredAbilitySources(s, 'self')).not.toContain('partnerMR:self');
  });
});

describe('runDeclaredAbilityFlow — PA-MR source 一気通貫', () => {
  it('partnerMR:self pick → confirm (MR 名表示) → dispatch declaredAbility', async () => {
    registerCardDef(makeCard('MR1', {
      names: ['バーボン＆ライ'],
      abilities: [makeDecl('a1', 'on-partner-area', 'テスト宣言能力')],
    }));
    const s = setupBase({ cardId: 'MR1' });
    useGameStateStore.setState({ gameState: s });

    const promise = runDeclaredAbilityFlow({ player: 'self' });
    const phase = useTargetPickerStore.getState().phase;
    expect(phase.phase).toBe('picking');
    if (phase.phase === 'picking') {
      expect(phase.candidates).toContain('partnerMR:self');
    }
    await pickAndConfirmPicker('partnerMR:self');

    const confirm = useConfirmationStore.getState().current;
    expect(confirm).not.toBeNull();
    // uidToDisplayName が partnerMR: を解決し raw uid が出ない (BUG-172 同型防止)
    expect(confirm!.body).toContain('バーボン＆ライ');
    expect(confirm!.body).not.toContain('partnerMR:self');
    await acceptConfirmation();

    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    const lastLog = after.log[after.log.length - 1];
    expect(lastLog?.action).toBe('declaredAbility');
    expect(lastLog?.target).toContain(':a1');
  });

  it('宣言能力 2 つ持ち PA-MR → 択一 modal に description 表示 (resolveDeclaredSourceCardId)', async () => {
    registerCardDef(makeCard('MR3', {
      abilities: [
        makeDecl('a1', 'on-partner-area', '能力その1'),
        makeDecl('a2', 'on-partner-area', '能力その2'),
      ],
    }));
    const s = setupBase({ cardId: 'MR3' });
    useGameStateStore.setState({ gameState: s });

    const promise = runDeclaredAbilityFlow({ player: 'self' });
    await pickAndConfirmPicker('partnerMR:self');

    const choice = useChoicePickerStore.getState().current;
    expect(choice).not.toBeNull();
    // cardId 解決失敗時は「能力 (a1)」fallback になる — description が出ることを確認
    expect(choice!.options.map((o) => o.label)).toEqual(['能力その1', '能力その2']);
    await chooseAbilityOption(1);

    expect(useConfirmationStore.getState().current).not.toBeNull();
    await acceptConfirmation();
    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.log[after.log.length - 1]?.target).toContain(':a2');
  });
});
