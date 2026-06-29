// wave engine0 0629 — certify greens + P-clones (engine変更0)
// 構造 1対1 + 実 engine evalCond / matchOneFilter / canPay の decoy 検証 (card-wave gate-5 unit 版)。
// 対象: B06021 / B02057 / B06004 / B06077 / B09056 / B03062 / B04085 (+ 全 P-variant clone parity)。
import { describe, it, expect, beforeEach } from 'vitest';
import { matchOneFilter } from '@/engine/target/candidates';
import { evalCond } from '@/engine/cond/eval';
import { canPay } from '@/engine/cost/evaluate';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import { B06021 } from '@/cards/ct-p06/B06021';
import { B06021P } from '@/cards/ct-p06/B06021P';
import { B02057 } from '@/cards/ct-p02/B02057';
import { B02057P } from '@/cards/ct-p02/B02057P';
import { B06004 } from '@/cards/ct-p06/B06004';
import { B06004P } from '@/cards/ct-p06/B06004P';
import { B06077 } from '@/cards/ct-p06/B06077';
import { B06077P } from '@/cards/ct-p06/B06077P';
import { B09056 } from '@/cards/ct-p09/B09056';
import { B09056P } from '@/cards/ct-p09/B09056P';
import { B03062 } from '@/cards/ct-p03/B03062';
import { B03062P } from '@/cards/ct-p03/B03062P';
import { B04085 } from '@/cards/ct-p04/B04085';
import { B04085P } from '@/cards/ct-p04/B04085P';
import { B03088 } from '@/cards/ct-p03/B03088';
import { B03088P } from '@/cards/ct-p03/B03088P';
import { B07047 } from '@/cards/ct-p07/B07047';
import { B07047P } from '@/cards/ct-p07/B07047P';
import type { AbilityDef, CardDef, GameState, Candidate, EffectDescriptor, Condition, Cost, TargetFilter, EffectCtx } from '@/engine/types';

