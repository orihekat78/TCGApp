// cluster3 action-lifecycle trigger 15枚 — 構造アサーション (transcription 回帰保護)
// engine 機構の挙動 pin は tests/engine/effect/wave2-cluster3-action-triggers.test.ts (25件)。
// 本ファイルは「実カードの AbilityDef が設計 v2 / TSV と語義 1対1 か」を機械検証する。
// spec: .claude/specs/engine-wave2-action-triggers-design.md (v2)

import { describe, it, expect } from 'vitest';
import { B01036 } from '@/cards/ct-p01/B01036';
import { B01037 } from '@/cards/ct-p01/B01037';
import { B01068 } from '@/cards/ct-p01/B01068';
import { B01067 } from '@/cards/ct-p01/B01067';
import { B02068 } from '@/cards/ct-p02/B02068';
import { B03097 } from '@/cards/ct-p03/B03097';
import { B03073 } from '@/cards/ct-p03/B03073';
import { D04005 } from '@/cards/ct-d04/D04005';
import { D04007 } from '@/cards/ct-d04/D04007';
import { B08012 } from '@/cards/ct-p08/B08012';
import { B08012P } from '@/cards/ct-p08/B08012P';
import { B08048 } from '@/cards/ct-p08/B08048';
import { B05108 } from '@/cards/ct-p05/B05108';
import { PR086 } from '@/cards/pr-01/PR086';
import { PR092 } from '@/cards/pr-01/PR092';
import type { AbilityDef, CardDef, Condition } from '@/engine/types';

const ab = (c: CardDef, id: string): AbilityDef => {
  const a = c.abilities.find((x) => x.id === id);
  if (!a) throw new Error(`${c.id} has no ability ${id}`);
  return a;
};
// matcherCondition の and 内に特定 kind があるか / 単独 kind か
const condKinds = (cond: Condition | undefined): string[] => {
  if (!cond) return [];
  if (cond.kind === 'and') return cond.cs.flatMap(condKinds);
  return [cond.kind];
};

