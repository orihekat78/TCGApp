// card wave engine0-triage-0628 — engine変更0。70 未certify候補を triage(9 GREEN)→敵対verify
// (6 CONFIRMED + 2 NEEDS_FIX + 1 REFUTED=B08059 self-count latch)。全 atom/cond/cost/filter は出荷済 proven。
//
// 検証2層 (「画面処理 = カードテキスト文言」1対1):
//   A. 構造 1対1: 各 ability の DSL args が公式語と 1対1。
//   B. end-to-end (実 engine evalCond / matchOneFilter / canPay / matcher / continuousDelta):
//      - B08091: caseColor and[青,黒] gate / colorNot:黒 some説 / keyword:現場リムーブ時 presence。
//      - B09080: bond gate / aura cardName。
//      - PR264: ★self-count latch — 解決編で宮野明美自身(5+2=7)が「レベル7×3」に数える (B08059 と異なり成立)。
//      - B06057: event-use matcher (白YAIBA only / cutin payload は不発)。
//      - B07104: charGrantKeyword 短縮形 (BUG-158 fix: uid/target なし)。
//      - B03020: deckRevealUntil AND-of(filter character, OR(filterAny)) + 2×boundToRemove。
//      - B08071: cost removeFromScene{self} canPay / deck-look upTo / cutin 加算。
// rules: 13/15/17/19/20/21/22/24/25
import { describe, it, expect, beforeEach } from 'vitest';
import { matchOneFilter } from '@/engine/target/candidates';
import { evalCond } from '@/engine/cond/eval';
import { canPay } from '@/engine/cost/evaluate';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import { B03020 } from '@/cards/ct-p03/B03020';
import { B03023 } from '@/cards/ct-p03/B03023';
import { B06057 } from '@/cards/ct-p06/B06057';
import { B07104 } from '@/cards/ct-p07/B07104';
import { B07104P } from '@/cards/ct-p07/B07104P';
import { B08071 } from '@/cards/ct-p08/B08071';
import { B08091 } from '@/cards/ct-p08/B08091';
import { B09080 } from '@/cards/ct-p09/B09080';
import { PR264 } from '@/cards/pr-01/PR264';
import { PR270 } from '@/cards/pr-01/PR270';
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
function findAll(eff: EffectDescriptor | undefined, verb: string, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!eff || typeof eff !== 'object') return acc;
  const e = eff as Record<string, unknown>;
  if (e.kind === 'atom' && e.verb === verb) acc.push(e.args as Record<string, unknown>);
  for (const k of ['effect', 'then', 'else', 'do']) findAll(e[k] as EffectDescriptor | undefined, verb, acc);
  for (const st of (e.steps as EffectDescriptor[] | undefined) ?? []) findAll(st, verb, acc);
  return acc;
}
function ch(id: string, colors: string[], level: number, ap = 4000, traits: string[] = [], kind: 'character' | 'event' = 'character', abilities: AbilityDef[] = []): CardDef {
  return { id, no: `9/${id}`, kind, names: [id], colors, level, ap, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities, ruleRefs: [] };
}
// 現場リムーブ時 (= leave:to-remove selfOnly) を持つ dummy / 持たない dummy
const sceneRemoveAbility: AbilityDef = { id: 'x', type: 'triggered', scope: 'on-scene', trigger: { hook: 'leave:to-remove', selfOnly: true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '', ruleRefs: [] };

let s: GameState;
beforeEach(() => {
  resetDefRegistry();
  for (const d of [B03020, B03023, B06057, B07104, B07104P, B08071, B08091, B09080, PR264, PR270]) registerCardDef(d);
  s = createEmptyGameState();
});

// ───────────────────────── B03023 脇田兼則 ─────────────────────────
describe('B03023 脇田兼則 — enter観測(相手deck top公開) + ヒラメキ', () => {
  it('a1: 【自分ターン中】【ターン1】毛利探偵事務所 enter観測 → opponent deck top公開', () => {
    const a1 = ab(B03023, 'a1');
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'enter' });
    expect((a1.trigger as Record<string, unknown>).selfOnly).toBeUndefined(); // 他キャラ登場を観測 (非selfOnly)
    expect(a1.trigger).toMatchObject({ matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { trait: '毛利探偵事務所' } } });
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(a1.limit).toMatchObject({ kind: 'turn', n: 1 });
    // deckRevealUntil は deck を動かさず、公開 card ID を UI side-channel/log へ渡す。
    expect(findArgs(a1.effect, 'deckRevealUntil')).toMatchObject({ player: 'opp', maxN: 1 });
  });
  it('a2: 【ヒラメキ】証拠リムーブ時 draw1', () => {
    const a2 = ab(B03023, 'a2');
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(findArgs(a2.effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
  });
});