function ab(card: CardDef, id: string): AbilityDef {
  return card.abilities.find((a) => a.id === id)! as AbilityDef;
}
function findArgs(eff: EffectDescriptor | undefined, verb: string): Record<string, unknown> | null {
  if (!eff || typeof eff !== 'object') return null;
  const e = eff as Record<string, unknown>;
  if (e.kind === 'atom' && e.verb === verb) return e.args as Record<string, unknown>;
  for (const k of ['effect', 'then', 'else', 'do']) {
    const r = findArgs(e[k] as EffectDescriptor | undefined, verb);
    if (r) return r;
  }
  for (const st of (e.steps as EffectDescriptor[] | undefined) ?? []) {
    const r = findArgs(st, verb);
    if (r) return r;
  }
  return null;
}
function ch(id: string, colors: string[], level: number, ap = 4000, traits: string[] = [], kind: 'character' | 'event' = 'character', abilities: AbilityDef[] = []): CardDef {
  return { id, no: `9/${id}`, kind, names: [id], colors, level, ap, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities, ruleRefs: [] };
}
function ctxForSelf(uid: string, cardId: string): EffectCtx {
  return makeCtx({ source: { player: 'self', cardId, abilityId: 'a', uid } as EffectCtx['source'] });
}
function setPartner(s: GameState, color: string): void {
  s.players.self.partner = { ...s.players.self.partner, cardId: 'PCOLOR' };
  registerCardDef({ id: 'PCOLOR', no: 'NO', kind: 'partner', names: ['P'], colors: [color], level: 0, ap: 0, lp: 5, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as CardDef);
}
function mof(s: GameState, id: string, colors: string[], filter: TargetFilter, over: Record<string, unknown> = {}): boolean {
  const d = ch(id, colors, (over.level as number) ?? 4, (over.ap as number) ?? 4000, (over.traits as string[]) ?? [], (over.kind as 'character' | 'event') ?? 'character');
  registerCardDef(d);
  return matchOneFilter(s, id, filter, sceneChar(id, `${id}#1`, over), { kind: 'char', uid: `${id}#1`, cardId: id, player: 'self' } as Candidate);
}

let s: GameState;
beforeEach(() => {
  resetDefRegistry();
  for (const d of [B06021, B06021P, B02057, B02057P, B06004, B06004P, B06077, B06077P, B09056, B09056P, B03062, B03062P, B04085, B04085P, B03088, B03088P, B07047, B07047P]) registerCardDef(d);
  s = createEmptyGameState();
});

// ───────── B06021 石川五右衛門 — 突撃[事件] innate + アクション[事件]証拠 draw + ヒラメキ ─────────
describe('B06021', () => {
  it('keywords[] に 突撃[事件] (innate printed)', () => {
    expect(B06021.keywords).toContain('突撃[事件]');
  });
  it('a1: evidence:gain selfOnly → draw1 (アクション[事件]証拠獲得 trigger)', () => {
    const a1 = ab(B06021, 'a1');
    expect(a1.trigger).toMatchObject({ hook: 'evidence:gain', selfOnly: true });
    expect(findArgs(a1.effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
  });
  it('a2: ヒラメキ (evidence:remove-by-action optional) → draw1', () => {
    const a2 = ab(B06021, 'a2');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.scope).toBe('on-evidence');
    expect(findArgs(a2.effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
  });
});

// ───────── B02057 — 【パートナー赤】ターン終了時 sleep/stun時 AP8000以下リムーブ ─────────
describe('B02057', () => {
  const a1 = () => ab(B02057, 'a1');
  it('a1 構造: phase:end:start + cond and[partnerColor赤, turn self] + conditional(if or[sleep,stun])→sceneRemove apMax8000', () => {
    expect((a1().trigger as Record<string, unknown>).hook).toBe('phase:end:start');
    expect(a1().condition).toMatchObject({ kind: 'and', cs: [{ kind: 'partnerColor', color: '赤' }, { kind: 'turn', player: 'self' }] });
    expect(a1().effect).toMatchObject({ kind: 'conditional', if: { kind: 'or' } });
    expect(findArgs(a1().effect, 'sceneRemove')).toMatchObject({ player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } });
  });
  it('a1 ability-gate evalCond: partner赤+自分ターン=true / partner青=false / 相手ターン=false', () => {
    const cond = a1().condition as Condition;
    s.turn = { ...s.turn, player: 'self' };
    setPartner(s, '赤');
    expect(evalCond(s, cond, makeCtx())).toBe(true);
    setPartner(s, '青');
    expect(evalCond(s, cond, makeCtx())).toBe(false); // partner色違い
    setPartner(s, '赤');
    s.turn = { ...s.turn, player: 'opp' };
    expect(evalCond(s, cond, makeCtx())).toBe(false); // 相手ターン
  });
  it('a1 conditional-if evalCond: self=sleep/stun→true, active→false (rules: スリープorスタン時のみ)', () => {
    const ifCond = (a1().effect as { if: Condition }).if;
    const ev = (st: 'active' | 'sleep' | 'stun') => { s.players.self.scene = [sceneChar('B02057', 'u0', { state: st })]; return evalCond(s, ifCond, ctxForSelf('u0', 'B02057')); };
    expect(ev('sleep')).toBe(true);
    expect(ev('stun')).toBe(true);
    expect(ev('active')).toBe(false);
  });
  it('a1 sceneRemove apMax8000 filter: AP8000該当 / AP8001除外 (境界)', () => {
    const f = (findArgs(a1().effect, 'sceneRemove')!.filter) as TargetFilter;
    expect(mof(s, 'AP8000', ['赤'], f, { ap: 8000 })).toBe(true);
    expect(mof(s, 'AP8001', ['赤'], f, { ap: 8001 })).toBe(false);
  });
});

// ───────── B06004 工藤新一 — 絆毛利蘭 相手ターン aura + 宣言(sleep+毛利蘭公開):opp Lv7以下デッキ下 ─────────
describe('B06004', () => {
  it('a1 構造: continuous + cond and[bond毛利蘭, turn opp] + apDeltaAura1000 auraFilter毛利蘭', () => {
    const a1 = ab(B06004, 'a1');
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toMatchObject({ kind: 'and', cs: [{ kind: 'bond', cardName: '毛利蘭' }, { kind: 'turn', player: 'opp' }] });
    expect(a1.continuousModifier).toMatchObject({ apDeltaAura: 1000, auraFilter: { cardName: '毛利蘭', kind: 'character' } });
  });
  it('a1 evalCond: 現場に毛利蘭+相手ターン=true / 毛利蘭不在=false / 自分ターン=false', () => {
    const cond = ab(B06004, 'a1').condition as Condition;
    registerCardDef(ch('RAN', ['青'], 5)); // 毛利蘭 name decoy 用 — names で判定
    s.players.self.scene = [sceneChar('RANID', 'r0', {})];
    registerCardDef({ ...ch('RANID', ['青'], 5), names: ['毛利蘭'] } as CardDef);
    s.turn = { ...s.turn, player: 'opp' };
    expect(evalCond(s, cond, makeCtx())).toBe(true);
    s.players.self.scene = []; // 毛利蘭 不在
    expect(evalCond(s, cond, makeCtx())).toBe(false);
    s.players.self.scene = [sceneChar('RANID', 'r0', {})];
    s.turn = { ...s.turn, player: 'self' }; // 自分ターン (【相手ターン中】違反)
    expect(evalCond(s, cond, makeCtx())).toBe(false);
  });
  it('a1 auraFilter matchOneFilter: 毛利蘭=true / 別名=false', () => {
    const f = ab(B06004, 'a1').continuousModifier!.auraFilter as TargetFilter;
    registerCardDef({ ...ch('RANID2', ['青'], 5), names: ['毛利蘭'] } as CardDef);
    expect(matchOneFilter(s, 'RANID2', f, sceneChar('RANID2', 'x'), { kind: 'char', uid: 'x', cardId: 'RANID2', player: 'self' } as Candidate)).toBe(true);
    expect(mof(s, 'OTHER', ['青'], f)).toBe(false); // 名前不一致
  });
  it('a2 構造: declared cost pay[sleepSelf, revealFromHand 毛利蘭] → sceneToDeck opp Lv7以下 bottom', () => {
    const a2 = ab(B06004, 'a2');
    expect(a2.type).toBe('declared');
    expect(a2.cost).toMatchObject({ kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'revealFromHand' }] });
    expect(findArgs(a2.effect, 'sceneToDeck')).toMatchObject({ player: 'self', side: 'opp', max: 1, filter: { levelMax: 7 }, pos: 'bottom' });
  });
  it('a2 canPay: active自身 + 手札に毛利蘭=true / 手札に毛利蘭なし=false (revealFromHand gate)', () => {
    const cost = ab(B06004, 'a2').cost as Cost;
    s.players.self.scene = [sceneChar('B06004', 'k0', { state: 'active' })];
    const ctx = ctxForSelf('k0', 'B06004');
    registerCardDef({ ...ch('RANHAND', ['青'], 5), names: ['毛利蘭'] } as CardDef);
    s.players.self.hand = ['RANHAND'];
    expect(canPay(s, cost, ctx)).toBe(true);
    s.players.self.hand = ['OTHERHAND']; registerCardDef(ch('OTHERHAND', ['青'], 5));
    expect(canPay(s, cost, ctx)).toBe(false); // 毛利蘭 不在 → 公開コスト払えず宣言不可
  });
  it('a2 canPay: 自身sleep=false (sleepSelf は active 必須)', () => {
    const cost = ab(B06004, 'a2').cost as Cost;
    s.players.self.scene = [sceneChar('B06004', 'k0', { state: 'sleep' })];
    registerCardDef({ ...ch('RANHAND2', ['青'], 5), names: ['毛利蘭'] } as CardDef);
    s.players.self.hand = ['RANHAND2'];
    expect(canPay(s, cost, ctxForSelf('k0', 'B06004'))).toBe(false);
  });
});

// ───────── B06077 — 【パートナー赤】突撃[キャラ] + 【FILE6】アクション終了時 自己リムーブ→手札FBI登場 ─────────
describe('B06077', () => {
  it('a1: partnerColorKeyword 赤 突撃[キャラ] (continuous grantKeywords)', () => {
    const a1 = ab(B06077, 'a1');
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '赤' });
    expect(typeof a1.continuousModifier!.grantKeywords).toBe('function');
    setPartner(s, '赤');
    expect(a1.continuousModifier!.grantKeywords!(s, { uid: 'x' })).toContain('突撃[キャラ]');
  });
  it('a2: fileAtLeast6 + action:end selfOnly optional → sequence[sceneRemove $self, sceneEnter hand FBI Lv6以下]', () => {
    const a2 = ab(B06077, 'a2');
    expect(a2.condition).toMatchObject({ kind: 'fileAtLeast', n: 6 });
    expect(a2.trigger).toMatchObject({ hook: 'action:end', selfOnly: true });
    expect(a2.effect).toMatchObject({ kind: 'optional' });
    expect(findArgs(a2.effect, 'sceneRemove')).toMatchObject({ uid: '$self', cause: 'effect' });
    expect(findArgs(a2.effect, 'sceneEnter')).toMatchObject({ player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { levelMax: 6, trait: 'FBI', kind: 'character' } });
  });
  it('a2 fileAtLeast6 evalCond: file6枚=true / 5枚=false', () => {
    const cond = ab(B06077, 'a2').condition as Condition;
    const FB = { type: 'card-back' as const, cardId: 'FB' };
    s.players.self.file = Array.from({ length: 6 }, () => FB);
    expect(evalCond(s, cond, makeCtx())).toBe(true);
    s.players.self.file = Array.from({ length: 5 }, () => FB);
    expect(evalCond(s, cond, makeCtx())).toBe(false);
  });
  it('a2 sceneEnter filter matchOneFilter: FBI Lv6=true / FBI Lv7除外 / 非FBI除外', () => {
    const f = findArgs(ab(B06077, 'a2').effect, 'sceneEnter')!.filter as TargetFilter;
    expect(mof(s, 'FBI6', ['赤'], f, { level: 6, traits: ['FBI'] })).toBe(true);
    expect(mof(s, 'FBI7', ['赤'], f, { level: 7, traits: ['FBI'] })).toBe(false);
    expect(mof(s, 'COP6', ['赤'], f, { level: 6, traits: ['警察'] })).toBe(false);
  });
});

