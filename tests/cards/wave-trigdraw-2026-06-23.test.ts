// wave-trigdraw (2026-06-23) — triggered-draw 4枚 runtime + 構造アサーション (engine変更0)
//   B01071 ジェイムズ・ブラック / B02079 千葉和伸 / B03058 茶木神太郎 / B07050 藤江
//
// BUG-117/118 lesson: DSL に matcherCondition を書いても engine が実評価する保証はない。
// 実 hook を grounded payload で emit し、pendingEffects 長で「発火したか」を decoy 込みで検証する
// (engine pin tests/engine/effect/wave2-cluster3-action-triggers.test.ts と同じ emitDeclare→pendingEffects 流儀)。
//
// emit payload は実 emit site と 1対1:
//   action:declare = state-machine.ts:392 近傍 {byUid,target,targetUid,uid,player} / src{player,uid,cardId}
//   contact:start  = state-machine.ts:392 {aUid,bUid} / src{player:byPlayer,uid:byUid}
//   disguise:into  = contact.ts:198 {uid,...} / src{player,uid}
//   enter          = atom-handlers/scene.ts:210 {uid,viaEffect,...} / src{player,uid,cardId}
//
// rules: 07-action-flow / 08-contact / 09-cutin-disguise / 10-action-event / 15 / 17 / 19 / 22 / 23

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../helpers/fixtures';
import { B01071 } from '@/cards/ct-p01/B01071';
import { B02079 } from '@/cards/ct-p02/B02079';
import { B03058 } from '@/cards/ct-p03/B03058';
import { B07050 } from '@/cards/ct-p07/B07050';
import type { CardDef, GameState, AbilityDef, Condition } from '@/engine/types';

// ---- synthetic decoy defs (prefix WT_ で衝突回避) ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
const NONFBI = 'WT_NONFBI';      // 特徴なし (B01071 trait:FBI decoy)
const OPPACT = 'WT_OPPACT';      // 相手アクター
const NONPOL = 'WT_NONPOL';      // 特徴なし (B02079 trait:警察 decoy)
const OPPCHR = 'WT_OPPCHR';      // 相手キャラ (contact 相手)
const DISG = 'WT_DISG';          // 変装する別キャラ (B03058)
const KOIZUMI = 'WT_KOIZUMI';    // 小泉紅子 (B07050 cardName hit)
const NOTKOIZ = 'WT_NOTKOIZ';    // 別名 (B07050 cardName decoy)

function registerDecoys(): void {
  registerCardDef(ch(NONFBI));
  registerCardDef(ch(OPPACT, { colors: ['赤'] }));
  registerCardDef(ch(NONPOL, { colors: ['黄'] }));
  registerCardDef(ch(OPPCHR));
  registerCardDef(ch(DISG));
  registerCardDef(ch(KOIZUMI, { names: ['小泉紅子'] }));
  registerCardDef(ch(NOTKOIZ, { names: ['別の人'] }));
}

const g = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };

function base(turnPlayer: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.deck = ['D1', 'D2', 'D3', 'D4'];
  s.players.opp.deck = ['E1', 'E2', 'E3', 'E4'];
  return s;
}
const fired = (s: GameState) => (s.pendingEffects ?? []).length;

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll();
  registerDecoys();
  registerTriggeredListener();
  g.__humanPlayerSide = null; // CPU 経路
  _resetPendingHirameki(); // hirameki side-channel reset
});

