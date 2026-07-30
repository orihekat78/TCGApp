// BUG-085: runDeclaredAbilityFlow の flipFaceUpEvidence コスト統合テスト
//
// ユーザー報告: 事件カードの宣言能力を選び確認モーダル OK 後「何も起きない」。
// 原因: cost.pay が ctx.dyn.costParams.flipFaceUpEvidence.indices を要求するのに
//       UI が証拠を選ばせず空 indices で dispatch → throw → rollback。
// 修正: 確認 accept 後に証拠選択 picker (useEvidenceFlipPicker) を await し、選択 index
//       を ctx.dyn.costParams に積んで dispatch。さらに Layer2 (costPaid 引き継ぎ +
//       {dyn} 評価) で AP±1000×枚数 が解決される。
//
// rules: 21-declared-ability-cost.md / 01-victory-conditions.md
// spec: useActionsPanelFlow.declared-ability.test.ts と同型

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runDeclaredAbilityFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { useEvidenceFlipPicker, useEvidenceFlipPickerStore } from '@/ui/hooks/useEvidenceFlipPicker';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { caseDeclaredEvidenceFlip } from '@/cards/_shared/caseDeclaredEvidenceFlip';
import { produce } from '@/engine/produce';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';

const CASE_DEF: CardDef = {
  id: 'TCASE', no: 'TCASE', kind: 'case', names: ['青の古城探索事件'], colors: ['青'], traits: [],
  rarity: 'D', imageUrl: '', caseLevel: 7, caseTraits: [],
  abilities: [caseDeclaredEvidenceFlip({ delta: 1000, targetFilter: { trait: '少年探偵団' }, side: 'self', abilityId: 'a2' })],
  ruleRefs: [],
} as CardDef;

const CHAR_DEF: CardDef = {
  id: 'TCHAR', no: 'TCHAR', kind: 'character', names: ['少年探偵A'], colors: ['青'],
  level: 1, ap: 3000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [], ruleRefs: [],
} as CardDef;

function setupState(faceDownCount: number): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    d.players.self.case = { cardId: 'TCASE', status: '解決編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
    mutate.scene.enter(d, 'self', 'TCHAR', { active: true });
    for (let i = 0; i < faceDownCount; i++) {
      d.players.self.evidence.push({ cardId: `E${i}`, faceUp: false, origin: { turn: 1, via: 'reasoning' } });
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

async function acceptConfirmation(): Promise<void> {
  const r = useConfirmationStore.getState()._resolver!;
  useConfirmationStore.getState()._setCurrent(null);
  useConfirmationStore.getState()._setResolver(null);
  r(true);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function flush(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0));
}

beforeEach(() => {
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
  useTargetPickerStore.getState()._reset();
  useConfirmationStore.getState()._reset();
  useEvidenceFlipPickerStore.getState()._reset();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(CASE_DEF);
  registerCardDef(CHAR_DEF);
  // human 経路 (effect の charModifyAP が pendingEffectPick に deferred) を再現
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('runDeclaredAbilityFlow — flipFaceUpEvidence コスト (BUG-085)', () => {
  it('確認 OK 後に証拠 picker が開き、選択 → 証拠表向き + AP+2000 が適用される', async () => {
    useGameStateStore.setState({ gameState: setupState(2) });

    const promise = runDeclaredAbilityFlow({ player: 'self' });

    // 1) source picker (case:self が候補)
    const phase = useTargetPickerStore.getState().phase;
    expect(phase.phase).toBe('picking');
    if (phase.phase === 'picking') expect(phase.candidates).toContain('case:self');
    await pickAndConfirmPicker('case:self');

    // 2) 1 ability → 即 confirm
    expect(useConfirmationStore.getState().current).not.toBeNull();
    await acceptConfirmation();

    // 3) 証拠 flip picker が開く (裏向き 2 枚が候補)
    const cur = useEvidenceFlipPickerStore.getState().current;
    expect(cur, '確認 OK 後に証拠 picker が開く').not.toBeNull();
    expect(cur?.candidates.map((c) => c.index)).toEqual([0, 1]);
    expect(cur?.nMin).toBe(1);
    expect(cur?.nMax).toBe(Infinity);

    // 4) 証拠 2 枚を選んで確定
    useEvidenceFlipPicker().confirm([0, 1]);
    await flush();

    const result = await promise;
    expect(result.ok).toBe(true);

    const after = useGameStateStore.getState().gameState!;
    // 証拠 2 枚が表向きに
    expect(after.players.self.evidence[0].faceUp).toBe(true);
    expect(after.players.self.evidence[1].faceUp).toBe(true);

    // 効果 (charModifyAP) は human pick として deferred、delta は 2×1000=2000 に確定済
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending?.atomVerb).toBe('charModifyAP');
    expect((pending?.atomArgs as { delta?: unknown }).delta).toBe(2000);

    // 5) scene キャラ pick を resolve → AP+2000 適用
    const charUid = after.players.self.scene.find((c) => c.cardId === 'TCHAR')!.uid;
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: charUid });
    const after2 = useGameStateStore.getState().gameState!;
    expect(readChar.ap(after2, charUid)).toBe(5000); // 3000 + 2*1000
  });

  it('証拠 picker を cancel すると cancelled (state 不変・証拠も裏向きのまま)', async () => {
    useGameStateStore.setState({ gameState: setupState(2) });
    const promise = runDeclaredAbilityFlow({ player: 'self' });
    await pickAndConfirmPicker('case:self');
    await acceptConfirmation();
    expect(useEvidenceFlipPickerStore.getState().current).not.toBeNull();

    useEvidenceFlipPicker().cancel();
    await flush();

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence[0].faceUp).toBe(false);
    expect(after.players.self.evidence[1].faceUp).toBe(false);
  });

  it('証拠 1 枚だけ選んだ場合は AP+1000 (count に比例)', async () => {
    useGameStateStore.setState({ gameState: setupState(2) });
    const promise = runDeclaredAbilityFlow({ player: 'self' });
    await pickAndConfirmPicker('case:self');
    await acceptConfirmation();
    useEvidenceFlipPicker().confirm([1]);
    await flush();
    const result = await promise;
    expect(result.ok).toBe(true);

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence[0].faceUp).toBe(false);
    expect(after.players.self.evidence[1].faceUp).toBe(true);
    const charUid = after.players.self.scene.find((c) => c.cardId === 'TCHAR')!.uid;
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: charUid });
    expect(readChar.ap(useGameStateStore.getState().gameState!, charUid)).toBe(4000);
  });
});