// ───────── B09056 赤井秀一 — 事件赤&黒 登場時 自sleep→Lv8以下リムーブ→痕跡分岐 ─────────
describe('B09056', () => {
  const a1 = () => ab(B09056, 'a1');
  it('a1 構造: enter selfOnly + cond and[caseColor赤&黒, partnerColor赤, not self-sleep] + optional', () => {
    expect(a1().trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const cs = (a1().condition as { cs: Record<string, unknown>[] }).cs;
    expect(cs[0]).toMatchObject({ kind: 'caseColor', color: ['赤', '黒'], combine: 'and' });
    expect(cs[1]).toMatchObject({ kind: 'partnerColor', color: '赤' });
    expect(cs[2]).toMatchObject({ kind: 'not', c: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' } });
    expect(a1().effect).toMatchObject({ kind: 'optional' });
  });
  it('a1 sequence: sceneSetState $self sleep → sceneRemove Lv8以下 → conditional(scratchTrace発見済)', () => {
    expect(findArgs(a1().effect, 'sceneSetState')).toMatchObject({ uid: '$self', state: 'sleep' });
    expect(findArgs(a1().effect, 'sceneRemove')).toMatchObject({ player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 8 } });
    // 痕跡分岐: then=sceneEnter(remove黒Lv3 sleep), else=forEach opp-scene mill2
    expect(findArgs(a1().effect, 'sceneEnter')).toMatchObject({ player: 'self', from: 'remove', max: 1, viaEffect: true, enterSleep: true, filter: { color: '黒', levelMax: 3, kind: 'character' } });
    expect(findArgs(a1().effect, 'mill')).toMatchObject({ player: 'opp', n: 2 });
  });
  it('a1 ability-gate evalCond: 事件{赤,黒}+partner赤+self非sleep=true / mono赤=false / partner青=false / self=sleepなら=false', () => {
    const cond = a1().condition as Condition;
    const setup = (caseColors: string[], partner: string, selfState: 'active' | 'sleep') => {
      s = createEmptyGameState();
      s.players.self.case.colors = caseColors;
      setPartner(s, partner);
      s.players.self.scene = [sceneChar('B09056', 'u0', { state: selfState })];
      return evalCond(s, cond, ctxForSelf('u0', 'B09056'));
    };
    expect(setup(['赤', '黒'], '赤', 'active')).toBe(true);
    expect(setup(['赤'], '赤', 'active')).toBe(false);       // 事件 黒欠 (and)
    expect(setup(['赤', '黒'], '青', 'active')).toBe(false);  // partner色違い
    expect(setup(['赤', '黒'], '赤', 'sleep')).toBe(false);   // not self-sleep gate (BUG-145 既sleep安全)
  });
  it('a1 scratchTrace 分岐 evalCond: 発見済=then / 未発見=else', () => {
    const ifCond = (findArgs(a1().effect, 'sceneSetState') ? (a1().effect as { effect: { steps: { kind: string; if?: Condition }[] } }).effect.steps.find((x) => x.kind === 'conditional')!.if! : undefined) as Condition;
    s.scratchTrace = { self: '発見済', opp: '未発見' };
    expect(evalCond(s, ifCond, makeCtx())).toBe(true);
    s.scratchTrace = { self: '未発見', opp: '発見済' };
    expect(evalCond(s, ifCond, makeCtx())).toBe(false);
  });
  it('a1 sceneEnter filter matchOneFilter: 黒Lv3=true / 黒Lv4除外 / 赤Lv3除外', () => {
    const f = findArgs(a1().effect, 'sceneEnter')!.filter as TargetFilter;
    expect(mof(s, 'BK3', ['黒'], f, { level: 3 })).toBe(true);
    expect(mof(s, 'BK4', ['黒'], f, { level: 4 })).toBe(false);
    expect(mof(s, 'RD3', ['赤'], f, { level: 3 })).toBe(false);
  });
});

// ───────── B03062 / B04085 — 白イベント使用 reaction (event-use matcher) ─────────
describe('B03062 (event-use reaction → deck-look Lv8登場)', () => {
  function matcher() { return (ab(B03062, 'a1').trigger as { matcher: (p: unknown, s: GameState) => boolean }).matcher; }
  it('a1 構造: on-hand effect:declared(__eventUse) + partnerColor白 + chain[sceneToDeck self, deckRevealUntil Lv8, conditional bound→sceneEnter $matched]', () => {
    const a1 = ab(B03062, 'a1');
    expect(a1.scope).toBe('on-hand');
    expect((a1.trigger as Record<string, unknown>).hook).toBe('effect:declared');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '白' });
    expect(findArgs(a1.effect, 'deckRevealUntil')).toMatchObject({ filter: { kind: 'character', levelMin: 8, levelMax: 8 } });
    expect(findArgs(a1.effect, 'sceneEnter')).toMatchObject({ cardId: '$matched.cardId' });
  });
  it('matcher: event-use=true / cutin(kind≠event-use)=false', () => {
    registerCardDef(ch('EV', ['白'], 5, 0, [], 'event'));
    expect(matcher()({ kind: 'event-use', cardId: 'EV' }, s)).toBe(true);
    expect(matcher()({ kind: 'cutin', cardId: 'EV', abilityId: 'cutin' }, s)).toBe(false);
  });
});
describe('B04085 (event-use reaction → 警察stun + リムーブ+draw)', () => {
  function matcher() { return (ab(B04085, 'a1').trigger as { matcher: (p: unknown, s: GameState) => boolean }).matcher; }
  it('a1 構造: on-hand __eventUse chain[sceneSetState stun(警察 active pick), sequence[sceneRemove, draw]]', () => {
    const a1 = ab(B04085, 'a1');
    expect(a1.scope).toBe('on-hand');
    const ss = findArgs(a1.effect, 'sceneSetState')!;
    expect(ss).toMatchObject({ uid: '$pick', state: 'stun' });
    expect((ss.target as { query: { filter: TargetFilter; state: string[] } }).query.filter).toMatchObject({ trait: '警察' });
    expect(findArgs(a1.effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
  });
  it('matcher: event-use=true / 非event-use=false', () => {
    registerCardDef(ch('EV2', ['白'], 5, 0, [], 'event'));
    expect(matcher()({ kind: 'event-use', cardId: 'EV2' }, s)).toBe(true);
    expect(matcher()({ kind: 'hirameki', cardId: 'EV2' }, s)).toBe(false);
  });
});

// ───────── P-variant clone parity (effect同一・metadata のみ差) ─────────
describe('P-variant clone parity', () => {
  const pairs: [CardDef, CardDef][] = [
    [B06021, B06021P], [B02057, B02057P], [B06004, B06004P], [B06077, B06077P],
    [B09056, B09056P], [B03062, B03062P], [B04085, B04085P], [B03088, B03088P], [B07047, B07047P],
  ];
  it.each(pairs)('%s → P: abilities/kind/colors 同一, id=base+P', (base, p) => {
    expect(p.id).toBe(base.id + 'P');
    expect(p.kind).toBe(base.kind);
    expect(p.colors).toEqual(base.colors);
    expect(p.level).toBe(base.level);
    // closure (grantKeywords/matcher) は JSON.stringify で落ちるが、両者同一 shared/codegen 由来ゆえ JSON 部分一致で drift 検出
    expect(JSON.stringify(p.abilities)).toBe(JSON.stringify(base.abilities));
  });
});
