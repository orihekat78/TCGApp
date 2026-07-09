// tests/cards/hybrid-batch6/manual-probes
// hybrid-batch6 手書き probe: gen-card-probes.cjs が扱えない ability を **production dispatch 経路** で
//   検証する (BUG-171 慣行: engine 内部を bypass しない)。engine / src/cards は変更しない (probe のみ)。
//
// 対象 / 駆動:
//   B05023 「探偵の毛利小五郎でございます…」(event) —
//     a1 triggered effect:declared(event-use) → conditional(sceneHas 毛利小五郎)
//        then = sequence(charGrantKeyword 突撃 pick / sceneSetState sleep pick / draw)  ← 代わりに2つとも
//        else = choice(grant | sleep+draw)                                              ← 1つ選んで行う
//     production 経路 = handUseCard('self','B05023') + runAllUntilEmpty。
//   B07005 毛利小五郎 (character, continuous 3本) —
//     a1【絆妃英理】grantKeywords 突撃  → read.char.keywords 直読 (bond 有/無)。
//     a2 not(bond 妃英理) → selfActionBan → canAction gate (flow/main/action.ts _canAction)。
//     a3 selfCutinBanInContact → canCutIn gate (flow/contact.ts、参加キャラ自身が持つと自 cutin 不可)。
//   PR067 探偵の目 (case, continuous 2本) —
//     a1 partnerColorsOverride [青緑白赤黄黒] → cond/eval partnerColor override 経路 (evalCond)。
//     a2 sceneCapOverride 4 → read.scene-cap sceneCap。
//     ※ 宣言/コスト能力を持たない継続 case card ゆえ cost-gate ではなく production reader を直接叩く。
//   B07054 「アイスクリームは……甘いんだぜ!!」(event) —
//     a1 triggered effect:declared(event-use)【パートナー白】→ conditional(and[黒羽快斗, 中森青子])
//        then = sequence3 (charModifyAP+2000&突撃 pick白 / sceneSetState stun pick sleep≤7 / charSetTurnEffect
//               actionTargetsActive pick白)  ← 代わりに3つとも
//        else = choice3                                                                 ← 1つ選んで行う
//     production 経路 = handUseCard('self','B07054') + runAllUntilEmpty。
//
// 手法: harness の drive kind 外の hook (継続 modifier / choice / conditional / canAction / canCutIn / case reader)
//   を production emit / reader で実カードを直接叩く direct engine test。fake ax は production payload 形状を厳密模倣。
// rules: 03/07/08/09/13/15/17/20/24

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { canAction } from '@/engine/flow/main/action';
import { canCutIn } from '@/engine/flow/contact';
import { evalCond } from '@/engine/cond/eval';
import { sceneCap } from '@/engine/read/scene-cap';
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
import { B05023 } from '@/cards/ct-p05/B05023';
import { B07005 } from '@/cards/ct-p07/B07005';
import { PR067 } from '@/cards/pr-01/PR067';
import { B07054 } from '@/cards/ct-p07/B07054';
import type { CardDef, GameState, ActionContext, EffectCtx } from '@/engine/types';

