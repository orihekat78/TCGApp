// tests/cards/m1-megasweep/B02018.manual — 服部平次 (character) 手書き probe (engine 実評価)
//
// 印字 (ground truth, payloads/B02018.json fullTexts.effect):
//   a1 【自分ターン中】【ターン2】このキャラにカード1枚がセットされるたび、このキャラをアクティブにするか、
//        ターン終了時までこのキャラは〚突撃〛を持つ。
//   a2 【宣言】【ターン1】〚デッキのカードを上から3枚リムーブする〛：
//        自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//
// DSL:
//   a1 = triggered, hook 'setcard:enter' selfOnly, condition turn{self}, limit turn{n:2},
//        effect choice[ opt0: sceneSetState{uid:$self, state:active}
//                       opt1: charGrantKeyword{uid:$self, kw:突撃, scope:turn} ]
//   a2 = declared, cost removeDeckTop{player:self, n:3},
//        effect charSetCard{uid:$self, fromDeckTop:true, faceUp:false, player:self}
//
// novel 経路 = production dispatch:
//   a1: mutate.char.setCard で「このキャラにカードがセット」→ setcard:enter 実 emit → triggered.ts が
//       condition/limit 通過分の choice effect を __pendingEffectChoiceSide へ surface →
//       _drainPendingEffectChoiceSide + applyChoiceAndContinuation(choiceIndex) で決定論的に option 解決。
//       (choice の chooser:self は AI 自動解決されず side-channel に surface、hybrid-batch6 driver 慣行)
//   a2: activateDeclaredAbility(uid,'a2') が cost (removeDeckTop 3) を pay してから effect を実行
//       (BUG-171)。cost payability は engine cost.canPay で pin (AI move-enumerator の実 gate)、
//       limit は canDeclaredAbility で pin。charSetCard は mutate.char.setCard を呼ぶため a2 → a1 cascade
//       (自分ターン中に set → a1 setcard:enter が実発火) を real path で観測。
//
// BUG-174 (owner 反転しない pin): a1 を owner=opp 側に置き、turn=opp (opp 視点の「自分ターン中」) で
//   同一に機能し opp 側 B02018 がアクティブ化する (self 側は無関係) ことを pin。
// 条件 off-variant: a1 は turn=opp (owner=self にとって相手ターン) では condition turn{self} 不成立 →
//   set しても choice が surface しない (発火なし)。
// selfOnly decoy: 同じ B02018 を 2 体並べ #A に set → #A の a1 のみ発火 (#B は不変) を pin。
// limit turn2: 同ターン 3 回 set → 発火は 2 回まで (3 回目は choice surface せず、公式Q&A 回数消費)。
// 注: a1 は「1枚まで」型の pick を持たない (choice option は $self 直対象) ため 0-pick scenario は non-applicable。
//     a2 も固定 1 枚 set。よって decoy/off-variant/limit で discriminate する。
// beforeEach で registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火)。
// rules: 03-field-areas.md, 05-turn-phases.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md,
//        16-card-set.md, 17-icons.md, 21-declared-ability-cost.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce, setAutoFreeze } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canPay } from '@/engine/cost/evaluate';
import {
  _drainPendingEffectChoiceSide,
  _clearPendingEffectChoiceSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import { applyChoiceAndContinuation } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../../helpers/fixtures';
import { B02018 } from '@/cards/ct-p02/B02018';
import type { GameState, SceneCharacter, EffectCtx, Player, AbilityDef, Cost } from '@/engine/types';

setAutoFreeze(false);

const setHuman = (s: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s; };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectChoiceSide();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  registerCardDef(B02018);
  registerTriggeredListener();
});

const sc = (uid: string, state: 'active' | 'sleep' | 'stun' = 'sleep'): SceneCharacter =>
  sceneChar('B02018', uid, { state });

// owner の現場に B02018 を1体 (uid) 置いた live state。turn=turnPlayer。
function board(owner: Player, turnPlayer: Player, uid = 'hattori', state: 'active' | 'sleep' = 'sleep'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players[owner].scene = [sc(uid, state)];
  return s;
}

// 直接 set (mutate.char.setCard) → setcard:enter 実 emit → runAllUntilEmpty。
// a1 の choice (chooser:self) は humanChooser=true (=__humanPlayerSide が owner) のときのみ
// __pendingEffectChoiceSide へ surface する (resolve-picks.ts:632)。humanChooser=false の CPU 経路では
// 既定 option0 が inline 自動解決される。probe は option を決定論的に選ぶため owner=human に固定して surface させ、
// choiceIndex で解決する。surface 無し(=condition/limit で不発)なら false を返す。
function directSet(d: GameState, owner: Player, hostUid: string, setCardId: string, choiceIndex: 0 | 1 | null): boolean {
  setHuman(owner); // owner を human 化 → choice surface (humanChooser=owner)
  mutate.char.setCard(d, hostUid, setCardId, false);
  runAllUntilEmpty(d);
  const pending = _drainPendingEffectChoiceSide();
  if (!pending) return false;
  if (choiceIndex === null) throw new Error('choice surfaced but choiceIndex=null was expected to be no-fire');
  applyChoiceAndContinuation(d, pending, choiceIndex);
  runAllUntilEmpty(d);
  return true;
}

