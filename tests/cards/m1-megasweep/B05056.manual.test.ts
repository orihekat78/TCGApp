// m1-megasweep probe — B05056 鈴木次郎吉 (character) 手書き probe (engine 実評価)
//
// 印字 (ground truth, src/cards/ct-p05/B05056.ts fullTexts):
//   a1 【相手ターン中】【現場リムーブ時】カードを1枚引く。 ← 既製 idiom (D03013 a1 同型、他 test 済)、本 probe は shape 確認のみ
//   a2 【宣言】【スリープ】：手札からレベル6以下の〚特徴［鈴木財閥］〛のキャラを1枚まで登場させる。 ← 今回完成した novel 句
//
// DSL (a2):
//   declared, scope on-scene, cost {kind:'sleepSelf'} (bare、pay wrapper なし),
//   effect = atom sceneEnter{ player:self, from:hand, cardId:$pick.cardId, viaEffect:true,
//            target: pick{ area:hand, side:self, filter:{kind:character, levelMax:6, trait:鈴木財閥}, n:0-1 } }。
//   ★ B05031 a2 の簡略版: choice なし (単一 sceneEnter) / cost は sleepSelf のみ (removeFromScene なし) /
//     filter は cardName でなく trait。→ 宣言後 B05056 は現場に留まり state=sleep (remove へは行かない)。
//
// novel 経路 = production dispatch (BUG-171):
//   activateDeclaredAbility(uid,'a2') + runAllUntilEmpty + drainAiEffectPicks (AI greedy が唯一候補を pick)。
//   cost 使用可否は canPay で pin (sleepSelf は active のみ払える、rules/21)。
//
// decoy / off-variant (rules/15,17,21 + カード固有):
//   - lv7 鈴木財閥 char → filter levelMax:6 超過で候補外 (登場せず、手札に残る)。
//   - lv5 非鈴木財閥 char → filter trait:鈴木財閥 不一致で候補外。
//   - 鈴木財閥 event → filter kind:character 外で候補外。
//   「1枚まで」= 0 選択許容 (rules/15): 候補ゼロ → 何も登場しないが cost の sleepSelf は支払済 (self が sleep)。
//   BUG-174 owner=opp: a2 の player:'self' は owner 相対 (resolvePlayer)。opp 所有 B05056 を opp が宣言 →
//     opp の手札から opp 現場へ登場 + opp の B05056 が sleep (literal-'self' へ反転しない) を pin。
//
// カード本体 / engine は編集禁止。test 側のみ調整して green。
// beforeEach で registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火、CLAUDE.md 規約)。
// rules: 05-turn-phases.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md

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
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../../helpers/fixtures';
import type { GameState, SceneCharacter, CardDef, AbilityDef } from '@/engine/types';
import { B05056 } from '@/cards/ct-p05/B05056';

type Player = 'self' | 'opp';
const setHuman = (s: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s; };
const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  sceneChar(cardId, uid, { state });

function cdef(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over } as unknown as CardDef;
}

// a2 pick fixtures — 鈴木財閥 lv≤6 char が唯一の有効候補、decoy 3種
const SUZUKI6  = cdef('SUZUKI6',  { names: ['鈴木園子'], traits: ['鈴木財閥'], level: 6 });                    // ✓ 唯一の有効候補
const SUZUKI7  = cdef('SUZUKI7',  { names: ['鈴木史郎'], traits: ['鈴木財閥'], level: 7 });                    // decoy: levelMax:6 超過
const NONSUZ5  = cdef('NONSUZ5',  { names: ['非鈴木'],   traits: ['探偵'],     level: 5 });                    // decoy: trait:鈴木財閥 不一致
const SUZUKIEV = cdef('SUZUKIEV', { names: ['鈴木の証'], traits: ['鈴木財閥'], level: 3, kind: 'event' });      // decoy: kind:character 外
const FIXTURES = [SUZUKI6, SUZUKI7, NONSUZ5, SUZUKIEV];

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
  registerCardDef(B05056);
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
});

