// tests/cards/engine-mega-w1-cards
// engine mega-wave W1 exemplar カード probe (PR136/B08036/B05049/B03084/B05045 + parallels)。
// atom レベルは engine-mega-w1.test.ts が担保。ここでは production 経路 (triggered listener /
// chain gating / cost canPay/pay / pick drain) でカード DSL が engine に評価されることを踏む。
// rules: 05/08/12/15/16/17/19/21
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { _drainAllEffectPicksForTest, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue, resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { canPay } from '@/engine/cost/evaluate';
import { pay } from '@/engine/cost/pay';
import { read as engineRead } from '@/engine/read/index';
import { PR136 } from '@/cards/pr-01/PR136';
import { PR142 } from '@/cards/pr-01/PR142';
import { B08036 } from '@/cards/ct-p08/B08036';
import { B05049 } from '@/cards/ct-p05/B05049';
import { B05049P } from '@/cards/ct-p05/B05049P';
import { B03084 } from '@/cards/ct-p03/B03084';
import { B03084P } from '@/cards/ct-p03/B03084P';
import { B05045 } from '@/cards/ct-p05/B05045';
import { B05045P } from '@/cards/ct-p05/B05045P';
import type { AbilityDef, CardDef, EffectCtx } from '@/engine/types';

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});

const ctxFor = (cardId: string, uid = 'u'): EffectCtx => ({
  source: { cardId, uid, abilityId: 'a1', player: 'self', area: 'scene' },
  bindings: {},
});

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  _clearPendingEffectPickQueue();
  for (const def of [PR136, PR142, B08036, B05049, B05049P, B03084, B03084P, B05045, B05045P]) registerCardDef(def);
  registerCardDef(mkChar('VICTIM'));
  registerCardDef(mkChar('KUDO_Y', { names: ['工藤有希子'] }));
  registerCardDef(mkChar('KAITO', { names: ['怪盗キッド'] }));
  registerCardDef(mkChar('KKAITO', { names: ['黒羽快斗'] }));
  registerCardDef(mkChar('LV7', { level: 7 }));
  registerCardDef(mkChar('LV5CARD', { level: 5 }));
  registerCardDef(mkChar('LV2CARD', { level: 2 }));
  registerTriggeredListener();
});

describe('shape (9 printings)', () => {
  it('id/no/rarity/names/abilities 骨格', () => {
    expect(PR136.abilities.map(a => a.type)).toEqual(['continuous', 'continuous', 'triggered']);
    expect(PR142).toMatchObject({ id: 'PR142', no: '0621/PR142', level: 7 });
    expect(B08036.abilities[0]!.cost).toMatchObject({ kind: 'sleepSelf' });
    expect(B05049.abilities[0]!.cost).toMatchObject({ kind: 'revealHandToDeckTop', n: 1 });
    expect(B05049P.rarity).toBe('RP');
    expect(B03084.abilities[0]!.trigger?.hook).toBe('enter');
    expect(B03084P.rarity).toBe('SRP');
    expect(B05045.rarity).toBe('MR'); // rules/18 (isMR 前方一致)
    expect(B05045.names).toEqual(['怪盗キッド＆黒羽快斗', '怪盗キッド', '黒羽快斗']); // rules/19
    expect(B05045P.rarity).toBe('MRP');
  });
});

