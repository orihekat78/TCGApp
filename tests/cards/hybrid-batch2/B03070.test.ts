// hybrid-batch2 probe — B03070 メアリー (character, 赤 L7)
// novel 句 (refusedLine, compiler 既製でない部分):
//   【ターン1】自分の現場にいるキャラのアクション［事件］によって証拠を得たとき、このキャラを
//   スリープさせてもよい。そうした場合、相手の現場にいるレベル7以下のキャラを1枚まで選び、
//   手札に移す。相手は手札を1枚リムーブする。
// DSL: triggered evidence:gain (triggerCharMatches byUid side:self) + condition charStateIs(self,active)
//      + limit turn1 + optional{chain[sceneSetState $self sleep, sequence[sceneToHand opp levelMax7,
//      discard opp 1]]}
//
// production 経路: evidence:gain emit = src/engine/flow/action-case.ts:141
//   payload {player, byUid, uid, via:'action-case', gained:1} / meta {player, uid} を丸写し。
//   これが evidence:gain の唯一 emit 箇所 (推理/効果/refresh 由来では発火せず「アクション[事件]に
//   よって」を構造保証、action-case.ts:137)。
// limit turn1 = queue 時 incrDeclaredUseCount (triggered.ts:457) — optional の yes/no と独立に消費。
// BUG-174: sceneToHand side:'opp' の pick は対象が相手側 = owner=opp pin。decoy(level8)除外を assert。
// rules: 10 (アクション[事件]/証拠獲得), 03 (状態), 15 (「〜まで」=0可/「そうした場合」gate), 24 (active でなければ sleep 不可)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  drainAiEffectPicks,
  _drainAllEffectPicksForTest,
  applyOptionalAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _peekPendingEffectOptionalSide,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

import { B03070 } from '@/cards/ct-p03/B03070';

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });
const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

const FIXTURES: CardDef[] = [
  def('ACTOR'),                      // self 現場: 証拠を得るキャラ (トリガ byUid)
  def('TGT', { level: 5 }),          // opp 現場: level7以下 = sceneToHand の唯一有効候補
  def('DECOY', { level: 8 }),        // opp 現場: level8 = filter(levelMax:7) 除外 decoy
  def('OHAND'),                      // opp 手札 fill (discard 対象確認用)
];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['OHAND', 'OHAND', 'OHAND', 'OHAND'];
  s.players.opp.deck = ['OHAND', 'OHAND', 'OHAND', 'OHAND'];
  return s;
}

// mary(active) + actor を self 現場、TGT(L5)+DECOY(L8) を opp 現場、opp 手札1枚
function board(maryState: 'active' | 'sleep' | 'stun' = 'active'): GameState {
  const s = base();
  s.players.self.scene = [sc('B03070', 'mary', maryState), sc('ACTOR', 'actor')];
  s.players.opp.scene = [sc('TGT', 'tgt'), sc('DECOY', 'decoy')];
  s.players.opp.hand = ['OHAND'];
  return s;
}

// production emit 丸写し (action-case.ts:141)。actor が証拠を得た体で evidence:gain を発火。
const gain = (s0: GameState, byUid: string, player: 'self' | 'opp') =>
  produce(s0, (d) => {
    event.emit(
      d,
      'evidence:gain',
      { player, byUid, uid: byUid, via: 'action-case', gained: 1 },
      { player, uid: byUid },
    );
    runAllUntilEmpty(d);
  });

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of [B03070, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

describe('B03070 メアリー a1 — evidence:gain(action-case) → optional[self sleep + opp bounce + opp discard]', () => {
  it('YES: 自現場キャラの証拠獲得 → mary sleep + opp TGT を手札へ + opp discard1 (owner=opp pick pin, decoy除外)', () => {
    setHuman('self');
    const s = produce(board(), (d) => {
      event.emit(d, 'evidence:gain',
        { player: 'self', byUid: 'actor', uid: 'actor', via: 'action-case', gained: 1 },
        { player: 'self', uid: 'actor' });
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface (human self)').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true);
      // chain[sleep, sequence[sceneToHand(pick opp), discard(pick opp)]] を drain
      for (let k = 0; k < 6; k++) {
        _drainAllEffectPicksForTest(d);
        runAllUntilEmpty(d);
      }
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    // 自身 sleep
    expect(s.players.self.scene.find((c) => c.uid === 'mary')!.state, 'mary self-sleep').toBe('sleep');
    // TGT (level5) は opp 現場から消え、DECOY (level8) は残る (levelMax:7 filter + owner=opp)
    expect(s.players.opp.scene.some((c) => c.uid === 'tgt'), 'TGT は手札へ移動 (opp 現場から消失)').toBe(false);
    expect(s.players.opp.scene.some((c) => c.uid === 'decoy'), 'DECOY(level8) は候補外で現場に残る').toBe(true);
    // opp 手札: 初期1(OHAND) + bounce TGT → 2 → discard1 → 1
    expect(s.players.opp.hand.length, 'sceneToHand(+1) → discard(-1) の net = 1').toBe(1);
  });

  it('NO: スリープさせない → 「そうした場合」以降不発 (mary active / opp 現場・手札不変)', () => {
    setHuman('self');
    const s = produce(board(), (d) => {
      event.emit(d, 'evidence:gain',
        { player: 'self', byUid: 'actor', uid: 'actor', via: 'action-case', gained: 1 },
        { player: 'self', uid: 'actor' });
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, false);
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'mary')!.state, 'mary は active のまま').toBe('active');
    expect(s.players.opp.scene.length, 'opp 現場 2枚不変 (bounce なし)').toBe(2);
    expect(s.players.opp.hand.length, 'opp 手札 1枚不変 (discard なし)').toBe(1);
  });

  it('negative — 相手が証拠を得た (player:opp) → 発動しない (triggerCharMatches side:self gate)', () => {
    setHuman('self');
    // opp 現場の tgt が opp 側で証拠を得た体。byUid=tgt は opp scene → side:self 不成立。
    gain(board(), 'tgt', 'opp');
    expect(_peekPendingEffectOptionalSide(), '相手獲得では surface しない').toBeNull();
  });

  it('negative — mary が sleep 状態 → 発動しない (charStateIs active gate, 公式Q&A)', () => {
    setHuman('self');
    gain(board('sleep'), 'actor', 'self');
    expect(_peekPendingEffectOptionalSide(), 'active でなければ発動しない').toBeNull();
  });

  it('【ターン1】: NO を選んでも limit 消費 → 同ターン2回目は surface しない (公式Q&A #2)', () => {
    setHuman('self');
    produce(board(), (d) => {
      // 1回目: fire → decline
      event.emit(d, 'evidence:gain',
        { player: 'self', byUid: 'actor', uid: 'actor', via: 'action-case', gained: 1 },
        { player: 'self', uid: 'actor' });
      runAllUntilEmpty(d);
      const p1 = _peekPendingEffectOptionalSide();
      expect(p1, '1回目 surface').not.toBeNull();
      applyOptionalAndContinuation(d, p1!, false);
      runAllUntilEmpty(d);
      // side-channel を掃除してから2回目の fire 有無だけを検証
      _clearPendingEffectOptionalSide();
      // 2回目 (同ターン, mary は decline したので active のまま)
      event.emit(d, 'evidence:gain',
        { player: 'self', byUid: 'actor', uid: 'actor', via: 'action-case', gained: 1 },
        { player: 'self', uid: 'actor' });
      runAllUntilEmpty(d);
      expect(_peekPendingEffectOptionalSide(), '【ターン1】消費済 → 2回目は発動しない').toBeNull();
    });
  });
});