// ============================================================
// B01071 ジェイムズ・ブラック — action:declare 観測 (a1 自FBI / a2 相手→自FBI指定)
// ============================================================
describe('B01071 ジェイムズ・ブラック — action:declare triggered draw', () => {
  // self.scene: ジェイムズ(FBI/jb#1) + 非FBI decoy(nf#1) / opp.scene: 相手アクター(opp1)
  function board(turnPlayer: 'self' | 'opp' = 'self'): GameState {
    const s = base(turnPlayer);
    s.players.self.scene = [
      sceneChar('B01071', 'jb#1', { state: 'active' }),
      sceneChar(NONFBI, 'nf#1', { state: 'active' }),
    ];
    s.players.opp.scene = [sceneChar(OPPACT, 'opp1', { state: 'active' })];
    return s;
  }
  function emitDeclare(s: GameState, actorUid: string, actorPlayer: 'self' | 'opp', targetUid: string | undefined): GameState {
    return produce(s, (d) => {
      const target = targetUid ? { kind: 'char', uid: targetUid } : { kind: 'case', player: 'self' };
      event.emit(d, 'action:declare',
        { byUid: actorUid, target, targetUid, uid: actorUid, player: actorPlayer },
        { player: actorPlayer, uid: actorUid, cardId: 'X' });
    });
  }

  it('a1 +: 自分のFBIキャラ(ジェイムズ自身)がアクション → 発火', () => {
    expect(fired(emitDeclare(board(), 'jb#1', 'self', 'opp1'))).toBe(1);
  });
  it('a1 DECOY: 自分の非FBIキャラがアクション → 不発 (trait:FBI gate)', () => {
    expect(fired(emitDeclare(board(), 'nf#1', 'self', 'opp1'))).toBe(0);
  });
  it('a2 +: 相手キャラが自分のFBIキャラを指定してアクション → 発火', () => {
    expect(fired(emitDeclare(board(), 'opp1', 'opp', 'jb#1'))).toBe(1);
  });
  it('a2 DECOY: 相手が自分の非FBIキャラを指定 → 不発 (target trait:FBI gate)', () => {
    expect(fired(emitDeclare(board(), 'opp1', 'opp', 'nf#1'))).toBe(0);
  });
  it('a2 DECOY: 相手の action[事件] (targetUid なし) → 不発 (payloadKey:targetUid undefined)', () => {
    expect(fired(emitDeclare(board(), 'opp1', 'opp', undefined))).toBe(0);
  });

  it('descriptor: a1 action:declare + triggerCharMatches{self,FBI} → draw; a2 matcherCondition and[opp-actor, target self FBI] → draw; 両 limit turn:1', () => {
    const a1 = B01071.abilities[0];
    expect(a1.trigger?.hook).toBe('action:declare');
    expect(a1.limit).toEqual({ kind: 'turn', n: 1 });
    expect(a1.condition).toMatchObject({ kind: 'triggerCharMatches', side: 'self', filter: { trait: 'FBI' } });
    expect((a1.effect as { verb?: string }).verb).toBe('draw');
    const a2 = B01071.abilities[1];
    expect(a2.trigger?.hook).toBe('action:declare');
    expect(a2.limit).toEqual({ kind: 'turn', n: 1 });
    const mc = a2.trigger?.matcherCondition as Extract<Condition, { kind: 'and' }>;
    expect(mc.kind).toBe('and');
    const tgt = mc.cs.find((c) => (c as { payloadKey?: string }).payloadKey === 'targetUid') as Extract<Condition, { kind: 'triggerCharMatches' }>;
    expect(tgt.side).toBe('self');
    expect(tgt.filter?.trait).toBe('FBI');
  });
});