describe('PR136 伊織無我 a3 (production trigger 経路)', () => {
  it('相手キャラをこのキャラとの contact-ap でリムーブ → 発火 → picked host の持ち主デッキからセット', () => {
    let ioriUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      ioriUid = mutate.scene.enter(d, 'self', 'PR136', {}).uid;
      const vUid = mutate.scene.enter(d, 'opp', 'VICTIM', {}).uid;
      d.players.self.deck = ['SDECK1'];
      d.players.opp.deck = ['ODECK1'];
      // このキャラ (byUid=iori) とのコンタクト AP判定でリムーブ → leave:to-remove emit
      mutate.scene.removeToRemove(d, vUid, 'contact-ap', ioriUid);
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy()); // 「キャラを1枚まで選び」を greedy 解決
    });
    // 残存キャラは伊織のみ → picked host = 伊織 (self) → 持ち主=self のデッキ上端がセットされる
    const iori = after.players.self.scene.find(c => c.uid === ioriUid)!;
    expect(iori.setCards.map(e => ({ cardId: e.cardId, faceUp: e.faceUp }))).toEqual([{ cardId: 'SDECK1', faceUp: false }]);
    expect(after.players.self.deck).toHaveLength(0);
    expect(after.players.opp.deck).toEqual(['ODECK1']); // 相手デッキは不変 (host が self 側のため)
  });

  it('opp 側 host を pick → 相手(持ち主)のデッキからセット (deckOwner 本命経路、human pick で決定論)', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const s = createEmptyGameState();
    s.turn.player = 'self';
    const ioriUid = mutate.scene.enter(s, 'self', 'PR136', {}).uid;
    const oSurvivorUid = mutate.scene.enter(s, 'opp', 'LV7', {}).uid; // 生存する相手キャラ
    const vUid = mutate.scene.enter(s, 'opp', 'VICTIM', {}).uid;
    s.players.self.deck = ['SDECK1'];
    s.players.opp.deck = ['ODECK1'];
    mutate.scene.removeToRemove(s, vUid, 'contact-ap', ioriUid);
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    expect(pending?.atomVerb).toBe('charSetCard');
    applyPickAndContinuation(s, pending!, oSurvivorUid); // 相手側 host を明示 pick
    const oHost = s.players.opp.scene.find(c => c.uid === oSurvivorUid)!;
    expect(oHost.setCards.map(e => ({ cardId: e.cardId, faceUp: e.faceUp }))).toEqual([{ cardId: 'ODECK1', faceUp: false }]); // 持ち主=opp のデッキ
    expect(s.players.opp.deck).toHaveLength(0);
    expect(s.players.self.deck).toEqual(['SDECK1']); // 自分のデッキは不変
  });

  it('DECOY: cause=effect のリムーブでは発火しない (cause:contact-ap gate)', () => {
    let ioriUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      ioriUid = mutate.scene.enter(d, 'self', 'PR136', {}).uid;
      const vUid = mutate.scene.enter(d, 'opp', 'VICTIM', {}).uid;
      d.players.self.deck = ['SDECK1'];
      mutate.scene.removeToRemove(d, vUid, 'effect', ioriUid);
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    const iori = after.players.self.scene.find(c => c.uid === ioriUid)!;
    expect(iori.setCards).toHaveLength(0);
    expect(after.players.self.deck).toEqual(['SDECK1']);
  });
});

