// tests/cards/s1-defer/B05101 — 毛利小五郎 self-revival + permanent trait-flip
// qa: card:B05101:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
//   【相手ターン中】【現場リムーブ時】特徴[警察]の場合、自身をリムーブから スリープ登場 + draw1 してもよい。
//   そうした場合、[警察]/[警視庁] を失い [探偵] を持つ (ターン終了時に切れない)。
// 検証: ①相手ターン中に効果リムーブ → optional 承諾 → remove から消え scene に sleep 登場・draw1・trait flip
//       ②flip は permanent (clearTurnEffects('turn') 後も維持) ③flip 済で再リムーブ → matcherCondition false で不発
//       ④自分ターン中のリムーブ → condition gate で不発 ⑤decline → 何も起きない ⑥owner=opp 相対解決
// rules: 15/17/19 (特徴変更) / 23 (変装引継ぎ = 既存機構 comment のみ)
import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import {
  _clearPendingEffectPickQueue,
  _drainPendingEffectOptionalSide,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import { applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { validateCards } from '@/engine/effect/validate';
import { char as charRead } from '@/engine/read/char';
import { B05101 } from '@/cards/ct-p05/B05101';
import type { GameState, Player } from '@/engine/types';

const setHuman = (v: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = v; };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B05101);
  registerTriggeredListener();
  setHuman('self');
});

function base(turnPlayer: Player): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

describe('validate / shape', () => {
  it('B05101 が validateCards を通る', () => {
    expect(validateCards([B05101]).ok).toBe(true);
  });
  it('effect が top-level optional (chain[sceneEnter,draw,revoke,revoke,grant])', () => {
    expect((B05101.abilities[0].effect as { kind?: string }).kind).toBe('optional');
  });
});

describe('① 相手ターン中に効果リムーブ → 承諾 → 復活 + draw + trait flip', () => {
  it('remove から消え、scene に スリープ + [探偵] で登場、deck -1', () => {
    setHuman('self');
    const s = base('opp'); // 【相手ターン中】= turn.player === 'opp' (owner self 相対)
    const me = mutate.scene.enter(s, 'self', 'B05101', {});
    s.players.self.deck = ['D1', 'D2', 'D3'];
    mutate.scene.removeToRemove(s, me.uid, 'effect');
    runAllUntilEmpty(s);
    // optional が human に surface
    const pO = _drainPendingEffectOptionalSide();
    expect(pO, '「登場させて引いてもよい」が surface').not.toBeNull();
    applyOptionalAndContinuation(s, pO!, true);
    runAllUntilEmpty(s);

    const revived = s.players.self.scene.find((c) => c.cardId === 'B05101');
    expect(revived, 'B05101 が scene に復活').toBeTruthy();
    expect(revived!.state, 'スリープ状態で登場').toBe('sleep');
    expect(s.players.self.remove, 'remove から消える').not.toContain('B05101');
    expect(s.players.self.deck.length, 'draw 1 で deck 3→2').toBe(2);
    const t = charRead.traits(s, revived!.uid);
    expect(t, '警察 を失う').not.toContain('警察');
    expect(t, '警視庁 を失う').not.toContain('警視庁');
    expect(t, '探偵 を得る').toContain('探偵');
  });
});

describe('② flip は permanent (ターン終了時に切れない)', () => {
  it('clearTurnEffects(turn) 後も [探偵]・非[警察] を維持', () => {
    setHuman('self');
    const s = base('opp');
    const me = mutate.scene.enter(s, 'self', 'B05101', {});
    s.players.self.deck = ['D1', 'D2'];
    mutate.scene.removeToRemove(s, me.uid, 'effect');
    runAllUntilEmpty(s);
    applyOptionalAndContinuation(s, _drainPendingEffectOptionalSide()!, true);
    runAllUntilEmpty(s);
    const revived = s.players.self.scene.find((c) => c.cardId === 'B05101')!;
    mutate.char.clearTurnEffects(s, revived.uid, 'turn'); // ターン終了処理
    const t = charRead.traits(s, revived.uid);
    expect(t, 'permanent grant 保持').toContain('探偵');
    expect(t, 'permanent revoke 保持').not.toContain('警察');
    expect(t).not.toContain('警視庁');
  });
});