// ───────────────────────── B06057 ゲロ田ゲロ左エ門 ─────────────────────────
describe('B06057 ゲロ田ゲロ左エ門 — 白YAIBAイベント使用 reaction + ヒラメキ', () => {
  const WHITE_YAIBA = ch('WHITE_YAIBA', ['白'], 5, 0, ['YAIBA'], 'event');
  const WHITE_PLAIN = ch('WHITE_PLAIN', ['白'], 5, 0, [], 'event');
  const GREEN_YAIBA = ch('GREEN_YAIBA', ['緑'], 5, 0, ['YAIBA'], 'event');
  beforeEach(() => { for (const d of [WHITE_YAIBA, WHITE_PLAIN, GREEN_YAIBA]) registerCardDef(d); });
  function matcher() { return (ab(B06057, 'a1').trigger as { matcher: (p: unknown, s: GameState) => boolean }).matcher; }
  it('a1 構造: 【自分ターン中】【ターン1】 effect:declared reaction → draw1 (必ず引く)', () => {
    const a1 = ab(B06057, 'a1');
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(a1.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect((a1.trigger as Record<string, unknown>).hook).toBe('effect:declared');
    expect(findArgs(a1.effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
    // 「してもよい」ではない → optional でない (mandatory draw)
    expect((a1.trigger as Record<string, unknown>).optional).toBeFalsy();
  });
  it('matcher: 白YAIBAイベント使用 → true', () => {
    expect(matcher()({ kind: 'event-use', cardId: 'WHITE_YAIBA' }, s)).toBe(true);
  });
  it('matcher decoy: 白だがYAIBAでない → false', () => {
    expect(matcher()({ kind: 'event-use', cardId: 'WHITE_PLAIN' }, s)).toBe(false);
  });
  it('matcher decoy: YAIBAだが緑(白でない) → false', () => {
    expect(matcher()({ kind: 'event-use', cardId: 'GREEN_YAIBA' }, s)).toBe(false);
  });
  it('matcher decoy(公式Q&A): 白YAIBAの【カットイン】(kind!=event-use) → false', () => {
    expect(matcher()({ kind: 'cutin', cardId: 'WHITE_YAIBA', abilityId: 'cutin' }, s)).toBe(false);
  });
  it('matcher decoy: 未登録cardId → false (def なし)', () => {
    expect(matcher()({ kind: 'event-use', cardId: 'NOPE' }, s)).toBe(false);
  });
});

// ───────────────────────── B08071 佐藤正義 ─────────────────────────
describe('B08071 佐藤正義 — 宣言deck-look(removeFromScene self cost) + 加算cutin', () => {
  it('a1 構造: cost removeFromScene{self} + deck-look 佐藤美和子 upTo', () => {
    const a1 = ab(B08071, 'a1');
    expect(a1.type).toBe('declared');
    expect(a1.cost).toMatchObject({ kind: 'removeFromScene', target: { kind: 'self' }, n: 1 });
    const dru = findArgs(a1.effect, 'deckRevealUntil')!;
    expect(dru).toMatchObject({ chooseMatch: 'upTo', player: 'self', maxN: 4, filter: { cardName: '佐藤美和子', kind: 'character' } });
    expect(findArgs(a1.effect, 'handAddFromDeck')).toMatchObject({ cardId: '$matched.cardId' });
    expect(findArgs(a1.effect, 'deckToBottomBound')).toMatchObject({ bindKey: '$revealed' });
  });
  it('a1 cost: removeFromScene{self} は state不問で canPay (sleepSelf と異なり active 限定でない、PR194 同型)', () => {
    const cost = ab(B08071, 'a1').cost as Cost;
    const ctx = { source: { player: 'self', area: 'scene', uid: 'B08071#1' }, bindings: {} } as unknown as EffectCtx;
    s.players.self.scene = [sceneChar('B08071', 'B08071#1', { state: 'active' })];
    expect(canPay(s, cost, ctx)).toBe(true);
    s.players.self.scene = [sceneChar('B08071', 'B08071#1', { state: 'sleep' })];
    expect(canPay(s, cost, ctx)).toBe(true); // state不問 (リムーブエリアに移すコストにスリープ不要)
  });
  it('a2 構造: cutin AP+1000 加算 + 佐藤美和子 cutin で draw1 (「代わりに」でない=else無)', () => {
    const a2 = ab(B08071, 'a2');
    expect(a2.scope).toBe('on-hand');
    expect(a2.trigger).toMatchObject({ hook: 'effect:declared', optional: true, selfOnly: true });
    const ap = findArgs(a2.effect, 'charModifyAP')!;
    expect(ap).toMatchObject({ uid: '$contact.byUid', delta: 1000, scope: 'contact' });
    expect(findArgs(a2.effect, 'draw')).toMatchObject({ player: 'self', n: 1 });
    // 加算型: conditional に else 枝なし (佐藤美和子以外でも AP+1000 は付く、draw が付かないだけ)
    const cond = (a2.effect as { steps: Record<string, unknown>[] }).steps.find((x) => x.kind === 'conditional')!;
    expect(cond.else).toBeUndefined();
  });
});

// ───────────────────────── B08091 マッドサイエンティスト ─────────────────────────
describe('B08091 マッドサイエンティスト — 事件青&黒 enter conditional colorNot revive + leave evidenceFlipDown', () => {
  it('a1 構造: caseColor and[青,黒] + enter selfOnly + conditional(sceneHas colorNot黒) → sceneEnter from:remove 現場リムーブ時 Lv6以下 sleep', () => {
    const a1 = ab(B08091, 'a1');
    expect(a1.condition).toMatchObject({ kind: 'caseColor', color: ['青', '黒'], combine: 'and' });
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.effect).toMatchObject({ kind: 'conditional', if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { colorNot: '黒' } }, nMin: 1 } });
    const se = findArgs(a1.effect, 'sceneEnter')!;
    expect(se).toMatchObject({ player: 'self', from: 'remove', max: 1, enterSleep: true, filter: { keyword: '現場リムーブ時', levelMax: 6, kind: 'character' } });
  });
  it('a1 宣言ゲート: caseColor and[青,黒] を evalCond — {青,黒}該当 / mono青除外 / mono黒除外', () => {
    const cond = ab(B08091, 'a1').condition as Condition;
    const ev = (colors: string[]) => { s.players.self.case.colors = colors; return evalCond(s, cond, makeCtx()); };
    expect(ev(['青', '黒'])).toBe(true);
    expect(ev(['青'])).toBe(false); // and: 黒欠
    expect(ev(['黒'])).toBe(false); // and: 青欠
    expect(ev(['青', '黒', '赤'])).toBe(true); // 2色以上でも青&黒を含めば該当 (rules/17)
  });
  it('a1 colorNot:黒 sceneHas filter を matchOneFilter — some説 (mono黒除外/{黒,青}該当/青該当)', () => {
    const filter = (ab(B08091, 'a1').effect as { if: { query: { filter: TargetFilter } } }).if.query.filter;
    const mof = (colors: string[]) => {
      const d = ch('CN', colors, 4);
      registerCardDef(d);
      return matchOneFilter(s, 'CN', filter, sceneChar('CN', 'CN#1'), { kind: 'char', uid: 'CN#1', cardId: 'CN', player: 'self' } as Candidate);
    };
    expect(mof(['黒'])).toBe(false);        // mono黒 → 黒以外の色なし
    expect(mof(['黒', '青'])).toBe(true);   // {黒,青} → 青を持つ (some説)
    expect(mof(['青'])).toBe(true);         // 青 → 黒以外
  });
  it('a1 keyword:現場リムーブ時 filter を matchOneFilter — 持つdef該当/持たないdef除外', () => {
    const se = findArgs(ab(B08091, 'a1').effect, 'sceneEnter')!;
    const filter = se.filter as TargetFilter;
    const withKw = ch('WITHKW', ['赤'], 6, 4000, [], 'character', [sceneRemoveAbility]);
    const noKw = ch('NOKW', ['赤'], 6, 4000, [], 'character', []);
    registerCardDef(withKw); registerCardDef(noKw);
    const mof = (id: string) => matchOneFilter(s, id, filter, sceneChar(id, `${id}#1`), { kind: 'char', uid: `${id}#1`, cardId: id, player: 'self' } as Candidate);
    expect(mof('WITHKW')).toBe(true);   // 現場リムーブ時 (leave:to-remove selfOnly) を持つ
    expect(mof('NOKW')).toBe(false);    // 持たない
    // Lv境界: Lv6該当 / Lv7除外
    const lv7 = ch('LV7KW', ['赤'], 7, 4000, [], 'character', [sceneRemoveAbility]);
    registerCardDef(lv7);
    expect(mof('LV7KW')).toBe(false);
  });
  it('a2 構造: 【相手ターン中】【現場リムーブ時】 evidenceFlipDown self max1', () => {
    const a2 = ab(B08091, 'a2');
    expect(a2.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect(a2.condition).toMatchObject({ kind: 'turn', player: 'opp' });
    expect(findArgs(a2.effect, 'evidenceFlipDown')).toMatchObject({ player: 'self', max: 1, faceUp: true });
  });
});

// ───────────────────────── B09080 高木渉 ─────────────────────────
describe('B09080 高木渉 — 絆佐藤美和子 突撃grant + aura cardName AP+1000', () => {
  it('a1 構造: 絆佐藤美和子 continuous grantKeywords 突撃', () => {
    const a1 = ab(B09080, 'a1');
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toMatchObject({ kind: 'bond', cardName: '佐藤美和子' });
    expect((a1.continuousModifier as { grantKeywords: () => string[] }).grantKeywords()).toEqual(['突撃']);
  });
  it('a2 構造: 絆佐藤美和子 & 相手ターン中 → apDeltaAura cardName佐藤美和子', () => {
    const a2 = ab(B09080, 'a2');
    expect(a2.condition).toMatchObject({ kind: 'and', cs: [{ kind: 'bond', cardName: '佐藤美和子' }, { kind: 'turn', player: 'opp' }] });
    expect(a2.continuousModifier).toMatchObject({ apDeltaAura: 1000, auraFilter: { cardName: '佐藤美和子', kind: 'character' } });
  });
  it('a1 絆ゲート: 現場に佐藤美和子が居れば true / 居なければ false (evalCond)', () => {
    const cond = ab(B09080, 'a1').condition as Condition;
    const sato = ch('佐藤美和子', ['黄'], 4);
    registerCardDef(sato);
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'B09080#1' } });
    s.players.self.scene = [sceneChar('B09080', 'B09080#1'), sceneChar('佐藤美和子', '佐藤美和子#1')];
    expect(evalCond(s, cond, ctx)).toBe(true);
    s.players.self.scene = [sceneChar('B09080', 'B09080#1')];
    expect(evalCond(s, cond, ctx)).toBe(false);
  });
});

