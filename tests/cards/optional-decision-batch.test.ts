// engine-extension optional-decision batch (2026-06-06 タスクC) — 「〜してもよい」(Effect kind:'optional')
// の pendingEffectOptional 機構 + B05019 中道和志 を実カード経由で検証。
//
// 検証:
//   - human (humanChooser=true) のとき optional が pendingEffectOptional として surface し、盤面は未変更で pause。
//   - applyOptionalAndContinuation(run=true) で内部 effect (self-remove → LP pick) が実行される。
//   - applyOptionalAndContinuation(run=false) で skip (盤面未変更)。
//   - AI (humanChooser=false) のとき optional は surface せず skip。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { doReasoning } from '@/engine/flow/main/reasoning';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import {
  _peekPendingEffectOptionalSide,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { char as readChar } from '@/engine/read/char';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B05019 } from '@/cards/ct-p05/B05019';
import type { GameState, CardDef } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';


const KOGORO: CardDef = {
  id: 'KOGORO_T', no: 'NO', kind: 'character', names: ['毛利小五郎'], colors: ['青'],
  level: 4, ap: 4000, lp: 1, traits: ['探偵'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const LP0: CardDef = {
  id: 'LP0_T', no: 'NO', kind: 'character', names: ['LP0キャラ'], colors: ['青'],
  level: 5, ap: 5000, lp: 0, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const LP1: CardDef = {
  id: 'LP1_T', no: 'NO', kind: 'character', names: ['LP1キャラ'], colors: ['青'],
  level: 5, ap: 5000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

function setHuman(side: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = side;
}

function buildState(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  // 中道和志 (反応元) + 毛利小五郎 (推理する) + LP0キャラ (LP+1 対象) + LP1キャラ (decoy)
  s.players.self.scene = [
    sceneChar('B05019', 'nakamichi#1'),
    sceneChar('KOGORO_T', 'kog#1'),
    sceneChar('LP0_T', 'lp0#1'),
    sceneChar('LP1_T', 'lp1#1'),
  ];
  s.players.self.deck = ['D08005']; // 推理 LP1 で 1 枚消費
  return s;
}

describe('engine-extension optional-decision batch (2026-06-06)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    registerCardDef(KOGORO);
    registerCardDef(LP0);
    registerCardDef(LP1);
    _clearPendingEffectOptionalSide();
    _clearPendingEffectPickQueue();
    setHuman(null);
  });

  it('card def: optional 効果 (trigger=reasoning:end + triggerCharMatches self 毛利小五郎)', () => {
    expect(B05019.abilities[0].trigger).toMatchObject({
      hook: 'reasoning:end',
      matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { cardName: '毛利小五郎' } },
    });
    expect(B05019.abilities[0].effect).toMatchObject({ kind: 'optional' });
  });

  it('human: [毛利小五郎] 推理で optional が surface (盤面未変更で pause)', () => {
    setHuman('self');
    let s: GameState = buildState();
    s = produce(s, (d) => { doReasoning(d, 'kog#1'); runAllUntilEmpty(d); });
    const pending = _peekPendingEffectOptionalSide();
    expect(pending, 'pendingEffectOptional が surface').not.toBeNull();
    expect(pending!.source, 'source = B05019 / a1 / 中道和志 uid').toMatchObject({
      cardId: 'B05019', abilityId: 'a1', uid: 'nakamichi#1',
    });
    // pause 中は盤面未変更 (中道和志 in scene、LP0 不変)
    expect(s.players.self.scene.find((c) => c.uid === 'nakamichi#1'), '中道和志 はまだ現場に').toBeTruthy();
    expect(readChar.lp(s, 'lp0#1'), 'LP0 はまだ未加算 (0)').toBe(0);
  });

  it('human → する (run:true): 中道和志 リムーブ + LP0キャラに LP+1 / LP1 decoy 不変', () => {
    setHuman('self');
    const policy = new HeuristicPolicy();
    let s: GameState = buildState();
    s = produce(s, (d) => {
      doReasoning(d, 'kog#1');
      runAllUntilEmpty(d);
      const pending = _peekPendingEffectOptionalSide();
      applyOptionalAndContinuation(d, pending!, true);
      drainAiEffectPicks(d, policy); // 内部 LP pick を解決
    });
    expect(s.players.self.scene.find((c) => c.uid === 'nakamichi#1'), '中道和志 はリムーブされた').toBeFalsy();
    expect(readChar.lp(s, 'lp0#1'), 'LP0キャラに LP+1 (0→1)').toBe(1);
    expect(readChar.lp(s, 'lp1#1'), 'LP1 decoy は不変 (LP0 のみ対象)').toBe(1);
  });

  it('human → しない (run:false): 何も起こらない (中道和志 残存・LP0 不変)', () => {
    setHuman('self');
    let s: GameState = buildState();
    s = produce(s, (d) => {
      doReasoning(d, 'kog#1');
      runAllUntilEmpty(d);
      const pending = _peekPendingEffectOptionalSide();
      applyOptionalAndContinuation(d, pending!, false);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'nakamichi#1'), '中道和志 は残る').toBeTruthy();
    expect(readChar.lp(s, 'lp0#1'), 'LP0 は不変 (0)').toBe(0);
  });

  it('AI (humanChooser=false): optional は surface せず skip (中道和志 残存・LP0 不変)', () => {
    setHuman(null); // AI 経路
    const policy = new HeuristicPolicy();
    let s: GameState = buildState();
    s = produce(s, (d) => { doReasoning(d, 'kog#1'); runAllUntilEmpty(d); drainAiEffectPicks(d, policy); });
    expect(_peekPendingEffectOptionalSide(), 'AI は optional を surface しない').toBeNull();
    expect(s.players.self.scene.find((c) => c.uid === 'nakamichi#1'), '中道和志 は残る (AI skip)').toBeTruthy();
    expect(readChar.lp(s, 'lp0#1'), 'LP0 は不変 (AI skip)').toBe(0);
  });
});