describe('cluster3 a群: action-subtype trigger', () => {
  it('B01036: 【ターン1】action:declare + and[triggerActionKind char, triggerCharMatches self 緑] → sceneSetState sleep', () => {
    const a = ab(B01036, 'a1');
    expect(a.trigger?.hook).toBe('action:declare');
    expect(a.limit).toEqual({ kind: 'turn', n: 1 });
    const ks = condKinds(a.trigger?.matcherCondition);
    expect(ks).toContain('triggerActionKind');
    expect(ks).toContain('triggerCharMatches');
    // subtype = char、actor = self 側 緑
    const mc = a.trigger!.matcherCondition as Extract<Condition, { kind: 'and' }>;
    const tak = mc.cs.find((c) => c.kind === 'triggerActionKind') as Extract<Condition, { kind: 'triggerActionKind' }>;
    const tcm = mc.cs.find((c) => c.kind === 'triggerCharMatches') as Extract<Condition, { kind: 'triggerCharMatches' }>;
    expect(tak.v).toBe('char');
    expect(tcm.side).toBe('self');
    expect(tcm.filter?.color).toBe('緑');
    expect((a.effect as { verb?: string }).verb).toBe('sceneSetState');
    expect((a.effect as { args?: { state?: string; max?: number } }).args?.state).toBe('sleep');
    expect((a.effect as { args?: { max?: number } }).args?.max).toBe(1);
  });

  it('B01037: 同 trigger (char/self 緑) → sequence[draw1, discard1] + hirameki draw', () => {
    const a = ab(B01037, 'a1');
    expect(a.trigger?.hook).toBe('action:declare');
    expect(condKinds(a.trigger?.matcherCondition).sort()).toEqual(['triggerActionKind', 'triggerCharMatches']);
    const steps = (a.effect as { steps?: { verb?: string }[] }).steps ?? [];
    expect(steps.map((s) => s.verb)).toEqual(['draw', 'discard']);
    const h = ab(B01037, 'a2');
    expect(h.trigger?.hook).toBe('evidence:remove-by-action');
    expect(h.trigger?.optional).toBe(true);
  });

  it('B01068: selfOnly + triggerActionKind case → charGrantKeyword $self ブレット turn', () => {
    const a = ab(B01068, 'a1');
    expect(a.trigger?.hook).toBe('action:declare');
    expect(a.trigger?.selfOnly).toBe(true);
    expect((a.trigger?.matcherCondition as { kind?: string; v?: string })?.kind).toBe('triggerActionKind');
    expect((a.trigger?.matcherCondition as { v?: string })?.v).toBe('case');
    expect((a.effect as { verb?: string }).verb).toBe('charGrantKeyword');
    expect((a.effect as { args?: { kw?: string; scope?: string; uid?: string } }).args).toMatchObject({ uid: '$self', kw: 'ブレット', scope: 'turn' });
  });

  it('B02068: 【パートナー赤】event-use → charGrantAbility (granted action:declare case + optional chain[discard, ブレット])', () => {
    const a = ab(B02068, 'a1');
    expect(a.condition).toEqual({ kind: 'partnerColor', color: '赤' });
    expect(a.trigger?.hook).toBe('effect:declared');
    const args = (a.effect as { verb?: string; args?: Record<string, unknown> });
    expect(args.verb).toBe('charGrantAbility');
    expect(args.args?.scope).toBe('turn');
    expect((args.args?.filter as { color?: string })?.color).toBe('赤');
    const granted = args.args?.ability as AbilityDef;
    expect(granted.trigger?.hook).toBe('action:declare');
    expect(granted.trigger?.selfOnly).toBe(true);
    expect((granted.trigger?.matcherCondition as { v?: string })?.v).toBe('case');
    // granted descriptor は JSON のみ (matcher 関数禁止)
    expect(typeof (granted.trigger as { matcher?: unknown })?.matcher).toBe('undefined');
    expect((granted.effect as { kind?: string }).kind).toBe('optional');
  });

  it('B03097: action:declare and[char, triggerCharMatches opp filter{}] → charModifyAP self 目暮十三 +2000 scope action', () => {
    const a = ab(B03097, 'a1');
    const mc = a.trigger!.matcherCondition as Extract<Condition, { kind: 'and' }>;
    const tak = mc.cs.find((c) => c.kind === 'triggerActionKind') as Extract<Condition, { kind: 'triggerActionKind' }>;
    const tcm = mc.cs.find((c) => c.kind === 'triggerCharMatches') as Extract<Condition, { kind: 'triggerCharMatches' }>;
    expect(tak.v).toBe('char');
    expect(tcm.side).toBe('opp');
    expect(tcm.filter).toEqual({}); // 空 filter = パートナー除外 (DSL 罠)
    expect(a.limit).toBeUndefined(); // 【ターン1】無し = 毎回
    const e = a.effect as { verb?: string; args?: Record<string, unknown> };
    expect(e.verb).toBe('charModifyAP');
    expect(e.args).toMatchObject({ side: 'self', delta: 2000, scope: 'action', max: 1 });
    expect((e.args?.filter as { cardName?: string })?.cardName).toBe('目暮十三');
  });

  it('B08048: a1 selfOnly+case → sequence[charModifyLevel $trigger.targetUid -1 turn, conditional(levelMax6 → charModifyAP $self +3000 action)]; a2 enter sceneHas FBI → 突撃', () => {
    const a = ab(B08048, 'a1');
    expect(a.trigger?.selfOnly).toBe(true);
    expect((a.trigger?.matcherCondition as { v?: string })?.v).toBe('char');
    const steps = (a.effect as { steps?: unknown[] }).steps as { kind?: string; verb?: string; args?: Record<string, unknown>; if?: Condition; then?: { verb?: string; args?: Record<string, unknown> } }[];
    expect(steps[0].verb).toBe('charModifyLevel');
    expect(steps[0].args).toMatchObject({ uid: '$trigger.targetUid', delta: -1, scope: 'turn' });
    expect(steps[1].kind).toBe('conditional');
    const cif = steps[1].if as Extract<Condition, { kind: 'triggerCharMatches' }>;
    expect(cif.payloadKey).toBe('targetUid');
    expect(cif.filter?.levelMax).toBe(6);
    expect(steps[1].then?.verb).toBe('charModifyAP');
    expect(steps[1].then?.args).toMatchObject({ uid: '$self', delta: 3000, scope: 'action' });
    const a2 = ab(B08048, 'a2');
    expect(a2.trigger?.hook).toBe('enter');
  });

  it('D04005: action:declare and[case, triggerCharMatches self filter{}] → charGrantKeyword $self 突撃 turn; ミスリード無し', () => {
    const a = ab(D04005, 'a1');
    const mc = a.trigger!.matcherCondition as Extract<Condition, { kind: 'and' }>;
    expect((mc.cs.find((c) => c.kind === 'triggerActionKind') as { v?: string }).v).toBe('case');
    const tcm = mc.cs.find((c) => c.kind === 'triggerCharMatches') as Extract<Condition, { kind: 'triggerCharMatches' }>;
    expect(tcm.side).toBe('self');
    expect(tcm.filter).toEqual({});
    expect((a.effect as { args?: { kw?: string } }).args?.kw).toBe('突撃');
    expect(D04005.abilities.some((x) => x.type === 'icon-misread')).toBe(false);
  });
});

