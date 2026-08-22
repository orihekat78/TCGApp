// tests/cards/step12-batch1
// CARD PHASE step12 batch1 probe — mega-wave W1-W6 解禁 consumer 13枚の実 def 第2gate 再certify
// (engine 変更 0)。実 CardDef を registry に登録し、production 経路 (candidates / cost.canPay /
// runEffect+drain / endTurn / runAutoPhase / consult) で全句の engine 実評価を踏む。
// decoy 同居で filter 境界を確認 (BUG-117/118 教訓)。
// rules: 各 describe 冒頭コメント参照
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { registerReservedEffectListener, _resetReservedEffectsRegistered } from '@/engine/listeners/reserved-effects';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue, _peekPendingEffectPickQueueLength } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { drainAiEffectPicks, _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { endTurn, startTurn } from '@/engine/flow/turn';
import { runAutoPhase } from '@/engine/flow/auto-phase';
import { candidates as targetCandidates } from '@/engine/flow/action/target-expander';
import { canPay } from '@/engine/cost/evaluate';
import { pay } from '@/engine/cost/pay';
import { char as charRead } from '@/engine/read/char';
import { evalCond } from '@/engine/cond/eval';
import { handUseColorIgnoreAllowed } from '@/engine/flow/main/hand-use-card';
import { canDeclaredAbility, useDeclaredAbility, findDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef, Effect, EffectCtx, EvidenceCard, GameState } from '@/engine/types';

import { B04072 } from '@/cards/ct-p04/B04072';
import { B03046 } from '@/cards/ct-p03/B03046';
import { B08014 } from '@/cards/ct-p08/B08014';
import { B09090 } from '@/cards/ct-p09/B09090';
import { B01058 } from '@/cards/ct-p01/B01058';
import { B08069 } from '@/cards/ct-p08/B08069';
import { B03126 } from '@/cards/ct-p03/B03126';
import { B02088 } from '@/cards/ct-p02/B02088';
import { B07026 } from '@/cards/ct-p07/B07026';
import { B05042 } from '@/cards/ct-p05/B05042';
import { B08026 } from '@/cards/ct-p08/B08026';
import { D10005 } from '@/cards/ct-d10/D10005';
import { B07014 } from '@/cards/ct-p07/B07014';
import { B01039 } from '@/cards/ct-p01/B01039';
import { B09070 } from '@/cards/ct-p09/B09070';

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = s; };

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const mkPartner = (id: string, color: string): CardDef => ({
  id, no: id, kind: 'partner', names: [id], colors: [color], level: 0, ap: 0, lp: 2,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
} as unknown as CardDef);
const ev = (cardId: string): EvidenceCard => ({ cardId, faceUp: false, origin: { turn: 1, via: 'effect' } });

const ALL_REAL = [B04072, B03046, B08014, B09090, B01058, B08069, B03126, B02088, B07026, B05042, B08026, D10005, B07014, B01039, B09070];
const FIXTURES: CardDef[] = [
  mkChar('MOB'), mkChar('MOB2'),
  mkChar('ATK', { ap: 5000 }),
  mkChar('BLUE4', { colors: ['青'], level: 4 }),
  mkChar('YEL5', { colors: ['黄'], level: 5 }),
  mkChar('BLUE6', { colors: ['青'], level: 6 }),
  mkChar('RED2', { colors: ['赤'], level: 2 }),
  mkChar('WHITE1', { colors: ['白'] }),
  mkChar('KANACOP', { traits: ['神奈川県警'] }),
  mkChar('SHIPPUKW', { keywords: ['疾風'] }),
  mkChar('COP4', { level: 4, traits: ['警察'] }),
  mkChar('COP5', { level: 5, traits: ['警察'] }),
  mkChar('AP8K', { ap: 8000 }),
  mkChar('AP9K', { ap: 9000 }),
  mkChar('BLUEHOST', { colors: ['青'] }),
  mkChar('GREENHOST', { colors: ['緑'] }),
  mkChar('SPADE8', { names: ['黒衣の騎士・スペイド'], level: 8 }),
  mkChar('SPADE9', { names: ['黒衣の騎士・スペイド'], level: 9 }),
  mkChar('HATTORI', { names: ['服部平次'] }),
  mkChar('SHINICHI', { names: ['工藤新一'] }),
  mkPartner('PWHITE', '白'), mkPartner('PBLUE', '青'), mkPartner('PGREEN', '緑'), mkPartner('PYELLOW', '黄'),
  mkChar('KANACOP7', { traits: ['神奈川県警'], level: 7 }),
  { id: 'GEV5', no: 'GEV5', kind: 'event', names: ['GEV5'], colors: ['緑'], level: 5, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] },
  { id: 'GEV7', no: 'GEV7', kind: 'event', names: ['GEV7'], colors: ['緑'], level: 7, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] },
  { id: 'SHUFEV', no: 'SHUFEV', kind: 'event', names: ['シャッフルロマンス'], colors: ['青'], level: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] },
  { id: 'SHUFCASE', no: 'SHUFCASE', kind: 'case', names: ['SHUFCASE'], colors: ['青'], caseTraits: ['シャッフルロマンス'], traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef,
];

function ctxFor(player: 'self' | 'opp', uid: string, cardId: string, abilityId = 'a1', extra: Partial<EffectCtx> = {}): EffectCtx {
  return { source: { player, uid, cardId, abilityId, area: 'scene' }, bindings: {}, ...extra } as EffectCtx;
}