describe('B08036 a1 (chain gating)', () => {
  it('リムーブに工藤有希子有 → セット + 後段 sceneToDeck も走る (自身 lv7 が唯一候補 → デッキ下 + rules/16 set リムーブ)', () => {
    let crisUid = '';
    const s = createEmptyGameState();
    s.players.self.remove = ['KUDO_Y'];
    const a1 = B08036.abilities[0] as AbilityDef;
    const after = produce(s, (d) => {
      crisUid = mutate.scene.enter(d, 'self', 'B08036', {}).uid;
      runEffect(d, a1.effect!, { ...ctxFor('B08036', crisUid), source: { cardId: 'B08036', uid: crisUid, abilityId: 'a1', player: 'self', area: 'scene' } });
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    // step1 成立 (chain 継続) → step2 の唯一候補 = B08036 自身 (lv7≤7) → デッキ下へ。
    // 離場時 rules/16 でセット済 KUDO_Y は remove へ戻る (leave 時 set リムーブの end-to-end 検証)。
    expect(after.players.self.scene).toHaveLength(0);
    expect(after.players.self.deck[after.players.self.deck.length - 1]).toBe('B08036');
    expect(after.players.self.remove).toContain('KUDO_Y');
  });

  it('リムーブに工藤有希子無 → chain break (「セットした場合」不成立、後段不実行)', () => {
    let crisUid = '';
    let lv7Uid = '';
    const s = createEmptyGameState();
    s.players.self.remove = ['VICTIM']; // 名前不一致 decoy のみ
    const a1 = B08036.abilities[0] as AbilityDef;
    const after = produce(s, (d) => {
      crisUid = mutate.scene.enter(d, 'self', 'B08036', {}).uid;
      lv7Uid = mutate.scene.enter(d, 'opp', 'LV7', {}).uid;
      runEffect(d, a1.effect!, { ...ctxFor('B08036', crisUid), source: { cardId: 'B08036', uid: crisUid, abilityId: 'a1', player: 'self', area: 'scene' } });
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    const cris = after.players.self.scene.find(c => c.uid === crisUid)!;
    expect(cris.setCards).toHaveLength(0);
    // 後段 sceneToDeck が走っていない = LV7 は現場に残る
    expect(after.players.opp.scene.some(c => c.uid === lv7Uid)).toBe(true);
  });
});

describe('B05049 a1 (cost + grant)', () => {
  it('canPay: 手札に怪盗キッド (分割名 B05045 も可) / pay 後デッキ上へ', () => {
    const cost = (B05049.abilities[0] as AbilityDef).cost!;
    const s1 = createEmptyGameState();
    s1.players.self.hand = ['KAITO'];
    expect(canPay(s1, cost, ctxFor('B05049'))).toBe(true);
    // rules/19: 分割名 — B05045 (怪盗キッド＆黒羽快斗) も「カード名[怪盗キッド]」に該当 (公式Q&A B05049)
    const s2 = createEmptyGameState();
    s2.players.self.hand = ['B05045'];
    expect(canPay(s2, cost, ctxFor('B05049'))).toBe(true);
    const s3 = createEmptyGameState();
    s3.players.self.hand = ['VICTIM'];
    expect(canPay(s3, cost, ctxFor('B05049'))).toBe(false);
    const after = produce(s1, (d) => { d.players.self.deck = ['d1']; pay(d, cost, ctxFor('B05049')); });
    expect(after.players.self.hand).toHaveLength(0);
    expect(after.players.self.deck[0]).toBe('KAITO');
  });

  it('effect: 黒羽快斗のキャラに 突撃 turn 付与 (human 経路: resolveEffectPicks pre-walk + applyPick)', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const s = createEmptyGameState();
    const a1 = B05049.abilities[0] as AbilityDef;
    const kkUid = mutate.scene.enter(s, 'self', 'KKAITO', {}).uid;
    const vicUid = mutate.scene.enter(s, 'opp', 'VICTIM', {}).uid;
    // production 宣言 dispatch と同じ入口 (declared-ability.ts:212): resolveEffectPicks pre-walk が
    // Pattern-A (uid:'$pick') を pending pick として surface → human は applyPickAndContinuation。
    const ctx = ctxFor('B05049');
    const resolved = resolveEffectPicks(s, a1.effect!, ctx, { byPlayer: 'self', humanChooser: true, source: { cardId: 'B05049', abilityId: 'a1' } });
    runEffect(s, resolved, ctx);
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    expect(pending?.atomVerb).toBe('charGrantKeyword');
    // filter cardName:黒羽快斗 — 候補は KKAITO のみ (VICTIM decoy 除外)
    const candUids = (pending!.candidates as { uid: string }[]).map(c => c.uid);
    expect(candUids).toContain(kkUid);
    expect(candUids).not.toContain(vicUid);
    applyPickAndContinuation(s, pending!, kkUid);
    expect(engineRead.char.keywords(s, kkUid)).toContain('突撃');
    expect(engineRead.char.keywords(s, vicUid)).not.toContain('突撃');
  });
});

describe('B03084 a1/a2', () => {
  it('a1: 相手証拠→相手デッキ下 + 相手Lv7以下→相手の表向き証拠 (sequence、両方 pick 解決)', () => {
    const a1 = B03084.abilities[0] as AbilityDef;
    const after = produce(createEmptyGameState(), (d) => {
      mutate.scene.enter(d, 'opp', 'LV7', {});
      d.players.opp.evidence = [{ cardId: 'EV1', faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
      d.players.opp.deck = ['od1'];
      runEffect(d, a1.effect!, ctxFor('B03084'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    // 証拠 EV1 → 相手デッキ下
    expect(after.players.opp.deck).toContain('EV1');
    // LV7 → 相手の証拠 (表向き)
    const evIds = after.players.opp.evidence.map(e => e.cardId);
    expect(evIds).toContain('LV7');
    const lv7ev = after.players.opp.evidence.find(e => e.cardId === 'LV7')!;
    expect(lv7ev.faceUp).toBe(true);
    expect(after.players.opp.scene).toHaveLength(0);
  });

  it('a2: 捜査1 で Lv5以上発見 → AP+2000 / Lv2 発見 → 据置 (boundAnyMatchesFilter gate)', () => {
    const a2 = B03084.abilities[1] as AbilityDef;
    const run = (topCard: string) => {
      let fUid = '';
      const after = produce(createEmptyGameState(), (d) => {
        fUid = mutate.scene.enter(d, 'self', 'B03084', {}).uid;
        d.players.opp.deck = [topCard, 'filler'];
        runEffect(d, a2.effect!, { ...ctxFor('B03084', fUid), source: { cardId: 'B03084', uid: fUid, abilityId: 'a2', player: 'self', area: 'scene' } });
        _drainAllEffectPicksForTest(d, new HeuristicPolicy());
      });
      const f = after.players.self.scene.find(c => c.uid === fUid)!;
      const deltas = (f.turnEffects?.apDeltas ?? f.turnEffects?.apDelta ?? []) as unknown;
      return { after, f, deltasStr: JSON.stringify(f.turnEffects ?? {}) + JSON.stringify(deltas) };
    };
    const hit = run('LV5CARD');
    expect(hit.deltasStr).toContain('2000'); // 発見 Lv5 → AP+2000 (turn)
    const miss = run('LV2CARD');
    expect(miss.deltasStr).not.toContain('2000'); // Lv2 → 不成立
  });
});

describe('sceneToEvidence edge (W1 review NIT 対応)', () => {
  it('MR① redirect: 自ターン中に相手 MR を証拠化 → PA へ redirect、証拠にならない (rules/18)', () => {
    registerCardDef(mkChar('OPPMR', { level: 5, rarity: 'MR' }));
    let mrUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self'; // owner=opp ≠ turn.player=self → redirect 条件成立
      mrUid = mutate.scene.enter(d, 'opp', 'OPPMR', {}).uid;
      runEffect(d, { kind: 'atom', verb: 'sceneToEvidence', args: { uid: mrUid, faceUp: true } } as never, ctxFor('B03084'));
    });
    expect(after.players.opp.evidence).toHaveLength(0); // 証拠にならない
    expect(after.players.opp.scene).toHaveLength(0);
    expect(after.players.opp.partnerAreaMR?.cardId).toBe('OPPMR'); // PA へ
  });

  it('$pick skip (0枚選択) → no-op (rules/15「1枚まで」)', () => {
    const after = produce(createEmptyGameState(), (d) => {
      mutate.scene.enter(d, 'opp', 'LV7', {});
      runEffect(d, { kind: 'atom', verb: 'sceneToEvidence', args: { uid: '$pick', faceUp: true } } as never, ctxFor('B03084'));
    });
    expect(after.players.opp.evidence).toHaveLength(0);
    expect(after.players.opp.scene).toHaveLength(1); // 据置
  });
});

describe('B05045 a2 (chain filePop → handToFileBottom)', () => {
  it('FILE上1枚→手札、手札1枚→FILE1番下表向き', () => {
    const a2 = B05045.abilities[1] as AbilityDef;
    // file は produce 前に seed (popTop の Immer current() は draft 前提のため base state に載せる)
    const s = createEmptyGameState();
    s.players.self.hand = ['KAITO'];
    s.players.self.file = [
      { type: 'card-back', cardId: 'F_BOT' },
      { type: 'card-back', cardId: 'F_TOP' },
    ];
    const after = produce(s, (d) => {
      runEffect(d, a2.effect!, ctxFor('B05045'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    // F_TOP が手札へ、手札から1枚 (KAITO or F_TOP) が FILE 1番下に表向きで
    expect(after.players.self.file).toHaveLength(2);
    const bottom = after.players.self.file[0]!;
    expect(bottom.type).toBe('card-back');
    expect((bottom as { faceUp?: boolean }).faceUp).toBe(true);
    expect(after.players.self.hand).toHaveLength(1); // +1 (F_TOP) -1 (bottom へ)
  });

  it('FILE 0枚 → chain break (手札は動かない)', () => {
    const a2 = B05045.abilities[1] as AbilityDef;
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = ['KAITO'];
      d.players.self.file = [];
      runEffect(d, a2.effect!, ctxFor('B05045'));
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    expect(after.players.self.hand).toEqual(['KAITO']);
    expect(after.players.self.file).toHaveLength(0);
  });
});
