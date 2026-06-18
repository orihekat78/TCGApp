// engine拡張 wave#2 cluster15 follow-up — removal-observer + keyword-grant closure 群 gate5 実機検証
// 対象: B06038 鬼丸猛 / B06039 沖田総司 / B08010 真田貴大 / B09071 萩原千速 (cluster15 反撃一族 partnerColorKeyword/絆 follow-up)。
//
// 検証2層 (「画面処理 = カードテキスト文言」1対1):
//   A. removal-observer 条件 gating (共通 condition removedCharMatches{side:'opp',cause:'contact-ap',by:'self'}):
//      「相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき」を decoy で 1対1 に固定。
//      end-to-end contact (declare→passGuard→snapshotAP→judge) で発火 / cause≠contact・by≠self・side≠opp で非発火。
//   B. effect/grant 形 1対1: 各カードの a* effect 値 (draw/discard 側・sleep pick・hirameki $pick・charSetTurnEffect・
//      partnerColorKeyword grant・絆 bond grant・【ターン1】limit) が公式文言どおりであること。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { declare, passGuard, snapshotAP, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { judge } from '@/engine/flow/contact';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { B06038 } from '@/cards/ct-p06/B06038';
import { B06039 } from '@/cards/ct-p06/B06039';
import { B08010 } from '@/cards/ct-p08/B08010';
import { B09071 } from '@/cards/ct-p09/B09071';
import type { GameState, CardDef, EffectDescriptor, AbilityDef, Condition } from '@/engine/types';

function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.id, kind: 'character', names: o.names ?? [o.id], colors: o.colors ?? ['緑'],
    level: o.level ?? 1, ap: o.ap ?? 1000, lp: o.lp ?? 1000, traits: o.traits ?? [],
    rarity: 'C', imageUrl: '', abilities: o.abilities ?? [], ruleRefs: [], ...o,
  };
}
// effect tree を walk して最初の指定 verb の args を返す。
function findArgs(eff: EffectDescriptor | undefined, verb: string): Record<string, unknown> | null {
  if (!eff || typeof eff !== 'object') return null;
  const e = eff as Record<string, unknown>;
  if (e.kind === 'atom' && e.verb === verb) return e.args as Record<string, unknown>;
  for (const k of ['effect', 'then', 'else']) {
    const r = findArgs(e[k] as EffectDescriptor | undefined, verb);
    if (r) return r;
  }
  for (const s of (e.steps as EffectDescriptor[] | undefined) ?? []) {
    const r = findArgs(s, verb);
    if (r) return r;
  }
  for (const o of (e.options as EffectDescriptor[] | undefined) ?? []) {
    const r = findArgs(o, verb);
    if (r) return r;
  }
  return null;
}
function observerFired(after: GameState, observerUid: string): boolean {
  return after.pendingEffects.some(
    (pe) => pe.triggeredBy?.hook === 'leave:to-remove' && pe.source?.uid === observerUid,
  );
}
function ab(card: CardDef, id: string): AbilityDef {
  return card.abilities.find((a) => a.id === id)! as AbilityDef;
}

// ───────────────────────── A. removal-observer 条件 gating (end-to-end contact) ─────────────────────────
describe('cluster15-followup removal-observer — 「このキャラとのコンタクトで相手キャラ除去時」decoy 1対1', () => {
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); _resetActionContexts(); _resetUidCounter(); _resetRegistry();
    registerAll();
    registerCardDef(defOf({ id: 'VIC', ap: 1000, traits: [] })); // 弱victim (能力無)
    registerTriggeredListener();
  });

  // A1 (発火): 鬼丸(AP8000) が opp victim を contact 除去 → observer 発火 (byUid 配線)
  it('A1 end-to-end: 自キャラがコンタクトで相手キャラを除去 → 発火 (B06038)', () => {
    let obsUid = '', removed = false;
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'B06038', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.setState(d, v.uid, 'sleep');
      const ax = declare(d, obsUid, { kind: 'char', uid: v.uid });
      passGuard(d, ax); snapshotAP(d, ax);
      removed = judge(d, ax).defenderRemoved;
    });
    expect(removed).toBe(true);
    expect(observerFired(after, obsUid)).toBe(true);
  });

  // A2 (非発火): cause=effect (非コンタクト除去) → cause leg
  it('A2: cause=effect (非コンタクト) では非発火 (cause:contact-ap leg)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'B06038', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect', obsUid);
    });
    expect(observerFired(after, obsUid)).toBe(false);
  });

  // A3 (非発火): 除去者が別の自キャラ (by≠self) → 「このキャラとの」自己限定 (by:'self')
  it('A3: 除去者が別の自キャラの場合は非発火 (by:self 自己限定)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'B06038', {}).uid;
      const other = mutate.scene.enter(d, 'self', 'VIC', {});
      const v = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, v.uid, 'contact-ap', other.uid); // 除去者=別キャラ
    });
    expect(observerFired(after, obsUid)).toBe(false);
  });

  // A4 (非発火): 除去されたのが自分のキャラ (side≠opp) → 「相手の現場にいるキャラ」限定 (side:'opp')
  it('A4: 自分のキャラがコンタクト除去されても非発火 (side:opp 限定)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'B06038', {}).uid;
      const ownVic = mutate.scene.enter(d, 'self', 'VIC', {});
      mutate.scene.removeToRemove(d, ownVic.uid, 'contact-ap', obsUid); // 除去されたのは自分側
    });
    expect(observerFired(after, obsUid)).toBe(false);
  });

  // A5 (発火, sleep + 【ターン1】): B09071 萩原 (AP8000) が opp 除去 → 発火
  it('A5 end-to-end: B09071 もコンタクト除去で発火 (【ターン1】removal-observer)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'B09071', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.setState(d, v.uid, 'sleep');
      const ax = declare(d, obsUid, { kind: 'char', uid: v.uid });
      passGuard(d, ax); snapshotAP(d, ax);
      judge(d, ax);
    });
    expect(observerFired(after, obsUid)).toBe(true);
  });
});

