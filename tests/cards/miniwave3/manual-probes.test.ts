// tests/cards/miniwave3/manual-probes — 手書き probe (gen-card-probes.cjs が "no supported ability" 扱いのカード)
//   production emit 経路で駆動する (batch5 manual-probes B09002 a2 の phase:end:start 慣行)。
//   engine / src/cards は変更しない (probe のみ)。
//
// 対象: B03110 ジン (character) a1
//   trigger: phase:end:start / condition: and[ partnerColor黒, turn:self ]
//   effect:  optional{ chain[ filePopToHand(n:2, gate:true) → discard(n:2) → forEach(scene 両側 excludeSelf) sceneRemove ] }
//   公式: 【パートナー黒】自分のターン終了時、自分のFILEエリアにあるカードを上から2枚手札に加えてもよい。
//         そうした場合、手札を2枚リムーブし、このキャラ以外のすべてのキャラをリムーブする。
//
// 駆動: filePopToHand → mutate.file.popTop が Immer current() を呼ぶため、駆動+drain を produce() draft 内で
//   実行する (setAutoFreeze(false) で produce 出力を可変化する miniwave2 慣行と同流儀。ただし本カードは popTop が
//   optional continuation 中に走るため、emit+drain 全体を単一 produce で包む)。
// rules: 03/05/13/15/17
//
// 検証:
//   positive: 黒P + 自ターン + FILE≥2 + optional take → FILE-2→手札 / 手札2枚 discard / このキャラ以外の全キャラ
//             (自陣・敵陣とも) をリムーブ (B03110 のみ現場に残る)。
//   negative(a) optional decline → 何も起きない。
//   negative(b) FILE 1枚 → gate (all-or-nothing) → chain break: FILE 不変・discard 無し・全キャラ据置。
//   negative(c) パートナー青 → condition 不成立 → 不発火。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce, setAutoFreeze } from 'immer';
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
import { B03110 } from '@/cards/ct-p03/B03110';
import type { CardDef, GameState } from '@/engine/types';

