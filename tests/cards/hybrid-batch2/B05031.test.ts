// hybrid-batch2 probe — B05031 伊織無我 (compiler refuse-1行 hybrid)。
// novel 句 (refusedLine) = a2:
//   【宣言】【スリープ】〚リムーブエリアに移す〛：手札からレベル6以下の〚カード名［大岡紅葉］〛のキャラを
//   1枚まで登場させるか、自分のリムーブエリアにあるレベル6以下の〚カード名［大岡紅葉］〛を1枚まで選び、登場させる。
// a1 (登場時 charSetCard opp-side pick) は compiler 既製 (compiledRest) だが、B05031 の実挙動として
// 相手側 target pick を伴う (BUG-174 owner=opp target pin の唯一経路 — a2 の pick は自陣専属のため)。
//
// 検証面:
//   - a2 = declared, production dispatch (activateDeclaredAbility + runAllUntilEmpty, BUG-171)。
//     cost = sleepSelf → removeFromScene(self)。effect = choice[hand-enter | remove-enter]、
//     各 option に pick{cardName:大岡紅葉, levelMax:6, kind:character, n:0-1}。
//   - choiceIndex を costParams で指定して両 option を決定論的に踏む (AI greedy が唯一候補を pick)。
//   - decoy: lv7 大岡紅葉 / event-kind 大岡紅葉 / 別名 → 候補外 (登場しない)。
//   - negative: 候補ゼロ → 何も登場せず (n:0-1 min0 skip)、cost は支払済 (B05031 は remove へ)。
//   - a1: opp scene char (相手側 target) に opp deck top を裏向き set。自 scene decoy は候補外 (side opp)。
// rules: 15 (「〜まで」=0可), 16 (裏向きセット), 17 (【宣言】), 20 (登場は色制限外), 21 (宣言コスト全払い)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canPay } from '@/engine/cost/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue, _clearPendingEffectChoiceSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { char as readChar } from '@/engine/read/char';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../../helpers/fixtures';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { B05031 } from '@/cards/ct-p05/B05031';

const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };
const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  sceneChar(cardId, uid, { state });

function cdef(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// 大岡紅葉 候補 (lv6 char) + decoy 群
const MOMIJI = cdef('MOMIJI', { names: ['大岡紅葉'], level: 6 });
const MOMIJI7 = cdef('MOMIJI7', { names: ['大岡紅葉'], level: 7 });                 // decoy: levelMax:6 超過
const MOMIJIEV = cdef('MOMIJIEV', { names: ['大岡紅葉'], kind: 'event', level: 3 }); // decoy: kind:character 外
const OTHERCHAR = cdef('OTHERCHAR', { names: ['別ノ執事'], level: 3 });             // decoy: 別名
const OPPCHAR = cdef('OPPCHAR', { names: ['相手キャラ'] });
const SELFDECOY = cdef('SELFDECOY', { names: ['自陣decoy'] });
const FILL = cdef('FILL');
const FIXTURES = [MOMIJI, MOMIJI7, MOMIJIEV, OTHERCHAR, OPPCHAR, SELFDECOY, FILL];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  _clearPendingEffectChoiceSide();
  setHuman(null);
  registerCardDef(B05031);
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
});

