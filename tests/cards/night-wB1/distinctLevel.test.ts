// tests/cards/night-wB1/distinctLevel — Cluster WB1: TargetQuery.distinctLevel (「それぞれレベルの異なる」)
//   B09105「キッ」の deploy 用 primitive。distinctNames のレベル軸版 = 同型 3経路
//   (resolve validate / chooseAiPick greedy / UI disabled) + pending 伝播。
//   ※ B09105 の card 化は別 gap (fileRemoveTop の exact-N chain-break、本 wave 対象外) 待ち。
// rules: 15 (「〜まで」=0可), 19-special-rules (それぞれ異なる 制約軸)。
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { resolve } from '@/engine/target/resolve';
import { candidates } from '@/engine/target/candidates';
import { makeCtx } from '../../helpers/fixtures';
import type { AbilityDef, CardDef, GameState, TargetingRef } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) =>
  ((globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s);
function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['黒'], level: 3, ap: 3000, lp: 1, traits: ['犯人'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
// remove fixtures: 犯人 lv3(×2)/lv5/lv8 + decoy (lv9 over, 非犯人)
const HANL3A = def('HANL3A', { level: 3 });
const HANL3B = def('HANL3B', { level: 3 });
const HANL5 = def('HANL5', { level: 5 });
const HANL8 = def('HANL8', { level: 8 });
const HANL9 = def('HANL9', { level: 9 });                       // decoy: levelMax8 外
const NONHAN = def('NONHAN', { level: 4, traits: ['探偵'] });   // decoy: 非犯人

// distinctLevel deploy 用の最小 declared カード (B09105 の deploy 句と同型)。
const deployAbility: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene',
  effect: {
    kind: 'atom', verb: 'sceneEnter',
    args: {
      player: 'self', from: 'remove', cardIds: '$pick.cardIds', skipResolvesAtom: true, viaEffect: true,
      target: {
        kind: 'pick',
        query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '犯人', levelMax: 8 }, distinctLevel: true },
        n: { min: 0, max: 5 }, chooser: 'self',
      },
    },
  },
  description: 'テスト用: リムーブのレベル8以下・レベル相異〚犯人〛を5枚まで登場。', ruleRefs: [],
};
const DEPLOYER: CardDef = { id: 'DEPLOYER', no: 'DEPLOYER', kind: 'character', names: ['配備'], colors: ['黒'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [deployAbility], ruleRefs: [] };
const ALL_DEFS = [DEPLOYER, HANL3A, HANL3B, HANL5, HANL8, HANL9, NONHAN];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK1', 'DK2'];
  return s;
}
beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  setHuman('self');
  for (const d of ALL_DEFS) registerCardDef(d);
  registerTriggeredListener();
});

describe('distinctLevel — resolve() validate (rules/19 軸)', () => {
  const ref: TargetingRef = {
    kind: 'pick',
    query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '犯人', levelMax: 8 }, distinctLevel: true },
    n: { min: 0, max: 5 },
  } as TargetingRef;
  const pickBy = (s: GameState, ...cids: string[]) => {
    const avail = candidates(s, ref, makeCtx());
    return cids.map(cid => avail.find(c => (c as { cardId?: string }).cardId === cid)!);
  };

  it('レベル相異 (3/5/8) の pick → 合法 (throw しない)', () => {
    const s = base();
    s.players.self.remove = ['HANL3A', 'HANL5', 'HANL8'];
    expect(() => resolve(s, ref, makeCtx(), pickBy(s, 'HANL3A', 'HANL5', 'HANL8'))).not.toThrow();
  });

  it('同一レベル (3/3) の pick → distinctLevel 違反で throw', () => {
    const s = base();
    s.players.self.remove = ['HANL3A', 'HANL3B'];
    expect(() => resolve(s, ref, makeCtx(), pickBy(s, 'HANL3A', 'HANL3B'))).toThrow(/distinctLevel/);
  });
});

describe('distinctLevel — pending 伝播 + 候補フィルタ (human path)', () => {
  it('sceneEnter multi deploy → pick に distinctLevel:true / 候補 = 犯人 lv8以下のみ', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'DEPLOYER', {});
    s.players.self.remove = ['HANL3A', 'HANL3B', 'HANL5', 'HANL8', 'HANL9', 'NONHAN'];
    activateDeclaredAbility(s, me.uid, 'a1');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.atomVerb, 'sceneEnter pick surface').toBe('sceneEnter');
    expect(pick!.distinctLevel, 'distinctLevel flag が pending に伝播').toBe(true);
    expect(pick!.nMax, '5枚まで').toBe(5);
    const cids = (pick!.candidates as Array<{ cardId: string }>).map(c => c.cardId).sort();
    expect(cids, '候補 = 犯人 lv8以下 (lv9/非犯人 除外)').toEqual(['HANL3A', 'HANL3B', 'HANL5', 'HANL8'].sort());
  });
});