// ============================================================
// descriptor pin — codegen drift 検出
// ============================================================
describe('B02018 服部平次 — shape (descriptor)', () => {
  it('id/no/色/lv/ap/lp/特徴 + a1 triggered setcard:enter choice / a2 declared removeDeckTop→charSetCard', () => {
    expect(B02018.id).toBe('B02018');
    expect(B02018.no).toBe('0188/B02018');
    expect(B02018.kind).toBe('character');
    expect(B02018.colors).toEqual(['緑']);
    expect(B02018.level).toBe(8);
    expect(B02018.ap).toBe(8000);
    expect(B02018.lp).toBe(1);
    expect(B02018.traits).toEqual(['探偵', '高校生']);

    const a1 = B02018.abilities[0] as AbilityDef;
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'setcard:enter', selfOnly: true });
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(a1.limit).toMatchObject({ kind: 'turn', n: 2 });
    expect(a1.effect).toMatchObject({
      kind: 'choice',
      chooser: 'self',
      options: [
        { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
        { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
      ],
    });

    const a2 = B02018.abilities[1] as AbilityDef;
    expect(a2.type).toBe('declared');
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a2.cost).toMatchObject({ kind: 'removeDeckTop', player: 'self', n: 3 });
    expect(a2.effect).toMatchObject({
      kind: 'atom',
      verb: 'charSetCard',
      args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' },
    });
  });
});

// ============================================================
// a1 — 【自分ターン中】【ターン2】set されるたび: アクティブ化 or 突撃付与
// ============================================================
describe('B02018 a1 — setcard:enter で choice[アクティブ化 / 突撃付与] (実 emit)', () => {
  it('S1 option0 アクティブ化: sleep の B02018 に set → choice0 → active。off-variant(相手ターン)では不発', () => {
    // happy: 自分ターン中に set → a1 発火 → option0 で active
    const afterA = produce(board('self', 'self', 'hattori', 'sleep'), (d) => {
      const fired = directSet(d, 'self', 'hattori', 'SET1', 0);
      expect(fired, '自分ターン中 set → a1 発火 (choice surface)').toBe(true);
    });
    expect(read.char.state(afterA, 'hattori'), 'option0 → sleep→active').toBe('active');
    expect(afterA.players.self.scene[0].setCards, 'set card は裏向きで載る').toEqual([{ cardId: 'SET1', faceUp: false }]);

    // off-variant: 相手ターン中 (owner=self にとって turn{self} 不成立) → set しても発火せず
    const afterOff = produce(board('self', 'opp', 'hattori', 'sleep'), (d) => {
      const fired = directSet(d, 'self', 'hattori', 'SET1', null);
      expect(fired, '相手ターン中 → condition turn{self} 不成立 → 不発').toBe(false);
    });
    expect(read.char.state(afterOff, 'hattori'), '不発 → sleep のまま').toBe('sleep');
    expect(afterOff.players.self.scene[0].setCards.length, 'set card 自体は載る (unset は起きない)').toBe(1);
  });

  it('S2 option1 突撃付与: choice1 → ターン終了時まで 突撃 を持つ / 状態(sleep)は不変', () => {
    const after = produce(board('self', 'self', 'hattori', 'sleep'), (d) => {
      directSet(d, 'self', 'hattori', 'SET1', 1);
    });
    expect(read.char.hasKeyword(after, 'hattori', '突撃'), 'option1 → 突撃 付与').toBe(true);
    expect(read.char.state(after, 'hattori'), 'grant は状態を変えない → sleep のまま').toBe('sleep');
  });

  it('S3 selfOnly decoy: B02018 を 2 体並べ #A に set → #A のみ発火 (#B は不変)', () => {
    const s0 = createEmptyGameState();
    s0.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s0.players.self.scene = [sc('A', 'sleep'), sc('B', 'sleep')];
    const after = produce(s0, (d) => {
      const fired = directSet(d, 'self', 'A', 'SET1', 0); // #A に set
      expect(fired, '#A への set で choice 1 件のみ surface').toBe(true);
      // drain 後 pending が残っていない = #B は発火していない
      expect(_drainPendingEffectChoiceSide(), 'selfOnly ゆえ #B の a1 は発火せず (追加 choice 無し)').toBeNull();
    });
    expect(read.char.state(after, 'A'), '#A は option0 で active').toBe('active');
    expect(read.char.state(after, 'B'), '#B は selfOnly 対象外 → sleep のまま').toBe('sleep');
    expect(after.players.self.scene.find((c) => c.uid === 'B')!.setCards.length, '#B に set card は載らない').toBe(0);
  });

  it('S4 limit turn2: 同ターン 3 回 set → 発火は 2 回まで (3 回目は不発)', () => {
    let fireCount = 0;
    const after = produce(board('self', 'self', 'hattori', 'sleep'), (d) => {
      if (directSet(d, 'self', 'hattori', 'S_1', 1)) fireCount++;
      if (directSet(d, 'self', 'hattori', 'S_2', 1)) fireCount++;
      if (directSet(d, 'self', 'hattori', 'S_3', 1)) fireCount++;
    });
    expect(fireCount, '【ターン2】上限 → 3 回中 2 回のみ発火').toBe(2);
    expect(after.players.self.scene[0].setCards.length, 'set 自体は 3 枚とも載る (発火とは独立)').toBe(3);
  });

  it('S5 owner=opp pin (BUG-174): opp の B02018 に opp ターン中 set → opp 側 B02018 が active (反転せず)', () => {
    const after = produce(board('opp', 'opp', 'oh', 'sleep'), (d) => {
      const fired = directSet(d, 'opp', 'oh', 'SET1', 0);
      expect(fired, 'owner=opp・opp ターン → 発火').toBe(true);
    });
    expect(read.char.state(after, 'oh'), 'owner=opp: opp 側 B02018 が active (owner 反転せず)').toBe('active');
    expect(after.players.self.scene.length, 'self 側は無関係').toBe(0);
    expect(after.players.opp.scene[0].setCards, 'opp 側に裏向き set').toEqual([{ cardId: 'SET1', faceUp: false }]);
  });
});

