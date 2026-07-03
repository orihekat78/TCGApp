// tests/cards/engine-mega-w1
// engine mega-wave W1 (2026-07-03): additive verb/cost 6件の TDD probe。
//   r2  charSetCard deckOwner:'picked-host' — セット元デッキを pick した host の持ち主側に (PR136/PR142)
//   r4  charSetCard cardIds remove-source — リムーブから pick した cardId を host へ裏向きセット (B08036)
//   r55 cost revealHandToDeckTop — 手札公開→デッキ上 (B05049/P)
//   r66 verb sceneToEvidence — 現場キャラを所有者の証拠へ (B03084/P)
//   r68 verb handToFileBottom — 手札1枚を FILE の1番下に表向きで (B05045/P)
//   +   verb evidenceToDeckBottom — 証拠を pick して持ち主のデッキ下へ (B03084 a1 前段)
// rules: 01/03/05/12/14/15/16/21
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { run as runEffect } from '@/engine/effect/resolver';
import { canPay } from '@/engine/cost/evaluate';
import { pay } from '@/engine/cost/pay';
import type { CardDef, EffectCtx, Cost } from '@/engine/types';

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});

const ctxFor = (cardId: string, uid = 'u', player: 'self' | 'opp' = 'self'): EffectCtx => ({
  source: { cardId, uid, abilityId: 'a1', player, area: 'scene' },
  bindings: {},
});

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  for (const id of ['HOSTX', 'KUDO', 'KID', 'DECOY']) registerCardDef(mkChar(id));
  registerCardDef(mkChar('KUDO_Y', { names: ['工藤有希子'] }));
  registerCardDef(mkChar('KAITO', { names: ['怪盗キッド'] }));
  registerTriggeredListener();
});

describe('r2 charSetCard deckOwner:picked-host', () => {
  it('host が相手キャラ → 相手(持ち主)のデッキ上端をセット、自デッキ不変', () => {
    let oUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      mutate.scene.enter(d, 'self', 'HOSTX', {});
      oUid = mutate.scene.enter(d, 'opp', 'HOSTX', {}).uid;
      d.players.self.deck = ['SELF1'];
      d.players.opp.deck = ['OPP1'];
      runEffect(d, { kind: 'atom', verb: 'charSetCard', args: { uid: oUid, fromDeckTop: true, faceUp: false, deckOwner: 'picked-host' } } as never, ctxFor('PR136'));
    });
    const o1 = after.players.opp.scene.find(c => c.uid === oUid)!;
    expect(o1.setCards.map(e => e.cardId)).toEqual(['OPP1']); // 持ち主=opp のデッキ上端
    expect(after.players.opp.deck).toHaveLength(0);
    expect(after.players.self.deck).toEqual(['SELF1']); // 自分デッキ不変
  });

  it('deckOwner 無指定は従来通り (controller=self のデッキ)', () => {
    let oUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      oUid = mutate.scene.enter(d, 'opp', 'HOSTX', {}).uid;
      d.players.self.deck = ['SELF1'];
      d.players.opp.deck = ['OPP1'];
      runEffect(d, { kind: 'atom', verb: 'charSetCard', args: { uid: oUid, fromDeckTop: true, faceUp: false } } as never, ctxFor('X'));
    });
    const o1 = after.players.opp.scene.find(c => c.uid === oUid)!;
    expect(o1.setCards.map(e => e.cardId)).toEqual(['SELF1']); // 既定 = 自分のデッキ (回帰)
    expect(after.players.opp.deck).toEqual(['OPP1']);
  });
});

describe('r4 charSetCard cardIds remove-source', () => {
  it('リムーブから pick 済 cardId を host へ裏向きセット + remove から splice', () => {
    let hUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      hUid = mutate.scene.enter(d, 'self', 'HOSTX', {}).uid;
      d.players.self.remove = ['KUDO_Y', 'DECOY'];
      runEffect(d, {
        kind: 'atom', verb: 'charSetCard',
        args: {
          uid: hUid, cardIds: ['KUDO_Y'],
          target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { kind: 'character', cardName: '工藤有希子' } }, n: { min: 0, max: 1 }, chooser: 'self' },
        },
      } as never, ctxFor('B08036', hUid));
    });
    const h = after.players.self.scene.find(c => c.uid === hUid)!;
    expect(h.setCards.map(e => ({ cardId: e.cardId, faceUp: e.faceUp }))).toEqual([{ cardId: 'KUDO_Y', faceUp: false }]);
    expect(after.players.self.remove).toEqual(['DECOY']); // splice 済 / decoy 残存
  });

  it('cardIds:[] (0枚 pick) → no-op + chainStepNoApply (「セットした場合」gate)', () => {
    let hUid = '';
    let noApply = false;
    const after = produce(createEmptyGameState(), (d) => {
      hUid = mutate.scene.enter(d, 'self', 'HOSTX', {}).uid;
      d.players.self.remove = ['DECOY'];
      const ctx = ctxFor('B08036', hUid);
      runEffect(d, {
        kind: 'atom', verb: 'charSetCard',
        args: { uid: hUid, cardIds: [], target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 0, max: 1 }, chooser: 'self' } },
      } as never, ctx);
      noApply = ctx.dyn?.chainStepNoApply === true;
    });
    const h = after.players.self.scene.find(c => c.uid === hUid)!;
    expect(h.setCards).toHaveLength(0);
    expect(after.players.self.remove).toEqual(['DECOY']);
    expect(noApply).toBe(true); // chain break 信号
  });
});