// ───────────────────────── PR264 / PR270 宮野明美 (★self-count latch) ─────────────────────────
describe('PR264 宮野明美 — 突撃[キャラ]印字 + 解決編lvlDelta+2 + enter 突撃[事件] grant', () => {
  it('構造: 印字 突撃[キャラ] / a1 lvlDelta+2 caseStatus解決編 / a2 enter conditional sceneHas Lv7×3 → 突撃[事件] grant $self', () => {
    expect(PR264.keywords).toEqual(['突撃[キャラ]']);
    const a1 = ab(PR264, 'a1');
    expect(a1.condition).toMatchObject({ kind: 'caseStatus', status: '解決編' });
    expect(a1.continuousModifier).toMatchObject({ lvlDelta: 2 });
    const a2 = ab(PR264, 'a2');
    expect(a2.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a2.effect).toMatchObject({ kind: 'conditional', if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { levelMin: 7, levelMax: 7 } }, nMin: 3 } });
    expect(findArgs(a2.effect, 'charGrantKeyword')).toMatchObject({ uid: '$self', kw: '突撃[事件]', scope: 'turn' });
  });
  // ★ 公式Q&A: 解決編なら 宮野明美自身(base5 +2 = 7) も「レベル7のキャラ」に数える。
  //   B08059 (sceneHas-gated lvlDelta = 再入guardで self除外) と異なり、PR264 の lvlDelta は caseStatus gate
  //   (level非参照) ゆえ continuousDelta 再入guard 非作動 → 自己計数が成立する。
  function countCond(): Condition { return (ab(PR264, 'a2').effect as { if: Condition }).if; }
  const L7A = ch('L7A', ['赤'], 7);
  const L7B = ch('L7B', ['赤'], 7);
  const L8 = ch('L8', ['赤'], 8);
  beforeEach(() => { for (const d of [L7A, L7B, L8]) registerCardDef(d); });
  const ctx = () => makeCtx({ source: { player: 'self', area: 'scene', uid: 'PR264#1' } });
  it('解決編: 宮野(5→7) + L7A + L7B = 3枚 → true (自己計数 latch 成立)', () => {
    s.players.self.case.status = '解決編';
    s.players.self.scene = [sceneChar('PR264', 'PR264#1'), sceneChar('L7A', 'L7A#1'), sceneChar('L7B', 'L7B#1')];
    expect(evalCond(s, countCond(), ctx())).toBe(true);
  });
  it('事件編: 宮野(5、lvlDelta不適用) + L7A + L7B = 2枚 → false', () => {
    s.players.self.case.status = '事件編';
    s.players.self.scene = [sceneChar('PR264', 'PR264#1'), sceneChar('L7A', 'L7A#1'), sceneChar('L7B', 'L7B#1')];
    expect(evalCond(s, countCond(), ctx())).toBe(false);
  });
  it('解決編 decoy: 宮野(7) + L7A + L8 = 2枚 (L8 は levelMax7境界で除外) → false', () => {
    s.players.self.case.status = '解決編';
    s.players.self.scene = [sceneChar('PR264', 'PR264#1'), sceneChar('L7A', 'L7A#1'), sceneChar('L8', 'L8#1')];
    expect(evalCond(s, countCond(), ctx())).toBe(false);
  });
  it('PR270 は PR264 と同型 (id/no/imageUrl のみ差分、abilities deep-equal)', () => {
    expect(PR270.id).toBe('PR270');
    expect(PR270.imageUrl).not.toBe(PR264.imageUrl);
    expect(PR270.keywords).toEqual(PR264.keywords);
    expect(ab(PR270, 'a1')).toEqual(ab(PR264, 'a1'));
    expect(ab(PR270, 'a2')).toEqual(ab(PR264, 'a2'));
  });
});

