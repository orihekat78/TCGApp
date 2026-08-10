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
// family残 (2026-06-15 cards/akamajutsu-family-2): caseTrait gate 解禁後に実装した【事件赤魔術】族。
import { B07031 } from '@/cards/ct-p07/B07031';
import { B07038 } from '@/cards/ct-p07/B07038';
import { B07047 } from '@/cards/ct-p07/B07047';
import { D01012 } from '@/cards/ct-d01/D01012'; // B07047 a3 (hirameki sleep) の byte 等価 exemplar

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
  [B07052, B07055, B07055P, B07058, B07058P, B07062, B07062P, B07031, B07038, B07047].forEach((c) => registerCardDef(c));
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

  it('ISOLATION: charRemoveSetCard n:2 removes two physical set-card occurrences from one host', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [
      makeChar({
        cardId: 'mine1',
        uid: 'm#1',
        state: 'active',
        setCards: [
          { cardId: 'sc-a', faceUp: false, instanceId: 'set:mine1:a' },
          { cardId: 'sc-b', faceUp: false, instanceId: 'set:mine1:b' },
        ] as never,
      }),
    ];
    registerCardDef(pchar('mine1'));

    const after = produce(s, (d) => {
      runEffect(d, {
        kind: 'atom',
        verb: 'charRemoveSetCard',
        args: {
          player: 'self',
          side: 'self',
          n: 2,
          minimumPolicy: 'exact',
          filter: { hasSetCards: true },
        },
      } as never, ctxFor('X', 'u'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });

    expect(after.players.self.scene[0]!.setCards).toEqual([]);
    expect(after.players.self.remove).toEqual(expect.arrayContaining(['sc-a', 'sc-b']));
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
    // exact 2枚のため候補不足では部分除去せず、chain後段も実行しない。
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

// ───────────────────────── B07047 中森銀三 (family残) ─────────────────────────
describe('B07047 中森銀三', () => {
  it('a1: 事件が赤魔術 trait を持つ間のみ continuous で突撃を持つ (caseTrait gate)', () => {
    const s1 = createEmptyGameState();
    setCase(s1, 'B07062'); // 赤魔術 case
    s1.players.self.scene = [makeChar({ cardId: 'B07047', uid: 'gin#1', state: 'active' })];
    expect(read.char.keywords(s1, 'gin#1'), '赤魔術事件 → 突撃').toContain('突撃');

    const s2 = createEmptyGameState();
    registerCardDef(pcase('plainCase47', ['まじっく快斗'])); // 赤魔術を持たない
    setCase(s2, 'plainCase47');
    s2.players.self.scene = [makeChar({ cardId: 'B07047', uid: 'gin#1', state: 'active' })];
    expect(read.char.keywords(s2, 'gin#1'), '非赤魔術事件 → 突撃なし').not.toContain('突撃');
  });

  it('a2: 【登場時】自分のデッキ上端1枚を裏向きでこのキャラ自身($self)にセット', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ cardId: 'B07047', uid: 'gin#1', state: 'active' })];
    s.players.self.deck = ['topCard', 'tail1', 'tail2'];
    registerCardDef(pchar('topCard'));
    const a2 = B07047.abilities[1] as AbilityDef;
    const after = produce(s, (d) => {
      runEffect(d, a2.effect!, ctxFor('B07047', 'gin#1')); // $self = source.uid = gin#1
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    const self = after.players.self.scene.find((c) => c.uid === 'gin#1')!;
    expect(self.setCards?.length, 'このキャラ自身にデッキ上端を1枚set').toBe(1);
    expect(after.players.self.deck, 'デッキ上端 topCard が消費される').not.toContain('topCard');
    expect(after.players.self.deck.length, '3→2').toBe(2);
  });

  it('a3: 【ヒラメキ】キャラを1枚まで選び、スリープさせる = D01012 a2 と byte 等価 (trigger/effect 完全一致)', () => {
    // hirameki の uid:'$pick'+target carrier は hiramekiResolve の chooseAtomTarget auto-resolve 経路で
    //   解決される設計 (直接 runEffect+drain では解決されない、B02023 コメント参照)。挙動は D01012 a2 で実証済の
    //   verbatim 再利用なので、ここでは shipped exemplar との構造完全一致を以て等価性を保証する。
    const a3 = B07047.abilities[2] as AbilityDef;
    const d01012a2 = D01012.abilities[1] as AbilityDef;
    expect(a3.trigger, 'trigger = evidence:remove-by-action optional (D01012 a2 同一)').toEqual(d01012a2.trigger);
    expect(a3.effect, 'effect = sceneSetState sleep pick(scene,either,0-1) (D01012 a2 と完全一致)').toEqual(d01012a2.effect);
    expect(a3.scope).toBe('on-evidence');
  });
});

// ───────────────────────── B07031 小泉紅子 (family残) ─────────────────────────
describe('B07031 小泉紅子', () => {
  it('a1: 【登場時】自分のデッキ上端1枚を裏向きでこのキャラ自身($self)にセット', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ cardId: 'B07031', uid: 'kk#1', state: 'active' })];
    s.players.self.deck = ['topCard', 'tail1'];
    registerCardDef(pchar('topCard'));
    const a1 = B07031.abilities[0] as AbilityDef;
    const after = produce(s, (d) => {
      runEffect(d, a1.effect!, ctxFor('B07031', 'kk#1'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    expect(after.players.self.scene.find((c) => c.uid === 'kk#1')!.setCards?.length, 'このキャラにset').toBe(1);
    expect(after.players.self.deck, 'topCard 消費').not.toContain('topCard');
  });

  it('a2 構造: declared + caseTrait赤魔術 + cost pay[sleepSelf, removeFromHand] + seq[sceneRemove, optional{chain[charRemoveSetCard n:2, sceneEnter remove]}]', () => {
    const a2 = B07031.abilities[1] as AbilityDef;
    expect(a2.type).toBe('declared');
    expect(a2.condition).toEqual({ kind: 'caseTrait', trait: '赤魔術' });
    const cost = a2.cost as { kind: string; items: Array<{ kind: string }> };
    expect(cost.kind).toBe('pay');
    expect(cost.items.map((i) => i.kind)).toEqual(['sleepSelf', 'removeFromHand']);
    const seq = a2.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(seq.steps[0]).toMatchObject({ verb: 'sceneRemove', args: { max: 1, side: 'either' } });
    const opt = seq.steps[1] as { kind: string; effect: { kind: string; steps: Array<{ verb: string; args: Record<string, unknown> }> } };
    expect(opt.kind).toBe('optional');
    expect(opt.effect.kind).toBe('chain');
    expect(opt.effect.steps[0]).toMatchObject({ verb: 'charRemoveSetCard', args: { side: 'self', n: 2, filter: { hasSetCards: true } } });
    expect(opt.effect.steps[1]).toMatchObject({ verb: 'sceneEnter', args: { from: 'remove', viaEffect: true } });
  });

  it('a2 挙動: 自場2キャラの set card を計2枚リムーブ → そうした場合 リムーブの白L3を登場 (human path)', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [
      makeChar({ cardId: 'mine1', uid: 'm#1', state: 'active', setCards: [{ cardId: 'sc-a', faceUp: false }] as never }),
      makeChar({ cardId: 'mine2', uid: 'm#2', state: 'active', setCards: [{ cardId: 'sc-b', faceUp: false }] as never }),
    ];
    s.players.opp.scene = [makeChar({ cardId: 'oppTgt', uid: 'o#1', state: 'sleep' })]; // clause1 の sink
    s.players.self.remove = ['shiroL3'];
    ['mine1', 'mine2', 'oppTgt'].forEach((id) => registerCardDef(pchar(id, { ap: 5000 })));
    registerCardDef(pchar('shiroL3', { colors: ['白'], level: 3, ap: 4000 }));
    const a2 = B07031.abilities[1] as AbilityDef;
    const ctx: EffectCtx = { source: { cardId: 'B07031', uid: 'kk#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {}, dyn: { optionalRun: true } };
    const after = produce(s, (d) => {
      runEffect(d, a2.effect!, ctx);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    const setLeft = after.players.self.scene.reduce((n, c) => n + (c.setCards?.length ?? 0), 0);
    expect(setLeft, '自場 set card 計2枚リムーブ → 残0').toBe(0);
    expect(after.players.self.scene.find((c) => c.cardId === 'shiroL3'), 'リムーブの白L3 を reanimate').toBeTruthy();
    expect(after.players.self.remove, 'shiroL3 はリムーブから抜ける').not.toContain('shiroL3');
  });

  it('a2 挙動: 自場に set card 0枚なら clause2 reanimate は不発 (chain break)', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ cardId: 'mine1', uid: 'm#1', state: 'active' })]; // set なし
    s.players.opp.scene = [makeChar({ cardId: 'oppTgt', uid: 'o#1', state: 'sleep' })];
    s.players.self.remove = ['shiroL3'];
    ['mine1', 'oppTgt'].forEach((id) => registerCardDef(pchar(id)));
    registerCardDef(pchar('shiroL3', { colors: ['白'], level: 3 }));
    const a2 = B07031.abilities[1] as AbilityDef;
    const ctx: EffectCtx = { source: { cardId: 'B07031', uid: 'kk#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {}, dyn: { optionalRun: true } };
    const after = produce(s, (d) => {
      runEffect(d, a2.effect!, ctx);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    expect(after.players.self.scene.find((c) => c.cardId === 'shiroL3'), 'set 0枚 → reanimate 不発').toBeFalsy();
    expect(after.players.self.remove, 'shiroL3 はリムーブに残る').toContain('shiroL3');
  });
});

// ───────────────────────── B07038 紅子の執事 (family残) ─────────────────────────
describe('B07038 紅子の執事', () => {
  it('a1 構造: seq[deckRevealUntil(closure filter), conditional handAddFromDeck, deckToBottomBound, deckShuffle, conditional discard]', () => {
    const a1 = B07038.abilities[0] as AbilityDef;
    const seq = a1.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(seq.steps.map((x) => (x as { verb?: string; kind: string }).verb ?? (x as { kind: string }).kind))
      .toEqual(['deckRevealUntil', 'conditional', 'deckToBottomBound', 'deckShuffle', 'conditional']);
    expect(typeof (seq.steps[0] as { args: { filter: unknown } }).args.filter, 'filter は closure (function)').toBe('function');
    expect((seq.steps[4] as { then: { verb: string; args: Record<string, unknown> } }).then).toMatchObject({ verb: 'discard', args: { n: 1 } });
  });

  it('a1 挙動: 赤魔術event(B07055)が出るまで公開→手札へ → 加えたので手札1リムーブ / decoy はデッキ下', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['keep']; // 既存手札 (discard の対象差分検証用)
    s.players.self.deck = ['decoyChar', 'B07055', 'tail1'];
    registerCardDef(pchar('decoyChar', { colors: ['白'] })); // 名前小泉紅子でも赤魔術eventでもない
    registerCardDef(pchar('keep'));
    const a1 = B07038.abilities[0] as AbilityDef;
    const after = produce(s, (d) => {
      runEffect(d, a1.effect!, ctxFor('B07038', 'butler#1'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    expect(after.players.self.deck, 'B07055 はデッキから抜ける (手札へ)').not.toContain('B07055');
    expect(after.players.self.deck, 'decoyChar はデッキ下に残る').toContain('decoyChar');
    // 1枚加え + 1枚 discard → net hand.length 不変 (1)
    expect(after.players.self.hand.length, '加えた → 手札1リムーブ (net 1)').toBe(1);
  });

  it('a1 挙動: カード名[小泉紅子]のキャラ(B07031)でも match して手札へ (OR の名前枝, rules/19)', () => {
    const s = createEmptyGameState();
    s.players.self.hand = [];
    s.players.self.deck = ['decoyChar', 'B07031', 'tail1']; // B07031 = 小泉紅子 (character)
    registerCardDef(pchar('decoyChar', { colors: ['白'] }));
    const a1 = B07038.abilities[0] as AbilityDef;
    const after = produce(s, (d) => {
      runEffect(d, a1.effect!, ctxFor('B07038', 'butler#1'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    // B07031 が match → 手札へ → 加えたので手札1リムーブ (加えた1枚=B07031 を捨てるしかない) → 手札0
    expect(after.players.self.deck, 'B07031(小泉紅子) は match → デッキから抜ける').not.toContain('B07031');
    expect(after.players.self.deck, 'decoyChar はデッキ下に残る').toContain('decoyChar');
  });

  it('a1 挙動: 該当無し全公開 → 何も加えず手札リムーブもしない (公式Q&A)', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['keep'];
    s.players.self.deck = ['decoy1', 'decoy2'];
    registerCardDef(pchar('decoy1', { colors: ['白'] }));
    registerCardDef(pevent('decoy2', { colors: ['白'] })); // trait なし event = 赤魔術 でない
    registerCardDef(pchar('keep'));
    const a1 = B07038.abilities[0] as AbilityDef;
    const after = produce(s, (d) => {
      runEffect(d, a1.effect!, ctxFor('B07038', 'butler#1'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    expect(after.players.self.hand, '何も加えず手札リムーブもしない → keep のまま').toEqual(['keep']);
    expect(after.players.self.deck.length, '全部デッキに残る (シャッフルのみ)').toBe(2);
  });

  it('a2: 【カットイン】AP＋1000 構造 ($contact.byUid を contact scope で +1000)', () => {
    const a2 = B07038.abilities[1] as AbilityDef;
    expect(a2.scope).toBe('on-hand');
    expect(a2.trigger).toMatchObject({ hook: 'effect:declared', optional: true, selfOnly: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } });
  });
});