describe('cluster3 b群: evidence-gain trigger', () => {
  it('B08012: a1 bond[真田貴大] continuous 突撃[事件]; a2 evidence:gain selfOnly → draw1', () => {
    const a1 = ab(B08012, 'a1');
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'bond', cardName: '真田貴大' });
    const a2 = ab(B08012, 'a2');
    expect(a2.trigger?.hook).toBe('evidence:gain');
    expect(a2.trigger?.selfOnly).toBe(true);
    expect((a2.effect as { verb?: string }).verb).toBe('draw');
  });

  it('B08012P: B08012 と同一 ability 形状 (再録)', () => {
    expect(ab(B08012P, 'a1').condition).toEqual({ kind: 'bond', cardName: '真田貴大' });
    expect(ab(B08012P, 'a2').trigger?.hook).toBe('evidence:gain');
    expect(B08012P.no).toBe('0853/B08012P');
  });

  it('B01067: evidence:gain selfOnly → sceneToHand self side opp filter levelMax5', () => {
    const a = ab(B01067, 'a1');
    expect(a.trigger?.hook).toBe('evidence:gain');
    expect(a.trigger?.selfOnly).toBe(true);
    const e = a.effect as { verb?: string; args?: Record<string, unknown> };
    expect(e.verb).toBe('sceneToHand');
    expect(e.args).toMatchObject({ player: 'self', side: 'opp', max: 1 });
    expect((e.args?.filter as { levelMax?: number })?.levelMax).toBe(5);
  });

  it('D04007: misread a1 + 【ターン1】evidence:gain (triggerCharMatches self byUid) → optional chain[discard, evidenceGain]', () => {
    expect(ab(D04007, 'a1').type).toBe('icon-misread');
    const a = ab(D04007, 'a2');
    expect(a.trigger?.hook).toBe('evidence:gain');
    expect(a.limit).toEqual({ kind: 'turn', n: 1 });
    const tcm = a.trigger?.matcherCondition as Extract<Condition, { kind: 'triggerCharMatches' }>;
    expect(tcm.kind).toBe('triggerCharMatches');
    expect(tcm.side).toBe('self');
    expect(tcm.payloadKey).toBe('byUid');
    expect((a.effect as { kind?: string }).kind).toBe('optional');
  });
});

describe('cluster3 c群: action:end trigger', () => {
  it('PR086: action:end selfOnly → optional sequence[sceneToDeck $self bottom, draw, sceneEnter hand 警察 enterSleep]', () => {
    const a = ab(PR086, 'a1');
    expect(a.trigger?.hook).toBe('action:end');
    expect(a.trigger?.selfOnly).toBe(true);
    const seq = (a.effect as { effect?: { steps?: { verb?: string; args?: Record<string, unknown> }[] } }).effect?.steps ?? [];
    expect(seq.map((s) => s.verb)).toEqual(['sceneToDeck', 'draw', 'sceneEnter']);
    expect(seq[0].args).toMatchObject({ uid: '$self', pos: 'bottom' });
    const enter = seq[2].args as { from?: string; enterSleep?: boolean; filter?: { trait?: string; kind?: string } };
    expect(enter.from).toBe('hand');
    expect(enter.enterSleep).toBe(true);
    expect(enter.filter?.trait).toBe('警察');
    expect(enter.filter?.kind).toBe('character');
  });

  it('PR092: PR086 と同一 ability 形状 (再録)', () => {
    expect(ab(PR092, 'a1').trigger?.hook).toBe('action:end');
    expect(PR092.no).toBe('0482/PR092');
  });

  it('B03073: action:end selfOnly → sequence[sceneRemove $self, deckRevealUntil upTo lv4 char, conditional sceneEnter, deckToBottomBound]', () => {
    const a = ab(B03073, 'a1');
    expect(a.trigger?.hook).toBe('action:end');
    expect(a.trigger?.selfOnly).toBe(true);
    const steps = (a.effect as { steps?: { kind?: string; verb?: string; args?: Record<string, unknown> }[] }).steps ?? [];
    expect(steps[0].verb).toBe('sceneRemove');
    expect(steps[0].args).toMatchObject({ uid: '$self' });
    expect(steps[1].verb).toBe('deckRevealUntil');
    expect(steps[1].args).toMatchObject({ maxN: 4, chooseMatch: 'upTo' });
    expect((steps[1].args?.filter as { levelMax?: number; kind?: string })).toMatchObject({ levelMax: 4, kind: 'character' });
    expect(steps[2].kind).toBe('conditional');
    expect(steps[3].verb).toBe('deckToBottomBound');
  });

  it('B05108: a1 partnerColorKeyword(黒,突撃); a2 fileAtLeast6 + action:end selfOnly → optional sequence[sceneRemove $self, sceneEnter hand 黒 lv7]', () => {
    expect(B05108.abilities.length).toBe(2);
    const a = ab(B05108, 'a2');
    expect(a.condition).toEqual({ kind: 'fileAtLeast', n: 6 });
    expect(a.trigger?.hook).toBe('action:end');
    expect(a.trigger?.selfOnly).toBe(true);
    const seq = (a.effect as { effect?: { steps?: { verb?: string; args?: Record<string, unknown> }[] } }).effect?.steps ?? [];
    expect(seq.map((s) => s.verb)).toEqual(['sceneRemove', 'sceneEnter']);
    const enter = seq[1].args as { from?: string; filter?: { color?: string; levelMax?: number; kind?: string } };
    expect(enter.from).toBe('hand');
    expect(enter.filter).toMatchObject({ color: '黒', levelMax: 7, kind: 'character' });
  });
});
