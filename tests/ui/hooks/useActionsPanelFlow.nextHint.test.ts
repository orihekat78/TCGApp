// 2026-05-28: runNextHintFlow tests (step2 picker 経路)
//
// rules: 12-next-hint.md, 20-color-and-switch.md
// spec: plan「ネクストヒント step2 UI 実装 + 反復可能化」
//
// 仕様 (Option A: atomic):
//   1. canStartNextHint で開始可否判定 (FILE 1+ かつ非アシストパートナー)
//   2. useNextHintPicker.ask で候補 (FILE-top + 使用可能手札) を提示
//   3. acceptUse(cardId) → dispatchEngineAction nextHint(optionalCardId) (step1+step2)
//   4. acceptSkip → dispatchEngineAction nextHint() (step1 のみ)
//   5. acceptCancel → cancelled (dispatch しない)

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { runNextHintFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useNextHintPickerStore, useNextHintPicker } from '@/ui/hooks/useNextHintPicker';
import { useSceneSwitchPickerStore } from '@/ui/hooks/useSceneSwitchPickerStore';
import { registerAll } from '@/cards';
import { createEmptyGameState } from '@/engine/state-factory';
import { def as readDef } from '@/engine/read/def';
import type { GameState, FileCard } from '@/engine/types/game-state';
import { makeChar } from '../../helpers/fixtures';

// D08017 = 青 / character / Lv2 (cutin)。FILE 3 枚 → postPopCount=2、Lv2 ≤ 2 で候補化。
const FILE_CARD = 'D08017';

function setupWithFile(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.case = { cardId: 'D08020', status: '事件編', requiredEvidence: 7, colors: ['青'] };
  const fb: FileCard = { type: 'card-back', cardId: FILE_CARD };
  s.players.self.file = [fb, fb, fb];
  s.players.self.hand = [];
  return s;
}

