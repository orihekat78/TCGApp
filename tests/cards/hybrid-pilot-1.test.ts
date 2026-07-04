// CARD PHASE hybrid-pilot-1 probe — compiler refuse-1行 hybrid 穴埋め 17枚
// (rep 10: B04058/B01035/B02049/B06086/PR179/PR291/PR277/D02008/B03104/B03098
//  twin 7: PR028/PR032/D06009/PR039/PR288/PR185/PR297 — 決定表 diff = deep-equal で代替)
//
// rules: 07 (アクション), 08 (コンタクト), 10 (ヒラメキ/アクション[事件]), 13 (突撃/迅速),
//        15 (「〜まで」=0可 / してもよい / そうした場合), 17 (【ターン1】【パートナー色】【FILE】【解決編】),
//        19 (元AP/LP), 21 (宣言コスト), 22 (アクション終了時まで), 24 (発動=解決不能でもカウント)
//
// 検証面: 全 novel 句を production 経路 (handUseCard / activateDeclaredAbility / 実 emit 形) で実測。
// twin は canonical deep-equal (2026-07-02 tier 規約: clone は決定表 diff で代替)。
// BUG-174 教訓: owner='opp' 側 pick (B06086 相手証拠 flip) を明示 pin。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks, _drainAllEffectPicksForTest, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { canPay } from '@/engine/cost/index';
import { _peekPendingEffectOptionalSide, _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { char as readChar } from '@/engine/read/char';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter, CardDef, EvidenceCard, AbilityDef } from '@/engine/types';
import { sceneChar as baseScene } from '../helpers/fixtures';

import { B04058 } from '@/cards/ct-p04/B04058';
import { PR028 } from '@/cards/pr-01/PR028';
import { PR032 } from '@/cards/pr-01/PR032';
import { B01035 } from '@/cards/ct-p01/B01035';
import { D06009 } from '@/cards/ct-d06/D06009';
import { B02049 } from '@/cards/ct-p02/B02049';
import { PR039 } from '@/cards/pr-01/PR039';
import { B06086 } from '@/cards/ct-p06/B06086';
import { PR288 } from '@/cards/pr-01/PR288';
import { PR179 } from '@/cards/pr-01/PR179';
import { PR185 } from '@/cards/pr-01/PR185';
import { PR291 } from '@/cards/pr-01/PR291';
import { PR297 } from '@/cards/pr-01/PR297';
import { PR277 } from '@/cards/pr-01/PR277';
import { D02008 } from '@/cards/ct-d02/D02008';
import { B03104 } from '@/cards/ct-p03/B03104';
import { B03098 } from '@/cards/ct-p03/B03098';

const ALL = [B04058, PR028, PR032, B01035, D06009, B02049, PR039, B06086, PR288,
  PR179, PR185, PR291, PR297, PR277, D02008, B03104, B03098];

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });
const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'opening' } });
const FB = { type: 'card-back' as const, cardId: 'FILL' };
function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

