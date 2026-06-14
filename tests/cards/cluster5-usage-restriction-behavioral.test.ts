// cluster5 — usage-restriction aura 3枚を実 engine 経路で駆動する挙動テスト
// (engine拡張 wave#2 cluster5, 2026-06-14)。smoke:1000 は CT-D08/CT-D11 のみで本 3 枚を踏めない
// (BUG-132 教訓: smoke green は no-op 回帰のみ保証 / 新挙動は専用テストで実証) ため必須。
//
// 検証 (decoy を盤面に置いた決定論ケースで 1対1):
//   M1 相手カットイン不可 aura (canCutIn が相手盤面を走査):
//     B02063 無条件 / B04034 絆鈴木園子+自分ターン中 / B09017 相手ターン中+board(レベル4 少年探偵団≠吉田歩美)。
//     いずれも canDisguise は不変 (公式 qAndA「カットインと変装は別」)。
//     B09017 は [吉田歩美] を NAME 除外 (2枚目の吉田歩美では board 不成立 = excludeSelf(uid) ではない)。
//   M2 変装時 不発動 suppression (disguise:into emit 抑止、B04034):
//     相手が変装すると相手の【変装時】は発動しない / 変装 swap 自体は成立 /
//     aura 所有者自身の変装では自分の【変装時】は発動する (direction fix の証跡)。
// rules: 09/17/19/24 + 各カード TSV qAndA

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { canCutIn, canDisguise, disguise } from '@/engine/flow/contact';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef, GameState, ActionContext } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