describe('runNextHintFlow (step2 picker)', () => {
  beforeAll(() => {
    registerAll();
  });
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    useNextHintPickerStore.getState()._reset();
    useSceneSwitchPickerStore.getState()._close();
  });

  it('picker を開き、FILE-top を候補に含む', async () => {
    useGameStateStore.setState({ gameState: setupWithFile() });
    const promise = runNextHintFlow({ player: 'self' });

    const req = useNextHintPickerStore.getState().current;
    expect(req).not.toBeNull();
    expect(req?.fileTopCardId).toBe(FILE_CARD);
    // 候補に FILE-top (source='file') が含まれる (Lv2 ≤ postPopCount 2、青 ⊆ 青)
    expect(req?.candidates.some((c) => c.cardId === FILE_CARD && c.source === 'file')).toBe(true);

    // acceptUse → step1+step2
    useNextHintPicker().acceptUse(FILE_CARD);
    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    // FILE 3 → 2 (step1 で 1 枚 pop)
    expect(after.players.self.file.length).toBe(2);
    // step2 でキャラ登場 (名乗り状態 = 同ターン登場)
    expect(after.players.self.scene.some((c) => c.cardId === FILE_CARD && c.isNamed)).toBe(true);
    expect(after.turnState.self.nextHintUsed).toBe(true);
    // handUseUsed は消費しない (NH は別経路)
    expect(after.turnState.self.handUseUsed).toBe(false);
  });

  it('満杯の現場でキャラを選ぶと switch victim picker を経由して原子的に実行する', async () => {
    const s = setupWithFile();
    s.players.self.scene = Array.from({ length: 5 }, (_, index) => makeChar({
      cardId: `NH-OLD-${index}`,
      uid: `nh-old-${index}`,
      enterOrder: index + 1,
    }));
    useGameStateStore.setState({ gameState: s });
    const promise = runNextHintFlow({ player: 'self' });

    useNextHintPicker().acceptUse(FILE_CARD);
    await Promise.resolve();
    const switchPicker = useSceneSwitchPickerStore.getState().current;
    expect(switchPicker).toMatchObject({ player: 'self', cardId: FILE_CARD });
    expect(switchPicker?.candidates.map(card => card.uid)).toEqual([
      'nh-old-0', 'nh-old-1', 'nh-old-2', 'nh-old-3', 'nh-old-4',
    ]);
    useSceneSwitchPickerStore.getState()._close();
    switchPicker?.resolve('nh-old-2');

    expect(await promise).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.file).toHaveLength(2);
    expect(after.players.self.scene).toHaveLength(5);
    expect(after.players.self.scene.some(card => card.uid === 'nh-old-2')).toBe(false);
    expect(after.players.self.scene.some(card => card.cardId === FILE_CARD && card.isNamed)).toBe(true);
  });

  it('switch victim picker のキャンセルは Next Hint 全体を無変更で取り消す', async () => {
    const s = setupWithFile();
    s.players.self.scene = Array.from({ length: 5 }, (_, index) => makeChar({
      cardId: `NH-CANCEL-${index}`,
      uid: `nh-cancel-${index}`,
      enterOrder: index + 1,
    }));
    useGameStateStore.setState({ gameState: s });
    const before = useGameStateStore.getState().gameState;
    const promise = runNextHintFlow({ player: 'self' });

    useNextHintPicker().acceptUse(FILE_CARD);
    await Promise.resolve();
    const switchPicker = useSceneSwitchPickerStore.getState().current;
    expect(switchPicker).not.toBeNull();
    useSceneSwitchPickerStore.getState()._close();
    switchPicker?.resolve(null);

    expect(await promise).toEqual({ ok: false, reason: 'cancelled' });
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('case card は Next Hint の使用候補に含めない', async () => {
    const s = setupWithFile();
    s.players.self.hand = ['D08020'];
    useGameStateStore.setState({ gameState: s });
    const promise = runNextHintFlow({ player: 'self' });

    expect(useNextHintPickerStore.getState().current?.candidates.some(candidate => (
      candidate.cardId === 'D08020'
    ))).toBe(false);
    useNextHintPicker().acceptCancel();
    expect(await promise).toEqual({ ok: false, reason: 'cancelled' });
  });

  it('事件の手札使用制限に反するキャラは候補に含めない', async () => {
    const s = setupWithFile();
    s.players.self.case = {
      ...s.players.self.case,
      cardId: 'B05120',
      colors: ['青', '緑', '白', '赤', '黄'],
      status: '解決編',
    };
    s.players.self.file = Array.from({ length: 9 }, () => ({
      type: 'card-back' as const,
      cardId: FILE_CARD,
    }));
    s.players.self.hand = ['B06072'];
    useGameStateStore.setState({ gameState: s });
    const promise = runNextHintFlow({ player: 'self' });

    expect(useNextHintPickerStore.getState().current?.candidates.some(candidate => (
      candidate.cardId === 'B06072'
    ))).toBe(false);
    useNextHintPicker().acceptCancel();
    expect(await promise).toEqual({ ok: false, reason: 'cancelled' });
  });

  it('このターン使用/登場禁止の名前を持つキャラは候補に含めない', async () => {
    const s = setupWithFile();
    s.players.self.file = Array.from({ length: 9 }, () => ({
      type: 'card-back' as const,
      cardId: FILE_CARD,
    }));
    s.players.self.hand = ['B06072'];
    s.players.self.case.colors = ['青', '緑', '白', '赤', '黄'];
    s.turnState.self.useEnterBannedCardNames = [...(readDef.card('B06072')?.names ?? [])];
    useGameStateStore.setState({ gameState: s });
    const promise = runNextHintFlow({ player: 'self' });

    expect(useNextHintPickerStore.getState().current?.candidates.some(candidate => (
      candidate.cardId === 'B06072'
    ))).toBe(false);
    useNextHintPicker().acceptCancel();
    expect(await promise).toEqual({ ok: false, reason: 'cancelled' });
  });

  // BUG-087: rules/12「1で手札に加えたカードは2の判定時のFILE枚数に数えない」
  // FILE 3 枚 → step1 で 1 枚抜く → postPopCount = 2。Lv3 は候補外、Lv2 は候補内。
  it('BUG-087: FILE 3 枚なら postPopCount=2、Lv3 カードは候補外 (off-by-one 回帰)', async () => {
    const s = setupWithFile(); // FILE = D08017(青Lv2) ×3、case = 青
    s.players.self.hand = ['D08023', 'D08017']; // D08023=青Lv3 / D08017=青Lv2
    useGameStateStore.setState({ gameState: s });
    const promise = runNextHintFlow({ player: 'self' });

    const req = useNextHintPickerStore.getState().current;
    expect(req).not.toBeNull();
    // step1 で抜いた分を数えない → FILE 3 → postPopCount 2
    expect(req?.postPopCount).toBe(2);
    // Lv3 (D08023) は 3 > 2 で候補外
    expect(req?.candidates.some((c) => c.cardId === 'D08023')).toBe(false);
    // Lv2 (D08017) は 2 ≤ 2 で候補内
    expect(req?.candidates.some((c) => c.cardId === 'D08017')).toBe(true);

    useNextHintPicker().acceptCancel();
    await promise;
  });

  // BUG-094: rules/17 【FILE(X)】「アシストしているパートナーも枚数に数える」。
  // FILE 4 枚 (非partner 3 + assisted-partner 1) → step1 で 1 枚抜く → postPopCount = 3
  // (パートナーも数える)。Lv3 カードが候補内になるべき。旧実装は nonAssistedCount-1=2 で Lv3 を弾いた。
  it('BUG-094: アシスト中パートナーも FILE 枚数に数える → postPopCount = file.length - 1', async () => {
    const s = setupWithFile(); // case = 青
    const fb: FileCard = { type: 'card-back', cardId: FILE_CARD };
    // 非partner 3 + アシスト中パートナー 1 = file.length 4
    s.players.self.file = [fb, fb, fb, { type: 'assisted-partner', cardId: 'D08001' }];
    s.players.self.hand = ['D08023']; // 青 Lv3
    useGameStateStore.setState({ gameState: s });
    const promise = runNextHintFlow({ player: 'self' });

    const req = useNextHintPickerStore.getState().current;
    expect(req).not.toBeNull();
    // FILE 4 (パートナー含む) → step1 で 1 → postPopCount = 3 (rules/17 パートナーも数える)
    expect(req?.postPopCount).toBe(3);
    // Lv3 (D08023) は 3 ≤ 3 で候補内
    expect(req?.candidates.some((c) => c.cardId === 'D08023')).toBe(true);

    useNextHintPicker().acceptCancel();
    await promise;
  });

  it('acceptSkip → step1 のみ (FILE→手札、使用しない)', async () => {
    useGameStateStore.setState({ gameState: setupWithFile() });
    const promise = runNextHintFlow({ player: 'self' });
    expect(useNextHintPickerStore.getState().current).not.toBeNull();

    useNextHintPicker().acceptSkip();
    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.file.length).toBe(2);
    // step2 なし → 手札に FILE-top が加わるのみ、scene 登場なし
    expect(after.players.self.hand).toContain(FILE_CARD);
    expect(after.players.self.scene.length).toBe(0);
    expect(after.turnState.self.nextHintUsed).toBe(true);
  });

  it('acceptCancel → cancelled、state 不変', async () => {
    useGameStateStore.setState({ gameState: setupWithFile() });
    const before = useGameStateStore.getState().gameState;
    const promise = runNextHintFlow({ player: 'self' });

    useNextHintPicker().acceptCancel();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('no-state when gameState is null', async () => {
    const result = await runNextHintFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-state');
  });

  it('not-allowed when FILE is empty', async () => {
    const s = createEmptyGameState();
    s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    useGameStateStore.setState({ gameState: s });
    const result = await runNextHintFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });
});
