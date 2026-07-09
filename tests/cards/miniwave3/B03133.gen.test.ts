// tests/cards/miniwave3/B03133 — HAND-WRITTEN probe (旧 gen 版を差し替え。再生成禁止)
// ★2026-07-10 更新: 下記ヘッダの MANUAL-NOTE(BUG) 記述は authoring 時の short-form 挙動の記録 (歴史)。
//   shipped カードは cardIds contract (+B05092 は shuffleThenDrawMoved 単一 atom) に修正済みで、
//   本文の test は修正後挙動 (multi 移動 / draw=移動数) を assert している。
//
// なぜ hand-written か: gen-card-probes.cjs の ProbeScenario 語彙 (zone/handDelta/candidatesExclude…) では
//   本カードの load-bearing な検証 — 登場キャラへの 〚突撃[キャラ]〛 付与 (read.char.keywords 直読) —
//   を表現できないため。加えて gen 版は fixture に【カットイン】keyword が無く handAddFromRemove の候補が
//   0 になり over-script で失敗していた。production 経路 (handUseCard → effect:declared[event-use]) で駆動する。
//   engine / src/cards は変更しない (probe のみ)。
//
// 対象: B03133「見ィーつけた♪」(event) a1【手札からの使用/ネクストヒント時 = effect:declared kind:event-use】
//   sequence[ handAddFromRemove(remove の【カットイン】黒 lv≤6 キャラを2枚まで手札へ)
//           → sceneEnter(手札の同 filter キャラを1枚まで登場, bind $matched)
//           → charGrantKeyword($matched に 〚突撃[キャラ]〛 turn) ]
//
// ★MANUAL-NOTE(BUG, 要 card 修正): a1 の handAddFromRemove は **短縮形** ({player,max:2,filter}) で
//   authoring されているが、短縮形 handAddFromRemove は multi-select を握り潰し **1枚しか手札に加えない**
//   (bottom path が normalizeTargetToString(value[0]) で先頭のみ採用: _shared.ts:280)。カードテキストは
//   「2枚まで選び、手札に加える」なので **公式挙動 (最大2枚) と乖離**。正しい authoring は B09034/B08028 と同じ
//   明示 multi-pick contract ({ cardIds:'$pick.cardIds', target:{kind:'pick',query:{area:'remove',…},
//   n:{min:0,max:2},chooser:'self'} })。B09034 のヘッダコメントも同 BUG を明記済。
//   本 probe は「両方選んでも CI0 のみ移動」= 現状の実挙動を pin する (parent が card DSL を cardIds 形へ
//   直したら本 describe の該当 it を『2枚移動』へ更新すること)。
// rules: 03/13/15/17/20

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
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
  applyChoiceAndContinuation,
} from '@/engine/effect/apply-pick';
import { B03133 } from '@/cards/ct-p03/B03133';
import type { CardDef, GameState } from '@/engine/types';

