// wave newbase (2026-06-24, engine変更0) — genuinely-new card 4枚の構造忠実性 + gate 評価 decoy。
//
// 検証対象 (catalog の絵柄違いではない新規 ability):
//   B06079 アンドレ・キャメル — 【登場時】enterSource(viaEffect) gate → seq[AP+1000 turn, 突撃 grant turn]
//   B03124 テキーラ — a1 partnerColorKeyword(黒,突撃) / a2 phase:end:start + and[turn self, or[charStateIs sleep,stun]] → self-remove
//   B03068 赤井秀一 — 【登場時】seq[sceneEnter from:hand(赤 Lv≤4 char, sleep), conditional not-bound → evidenceGain opp + draw]
//   PR094 = B03068 同 cardId 0322 promo (abilities 同一)
// (B06100/B06100P ベルモットは並行 session 56 が同 spec で出荷済 = main、本 wave からは除外)
// 実証元 exemplar: B06007/B01014(enterSource) / D03003(partnerColorKeyword) / B07021(phase-end self-remove) /
//   D09020/D05007(sceneEnter from:hand + bound)。
// rules: 13/15/17 + 03/05 + 22。BUG-117/118 教訓: 型に書けても engine が評価する保証はない → enterSource/charStateIs gate を evalCond で実評価。

import { describe, it, expect } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';
import type { Condition, EffectCtx } from '@/engine/types';
import { B06079 } from '@/cards/ct-p06/B06079';
import { B03124 } from '@/cards/ct-p03/B03124';
import { B03068 } from '@/cards/ct-p03/B03068';
import { PR094 } from '@/cards/pr-01/PR094';


const ctxPayload = (payload: unknown): EffectCtx =>
  ({ source: { cardId: 'X', uid: 'u0', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {}, triggerPayload: payload } as EffectCtx);
const ctxSelf = (uid: string, cardId: string): EffectCtx =>
  ({ source: { cardId, uid, abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx);

describe('wave newbase — B06079 アンドレ・キャメル (enterSource gate → turn buffs)', () => {
  const a1: any = B06079.abilities[0];
  it('構造: enter triggered + enterSource gate + seq[AP+1000 turn, 突撃 grant turn]', () => {
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    expect(a1.condition).toEqual({ kind: 'enterSource', viaEffect: true });
    const [ap, kw] = a1.effect.steps;
    expect(ap.verb).toBe('charModifyAP');
    expect(ap.args).toMatchObject({ uid: '$self', delta: 1000, scope: 'turn' });
    expect(kw.verb).toBe('charGrantKeyword');
    expect(kw.args).toMatchObject({ uid: '$self', kw: '突撃', scope: 'turn' }); // 付与なので keywords:[]
    expect(B06079.keywords ?? []).toEqual([]);
  });
  it('gate 実評価: 効果/能力による登場 (viaEffect:true) のみ true、手札/ネクストヒント (false/undefined) は false', () => {
    const s = createEmptyGameState();
    expect(evalCond(s, a1.condition as Condition, ctxPayload({ viaEffect: true }))).toBe(true);
    expect(evalCond(s, a1.condition as Condition, ctxPayload({ viaEffect: false }))).toBe(false);
    expect(evalCond(s, a1.condition as Condition, ctxPayload(undefined))).toBe(false);
  });
});

describe('wave newbase — B03124 テキーラ (partnerColor 突撃 / phase-end self-remove)', () => {
  const a1: any = B03124.abilities[0];
  const a2: any = B03124.abilities[1];
  it('a1: partnerColorKeyword(黒,突撃) continuous', () => {
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '黒' });
    expect(a1.continuousModifier.grantKeywords()).toEqual(['突撃']);
  });
  it('a2: phase:end:start triggered → sceneRemove $self、partnerColor 非依存 (qAndA)', () => {
    expect(a2.trigger).toEqual({ hook: 'phase:end:start' });
    expect(a2.effect).toEqual({ kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } });
    expect(JSON.stringify(a2.condition)).not.toContain('partnerColor'); // 突撃のみ partnerColor-gated
  });
  it.each([
    ['self', 'sleep', true], ['self', 'stun', true], ['self', 'active', false], ['opp', 'sleep', false], ['opp', 'stun', false],
  ] as const)('gate 実評価: turn=%s self=%s → %s', (turnPlayer, st, expected) => {
    const s = createEmptyGameState();
    s.turn = { number: 6, player: turnPlayer, phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B03124', 't0', { state: st })];
    expect(evalCond(s, a2.condition as Condition, ctxSelf('t0', 'B03124'))).toBe(expected);
  });
});

describe('wave newbase — B03068 / PR094 赤井秀一 (enter optional-summon else evidence+draw)', () => {
  it.each([['B03068', B03068], ['PR094', PR094]] as const)('%s: enter seq[sceneEnter from:hand 赤Lv≤4 char sleep, conditional not-bound → evidenceGain opp + draw]', (_id, card) => {
    const a1: any = card.abilities[0];
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    const [enter, cond] = a1.effect.steps;
    expect(enter.verb).toBe('sceneEnter');
    expect(enter.args.from).toBe('hand');
    expect(enter.args.enterSleep).toBe(true); // スリープ状態で登場
    expect(enter.args.target.query.filter).toEqual({ color: '赤', levelMax: 4, kind: 'character' }); // キャラ→kind:character (BUG-123)
    expect(enter.args.target.n).toEqual({ min: 0, max: 1 }); // 「してもよい」= 0-or-1
    expect(cond.kind).toBe('conditional');
    expect(cond.if).toEqual({ kind: 'not', c: { kind: 'bound', key: '$matched', presence: 'matched' } }); // 登場しなかった場合
    const [ev, dr] = cond.then.steps;
    expect(ev).toEqual({ kind: 'atom', verb: 'evidenceGain', args: { player: 'opp', n: 1 } }); // 相手に証拠1 (必須)
    expect(dr).toEqual({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }); // 自分1ドロー (必須)
  });
  it('PR094 abilities = B03068 abilities (同 cardId 0322 promo, 構造一致)', () => {
    expect(JSON.stringify(PR094.abilities)).toBe(JSON.stringify(B03068.abilities));
  });
});