// ───────────────────────── B07104 / B07104P ミステリーコースター ─────────────────────────
describe('B07104 ミステリーコースター — partnerColor黒 event: sceneRemove + 突撃grant短縮形 + forEach mill', () => {
  it('a1 構造: partnerColor黒 + event-use + sequence[sceneRemove, charGrantKeyword(短縮形), forEach mill]', () => {
    const a1 = ab(B07104, 'a1');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '黒' });
    expect(a1.trigger).toMatchObject({ hook: 'effect:declared', selfOnly: true });
    // clause1 sceneRemove 短縮形 (max1 either、エリア指定なし=両現場)
    expect(findArgs(a1.effect, 'sceneRemove')).toMatchObject({ player: 'self', max: 1, side: 'either', cause: 'effect' });
    // clause2 charGrantKeyword ★短縮形必須 (BUG-158: uid/target なし、max/side で paShortFormAwait runtime push)
    const grant = findArgs(a1.effect, 'charGrantKeyword')!;
    expect(grant).toMatchObject({ player: 'self', kw: '突撃', scope: 'turn', max: 1, side: 'either' });
    expect(grant.uid).toBeUndefined();     // ← explicit-$pick carrier 回帰防止
    expect(grant.target).toBeUndefined();
    // clause3 forEach over両現場 → mill 2
    expect(findArgs(a1.effect, 'mill')).toMatchObject({ player: 'self', n: 2 });
    const fe = (a1.effect as { steps: Record<string, unknown>[] }).steps.find((x) => x.kind === 'forEach') as Record<string, unknown>;
    expect(fe.over).toMatchObject({ kind: 'all', query: { area: 'scene', side: 'either' } });
  });
  it('clause 順序: sceneRemove(0) → charGrantKeyword(1) → forEach(2) (印字順保持)', () => {
    const steps = (ab(B07104, 'a1').effect as { steps: Record<string, unknown>[] }).steps;
    expect(steps[0].verb).toBe('sceneRemove');
    expect(steps[1].verb).toBe('charGrantKeyword');
    expect(steps[2].kind).toBe('forEach');
  });
  it('B07104P は B07104 と同型 (effect/condition deep-equal、matcher は closure ゆえ別参照)', () => {
    // matcher は arrow closure (参照比較で不一致) ゆえ effect / condition / scope のみ deep-equal
    expect(ab(B07104P, 'a1').effect).toEqual(ab(B07104, 'a1').effect);
    expect(ab(B07104P, 'a1').condition).toEqual(ab(B07104, 'a1').condition);
    expect((ab(B07104P, 'a1').trigger as Record<string, unknown>).hook).toBe('effect:declared');
    expect(B07104P.rarity).toBe('CP');
    expect(B07104P.imageUrl).not.toBe(B07104.imageUrl);
  });
});

