// m2-attribution p09-costpaid probe — B09005 / B09050 / B09060 (costPaid ② 束)
//
// engine 実評価 (production dispatch, BUG-171): activateDeclaredAbility → cost.pay (costPaid 記録) →
// effect 解決 → runAllUntilEmpty + drainAiEffectPicks。cost pick は pay 側 pickCandidates/candidates
// fallback で手札 fixture から決定的に選ばれる (probe は手札に狙いのカードのみ置く)。
//
// 検証面:
//   B09005: revealFromHand コスト公開札を costRevealedMatches が読む → fileFlipTop{opp}。cardName 配列 OR
//           (江戸川コナン / 工藤新一) / decoy 探偵 (非該当名) で非 flip / cost gate (探偵不在=宣言不可)。
//   B09050: removeFromHand.level を dyn '$cost.removeFromHand.level' が levelMax へ注入 → 探偵 stun。
//           level 境界 (lv4 除去→lv3 stun可 / lv2 除去→lv3 不可) で dyn 経路を pin。
//   B09060: costRemovedMatches{key:'removeFromHand'} 2 branch (FBI/赤井家 独立)。両特徴札で両成立
//           (AP+2000 + 突撃[事件]&[キャラ]、公式Q&A) / 片方 / どちらも無し / FILE7 gate。
//   BUG-174: 各 unit で owner='opp' 視点 pin を1本。
//
// rules: 03,10,13,15,17,21,24 + カード固有 Q&A (dossier)。カード本体/engine は編集禁止 (test 側のみ調整)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { char as charRead } from '@/engine/read/char';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canPay } from '@/engine/cost/evaluate';
import type { CardDef, Cost, EffectCtx, FileCard, GameState, Player } from '@/engine/types';

import { B09005 } from '@/cards/ct-p09/B09005';
import { B09050 } from '@/cards/ct-p09/B09050';
import { B09060 } from '@/cards/ct-p09/B09060';

type G = { __humanPlayerSide?: Player | null };
const setHuman = (s: Player | null) => { (globalThis as G).__humanPlayerSide = s; };

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const mkEvent = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'event', names: [id], colors: ['赤'], level: 3,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
} as CardDef);

// ── fixtures ──
const FIXTURES: CardDef[] = [
  // B09005
  mkChar('EDOGAWA', { names: ['江戸川コナン'], traits: ['探偵', '高校生'], colors: ['青'], level: 3 }),
  mkChar('KUDO', { names: ['工藤新一'], traits: ['探偵'], colors: ['青'], level: 3 }),
  mkChar('HATTORI_DET', { names: ['服部平次'], traits: ['探偵'], colors: ['緑'], level: 3 }),
  mkChar('NONDET', { names: ['毛利蘭'], traits: ['高校生'], level: 3 }),
  mkChar('OPP_LV5', { names: ['被害者A'], traits: [], level: 5 }),
  mkChar('OPP_LV8', { names: ['被害者B'], traits: [], level: 8 }),
  // B09050
  mkEvent('EV_L4', { level: 4 }),
  mkEvent('EV_L2', { level: 2 }),
  mkChar('DET3', { names: ['探偵3'], traits: ['探偵'], level: 3 }),
  mkChar('DET5', { names: ['探偵5'], traits: ['探偵'], level: 5 }),
  mkChar('NONDET_CH', { names: ['非探偵'], traits: ['高校生'], level: 1 }),
  // B09060
  mkChar('FBI_CH', { names: ['FBI員'], traits: ['FBI'], level: 3 }),
  mkChar('AKAI_CH', { names: ['赤井家員'], traits: ['赤井家'], level: 3 }),
  mkChar('FBI_AKAI', { names: ['赤井秀一'], traits: ['FBI', '赤井家'], level: 3 }),
  mkChar('PLAIN_CH', { names: ['一般人'], traits: ['大学院生'], level: 3 }),
  mkEvent('EV_ANY', { level: 1 }),
];
const ALL = [B09005, B09050, B09060, ...FIXTURES];