describe('③ flip 済で再リムーブ → matcherCondition false → 不発', () => {
  it('警察 を失っている状態でリムーブ → optional surface しない', () => {
    setHuman('self');
    const s = base('opp');
    const me = mutate.scene.enter(s, 'self', 'B05101', {});
    // flip 済 state を再現 (permanent revoke)
    mutate.char.revokeTrait(s, me.uid, '警察', 'permanent');
    mutate.char.revokeTrait(s, me.uid, '警視庁', 'permanent');
    mutate.char.grantTrait(s, me.uid, '探偵', 'permanent');
    mutate.scene.removeToRemove(s, me.uid, 'effect');
    expect(_drainPendingEffectOptionalSide(), '警察 不在 → 再発動しない').toBeNull();
    expect(s.players.self.scene.some((c) => c.cardId === 'B05101'), '復活しない').toBe(false);
  });
});

describe('④ 自分ターン中のリムーブ → condition gate で不発', () => {
  it('turn.player === self では【相手ターン中】未成立 → optional surface しない', () => {
    setHuman('self');
    const s = base('self'); // 自分ターン
    const me = mutate.scene.enter(s, 'self', 'B05101', {});
    mutate.scene.removeToRemove(s, me.uid, 'effect');
    expect(_drainPendingEffectOptionalSide(), '自分ターンでは発動しない').toBeNull();
    expect(s.players.self.scene.some((c) => c.cardId === 'B05101')).toBe(false);
  });
});

describe('⑤ decline → 何も起こらない', () => {
  it('run:false → remove に残り復活なし・deck 不変・trait 変化なし', () => {
    setHuman('self');
    const s = base('opp');
    const me = mutate.scene.enter(s, 'self', 'B05101', {});
    s.players.self.deck = ['D1', 'D2', 'D3'];
    mutate.scene.removeToRemove(s, me.uid, 'effect');
    runAllUntilEmpty(s);
    const pO = _drainPendingEffectOptionalSide();
    expect(pO).not.toBeNull();
    applyOptionalAndContinuation(s, pO!, false);
    runAllUntilEmpty(s);
    expect(s.players.self.remove, 'remove に残存').toContain('B05101');
    expect(s.players.self.scene.some((c) => c.cardId === 'B05101'), '復活なし').toBe(false);
    expect(s.players.self.deck.length, 'draw なし').toBe(3);
  });
});

describe('⑥ owner=opp — 相対解決 (effect player:self → opp 側)', () => {
  it('opp が所有し opp の相手ターン (turn.player=self) にリムーブ → opp 側で復活 + flip', () => {
    setHuman('opp'); // opp 側効果を human 経路で承諾
    const s = base('self'); // owner opp から見た【相手ターン中】= turn.player === 'self'
    const me = mutate.scene.enter(s, 'opp', 'B05101', {});
    s.players.opp.deck = ['D1', 'D2', 'D3'];
    mutate.scene.removeToRemove(s, me.uid, 'effect');
    runAllUntilEmpty(s);
    const pO = _drainPendingEffectOptionalSide();
    expect(pO, 'opp-owner でも optional surface').not.toBeNull();
    applyOptionalAndContinuation(s, pO!, true);
    runAllUntilEmpty(s);
    const revived = s.players.opp.scene.find((c) => c.cardId === 'B05101');
    expect(revived, 'opp 側 scene に復活').toBeTruthy();
    expect(revived!.state).toBe('sleep');
    expect(s.players.opp.remove).not.toContain('B05101');
    expect(s.players.opp.deck.length, 'opp deck 3→2').toBe(2);
    const t = charRead.traits(s, revived!.uid);
    expect(t).toContain('探偵');
    expect(t).not.toContain('警察');
  });
});
