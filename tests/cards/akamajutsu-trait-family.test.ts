// 赤魔術 trait family — 構造 + 実 engine 挙動テスト。
//   データ補完: 公式 API category1/2 由来の 赤魔術 trait を event(B07055/B07058)/case(B07062) に投入。
//   TSV 抽出が event/case の category(特徴) を全件 drop していた (field-drop, BUG-124 同族) のを是正。
//
// 検証対象 (新挙動):
//   - B07062 caseTraits:['まじっく快斗','赤魔術'] → 【事件赤魔術】が充足可能 (caseTrait condition)。
//   - B07052 a1 = caseTraitConditioned continuous grantKeywords['突撃'] (事件が赤魔術 trait を持つ間のみ突撃)。
//   - B07052 a2 = forced reveal-until(trait:赤魔術,event) → 手札 → 残りデッキ下 → シャッフル。
//   - B07055 clause2 = 「合わせて2枚」charRemoveSetCard n:{2,2} optional gate (unprecedented — 本テストが正本)。
//   - B07058 = reanimate(remove,白L3) bind:$entered → AP+3000/突撃[キャラ]/デッキ上端set を entered へ。
// rules: 13/15/16/17/20/24/26 + TSV qAndA

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { makeChar } from '../helpers/fixtures';
import type { CardDef, GameState, EffectCtx, AbilityDef } from '@/engine/types';
import { B07052 } from '@/cards/ct-p07/B07052';
import { B07055 } from '@/cards/ct-p07/B07055';
import { B07055P } from '@/cards/ct-p07/B07055P';
import { B07058 } from '@/cards/ct-p07/B07058';
import { B07058P } from '@/cards/ct-p07/B07058P';
import { B07062 } from '@/cards/ct-p07/B07062';
import { B07062P } from '@/cards/ct-p07/B07062P';

// テスト用 plain char def (任意の色/特徴/AP/レベル)。
function pchar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'],
    level: 3, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
function pevent(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: ['白'],
    level: 5, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
function pcase(id: string, caseTraits: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'case', names: [id], colors: ['白'], traits: [],
    rarity: 'C', imageUrl: '', caseLevel: 7, caseTraits, abilities: [], ruleRefs: [],
  };
}

function setCase(s: GameState, cardId: string) {
  s.players.self.case = { cardId, status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} } as GameState['players']['self']['case'];
}

const ctxFor = (cardId: string, uid = 'u'): EffectCtx => ({
  source: { cardId, uid, abilityId: 'a1', player: 'self', area: 'scene' },
  bindings: {},
});

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  _resetUidCounter();
  // family の実カードを登録
  [B07052, B07055, B07055P, B07058, B07058P, B07062, B07062P].forEach((c) => registerCardDef(c));
});

// ───────────────────────── データ補完: caseTraits / event traits ─────────────────────────
describe('赤魔術 trait データ補完', () => {
  it('B07062 caseTraits = [まじっく快斗, 赤魔術] / B07062P が spread 継承', () => {
    expect(B07062.caseTraits).toEqual(['まじっく快斗', '赤魔術']);
    expect(B07062P.caseTraits).toEqual(['まじっく快斗', '赤魔術']);
  });
  it('B07055/B07058 (event) traits = [赤魔術] / P が spread 継承', () => {
    expect(B07055.traits).toEqual(['赤魔術']);
    expect(B07055P.traits).toEqual(['赤魔術']);
    expect(B07058.traits).toEqual(['赤魔術']);
    expect(B07058P.traits).toEqual(['赤魔術']);
  });
});

