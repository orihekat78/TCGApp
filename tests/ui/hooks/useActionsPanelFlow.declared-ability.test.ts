// Phase 8.8b: runDeclaredAbilityFlow tests
//
// rules: 21-declared-ability-cost.md / 24-qa-naming-stun.md (名乗り OK)
// spec: .claude/specs/2026-05-11-ui-action-flows.md ④宣言能力
//
// 仕様:
//   1. 自プレイヤーの scene キャラのうち declared ability を持つ uid を列挙
//   2. 0 件 → not-allowed
//   3. 2026-05-30 user_request: 1 件でも必ず picker (purpose='declared-ability:source')
//      を通し、宣言できるカードを盤面で黄色強調 → クリックさせる
//   4. 選択 source の declared ability ids を列挙
//   5. 1 件 → 即 confirm / 複数 → picker (purpose='declared-ability:ability')
//   6. confirm → dispatch declaredAbility

import { describe, it, expect, beforeEach } from 'vitest';
import { runDeclaredAbilityFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useChoicePickerStore } from '@/ui/hooks/useChoicePicker';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { produce } from '@/engine/produce';
import type { CardDef, GameState } from '@/engine/types';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id], colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    ap: opts.ap ?? 1000, lp: opts.lp ?? 1000,
    traits: opts.traits ?? [], rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '', abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function makeDecl(id: string) {
  return { id, name: id, type: 'declared' as const, description: '' };
}

function setupBase(): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    d.players.self.partner = { cardId: 'PS', state: 'active', location: 'partner-area' };
  });
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