describe('r55 cost revealHandToDeckTop', () => {
  const cost = {
    kind: 'revealHandToDeckTop',
    target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: '怪盗キッド' } }, n: { min: 1, max: 1 }, chooser: 'self' },
    n: 1,
  } as unknown as Cost;

  it('canPay: 手札に怪盗キッド有 → true / 無 → false', () => {
    const s1 = createEmptyGameState();
    s1.players.self.hand = ['KAITO'];
    expect(canPay(s1, cost, ctxFor('B05049'))).toBe(true);
    const s2 = createEmptyGameState();
    s2.players.self.hand = ['DECOY'];
    expect(canPay(s2, cost, ctxFor('B05049'))).toBe(false);
  });

  it('pay: 手札から抜けてデッキ上 (裏向き=deck) へ', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = ['KAITO', 'DECOY'];
      d.players.self.deck = ['d1', 'd2'];
      pay(d, cost, ctxFor('B05049'));
    });
    expect(after.players.self.hand).toEqual(['DECOY']);
    expect(after.players.self.deck[0]).toBe('KAITO'); // デッキの上
    expect(after.players.self.deck).toHaveLength(3);
  });
});

describe('r66 verb sceneToEvidence', () => {
  it('相手現場キャラ → 相手(所有者)の証拠へ表向きで積まれる (現場から消える)', () => {
    let cUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      cUid = mutate.scene.enter(d, 'opp', 'DECOY', {}).uid;
      runEffect(d, { kind: 'atom', verb: 'sceneToEvidence', args: { uid: cUid, faceUp: true } } as never, ctxFor('B03084'));
    });
    expect(after.players.opp.scene.find(c => c.uid === cUid)).toBeUndefined();
    expect(after.players.opp.evidence).toHaveLength(1);
    const top = after.players.opp.evidence[after.players.opp.evidence.length - 1]!;
    expect(top.cardId).toBe('DECOY');
    expect(top.faceUp).toBe(true); // 「表向きのまま証拠として得る」
  });

  it('setCards 持ちキャラの離場 → set カードは所有者の remove へ (rules/16)', () => {
    let cUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      cUid = mutate.scene.enter(d, 'opp', 'DECOY', {}).uid;
      mutate.char.setCard(d, cUid, 'KUDO', false);
      runEffect(d, { kind: 'atom', verb: 'sceneToEvidence', args: { uid: cUid, faceUp: true } } as never, ctxFor('B03084'));
    });
    expect(after.players.opp.remove).toContain('KUDO');
    expect(after.players.opp.evidence.map(e => e.cardId)).toEqual(['DECOY']);
  });
});

describe('r68 verb handToFileBottom', () => {
  it('手札1枚 → FILE の1番下 (配列先頭) に表向きで', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = ['KID'];
      d.players.self.file = [{ type: 'card-back', cardId: 'F_TOP' }];
      runEffect(d, { kind: 'atom', verb: 'handToFileBottom', args: { player: 'self', target: ['KID'] } } as never, ctxFor('B05045'));
    });
    expect(after.players.self.hand).toHaveLength(0);
    expect(after.players.self.file).toHaveLength(2);
    const bottom = after.players.self.file[0]!;
    expect(bottom).toMatchObject({ type: 'card-back', cardId: 'KID', faceUp: true }); // 1番下 + 表向き
    expect(after.players.self.file[1]!.cardId).toBe('F_TOP'); // 最上部は不変
  });
});

describe('+ verb evidenceToDeckBottom', () => {
  it('相手証拠から pick 済1枚 → 相手デッキの下へ (裏向き=deck、確認不可)', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.opp.evidence = [
        { cardId: 'EV1', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
        { cardId: 'EV2', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
      ];
      d.players.opp.deck = ['d1'];
      runEffect(d, { kind: 'atom', verb: 'evidenceToDeckBottom', args: { player: 'opp', target: ['EV1'] } } as never, ctxFor('B03084'));
    });
    expect(after.players.opp.evidence.map(e => e.cardId)).toEqual(['EV2']);
    expect(after.players.opp.deck).toEqual(['d1', 'EV1']); // デッキの下 (末尾)
  });

  it('対象不在 cardId → no-op (証拠/デッキ不変)', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.opp.evidence = [{ cardId: 'EV1', faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
      d.players.opp.deck = ['d1'];
      runEffect(d, { kind: 'atom', verb: 'evidenceToDeckBottom', args: { player: 'opp', target: ['NOPE'] } } as never, ctxFor('B03084'));
    });
    expect(after.players.opp.evidence).toHaveLength(1);
    expect(after.players.opp.deck).toEqual(['d1']);
  });
});