function baseState(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetReservedEffectsRegistered();
  _resetRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of [...ALL_REAL, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
  registerReservedEffectListener();
});

// ============== B04072 白鳥任三郎 — untargetableByActionAura ==============
// rules/07 (アクション対象), rules/24 (スタン≠スリープ), rules/15 (「1枚まで」=0可)
describe('step12 B04072 白鳥任三郎', () => {
  function board(bearerState: 'active' | 'sleep' | 'stun') {
    const s = baseState();
    const atk = mutateAll.scene.enter(s, 'self', 'ATK', { active: true });
    atk.isNamed = false;
    const bearer = mutateAll.scene.enter(s, 'opp', 'B04072', {});
    mutateAll.scene.setState(s, bearer.uid, bearerState);
    const b4 = mutateAll.scene.enter(s, 'opp', 'BLUE4', {});
    mutateAll.scene.setState(s, b4.uid, 'sleep');
    const y5 = mutateAll.scene.enter(s, 'opp', 'YEL5', {});
    mutateAll.scene.setState(s, y5.uid, 'sleep');
    const b6 = mutateAll.scene.enter(s, 'opp', 'BLUE6', {});
    mutateAll.scene.setState(s, b6.uid, 'sleep');
    const r2 = mutateAll.scene.enter(s, 'opp', 'RED2', {});
    mutateAll.scene.setState(s, r2.uid, 'sleep');
    return { s, atk, bearer, b4, y5, b6, r2 };
  }

  it('a1: bearer スリープ時 — lv5以下の青/黄のみアクション候補から除外 (decoy 残存)', () => {
    const { s, atk, bearer, b4, y5, b6, r2 } = board('sleep');
    const cands = targetCandidates(s, atk.uid);
    expect(cands.some(c => c.uid === b4.uid), 'lv4 青 = 除外').toBe(false);
    expect(cands.some(c => c.uid === y5.uid), 'lv5 黄 = 除外').toBe(false);
    expect(cands.some(c => c.uid === b6.uid), 'lv6 青 = 残る').toBe(true);
    expect(cands.some(c => c.uid === r2.uid), 'lv2 赤 = 残る').toBe(true);
    expect(cands.some(c => c.uid === bearer.uid), '白鳥自身 (lv6 黄) = 残る').toBe(true);
  });

  it('a1: bearer アクティブ/スタン時 — aura 無効 (Q&A: スタン状態は有効でない)', () => {
    for (const st of ['active', 'stun'] as const) {
      const { s, atk, b4 } = board(st);
      const cands = targetCandidates(s, atk.uid);
      expect(cands.some(c => c.uid === b4.uid), `bearer ${st}`).toBe(true);
    }
  });

  it('a2: 【スリープ】コスト — アクティブ時のみ支払可', () => {
    const s = baseState();
    const bearer = mutateAll.scene.enter(s, 'self', 'B04072', { active: true });
    const ctx = ctxFor('self', bearer.uid, 'B04072', 'a2');
    expect(canPay(s, { kind: 'sleepSelf' }, ctx)).toBe(true);
    mutateAll.scene.setState(s, bearer.uid, 'sleep');
    expect(canPay(s, { kind: 'sleepSelf' }, ctx)).toBe(false);
  });

  it('a2: キャラを1枚選び ターン終了時まで AP+2000 (turn scope、失効)', () => {
    let s = baseState();
    const bearer = mutateAll.scene.enter(s, 'self', 'B04072', { active: true });
    const tgt = mutateAll.scene.enter(s, 'self', 'ATK', {});
    const a2 = B04072.abilities!.find(a => a.id === 'a2')!;
    const baseSum = charRead.ap(s, bearer.uid) + charRead.ap(s, tgt.uid);
    s = produce(s, (d) => {
      runEffect(d, a2.effect as Effect, ctxFor('self', bearer.uid, 'B04072', 'a2'));
      _drainAllEffectPicksForTest(d);
      runAllUntilEmpty(d);
    });
    const boosted = [bearer.uid, tgt.uid].find(u => charRead.ap(s, u) > (u === bearer.uid ? 6000 : 5000))!;
    expect(charRead.ap(s, bearer.uid) + charRead.ap(s, tgt.uid), '1枚だけ +2000').toBe(baseSum + 2000);
    s = produce(s, (d) => { mutateAll.char.clearTurnEffects(d, boosted, 'turn'); });
    expect(charRead.ap(s, bearer.uid) + charRead.ap(s, tgt.uid), 'ターン終了で失効').toBe(baseSum);
  });
});