function charDef(id: string): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黒'], level: 1, ap: 2000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}
function partnerDef(id: string, colors: string[]): CardDef {
  return { id, no: id, kind: 'partner', names: [id], colors, level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

const M1 = charDef('M1');   // 自陣の別キャラ (B03110 以外)
const OPP1 = charDef('OPP1'); // 敵陣キャラ
const OPP2 = charDef('OPP2'); // 敵陣キャラ
const H1 = charDef('H1'), H2 = charDef('H2'), H3 = charDef('H3'); // 手札 (discard 弾)
const DK = charDef('DK');
const PB = partnerDef('PB', ['黒']);   // パートナー黒 (condition 成立)
const PBLUE = partnerDef('PBLUE', ['青']); // パートナー青 (condition 不成立)
const FIXTURES = [M1, OPP1, OPP2, H1, H2, H3, DK, PB, PBLUE];

function setHuman(s: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
}

// pick(単/複)/optional を drain する汎用ループ。
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
    const choice = _drainPendingEffectChoiceSide();
    if (choice) throw new Error('unexpected choice surfaced');
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

// base 盤面 + 駆動 (emit phase:end:start) + drain を単一 produce draft 内で実行し、finalize した state を返す。
//   filePopToHand の popTop が current() を呼ぶため draft 必須。selfExtra/oppExtra で追加キャラを置く。
function run(opts: {
  turn: 'self' | 'opp';
  partner: string;
  fileN: number;
  selfExtra: string[];
  oppExtra: string[];
  emitPlayer: 'self' | 'opp';
  script: ScriptAction[];
}): GameState {
  const b = createEmptyGameState();
  b.turn = { number: 5, player: opts.turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  b.players.self.partner.cardId = opts.partner;
  b.players.self.deck = ['DK', 'DK', 'DK', 'DK'];
  b.players.opp.deck = ['DK', 'DK'];
  b.players.self.hand = ['H1', 'H2', 'H3'];
  b.players.self.file = Array.from({ length: opts.fileN }, () => ({ type: 'card-back', cardId: 'DK' })) as GameState['players']['self']['file'];
  return produce(b, (d: GameState) => {
    mutate.scene.enter(d, 'self', 'B03110', {});
    for (const c of opts.selfExtra) mutate.scene.enter(d, 'self', c, {});
    for (const c of opts.oppExtra) mutate.scene.enter(d, 'opp', c, {});
    event.emit(d, 'phase:end:start', { player: opts.emitPlayer }, undefined);
    runAllUntilEmpty(d);
    drainScript(d, opts.script);
  }) as GameState;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  const g = globalThis as { __pendingEffectOptionalResume?: unknown; __pendingEffectOptionalBindings?: unknown };
  g.__pendingEffectOptionalResume = null;
  g.__pendingEffectOptionalBindings = null;
  registerCardDef(B03110);
  for (const f of FIXTURES) registerCardDef(f);
  registerTriggeredListener();
  setHuman('self');
  setAutoFreeze(false);
});

describe('B03110 ジン a1 phase:end:start【パートナー黒】【自ターン】→ FILE2手札 + 2discard + 自身以外全キャラ removal', () => {
  it('positive: 黒P + 自ターン終了 + FILE2 + take → FILE-2 が手札 / 2枚 discard / B03110 以外の全キャラ (両陣) リムーブ', () => {
    const s = run({
      turn: 'self', partner: 'PB', fileN: 2, selfExtra: ['M1'], oppExtra: ['OPP1', 'OPP2'],
      emitPlayer: 'self', script: ['optional:take', { pickCardIds: ['H1', 'H2'] }],
    });
    // FILE 2枚が手札へ (DK×2 追加) → discard で H1,H2 をリムーブ → 手札は H3 + DK,DK
    expect(s.players.self.file.length, 'FILE から2枚 pop').toBe(0);
    expect(s.players.self.hand.slice().sort(), '手札 = H3 + 追加DK×2 (H1/H2 は discard)').toEqual(['DK', 'DK', 'H3']);
    expect(s.players.self.remove, 'H1 を discard').toContain('H1');
    expect(s.players.self.remove, 'H2 を discard').toContain('H2');
    // このキャラ (B03110) 以外の全キャラをリムーブ — 両陣
    expect(s.players.self.scene.map((c) => c.cardId), '自陣は B03110 のみ残る').toEqual(['B03110']);
    expect(s.players.opp.scene.length, '敵陣は全滅').toBe(0);
    expect(s.players.self.remove, '自陣 M1 リムーブ').toContain('M1');
    expect(s.players.opp.remove, '敵陣 OPP1 リムーブ').toContain('OPP1');
    expect(s.players.opp.remove, '敵陣 OPP2 リムーブ').toContain('OPP2');
  });

  it('negative(a): optional decline → FILE/手札/現場すべて不変 (何も起きない)', () => {
    const s = run({
      turn: 'self', partner: 'PB', fileN: 2, selfExtra: ['M1'], oppExtra: ['OPP1'],
      emitPlayer: 'self', script: ['optional:decline'],
    });
    expect(s.players.self.file.length, 'FILE 不変').toBe(2);
    expect(s.players.self.hand.slice().sort(), '手札 不変').toEqual(['H1', 'H2', 'H3']);
    expect(s.players.self.scene.map((c) => c.cardId).sort(), '自陣 不変 (B03110/M1)').toEqual(['B03110', 'M1']);
    expect(s.players.opp.scene.map((c) => c.cardId), '敵陣 不変').toEqual(['OPP1']);
    expect(s.players.self.remove.length, '自 remove 空').toBe(0);
    expect(s.players.opp.remove.length, '敵 remove 空').toBe(0);
  });

  it('negative(b): FILE 1枚 + take → filePopToHand gate (all-or-nothing) → chain break: FILE不変・discard無し・全キャラ据置', () => {
    const s = run({
      turn: 'self', partner: 'PB', fileN: 1, selfExtra: ['M1'], oppExtra: ['OPP1'],
      emitPlayer: 'self', script: ['optional:take'],
    });
    // gate 失敗 (poppable 1 < 2) → 何も pop せず chain break。FILE も手札も現場も不変。
    expect(s.players.self.file.length, 'FILE 不変 (gate で pop されない)').toBe(1);
    expect(s.players.self.hand.slice().sort(), '手札 不変 (FILE 追加も discard も無い)').toEqual(['H1', 'H2', 'H3']);
    expect(s.players.self.remove.length, 'discard されていない (自 remove 空)').toBe(0);
    expect(s.players.self.scene.map((c) => c.cardId).sort(), '自陣 据置 (removal 走らない)').toEqual(['B03110', 'M1']);
    expect(s.players.opp.scene.map((c) => c.cardId), '敵陣 据置').toEqual(['OPP1']);
  });

  it('negative(c): パートナー青 → condition(partnerColor黒) 不成立 → 不発火 (optional surface なし)', () => {
    const s = run({
      turn: 'self', partner: 'PBLUE', fileN: 2, selfExtra: ['M1'], oppExtra: ['OPP1'],
      emitPlayer: 'self', script: [],
    });
    // 発火しないので何も変わらない (drain script 空で over-script も起きない = optional 非 surface の証左)
    expect(s.players.self.file.length, 'FILE 不変').toBe(2);
    expect(s.players.self.scene.map((c) => c.cardId).sort(), '自陣 不変').toEqual(['B03110', 'M1']);
    expect(s.players.opp.scene.map((c) => c.cardId), '敵陣 不変').toEqual(['OPP1']);
  });
});