// ───────────────────────── B07052 ルシュファー ─────────────────────────
describe('B07052 ルシュファー', () => {
  it('a1: 事件が赤魔術 trait を持つ間のみ continuous で突撃を持つ (caseTrait gate)', () => {
    // 赤魔術 case (B07062) → 突撃あり
    const s1 = createEmptyGameState();
    setCase(s1, 'B07062');
    s1.players.self.scene = [makeChar({ cardId: 'B07052', uid: 'lush#1', state: 'active' })];
    expect(read.char.keywords(s1, 'lush#1'), '赤魔術事件 → 突撃').toContain('突撃');

    // 非赤魔術 case → 突撃なし (条件未達 = 非所持 rules/17)
    const s2 = createEmptyGameState();
    registerCardDef(pcase('plainCase', ['まじっく快斗'])); // 赤魔術を持たない
    setCase(s2, 'plainCase');
    s2.players.self.scene = [makeChar({ cardId: 'B07052', uid: 'lush#1', state: 'active' })];
    expect(read.char.keywords(s2, 'lush#1'), '非赤魔術事件 → 突撃なし').not.toContain('突撃');
  });

  it('a1 構造: caseTraitConditioned(赤魔術) + continuous grantKeywords', () => {
    const a1 = B07052.abilities[0] as AbilityDef;
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'caseTrait', trait: '赤魔術' });
    expect(typeof (a1.continuousModifier as { grantKeywords: () => string[] }).grantKeywords).toBe('function');
    expect((a1.continuousModifier as { grantKeywords: () => string[] }).grantKeywords()).toEqual(['突撃']);
  });

  it('a2: デッキの赤魔術イベント(B07055)が出るまで公開→手札へ / 残りデッキ下 + シャッフル', () => {
    const s = createEmptyGameState();
    // deck top: 非赤魔術decoy → 赤魔術event(B07055) → 以降
    s.players.self.deck = ['decoyChar', 'decoyEvent', 'B07055', 'tail1', 'tail2'];
    registerCardDef(pchar('decoyChar', { colors: ['白'] }));
    registerCardDef(pevent('decoyEvent', { colors: ['白'] })); // trait なし event = 不一致
    const a2 = B07052.abilities[1] as AbilityDef;
    const after = produce(s, (d) => {
      runEffect(d, a2.effect!, ctxFor('B07052', 'lush#1'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    expect(after.players.self.hand, '赤魔術event を手札へ').toContain('B07055');
    expect(after.players.self.deck, 'B07055 はデッキから抜ける').not.toContain('B07055');
    // 公開した decoy 2枚はデッキに残る (下へ)
    expect(after.players.self.deck).toContain('decoyChar');
    expect(after.players.self.deck).toContain('decoyEvent');
    expect(after.players.self.deck.length, 'B07055 だけ抜けて 4 枚').toBe(4);
  });

  it('a2: デッキに赤魔術イベントが無ければ何も加えず全部デッキに残る (公式Q&A 全公開)', () => {
    const s = createEmptyGameState();
    s.players.self.deck = ['decoyChar', 'decoyEvent'];
    registerCardDef(pchar('decoyChar', { colors: ['白'] }));
    registerCardDef(pevent('decoyEvent', { colors: ['白'] }));
    const a2 = B07052.abilities[1] as AbilityDef;
    const after = produce(s, (d) => {
      runEffect(d, a2.effect!, ctxFor('B07052', 'lush#1'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    expect(after.players.self.hand.length, '何も加えない').toBe(0);
    expect(after.players.self.deck.length, '全部デッキに残る').toBe(2);
  });
});

// ───────────────────────── B07055 紅の盟約 (forced-2 が正本) ─────────────────────────
describe('B07055 紅の盟約', () => {
  it('構造: and[caseTrait赤魔術, partnerColor白] + seq[sceneRemove apMax8000, optional{chain[charRemoveSetCard n:2, sceneRemove apMax6000]}]', () => {
    const a1 = B07055.abilities[0] as AbilityDef;
    expect(a1.condition).toEqual({ kind: 'and', cs: [{ kind: 'caseTrait', trait: '赤魔術' }, { kind: 'partnerColor', color: '白' }] });
    const seq = a1.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(seq.kind).toBe('sequence');
    expect(seq.steps[0]).toMatchObject({ verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { apMax: 8000 } } });
    const opt = seq.steps[1] as { kind: string; effect: { kind: string; steps: Array<{ verb: string; args: Record<string, unknown> }> } };
    expect(opt.kind).toBe('optional');
    expect(opt.effect.kind).toBe('chain');
    expect(opt.effect.steps[0]).toMatchObject({ verb: 'charRemoveSetCard', args: { side: 'self', n: 2, filter: { hasSetCards: true } } });
    expect(opt.effect.steps[1]).toMatchObject({ verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { apMax: 6000 } } });
  });

  it('ISOLATION: charRemoveSetCard n:{2,2} 単独で 2キャラの set card を計2枚リムーブできるか', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [
      makeChar({ cardId: 'mine1', uid: 'm#1', state: 'active', setCards: [{ cardId: 'sc-a', faceUp: false }] as never }),
      makeChar({ cardId: 'mine2', uid: 'm#2', state: 'active', setCards: [{ cardId: 'sc-b', faceUp: false }] as never }),
    ];
    registerCardDef(pchar('mine1'));
    registerCardDef(pchar('mine2'));
    const after = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', side: 'self', n: 2, filter: { hasSetCards: true } } } as never, ctxFor('X', 'u'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    const setLeft = after.players.self.scene.reduce((n, c) => n + (c.setCards?.length ?? 0), 0);
    expect(setLeft, 'n:{2,2} 単独で set card 計2枚リムーブ').toBe(0);
  });

  it('挙動: 自場の2キャラの set card を計2枚リムーブ → そうした場合 AP6000以下を追加リムーブ', () => {
    const s = createEmptyGameState();
    // 自分の現場: set card を持つキャラ2枚 (+ set なし decoy)
    s.players.self.scene = [
      makeChar({ cardId: 'mine1', uid: 'm#1', state: 'active', setCards: [{ cardId: 'sc-a', faceUp: false }] as never }),
      makeChar({ cardId: 'mine2', uid: 'm#2', state: 'active', setCards: [{ cardId: 'sc-b', faceUp: false }] as never }),
      makeChar({ cardId: 'mine3', uid: 'm#3', state: 'active' }), // set なし decoy
    ];
    // 相手の現場: AP8000以下 (clause1 対象) + AP6000以下 (clause2 bonus 対象) + decoy AP高
    s.players.opp.scene = [
      makeChar({ cardId: 'opp8000', uid: 'o#8', state: 'sleep', apOverride: 8000 }),
      makeChar({ cardId: 'opp6000', uid: 'o#6', state: 'sleep', apOverride: 6000 }),
      makeChar({ cardId: 'oppHigh', uid: 'o#H', state: 'sleep', apOverride: 9000 }),
    ];
    [['mine1'], ['mine2'], ['mine3']].forEach(([id]) => registerCardDef(pchar(id, { ap: 5000 })));
    registerCardDef(pchar('opp8000', { ap: 8000 }));
    registerCardDef(pchar('opp6000', { ap: 6000 }));
    registerCardDef(pchar('oppHigh', { ap: 9000 }));

    const a1 = B07055.abilities[0] as AbilityDef;
    const ctx: EffectCtx = { source: { cardId: 'B07055', uid: 'u', abilityId: 'a1', player: 'self', area: 'hand' }, bindings: {}, dyn: { optionalRun: true } };
    const after = produce(s, (d) => {
      runEffect(d, a1.effect!, ctx);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });

    // clause2: 自場の set card が計2枚リムーブされた (2キャラとも setCards 空)
    const setLeft = after.players.self.scene.reduce((n, c) => n + (c.setCards?.length ?? 0), 0);
    expect(setLeft, '自場 set card を計2枚リムーブ → 残0').toBe(0);
    // clause1 で AP8000以下 1枚 + clause2 bonus で AP6000以下 1枚 → 相手キャラ2枚リムーブ (oppHigh のみ残存)
    const oppLeft = after.players.opp.scene.map((c) => c.uid);
    expect(oppLeft, 'AP9000 decoy は残る').toContain('o#H');
    expect(after.players.opp.scene.length, '相手キャラ 3→1 (clause1+clause2 で2枚除去)').toBe(1);
  });

  it('挙動: 自場に set card が0枚なら clause2 は何も起きず bonus も発火しない (chain break)', () => {
    // 注: 「1枚しか無い」場合 (候補<2 で opt-in) の挙動 (clamp して1枚除去+bonus か / 全不発か) は
    //   公式 Q&A 未裁定の edge。engine は n:2 を候補数に clamp する (known-gap、本 family メモ参照)。
    //   ここでは決定論的な 0枚ケース (候補ゼロ→pick 不成立→chain break→bonus skip) を検証する。
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ cardId: 'mine1', uid: 'm#1', state: 'active' })]; // set なし
    s.players.opp.scene = [
      makeChar({ cardId: 'opp8000', uid: 'o#8', state: 'sleep', apOverride: 8000 }),
      makeChar({ cardId: 'opp6000', uid: 'o#6', state: 'sleep', apOverride: 6000 }),
    ];
    registerCardDef(pchar('mine1', { ap: 5000 }));
    registerCardDef(pchar('opp8000', { ap: 8000 }));
    registerCardDef(pchar('opp6000', { ap: 6000 }));
    const a1 = B07055.abilities[0] as AbilityDef;
    const ctx: EffectCtx = { source: { cardId: 'B07055', uid: 'u', abilityId: 'a1', player: 'self', area: 'hand' }, bindings: {}, dyn: { optionalRun: true } };
    const after = produce(s, (d) => {
      runEffect(d, a1.effect!, ctx);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    // clause1 のみ成立 (AP8000以下1枚)。clause2 は set 0枚 → chain break → bonus 不発 → 相手は1枚だけ減る
    expect(after.players.opp.scene.length, 'clause1 の1枚のみ除去 (clause2 bonus 不発)').toBe(1);
  });
});

// ───────────────────────── B07058 心を盗む ─────────────────────────
describe('B07058 「私があなたの心を…盗んであげる…」', () => {
  it('構造: caseTrait赤魔術 + seq[sceneEnter remove bind$entered, conditional → AP+3000/突撃[キャラ]/charSetCard]', () => {
    const a1 = B07058.abilities[0] as AbilityDef;
    expect(a1.condition).toEqual({ kind: 'caseTrait', trait: '赤魔術' });
    const seq = a1.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(seq.steps[0]).toMatchObject({ verb: 'sceneEnter', args: { from: 'remove', bind: '$entered', viaEffect: true } });
    const cond = seq.steps[1] as { kind: string; if: { kind: string }; then: { steps: Array<{ verb: string; args: Record<string, unknown> }> } };
    expect(cond.kind).toBe('conditional');
    expect(cond.then.steps.map((x) => x.verb)).toEqual(['charModifyAP', 'charGrantKeyword', 'charSetCard']);
    expect(cond.then.steps[1].args).toMatchObject({ kw: '突撃[キャラ]', scope: 'turn' });
    expect(cond.then.steps[2].args).toMatchObject({ fromDeckTop: true, faceUp: false });
  });

  it('挙動: リムーブの白L3を登場 → そのキャラに AP+3000 / 突撃[キャラ] / デッキ上端1枚をset', () => {
    const s = createEmptyGameState();
    registerCardDef(pchar('shiroL3', { colors: ['白'], level: 3, ap: 4000 }));
    s.players.self.remove = ['shiroL3'];
    s.players.self.deck = ['toSet', 'tail'];
    registerCardDef(pchar('toSet'));
    const a1 = B07058.abilities[0] as AbilityDef;
    const after = produce(s, (d) => {
      runEffect(d, a1.effect!, ctxFor('B07058', 'u'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    const entered = after.players.self.scene.find((c) => c.cardId === 'shiroL3');
    expect(entered, 'リムーブから登場').toBeTruthy();
    expect(read.char.ap(after, entered!.uid), '基礎4000 + 3000(turn)').toBe(7000);
    expect(read.char.keywords(after, entered!.uid), '突撃[キャラ] 付与').toContain('突撃[キャラ]');
    expect(entered!.setCards?.length, 'デッキ上端1枚を裏向きでset').toBe(1);
    expect(after.players.self.remove, 'リムーブから抜ける').not.toContain('shiroL3');
    expect(after.players.self.deck, 'set した toSet はデッキから抜ける').not.toContain('toSet');
  });
});