// ---- fixtures ----
function charDef(
  id: string,
  o: { kind?: 'character' | 'event'; colors?: string[]; level?: number; keywords?: string[] } = {},
): CardDef {
  return {
    id, no: id, kind: o.kind ?? 'character', names: [id], colors: o.colors ?? ['黒'],
    level: o.level ?? 1, ap: 2000, lp: 1, traits: [], keywords: o.keywords ?? [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const CI0 = charDef('CI0', { colors: ['黒'], level: 6, keywords: ['カットイン'] }); // 適格 (境界 lv6)
const CI1 = charDef('CI1', { colors: ['黒'], level: 5, keywords: ['カットイン'] }); // 適格
const DEC_L = charDef('DEC_L', { colors: ['黒'], level: 7, keywords: ['カットイン'] });          // lv7 → levelMax6 で候補外
const DEC_C = charDef('DEC_C', { colors: ['赤'], level: 6, keywords: ['カットイン'] });          // 赤 → color黒 で候補外
const DEC_K = charDef('DEC_K', { colors: ['黒'], level: 6, keywords: ['カットイン'], kind: 'event' }); // event → kind:character で候補外
const DEC_N = charDef('DEC_N', { colors: ['黒'], level: 6, keywords: [] });                       // カットイン無し → keyword で候補外
const DK = charDef('DK', {});
const FIXTURES = [CI0, CI1, DEC_L, DEC_C, DEC_K, DEC_N, DK];

function setHuman(s: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
}

function base(remove: string[]): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.case = { ...s.players.self.case, colors: ['黒'] } as never;
  s.players.self.deck = ['DK', 'DK', 'DK', 'DK'];
  s.players.opp.deck = ['DK', 'DK', 'DK', 'DK'];
  s.players.self.file = Array.from({ length: 7 }, () => ({ type: 'card-back', cardId: 'DK' })) as GameState['players']['self']['file'];
  s.players.self.remove = [...remove];
  s.players.self.hand = ['B03133'];
  return s;
}

// pick(単/複)/optional/choice を drain する汎用ループ。multi-select は {pickCardIds:[…]} で pickedUids を渡す。
type ScriptAction =
  | 'pick:skip' | 'optional:take' | 'optional:decline'
  | { pickCardId: string } | { pickCardIds: string[] } | { choiceIndex: number };
interface Recorded { verb: string; cardIds: string[] }
function drainScript(s: GameState, script: ScriptAction[]): { recorded: Recorded[]; prompts: number } {
  const recorded: Recorded[] = [];
  let i = 0;
  let prompts = 0;
  for (let g = 0; g < 50; g++) {
    const pick = _drainPendingEffectPickSide();
    if (pick) {
      prompts++;
      const cands = (pick.candidates as Array<{ uid: string; cardId: string }>).map((c) => ({ uid: c.uid, cardId: c.cardId }));
      recorded.push({ verb: pick.atomVerb, cardIds: cands.map((c) => c.cardId) });
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
      } else if (typeof a === 'object' && 'pickCardId' in a) {
        const hit = cands.find((c) => c.cardId === a.pickCardId);
        if (!hit) throw new Error(`pickCardId ${a.pickCardId} not in ${pick.atomVerb} cands: ${cands.map((c) => c.cardId).join(',')}`);
        applyPickAndContinuation(s, pick, hit.uid);
      } else throw new Error(`pick "${pick.atomVerb}" surfaced but script action is ${JSON.stringify(a)}`);
      runAllUntilEmpty(s);
      continue;
    }
    const choice = _drainPendingEffectChoiceSide();
    if (choice) {
      prompts++;
      const a = script[i++];
      if (typeof a !== 'object' || !('choiceIndex' in a)) throw new Error(`choice surfaced but script action is ${JSON.stringify(a)}`);
      applyChoiceAndContinuation(s, choice, a.choiceIndex);
      runAllUntilEmpty(s);
      continue;
    }
    const opt = _drainPendingEffectOptionalSide();
    if (opt) {
      prompts++;
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
  return { recorded, prompts };
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B03133);
  for (const f of FIXTURES) registerCardDef(f);
  registerTriggeredListener();
  setHuman('self');
});

describe('B03133「見ィーつけた♪」a1 event-use → handAddFromRemove → sceneEnter → 突撃[キャラ] grant', () => {
  it('positive: event 使用 → handAddFromRemove 候補は【カットイン】黒 lv≤6 キャラのみ (decoy 4種 除外)、登場キャラに 突撃[キャラ] 付与', () => {
    const s = base(['CI0', 'CI1', 'DEC_L', 'DEC_C', 'DEC_K', 'DEC_N']);
    handUseCard(s, 'self', 'B03133'); // event-use → effect:declared[kind:event-use] → a1 fire
    runAllUntilEmpty(s);
    // 1. handAddFromRemove: CI0 を選ぶ (候補は CI0/CI1 のみ)。 2. sceneEnter: CI0 を登場。
    const { recorded } = drainScript(s, [{ pickCardId: 'CI0' }, { pickCardId: 'CI0' }]);
    expect(recorded[0]?.verb, 'pick#0 = handAddFromRemove').toBe('handAddFromRemove');
    expect(recorded[0]?.cardIds, 'CI0 は候補').toContain('CI0');
    expect(recorded[0]?.cardIds, 'CI1 は候補').toContain('CI1');
    expect(recorded[0]?.cardIds, 'lv7 DEC_L は levelMax6 で候補外').not.toContain('DEC_L');
    expect(recorded[0]?.cardIds, '赤 DEC_C は color黒 で候補外').not.toContain('DEC_C');
    expect(recorded[0]?.cardIds, 'event DEC_K は kind:character で候補外').not.toContain('DEC_K');
    expect(recorded[0]?.cardIds, 'カットイン無し DEC_N は keyword で候補外').not.toContain('DEC_N');
    expect(recorded[1]?.verb, 'pick#1 = sceneEnter').toBe('sceneEnter');
    // 登場したキャラに 〚突撃[キャラ]〛 が付与されている (read.char.keywords 直読)
    const ci0 = s.players.self.scene.find((c) => c.cardId === 'CI0');
    expect(ci0, 'CI0 が現場に登場').toBeTruthy();
    expect(engine.read.char.keywords(s, ci0!.uid), 'CI0 に 突撃[キャラ] 付与').toContain('突撃[キャラ]');
    expect(engine.read.char.keywords(s, ci0!.uid), '元の カットイン は保持').toContain('カットイン');
  });

  it('「2枚まで」= cardIds contract で 2 枚とも手札へ移る (short-form collapse 修正後)', () => {
    const s = base(['CI0', 'CI1']);
    handUseCard(s, 'self', 'B03133');
    runAllUntilEmpty(s);
    const { recorded } = drainScript(s, [{ pickCardIds: ['CI0', 'CI1'] }, { pickCardId: 'CI0' }]);
    expect(recorded[0]?.verb).toBe('handAddFromRemove');
    expect(s.players.self.scene.some((c) => c.cardId === 'CI0'), 'CI0 は登場').toBe(true);
    expect(s.players.self.hand, 'CI1 は手札に加わった (2枚目も移る)').toContain('CI1');
    expect(s.players.self.remove.includes('CI0'), 'CI0 は remove から抜けた').toBe(false);
    expect(s.players.self.remove.includes('CI1'), 'CI1 も remove から抜けた').toBe(false);
  });

  it('negative: リムーブが decoy のみ → handAddFromRemove 候補0 → pick 無し・登場なし・付与なし', () => {
    const s = base(['DEC_L', 'DEC_C', 'DEC_K', 'DEC_N']);
    handUseCard(s, 'self', 'B03133');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), '候補0 → pick surface しない').toBeNull();
    expect(s.players.self.scene.length, '登場キャラなし').toBe(0);
    // decoy はすべて remove に残存 (event 本体 B03133 も使用後 remove へ)
    for (const d of ['DEC_L', 'DEC_C', 'DEC_K', 'DEC_N']) {
      expect(s.players.self.remove, `${d} は remove 据置`).toContain(d);
    }
  });
});
