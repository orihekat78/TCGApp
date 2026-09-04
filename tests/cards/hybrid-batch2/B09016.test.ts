// CARD PHASE hybrid-batch2 probe — B09016 円谷光彦 (character)
// 公式テキスト:
//   〚ミスリード1〛
//   【相手ターン中】【ターン1】このキャラが〚ミスリード〛したとき、自分の現場に
//   〚カード名［円谷光彦］〛以外のレベル4の〚特徴［少年探偵団］〛のキャラがいる場合、
//   このキャラをアクティブにする。
// DSL:
//   a1 icon-misread marker x1 (ミスリード資格)
//   a2 triggered hook 'misread:performed' + selfOnly (このキャラが)
//      condition and[ turn{opp}=相手ターン中,
//                     sceneHas{side:self, filter:{cardNameNot:円谷光彦, levelMin:4, levelMax:4,
//                              trait:少年探偵団}, nMin:1} ]
//      limit turn{n:1}  →  sceneSetState{$self, active}
//
// production emit 経路 (fake emit を避け実 flow を回す):
//   listeners/misread.ts:121 の AI defender 経路が emit する。
//   - doReasoning(state, R) → reasoning:before-add 発火
//   - misread listener: reasoningPlayer='self' → defender='opp' (state 視点)。opp scene の
//     active な icon-misread 持ち (=B09016) を candidate 化 → HeuristicPolicy.chooseMisreadTriggers が
//     採用 (推理キャラ LP を 0 以下にできる場合のみ採用 = R.lp ≤ Σx が必要 → R.lp=1, x=1)。
//   - B09016 を sleep 化 (ミスリードのコスト) + 推理キャラに LP-1 (setOverrideLP) + emit
//     'misread:performed'{player:'opp', source.uid=B09016}。
//   - handleHook (triggered.ts) が B09016.a2 を queue → runAllUntilEmpty で sceneSetState 解決。
//
// owner-relative 評価 (cond/eval.ts):
//   B09016 が state.players.opp に居る = owner='opp'。turn{opp}=resolvePlayer('opp',owner=opp)='self' →
//   state.turn.player==='self' で成立 (=owner の相手ターン)。sceneHas side:'self' も owner='opp' の
//   自陣 = state.players.opp.scene を走査する。
//
// BUG-330: opp 自身のターンに self が推理する状態は公開/直接engineの両方で拒否する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered, _setHumanPlayerSide } from '@/engine/listeners/triggered';
import {
  registerMisreadListener,
  _resetMisreadRegistered,
  _resetPendingMisread,
} from '@/engine/listeners/misread';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createMainGameState as createEmptyGameState } from '../../helpers/main-game-state';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { doReasoning } from '@/engine/flow/main/reasoning';
import { char as readChar } from '@/engine/read/char';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

import { B09016 } from '@/cards/ct-p09/B09016';

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

// 推理キャラ (LP=1 → ミスリード1 で LP0 に落ちる → heuristic が採用する下限)
const REASONER = def('REASONER', { names: ['REASONER'], lp: 1, traits: [] });
// sceneHas を満たす同伴キャラ: 円谷光彦 以外 / level 4 / 特徴[少年探偵団]
const COMP_OK = def('COMP_OK', { names: ['江戸川コナン'], level: 4, traits: ['少年探偵団'] });
// fail 用同伴キャラ 3 種
const COMP_MITSU = def('COMP_MITSU', { names: ['円谷光彦'], level: 4, traits: ['少年探偵団'] }); // 名が円谷光彦
const COMP_L5 = def('COMP_L5', { names: ['灰原哀'], level: 5, traits: ['少年探偵団'] });           // level 5
const COMP_NOTRAIT = def('COMP_NOTRAIT', { names: ['毛利小五郎'], level: 4, traits: ['探偵'] });    // 少年探偵団 なし

const ALL = [B09016, REASONER, COMP_OK, COMP_MITSU, COMP_L5, COMP_NOTRAIT];

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetMisreadRegistered();
  _resetPendingMisread();
  _setHumanPlayerSide(null);
  resetCardDefRegistry();
  _resetUidCounter();
  for (const d of ALL) registerCardDef(d);
  registerTriggeredListener();
  registerMisreadListener();
});