function plain(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

/** self 側 attacker (uid='atk') が opp char (uid='dft') に action → contact 中の ax */
function makeAx(): ActionContext {
  return {
    id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: 'atk', aAP: 4000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
  };
}

function turnSelf(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

describe('cluster5 — usage-restriction aura (M1 cutin / M2 disguise-trigger)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    _clearPendingEffectPickQueue();
    registerAll();
    // 絆判定用 鈴木園子 decoy / board 判定用 レベル4 少年探偵団 decoy
    registerCardDef(plain('SONOKO', { names: ['鈴木園子'] }));
    registerCardDef(plain('SBD4', { level: 4, traits: ['少年探偵団'], names: ['少年探偵団員'] }));
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ---- M1: B02063 無条件 相手カットイン不可 ----
  it('B02063: 自分盤面の aura で opp の【カットイン】が不可 / 変装は可 / aura 除去で復帰', () => {
    let s = createEmptyGameState();
    turnSelf(s);
    s.players.self.scene = [sceneChar('Atk0', 'atk')];
    s.players.opp.scene = [sceneChar('Def0', 'dft')];
    s.players.opp.hand = ['B03129'];      // B03129 = カットイン 兼 変装 持ち
    s.players.opp.file = [FB, FB, FB, FB, FB, FB]; // 変装ゲート【FILE6】
    const ax = makeAx();

    // aura 無し → opp は cut-in 可
    expect(canCutIn(s, ax, 'opp', 'B03129'), 'aura 無し → cut-in 可').toBe(true);

    // 自分盤面に B02063 → opp cut-in 不可 (相手盤面 aura を canCutIn が走査)
    s = produce(s, (d) => { d.players.self.scene.push(sceneChar('B02063', 'aura')); });
    expect(canCutIn(s, ax, 'opp', 'B03129'), 'B02063 aura → cut-in 不可').toBe(false);
    // 変装は別 (公式 qAndA) → canDisguise は不変で可
    expect(canDisguise(s, ax, 'opp', 'B03129'), 'cutin aura は変装に影響しない').toBe(true);

    // aura 除去 → 復帰
    s = produce(s, (d) => { d.players.self.scene = d.players.self.scene.filter((c) => c.uid !== 'aura'); });
    expect(canCutIn(s, ax, 'opp', 'B03129'), 'aura 除去 → cut-in 可に復帰').toBe(true);
  });

  // ---- M1: B04034 絆鈴木園子 + 自分ターン中 ----
  it('B04034: 絆鈴木園子 ∧ 自分ターン中 のときだけ cutin aura が有効', () => {
    const build = (withSonoko: boolean, player: 'self' | 'opp'): GameState => {
      const s = createEmptyGameState();
      s.turn = { number: 5, player, phase: 'main', isFirstPlayerFirstTurn: false };
      s.players.self.scene = [sceneChar('Atk0', 'atk'), sceneChar('B04034', 'aura')];
      if (withSonoko) s.players.self.scene.push(sceneChar('SONOKO', 'sonoko'));
      s.players.opp.scene = [sceneChar('Def0', 'dft')];
      s.players.opp.hand = ['B03129'];
      return s;
    };
    const ax = makeAx();
    // 絆充足 + 自分ターン → 不可
    expect(canCutIn(build(true, 'self'), ax, 'opp', 'B03129'), '絆+自分ターン → 不可').toBe(false);
    // 相手ターン → aura 無効 → 可
    expect(canCutIn(build(true, 'opp'), ax, 'opp', 'B03129'), '相手ターンでは aura 無効').toBe(true);
    // 鈴木園子 不在 → 絆不成立 → 可
    expect(canCutIn(build(false, 'self'), ax, 'opp', 'B03129'), '鈴木園子不在で絆不成立').toBe(true);
  });

  // ---- M1: B09017 相手ターン中 + board(レベル4 少年探偵団 ≠ 吉田歩美) ----
  it('B09017: 相手ターン中 ∧ レベル4少年探偵団(≠吉田歩美) で cutin 不可 / 2枚目の吉田歩美は NAME 除外', () => {
    const build = (decoyCardId: string | null, player: 'self' | 'opp'): GameState => {
      const s = createEmptyGameState();
      s.turn = { number: 5, player, phase: 'main', isFirstPlayerFirstTurn: false };
      s.players.self.scene = [sceneChar('Atk0', 'atk'), sceneChar('B09017', 'aura')];
      if (decoyCardId) s.players.self.scene.push(sceneChar(decoyCardId, 'decoy'));
      s.players.opp.scene = [sceneChar('Def0', 'dft')];
      s.players.opp.hand = ['B03129'];
      return s;
    };
    const ax = makeAx();
    // 相手ターン + レベル4 少年探偵団(SBD4) 在場 → 不可
    expect(canCutIn(build('SBD4', 'opp'), ax, 'opp', 'B03129'), 'board 充足+相手ターン → 不可').toBe(false);
    // 自分ターン → 【相手ターン中】不成立 → 可
    expect(canCutIn(build('SBD4', 'self'), ax, 'opp', 'B03129'), '自分ターンでは aura 無効').toBe(true);
    // decoy 無し → board 不成立 (aura 自身=吉田歩美 は名前除外) → 可
    expect(canCutIn(build(null, 'opp'), ax, 'opp', 'B03129'), 'レベル4少年探偵団 不在 → 不成立').toBe(true);
    // decoy が 2枚目の吉田歩美(B09017) → NAME 除外で board 不成立 → 可 (excludeSelf(uid) なら誤って不可になる)
    expect(canCutIn(build('B09017', 'opp'), ax, 'opp', 'B03129'), '2枚目の吉田歩美は名前除外').toBe(true);
  });

  // ---- M2: B04034 相手の【変装時】を抑止 (変装 swap は成立) ----
  it('B04034: 自分盤面 aura 有効中、相手(opp)の変装で【変装時】draw が発動しない / swap は成立', () => {
    let s = createEmptyGameState();
    turnSelf(s); // B04034 owner=self の【自分ターン中】成立
    s.players.self.scene = [sceneChar('Atk0', 'atk'), sceneChar('B04034', 'aura'), sceneChar('SONOKO', 'sonoko')];
    s.players.opp.scene = [sceneChar('Def0', 'dft')];
    s.players.opp.hand = ['B03129'];
    s.players.opp.file = [FB, FB, FB, FB, FB, FB]; // opp の変装ゲート【FILE6】
    s.players.opp.deck = ['DRAWN'];                // 【変装時】draw が引くはずの 1 枚
    const ax = makeAx();

    expect(canDisguise(s, ax, 'opp', 'B03129'), 'FILE6 → 変装可 (aura は変装を止めない)').toBe(true);
    s = produce(s, (d) => {
      disguise(d, ax, 'opp', 'B03129');
      runAllUntilEmpty(d);
    });
    // 変装 swap は成立 (uid 維持 cardId 差替え)
    expect(s.players.opp.scene.find((c) => c.uid === 'dft')?.cardId, '変装 swap 成立').toBe('B03129');
    // 【変装時】draw は抑止 → DRAWN は deck に残り手札に来ない
    expect(s.players.opp.deck, '変装時 draw 抑止 → DRAWN は deck に残る').toContain('DRAWN');
    expect(s.players.opp.hand, '変装時 draw 抑止 → DRAWN は手札に来ない').not.toContain('DRAWN');
  });

  // ---- M2 direction fix: aura 所有者自身の変装では自分の【変装時】は発動する ----
  it('B04034: aura 所有者(self)自身の変装では自分の【変装時】draw は発動する (direction fix 証跡)', () => {
    let s = createEmptyGameState();
    turnSelf(s);
    s.players.self.scene = [sceneChar('Atk0', 'atk'), sceneChar('B04034', 'aura'), sceneChar('SONOKO', 'sonoko')];
    s.players.opp.scene = [sceneChar('Def0', 'dft')];
    s.players.self.hand = ['B03129'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB];
    s.players.self.deck = ['DRAWN'];
    const ax = makeAx();

    expect(canDisguise(s, ax, 'self', 'B03129'), 'self FILE6 → 変装可').toBe(true);
    s = produce(s, (d) => {
      disguise(d, ax, 'self', 'B03129');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'atk')?.cardId, '変装 swap 成立').toBe('B03129');
    // aura は「相手のキャラの変装時」のみ抑止 → self 自身の変装時 draw は発動
    expect(s.players.self.hand, 'aura 所有者自身の変装時 draw は発動').toContain('DRAWN');
  });
});