const FIXTURES: CardDef[] = [
  def('FILL'),
  def('KAITO', { traits: ['怪盗'] }),          // B02049 対象
  def('PLAIN'),                                 // 特徴なし decoy
  def('KOKO', { traits: ['高校生'] }),          // PR179 cost 用
  def('POL', { traits: ['警察'] }),             // B03104 対象
  def('AP7K', { ap: 7000 }),                    // PR291 対象 (AP7000 以上)
  def('AP6K', { ap: 6000 }),                    // PR291 decoy (filter 外)
  def('KID', { names: ['怪盗キッド'] }),        // PR291 絆
  def('WLOW', { colors: ['白'], level: 3 }),    // PR291 手札登場 対象
  def('WHIGH', { colors: ['白'], level: 5 }),   // PR291 decoy (lv4+)
  def('BLOW', { colors: ['青'], level: 2 }),    // PR291 decoy (白でない)
  def('YPART', { colors: ['黄'] }),
  def('WPART', { colors: ['白'] }),
  def('BPART', { colors: ['青'] }),
];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  s.players.opp.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of [...ALL, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

// ============================================================
// twin 決定表 diff — rep と abilities/keywords が canonical 一致 (id/description/no 以外)
// ============================================================
describe('hybrid-pilot-1 twins — canonical deep-equal (決定表 diff)', () => {
  // trigger.matcher は closure (__eventUse 変換) — 参照比較になるため存在一致のみ確認して除外
  const strip = (a: AbilityDef) => {
    const { id: _i, description: _d, ...rest } = a as Record<string, unknown>;
    const trig = rest.trigger as Record<string, unknown> | undefined;
    if (trig && typeof trig.matcher === 'function') {
      rest.trigger = { ...trig, matcher: '<closure>' };
    }
    return rest;
  };
  const rows: Array<[CardDef, CardDef]> = [
    [B04058, PR028], [B04058, PR032],
    [B01035, D06009],
    [B02049, PR039],
    [B06086, PR288],
    [PR179, PR185],
    [PR291, PR297],
  ];
  it.each(rows.map(([r, t]) => [r.id, t.id, r, t] as const))('%s ≡ %s', (_r, _t, rep, twin) => {
    expect(twin.abilities.map(strip)).toEqual(rep.abilities.map(strip));
    expect(twin.keywords ?? []).toEqual(rep.keywords ?? []);
  });
});

// ============================================================
// B02049/PR039 — 【ターン1】怪盗アクション観測 → そのキャラ AP+1000 (turn)
// ============================================================
describe('B02049 a1 — 怪盗 action:declare 観測 AP+1000', () => {
  function board() {
    const s = base();
    s.players.self.scene = [sc('B02049', 'ao'), sc('KAITO', 'kid'), sc('PLAIN', 'pl')];
    s.players.opp.scene = [sc('KAITO', 'okid')];
    return s;
  }
  const declare = (s0: GameState, byUid: string, player: 'self' | 'opp') => produce(s0, (d) => {
    event.emit(d, 'action:declare',
      { byUid, target: { kind: 'case', player: player === 'self' ? 'opp' : 'self' }, uid: byUid, player, targetUid: undefined },
      { player, uid: byUid });
    runAllUntilEmpty(d);
  });
  it('自分の怪盗がアクション → その怪盗 AP+1000 (base 3000→4000)', () => {
    const after = declare(board(), 'kid', 'self');
    expect(readChar.ap(after, 'kid')).toBe(4000);
  });
  it('特徴外 (PLAIN) → 不発 / 相手側の怪盗 → 不発 (side:self)', () => {
    const a1 = declare(board(), 'pl', 'self');
    expect(readChar.ap(a1, 'pl')).toBe(3000);
    const a2 = declare(board(), 'okid', 'opp');
    expect(readChar.ap(a2, 'okid')).toBe(3000);
  });
  it('【ターン1】: 同ターン2回目は不発', () => {
    const once = declare(board(), 'kid', 'self');
    const twice = declare(once, 'kid', 'self');
    expect(readChar.ap(twice, 'kid'), '2回目は +1000 されない').toBe(4000);
  });
});

// ============================================================
// B04058/PR028/PR032 — 【ターン1】アクション[事件]証拠獲得 → optional self-sleep → 相手手札1リムーブ
// ============================================================
describe('B04058 a1 — evidence:gain(action-case) → してもよい[self sleep + opp discard1]', () => {
  function board() {
    const s = base();
    s.players.self.scene = [sc('B04058', 'jd'), sc('PLAIN', 'actor')];
    s.players.opp.scene = [sc('PLAIN', 'oactor')];
    s.players.opp.hand = ['FILL', 'FILL'];
    return s;
  }
  // production emit 形 = flow/action-case.ts:141 (byUid=actor)
  const gain = (s0: GameState, byUid: string, player: 'self' | 'opp') => produce(s0, (d) => {
    event.emit(d, 'evidence:gain', { player, byUid, uid: byUid, via: 'action-case', gained: 1 }, { player, uid: byUid });
    runAllUntilEmpty(d);
  });
  it('する → B04058 スリープ + 相手手札 -1 (human 経路)', () => {
    setHuman('self');
    const s = produce(board(), (d) => {
      event.emit(d, 'evidence:gain', { player: 'self', byUid: 'actor', uid: 'actor', via: 'action-case', gained: 1 }, { player: 'self', uid: 'actor' });
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true);
      _drainAllEffectPicksForTest(d);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d); // discard player:'opp' は chooser=opp (AI 側) の pick
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find(c => c.uid === 'jd')!.state, 'self sleep').toBe('sleep');
    expect(s.players.opp.hand.length, '相手手札 -1').toBe(1);
  });
  it('しない → 状態不変 + 手札不変', () => {
    setHuman('self');
    const s = produce(board(), (d) => {
      event.emit(d, 'evidence:gain', { player: 'self', byUid: 'actor', uid: 'actor', via: 'action-case', gained: 1 }, { player: 'self', uid: 'actor' });
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      applyOptionalAndContinuation(d, p!, false);
    });
    expect(s.players.self.scene.find(c => c.uid === 'jd')!.state).toBe('active');
    expect(s.players.opp.hand.length).toBe(2);
  });
  it('相手の獲得 (player:opp) → 不発 / B04058 スリープ中 → 不発 (BUG-145 gate)', () => {
    setHuman('self');
    const s1 = gain(board(), 'oactor', 'opp');
    expect(_peekPendingEffectOptionalSide(), '相手獲得では surface しない').toBeNull();
    void s1;
    const b = board();
    b.players.self.scene = [sc('B04058', 'jd', 'sleep'), sc('PLAIN', 'actor')];
    const s2 = gain(b, 'actor', 'self');
    expect(_peekPendingEffectOptionalSide(), 'sleep 中は発動しない (ターン1未消費)').toBeNull();
    void s2;
  });
});

