// BUG-108: D11012 a1「LP＋1するか / AP＋2000する」の choice 択一 UI フロー統合テスト。
// runDeclaredAbilityFlow → ChoicePicker (option 選択) → ctx.dyn.choiceIndex → resolveEffectPicks
// unwrap → 選択 option (charModifyLP / charModifyAP) が target pick へ。real dispatch 経路で検証。
//
// rules: 15-abilities-effects.md, 21-declared-ability-cost.md

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { runDeclaredAbilityFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { useChoicePicker, useChoicePickerStore } from '@/ui/hooks/useChoicePicker';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { registerAll } from '@/cards';
import { register } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { CardDef, GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';

const LABELED_CHOICE: CardDef = {
  id: 'BUG108_LABELED_CHOICE', no: 'TEST/BUG108_LABELED_CHOICE', kind: 'character',
  names: ['選択ラベル確認'], colors: ['白'], level: 1, ap: 1000, lp: 1,
  traits: [], keywords: [], rarity: 'T', imageUrl: '', ruleRefs: [],
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'choice', chooser: 'self', labels: ['黒羽盗一', '黒羽快斗', '怪盗キッド'],
      options: [
        { kind: 'atom', verb: 'noop', args: {} },
        { kind: 'atom', verb: 'noop', args: {} },
        { kind: 'atom', verb: 'noop', args: {} },
      ],
    },
    description: '3つの名前から1つを指定する。', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
};


// D11012 (横溝重悟, 警察 Lv4 LP0) を source ('shigo') + 効果対象 ('target') の 2 体置く。
// cost selfToDeckBottom が source をデッキ下へ → 効果は残った 'target' (警察 LP0) を対象にする。
function setupD11012a1(): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    d.players.self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
    d.players.self.scene = [sceneChar('D11012', 'shigo'), sceneChar('D11012', 'target')];
  });
}

async function pickPicker(uid: string): Promise<void> {
  const r = useTargetPickerStore.getState()._resolver!;
  useTargetPickerStore.getState()._setPhase({ phase: 'idle' });
  useTargetPickerStore.getState()._setResolver(null);
  r(uid);
  await new Promise<void>((res) => setTimeout(res, 0));
}

async function acceptConfirmation(): Promise<void> {
  const r = useConfirmationStore.getState()._resolver!;
  useConfirmationStore.getState()._setCurrent(null);
  useConfirmationStore.getState()._setResolver(null);
  r(true);
  await new Promise<void>((res) => setTimeout(res, 0));
}

async function flush(): Promise<void> {
  await new Promise<void>((res) => setTimeout(res, 0));
}

beforeAll(() => {
  registerAll();
  register(LABELED_CHOICE);
});

beforeEach(() => {
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
  useTargetPickerStore.getState()._reset();
  useConfirmationStore.getState()._reset();
  useChoicePickerStore.getState()._reset();
  _clearPendingEffectPickQueue();
  delete (globalThis as { __pendingChainContinuation?: unknown[] }).__pendingChainContinuation;
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('D11012 a1 — choice 択一 UI (BUG-108)', () => {
  it('確認 OK 後に ChoicePicker が LP＋1 / AP＋2000 の 2 option で開く', async () => {
    useGameStateStore.setState({ gameState: setupD11012a1() });
    const promise = runDeclaredAbilityFlow({ player: 'self' });

    await pickPicker('shigo'); // source 選択
    await acceptConfirmation(); // a1 は declared 1 件 → 即 confirm

    const cur = useChoicePickerStore.getState().current;
    expect(cur, '確認 OK 後に ChoicePicker が開く').not.toBeNull();
    expect(cur?.options.map((o) => o.label)).toEqual(['LP＋1', 'AP＋2000']);

    // option1 (AP＋2000) を選択
    useChoicePicker().choose(1);
    await flush();
    const result = await promise;
    expect(result.ok).toBe(true);

    // choiceIndex=1 → AP option が選ばれ、charModifyAP の target pick が surface
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb, 'AP option 選択').toBe('charModifyAP');

    // target ('target' = 警察 LP0) を resolve → AP+2000
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'target' });
    const gs = useGameStateStore.getState().gameState!;
    expect(readChar.ap(gs, 'target'), 'AP 4000 + 2000').toBe(6000);
  });

  it('option0 (LP＋1) を選ぶと charModifyLP が解決され LP+1 が適用される', async () => {
    useGameStateStore.setState({ gameState: setupD11012a1() });
    const promise = runDeclaredAbilityFlow({ player: 'self' });

    await pickPicker('shigo');
    await acceptConfirmation();

    useChoicePicker().choose(0);
    await flush();
    expect((await promise).ok).toBe(true);

    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb, 'LP option 選択').toBe('charModifyLP');
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'target' });
    const gs = useGameStateStore.getState().gameState!;
    expect(readChar.lp(gs, 'target'), 'LP 0 + 1').toBe(1);
  });

  it('ChoicePicker を cancel すると cancelled (能力不発)', async () => {
    useGameStateStore.setState({ gameState: setupD11012a1() });
    const promise = runDeclaredAbilityFlow({ player: 'self' });

    await pickPicker('shigo');
    await acceptConfirmation();
    expect(useChoicePickerStore.getState().current).not.toBeNull();

    useChoicePicker().cancel();
    await flush();
    const result = await promise;
    expect(result.ok).toBe(false);
  });
});

describe('choice labels', () => {
  it('uses explicit semantic labels for a declared top-level choice', async () => {
    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(LABELED_CHOICE.id, 'labeled-source')];
    useGameStateStore.setState({ gameState: state });
    const promise = runDeclaredAbilityFlow({ player: 'self' });

    await pickPicker('labeled-source');
    await acceptConfirmation();
    expect(useChoicePickerStore.getState().current?.options.map(option => option.label))
      .toEqual(['黒羽盗一', '黒羽快斗', '怪盗キッド']);

    useChoicePicker().cancel();
    await flush();
    expect((await promise).ok).toBe(false);
  });
});
