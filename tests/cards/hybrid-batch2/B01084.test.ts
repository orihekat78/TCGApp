// hybrid-batch2 probe — B01084 降谷零 (character, engine変更は excludeSelf 短縮形のみ)
//
// 公式テキスト (novel line, payload refusedLine):
//   自分のターン終了時、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、好きな順番で
//   デッキの下に移す）する。レベル5以上のカードが発見された場合、このキャラ以外のレベル6以下の
//   キャラを1枚まで選び、アクティブにする。
//
// DSL: triggered(phase:end:start, condition turn:self) → chain[
//   atom souza{player:'opp', x:1, bind:'$found'},
//   conditional{ if boundAnyMatchesFilter{$found, levelMin:5}
//                then sceneSetState{player:'self', state:'active', side:'either',
//                                   excludeSelf:true, filter:{kind:'character', levelMax:6}, max:1} } ]
//
// 検証面 (全 novel 句を production 経路で実測):
//   - phase:end:start emit (production = flow/turn.ts:72 payload {player}) + condition turn:self gate
//   - souza が相手デッキ top1 を公開→デッキ下 (rules/13) して $found へ bind
//   - boundAnyMatchesFilter{levelMin:5} が発見カードの printed level を評価
//   - sceneSetState 短縮形 pick (excludeSelf / levelMax:6 / side:'either' / 1枚まで)
//   - BUG-174: owner='opp' 側 (相手現場) のキャラを選ぶ pin
//   - BUG-117/118: filter 外 (lv7) / このキャラ自身 (excludeSelf) を候補から除外
//   - rules/15: 「1枚まで」= 0枚 (辞退) 可
//   - negative: found<5 で不発 / 相手ターン (turn:self 不成立) で不発

import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

import { B01084 } from '@/cards/ct-p01/B01084';

const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const FIXTURES: CardDef[] = [
  def('FILL'),
  def('HI5', { level: 5 }),   // souza で発見 → levelMin:5 成立 (トリガ ON)
  def('LO4', { level: 4 }),   // souza で発見 → levelMin:5 不成立 (トリガ OFF)
  def('TGT6', { level: 6 }),  // アクティブ化 対象 (levelMax:6)
  def('DEC7', { level: 7 }),  // decoy: levelMax:6 filter 外
];

function base(oppDeckTop: string): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  s.players.opp.deck = [oppDeckTop, 'FILL', 'FILL', 'FILL'];
  return s;
}

// production emit 形 = flow/turn.ts:72  event.emit(state, 'phase:end:start', { player }, undefined)
function fireEndTurn(s: GameState, player: 'self' | 'opp'): void {
  event.emit(s, 'phase:end:start', { player }, undefined);
  runAllUntilEmpty(s);
}

const findState = (s: GameState, side: 'self' | 'opp', uid: string) =>
  s.players[side].scene.find(c => c.uid === uid)?.state;

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  setHuman('self');
  for (const d of [B01084, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

describe('B01084 a1 — phase:end:start 捜査1 → lv5+発見で lv6以下キャラ1枚 active', () => {
  it('自ターン終了 + 発見lv5 → 自現場 lv6以下 sleep を active。候補は excludeSelf/levelMax で絞る (BUG-117/118)', () => {
    const s = base('HI5');
    s.players.self.scene = [sc('B01084', 'jd', 'sleep'), sc('TGT6', 'tg', 'sleep'), sc('DEC7', 'd7', 'sleep')];

    fireEndTurn(s, 'self');

    // souza: 発見カード (HI5) は相手デッキの下へ (rules/13)
    expect(s.players.opp.deck[0], 'top が次の FILL に').toBe('FILL');
    expect(s.players.opp.deck[s.players.opp.deck.length - 1], 'HI5 はデッキ下').toBe('HI5');

    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb, 'sceneSetState pick が surface').toBe('sceneSetState');
    const candUids = (pending!.candidates as Array<{ uid: string }>).map(c => c.uid).sort();
    expect(candUids, 'このキャラ(jd)と lv7(d7)は候補外、tg のみ').toEqual(['tg']);

    applyPickAndContinuation(s, pending!, 'tg');
    expect(findState(s, 'self', 'tg'), '選んだキャラが active').toBe('active');
    expect(findState(s, 'self', 'jd'), 'このキャラ自身は excludeSelf で不変').toBe('sleep');
    expect(findState(s, 'self', 'd7'), 'lv7 decoy は不変').toBe('sleep');
  });

  it('BUG-174 owner=opp: 相手現場の lv6以下キャラを選び active 化 (side:either)', () => {
    const s = base('HI5');
    s.players.self.scene = [sc('B01084', 'jd', 'sleep')];       // 自陣は source のみ (excludeSelf で候補0)
    s.players.opp.scene = [sc('TGT6', 'otg', 'sleep'), sc('DEC7', 'od7', 'sleep')];

    fireEndTurn(s, 'self');

    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('sceneSetState');
    const candUids = (pending!.candidates as Array<{ uid: string }>).map(c => c.uid).sort();
    expect(candUids, '相手側 lv6以下 (otg) のみ候補、jd(self)/od7(lv7) は除外').toEqual(['otg']);

    applyPickAndContinuation(s, pending!, 'otg');
    expect(findState(s, 'opp', 'otg'), '相手キャラが active に').toBe('active');
    expect(findState(s, 'opp', 'od7')).toBe('sleep');
  });

  it('rules/15「1枚まで」= 辞退可: human が0枚選択 → 誰も active 化しない', () => {
    const s = base('HI5');
    s.players.self.scene = [sc('B01084', 'jd', 'sleep'), sc('TGT6', 'tg', 'sleep')];

    fireEndTurn(s, 'self');
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('sceneSetState');

    applyPickSkipAndContinuation(s, pending!, false);
    expect(findState(s, 'self', 'tg'), '辞退 → 不変').toBe('sleep');
  });

  it('negative: 発見lv4 → conditional 不成立 → pick surface なし・状態不変', () => {
    const s = base('LO4');
    s.players.self.scene = [sc('B01084', 'jd', 'sleep'), sc('TGT6', 'tg', 'sleep')];

    fireEndTurn(s, 'self');

    expect(_drainPendingEffectPickSide(), 'lv4 発見では pick surface しない').toBeNull();
    expect(findState(s, 'self', 'tg'), '対象は不変').toBe('sleep');
    // souza 自体は発火するので HI5→LO4 の rotate は起きる
    expect(s.players.opp.deck[s.players.opp.deck.length - 1]).toBe('LO4');
  });

  it('negative: 相手ターンの phase:end:start → condition turn:self 不成立で不発 (souza も走らない)', () => {
    const s = base('HI5');
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sc('B01084', 'jd', 'sleep'), sc('TGT6', 'tg', 'sleep')];

    fireEndTurn(s, 'opp');

    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(findState(s, 'self', 'tg'), '対象は不変').toBe('sleep');
    expect(s.players.opp.deck[0], '相手ターンでは souza 未発火 = デッキ top 不変').toBe('HI5');
  });
});