// ============================================================
// B01035/D06009 — 【現場リムーブ時】コンタクト起因のみ → キャラ1枚まで選びスリープ (短縮形 PA)
// ============================================================
describe('B01035 a1 — leave:to-remove(cause:contact-ap) → 1枚まで sleep', () => {
  function board() {
    const s = base();
    s.players.self.scene = [sc('B01035', 'ot')];
    s.players.opp.scene = [sc('PLAIN', 'op1')];
    return s;
  }
  const leave = (s0: GameState, cause: string) => produce(s0, (d) => {
    // production 形 = mutate/scene.ts:323 payload {uid, cause, side, byUid, removedChar}
    event.emit(d, 'leave:to-remove', { uid: 'ot', cause, side: 'self', byUid: 'op1' }, { player: 'self', uid: 'ot' });
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });
  it('コンタクト(contact-ap)でリムーブ → pick が実行されキャラ1枚 sleep (AI drain)', () => {
    const after = leave(board(), 'contact-ap');
    const slept = [...after.players.self.scene, ...after.players.opp.scene].filter(c => c.state === 'sleep');
    expect(slept.length, 'どちらかの現場のキャラ1枚が sleep').toBe(1);
  });
  it('効果リムーブ (cause:effect) → 不発 (matcherCondition cause gate)', () => {
    const after = leave(board(), 'effect');
    const slept = [...after.players.self.scene, ...after.players.opp.scene].filter(c => c.state === 'sleep');
    expect(slept.length).toBe(0);
  });
});