// ============== B03046 怪盗キッド — stunAutoActivate restrict ==============
// rules/03 (スタン), rules/05 (オートフェイズ), rules/17 (【パートナー白】)
describe('step12 B03046 怪盗キッド', () => {
  function board(partnerId: string) {
    const s = baseState();
    s.players.self.partner.cardId = partnerId;
    s.players.opp.deck = ['MOB', 'MOB', 'MOB'];
    mutateAll.scene.enter(s, 'self', 'B03046', {});
    const stunned = mutateAll.scene.enter(s, 'opp', 'MOB', {});
    mutateAll.scene.setState(s, stunned.uid, 'stun');
    const sleepy = mutateAll.scene.enter(s, 'opp', 'MOB2', {});
    mutateAll.scene.setState(s, sleepy.uid, 'sleep');
    return { s, stunned, sleepy };
  }

  it('a1: partner=白 — 相手スタンキャラはオートフェイズで代替スリープ化もされずスタン維持', () => {
    const { s, stunned, sleepy } = board('PWHITE');
    const after = produce(s, (d) => { runAutoPhase(d, 'opp'); });
    expect(after.players.opp.scene.find(c => c.uid === stunned.uid)!.state, 'スタン維持').toBe('stun');
    expect(after.players.opp.scene.find(c => c.uid === sleepy.uid)!.state, 'スリープは通常アクティブ化').toBe('active');
  });

  it('a1: partner=青 — condition 不成立で通常挙動 (スタン→代替スリープ)', () => {
    const { s, stunned } = board('PBLUE');
    const after = produce(s, (d) => { runAutoPhase(d, 'opp'); });
    expect(after.players.opp.scene.find(c => c.uid === stunned.uid)!.state, 'rules/03 代替スリープ').toBe('sleep');
  });

  it('a2: 【登場時】キャラを1枚選びスタン (enter 実 emit 経路)', () => {
    let s = baseState();
    const tgt = mutateAll.scene.enter(s, 'opp', 'MOB', {});
    const kid = mutateAll.scene.enter(s, 'self', 'B03046', {});
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: kid.uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B03046', uid: kid.uid });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    const states = [
      s.players.opp.scene.find(c => c.uid === tgt.uid)!.state,
      s.players.self.scene.find(c => c.uid === kid.uid)!.state,
    ];
    expect(states.filter(st => st === 'stun').length, 'どれか1枚がスタン').toBe(1);
  });
});

// ============== B08014 毛利蘭 — selectedByOwnMr rider ==============
// rules/18 (MR), rules/22 (アクション宣言時), rules/15
describe('step12 B08014 毛利蘭', () => {
  function armed(): GameState {
    let s = baseState();
    const ran = mutateAll.scene.enter(s, 'self', 'B08014', { active: true });
    void ran;
    s = produce(s, (d) => {
      const a1 = B08014.abilities!.find(a => a.id === 'a1')!;
      runEffect(d, a1.effect as Effect, ctxFor('self', d.players.self.scene[0].uid, 'B08014', 'a1'));
      runAllUntilEmpty(d);
    });
    return s;
  }

  it('a1: アクション時 rider 付与 → ターン終了時 MR未選択なら現場から手札へ', () => {
    let s = armed();
    const uid = s.players.self.scene[0].uid;
    expect(Object.keys(s.players.self.scene[0].turnEffects.grantedAbilities ?? {}).length > 0 || (s.players.self.scene[0].turnEffects['grantedAbilities'] !== undefined), 'rider 付与済').toBeTruthy();
    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find(c => c.uid === uid), '現場から離れた').toBeUndefined();
    expect(s.players.self.hand).toContain('B08014');
  });

  it('a1: このターン MR に選ばれていた場合は現場に残る', () => {
    let s = armed();
    const uid = s.players.self.scene[0].uid;
    s = produce(s, (d) => { mutateAll.char.tagSelectedByOwnMr(d, uid, 'self'); });
    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find(c => c.uid === uid), '現場に残る').toBeTruthy();
    expect(s.players.self.hand).not.toContain('B08014');
  });
});

// ============== B09090 風の女神 — setShippuWaive ==============
// rules/13 (疾風), rules/17 (【解決編】), rules/21 (コスト)
describe('step12 B09090 風の女神', () => {
  const a2 = B09090.abilities!.find(a => a.id === 'a2')!;

  it('a2 cost: 神奈川県警 or 疾風持ちのみ支払可 (decoy のみは不可)', () => {
    const s = baseState();
    const ctx = { source: { player: 'self', cardId: 'B09090', abilityId: 'a2', area: 'case' }, bindings: {} } as EffectCtx;
    s.players.self.hand = ['KANACOP'];
    expect(canPay(s, a2.cost!, ctx), '神奈川県警').toBe(true);
    s.players.self.hand = ['SHIPPUKW'];
    expect(canPay(s, a2.cost!, ctx), '疾風 keyword (印字判定)').toBe(true);
    s.players.self.hand = ['MOB'];
    expect(canPay(s, a2.cost!, ctx), 'decoy のみ = 不可').toBe(false);
  });

  it('a2 effect: shippuWaiveArmed が立つ / condition は解決編のみ成立', () => {
    let s = baseState();
    const ctx = { source: { player: 'self', cardId: 'B09090', abilityId: 'a2', area: 'case' }, bindings: {} } as EffectCtx;
    s.players.self.case.status = '事件編';
    expect(evalCond(s, a2.condition!, ctx), '事件編 = 不成立').toBe(false);
    s.players.self.case.status = '解決編';
    expect(evalCond(s, a2.condition!, ctx), '解決編 = 成立').toBe(true);
    s = produce(s, (d) => { runEffect(d, a2.effect as Effect, ctx); runAllUntilEmpty(d); });
    expect(s.turnState.self.shippuWaiveArmed, 'B09090 a2 arms the next-entry Shippu waiver').toBe(true);
  });
});