// ---- fixtures ----
function charDef(
  id: string,
  o: { names?: string[]; ap?: number; level?: number; colors?: string[]; traits?: string[] } = {},
): CardDef {
  return {
    id, no: id, kind: 'character', names: o.names ?? [id], colors: o.colors ?? ['赤'],
    level: o.level ?? 1, ap: o.ap ?? 2000, lp: 1, traits: o.traits ?? [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}
function partnerDef(id: string, colors: string[]): CardDef {
  return { id, no: id, kind: 'partner', names: [id], colors, level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
// canCutIn の isCutInCard 判定を満たす最小カットイン fixture (effect は canCutIn 経路では解決されない)。
const CUTIN: CardDef = {
  id: 'CUTIN', no: 'CUTIN', kind: 'event', names: ['CUTIN'], colors: ['赤'], level: 1, traits: [], keywords: [],
  rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'cut', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true },
    effect: { kind: 'atom', verb: 'log', args: {} },
    description: 'cutin fixture', ruleRefs: [],
  }],
  ruleRefs: [],
};
// 継続 sceneCapOverride/partnerColorsOverride を持たない decoy case (PR067 との対比用)。
const DECOYCASE: CardDef = {
  id: 'DECOYCASE', no: 'DECOYCASE', kind: 'case', names: ['囮事件'], colors: ['青'],
  caseTraits: [], traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
} as CardDef;

// B05023 用
const MOURI = charDef('MOURI', { names: ['毛利小五郎'], traits: ['毛利探偵事務所'], ap: 5000 }); // sceneHas 条件 + 突撃付与対象
const SLEEP_TARGET = charDef('SLEEP_TARGET', {}); // sceneSetState sleep 対象 (突撃 grant 候補外)
// B07005 用
const HIEIRI = charDef('HIEIRI', { names: ['妃英理'] }); // 絆対象
const ATK = charDef('ATK', {}); // decoy contact 参加キャラ (B07005 以外)
const OPPDEF = charDef('OPPDEF', { ap: 1000 }); // contact 相手
// B07054 用
const KAITO = charDef('KAITO', { names: ['黒羽快斗'], colors: ['白'], level: 5, ap: 3000 });
const AOKO = charDef('AOKO', { names: ['中森青子'], colors: ['白'], level: 5, ap: 3000 });
const REDCH = charDef('REDCH', { colors: ['赤'], ap: 3000 }); // charModifyAP(白) 候補外 decoy
const SLEEPER = charDef('SLEEPER', { colors: ['青'], level: 5, ap: 2000 }); // stun 対象 (sleep, lv≤7)
const SLEEP8 = charDef('SLEEP8', { colors: ['青'], level: 8, ap: 2000 }); // stun 候補外 decoy (lv8)
// 汎用
const DK = charDef('DK', {});
const PART_W = partnerDef('PART_W', ['白']);
const PART_B = partnerDef('PART_B', ['青']);
const PART_BLUEONLY = partnerDef('PART_BLUEONLY', ['青']); // PR067 override の対比 (印字 青のみ)

const FIXTURES = [
  CUTIN, DECOYCASE, MOURI, SLEEP_TARGET, HIEIRI, ATK, OPPDEF,
  KAITO, AOKO, REDCH, SLEEPER, SLEEP8, DK, PART_W, PART_B, PART_BLUEONLY,
];

function setHuman(s: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
}

function base(turn: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK', 'DK', 'DK', 'DK'];
  s.players.opp.deck = ['DK', 'DK', 'DK', 'DK'];
  return s;
}

// pick / choice / optional を順に drain し script を 1 対 1 で適用する (hybrid-batch5 慣行)。
type ScriptAction = 'pick:skip' | 'optional:take' | 'optional:decline' | { pickCardId: string } | { pickUid: string } | { choiceIndex: number };
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
      else if (typeof a === 'object' && 'pickCardId' in a) {
        const hit = cands.find((c) => c.cardId === a.pickCardId);
        if (!hit) throw new Error(`pickCardId ${a.pickCardId} not in ${pick.atomVerb} cands: ${cands.map((c) => c.cardId).join(',')}`);
        applyPickAndContinuation(s, pick, hit.uid);
      } else if (typeof a === 'object' && 'pickUid' in a) applyPickAndContinuation(s, pick, a.pickUid);
      else throw new Error(`pick "${pick.atomVerb}" surfaced but script action is ${JSON.stringify(a)}`);
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
  registerCardDef(B05023); registerCardDef(B07005); registerCardDef(PR067); registerCardDef(B07054);
  for (const f of FIXTURES) registerCardDef(f);
  registerTriggeredListener();
  setHuman('self');
});