// ============================================================
// shape pin — descriptor (codegen drift 検出) + a1 既製 idiom 確認
// ============================================================
describe('B05056 鈴木次郎吉 — shape (descriptor)', () => {
  it('id/no/種別/色/lv/ap/lp/特徴 + a1 leave:to-remove draw / a2 declared sleepSelf → hand sceneEnter(鈴木財閥 lv6)', () => {
    expect(B05056.id).toBe('B05056');
    expect(B05056.no).toBe('0558/B05056');
    expect(B05056.kind).toBe('character');
    expect(B05056.colors).toEqual(['白']);
    expect(B05056.level).toBe(7);
    expect(B05056.ap).toBe(5000);
    expect(B05056.lp).toBe(1);
    expect(B05056.traits).toEqual(['鈴木財閥']);

    // a1 = 既製 idiom (【相手ターン中】【現場リムーブ時】1枚引く)。挙動は他 test 済 → shape のみ。
    const a1 = B05056.abilities[0] as AbilityDef;
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'opp' });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });

    // a2 = novel 句
    const a2 = B05056.abilities[1] as AbilityDef;
    expect(a2.type).toBe('declared');
    expect(a2.cost).toMatchObject({ kind: 'sleepSelf' });
    const eff = a2.effect as { kind: string; verb: string; args: Record<string, unknown> };
    expect(eff).toMatchObject({ kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', cardId: '$pick.cardId', viaEffect: true } });
    const tgt = (eff.args.target as { kind: string; chooser: string; n: unknown; query: { area: string; side: string; filter: Record<string, unknown> } });
    expect(tgt).toMatchObject({ kind: 'pick', chooser: 'self', n: { min: 0, max: 1 } });
    expect(tgt.query).toMatchObject({ area: 'hand', side: 'self', filter: { kind: 'character', levelMax: 6, trait: '鈴木財閥' } });
  });
});

