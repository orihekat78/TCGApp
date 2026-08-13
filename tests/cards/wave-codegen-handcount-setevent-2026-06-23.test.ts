// wave codegen-handcount-setevent (2026-06-23) — engine変更0 / 全部手書き
//
// 検証対象 (4 ファイル):
//   B07069/P 本堂瑛海 — a1:【パートナー赤】declared lv≤8 remove (gate handAtMost2) /
//     a2:【FILE8】declared pay[sleepSelf,removeFromHand,fileFrom] → リムーブから lv≤7赤キャラ登場。
//   PR099 工藤有希子 — a1 登場時セット+突撃、後続waveで a2 制約付きキャラ名置換も解禁。
//   B05030 遠山銀司郎 — 印字 突撃[キャラ] + a1:【登場時】デッキ上端裏向きセット (a2 DEFER=setCount dyn gap)。
//
// engine変更0: charSetCard{fromDeckTop} (B03061/B07034) / sceneEnter from:remove filter (B01076/D11014) /
//   charGrantKeyword 突撃[キャラ] scope:'turn' (D09027) / sceneRemove levelMax (B07067) の settled path 再録。
// DEFER (DEFERRED-INDEX §codegen-handcount-setevent): B07065 (MR+複数名) / B07068 (entered-char binding gap) /
//   B07100 (opp-hand reveal/removal gap) / PR099 a2 (任意 card名 rewrite verb なし) / B05030 a2 (setCardCount dyn token なし) /
//   B05035 (遠山和葉 全体: charSetCard host-absent 共有 engine 順序バグ BUG-153 / 公式Q&A『離場時はデッキ上に戻す』未充足)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { read } from '@/engine/read/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../helpers/fixtures';
import { B07069 } from '@/cards/ct-p07/B07069';
import { B07069P } from '@/cards/ct-p07/B07069P';
import { PR099 } from '@/cards/pr-01/PR099';
import { B05030 } from '@/cards/ct-p05/B05030';
import type { CardDef, GameState } from '@/engine/types';