// ============================================================
// a2 — 【宣言】【ターン1】デッキ上3枚リムーブ: 上から1枚を裏向きでセット
// ============================================================
describe('B02018 a2 — 宣言: cost removeDeckTop3 → charSetCard fromDeckTop (facedown)', () => {
  function boardA2(deck: string[]): GameState {
    const s = board('self', 'self', 'hattori', 'active');
    s.players.self.deck = [...deck];
    return s;
  }
  const a2Cost = (B02018.abilities[1] as AbilityDef).cost as Cost;
  const ctxSelf: EffectCtx = { source: { cardId: 'B02018', uid: 'hattori', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} };

  it('S6 happy: cost で上3枚(C1/C2/C3)リムーブ → 上から1枚(SET)を裏向きセット。a2→a1 cascade も実発火', () => {
    const s0 = boardA2(['C1', 'C2', 'C3', 'SET', 'TAIL']);
    setHuman('self'); // a1 cascade choice を surface させる (humanChooser=self)
    const after = produce(s0, (d) => {
      activateDeclaredAbility(d, 'hattori', 'a2');
      runAllUntilEmpty(d);
      // a2 の charSetCard は mutate.char.setCard 経由 → 自分ターン中ゆえ a1 が cascade 発火 (real path)。
      const cascade = _drainPendingEffectChoiceSide();
      expect(cascade, 'a2 の set が setcard:enter を emit → a1 が cascade で choice surface').not.toBeNull();
      applyChoiceAndContinuation(d, cascade!, 0); // option0 でアクティブ化
      runAllUntilEmpty(d);
    });
    // cost: 上3枚が remove へ
    for (const cid of ['C1', 'C2', 'C3']) {
      expect(after.players.self.remove.includes(cid), `${cid} が cost で remove へ`).toBe(true);
      expect(after.players.self.deck.includes(cid), `${cid} は deck から抜けた`).toBe(false);
    }
    // effect: cost 後の上端 SET が裏向きセット / TAIL は deck に残る
    expect(after.players.self.scene[0].setCards, 'SET が裏向き(faceUp:false)でセット').toEqual([{ cardId: 'SET', faceUp: false }]);
    expect(after.players.self.deck, 'SET 消費後 deck 残は TAIL のみ').toEqual(['TAIL']);
    // cascade: a1 発火で B02018 が active 化 (real a2→a1 統合経路)
    expect(read.char.state(after, 'hattori'), 'cascade a1 option0 → active').toBe('active');
  });

  it('S7 gate: cost.canPay は deck≥3 で true / deck<3 で false (AI move-enumerator 実 gate) + limit turn1', () => {
    // deck 3枚 → payable
    expect(canPay(boardA2(['C1', 'C2', 'C3']), a2Cost, ctxSelf), 'deck 3 枚 → cost 支払可').toBe(true);
    // deck 2枚 + remove 空 → 上3枚リムーブ不可 (rules/21 コスト全行不可 → 使用不可)
    const short = boardA2(['C1', 'C2']);
    expect(canPay(short, a2Cost, ctxSelf), 'deck 2 枚 → removeDeckTop3 不可').toBe(false);

    // limit turn1: 1 回使用後は canDeclaredAbility false
    const after = produce(boardA2(['C1', 'C2', 'C3', 'SET', 'TAIL']), (d) => {
      activateDeclaredAbility(d, 'hattori', 'a2');
      runAllUntilEmpty(d);
      const c = _drainPendingEffectChoiceSide();
      if (c) { applyChoiceAndContinuation(d, c, 1); runAllUntilEmpty(d); }
    });
    expect(canDeclaredAbility(after, 'hattori', 'a2'), '1 回使用後 limit turn1 で再宣言不可').toBe(false);
  });
});