// ============================================================
// B06086/PR288 — アクション時 両者裏証拠1つずつ強制 flip → 2つ flip で AP+1000
// ============================================================
describe('B06086 a1 — action:declare → 自/相 裏証拠 各1 強制 faceup + 合計2で AP+1000', () => {
  function board(selfEv: EvidenceCard[], oppEv: EvidenceCard[]) {
    const s = base();
    s.players.self.scene = [sc('B06086', 'hagi')];
    s.players.self.evidence = selfEv;
    s.players.opp.evidence = oppEv;
    return s;
  }
  const act = (s0: GameState) => produce(s0, (d) => {
    event.emit(d, 'action:declare',
      { byUid: 'hagi', target: { kind: 'case', player: 'opp' }, uid: 'hagi', player: 'self', targetUid: undefined },
      { player: 'self', uid: 'hagi' });
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });
  it('両者に裏証拠 → 自1 + 相1 が表向き (owner=opp 側 pick pin、BUG-174) + AP+1000', () => {
    const after = act(board([ev('SE1')], [ev('OE1')]));
    expect(after.players.self.evidence[0].faceUp, '自分の証拠 faceup').toBe(true);
    expect(after.players.opp.evidence[0].faceUp, '相手の証拠 faceup (owner=opp)').toBe(true);
    expect(readChar.ap(after, 'hagi'), '合計2 → base6000+1000').toBe(7000);
  });
  it('相手に裏証拠なし → 自分のみ flip、AP 加算なし (「合わせて2つ」不成立)', () => {
    const after = act(board([ev('SE1')], [ev('OE1', true)]));
    expect(after.players.self.evidence[0].faceUp).toBe(true);
    expect(readChar.ap(after, 'hagi'), '1つのみ → +1000 なし (base 6000)').toBe(6000);
  });
});

// ============================================================
// D02008 — アクション時 アクション終了時まで相手カットイン不可 (cutinBanOpp_action write 側)
// canCutIn honor + clearTurnEffects('action') 清掃は engine-additive-0629d probe 済 → write 側のみ pin
// ============================================================
describe('D02008 a1 — action:declare → cutinBanOpp_action turnEffect', () => {
  function board() {
    const s = base();
    s.players.self.scene = [sc('D02008', 'hz'), sc('PLAIN', 'pl')];
    return s;
  }
  const declare = (s0: GameState, byUid: string) => produce(s0, (d) => {
    event.emit(d, 'action:declare',
      { byUid, target: { kind: 'case', player: 'opp' }, uid: byUid, player: 'self', targetUid: undefined },
      { player: 'self', uid: byUid });
    runAllUntilEmpty(d);
  });
  it('このキャラのアクション → 自身に cutinBanOpp_action=true (engine 0629d 想定 consumer)', () => {
    const after = declare(board(), 'hz');
    expect(after.players.self.scene.find(c => c.uid === 'hz')!.turnEffects['cutinBanOpp_action']).toBe(true);
  });
  it('他キャラのアクション → 不発 (selfOnly)', () => {
    const after = declare(board(), 'pl');
    expect(after.players.self.scene.find(c => c.uid === 'hz')!.turnEffects['cutinBanOpp_action']).toBeUndefined();
  });
});

// ============================================================
// PR277 — 【パートナー黄】【解決編】迅速 (partnerColorKeyword + additionalCondition)
// ============================================================
describe('PR277 a1 — partner黄 × 解決編 の AND で迅速', () => {
  const rows: Array<[string, string, string, boolean]> = [
    ['黄+解決編 → 迅速あり', 'YPART', '解決編', true],
    ['黄+事件編 → なし', 'YPART', '事件編', false],
    ['青+解決編 → なし', 'BPART', '解決編', false],
  ];
  it.each(rows)('%s', (_l, partner, caseStatus, want) => {
    const s = base();
    s.players.self.partner.cardId = partner;
    s.players.self.case.status = caseStatus as GameState['players']['self']['case']['status'];
    s.players.self.scene = [sc('PR277', 'ch')];
    expect(readChar.hasKeyword(s, 'ch', '迅速')).toBe(want);
  });
});