// ============================================================
// a2 (novel) — declared: sleepSelf コスト → 手札から 鈴木財閥 lv≤6 を1枚まで登場
// ============================================================
describe('B05056 a2 — 宣言【スリープ】: 手札からレベル6以下 鈴木財閥 キャラを1枚まで登場', () => {
  // production dispatch: activateDeclaredAbility + runAllUntilEmpty (+ AI pick drain cycles、BUG-171)
  const activate = (s0: GameState, uid = 'jiro') => produce(s0, (d) => {
    activateDeclaredAbility(d, uid, 'a2');
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });

  it('cost gate: アクティブなら sleepSelf 払える / スリープ状態なら払えず宣言不可 (rules/21)', () => {
    const cost = B05056.abilities[1].cost!;
    const mkCtx = () => ({ source: { player: 'self', uid: 'jiro', cardId: 'B05056', abilityId: 'a2' }, bindings: {} } as unknown as Parameters<typeof canPay>[2]);

    const active = base();
    active.players.self.scene = [sc('B05056', 'jiro')];
    expect(canPay(active, cost, mkCtx()), 'active → sleepSelf 払える').toBe(true);

    const slept = base();
    slept.players.self.scene = [sc('B05056', 'jiro', 'sleep')];
    expect(canPay(slept, cost, mkCtx()), 'sleep → sleepSelf 払えず不可').toBe(false);
  });

  it('happy: 鈴木財閥 lv6 が手札から登場 + B05056 は sleep 化 (現場に留まる、removeなし)', () => {
    const s = base();
    s.players.self.scene = [sc('B05056', 'jiro')];
    s.players.self.hand = ['SUZUKI6'];
    const after = activate(s);

    // sleepSelf コスト: B05056 は現場に留まり sleep 化 (removeFromScene ではない)
    const jiro = after.players.self.scene.find(c => c.uid === 'jiro');
    expect(jiro, 'B05056 は現場に留まる (sleepSelf コストで remove しない)').toBeDefined();
    expect(read.char.state(after, 'jiro'), 'B05056 は sleep 化').toBe('sleep');
    // 鈴木財閥 lv6 が手札から登場
    expect(after.players.self.scene.some(c => c.cardId === 'SUZUKI6'), '鈴木財閥 lv6 が登場').toBe(true);
    expect(after.players.self.hand.includes('SUZUKI6'), '登場した SUZUKI6 は手札から抜ける').toBe(false);
  });

  it('decoy 弁別: lv7鈴木財閥 / lv5非鈴木財閥 / 鈴木財閥event は候補外 → 唯一の lv6 char のみ登場', () => {
    const s = base();
    s.players.self.scene = [sc('B05056', 'jiro')];
    // decoy を先頭に並べる (filter が壊れていれば先頭 decoy が誤登場する discriminating 配置)
    s.players.self.hand = ['SUZUKI7', 'NONSUZ5', 'SUZUKIEV', 'SUZUKI6'];
    const after = activate(s);

    expect(after.players.self.scene.some(c => c.cardId === 'SUZUKI6'), '唯一の有効候補 lv6鈴木財閥 が登場').toBe(true);
    // decoy 3種は手札に残り登場しない
    expect(after.players.self.hand.includes('SUZUKI7'), 'lv7鈴木財閥 (levelMax超過) は手札に残る').toBe(true);
    expect(after.players.self.hand.includes('NONSUZ5'), 'lv5非鈴木財閥 (trait不一致) は手札に残る').toBe(true);
    expect(after.players.self.hand.includes('SUZUKIEV'), '鈴木財閥event (kind外) は手札に残る').toBe(true);
    expect(after.players.self.scene.some(c => ['SUZUKI7', 'NONSUZ5', 'SUZUKIEV'].includes(c.cardId)), 'decoy は登場しない').toBe(false);
  });

  it('0-pick decline (「1枚まで」rules/15): 候補ゼロ → 何も登場しないが sleepSelf は支払済 (B05056 は sleep)', () => {
    const s = base();
    s.players.self.scene = [sc('B05056', 'jiro')];
    s.players.self.hand = ['SUZUKI7', 'NONSUZ5', 'SUZUKIEV']; // 全て decoy = 有効候補ゼロ
    const after = activate(s);

    // 新キャラは登場しない (B05056 のみが現場)
    expect(after.players.self.scene.length, '現場は B05056 のみ (新キャラ登場なし)').toBe(1);
    expect(after.players.self.scene[0]?.cardId, '現場に残るのは B05056').toBe('B05056');
    // cost は支払済 (sleepSelf) — 候補ゼロでも宣言・コストは実行される
    expect(read.char.state(after, 'jiro'), 'cost 支払済 → B05056 は sleep').toBe('sleep');
    // decoy は手札にそのまま残る
    expect([...after.players.self.hand].sort(), 'decoy は手札にそのまま残る').toEqual(['SUZUKI7', 'NONSUZ5', 'SUZUKIEV'].sort());
  });

  it('owner=opp pin (BUG-174): opp 所有 B05056 を opp が宣言 → opp 手札から opp 現場へ登場 + opp の B05056 sleep', () => {
    const s = base();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.opp.scene = [sc('B05056', 'jiro')];
    s.players.opp.hand = ['SUZUKI6'];
    // 自陣にも decoy を置き「誤って self 側に登場しない」ことを検出
    s.players.self.hand = ['NONSUZ5'];
    const after = activate(s);

    // player:'self' が owner(=opp) 相対に解決 → opp 側で処理 (literal-'self' へ反転しない)
    expect(after.players.opp.scene.some(c => c.cardId === 'SUZUKI6'), 'owner=opp: 鈴木財閥 が opp 現場へ登場').toBe(true);
    expect(after.players.opp.hand.includes('SUZUKI6'), 'opp 手札から抜ける').toBe(false);
    expect(read.char.state(after, 'jiro'), 'opp の B05056 が sleep 化').toBe('sleep');
    // self 側は一切変化しない
    expect(after.players.self.scene.length, 'self 現場は空のまま').toBe(0);
    expect(after.players.self.hand.includes('NONSUZ5'), 'self 手札 decoy は不変').toBe(true);
  });
});
