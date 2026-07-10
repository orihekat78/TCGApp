// m1-megasweep probe — B03078 宮野明美 (character, engine変更0)
//
// 印字 (ground truth, payloads/B03078.json fullTexts):
//   a1 (effect):   このキャラはスリープ状態でもガードできる。
//   a2 (hirameki): 【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある
//                  【青】か【赤】のカードを1枚まで選び、手札に加える。カードを手札に加えた場合、手札を1枚リムーブする。
//
// rules: 03 (スタンは行動不可), 07 (guard), 10 (ヒラメキ = evidence:remove-by-action), 13,
//        15 (「〜まで」=0枚可), 24 (名乗り/スタン)。
//
// novel 経路 = production dispatch:
//   a1: continuous grantKeywords ['text:sleepGuard'] → read.char.keywords() が自身の continuous を評価し
//       'text:sleepGuard' を返す → flow/guard.ts candidates() が sleep キャラの hasTextAbility を読む実 gate。
//   a2: engine.event.emit('evidence:remove-by-action') で real trigger を発火 → triggered listener が
//       pendingHirameki を set (実 emit 経路)。効果 chain[handAddFromRemove{filter青赤}, discard] は
//       chain のため resolveEffectPicks では pre-walk passthrough (resolve-picks.ts:727) → 実行時に
//       tryRePickFromAtom で pending pick を積み、AI drain loop (_drainAllEffectPicksForTest = CPU 経路)
//       で解決する。これは ai/policy.ts の実効果解決機構そのもの。
//   chain gate: handAddFromRemove が 0-candidate (青/赤 不在) → substituteAtomPick が
//       ctx.dyn.chainStepNoApply=true (resolve-picks.ts:360) → resolver chain が break →
//       discard は fire しない (「加えた場合」ゲート、sibling B03053 同 idiom)。
// BUG-174: owner='opp' 反転 pin — a1 は defender-side 相対、a2 は evidence 所有者相対で self 側不変。
// beforeEach: registry 全 reset + event._resetRegistry + pending queue reset (handler 累積・
//   side-channel 残留で N 重発火/誤解決を回避)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { engine } from '@/engine';
import {
  registerHiramekiListener,
  _drainPendingHirameki,
  _resetPendingHirameki,
  _resetHiramekiRegistered,
} from '@/engine/listeners/hirameki';
import {
  registerTriggeredListener,
  _resetTriggeredRegistered,
} from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef, def } from '@/engine/read/def';
import * as guard from '@/engine/flow/guard';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B03078 } from '@/cards/ct-p03/B03078';
import type { GameState, CardDef, EffectCtx } from '@/engine/types';

type Player = 'self' | 'opp';

// 色つき decoy def — handAddFromRemove filter{color:[青,赤]} の候補判定に必要 (candidates が def の色を読む)
function chDef(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors, level: 1, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
const PLAIN = 'PLAINCHAR'; // sleepGuard を持たない plain キャラ (a1 off-variant)

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetHiramekiRegistered();
  _resetPendingHirameki();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerCardDef(B03078);
  for (const [id, cols] of [
    [PLAIN, ['白']], ['BLUE', ['青']], ['RED', ['赤']], ['GREEN', ['緑']], ['GREEN2', ['緑']],
    ['HANDONLY', ['白']], ['H1', ['白']], ['H2', ['白']], ['SBLUE', ['青']], ['SH1', ['白']], ['OH1', ['白']],
  ] as [string, string[]][]) registerCardDef(chDef(id, cols));
  registerTriggeredListener();
  registerHiramekiListener();
});

