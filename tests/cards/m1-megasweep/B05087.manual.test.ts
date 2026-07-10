// tests/cards/m1-megasweep/B05087.manual — 諸伏高明 (character) 手書き probe (engine 実評価)
//
// 公式テキスト (payload fullTexts.effect):
//   a1 【パートナー黄】【自分ターン中】【ターン1】自分のリムーブエリアにある〚特徴［長野県警］〛のキャラが
//        リムーブエリアから離れたとき、AP7000以下のキャラを1枚まで選び、リムーブする。
//   a2 自分のターン終了時、自分のリムーブエリアにあるレベル6以下の〚特徴［長野県警］〛のキャラを1枚まで選び、
//        手札に加える。カードを手札に加え、自分の手札が6枚以上ある場合、手札を1枚リムーブする。
//
// novel句 (engine 実評価で踏む):
//   a1: trigger remove:exit + matcherCondition removeExitMatches{side:self, removeFilter{trait:長野県警,kind:character}}
//       condition and[partnerColor黄, turn:self] / limit turn:1
//       effect sceneRemove{player:self, max:1(「まで」=0可), side:either, filter{apMax:7000}}
//   a2: trigger phase:end:start / condition turn:self
//       chain[ handAddFromRemove{player:self, max:1, filter{trait:長野県警,levelMax:6,kind:character}}
//              conditional{if handAtLeast(self,6) then discard{self,1}} ]
//
// 駆動:
//   a1 = mutate.remove.removeFromHere で 長野県警 char を remove から離脱 → emitExit → remove:exit
//        (wave-4 契約、engine-additive-wave4-0701.test.ts 慣行)。
//   a2 = event.emit(phase:end:start) (flow/turn.ts:72 production 形、B03110/B06018 慣行)。
//   両者とも emit+drain を単一 produce draft で包む (sceneRemove pick / handAddFromRemove の continuation が
//   current() を呼びうるため。miniwave3 慣行 + setAutoFreeze(false))。
//
// 注: handAddFromRemove 自身も remove:exit を emit する (core.ts:1017) ため、a2 テストで partner黄 だと
//   a2 の 長野県警 回収が a1 を cascade 発火させる。a2 の condition は turn:self のみ (partner色 gate 無し) なので
//   partner非黄 で a2 を isolate して検証する (印字上も a2 に【パートナー黄】は無い)。
//
// ⚠ ENGINE GAP (BUG-174 class、S8 参照): a2 の handAddFromRemove (PB 短縮形 pick) は owner=opp で反転する。
//   resolve-picks.ts:310 の pre-walk が `p = args.player ?? 'self'` を絶対 side で解決し (resolvePlayer 未経由)、
//   opp 所有時に相手 (self) のリムーブエリアを候補列挙 → opp 自身の remove を回収できない。
//   a1 (PA 短縮形、runtime atom-handler で resolvePlayer 済) は owner=opp でも正しい (S6 PASS)。
//   BUG-174 owner=opp pin は a1 (S6) で担保し、a2 の反転は S8 で現状挙動として pin (リグレッション検出)。
// rules: 05-turn-phases.md, 15-abilities-effects.md, 17-icons.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce, setAutoFreeze } from 'immer';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  _drainPendingEffectPickSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectChoiceSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import {
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
  applyOptionalAndContinuation,
} from '@/engine/effect/apply-pick';
import { B05087 } from '@/cards/ct-p05/B05087';
import type { CardDef, GameState, Player } from '@/engine/types';