const fileBack = (cardId: string): FileCard => ({ type: 'card-back', cardId });

function baseState(turnPlayer: Player = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

function fileTopFaceUp(s: GameState, p: Player): boolean {
  const f = s.players[p].file;
  const top = f[f.length - 1];
  return !!(top && top.type === 'card-back' && top.faceUp === true);
}

// cost 支払可否 (rules/21) を engine の canPay で直接評価。ctx は宣言時の owner 相対。
function canPayCost(s: GameState, cardId: string, uid: string, abilId: string, cost: Cost, player: Player): boolean {
  const ctx = { source: { cardId, uid, abilityId: abilId, player, area: 'scene' }, bindings: {} } as EffectCtx;
  return canPay(s, cost, ctx);
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of ALL) registerCardDef(d);
  registerTriggeredListener();
});

// drive: 宣言能力を活性化して effect + AI pick まで完走
function fire(s: GameState, uid: string, abilId: string): GameState {
  return produce(s, (d) => {
    activateDeclaredAbility(d, uid, abilId);
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });
}

// ============================================================
// B09005 本堂瑛祐 — revealFromHand cost → costRevealedMatches → fileFlipTop{opp}
// ============================================================
describe('B09005 — 探偵公開コスト → 江戸川/工藤 なら相手FILE表向き', () => {
  function board(owner: Player, turnPlayer: Player) {
    const s = baseState(turnPlayer);
    // 【事件青＆緑】gate: 両プレイヤーの事件を青&緑に
    for (const side of ['self', 'opp'] as Player[]) s.players[side].case.colors = ['青', '緑'];
    const honor = mutateAll.scene.enter(s, owner, 'B09005', {});
    s.players.opp.file = [fileBack('X'), fileBack('Y')]; // 上=末尾
    s.players.self.file = [fileBack('S1'), fileBack('S2')];
    return { s, uid: honor.uid };
  }

  it('descriptor: 事件青&緑 / declared / cost[sleepSelf,revealFromHand 探偵char] / seq[sceneRemove lv7, conditional costRevealedMatches→fileFlipTop opp]', () => {
    const a1 = B09005.abilities[0];
    expect(a1.type).toBe('declared');
    expect(a1.condition).toMatchObject({ kind: 'caseColor', color: ['青', '緑'], combine: 'and' });
    const items = (a1.cost as { items: Array<Record<string, unknown>> }).items;
    expect(items[0]).toMatchObject({ kind: 'sleepSelf' });
    expect(items[1]).toMatchObject({ kind: 'revealFromHand', n: 1 });
    expect((items[1] as { target: { query: { filter: unknown } } }).target.query.filter).toMatchObject({ trait: '探偵', kind: 'character' });
    const steps = (a1.effect as { steps: Array<Record<string, unknown>> }).steps;
    expect(steps[0]).toMatchObject({ verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { levelMax: 7 } } });
    expect(steps[1]).toMatchObject({ kind: 'conditional', if: { kind: 'costRevealedMatches', filter: { cardName: ['江戸川コナン', '工藤新一'] } }, then: { verb: 'fileFlipTop', args: { player: 'opp' } } });
  });

  it('S1 match(江戸川コナン): 公開 → 相手FILE top 表向き。opp lv8 は levelMax7 外で残存', () => {
    const { s, uid } = board('self', 'self');
    s.players.self.hand = ['EDOGAWA'];
    mutateAll.scene.enter(s, 'opp', 'OPP_LV8', {}); // sceneRemove decoy (levelMax7 外)
    const after = fire(s, uid, 'a1');
    expect(fileTopFaceUp(after, 'opp'), '相手FILE top が表向き (costRevealedMatches true)').toBe(true);
    expect(after.players.opp.scene.some((c) => c.cardId === 'OPP_LV8'), 'lv8 は sceneRemove filter(levelMax7)外で残存').toBe(true);
  });

  it('S2 match(工藤新一, cardName配列 2要素目): 公開 → 相手FILE top 表向き', () => {
    const { s, uid } = board('self', 'self');
    s.players.self.hand = ['KUDO'];
    const after = fire(s, uid, 'a1');
    expect(fileTopFaceUp(after, 'opp'), '工藤新一 でも costRevealedMatches true → flip').toBe(true);
  });

  it('S3 decoy(服部平次=探偵だが非該当名): 公開できるが costRevealedMatches false → 非 flip', () => {
    const { s, uid } = board('self', 'self');
    s.players.self.hand = ['HATTORI_DET'];
    const after = fire(s, uid, 'a1');
    expect(fileTopFaceUp(after, 'opp'), '該当名でない → flip しない').toBe(false);
  });

  it('S4 cost gate: 手札に探偵キャラ不在 → revealFromHand 支払不可 (canPay false)', () => {
    const { s, uid } = board('self', 'self');
    const cost = B09005.abilities[0].cost as Cost;
    s.players.self.hand = ['NONDET']; // 探偵でない → 公開対象0
    expect(canPayCost(s, 'B09005', uid, 'a1', cost, 'self'), '探偵キャラ不在で cost 支払不可').toBe(false);
    s.players.self.hand = ['EDOGAWA']; // 探偵1枚 → 支払可
    expect(canPayCost(s, 'B09005', uid, 'a1', cost, 'self'), '探偵1枚で支払可').toBe(true);
  });

  it('S5 owner=opp (BUG-174): opp所有 → fileFlipTop{opp} は owner 相対 = self のFILEを表向き (opp側は不変)', () => {
    const { s, uid } = board('opp', 'opp');
    s.players.opp.hand = ['EDOGAWA'];
    const after = fire(s, uid, 'a1');
    expect(fileTopFaceUp(after, 'self'), 'owner=opp の「相手」= self のFILEが flip').toBe(true);
    expect(fileTopFaceUp(after, 'opp'), 'owner 自身(opp)のFILEは flip しない (literal反転せず)').toBe(false);
  });
});