// ============================================================
// B02079 千葉和伸 — contact:start 観測 (自分ターン中 / 自警察 contact → draw+discard) + ヒラメキ
// ============================================================
describe('B02079 千葉和伸 — contact:start triggered draw+discard', () => {
  // self.scene: 千葉(警察/cb#1) + 非警察 decoy(np#1) / opp.scene: 相手(opp1)
  function board(turnPlayer: 'self' | 'opp' = 'self'): GameState {
    const s = base(turnPlayer);
    s.players.self.scene = [
      sceneChar('B02079', 'cb#1', { state: 'active' }),
      sceneChar(NONPOL, 'np#1', { state: 'active' }),
    ];
    s.players.opp.scene = [sceneChar(OPPCHR, 'opp1', { state: 'active' })];
    s.players.self.hand = ['H1'];
    return s;
  }
  function emitContact(s: GameState, aUid: string, bUid: string): GameState {
    return produce(s, (d) => {
      event.emit(d, 'contact:start', { aUid, bUid }, { player: 'self', uid: aUid });
    });
  }
  it('a1 +: 自分ターン中、自分の警察キャラ(千葉)が contact (aUid) → 発火', () => {
    expect(fired(emitContact(board('self'), 'cb#1', 'opp1'))).toBe(1);
  });
  it('a1 DECOY: contact が非警察(np#1)×相手 → 不発 (千葉が現場でも contact 参加者で gate)', () => {
    expect(fired(emitContact(board('self'), 'np#1', 'opp1'))).toBe(0);
  });
  it('a1 DECOY: 相手ターン中 → 不発 (【自分ターン中】condition gate)', () => {
    expect(fired(emitContact(board('opp'), 'cb#1', 'opp1'))).toBe(0);
  });
  it('a2 ヒラメキ: 千葉(B02079)自身が証拠から action リムーブ → pendingHirameki に push (optional)', () => {
    // ヒラメキは「証拠の自カード自身が action でリムーブされたとき」発火 = payload.ev.cardId が bearer。
    // handleEvidenceRemovedHook が removed card の abilities を見て optional→pendingHirameki side-channel へ。
    const s0 = board('self');
    s0.players.self.evidence = ['B02079'];
    produce(s0, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B02079' } }, { player: 'self', uid: 'evidence:self' });
    });
    const ph = _drainPendingHirameki();
    expect(ph?.cardId, 'B02079 a2 hirameki が pendingHirameki に push').toBe('B02079');
    expect(ph?.abilityId).toBe('a2');
  });
  it('descriptor: a1 contact:start + or[aUid/bUid self 警察] + condition turn:self → sequence[draw,discard]; a2 hirameki', () => {
    const a1 = B02079.abilities[0];
    expect(a1.trigger?.hook).toBe('contact:start');
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(a1.limit).toEqual({ kind: 'turn', n: 1 });
    const steps = (a1.effect as { steps?: { verb?: string }[] }).steps ?? [];
    expect(steps.map((x) => x.verb)).toEqual(['draw', 'discard']);
    const a2 = B02079.abilities[1];
    expect(a2.trigger?.hook).toBe('evidence:remove-by-action');
    expect(a2.trigger?.optional).toBe(true);
  });
});

// ============================================================
// B03058 茶木神太郎 — disguise:into 観測 (自分ターン中 / このキャラ以外が変装 → draw) + ヒラメキ
// ============================================================
describe('B03058 茶木神太郎 — disguise:into triggered draw', () => {
  // self.scene: 茶木(chk#1) + 別キャラ(disg#1)
  function board(turnPlayer: 'self' | 'opp' = 'self'): GameState {
    const s = base(turnPlayer);
    s.players.self.scene = [
      sceneChar('B03058', 'chk#1', { state: 'active' }),
      sceneChar(DISG, 'disg#1', { state: 'active' }),
    ];
    return s;
  }
  function emitDisguise(s: GameState, uid: string): GameState {
    return produce(s, (d) => {
      event.emit(d, 'disguise:into', { uid, fromCardId: 'F', newCardId: 'N' }, { player: 'self', uid });
    });
  }
  it('a1 +: 自分ターン中、このキャラ以外(disg#1)が変装 → 発火', () => {
    expect(fired(emitDisguise(board('self'), 'disg#1'))).toBe(1);
  });
  it('a1 DECOY: このキャラ自身(茶木)が変装 → 不発 (excludeSource)', () => {
    expect(fired(emitDisguise(board('self'), 'chk#1'))).toBe(0);
  });
  it('a1 DECOY: 相手ターン中に別キャラ変装 → 不発 (【自分ターン中】condition gate)', () => {
    expect(fired(emitDisguise(board('opp'), 'disg#1'))).toBe(0);
  });
  it('descriptor: a1 disguise:into + triggerCharMatches{excludeSource,payloadKey:uid} + condition turn:self → draw; a2 hirameki', () => {
    const a1 = B03058.abilities[0];
    expect(a1.trigger?.hook).toBe('disguise:into');
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(a1.trigger?.matcherCondition).toMatchObject({ kind: 'triggerCharMatches', excludeSource: true, payloadKey: 'uid' });
    expect((a1.effect as { verb?: string }).verb).toBe('draw');
    expect(B03058.abilities[1].trigger?.hook).toBe('evidence:remove-by-action');
  });
});