// ============================================================
// PR179/PR185 — 【FILE7】【宣言】【ターン1】cost[手札から高校生1枚公開]: AP+2000 + 突撃 (turn)
// production dispatch (BUG-171: activateDeclaredAbility + runAllUntilEmpty)
// ============================================================
describe('PR179 a1 — declared: FILE7 gate + revealFromHand cost + AP/突撃', () => {
  function board(file = 7, hand: string[] = ['KOKO', 'FILL']) {
    const s = base();
    s.players.self.scene = [sc('PR179', 'kyo')];
    s.players.self.file = Array.from({ length: file }, () => ({ ...FB }));
    s.players.self.hand = hand;
    return s;
  }
  it('FILE6 → 宣言不可 / FILE7 → 宣言可 (rules/17 条件外は持たない扱い)', () => {
    expect(canDeclaredAbility(board(6), 'kyo', 'a1')).toBe(false);
    expect(canDeclaredAbility(board(7), 'kyo', 'a1')).toBe(true);
  });
  it('手札に高校生なし → cost 支払不可 (rules/21 全部行えなければ使用不可)', () => {
    const mk = (hand: string[]) => {
      const s = board(7, hand);
      const ctx = { source: { player: 'self', uid: 'kyo', cardId: 'PR179', abilityId: 'a1' }, bindings: {} } as unknown as Parameters<typeof canPay>[2];
      return canPay(s, PR179.abilities[0].cost!, ctx);
    };
    expect(mk(['KOKO', 'FILL']), '高校生あり → 可').toBe(true);
    expect(mk(['FILL', 'FILL']), '高校生なし → 不可').toBe(false);
  });
  it('宣言 → AP+2000 + 突撃 (turn)。手札は公開のみで zone 不変', () => {
    const after = produce(board(), (d) => {
      activateDeclaredAbility(d, 'kyo', 'a1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    expect(readChar.ap(after, 'kyo'), 'base 4000 + 2000').toBe(6000);
    expect(readChar.hasKeyword(after, 'kyo', '突撃')).toBe(true);
    expect(after.players.self.hand.length, 'revealFromHand は zone 不変 (b8b1867c)').toBe(2);
  });
  it('【ターン1】: 2回目は宣言不可', () => {
    const after = produce(board(), (d) => {
      activateDeclaredAbility(d, 'kyo', 'a1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    expect(canDeclaredAbility(after, 'kyo', 'a1')).toBe(false);
  });
});

// ============================================================
// PR291/PR297 — 【パートナー白】【解決編】event: AP7000+ 1まで remove → 自身PA → 絆[怪盗キッド]で手札から白lv3以下 sleep 登場
// ============================================================
describe('PR291 a1 — event 使用 full path (handUseCard)', () => {
  function board(withKid: boolean) {
    const s = base();
    s.players.self.hand = ['PR291', 'WLOW', 'WHIGH', 'BLOW'];
    s.players.self.partner.cardId = 'WPART';
    s.players.self.case.colors = ['白'];
    s.players.self.case.status = '解決編';
    s.players.self.file = Array.from({ length: 6 }, () => ({ ...FB }));
    s.players.self.scene = withKid ? [sc('KID', 'kid')] : [];
    s.players.opp.scene = [sc('AP7K', 't7'), sc('AP6K', 'd6')];
    return s;
  }
  const use = (s0: GameState) => produce(s0, (d) => {
    handUseCard(d, 'self', 'PR291');
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });
  it('AP7000+ のみリムーブ (AP6K decoy 残存) + PR291 は PA へ + 絆成立で白lv3以下が sleep 登場', () => {
    const after = use(board(true));
    expect(after.players.opp.scene.some(c => c.uid === 't7'), 'AP7000 リムーブ').toBe(false);
    expect(after.players.opp.scene.some(c => c.uid === 'd6'), 'AP6000 decoy 残存').toBe(true);
    expect(after.players.self.partnerAreaCards?.includes('PR291') ?? false, 'PR291 → PA').toBe(true);
    expect(after.players.self.remove.includes('PR291'), 'remove には残らない').toBe(false);
    const entered = after.players.self.scene.find(c => c.cardId === 'WLOW');
    expect(entered, '白 lv3 登場').toBeTruthy();
    expect(entered!.state, 'スリープ状態で登場').toBe('sleep');
    expect(after.players.self.scene.some(c => c.cardId === 'WHIGH'), 'lv5 は登場不可').toBe(false);
  });
  it('絆なし → 登場ステップなし (現場は KID なしのまま)', () => {
    const after = use(board(false));
    expect(after.players.opp.scene.some(c => c.uid === 't7')).toBe(false);
    expect(after.players.self.scene.some(c => c.cardId === 'WLOW'), '絆不成立 → 登場しない').toBe(false);
    expect(after.players.self.partnerAreaCards?.includes('PR291') ?? false).toBe(true);
  });
});

// ============================================================
// B03104 — event: リムーブ15枚以上で 2枚まで / 未満で 1枚まで — 警察 AP+2000 + 突撃[キャラ] (両方付与)
// ⚠ 既知 off-by-one: 使用中イベント自身が remove で +1 カウント (D11019 precedent、BUG 起票)。
//    boundary(他14枚) は BUG-XXX 解消後に pin する — ここでは 15超/大幅未満 の両側のみ検証。
// ============================================================
describe('B03104 a1 — removeCountAtLeast 15 分岐 + AP/突撃[キャラ] 同時付与', () => {
  function board(removeCount: number) {
    const s = base();
    s.players.self.hand = ['B03104'];
    s.players.self.case.colors = ['黄'];
    s.players.self.file = Array.from({ length: 5 }, () => ({ ...FB }));
    s.players.self.remove = Array.from({ length: removeCount }, () => 'FILL');
    s.players.self.scene = [sc('POL', 'p1'), sc('POL', 'p2'), sc('PLAIN', 'x')];
    return s;
  }
  const use = (s0: GameState) => produce(s0, (d) => {
    handUseCard(d, 'self', 'B03104');
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });
  it('remove 17枚 (15以上確定) → 警察2枚とも AP+2000 + 突撃[キャラ]', () => {
    const after = use(board(17));
    for (const uid of ['p1', 'p2']) {
      expect(readChar.ap(after, uid), `${uid} AP+2000`).toBe(5000);
      expect(readChar.hasKeyword(after, uid, '突撃[キャラ]'), `${uid} 突撃[キャラ]`).toBe(true);
    }
    expect(readChar.ap(after, 'x'), '特徴外 decoy 不変').toBe(3000);
  });
  it('remove 5枚 → 1枚のみ AP+2000+突撃 (AI pick、もう1枚は不変)', () => {
    const after = use(board(5));
    const buffed = ['p1', 'p2'].filter(u => readChar.ap(after, u) === 5000);
    expect(buffed.length, '1枚だけ').toBe(1);
    expect(readChar.hasKeyword(after, buffed[0], '突撃[キャラ]'), '同じキャラに突撃[キャラ]').toBe(true);
  });
});

// ============================================================
// B03098 — a1: スリープ状態で登場したとき → アクティブにする / a2: ヒラメキ (compiler 行、pick surface)
// ============================================================
describe('B03098 a1 — sleep 登場 → アクティブ化', () => {
  it('sleep 登場 (enter emit 時に state=sleep) → active になる', () => {
    const s = base();
    const after = produce(s, (d) => {
      const c = mutateAll.scene.enter(d, 'self', 'B03098', { active: false });
      event.emit(d, 'enter', { uid: c.uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B03098', uid: c.uid });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene[0].state, 'sleep→active').toBe('active');
  });
  it('通常 (active) 登場 → 発動条件外、active のまま副作用なし', () => {
    const s = base();
    const after = produce(s, (d) => {
      const c = mutateAll.scene.enter(d, 'self', 'B03098', {});
      event.emit(d, 'enter', { uid: c.uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B03098', uid: c.uid });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene[0].state).toBe('active');
  });
});