// ============================================================================
// B05023 「探偵の毛利小五郎でございます…」(event)
// ============================================================================
describe('B05023 a1 event-use → conditional(sceneHas 毛利小五郎)', () => {
  function board(withMouri: boolean): GameState {
    const s = base('self');
    s.players.self.case.colors = ['青']; // handUseCard color gate (B05023=青)
    s.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: 'DK' })); // level5 ≤ FILE
    s.players.self.hand = ['B05023'];
    s.players.self.deck = ['DK', 'DK', 'DK'];
    if (withMouri) mutate.scene.enter(s, 'self', 'MOURI', {}); // sceneHas 毛利小五郎 成立
    mutate.scene.enter(s, 'self', 'SLEEP_TARGET', {}); // sleep 対象 / grant 候補外 decoy
    return s;
  }

  it('positive: 毛利小五郎あり → then(2つとも) → 突撃付与 + sleep + draw', () => {
    const s = board(true);
    const mouriUid = s.players.self.scene.find((c) => c.cardId === 'MOURI')!.uid;
    const targetUid = s.players.self.scene.find((c) => c.cardId === 'SLEEP_TARGET')!.uid;
    const deckBefore = s.players.self.deck.length;
    handUseCard(s, 'self', 'B05023');
    runAllUntilEmpty(s);
    // pick0 = charGrantKeyword (trait 毛利探偵事務所 = MOURI のみ) → MOURI 突撃
    // pick1 = sceneSetState sleep (side either) → SLEEP_TARGET
    const { recorded } = drainScript(s, [{ pickCardId: 'MOURI' }, { pickCardId: 'SLEEP_TARGET' }]);
    expect(recorded[0]?.verb, '1つ目 = charGrantKeyword pick').toBe('charGrantKeyword');
    expect(recorded[0]?.cardIds, 'SLEEP_TARGET は trait 毛利探偵事務所 を持たず grant 候補外').not.toContain('SLEEP_TARGET');
    expect(engine.read.char.keywords(s, mouriUid), 'MOURI に 突撃 付与').toContain('突撃');
    expect(s.players.self.scene.find((c) => c.uid === targetUid)?.state, 'SLEEP_TARGET は sleep').toBe('sleep');
    expect(s.players.self.deck.length, 'draw で deck -1').toBe(deckBefore - 1);
    expect(s.players.self.remove.includes('B05023'), 'イベントは使用後リムーブ').toBe(true);
  });

  it('negative: 毛利小五郎なし → else(1つ選んで行う) → choice が surface (then の逐次実行ではない)', () => {
    const s = board(false);
    handUseCard(s, 'self', 'B05023');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'else では pick が即 surface しない (choice が先)').toBeNull();
    expect(_drainPendingEffectChoiceSide(), 'else 分岐 = choice が surface').not.toBeNull();
  });
});

// ============================================================================
// B07005 毛利小五郎 (character, continuous 3本)
// ============================================================================
describe('B07005 a1【絆妃英理】突撃 grant', () => {
  it('positive: 自現場に妃英理あり → 突撃 grant', () => {
    const s = base('self');
    const mgUid = mutate.scene.enter(s, 'self', 'B07005', {}).uid;
    mutate.scene.enter(s, 'self', 'HIEIRI', {});
    expect(engine.read.char.keywords(s, mgUid), '絆成立 → 突撃').toContain('突撃');
  });

  it('negative: 妃英理なし → 絆不成立 → 突撃なし', () => {
    const s = base('self');
    const mgUid = mutate.scene.enter(s, 'self', 'B07005', {}).uid;
    expect(engine.read.char.keywords(s, mgUid), '絆不成立 → 突撃なし').not.toContain('突撃');
  });

  it('DECOY: 妃英理が相手現場 → 絆は自現場のみ (rules/17) → 突撃なし', () => {
    const s = base('self');
    const mgUid = mutate.scene.enter(s, 'self', 'B07005', {}).uid;
    mutate.scene.enter(s, 'opp', 'HIEIRI', {});
    expect(engine.read.char.keywords(s, mgUid), '相手現場の妃英理では絆不成立').not.toContain('突撃');
  });
});

describe('B07005 a2 selfActionBan (妃英理なしでアクション不可)', () => {
  it('negative(禁止発動): 妃英理なし → not(bond)成立 → selfActionBan → canAction=false', () => {
    const s = base('self');
    const mgUid = mutate.scene.enter(s, 'self', 'B07005', {}).uid; // active / 非名乗り
    expect(canAction(s, mgUid), '妃英理不在 → selfActionBan でアクション不可').toBe(false);
  });

  it('positive(禁止解除): 妃英理あり → not(bond)不成立 → ban 解除 → canAction=true', () => {
    const s = base('self');
    const mgUid = mutate.scene.enter(s, 'self', 'B07005', {}).uid;
    mutate.scene.enter(s, 'self', 'HIEIRI', {});
    expect(canAction(s, mgUid), '妃英理在 → ban 解除').toBe(true);
  });

  it('DECOY: selfActionBan を持たない汎用キャラは同 setup で canAction=true', () => {
    const s = base('self');
    const mobUid = mutate.scene.enter(s, 'self', 'ATK', {}).uid;
    expect(canAction(s, mobUid), 'ban 非所持キャラは可').toBe(true);
  });
});