function charDef(id: string, opts: { ap?: number; level?: number; traits?: string[] } = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黄'],
    level: opts.level ?? 3, ap: opts.ap ?? 3000, lp: 1,
    traits: opts.traits ?? [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}
function partnerDef(id: string, colors: string[]): CardDef {
  return { id, no: id, kind: 'partner', names: [id], colors, level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

// a1 fixtures
const NAGANO = charDef('NAGANO', { traits: ['長野県警'] });        // remove:exit trigger 一致
const OTHER = charDef('OTHER', { traits: ['警視庁'] });            // 非-長野県警 (trigger decoy / add decoy)
const TARGET = charDef('TARGET', { ap: 3000 });                    // sceneRemove 対象 (AP≤7000)
const BIG = charDef('BIG', { ap: 9000 });                          // AP>7000 decoy (候補外)
const OPPT = charDef('OPPT', { ap: 4000 });                        // side:either 敵陣候補
// a2 fixtures
const NAGANO6 = charDef('NAGANO6', { traits: ['長野県警'], level: 6 }); // lvl≤6 長野県警 (add 対象)
const NAGANO9 = charDef('NAGANO9', { traits: ['長野県警'], level: 9 }); // lvl>6 長野県警 (add decoy)
const F1 = charDef('F1'), F2 = charDef('F2'), F3 = charDef('F3'), F4 = charDef('F4'), F5 = charDef('F5'); // 手札 filler
// partners
const PY = partnerDef('PY', ['黄']);
const PBLUE = partnerDef('PBLUE', ['青']);
const FIXTURES = [NAGANO, OTHER, TARGET, BIG, OPPT, NAGANO6, NAGANO9, F1, F2, F3, F4, F5, PY, PBLUE];

function setHuman(s: Player | null): void {
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s;
}

// pick(単/複)/optional を drain する汎用ループ (miniwave3 流儀)。
type ScriptAction = 'pick:skip' | 'optional:take' | 'optional:decline' | { pickCardIds: string[] };
function drainScript(s: GameState, script: ScriptAction[]): void {
  let i = 0;
  for (let g = 0; g < 50; g++) {
    const pick = _drainPendingEffectPickSide();
    if (pick) {
      const cands = (pick.candidates as Array<{ uid: string; cardId: string }>).map((c) => ({ uid: c.uid, cardId: c.cardId }));
      const a = script[i++];
      if (a === undefined) throw new Error(`pick "${pick.atomVerb}" surfaced but script exhausted (cands=${cands.map((c) => c.cardId).join(',')})`);
      if (a === 'pick:skip') applyPickSkipAndContinuation(s, pick, false);
      else if (typeof a === 'object' && 'pickCardIds' in a) {
        const uids = a.pickCardIds.map((cid) => {
          const hit = cands.find((c) => c.cardId === cid);
          if (!hit) throw new Error(`pickCardId ${cid} not in ${pick.atomVerb} cands: ${cands.map((c) => c.cardId).join(',')}`);
          return hit.uid;
        });
        applyPickAndContinuation(s, pick, uids[0]!, uids);
      } else throw new Error(`pick "${pick.atomVerb}" surfaced but script action is ${JSON.stringify(a)}`);
      runAllUntilEmpty(s);
      continue;
    }
    if (_drainPendingEffectChoiceSide()) throw new Error('unexpected choice surfaced');
    const opt = _drainPendingEffectOptionalSide();
    if (opt) {
      const a = script[i++];
      if (a === 'optional:take') applyOptionalAndContinuation(s, opt, true);
      else if (a === 'optional:decline') applyOptionalAndContinuation(s, opt, false);
      else throw new Error(`optional surfaced but script action is ${JSON.stringify(a)}`);
      runAllUntilEmpty(s);
      continue;
    }
    break;
  }
  if (i < script.length) throw new Error(`${script.length - i} leftover script action(s) but no more prompts (over-scripted)`);
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B05087);
  for (const f of FIXTURES) registerCardDef(f);
  registerTriggeredListener();
  setHuman('self');
  setAutoFreeze(false);
});

// ---- shape ----
describe('B05087 諸伏高明 — shape', () => {
  it('id/no/色/lv/ap/特徴 + a1 remove:exit matcher / a2 phase:end:start chain', () => {
    expect(B05087.id).toBe('B05087');
    expect(B05087.no).toBe('0585/B05087');
    expect(B05087.colors).toEqual(['黄']);
    expect(B05087.ap).toBe(7000);
    expect(B05087.traits).toEqual(['警察', '長野県警']);
    const a1 = B05087.abilities[0];
    expect(a1.trigger?.hook).toBe('remove:exit');
    expect(a1.trigger?.matcherCondition).toMatchObject({ kind: 'removeExitMatches', side: 'self' });
    expect(a1.limit).toMatchObject({ kind: 'turn', n: 1 });
    const a2 = B05087.abilities[1];
    expect(a2.trigger?.hook).toBe('phase:end:start');
    expect(a2.condition).toMatchObject({ kind: 'turn', player: 'self' });
  });
});

// ---- a1 (remove:exit observer → sceneRemove pick) ----
describe('B05087 a1 remove:exit【パートナー黄】【自ターン】長野県警 離脱 → AP7000以下 1枚まで removal', () => {
  // owner の board を組み、長野県警(cardId) を remove から removeFromHere で離脱させる。
  function runA1(opts: {
    owner: Player; partner: string; turn: Player;
    leaveCardId: string; // remove から離脱させる cardId
    selfScene: string[]; oppScene: string[];
    script: ScriptAction[];
  }): GameState {
    const b = createEmptyGameState();
    b.turn = { number: 5, player: opts.turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    b.players[opts.owner].partner.cardId = opts.partner;
    const foe: Player = opts.owner === 'self' ? 'opp' : 'self';
    b.players[opts.owner].remove = [opts.leaveCardId];
    return produce(b, (d: GameState) => {
      mutate.scene.enter(d, opts.owner, 'B05087', {});
      for (const c of opts.selfScene) mutate.scene.enter(d, opts.owner, c, {});
      for (const c of opts.oppScene) mutate.scene.enter(d, foe, c, {});
      mutate.remove.removeFromHere(d, opts.owner, [opts.leaveCardId]); // → remove:exit emit
      runAllUntilEmpty(d);
      drainScript(d, opts.script);
    }) as GameState;
  }

  it('S1 happy: 黄P + 自ターン + 長野県警 離脱 → sceneRemove pick 候補は AP≤7000 のみ (BIG 9000 除外, 敵陣 OPPT 含む), TARGET removal', () => {
    const b = createEmptyGameState();
    b.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    b.players.self.partner.cardId = 'PY';
    b.players.self.remove = ['NAGANO'];
    let candIds: string[] = [];
    const s = produce(b, (d: GameState) => {
      mutate.scene.enter(d, 'self', 'B05087', {});
      mutate.scene.enter(d, 'self', 'TARGET', {}); // AP3000
      mutate.scene.enter(d, 'self', 'BIG', {});     // AP9000 decoy
      mutate.scene.enter(d, 'opp', 'OPPT', {});     // AP4000 (side:either)
      mutate.remove.removeFromHere(d, 'self', ['NAGANO']);
      runAllUntilEmpty(d);
      // sceneRemove pick を peek して候補を確認してから TARGET を選ぶ
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'a1 発火 → sceneRemove pick surface').not.toBeNull();
      candIds = (pick!.candidates as Array<{ cardId: string }>).map((c) => c.cardId).sort();
      const uids = pick!.candidates as Array<{ uid: string; cardId: string }>;
      const tgt = uids.find((c) => c.cardId === 'TARGET')!;
      applyPickAndContinuation(d, pick!, tgt.uid, [tgt.uid]);
      runAllUntilEmpty(d);
    }) as GameState;
    // 候補 = AP≤7000 の scene char (B05087=7000, TARGET=3000, OPPT=4000)。BIG(9000) は除外。
    expect(candIds, 'AP≤7000 のみ, 両陣 (side:either), BIG 9000 除外').toEqual(['B05087', 'OPPT', 'TARGET']);
    expect(s.players.self.scene.map((c) => c.cardId).sort(), 'TARGET removal (B05087/BIG 残存)').toEqual(['B05087', 'BIG']);
    expect(s.players.self.remove, 'TARGET が remove へ').toContain('TARGET');
    expect(s.players.opp.scene.map((c) => c.cardId), '敵陣 OPPT 据置 (選ばなかった)').toEqual(['OPPT']);
  });

  it('S2 0-pick (「1枚まで」= 0選択可): pick skip → 何も removal されない', () => {
    const s = runA1({
      owner: 'self', partner: 'PY', turn: 'self', leaveCardId: 'NAGANO',
      selfScene: ['TARGET'], oppScene: [], script: ['pick:skip'],
    });
    expect(s.players.self.scene.map((c) => c.cardId).sort(), 'skip → TARGET 残存').toEqual(['B05087', 'TARGET']);
    expect(s.players.self.remove, 'TARGET は removal されず (NAGANO は離脱済)').not.toContain('TARGET');
  });

  it('S3 trigger decoy: 非-長野県警 (OTHER) 離脱 → removeExitMatches 不一致 → 発火せず (pick 無し)', () => {
    const s = runA1({
      owner: 'self', partner: 'PY', turn: 'self', leaveCardId: 'OTHER',
      selfScene: ['TARGET'], oppScene: [], script: [], // 発火しないので script 空 (surface すれば over-script throw)
    });
    expect(s.players.self.scene.map((c) => c.cardId).sort(), 'TARGET 据置 (a1 不発火)').toEqual(['B05087', 'TARGET']);
  });

  it('S4 condition off (パートナー青): 長野県警 離脱でも partnerColor黄 不成立 → 発火せず', () => {
    const s = runA1({
      owner: 'self', partner: 'PBLUE', turn: 'self', leaveCardId: 'NAGANO',
      selfScene: ['TARGET'], oppScene: [], script: [],
    });
    expect(s.players.self.scene.map((c) => c.cardId).sort(), 'TARGET 据置 (青P → a1 不発火)').toEqual(['B05087', 'TARGET']);
  });

  it('S6 owner=opp (BUG-174): opp の B05087 が opp ターンに 長野県警 離脱 → opp の TARGET を removal (owner 反転せず)', () => {
    // a1 = sceneRemove (PA 短縮形)。runtime atom-handler で resolvePlayer(owner-relative) 解決 →
    // opp 所有でも player:self=opp / side:either が正しく opp 相対に写る。BUG-174 反転が無いことを pin。
    setHuman('opp');
    const s = runA1({
      owner: 'opp', partner: 'PY', turn: 'opp', leaveCardId: 'NAGANO',
      selfScene: ['TARGET'], oppScene: [], script: [{ pickCardIds: ['TARGET'] }],
    });
    expect(s.players.opp.scene.map((c) => c.cardId).sort(), 'opp TARGET removal (opp B05087 残)').toEqual(['B05087']);
    expect(s.players.opp.remove, 'opp TARGET が opp remove へ').toContain('TARGET');
    expect(s.players.self.scene.length, 'self 盤面は無関係 (owner 反転せず)').toBe(0);
  });
});

// ---- a2 (phase:end:start → handAddFromRemove + 条件付き discard) ----
describe('B05087 a2 phase:end:start【自ターン終了時】長野県警(lvl≤6) 回収 + 手札6枚以上で1枚 discard', () => {
  // a2 は partner色 gate 無し (turn:self のみ)。partner非黄 で a1 cascade を isolate。
  function runA2(opts: {
    owner: Player; turn: Player; emitPlayer: Player;
    remove: string[]; hand: string[];
    script: ScriptAction[];
  }): GameState {
    const b = createEmptyGameState();
    b.turn = { number: 5, player: opts.turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    b.players[opts.owner].remove = [...opts.remove];
    b.players[opts.owner].hand = [...opts.hand];
    b.players[opts.owner].deck = ['F1', 'F2', 'F3', 'F4'];
    return produce(b, (d: GameState) => {
      mutate.scene.enter(d, opts.owner, 'B05087', {});
      event.emit(d, 'phase:end:start', { player: opts.emitPlayer }, undefined);
      runAllUntilEmpty(d);
      drainScript(d, opts.script);
    }) as GameState;
  }

  it('S5 happy: remove から lvl≤6 長野県警 のみ回収候補 (NAGANO9 lvl9 / OTHER 除外) → 手札5→6 → discard 1枚 (conditional-on)', () => {
    const b = createEmptyGameState();
    b.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    b.players.self.remove = ['NAGANO6', 'NAGANO9', 'OTHER'];
    b.players.self.hand = ['F1', 'F2', 'F3', 'F4', 'F5']; // 5枚
    let addCands: string[] = [];
    const s = produce(b, (d: GameState) => {
      mutate.scene.enter(d, 'self', 'B05087', {});
      event.emit(d, 'phase:end:start', { player: 'self' }, undefined);
      runAllUntilEmpty(d);
      // 1) handAddFromRemove pick — 候補確認
      const add = _drainPendingEffectPickSide();
      expect(add, 'a2 handAddFromRemove pick surface').not.toBeNull();
      addCands = (add!.candidates as Array<{ cardId: string }>).map((c) => c.cardId).sort();
      const uids = add!.candidates as Array<{ uid: string; cardId: string }>;
      const hit = uids.find((c) => c.cardId === 'NAGANO6')!;
      applyPickAndContinuation(d, add!, hit.uid, [hit.uid]);
      runAllUntilEmpty(d);
      // 2) 手札6枚 → discard pick (F1 を捨てる)
      const disc = _drainPendingEffectPickSide();
      expect(disc, '手札6枚以上 → discard pick surface').not.toBeNull();
      expect(disc!.atomVerb, 'discard verb').toBe('discard');
      const du = disc!.candidates as Array<{ uid: string; cardId: string }>;
      const f1 = du.find((c) => c.cardId === 'F1')!;
      applyPickAndContinuation(d, disc!, f1.uid, [f1.uid]);
      runAllUntilEmpty(d);
    }) as GameState;
    expect(addCands, 'add 候補は lvl≤6 長野県警 のみ (NAGANO9/OTHER 除外)').toEqual(['NAGANO6']);
    expect(s.players.self.hand.slice().sort(), 'NAGANO6 加入 + F1 discard → F2..F5+NAGANO6').toEqual(['F2', 'F3', 'F4', 'F5', 'NAGANO6']);
    expect(s.players.self.remove, 'F1 が discard で remove へ').toContain('F1');
    expect(s.players.self.remove, 'NAGANO6 は remove から離脱').not.toContain('NAGANO6');
  });

  it('S7 conditional off (手札<6): 手札2 + NAGANO6 回収 → 3枚 (<6) → discard 無し (discard pick 非 surface)', () => {
    setHuman('self');
    const s = runA2({
      owner: 'self', turn: 'self', emitPlayer: 'self',
      remove: ['NAGANO6', 'OTHER'], hand: ['F1', 'F2'],
      script: [{ pickCardIds: ['NAGANO6'] }], // discard は surface しない (over-script なら throw で検出)
    });
    expect(s.players.self.hand.slice().sort(), '手札 = F1,F2,NAGANO6 (3枚, discard 無し)').toEqual(['F1', 'F2', 'NAGANO6']);
    expect(s.players.self.remove, 'NAGANO6 は remove から離脱').not.toContain('NAGANO6');
    expect(s.players.self.remove, 'OTHER (非-長野県警) は remove に残存 = 候補外').toContain('OTHER');
  });

  // ⚠ KNOWN ENGINE GAP (BUG-174 class): a2 の handAddFromRemove は PB 短縮形 pick。owner=opp のとき
  //   resolve-picks.ts:310 の pre-walk が `p = args.player ?? 'self'` を **絶対 side 'self'** で解決し
  //   (resolvePlayer を経由しない owner-relative 化漏れ)、opp 所有 B05087 の a2 が **相手 (self) の
  //   リムーブエリア** を候補列挙する。opp 自身の remove にある NAGANO6 は回収されず、a1 (PA 短縮形、
  //   runtime atom-handler で resolvePlayer 済) の owner-relative 挙動と非対称。a1 owner=opp は S6 で PASS。
  //   ここでは反転バグの現状挙動 (opp 所有時に opp remove から回収**されない**) を pin してリグレッション検出する。
  it('S8 owner=opp a2 は engine 反転バグで opp remove を回収できない (KNOWN GAP を pin)', () => {
    setHuman('opp');
    const s = runA2({
      owner: 'opp', turn: 'opp', emitPlayer: 'opp',
      remove: ['NAGANO6', 'OTHER'], hand: ['F1', 'F2'],
      script: [], // a2 の add pick は opp remove を見ない → cands 0 (self remove 空) → 何も surface しない
    });
    // 反転バグの現状: opp remove から NAGANO6 が回収されない (bug が直れば ['F1','F2','NAGANO6'] になる)。
    expect(s.players.opp.hand.slice().sort(), 'opp 手札 不変 (NAGANO6 未回収 = 反転バグ現状)').toEqual(['F1', 'F2']);
    expect(s.players.opp.remove, 'opp remove に NAGANO6 が残存 (回収されず)').toContain('NAGANO6');
  });

  // add-gate 実証 (review lens PLAUSIBLE 反証): chain step1 (handAddFromRemove) の候補が 0 枚 →
  //   chainStepNoApply で chain が step1 停止 → 後段 conditional{手札6枚以上→discard} に到達しない。
  //   印字「カードを手札に加え、自分の手札が6枚以上ある場合、手札を1枚リムーブする」の add-gate:
  //   「加える」が成立しなければ discard 判定に入らない (手札6枚あっても discard しない) を挙動で pin。
  it('S9 add-gate: リムーブに 長野県警 候補 0枚 + 手札6枚以上 → chain step1 0-add で停止, discard 発生せず (手札6枚のまま)', () => {
    setHuman('self');
    const s = runA2({
      owner: 'self', turn: 'self', emitPlayer: 'self',
      remove: ['OTHER'],                                     // 非-長野県警 のみ → handAddFromRemove 候補 0 枚
      hand: ['F1', 'F2', 'F3', 'F4', 'F5', 'TARGET'],        // 6 枚 (discard 判定の閾値は満たす)
      script: [],                                            // add pick も discard pick も surface しない (surface すれば over-script throw)
    });
    // chain が step1 の 0-add で停止 → discard に到達せず → 手札 6 枚のまま不変。
    expect(s.players.self.hand.slice().sort(), '手札 6 枚のまま (add も discard も無し)').toEqual(['F1', 'F2', 'F3', 'F4', 'F5', 'TARGET']);
    expect(s.players.self.hand.length, '手札枚数 6 (discard で 5 に減らない)').toBe(6);
    expect(s.players.self.remove, 'remove は OTHER のみ (discard で手札が流入していない)').toEqual(['OTHER']);
  });
});