// ============== B01058 トッ — reserveEffect next-match ==============
// rules/03 (スタン), rules/25 (予約解決), rules/13 (突撃[事件])
describe('step12 B01058 トッ', () => {
  const a1 = B01058.abilities!.find(a => a.id === 'a1')!;

  function used(selfEvidence = false): GameState {
    let s = baseState();
    mutateAll.scene.enter(s, 'self', 'WHITE1', { active: true });
    const red = mutateAll.scene.enter(s, 'self', 'RED2', {});
    mutateAll.scene.setState(s, red.uid, 'sleep');
    s.players.opp.evidence = [ev('MOB')];
    if (selfEvidence) s.players.self.evidence = [ev('MOB')];
    s = produce(s, (d) => {
      runEffect(d, a1.effect as Effect, { source: { player: 'self', cardId: 'B01058', abilityId: 'a1', area: 'hand' }, bindings: {} } as EffectCtx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    return s;
  }

  it('前段: 【白】のみ候補 → 突撃[事件] 付与 (decoy 赤は不可) + 予約 1 entry', () => {
    const s = used();
    const white = s.players.self.scene.find(c => c.cardId === 'WHITE1')!;
    const red = s.players.self.scene.find(c => c.cardId === 'RED2')!;
    expect(charRead.keywords(s, white.uid), '白に突撃[事件]').toContain('突撃[事件]');
    expect(charRead.keywords(s, red.uid), '赤 decoy には付かない').not.toContain('突撃[事件]');
    expect(s.reservedEffects).toHaveLength(1);
  });

  it('後段: 相手証拠リムーブで発火 → スリープキャラがスタン + 単発消費', () => {
    let s = used();
    s = produce(s, (d) => {
      mutateAll.evidence.removeTop(d, 'opp');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    const red = s.players.self.scene.find(c => c.cardId === 'RED2')!;
    expect(red.state, 'スリープ状態のキャラがスタン化').toBe('stun');
    expect(s.reservedEffects).toHaveLength(0);
  });

  it('decoy: 自分の証拠リムーブでは発火しない', () => {
    let s = used(true);
    s = produce(s, (d) => {
      mutateAll.evidence.removeTop(d, 'self');
      runAllUntilEmpty(d);
    });
    expect(s.reservedEffects, '未消費で残る').toHaveLength(1);
  });
});

// ============== B08069 風見裕也 — reserveEffect turn-end ==============
// rules/21 (対象省略コスト=自身), rules/25
describe('step12 B08069 風見裕也', () => {
  it('宣言 → ターン終了時に手札から lv4以下[警察] のみ登場 (lv5 decoy 除外)', () => {
    let s = baseState();
    const kazami = mutateAll.scene.enter(s, 'self', 'B08069', { active: true });
    s.players.self.hand = ['COP4', 'COP5'];
    s.players.self.deck = ['MOB', 'MOB'];
    s.players.opp.deck = ['MOB', 'MOB'];
    const a1 = B08069.abilities!.find(a => a.id === 'a1')!;
    const ctx = ctxFor('self', kazami.uid, 'B08069', 'a1');
    expect(canPay(s, a1.cost!, ctx), 'selfToDeckBottom 支払可').toBe(true);
    s = produce(s, (d) => {
      runEffect(d, a1.effect as Effect, ctx);
      runAllUntilEmpty(d);
    });
    expect(s.reservedEffects).toHaveLength(1);
    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.some(c => c.cardId === 'COP4'), 'lv4 警察 登場').toBe(true);
    expect(s.players.self.scene.some(c => c.cardId === 'COP5'), 'lv5 decoy は登場しない').toBe(false);
    expect(s.reservedEffects).toHaveLength(0);
  });
});

// ============== B03126 犯人 — colorIgnore + caseStatus + suppress ==============
// rules/20 (色制限), rules/17, rules/10 (ヒラメキ)
describe('step12 B03126 犯人', () => {
  it('a1: 事件色不一致でも handUseColorIgnoreAllowed = true (decoy MOB は false)', () => {
    const s = baseState();
    s.players.self.case.colors = ['青'];
    expect(handUseColorIgnoreAllowed(s, 'self', 'B03126'), '黒キャラだが無視可').toBe(true);
    expect(handUseColorIgnoreAllowed(s, 'self', 'MOB'), '通常カードは不可').toBe(false);
  });

  it('a2/a3: 事件編 LP+1 / 解決編 AP+2000 (相互排他)', () => {
    const s = baseState();
    const han = mutateAll.scene.enter(s, 'self', 'B03126', {});
    s.players.self.case.status = '事件編';
    expect(charRead.lp(s, han.uid), '事件編 LP 0+1').toBe(1);
    expect(charRead.ap(s, han.uid), '事件編 AP 素').toBe(4000);
    s.players.self.case.status = '解決編';
    expect(charRead.lp(s, han.uid), '解決編 LP 素 (即失効 rules/24)').toBe(0);
    expect(charRead.ap(s, han.uid), '解決編 AP+2000').toBe(6000);
  });

  it('a4: setEvidenceGainSuppress → turnState.opp フラグ', () => {
    let s = baseState();
    const a4 = B03126.abilities!.find(a => a.id === 'a4')!;
    s = produce(s, (d) => {
      runEffect(d, a4.effect as Effect, { source: { player: 'self', cardId: 'B03126', abilityId: 'a4', area: 'evidence' }, bindings: {} } as EffectCtx);
      runAllUntilEmpty(d);
    });
    expect(s.turnState.opp.evidenceGainSuppressed).toBe(true);
  });
});

// ============== B02088 犯人 — 同名 enter 自リムーブ + 証拠 sequence + cutin 自己召喚 ==============
// rules/09 (カットイン), rules/10, rules/15 (可能な限り解決), rules/19 (同名)
describe('step12 B02088 犯人', () => {
  it('a1: 別の〚犯人〛登場で自身リムーブ / 他名 decoy では残る', () => {
    let s = baseState();
    const han = mutateAll.scene.enter(s, 'self', 'B02088', {});
    const mob = mutateAll.scene.enter(s, 'self', 'MOB', {});
    s = produce(s, (d) => {
      event.emit(
        d,
        'enter',
        { uid: mob.uid, viaEffect: false, enterOrder: 1, enterOrderThisTurn: 1 },
        { player: 'self', cardId: 'MOB', uid: mob.uid },
      );
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.some(c => c.uid === han.uid), '他名 = 残る').toBe(true);
    // B03126 も names ['犯人'] — 同名 enter
    const han2 = produce(s, (d) => {
      const c = mutateAll.scene.enter(d, 'self', 'B03126', {});
      event.emit(
        d,
        'enter',
        { uid: c.uid, viaEffect: false, enterOrder: 2, enterOrderThisTurn: 2 },
        { player: 'self', cardId: 'B03126', uid: c.uid },
      );
      runAllUntilEmpty(d);
    });
    expect(han2.players.self.scene.some(c => c.uid === han.uid), '同名〚犯人〛登場 = 自身リムーブ').toBe(false);
    expect(han2.players.self.remove).toContain('B02088');
  });

  it('a2: ターン終了時 — 証拠 top リムーブ + 自身を表向き証拠化 (証拠0でも自身証拠化 = Q&A)', () => {
    let s = baseState();
    const han = mutateAll.scene.enter(s, 'self', 'B02088', {});
    void han;
    s.players.self.evidence = [ev('MOB')];
    s = produce(s, (d) => { endTurn(d, 'self'); runAllUntilEmpty(d); });
    expect(s.players.self.remove, '証拠 top はリムーブ').toContain('MOB');
    const top = s.players.self.evidence[s.players.self.evidence.length - 1];
    expect(top?.cardId, '自身が証拠 top').toBe('B02088');
    expect(top?.faceUp, '表向き').toBe(true);
    expect(s.players.self.scene.some(c => c.cardId === 'B02088'), '現場から離脱').toBe(false);
    // 証拠 0 の場合: 可能な部分のみ = 自身証拠化で +1 (Q&A)
    let s2 = baseState();
    mutateAll.scene.enter(s2, 'opp', 'B02088', {});
    s2 = produce(s2, (d) => { endTurn(d, 'self'); runAllUntilEmpty(d); });
    expect(s2.players.opp.evidence.map(e => e.cardId), '証拠0 → 自身のみ +1 (相手側でも発動 = 自分か相手のターン終了時)').toContain('B02088');
  });

  it('a3: カットイン — リムーブから空きがあればスリープ登場 / 現場フルなら no-op', () => {
    const a3 = B02088.abilities!.find(a => a.id === 'a3')!;
    let s = baseState();
    s.players.self.remove = ['B02088'];
    s = produce(s, (d) => {
      runEffect(d, a3.effect as Effect, {
        source: { player: 'self', cardId: 'B02088', abilityId: 'a3', area: 'remove' },
        bindings: {},
        triggerPayload: { cardId: 'B02088' },
      } as unknown as EffectCtx);
      runAllUntilEmpty(d);
    });
    const entered = s.players.self.scene.find(c => c.cardId === 'B02088');
    expect(entered, '登場').toBeTruthy();
    expect(entered!.state, 'スリープ状態').toBe('sleep');
    // 現場フル (5枚)
    let s2 = baseState();
    for (const id of ['MOB', 'MOB2', 'ATK', 'RED2', 'WHITE1']) mutateAll.scene.enter(s2, 'self', id, {});
    s2.players.self.remove = ['B02088'];
    s2 = produce(s2, (d) => {
      runEffect(d, a3.effect as Effect, {
        source: { player: 'self', cardId: 'B02088', abilityId: 'a3', area: 'remove' },
        bindings: {},
        triggerPayload: { cardId: 'B02088' },
      } as unknown as EffectCtx);
      runAllUntilEmpty(d);
    });
    expect(s2.players.self.scene.some(c => c.cardId === 'B02088'), 'フル = 登場しない').toBe(false);
    expect(s2.players.self.remove, 'リムーブに残る').toContain('B02088');
    expect(_peekPendingEffectPickQueueLength(), '空きがない場合は switch decision を作らない').toBe(0);
  });
});

// ============== B07026 相応しいお方 — eventUseSource ==============
// rules/25 (イベント使用起源)
describe('step12 B07026 相応しいお方', () => {
  const a1 = B07026.abilities!.find(a => a.id === 'a1')!;

  function runWith(payload: Record<string, unknown>): GameState {
    let s = baseState();
    const t8 = mutateAll.scene.enter(s, 'opp', 'AP8K', {});
    const t9 = mutateAll.scene.enter(s, 'opp', 'AP9K', {});
    void t8; void t9;
    s.players.self.deck = ['MOB', 'MOB2'];
    s = produce(s, (d) => {
      runEffect(d, a1.effect as Effect, {
        source: { player: 'self', cardId: 'B07026', abilityId: 'a1', area: 'hand' },
        bindings: {},
        triggerPayload: payload,
      } as unknown as EffectCtx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    return s;
  }

  it('AP8000以下のみリムーブ候補 + 効果起源使用なら draw 1', () => {
    const s = runWith({ kind: 'event-use', viaEffect: true });
    expect(s.players.opp.scene.some(c => c.cardId === 'AP8K'), 'AP8000 リムーブ').toBe(false);
    expect(s.players.opp.scene.some(c => c.cardId === 'AP9K'), 'AP9000 decoy 残存').toBe(true);
    expect(s.players.self.hand, '効果起源 = draw 1').toHaveLength(1);
  });

  it('手札の使用起源 (viaEffect 無し) では draw しない', () => {
    const s = runWith({ kind: 'event-use' });
    expect(s.players.self.hand, '通常使用 = draw 0').toHaveLength(0);
  });

  it('condition: partner 緑のみ成立', () => {
    const s = baseState();
    s.players.self.partner.cardId = 'PGREEN';
    const ctx = { source: { player: 'self', cardId: 'B07026', area: 'hand' }, bindings: {} } as EffectCtx;
    expect(evalCond(s, a1.condition!, ctx)).toBe(true);
    s.players.self.partner.cardId = 'PBLUE';
    expect(evalCond(s, a1.condition!, ctx)).toBe(false);
  });
});

// ============== B05042 ラブリースポット — deckRevealUntil + useEventFromHand ==============
// rules/26 (出るまで型 = 必ず加える), rules/25
describe('step12 B05042 ラブリースポット', () => {
  const a1 = B05042.abilities!.find(a => a.id === 'a1')!;

  it('イベントが出るまで公開 → 手札へ、残り bottom + shuffle、その後手札のイベント使用', () => {
    let s = baseState();
    s.players.self.deck = ['MOB', 'MOB2', 'GEV5', 'ATK', 'RED2'];
    s = produce(s, (d) => {
      runEffect(d, a1.effect as Effect, {
        source: { player: 'self', cardId: 'B05042', abilityId: 'a1', area: 'hand' },
        bindings: {},
        triggerPayload: { kind: 'event-use' },
      } as unknown as EffectCtx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    // GEV5 (緑 lv5 event) が最初のイベント → 手札に加え、その後 useEventFromHand で使用 → remove へ
    expect(s.players.self.remove, 'GEV5 使用済 (levelMax6 緑 non-self-name)').toContain('GEV5');
    expect(s.players.self.hand, '手札には残らない').not.toContain('GEV5');
    expect(s.players.self.deck, '公開した MOB/MOB2 はデッキ内 (bottom+shuffle)').toContain('MOB');
    expect(s.players.self.deck).toContain('MOB2');
  });

  it('filter: cardNameNot 自名 + levelMax6 — GEV7 (lv7) は加えるが使用不可', () => {
    let s = baseState();
    s.players.self.deck = ['MOB', 'GEV7', 'ATK'];
    s = produce(s, (d) => {
      runEffect(d, a1.effect as Effect, {
        source: { player: 'self', cardId: 'B05042', abilityId: 'a1', area: 'hand' },
        bindings: {},
        triggerPayload: { kind: 'event-use' },
      } as unknown as EffectCtx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand, 'lv7 は手札に加わるが使用されない').toContain('GEV7');
    expect(s.players.self.remove).not.toContain('GEV7');
  });
});

// ============== B08026 大滝悟郎 — deckLook5 upTo + bond-declared useEventFromHand ==============
// rules/26 (「1枚まで」= 加えない選択可), rules/21, rules/13 (絆)
describe('step12 B08026 大滝悟郎', () => {
  it('a2: 服部平次 不在 = 宣言不可 / 在 = 宣言可 → self リムーブ + イベント使用', () => {
    let s = baseState();
    const ohtaki = mutateAll.scene.enter(s, 'self', 'B08026', { active: true });
    s.players.self.hand = ['GEV5', 'GEV7'];
    expect(canDeclaredAbility(s, ohtaki.uid, 'a2'), '絆不在 = 不可').toBe(false);
    mutateAll.scene.enter(s, 'self', 'HATTORI', {});
    expect(canDeclaredAbility(s, ohtaki.uid, 'a2'), '絆在 = 可').toBe(true);
    const a2 = B08026.abilities!.find(a => a.id === 'a2')!;
    s = produce(s, (d) => {
      // cost は caller 責務 (UI/AI dispatch と同順: pay → useDeclaredAbility)
      pay(d, a2.cost!, ctxFor('self', ohtaki.uid, 'B08026', 'a2'));
      useDeclaredAbility(d, ohtaki.uid, 'a2', { source: { cardId: 'B08026', uid: ohtaki.uid, abilityId: 'a2', player: 'self', area: 'scene' } });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.some(c => c.cardId === 'B08026'), 'コスト: 自身リムーブ').toBe(false);
    expect(s.players.self.remove).toContain('B08026');
    expect(s.players.self.remove, 'lv6以下イベント使用 (GEV5)').toContain('GEV5');
    expect(s.players.self.hand, 'lv7 は使用不可で手札に残る').toContain('GEV7');
  });
});

// ============== D10005 ハート姫（毛利蘭） — caseTrait + optional revive + useEventFromHand ==============
// rules/17 (【事件(特徴)】), rules/19 (複数名), rules/15
describe('step12 D10005 ハート姫（毛利蘭）', () => {
  const a1 = D10005.abilities!.find(a => a.id === 'a1')!;
  const a2 = D10005.abilities!.find(a => a.id === 'a2')!;

  it('a1 listener conditionは事件特徴のみ、self activeはeffect解決時に判定', () => {
    const s = baseState();
    const hime = mutateAll.scene.enter(s, 'self', 'D10005', { active: true });
    const ctx = ctxFor('self', hime.uid, 'D10005', 'a1');
    expect(evalCond(s, a1.condition!, ctx), '事件特徴なし = 不成立').toBe(false);
    s.players.self.case.cardId = 'SHUFCASE'; // caseTraits:['シャッフルロマンス'] (CardDef.caseTraits 読み)
    expect(evalCond(s, a1.condition!, ctx), '特徴あり = listener成立').toBe(true);
    mutateAll.scene.setState(s, hime.uid, 'sleep');
    expect(evalCond(s, a1.condition!, ctx), 'sleepでもmandatory trigger成立').toBe(true);
    const gate = (a1.effect as { if: Condition }).if;
    expect(evalCond(s, gate, ctx), 'effect解決時はactiveでないためoptional抑止').toBe(false);
  });

  it('a1 chain: sleep + discard → リムーブの lv8以下スペイドのみ登場 (lv9 同名 decoy 除外)', () => {
    let s = baseState();
    const hime = mutateAll.scene.enter(s, 'self', 'D10005', { active: true });
    s.players.self.hand = ['MOB'];
    s.players.self.remove = ['SPADE8', 'SPADE9', 'MOB2'];
    const chain = (a1.effect as { then: { effect: Effect } }).then.effect; // conditional → optional 内 chain
    s = produce(s, (d) => {
      runEffect(d, chain, ctxFor('self', hime.uid, 'D10005', 'a1'));
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find(c => c.uid === hime.uid)!.state, '自身スリープ').toBe('sleep');
    expect(s.players.self.hand, '手札1枚リムーブ').toHaveLength(0);
    expect(s.players.self.scene.some(c => c.cardId === 'SPADE8'), 'lv8 スペイド登場').toBe(true);
    expect(s.players.self.scene.some(c => c.cardId === 'SPADE9'), 'lv9 decoy 除外').toBe(false);
  });

  it('a2: シャッフルロマンス名イベントのみ使用 (他イベント decoy 残存)', () => {
    let s = baseState();
    const hime = mutateAll.scene.enter(s, 'self', 'D10005', { active: true });
    mutateAll.scene.enter(s, 'self', 'SHINICHI', {});
    s.players.self.hand = ['SHUFEV', 'GEV5'];
    expect(canDeclaredAbility(s, hime.uid, 'a2'), '絆工藤新一 在 = 宣言可').toBe(true);
    s = produce(s, (d) => {
      useDeclaredAbility(d, hime.uid, 'a2');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.remove, '名指しイベント使用').toContain('SHUFEV');
    expect(s.players.self.hand, '他イベントは残る').toContain('GEV5');
  });
});

// ============== B07014 弁当型携帯FAX — on-set-host rider ==============
// rules/16 (セット), rules/13 (突撃[キャラ]), rules/21
describe('step12 B07014 弁当型携帯FAX', () => {
  function setOnHost(): { s: GameState; hostUid: string } {
    let s = baseState();
    const host = mutateAll.scene.enter(s, 'self', 'BLUEHOST', { active: true });
    mutateAll.scene.enter(s, 'self', 'RED2', {}); // 色 decoy
    s.players.self.remove = ['B07014'];
    const a1 = B07014.abilities!.find(a => a.id === 'a1')!;
    s = produce(s, (d) => {
      runEffect(d, a1.effect as Effect, {
        source: { player: 'self', cardId: 'B07014', abilityId: 'a1', area: 'remove' },
        bindings: {},
        triggerPayload: { kind: 'event-use' },
      } as unknown as EffectCtx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    return { s, hostUid: host.uid };
  }

  it('a1+a2: 青キャラにセット (赤 decoy 不可) → host が突撃[キャラ] を持つ', () => {
    const { s, hostUid } = setOnHost();
    const host = s.players.self.scene.find(c => c.uid === hostUid)!;
    expect(host.setCards.some(e => e.cardId === 'B07014'), '青 host にセット').toBe(true);
    const red = s.players.self.scene.find(c => c.cardId === 'RED2')!;
    expect(red.setCards.length, '赤 decoy にはセットされない').toBe(0);
    expect(charRead.keywords(s, hostUid), 'rider 突撃[キャラ]').toContain('突撃[キャラ]');
    expect(charRead.keywords(s, red.uid)).not.toContain('突撃[キャラ]');
  });

  it('a3: host から宣言 → リムーブのキャラ1枚をデッキ上へ (event decoy 除外)', () => {
    const initial = setOnHost();
    let s = initial.s;
    const { hostUid } = initial;
    s = produce(s, (d) => { d.players.self.remove = ['MOB', 'GEV5']; });
    const found = findDeclaredAbility(s, hostUid, 'BLUEHOST', 'scene', 'a3');
    expect(found, 'rider a3 が host から見える').toBeTruthy();
    const setCard = s.players.self.scene
      .find(c => c.uid === hostUid)!
      .setCards.find(entry => entry.cardId === B07014.id)!;
    const sourceRef = {
      setCardId: setCard.cardId,
      setCardInstanceId: setCard.instanceId!,
    };
    expect(canDeclaredAbility(s, hostUid, 'a3')).toBe(false);
    expect(canDeclaredAbility(s, hostUid, 'a3', sourceRef)).toBe(true);
    s = produce(s, (d) => {
      useDeclaredAbility(d, hostUid, 'a3', {
        source: {
          player: 'self', uid: hostUid, cardId: 'BLUEHOST', abilityId: 'a3', area: 'scene',
          ...sourceRef,
        },
      });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.deck[0], 'キャラ MOB がデッキ上').toBe('MOB');
    expect(s.players.self.remove, 'event decoy はリムーブに残る').toContain('GEV5');
  });
});

// ============== B09070 萩原千速&萩原研二 — 疾風 + shippuFiredCharThisTurn forEach (BUG-170 e2e) ==============
// rules/13 (疾風), rules/18 (MR/PA scope), rules/17 (【パートナー黄】)
describe('step12 B09070 萩原千速&萩原研二', () => {
  it('a1: 疾風 (1番登場) — リムーブから lv6以下 神奈川県警/疾風持ちのみ手札へ (lv7 decoy 除外)', () => {
    let s = baseState();
    s.players.self.remove = ['KANACOP', 'KANACOP7', 'MOB'];
    const chi = mutateAll.scene.enter(s, 'self', 'B09070', {});
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: chi.uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B09070', uid: chi.uid });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand, 'lv3 神奈川県警のみ eligible').toContain('KANACOP');
    expect(s.players.self.remove, 'lv7 decoy 残存').toContain('KANACOP7');
    expect(s.players.self.remove, '特徴なし decoy 残存').toContain('MOB');
    expect(s.players.self.scene.find(c => c.uid === chi.uid)!.turnEffects['shippuFiredCharThisTurn'], '疾風発動標識').toBe(true);
  });

  it('a3 + BUG-170 e2e: 疾風発動キャラが自ターン終了時にアクティブ化 (endTurn 清掃を生き残る)', () => {
    let s = baseState();
    s.players.self.remove = ['KANACOP'];
    s.players.self.deck = ['MOB', 'MOB'];
    s.players.opp.deck = ['MOB', 'MOB'];
    const chi = mutateAll.scene.enter(s, 'self', 'B09070', {});
    const plain = mutateAll.scene.enter(s, 'self', 'MOB2', {});
    const stunned = mutateAll.scene.enter(s, 'self', 'MOB', {});
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: chi.uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B09070', uid: chi.uid });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
      // Q&A: スタン状態の疾風発動キャラ = アクティブ化の代わりにスリープ (rules/03)
      d.players.self.scene.find(c => c.uid === stunned.uid)!.turnEffects['shippuFiredCharThisTurn'] = true;
      mutateAll.scene.setState(d, chi.uid, 'sleep');
      mutateAll.scene.setState(d, plain.uid, 'sleep');
      mutateAll.scene.setState(d, stunned.uid, 'stun');
      endTurn(d, 'self');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find(c => c.uid === chi.uid)!.state, '疾風発動キャラ = アクティブ化').toBe('active');
    expect(s.players.self.scene.find(c => c.uid === plain.uid)!.state, '非発動キャラ = スリープのまま').toBe('sleep');
    expect(s.players.self.scene.find(c => c.uid === stunned.uid)!.state, 'スタン発動キャラ = 代替スリープ (Q&A/rules-03)').toBe('sleep');
    // startTurn 境界で flag 清掃 (BUG-170)
    s = produce(s, (d) => { startTurn(d, 'opp'); });
    expect(s.players.self.scene.find(c => c.uid === chi.uid)!.turnEffects['shippuFiredCharThisTurn'], '次ターン開始で解除').toBeUndefined();
  });

  it('a2 condition: partner 黄のみ / cost sleepSelf', () => {
    const s = baseState();
    const chi = mutateAll.scene.enter(s, 'self', 'B09070', { active: true });
    const a2 = B09070.abilities!.find(a => a.id === 'a2')!;
    const ctx = ctxFor('self', chi.uid, 'B09070', 'a2');
    s.players.self.partner.cardId = 'PBLUE';
    expect(evalCond(s, a2.condition!, ctx)).toBe(false);
    s.players.self.partner.cardId = 'PYELLOW';
    expect(evalCond(s, a2.condition!, ctx)).toBe(true);
    expect(canPay(s, a2.cost!, ctx)).toBe(true);
  });
});

// ============== B01039 「かっ…和葉ァ!!!」 — leave:intercept kept-in-scene ==============
// rules/08, rules/16, rules/15 (「代わりに」即座解決)
describe('step12 B01039 「かっ…和葉ァ!!!」', () => {
  function withSet(): { s: GameState; victimUid: string } {
    const s = baseState();
    const victim = mutateAll.scene.enter(s, 'self', 'GREENHOST', {});
    victim.setCards.push({ cardId: 'B01039', faceUp: true });
    return { s, victimUid: victim.uid };
  }

  it('相手コンタクト起因の離場 → イベント消費 + キャラ現場残留 + 離場 hook 不発', () => {
    const { s, victimUid } = withSet();
    const emitted: string[] = [];
    event.on('leave:to-remove', (_s, p) => { emitted.push((p as { uid: string }).uid); });
    const after = produce(s, (d) => {
      const r = mutateAll.scene.removeToRemove(d, victimUid, 'contact-ap', 'atk');
      expect(r.prevented, 'intercept 成立').toBe(true);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene.some(c => c.uid === victimUid), '現場に残る').toBe(true);
    expect(after.players.self.remove, 'イベントはリムーブ (コスト)').toContain('B01039');
    expect(after.players.self.scene.find(c => c.uid === victimUid)!.setCards, 'セット解除').toHaveLength(0);
    expect(emitted, '離場 hook 不発 (Q&A)').toHaveLength(0);
  });

  it('自分の効果起因 (byPlayer=self) では intercept しない', () => {
    const { s, victimUid } = withSet();
    const after = produce(s, (d) => {
      const r = mutateAll.scene.removeToRemove(d, victimUid, 'effect', undefined, 'self');
      expect(r.prevented ?? false, '自分起因 = 素通し').toBe(false);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene.some(c => c.uid === victimUid), '通常リムーブ').toBe(false);
  });
});