// ============================================================
// B09050 白馬探 — removeFromHand.level → dyn levelMax → 探偵 stun
// ============================================================
describe('B09050 — 手札1枚リムーブ → そのレベル以下の探偵を stun', () => {
  function board(owner: Player, turnPlayer: Player) {
    const s = baseState(turnPlayer);
    const honor = mutateAll.scene.enter(s, owner, 'B09050', {});
    return { s, uid: honor.uid };
  }

  it('descriptor: declared / limit turn1 / cost removeFromHand n1 / sceneSetState stun pick filter{探偵, levelMax dyn $cost.removeFromHand.level}', () => {
    const a1 = B09050.abilities[0];
    expect(a1.type).toBe('declared');
    expect(a1.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a1.cost).toMatchObject({ kind: 'removeFromHand', n: 1 });
    const args = (a1.effect as { args: Record<string, unknown> }).args;
    expect(args.state).toBe('stun');
    expect((args.target as { query: { filter: unknown } }).query.filter).toMatchObject({ trait: '探偵', levelMax: { dyn: '$cost.removeFromHand.level' } });
  });

  it('S1 lv4 除去 → levelMax4: 探偵lv3 は stun / 探偵lv5 は範囲外で active のまま / 非探偵は対象外', () => {
    const { s, uid } = board('self', 'self');
    s.players.self.hand = ['EV_L4']; // 除去札 level4
    const d3 = mutateAll.scene.enter(s, 'self', 'DET3', {});
    const d5 = mutateAll.scene.enter(s, 'opp', 'DET5', {});
    const nd = mutateAll.scene.enter(s, 'opp', 'NONDET_CH', {});
    const after = fire(s, uid, 'a1');
    expect(charRead.state(after, d3.uid), '探偵lv3 (≤4) が stun').toBe('stun');
    expect(charRead.state(after, d5.uid), '探偵lv5 (>4) は対象外で active').toBe('active');
    expect(charRead.state(after, nd.uid), '非探偵は filter 外で active').toBe('active');
    expect(after.players.self.remove.includes('EV_L4'), 'コスト札は remove へ').toBe(true);
  });

  it('S2 lv2 除去 → levelMax2: 探偵lv3 は範囲外 → stun されない (dyn level が cost から流れる証左)', () => {
    const { s, uid } = board('self', 'self');
    s.players.self.hand = ['EV_L2']; // 除去札 level2
    const d3 = mutateAll.scene.enter(s, 'self', 'DET3', {});
    const after = fire(s, uid, 'a1');
    expect(charRead.state(after, d3.uid), '探偵lv3 (>2) は stun されない').toBe('active');
  });

  it('S3 cost gate: 手札0枚 → removeFromHand 支払不可 (canPay false)', () => {
    const { s, uid } = board('self', 'self');
    const cost = B09050.abilities[0].cost as Cost;
    s.players.self.hand = [];
    expect(canPayCost(s, 'B09050', uid, 'a1', cost, 'self'), '手札0で支払不可').toBe(false);
    s.players.self.hand = ['EV_L4'];
    expect(canPayCost(s, 'B09050', uid, 'a1', cost, 'self'), '手札1枚で支払可').toBe(true);
  });

  it('S4 owner=opp (BUG-174): opp所有でも dyn/costPaid が opp ctx で解決し 探偵lv3 を stun', () => {
    const { s, uid } = board('opp', 'opp');
    s.players.opp.hand = ['EV_L4'];
    const d3 = mutateAll.scene.enter(s, 'self', 'DET3', {}); // side either → 相手現場も対象可
    const after = fire(s, uid, 'a1');
    expect(charRead.state(after, d3.uid), 'opp所有活性化でも探偵lv3 が stun (costPaid opp ctx)').toBe('stun');
  });
});