describe('B07005 a3 selfCutinBanInContact (このキャラのコンタクト中は自 cutin 不可)', () => {
  function mkAx(atkUid: string, oppUid: string): ActionContext {
    return {
      id: 'ax', byUid: atkUid, byPlayer: 'self', target: { kind: 'char', uid: oppUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: atkUid, aAP: 8000, bUid: oppUid, bAP: 1000 }, contactImmune: false,
    };
  }

  it('negative(禁止発動): B07005 がコンタクト参加キャラ → 自 cutin 不可 (canCutIn=false)', () => {
    const s = base('self');
    const mgUid = mutate.scene.enter(s, 'self', 'B07005', {}).uid; // 参加キャラ = 攻撃者
    const oppUid = mutate.scene.enter(s, 'opp', 'OPPDEF', {}).uid;
    s.players.self.hand = ['CUTIN'];
    expect(canCutIn(s, mkAx(mgUid, oppUid), 'self', 'CUTIN'), 'B07005 参加 → cutin 禁止').toBe(false);
  });

  it('positive: B07005 は盤面にいるが参加キャラでない (ATK が参加) → cutin 可 (canCutIn=true)', () => {
    const s = base('self');
    mutate.scene.enter(s, 'self', 'B07005', {}); // 盤面には居るが非参加
    const atkUid = mutate.scene.enter(s, 'self', 'ATK', {}).uid; // 参加キャラ = ATK
    const oppUid = mutate.scene.enter(s, 'opp', 'OPPDEF', {}).uid;
    s.players.self.hand = ['CUTIN'];
    expect(canCutIn(s, mkAx(atkUid, oppUid), 'self', 'CUTIN'), '参加キャラが B07005 でなければ cutin 可').toBe(true);
  });
});

// ============================================================================
// PR067 探偵の目 (case, continuous 2本)
// ============================================================================
describe('PR067 a1 partnerColorsOverride [青緑白赤黄黒]', () => {
  function ctxSelf(): EffectCtx {
    return { source: { player: 'self', area: 'scene', uid: '' }, bindings: {} } as unknown as EffectCtx;
  }

  it('positive: 事件=PR067 + パートナー印字[青のみ] → partnerColor黒 が override で成立', () => {
    const s = base('self');
    s.players.self.case.cardId = 'PR067';
    s.players.self.partner.cardId = 'PART_BLUEONLY'; // 印字色 青のみ
    expect(evalCond(s, { kind: 'partnerColor', color: '黒' }, ctxSelf()), 'override [..黒] で黒成立').toBe(true);
  });

  it('negative: 事件=DECOYCASE (override無) + パートナー[青のみ] → partnerColor黒 は不成立', () => {
    const s = base('self');
    s.players.self.case.cardId = 'DECOYCASE';
    s.players.self.partner.cardId = 'PART_BLUEONLY';
    expect(evalCond(s, { kind: 'partnerColor', color: '黒' }, ctxSelf()), '印字 青のみ → 黒不成立').toBe(false);
  });
});

describe('PR067 a2 sceneCapOverride 4', () => {
  it('positive: 事件=PR067 → 現場上限 4', () => {
    const s = base('self');
    s.players.self.case.cardId = 'PR067';
    expect(sceneCap(s, 'self'), 'PR067 で cap4').toBe(4);
  });

  it('negative: 事件=DECOYCASE (override無) → 既定上限 5', () => {
    const s = base('self');
    s.players.self.case.cardId = 'DECOYCASE';
    expect(sceneCap(s, 'self'), 'override無 → 既定5').toBe(5);
  });
});