// ── a2 production 経路 helper: 実 emit で trigger 発火 → pending 確認 → AI drain loop で効果解決 ──
function fireHirameki(evidenceOwner: Player, setup: (s: GameState) => void): GameState {
  const attacker: Player = evidenceOwner === 'self' ? 'opp' : 'self';
  let s = produce(createEmptyGameState(), (d) => {
    d.turn = { number: 3, player: attacker, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    setup(d);
  });
  // 実 emit 経路: evidence:remove-by-action → triggered listener が pendingHirameki を set
  engine.event.emit(
    s,
    'evidence:remove-by-action',
    { player: evidenceOwner, ev: { cardId: 'B03078' } },
    { player: attacker, uid: `${attacker}-attacker` },
  );
  const pending = _drainPendingHirameki();
  expect(pending, 'ヒラメキ listener が pending を set').not.toBeNull();
  expect(pending!.cardId).toBe('B03078');
  expect(pending!.player).toBe(evidenceOwner);
  expect(pending!.abilityId).toBe('a2');
  // fire: a2 効果を CPU 経路 (AI drain loop) で解決 — chain の pick/continuation を実 engine で回す
  const a2 = def.card('B03078')!.abilities.find((a) => a.id === 'a2')!.effect!;
  const ai = new HeuristicPolicy();
  const ctx = {
    source: { player: evidenceOwner, cardId: 'B03078', area: 'evidence', abilityId: 'a2' },
    bindings: {},
  } as unknown as EffectCtx;
  return produce(s, (d) => {
    const walked = resolveEffectPicks(d, a2 as never, ctx, {
      chooseAtomTarget: ai.chooseAtomTarget?.bind(ai), byPlayer: evidenceOwner, humanChooser: false,
      source: { cardId: 'B03078', abilityId: 'a2' },
    });
    runEffect(d, walked as never, ctx);
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, ai);
      runAllUntilEmpty(d);
    }
  });
}

const sortc = (a: readonly string[]): string[] => [...a].sort();