// state.turn.player: self が推理 = 通常 self のターン。B09016(opp) の owner-relative では相手ターン。
function base(turnPlayer: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['SD1', 'SD2', 'SD3'];
  s.players.opp.deck = ['OD1', 'OD2', 'OD3'];
  return s;
}

// 盤面: B09016(opp, active) + companion(opp) + 推理キャラ(self, active)
function board(companionCardId: string | null, turnPlayer: 'self' | 'opp' = 'self'): GameState {
  const s = base(turnPlayer);
  s.players.opp.scene = [sc('B09016', 'mitsu')];
  if (companionCardId) s.players.opp.scene.push(sc(companionCardId, 'comp'));
  s.players.self.scene = [sc('REASONER', 'r1')];
  return s;
}

// self が推理 → misread AI defender 経路 → (条件成立なら) a2 で B09016 再アクティブ
const fireMisread = (s0: GameState, reasoningUid = 'r1') => produce(s0, (d) => {
  doReasoning(d, reasoningUid);
  runAllUntilEmpty(d);
});

const stateOf = (s: GameState, uid: string) =>
  s.players.opp.scene.find((c) => c.uid === uid)?.state;

describe('B09016 a2 — このキャラがミスリードしたとき自己アクティブ (【相手ターン中】【ターン1】)', () => {
  it('happy: 相手ターン(self推理)+ 同伴に非円谷/Lv4/少年探偵団 → B09016 sleep化後 active に戻る', () => {
    const after = fireMisread(board('COMP_OK'));
    expect(stateOf(after, 'mitsu'), 'ミスリード後 a2 で再アクティブ').toBe('active');
    // 推理中はLP0なので証拠0枚。推理終了後は期限どおり印字LP1へ戻る。
    expect(readChar.lp(after, 'r1'), 'ミスリードLP-1は推理終了時に消える').toBe(1);
    expect(after.players.self.evidence.length, 'LP0 → 得る証拠 0 枚 (rules/11)').toBe(0);
  });

  it('fail: 同伴が別の円谷光彦 (cardNameNot 円谷光彦 で除外) → sleep のまま', () => {
    const after = fireMisread(board('COMP_MITSU'));
    expect(stateOf(after, 'mitsu'), 'sceneHas 不成立 → 再アクティブしない').toBe('sleep');
    expect(readChar.lp(after, 'r1'), 'ミスリードLP-1は推理終了時に消える').toBe(1);
  });

  it('fail: 同伴が level5 (levelMin/Max 4 の完全一致外) → sleep のまま', () => {
    const after = fireMisread(board('COMP_L5'));
    expect(stateOf(after, 'mitsu')).toBe('sleep');
  });

  it('fail: 同伴が 特徴[少年探偵団] を持たない → sleep のまま', () => {
    const after = fireMisread(board('COMP_NOTRAIT'));
    expect(stateOf(after, 'mitsu')).toBe('sleep');
  });

  it('fail: 同伴なし (自陣に他キャラ無し。B09016 自身は円谷光彦で除外) → sleep のまま', () => {
    const after = fireMisread(board(null));
    expect(stateOf(after, 'mitsu')).toBe('sleep');
  });

  it('【ターン1】: 同一ターンに 2 回ミスリード → 2 回目は再アクティブしない (limit turn 1)', () => {
    // 2 体の推理キャラを self に置く (各回で別キャラが推理)
    const s = board('COMP_OK');
    s.players.self.scene.push(sc('REASONER', 'r2'));

    // 1 回目: 発火 → B09016 active
    const mid = fireMisread(s, 'r1');
    expect(stateOf(mid, 'mitsu'), '1 回目は再アクティブ').toBe('active');

    // 2 回目 (同一 state = 同一ターン、declaredUseCount 継続): misread は再発火し sleep 化するが
    // a2 は limit 到達で queue されない → sleep のまま
    const after = fireMisread(mid, 'r2');
    expect(stateOf(after, 'mitsu'), '2 回目は limit で不発 → sleep').toBe('sleep');
  });

  it('owner=opp の自ターン中は self の推理自体をmain-action admissionで拒否する', () => {
    const state = board('COMP_OK', 'opp');
    const before = structuredClone(state);
    expect(() => fireMisread(state)).toThrow(/doReasoning: not allowed/);
    expect(state).toEqual(before);
  });
});