// ============================================================
// B09060 沖矢昴 — removeFromHand hand-source → costRemovedMatches key 2 branch
// ============================================================
describe('B09060 — FBI/赤井家 を手札コスト除去 → AP+突撃 (両立可)', () => {
  function board(owner: Player, turnPlayer: Player, file = 7) {
    const s = baseState(turnPlayer);
    const honor = mutateAll.scene.enter(s, owner, 'B09060', {});
    s.players[owner].file = Array.from({ length: file }, (_, i) => fileBack(`F${i}`));
    return { s, uid: honor.uid };
  }

  it('descriptor: fileAtLeast7 / declared limit turn1 / cost removeFromHand char / 2 conditional costRemovedMatches{key removeFromHand}(FBI/赤井家)', () => {
    const a1 = B09060.abilities[0];
    expect(a1.condition).toMatchObject({ kind: 'fileAtLeast', n: 7 });
    expect(a1.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect((a1.cost as { target: { query: { filter: unknown } } }).target.query.filter).toMatchObject({ kind: 'character' });
    const steps = (a1.effect as { steps: Array<Record<string, unknown>> }).steps;
    expect(steps[0]).toMatchObject({ kind: 'conditional', if: { kind: 'costRemovedMatches', key: 'removeFromHand', filter: { trait: 'FBI' } } });
    expect(steps[1]).toMatchObject({ kind: 'conditional', if: { kind: 'costRemovedMatches', key: 'removeFromHand', filter: { trait: '赤井家' } } });
    // a2 ヒラメキ handAddFromRemove{赤井秀一}
    const a2 = B09060.abilities[1];
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '赤井秀一' } } });
  });

  it('S1 FBI のみ: AP+1000 (4000→5000) + 突撃[事件]。赤井家 branch 不成立 → 突撃[キャラ]無し', () => {
    const { s, uid } = board('self', 'self');
    s.players.self.hand = ['FBI_CH'];
    const after = fire(s, uid, 'a1');
    expect(charRead.ap(after, uid), 'FBI 1 branch → +1000').toBe(5000);
    expect(charRead.hasKeyword(after, uid, '突撃[事件]'), '突撃[事件] 付与').toBe(true);
    expect(charRead.hasKeyword(after, uid, '突撃[キャラ]'), '赤井家 branch 不成立 → 突撃[キャラ]無し').toBe(false);
  });

  it('S2 赤井家 のみ: AP+1000 + 突撃[キャラ]。FBI branch 不成立', () => {
    const { s, uid } = board('self', 'self');
    s.players.self.hand = ['AKAI_CH'];
    const after = fire(s, uid, 'a1');
    expect(charRead.ap(after, uid)).toBe(5000);
    expect(charRead.hasKeyword(after, uid, '突撃[キャラ]')).toBe(true);
    expect(charRead.hasKeyword(after, uid, '突撃[事件]')).toBe(false);
  });

  it('S3 両特徴(FBI&赤井家)= 赤井秀一: 両 conditional 成立 → AP+2000 + 突撃[事件]&[キャラ] (公式Q&A)', () => {
    const { s, uid } = board('self', 'self');
    s.players.self.hand = ['FBI_AKAI'];
    const after = fire(s, uid, 'a1');
    expect(charRead.ap(after, uid), '両 branch 独立成立 → +1000 x2 = +2000').toBe(6000);
    expect(charRead.hasKeyword(after, uid, '突撃[事件]'), '突撃[事件]').toBe(true);
    expect(charRead.hasKeyword(after, uid, '突撃[キャラ]'), '突撃[キャラ]').toBe(true);
  });

  it('S4 どちらの特徴も無し: AP 不変(4000) + 突撃 無し', () => {
    const { s, uid } = board('self', 'self');
    s.players.self.hand = ['PLAIN_CH'];
    const after = fire(s, uid, 'a1');
    expect(charRead.ap(after, uid)).toBe(4000);
    expect(charRead.hasKeyword(after, uid, '突撃[事件]')).toBe(false);
    expect(charRead.hasKeyword(after, uid, '突撃[キャラ]')).toBe(false);
  });

  it('S5 gate: FILE6 では【FILE7】condition 不成立 → canDeclaredAbility false / 手札にキャラ不在 → cost 支払不可', () => {
    const { s, uid } = board('self', 'self', 6); // FILE6
    s.players.self.hand = ['FBI_CH'];
    expect(canDeclaredAbility(s, uid, 'a1'), 'FILE6 で condition 不成立 → 宣言不可').toBe(false);
    const { s: s2, uid: u2 } = board('self', 'self', 7);
    expect(canDeclaredAbility(s2, u2, 'a1'), 'FILE7 で condition 成立').toBe(true);
    const cost = B09060.abilities[0].cost as Cost;
    s2.players.self.hand = ['EV_ANY']; // イベント = kind:character でない → 除去対象0
    expect(canPayCost(s2, 'B09060', u2, 'a1', cost, 'self'), '手札にキャラ不在で cost 支払不可').toBe(false);
    s2.players.self.hand = ['FBI_CH'];
    expect(canPayCost(s2, 'B09060', u2, 'a1', cost, 'self'), 'キャラ1枚で支払可').toBe(true);
  });

  it('S6 owner=opp (BUG-174): opp所有 FBI 除去 → opp 側 B09060 に AP+1000 + 突撃[事件] ($self=source uid)', () => {
    const { s, uid } = board('opp', 'opp', 7);
    s.players.opp.hand = ['FBI_CH'];
    const after = fire(s, uid, 'a1');
    expect(charRead.ap(after, uid), 'opp所有でも source uid に +1000').toBe(5000);
    expect(charRead.hasKeyword(after, uid, '突撃[事件]')).toBe(true);
  });
});