// ============================================================
// B07050 藤江 — enter 観測 (小泉紅子登場 → draw) + カットイン (conditional AP+3000/+1000)
// ============================================================
describe('B07050 藤江 — enter triggered draw + cutin', () => {
  // self.scene: 藤江(fj#1) + (登場済 koizumi#1 / decoy)
  function emitEnter(s: GameState, uid: string): GameState {
    return produce(s, (d) => {
      event.emit(d, 'enter',
        { uid, viaEffect: true, enterOrder: 2, enterOrderThisTurn: 1, sourceCardId: undefined },
        { player: 'self', uid, cardId: 'X' });
    });
  }
  it('a1 +: 自分の現場に小泉紅子が登場 → 発火', () => {
    const s = base();
    s.players.self.scene = [sceneChar('B07050', 'fj#1', { state: 'active' }), sceneChar(KOIZUMI, 'koizumi#1', { state: 'active' })];
    expect(fired(emitEnter(s, 'koizumi#1'))).toBe(1);
  });
  it('a1 DECOY: 別名キャラが登場 → 不発 (cardName:小泉紅子 gate)', () => {
    const s = base();
    s.players.self.scene = [sceneChar('B07050', 'fj#1', { state: 'active' }), sceneChar(NOTKOIZ, 'nk#1', { state: 'active' })];
    expect(fired(emitEnter(s, 'nk#1'))).toBe(0);
  });
  it('descriptor: a1 enter + triggerCharMatches{self,payloadKey:uid,cardName:小泉紅子} limit turn:1 → draw', () => {
    const a1 = B07050.abilities[0];
    expect(a1.trigger?.hook).toBe('enter');
    expect(a1.trigger?.selfOnly).toBeUndefined(); // observer (NOT selfOnly)
    expect(a1.limit).toEqual({ kind: 'turn', n: 1 });
    expect(a1.trigger?.matcherCondition).toMatchObject({ kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { cardName: '小泉紅子' } });
    expect((a1.effect as { verb?: string }).verb).toBe('draw');
  });
  it('descriptor: a2 cutin = effect:declared/optional/selfOnly + conditional(contactTargetMatches[小泉紅子]) then +3000 else +1000 ($contact.byUid, scope contact)', () => {
    const a2 = B07050.abilities[1] as AbilityDef;
    expect(a2.scope).toBe('on-hand');
    expect(a2.trigger).toMatchObject({ hook: 'effect:declared', optional: true, selfOnly: true });
    const cond = a2.effect as { kind: string; if: unknown; then: { args?: { delta?: number; uid?: string; scope?: string } }; else: { args?: { delta?: number } } };
    expect(cond.kind).toBe('conditional');
    // BUG-177 (2026-07-09): custom closure → contactCharMatches (who:'byUid'、B02006 公式Q&A 準拠)
    expect(cond.if).toMatchObject({ kind: 'contactCharMatches', who: 'byUid', filter: { cardName: ['小泉紅子'] } });
    expect(cond.then.args).toMatchObject({ uid: '$contact.byUid', delta: 3000, scope: 'contact' });
    expect(cond.else.args).toMatchObject({ delta: 1000 });
  });
});
