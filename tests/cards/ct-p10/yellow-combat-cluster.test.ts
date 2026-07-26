import { beforeEach, describe, expect, it } from 'vitest';
import { B10075 } from '@/cards/ct-p10/B10075';
import { B10079 } from '@/cards/ct-p10/B10079';
import { canAction } from '@/engine/flow/main/action';
import { canGuard } from '@/engine/flow/guard';
import { canReason } from '@/engine/flow/main/reasoning';
import { event } from '@/engine/event';
import { endTurn } from '@/engine/flow/turn';
import { runAllUntilEmpty } from '@/engine/resolve';
import { applyOptionalAndContinuation, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue, _drainPendingEffectOptionalSide, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

const character = (id: string, name: string, colors: string[], traits: string[] = []): CardDef => ({
  id, no: id, kind: 'character', names: [name], colors, level: 4, ap: 3000, lp: 1,
  traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});

const TAKAGI = character('B10075_TAKAGI', '高木渉', ['黄'], ['警察', '警視庁']);
const YELLOW_POLICE = character('B10075_YELLOW_POLICE', '黄警視庁', ['黄'], ['警視庁']);
const BLUE_POLICE = character('B10075_BLUE_POLICE', '青警視庁', ['青'], ['警視庁']);
const YELLOW_CIVILIAN = character('B10075_YELLOW_CIVILIAN', '黄民間人', ['黄'], ['警察']);
const ATTACKER = character('B10079_ATTACKER', '攻撃者', ['青']);

function stateFor(player: 'self' | 'opp'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 3, player, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [
    sceneChar('B10075', 'sato', { isNamed: true }),
    sceneChar('B10075_TAKAGI', 'takagi'),
    sceneChar('B10075_YELLOW_POLICE', 'valid'),
    sceneChar('B10075_BLUE_POLICE', 'blueDecoy'),
    sceneChar('B10075_YELLOW_CIVILIAN', 'traitDecoy'),
  ];
  return state;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  [B10075, B10079, TAKAGI, YELLOW_POLICE, BLUE_POLICE, YELLOW_CIVILIAN, ATTACKER].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

function bombState(turnPlayer: 'self' | 'opp' = 'self') {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [sceneChar('B10079', 'bomb')];
  state.players.opp.scene = [sceneChar('B10079_ATTACKER', 'attacker')];
  return state;
}

describe('CT-P10 B10079 爆弾犯', () => {
  it('恒久の推理・アクション・ガード禁止はbearerだけに適用され、元の能力無効で解除される', () => {
    const state = bombState();
    expect(canReason(state, 'bomb')).toBe(false);
    expect(canAction(state, 'bomb')).toBe(false);
    expect(canGuard(state, 'attacker', 'bomb')).toBe(false);

    state.players.self.scene[0]!.keywordOverrides.disabledOriginal = true;
    expect(canReason(state, 'bomb')).toBe(true);
    expect(canAction(state, 'bomb')).toBe(true);
    expect(canGuard(state, 'attacker', 'bomb')).toBe(true);
  });

  it('自分ターン終了時、任意で自身をスリープして相手の手札を1枚リムーブする', () => {
    const state = bombState();
    state.players.opp.hand = ['opp-hand'];
    endTurn(state, 'self');
    runAllUntilEmpty(state);
    const optional = _drainPendingEffectOptionalSide();
    expect(optional, '任意効果を表示').not.toBeNull();

    applyOptionalAndContinuation(state, optional!, true);
    runAllUntilEmpty(state);
    const discardPick = _drainPendingEffectPickSide();
    expect(discardPick, '相手がリムーブする手札を選ぶ').not.toBeNull();
    expect(discardPick!.player, '選択者は相手').toBe('opp');
    expect(discardPick!.ownerPlayer, '能力所有者の座標系').toBe('self');
    applyPickAndContinuation(state, discardPick!, discardPick!.candidates[0]!.uid);
    runAllUntilEmpty(state);
    expect(state.players.self.scene[0]!.state).toBe('sleep');
    expect(state.players.opp.hand).toEqual([]);
    expect(state.players.opp.remove).toContain('opp-hand');
  });

  it('任意効果の辞退では状態も相手手札も変えず、相手の手札0枚でも選択できる', () => {
    const declined = bombState();
    declined.players.opp.hand = ['opp-hand'];
    endTurn(declined, 'self');
    runAllUntilEmpty(declined);
    const decline = _drainPendingEffectOptionalSide();
    applyOptionalAndContinuation(declined, decline!, false);
    expect(declined.players.self.scene[0]!.state).toBe('active');
    expect(declined.players.opp.hand).toEqual(['opp-hand']);

    const zero = bombState();
    endTurn(zero, 'self');
    runAllUntilEmpty(zero);
    const zeroOptional = _drainPendingEffectOptionalSide();
    expect(zeroOptional, '相手手札0枚でも任意効果を表示').not.toBeNull();
    applyOptionalAndContinuation(zero, zeroOptional!, true);
    runAllUntilEmpty(zero);
    expect(zero.players.self.scene[0]!.state).toBe('sleep');
    expect(zero.players.opp.hand).toEqual([]);
    expect(_drainPendingEffectPickSide()).toBeNull();
  });

  it('相手ターン終了時には発動しない', () => {
    const state = bombState('opp');
    endTurn(state, 'opp');
    runAllUntilEmpty(state);
    expect(_drainPendingEffectOptionalSide()).toBeNull();
    expect(state.players.self.scene[0]!.state).toBe('active');
  });
});

describe('CT-P10 B10075 佐藤美和子', () => {
  it('自分ターンかつ【絆高木渉】で、突撃を得て他の黄・警視庁だけをAP+1000する', () => {
    const state = stateFor('self');

    expect(canAction(state, 'sato'), '突撃により名乗り状態でもアクション可能').toBe(true);
    expect(read.char.ap(state, 'valid'), '対象の黄・警視庁').toBe(4000);
    expect(read.char.ap(state, 'sato'), 'このキャラ以外').toBe(5000);
    expect(read.char.ap(state, 'blueDecoy'), '青のdecoy').toBe(3000);
    expect(read.char.ap(state, 'traitDecoy'), '警視庁でないdecoy').toBe(3000);
  });

  it('相手ターンではAP補正だけが消え、絆なし・元の能力無効では突撃も消える', () => {
    const oppTurn = stateFor('opp');
    expect(canAction(oppTurn, 'sato'), '突撃には自分ターン中の条件なし').toBe(true);
    expect(read.char.ap(oppTurn, 'valid')).toBe(3000);

    const noBond = stateFor('self');
    noBond.players.self.scene = noBond.players.self.scene.filter(c => c.uid !== 'takagi');
    expect(canAction(noBond, 'sato'), '絆なしは突撃なし').toBe(false);
    expect(read.char.ap(noBond, 'valid')).toBe(3000);

    const disabled = stateFor('self');
    disabled.players.self.scene.find(c => c.uid === 'sato')!.keywordOverrides.disabledOriginal = true;
    expect(canAction(disabled, 'sato'), '元の能力無効は突撃なし').toBe(false);
    expect(read.char.ap(disabled, 'valid'), '元の能力無効はauraなし').toBe(3000);
  });
});