// BUG-172 (2026-07-04): 複数宣言能力の ability 択は picker.start (クリック面なし = hang) から
// ChoicePickerModal (useChoicePicker) に差し替え。ability 択の駆動 helper も choice store 経由へ。
async function chooseAbilityOption(index: number): Promise<void> {
  const st = useChoicePickerStore.getState();
  const r = st._resolver!;
  st._setCurrent(null);
  st._setResolver(null);
  r({ kind: 'choose', index });
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function cancelAbilityChoice(): Promise<void> {
  const st = useChoicePickerStore.getState();
  const r = st._resolver!;
  st._setCurrent(null);
  st._setResolver(null);
  r({ kind: 'cancel' });
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

beforeEach(() => {
  useGameStateStore.setState({ gameState: null });
  useTargetPickerStore.getState()._reset();
  useConfirmationStore.getState()._reset();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('PS', { kind: 'partner' }));
});

describe('runDeclaredAbilityFlow', () => {
  it('not-allowed when no scene char has declared abilities', async () => {
    registerCardDef(makeCard('NoAbil', { abilities: [] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'NoAbil', { active: true });
    });
    useGameStateStore.setState({ gameState: s });
    const result = await runDeclaredAbilityFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('1 source + 1 ability: source picker (always) → confirm → dispatch', async () => {
    registerCardDef(makeCard('Solo', { abilities: [makeDecl('a1')] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'Solo', { active: true });
    });
    useGameStateStore.setState({ gameState: s });
    const soloUid = s.players.self.scene.find((c) => c.cardId === 'Solo')!.uid;
    const promise = runDeclaredAbilityFlow({ player: 'self' });

    // 2026-05-30 user_request: 1 source でも source picker を必ず通す (黄色強調 → クリック)
    const phase = useTargetPickerStore.getState().phase;
    expect(phase.phase).toBe('picking');
    if (phase.phase === 'picking') {
      expect(phase.purpose).toBe('declared-ability:source');
      expect(phase.candidates).toEqual([soloUid]);
    }
    await pickAndConfirmPicker(soloUid);

    // 1 ability → 即 confirm
    expect(useConfirmationStore.getState().current?.title).toContain('宣言能力');
    await acceptConfirmation();
    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    const lastLog = after.log[after.log.length - 1];
    expect(lastLog?.action).toBe('declaredAbility');
    expect(lastLog?.target).toContain(':a1');
  });

  it('multiple sources + ability picker: pick source → pick ability → confirm → dispatch', async () => {
    registerCardDef(makeCard('A', { abilities: [makeDecl('a1')] }));
    registerCardDef(makeCard('B', { abilities: [makeDecl('b1'), makeDecl('b2')] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'A', { active: true });
      mutate.scene.enter(d, 'self', 'B', { active: true });
    });
    useGameStateStore.setState({ gameState: s });
    const aUid = s.players.self.scene.find((c) => c.cardId === 'A')!.uid;
    const bUid = s.players.self.scene.find((c) => c.cardId === 'B')!.uid;

    const promise = runDeclaredAbilityFlow({ player: 'self' });

    // source picker
    let phase = useTargetPickerStore.getState().phase;
    expect(phase.phase).toBe('picking');
    if (phase.phase === 'picking') {
      expect(phase.purpose).toBe('declared-ability:source');
      expect(phase.candidates).toEqual([aUid, bUid]);
    }
    await pickAndConfirmPicker(bUid);

    // ability picker (B has 2 abilities) — BUG-172: ChoicePickerModal (能力説明の択一) に差替
    const choice = useChoicePickerStore.getState().current;
    expect(choice).not.toBeNull();
    expect(choice!.options.map((o) => o.index)).toEqual([0, 1]);
    await chooseAbilityOption(1); // = b2

    // confirm
    expect(useConfirmationStore.getState().current).not.toBeNull();
    await acceptConfirmation();

    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    const lastLog = after.log[after.log.length - 1];
    expect(lastLog?.action).toBe('declaredAbility');
    expect(lastLog?.target).toContain(':b2');
  });

  it('cancel source picker → cancelled', async () => {
    registerCardDef(makeCard('A', { abilities: [makeDecl('a1')] }));
    registerCardDef(makeCard('B', { abilities: [makeDecl('b1')] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'A', { active: true });
      mutate.scene.enter(d, 'self', 'B', { active: true });
    });
    useGameStateStore.setState({ gameState: s });
    const promise = runDeclaredAbilityFlow({ player: 'self' });
    await cancelPicker();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
  });

  it('cancel ability picker → cancelled', async () => {
    registerCardDef(makeCard('M', { abilities: [makeDecl('m1'), makeDecl('m2')] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'M', { active: true });
    });
    useGameStateStore.setState({ gameState: s });
    const mUid = s.players.self.scene.find((c) => c.cardId === 'M')!.uid;
    const promise = runDeclaredAbilityFlow({ player: 'self' });
    // 2026-05-30: source picker (1 source) を通してから ability 択 (2 abilities) を cancel
    // BUG-172: ability 択は ChoicePickerModal 経由
    await pickAndConfirmPicker(mUid);
    expect(useChoicePickerStore.getState().current).not.toBeNull();
    await cancelAbilityChoice();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
  });

  it('reject confirmation → cancelled', async () => {
    registerCardDef(makeCard('Solo', { abilities: [makeDecl('a1')] }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'Solo', { active: true });
    });
    useGameStateStore.setState({ gameState: s });
    const soloUid = s.players.self.scene.find((c) => c.cardId === 'Solo')!.uid;
    const promise = runDeclaredAbilityFlow({ player: 'self' });
    await pickAndConfirmPicker(soloUid); // source picker (1 source) を通す
    await rejectConfirmation();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
  });

  // 2026-05-30 user_request: 事件カード (case:self) を宣言能力 source とする UI 統合テスト。
  // confirm body に 事件名 (not "case:self") と能力の説明文 (not "(a1)") が出ることを検証。
  it('case:self source: 事件が候補 → 事件名と説明文で confirm → dispatch', async () => {
    const caseDef = {
      id: 'CaseDecl', no: 'CaseDecl', kind: 'case',
      names: ['テスト事件'], colors: ['赤'], level: 0, traits: [],
      abilities: [{
        id: 'a1', type: 'declared', scope: 'always',
        effect: { kind: 'atom', verb: 'noop', args: {} },
        description: 'テスト宣言能力の説明', ruleRefs: [],
      }],
    } as unknown as CardDef;
    registerCardDef(caseDef);
    const s = produce(setupBase(), (d) => {
      d.players.self.case = {
        cardId: 'CaseDecl', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {},
      };
    });
    useGameStateStore.setState({ gameState: s });

    const promise = runDeclaredAbilityFlow({ player: 'self' });

    // source picker に case:self が候補として出る (盤面では事件カードが黄色強調される)
    const phase = useTargetPickerStore.getState().phase;
    expect(phase.phase).toBe('picking');
    if (phase.phase === 'picking') {
      expect(phase.purpose).toBe('declared-ability:source');
      expect(phase.candidates).toContain('case:self');
    }
    await pickAndConfirmPicker('case:self');

    // confirm body: 事件名 + 能力説明文 (case:self / (a1) ではない)
    const body = useConfirmationStore.getState().current?.body ?? '';
    expect(body).toContain('テスト事件');
    expect(body).not.toContain('case:self');
    expect(body).toContain('テスト宣言能力の説明');
    expect(body).not.toContain('(a1)');
    await acceptConfirmation();

    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    const lastLog = after.log[after.log.length - 1];
    expect(lastLog?.action).toBe('declaredAbility');
    expect(lastLog?.target).toContain('case:self');
  });
});