// ---- synthetic decoy defs (prefix DEC_ で id 衝突回避) ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
function ev(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: ['赤'],
    level: 4, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

// B07069 a2 revive (filter color赤/levelMax7/kind character) 用 decoy 群
const AKA_OK = 'DEC_AKA_OK';     // 赤 L5 character → match
const AKA_L8 = 'DEC_AKA_L8';     // 赤 L8 character → level decoy
const AO_OK = 'DEC_AO';          // 青 L5 character → color decoy
const AKA_EV = 'DEC_AKA_EV';     // 赤 L5 event → kind decoy
// B07069 a1 sceneRemove (levelMax8) 用 decoy
const REM_OK = 'DEC_REM_OK';     // L6 character → match (≤8)
const REM_L9 = 'DEC_REM_L9';     // L9 character → level decoy
// PR099/B05030 set-facedown deck filler
const FILLER = 'DEC_FILLER';     // 汎用 set 対象 / 山札 filler

function registerDecoys(): void {
  registerCardDef(ch(AKA_OK, { names: ['工藤優作'], colors: ['赤'], level: 5 }));
  registerCardDef(ch(AKA_L8, { names: ['赤井秀一'], colors: ['赤'], level: 8 }));
  registerCardDef(ch(AO_OK, { names: ['江戸川コナン'], colors: ['青'], level: 5 }));
  registerCardDef(ev(AKA_EV, { names: ['赤イベント'], colors: ['赤'], level: 5 }));
  registerCardDef(ch(REM_OK, { names: ['白鳥任三郎'], colors: ['赤'], level: 6 }));
  registerCardDef(ch(REM_L9, { names: ['ジン'], colors: ['赤'], level: 9 }));
  registerCardDef(ch(FILLER, { names: ['フィラー'], colors: ['緑'], level: 1 }));
}

const selfTurn = (): GameState => {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
};

describe('wave codegen-handcount-setevent — engine変更0 / 手書き5枚', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ============================================================
  // B07069 本堂瑛海
  // ============================================================
  it('B07069 a2: リムーブから 赤L5(AKA_OK) を登場 / 赤L8・青L5・赤event は filter で除外', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar('B07069', 'hondo#1')]; // host (effect の useDeclaredAbility 用)
    s.players.self.remove = [AKA_OK, AKA_L8, AO_OK, AKA_EV];
    s = produce(s, (d) => {
      useDeclaredAbility(d, 'hondo#1', 'a2'); // a2 effect (sceneEnter from:remove) を queue
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    const ids = s.players.self.scene.map((c) => c.cardId);
    expect(ids, '赤L5 AKA_OK が登場').toContain(AKA_OK);
    expect(s.players.self.remove, 'AKA_OK はリムーブから抜けた').not.toContain(AKA_OK);
    expect(ids, '赤L8 は levelMax7 で除外').not.toContain(AKA_L8);
    expect(ids, '青L5 は color赤 で除外').not.toContain(AO_OK);
    expect(ids, '赤event は kind:character で除外').not.toContain(AKA_EV);
    expect(s.players.self.remove, '除外 3枚はリムーブに残る').toEqual(expect.arrayContaining([AKA_L8, AO_OK, AKA_EV]));
  });

  it('B07069 a1: sceneRemove は levelMax8 — 相手 L6(REM_OK) を除去 / L9(REM_L9) は残す', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar('B07069', 'hondo#1')]; // host
    s.players.opp.scene = [sceneChar(REM_OK, 'rem-ok#1'), sceneChar(REM_L9, 'rem-l9#1')];
    s = produce(s, (d) => {
      useDeclaredAbility(d, 'hondo#1', 'a1'); // a1 effect (sceneRemove levelMax8) を queue
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    const oppIds = s.players.opp.scene.map((c) => c.cardId);
    expect(oppIds, 'L6 は levelMax8 で除去対象').not.toContain(REM_OK);
    expect(oppIds, 'L9 は levelMax8 超で残存').toContain(REM_L9);
  });

  it('B07069 descriptor: a1=declared and[partnerColor赤,handAtMost2] / a2=declared fileAtLeast8 pay[sleepSelf,removeFromHand,fileFrom] → sceneEnter from:remove', () => {
    const [a1, a2] = B07069.abilities;
    expect(a1.type).toBe('declared');
    expect(a1.limit).toEqual({ kind: 'turn', n: 1 });
    expect(a1.condition).toEqual({ kind: 'and', cs: [{ kind: 'partnerColor', color: '赤' }, { kind: 'handAtMost', player: 'self', n: 2 }] });
    expect((a1.effect as any)).toMatchObject({ verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { levelMax: 8 } } });
    expect(a2.type).toBe('declared');
    expect(a2.condition).toEqual({ kind: 'fileAtLeast', n: 8 });
    expect((a2.cost as any).items.map((i: any) => i.kind)).toEqual(['sleepSelf', 'removeFromHand', 'fileFrom']);
    expect((a2.effect as any).args).toMatchObject({ from: 'remove', max: 1, viaEffect: true, filter: { color: '赤', levelMax: 7, kind: 'character' } });
    // parallel: B07069P は能力同一
    expect(B07069P.abilities).toEqual(B07069.abilities);
  });

  // ============================================================
  // PR099 工藤有希子 (a1 + a2 fully faithful)
  // ============================================================
  it('PR099 a1: デッキ上端を裏向きでこのキャラにセット + ターン終了時まで突撃[キャラ] 付与', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar('PR099', 'yukiko#1')];
    s.players.self.deck = [FILLER, AKA_OK]; // 上端 FILLER がセット対象
    s = produce(s, (d) => {
      runEffect(d, PR099.abilities[0].effect as never, { source: { cardId: 'PR099', uid: 'yukiko#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as never);
    });
    const host = s.players.self.scene.find((c) => c.uid === 'yukiko#1')!;
    expect(host.setCards?.length, 'デッキ上端1枚を裏向きセット').toBe(1);
    expect(s.players.self.deck, 'セットしたカードはデッキから抜けた').not.toContain(FILLER);
    expect(read.char.keywords(s, 'yukiko#1'), 'ターン終了時まで突撃[キャラ] 付与').toContain('突撃[キャラ]');
  });

  it('PR099 descriptor: enter sequence + constrained optional name rewrite', () => {
    expect(PR099.abilities.length).toBe(2);
    const a1 = PR099.abilities[0];
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    const steps = (a1.effect as any).steps;
    expect(steps[0]).toMatchObject({ verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false } });
    expect(steps[1]).toMatchObject({ verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } });
    const a2Steps = (PR099.abilities[1]!.effect as any).steps;
    expect(a2Steps[0]).toMatchObject({ verb: 'charModifyAP', args: { delta: 1000, scope: 'turn' } });
    expect(a2Steps[1]).toMatchObject({
      verb: 'declareName',
      args: { optional: true, domain: 'registered-character-card-name' },
    });
    expect(a2Steps[2]).toMatchObject({ verb: 'charSetTurnEffect', args: { key: 'nameOverride' } });
  });

  // ============================================================
  // B05030 遠山銀司郎 (fully faithful: 印字突撃[キャラ] + a1 set-facedown + a2 set数AP)
  // ============================================================
  it('B05030 a1: デッキ上端を裏向きでこのキャラにセット / 印字 突撃[キャラ] を持つ', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar('B05030', 'ginshiro#1')];
    s.players.self.deck = [FILLER, AKA_OK];
    s = produce(s, (d) => {
      runEffect(d, B05030.abilities[0].effect as never, { source: { cardId: 'B05030', uid: 'ginshiro#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as never);
    });
    const host = s.players.self.scene.find((c) => c.uid === 'ginshiro#1')!;
    expect(host.setCards?.length, 'デッキ上端1枚を裏向きセット').toBe(1);
    expect(s.players.self.deck, 'セットしたカードはデッキから抜けた').not.toContain(FILLER);
    expect(read.char.keywords(s, 'ginshiro#1'), '印字 突撃[キャラ] を持つ').toContain('突撃[キャラ]');
  });

  it('B05030 descriptor: 印字 keywords=[突撃[キャラ]] / a1 enter charSetCard + a2 setCount AP (session64 解禁)', () => {
    expect(B05030.keywords, '無条件印字 突撃[キャラ]').toEqual(['突撃[キャラ]']);
    // session64: a2 (setCardCount dyn) を additive 解禁 → fully faithful (a1 enter-set + a2 継続 AP)。
    expect(B05030.abilities.length, 'a1 enter-set + a2 setCount AP').toBe(2);
    const a1 = B05030.abilities[0];
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    expect((a1.effect as any)).toMatchObject({ verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false } });
  });
});