// ============================================================
// a2 (novel refusedLine) — declared: cost[sleepSelf → removeFromScene] + choice[hand | remove] enter 大岡紅葉
// ============================================================
describe('B05031 a2 — 宣言: 手札 or リムーブから レベル6以下 大岡紅葉 を1枚まで登場', () => {
  // production dispatch: activateDeclaredAbility + runAllUntilEmpty (+ AI pick drain cycles、BUG-171)
  const activate = (s0: GameState, choiceIndex: 0 | 1) => produce(s0, (d) => {
    activateDeclaredAbility(d, 'io', 'a2', { choiceIndex });
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });

  it('cost gate: アクティブなら宣言コスト払える / スリープなら払えず不可 (sleepSelf コスト、rules/21)', () => {
    const cost = B05031.abilities[1].cost!;
    const mkCtx = () => ({ source: { player: 'self', uid: 'io', cardId: 'B05031', abilityId: 'a2' }, bindings: {} } as unknown as Parameters<typeof canPay>[2]);

    const active = base();
    active.players.self.scene = [sc('B05031', 'io')];
    expect(canPay(active, cost, mkCtx()), 'active → sleepSelf+removeFromScene 払える').toBe(true);

    const slept = base();
    slept.players.self.scene = [sc('B05031', 'io', 'sleep')];
    expect(canPay(slept, cost, mkCtx()), 'sleep → sleepSelf 払えず不可').toBe(false);
  });

  it('option0 (手札): レベル6以下 大岡紅葉 が手札から登場、cost で B05031 は remove へ、decoy は残る', () => {
    const s = base();
    s.players.self.scene = [sc('B05031', 'io')];
    // 手札: 候補1 (MOMIJI) + decoy 3種
    s.players.self.hand = ['MOMIJI', 'MOMIJI7', 'MOMIJIEV', 'OTHERCHAR'];
    const after = activate(s, 0);

    // cost: sleepSelf → removeFromScene(self) で B05031 は現場を離れ remove へ
    expect(after.players.self.scene.some(c => c.cardId === 'B05031'), 'B05031 は現場を離れる').toBe(false);
    expect(after.players.self.remove.includes('B05031'), 'B05031 は remove へ (removeFromScene cost)').toBe(true);
    // 大岡紅葉 (lv6) が手札から登場
    expect(after.players.self.scene.some(c => c.cardId === 'MOMIJI'), '大岡紅葉 lv6 が登場').toBe(true);
    expect(after.players.self.hand.includes('MOMIJI'), '登場した MOMIJI は手札から抜ける').toBe(false);
    // decoy は候補外 → 手札に残り登場しない
    expect(after.players.self.hand.includes('MOMIJI7'), 'lv7 decoy は手札に残る').toBe(true);
    expect(after.players.self.hand.includes('MOMIJIEV'), 'event decoy は手札に残る').toBe(true);
    expect(after.players.self.hand.includes('OTHERCHAR'), '別名 decoy は手札に残る').toBe(true);
    expect(after.players.self.scene.some(c => ['MOMIJI7', 'MOMIJIEV', 'OTHERCHAR'].includes(c.cardId)), 'decoy は登場しない').toBe(false);
  });

  it('option1 (リムーブ): レベル6以下 大岡紅葉 が自リムーブから登場、decoy は remove に残る', () => {
    const s = base();
    s.players.self.scene = [sc('B05031', 'io')];
    s.players.self.remove = ['MOMIJI', 'MOMIJI7', 'MOMIJIEV', 'OTHERCHAR'];
    const after = activate(s, 1);

    expect(after.players.self.scene.some(c => c.cardId === 'MOMIJI'), '大岡紅葉 lv6 がリムーブから登場').toBe(true);
    expect(after.players.self.remove.includes('MOMIJI'), '登場した MOMIJI は remove から抜ける').toBe(false);
    // decoy は remove に残る
    expect(after.players.self.remove.includes('MOMIJI7'), 'lv7 decoy は remove に残る').toBe(true);
    expect(after.players.self.remove.includes('MOMIJIEV'), 'event decoy は remove に残る').toBe(true);
    expect(after.players.self.remove.includes('OTHERCHAR'), '別名 decoy は remove に残る').toBe(true);
    // 伊織無我 自身は remove に居るが 大岡紅葉 でないため候補外 (登場しない)
    expect(after.players.self.remove.includes('B05031'), 'B05031 は remove に残る (候補外)').toBe(true);
  });

  it('negative (候補ゼロ): 手札に大岡紅葉なし → 何も登場せず、cost は支払済 (B05031 は remove、rules/15 0可)', () => {
    const s = base();
    s.players.self.scene = [sc('B05031', 'io')];
    s.players.self.hand = ['MOMIJI7', 'MOMIJIEV', 'OTHERCHAR']; // 全て decoy
    const after = activate(s, 0);

    expect(after.players.self.scene.length, '現場に新キャラは登場しない (B05031 も cost で退場)').toBe(0);
    expect(after.players.self.remove.includes('B05031'), 'cost は支払済 (B05031 → remove)').toBe(true);
    expect([...after.players.self.hand].sort(), 'decoy は手札にそのまま残る').toEqual(['MOMIJI7', 'MOMIJIEV', 'OTHERCHAR'].sort());
  });
});

// ============================================================
// a1 — 【登場時】相手の現場のキャラを1枚まで選び、相手のデッキ上端を裏向きでセット (opp-side target pick, BUG-174)
// ============================================================
describe('B05031 a1 — 登場時: 相手現場キャラに相手デッキ上端を裏向きセット', () => {
  const enter = (s0: GameState) => produce(s0, (d) => {
    const c = mutateAll.scene.enter(d, 'self', 'B05031', {});
    event.emit(d, 'enter', { uid: c.uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B05031', uid: c.uid });
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });

  it('相手現場キャラ (opp side target) に相手デッキ上端1枚を裏向きセット、自陣 decoy は候補外', () => {
    const s = base();
    s.players.opp.scene = [sc('OPPCHAR', 'oc')];
    s.players.self.scene = [sc('SELFDECOY', 'sd')]; // side:opp のため候補外
    s.players.opp.deck = ['FILL', 'FILL'];          // 上端 = 相手デッキから引く
    const after = enter(s);

    const oc = after.players.opp.scene.find(c => c.uid === 'oc')!;
    expect(oc.setCards?.length, '相手キャラに 1 枚セット').toBe(1);
    expect(oc.setCards?.[0].faceUp, '裏向き (faceUp:false)').toBe(false);
    expect(after.players.opp.deck.length, '相手デッキ上端 1 枚消費 2→1').toBe(1);
    // 自陣 decoy は host 候補外 (side opp) → セットされない
    const sd = after.players.self.scene.find(c => c.uid === 'sd')!;
    expect(sd.setCards?.length ?? 0, '自陣キャラにはセットしない').toBe(0);
  });

  it('negative: 相手現場が空 → セットなし・相手デッキ不変 (n:0-1 min0 skip)', () => {
    const s = base();
    s.players.opp.scene = [];
    s.players.opp.deck = ['FILL', 'FILL'];
    const after = enter(s);
    expect(after.players.opp.deck.length, '相手現場0 → デッキ消費なし').toBe(2);
  });
});