// ─────────────────────────────────────────────────────────────────────────────
describe('B03078 a1 — sleepGuard (「スリープ状態でもガードできる」) via flow/guard.candidates', () => {
  it('スリープ状態の B03078 はガード候補に入る / plain sleep は入らない (decoy) / スタンは不可 (rules/03)', () => {
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('ATK', 'atk', { state: 'active' }));
    s.players.opp.scene.push(sceneChar('B03078', 'g-b03078-sleep', { state: 'sleep' }));
    s.players.opp.scene.push(sceneChar(PLAIN, 'g-plain-sleep', { state: 'sleep' }));   // decoy: sleepGuard 無し
    s.players.opp.scene.push(sceneChar('B03078', 'g-b03078-stun', { state: 'stun' })); // スタンは行動不可
    const uids = guard.candidates(s, 'atk').map((c) => c.uid);
    expect(uids, 'sleepGuard 持ちスリープはガード可').toContain('g-b03078-sleep');
    expect(uids, 'sleepGuard 無しの plain sleep はガード不可 (decoy)').not.toContain('g-plain-sleep');
    expect(uids, 'スタンは sleepGuard があっても行動不可 (rules/03)').not.toContain('g-b03078-stun');
  });

  it('reversal pin (BUG-174): 攻撃側が opp のとき B03078 は self 側の防御候補として機能 (side ハードコードなし)', () => {
    const s = createEmptyGameState();
    s.players.opp.scene.push(sceneChar('ATK', 'atk-opp', { state: 'active' }));
    s.players.self.scene.push(sceneChar('B03078', 'self-b03078-sleep', { state: 'sleep' }));
    expect(guard.canGuard(s, 'atk-opp', 'self-b03078-sleep'), 'defender-side 相対で sleepGuard 有効').toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('B03078 a2 — ヒラメキ: 青/赤を1枚まで手札へ → 加えたら手札1枚リムーブ (chain gate)', () => {
  it('happy: リムーブの【青】を手札へ + 手札1枚を discard / 【緑】decoy は filter で不採用', () => {
    const after = fireHirameki('self', (s) => {
      s.players.self.remove = ['GREEN', 'BLUE']; // GREEN=decoy(filter外), BLUE=候補
      s.players.self.hand = ['HANDONLY'];
    });
    // add: BLUE を remove→hand (先頭 fallback) → hand=[HANDONLY,BLUE]、discard: 先頭 HANDONLY を remove へ
    expect(after.players.self.hand, 'BLUE が手札に加わっている (add 発火)').toContain('BLUE');
    expect(after.players.self.hand.length, 'add(+1) → discard(-1) で net 1 枚').toBe(1);
    expect(after.players.self.remove, '【緑】decoy は filter 外 → remove に残存').toContain('GREEN');
    expect(after.players.self.remove, 'BLUE は remove から手札へ移動済').not.toContain('BLUE');
    // 消失/複製なし: 3 cardId が hand ∪ remove に保存
    expect(sortc([...after.players.self.hand, ...after.players.self.remove]), 'カードの消失/複製なし')
      .toEqual(['BLUE', 'GREEN', 'HANDONLY']);
  });

  it('gate + decoy: 青/赤が remove に不在 → 0 枚 add → chain break → discard は fire しない (「加えた場合」)', () => {
    const after = fireHirameki('self', (s) => {
      s.players.self.remove = ['GREEN', 'GREEN2']; // 全て【緑】= filter 外
      s.players.self.hand = ['H1', 'H2'];
    });
    expect(sortc(after.players.self.hand), '何も加えていない → 強制 discard なし (手札不変)').toEqual(['H1', 'H2']);
    expect(sortc(after.players.self.remove), '【緑】は filter 外で手札に来ない (remove 不変)').toEqual(['GREEN', 'GREEN2']);
  });

  // ⚠ ENGINE-GAP lock (owner='opp' の a2): 下は「本来こうあるべき」ではなく「現状こう壊れる」を assert する
  //   documentation test。カード本体は正しい (relative player:'self'、shipped sibling B03053 と同 idiom)。
  //   engine 実バグ = chain 内 short-form pick を owner='opp' が持つと side が二重解決される:
  //     atomHandAddFromRemove が p=resolvePlayer('self',ctx)='opp' で buildShortFormPick →
  //     query.side='opp' (絶対値) を積む → runtime tryRePickFromAtom → candidates.ts sidesForQuery が
  //     'opp' を **owner(=opp) 相対で再解決** → oppSide('opp')='self' に反転 (二重反転)。
  //   結果: 候補は self 側 remove/hand から拾われ、mutate は opp 側を叩くため cardId 不一致で
  //     add 不発 + discard が self hand のカードを opp.remove へ複製する (state 破損)。
  //   非 chain の short-form pick (D11012 a2 standalone handAddFromRemove) は resolveEffectPicks が
  //     atom を直接 walk し query.side を literal 'self' で積む → sidesForQuery が owner 相対で 'opp' に
  //     正しく解決するため opp でも動く。chain だけが passthrough (resolve-picks.ts:727) ゆえ runtime の
  //     pre-resolved side が二重反転する。engine 修正 (別 BUG-XXX) 時に本 test が落ち→正 assert へ反転させる。
  //   BUG-174 の「side ハードコード無し」pin 自体は a1 reversal (上) が GREEN で担保済。
  it('ENGINE-GAP (chain+short-form pick+owner=opp 二重 side 解決): opp のヒラメキ add が不発 = 現状破損を lock', () => {
    const after = fireHirameki('opp', (s) => {
      s.players.opp.remove = ['RED'];
      s.players.opp.hand = ['OH1'];
      s.players.self.remove = ['SBLUE']; // self 側 decoy (二重反転で誤って候補化される側)
      s.players.self.hand = ['SH1'];
    });
    // 本来: opp.hand に RED が加わるべき。現状 engine gap で add が不発 (RED は opp.remove に残る)。
    expect(after.players.opp.hand, '【engine gap】add 不発で RED が opp 手札に来ない (本来は来るべき)')
      .not.toContain('RED');
    expect(after.players.opp.remove, '【engine gap】RED は opp.remove に取り残される').toContain('RED');
  });
});