// ───────────────────────── B03020 毛利蘭 ─────────────────────────
describe('B03020 毛利蘭 — action blind-mill3 → 妃英理/工藤新一/毛利探偵事務所 で AP+1000', () => {
  it('a1 構造: action:declare selfOnly + optional + deckRevealUntil(filter character ∧ filterAny) + AP+1000 + 2×boundToRemove', () => {
    const a1 = ab(B03020, 'a1');
    expect(a1.trigger).toMatchObject({ hook: 'action:declare', selfOnly: true });
    expect(a1.effect).toMatchObject({ kind: 'optional' });
    const dru = findArgs(a1.effect, 'deckRevealUntil')!;
    expect(dru).toMatchObject({ player: 'self', maxN: 3, filter: { kind: 'character' }, bind: '$revealed', bindMatch: '$matched' });
    expect(dru.filterAny).toEqual([{ cardName: '妃英理' }, { cardName: '工藤新一' }, { trait: '毛利探偵事務所' }]);
    // 「まで」「公開」ではない blind mill → chooseMatch なし (forced reveal-all → bind 分離)
    expect(dru.chooseMatch).toBeUndefined();
    // AP+1000 (アクション終了まで) は $matched 存在時のみ
    expect(findArgs(a1.effect, 'charModifyAP')).toMatchObject({ uid: '$self', delta: 1000, scope: 'action' });
    // ★全3枚 mill: boundToRemove を $revealed と $matched の両方 (matched は handAdd しないので別途remove必須)
    const removes = findAll(a1.effect, 'boundToRemove');
    expect(removes.map((r) => r.bindKey).sort()).toEqual(['$matched', '$revealed']);
  });
});