// ============================================================================
// B07054 「アイスクリームは……甘いんだぜ!!」(event)
// ============================================================================
describe('B07054 a1【パートナー白】event-use → conditional(and[黒羽快斗, 中森青子])', () => {
  function board(partner: string, names: string[]): GameState {
    const s = base('self');
    s.players.self.case.colors = ['白']; // handUseCard color gate (B07054=白)
    s.players.self.partner.cardId = partner;
    s.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: 'DK' }));
    s.players.self.hand = ['B07054'];
    if (names.includes('黒羽快斗')) mutate.scene.enter(s, 'self', 'KAITO', {});
    if (names.includes('中森青子')) mutate.scene.enter(s, 'self', 'AOKO', {});
    mutate.scene.enter(s, 'self', 'REDCH', {}); // charModifyAP(白) 候補外 decoy
    const slUid = mutate.scene.enter(s, 'self', 'SLEEPER', {}).uid;
    mutate.scene.setState(s, slUid, 'sleep');    // stun 対象 (sleep, lv5)
    const s8Uid = mutate.scene.enter(s, 'self', 'SLEEP8', {}).uid;
    mutate.scene.setState(s, s8Uid, 'sleep');    // stun 候補外 decoy (lv8 sleep)
    return s;
  }

  it('positive: 白P + 黒羽快斗&中森青子 → then(3つとも): KAITO AP+2000&突撃 / SLEEPER stun / AOKO actionTargetsActive', () => {
    const s = board('PART_W', ['黒羽快斗', '中森青子']);
    const kaitoUid = s.players.self.scene.find((c) => c.cardId === 'KAITO')!.uid;
    const aokoUid = s.players.self.scene.find((c) => c.cardId === 'AOKO')!.uid;
    const sleeperUid = s.players.self.scene.find((c) => c.cardId === 'SLEEPER')!.uid;
    handUseCard(s, 'self', 'B07054');
    runAllUntilEmpty(s);
    // MANUAL-NOTE: この then は outer sequence の 3 サブ効果の pick が **逆順** に surface する
    //   (実測 2026-07-10): [0]=sceneSetState(stun) / [1]=charSetTurnEffect(actionTargetsActive) /
    //   [2]=charModifyAP(+2000&突撃)。各 atom は自身の対象を pick するため語義は保たれる (順序のみ engine 実測に追従)。
    const { recorded } = drainScript(s, [{ pickCardId: 'SLEEPER' }, { pickCardId: 'AOKO' }, { pickCardId: 'KAITO' }]);
    expect(recorded[0]?.verb, '[0] = sceneSetState(stun)').toBe('sceneSetState');
    expect(recorded[0]?.cardIds, 'stun 対象(sleep lv≤7) は lv8 SLEEP8 を除外').not.toContain('SLEEP8');
    expect(recorded[2]?.verb, '[2] = charModifyAP(白)').toBe('charModifyAP');
    expect(recorded[2]?.cardIds, 'charModifyAP(白) は 赤 REDCH を除外').not.toContain('REDCH');
    expect(engine.read.char.ap(s, kaitoUid), 'KAITO AP 3000+2000').toBe(5000);
    expect(engine.read.char.keywords(s, kaitoUid), 'KAITO に 突撃').toContain('突撃');
    expect(s.players.self.scene.find((c) => c.uid === sleeperUid)?.state, 'SLEEPER stun').toBe('stun');
    expect(engine.read.char.hasTextAbility(s, aokoUid, 'actionTargetsActive'), 'AOKO に actionTargetsActive 付与').toBe(true);
  });

  it('negative: パートナー青 → 【パートナー白】不成立 → 不発火 (prompt なし / AP据置)', () => {
    const s = board('PART_B', ['黒羽快斗', '中森青子']);
    const kaitoUid = s.players.self.scene.find((c) => c.cardId === 'KAITO')!.uid;
    handUseCard(s, 'self', 'B07054');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'partner白不成立 → pick なし').toBeNull();
    expect(_drainPendingEffectChoiceSide(), 'partner白不成立 → choice なし').toBeNull();
    expect(engine.read.char.ap(s, kaitoUid), 'KAITO AP 据置 3000').toBe(3000);
  });

  it('negative: 白P だが中森青子なし → and 不成立 → else(1つ選ぶ) → choice が surface', () => {
    const s = board('PART_W', ['黒羽快斗']); // 中森青子 不在
    const kaitoUid = s.players.self.scene.find((c) => c.cardId === 'KAITO')!.uid;
    handUseCard(s, 'self', 'B07054');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'else では pick が即 surface しない').toBeNull();
    expect(_drainPendingEffectChoiceSide(), '名2枚不成立 → else = choice surface').not.toBeNull();
    expect(engine.read.char.ap(s, kaitoUid), 'choice 未選択 → AP 据置 3000').toBe(3000);
  });
});