// ───────────────────────── B. effect / grant 形 1対1 ─────────────────────────
describe('cluster15-followup effect/grant — 公式文言 1対1 pin', () => {
  function obsCond(card: CardDef, id: string): Condition {
    return ab(card, id).condition as Condition;
  }
  // 共通 condition: 全カードの removal-observer leg が removedCharMatches{side:opp,cause:contact-ap,by:self}
  it('removal-observer condition は全カード {side:opp, cause:contact-ap, by:self}', () => {
    for (const [card, id] of [[B06038, 'a2'], [B06039, 'a3'], [B08010, 'a2'], [B09071, 'a3']] as const) {
      const c = obsCond(card, id) as { kind: string; side: string; cause: string; by: string };
      expect(c.kind).toBe('removedCharMatches');
      expect(c.side).toBe('opp');
      expect(c.cause).toBe('contact-ap');
      expect(c.by).toBe('self');
      expect(ab(card, id).trigger).toMatchObject({ hook: 'leave:to-remove' });
      expect((ab(card, id).trigger as { selfOnly?: boolean }).selfOnly).toBeUndefined(); // 他者除去観測 (自身被除去でない)
    }
  });

  // B06038: a2 = draw{self,1} / a3 = evidence:gain selfOnly → 相手 discard{opp,1}
  it('B06038 a2=draw(self,1) / a3=evidence:gain selfOnly→discard(opp,1)', () => {
    expect(findArgs(ab(B06038, 'a2').effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
    expect(ab(B06038, 'a3').trigger).toMatchObject({ hook: 'evidence:gain', selfOnly: true });
    expect(findArgs(ab(B06038, 'a3').effect, 'discard')).toMatchObject({ player: 'opp', n: 1 });
  });

  // B06039: a1 partnerColor緑突撃[キャラ] / a2 自ターン中AP+1000 / a3 draw+self discard / a4 hirameki sleep $pick
  it('B06039 a1 grant=突撃[キャラ](パートナー緑) / a2 apDelta+1000(自ターン) / a3 draw+discard(self) / a4 hirameki $pick', () => {
    const a1 = ab(B06039, 'a1');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '緑' });
    expect(a1.continuousModifier!.grantKeywords!(createEmptyGameState(), {} as never)).toEqual(['突撃[キャラ]']);
    const a2 = ab(B06039, 'a2');
    expect(a2.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(a2.continuousModifier).toMatchObject({ apDelta: 1000 });
    expect(findArgs(ab(B06039, 'a3').effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
    expect(findArgs(ab(B06039, 'a3').effect, 'discard')).toMatchObject({ player: 'self', n: 1 }); // 自手札リムーブ
    const a4 = ab(B06039, 'a4');
    expect(a4.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    const ss = findArgs(a4.effect, 'sceneSetState')!;
    expect(ss.state).toBe('sleep');
    expect(ss.uid).toBe('$pick'); // hirameki は明示 $pick + pick query を保持 (auto-resolve)
    expect(ss.target).toMatchObject({ kind: 'pick', n: { min: 0, max: 1 }, chooser: 'self' });
  });

  // B08010: a1 = 絆比護隆佑 bond grant 突撃[キャラ] / a2 = draw{self,1}
  it('B08010 a1=絆比護隆佑 bond grant 突撃[キャラ] / a2=draw(self,1)', () => {
    const a1 = ab(B08010, 'a1');
    expect(a1.condition).toMatchObject({ kind: 'bond', cardName: '比護隆佑' });
    expect(a1.continuousModifier!.grantKeywords!(createEmptyGameState(), {} as never)).toEqual(['突撃[キャラ]']);
    expect(findArgs(ab(B08010, 'a2').effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
  });

  // B09071: a1 partnerColor黄突撃 / a2 疾風→actionTargetsActive self-grant / a3 【ターン1】+ sleep短縮形
  it('B09071 a1=突撃(パートナー黄) / a2=疾風 charSetTurnEffect(actionTargetsActive,$self) / a3=【ターン1】sleep短縮形', () => {
    const a1 = ab(B09071, 'a1');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '黄' });
    expect(a1.continuousModifier!.grantKeywords!(createEmptyGameState(), {} as never)).toEqual(['突撃']);
    const a2 = ab(B09071, 'a2');
    expect(a2.trigger).toMatchObject({ hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } });
    expect(findArgs(a2.effect, 'charSetTurnEffect')).toMatchObject({ uid: '$self', key: 'actionTargetsActive', val: true });
    const a3 = ab(B09071, 'a3');
    expect(a3.limit).toMatchObject({ kind: 'turn', n: 1 }); // 【ターン1】
    expect(findArgs(a3.effect, 'sceneSetState')).toMatchObject({ player: 'self', max: 1, side: 'either', state: 'sleep' });
  });
});
