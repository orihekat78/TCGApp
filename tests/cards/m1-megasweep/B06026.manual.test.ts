// tests/cards/m1-megasweep/B06026.manual — コウモリ男（バットマン） 手書き probe (engine 実評価)
//
// 公式テキスト:
//   【パートナー緑】〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）
//   【相手ターン中】【現場リムーブ時】このカードを表向きのまま証拠として得る。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分の表向きの証拠を1つまで選び、裏向きにする。
//
// novel句 (全て engine 実評価で踏む):
//   a1 continuous: condition partnerColor{緑} → grantKeywords ['突撃[キャラ]']
//      (パートナーが緑でない場合は持たない = rules/17 §【パートナー(色)】条件未充足で「持っていない扱い」)
//   a2 triggered: hook leave:to-remove selfOnly + condition turn{opp} → selfToEvidence faceUp
//      (自分のこのキャラが相手ターン中に現場リムーブされたとき、表向きで証拠化。
//       自分ターン中は条件不成立で発火せず / 他キャラ離場では selfOnly で発火せず。gainCard は
//       remove の当該 cardId を splice して evidence へ — B06026 Q&A の実装本体。rules/17/14)
//   a3 triggered(ヒラメキ): hook evidence:remove-by-action optional → evidenceFlipDown max:1 faceUp
//      (自分の表向き証拠を1つまで裏向き。B05013/B06017/B06019 a2 と byte 同型 clone。
//       裏向き証拠・相手証拠は候補外 / 「1つまで」= 0 選択可)
//
// production dispatch:
//   - a1: engine.read.char.keywords (continuousModifier walk = 実評価オラクル)
//   - a2: mutate.scene.removeToRemove (leave:to-remove 実 emit) → runAllUntilEmpty
//   - a3: runAtom evidenceFlipDown (effect 本体を engine で実評価)
//   - owner='opp' 反転 pin (BUG-174): a2 を opp 所有で 1 scenario
//
// rules: 01-victory-conditions.md, 03-field-areas.md, 10-action-event.md, 13-keywords.md,
//        14-refresh.md, 17-icons.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { char as charRead } from '@/engine/read/char';
import { makeCtx } from '../../helpers/fixtures';
import { B06026 } from '@/cards/ct-p06/B06026';
import type { CardDef, GameState, Player, EvidenceCard, AbilityDef } from '@/engine/types';

// パートナー用 def (色のみが a1 partnerColor 判定に効く)
function partnerDef(id: string, colors: string[]): CardDef {
  return { id, no: id, kind: 'partner', names: [id], colors, level: 0, ap: 0, lp: 3, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const P_GREEN = partnerDef('PGREEN', ['緑']);
const P_RED = partnerDef('PRED', ['赤']);
// a2 selfOnly decoy 用 (能力なしの別キャラ — 離場しても B06026 a2 は反応しない)
const DECOY: CardDef = { id: 'DECOY', no: 'DECOY', kind: 'character', names: ['DECOY'], colors: ['赤'], level: 1, ap: 1000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

const HUMAN = globalThis as { __humanPlayerSide?: Player | null };

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  registerCardDef(B06026);
  registerCardDef(P_GREEN); registerCardDef(P_RED); registerCardDef(DECOY);
  registerTriggeredListener();
  HUMAN.__humanPlayerSide = null; // CPU 経路 (a2 は pick 無しゆえ AI/human 不問)
});

function ev(cardId: string, faceUp = false): EvidenceCard {
  return { cardId, faceUp, origin: { turn: 1, via: 'opening' } };
}
const ctxSelf = (uid = 'B06026#1') => makeCtx({ source: { player: 'self', uid, cardId: 'B06026', area: 'evidence' } });

// owner の現場に B06026 (+任意 decoy) を置き、partner を設定した live state を返す
function board(owner: Player, turnPlayer: Player, partnerCardId: string, withDecoy = false): { s: GameState; bat: string; decoy: string } {
  let bat = '', decoy = '';
  const s = produce(createEmptyGameState(), (d) => {
    d.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
    d.players[owner].partner.cardId = partnerCardId;
    bat = mutate.scene.enter(d, owner, 'B06026', {}).uid;
    if (withDecoy) decoy = mutate.scene.enter(d, owner, 'DECOY', {}).uid;
  });
  return { s, bat, decoy };
}

describe('B06026 コウモリ男 — shape (descriptor)', () => {
  it('id/no/色/lv/ap/lp/特徴 + a1 continuous partnerColor / a2 leave→selfToEvidence / a3 hirameki', () => {
    expect(B06026.id).toBe('B06026');
    expect(B06026.no).toBe('0649/B06026');
    expect(B06026.colors).toEqual(['緑']);
    expect(B06026.level).toBe(7);
    expect(B06026.ap).toBe(5000);
    expect(B06026.lp).toBe(0);
    expect(B06026.traits).toEqual(['YAIBA']);

    const a1 = B06026.abilities[0] as AbilityDef;
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '緑' });
    expect(typeof a1.continuousModifier?.grantKeywords).toBe('function');
    expect((a1.continuousModifier!.grantKeywords as () => string[])()).toEqual(['突撃[キャラ]']);

    const a2 = B06026.abilities[1] as AbilityDef;
    expect(a2.type).toBe('triggered');
    expect(a2.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect(a2.condition).toMatchObject({ kind: 'turn', player: 'opp' });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'selfToEvidence', args: { faceUp: true } });

    const a3 = B06026.abilities[2] as AbilityDef;
    expect(a3.type).toBe('triggered');
    expect(a3.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a3.effect).toMatchObject({ kind: 'atom', verb: 'evidenceFlipDown', args: { player: 'self', max: 1, faceUp: true } });
  });
});

describe('B06026 a1 — 【パートナー緑】突撃[キャラ] 付与 (engine 実評価)', () => {
  it('S1 パートナーが緑 → 突撃[キャラ] を持つ / off-variant 赤 → 持たない', () => {
    const { s: sGreen, bat } = board('self', 'self', 'PGREEN');
    expect(charRead.keywords(sGreen, bat), '緑パートナー → 付与').toContain('突撃[キャラ]');

    const { s: sRed, bat: batR } = board('self', 'self', 'PRED');
    expect(charRead.keywords(sRed, batR), '赤パートナー → 条件未充足で持たない').not.toContain('突撃[キャラ]');
  });
});

describe('B06026 a2 — 【相手ターン中】【現場リムーブ時】自身を表向き証拠化 (leave:to-remove 実 emit)', () => {
  it('S2 happy: 相手ターン中に自 B06026 が現場リムーブ → 自 evidence に表向きで加わる (remove から移動)', () => {
    HUMAN.__humanPlayerSide = 'self';
    const { s, bat } = board('self', 'opp', 'PGREEN'); // turn=opp = 「相手ターン中」
    const after = produce(s, (d) => {
      mutate.scene.removeToRemove(d, bat, 'contact-ap'); // 現場リムーブ (方法問わず)
      runAllUntilEmpty(d);
    });
    const evd = after.players.self.evidence;
    expect(evd.some(e => e.cardId === 'B06026' && e.faceUp), '表向きで証拠化').toBe(true);
    expect(after.players.self.remove.includes('B06026'), 'remove からは移動済 (gainCard splice)').toBe(false);
    expect(after.players.self.scene.some(c => c.uid === bat), '現場からは離脱').toBe(false);
  });

  it('S3 off-variant 自分ターン中: turn{opp} 不成立 → 証拠化せず remove に留まる', () => {
    HUMAN.__humanPlayerSide = 'self';
    const { s, bat } = board('self', 'self', 'PGREEN'); // turn=self = 自分ターン中
    const after = produce(s, (d) => {
      mutate.scene.removeToRemove(d, bat, 'contact-ap');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.evidence.some(e => e.cardId === 'B06026'), '発火せず証拠化なし').toBe(false);
    expect(after.players.self.remove.includes('B06026'), '通常どおり remove へ').toBe(true);
  });

  it('S4 selfOnly decoy: 相手ターン中に別キャラ(DECOY)が離場 → B06026 は在場のまま反応せず', () => {
    HUMAN.__humanPlayerSide = 'self';
    const { s, bat, decoy } = board('self', 'opp', 'PGREEN', true);
    const after = produce(s, (d) => {
      mutate.scene.removeToRemove(d, decoy, 'contact-ap'); // 離場するのは B06026 ではない
      runAllUntilEmpty(d);
    });
    expect(after.players.self.evidence.length, 'B06026 の a2 は selfOnly ゆえ他キャラ離場で不発').toBe(0);
    expect(after.players.self.scene.some(c => c.uid === bat), 'B06026 は現場に残存').toBe(true);
    expect(after.players.self.remove).toEqual(['DECOY']); // 離場した DECOY のみ remove
  });

  it('S5 owner=opp (BUG-174): opp の B06026 が自分ターン中(=opp から見て相手ターン)に離場 → opp evidence に表向き化', () => {
    HUMAN.__humanPlayerSide = 'opp';
    const { s, bat } = board('opp', 'self', 'PGREEN'); // owner=opp、turn=self ゆえ opp 視点で「相手ターン中」
    const after = produce(s, (d) => {
      mutate.scene.removeToRemove(d, bat, 'contact-ap');
      runAllUntilEmpty(d);
    });
    expect(after.players.opp.evidence.some(e => e.cardId === 'B06026' && e.faceUp), 'owner 反転しても表向き証拠化').toBe(true);
    expect(after.players.self.evidence.length, '自分側 evidence は無関係').toBe(0);
    expect(after.players.opp.remove.includes('B06026')).toBe(false);
  });
});

describe('B06026 a3 — 【ヒラメキ】自分の表向き証拠を1つまで裏向き (evidenceFlipDown 実評価)', () => {
  it('S6 表向き証拠を裏向き / 裏向き・相手証拠は不変 / 「1つまで」= 0 選択は no-op', () => {
    const base = (): GameState => {
      const s = createEmptyGameState();
      s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      s.players.self.evidence = [ev('FU', true), ev('FD', false)];
      s.players.opp.evidence = [ev('FU', true)]; // 同名 decoy (player:self ゆえ触らない)
      return s;
    };
    // 表向き FU を裏向き化 (pick-resolved target)
    const flipped = produce(base(), d => { runAtom(d, 'evidenceFlipDown', { player: 'self', target: 'FU', faceUp: true }, ctxSelf()); });
    expect(flipped.players.self.evidence[0].faceUp, '自 FU 裏向き').toBe(false);
    expect(flipped.players.self.evidence[1].faceUp, '元裏向き FD は不変').toBe(false);
    expect(flipped.players.opp.evidence[0].faceUp, '相手証拠は不変 (player:self)').toBe(true);

    // 「1つまで」= 0 選択 (cardIds:[]) → 何もしない
    const zero = produce(base(), d => { runAtom(d, 'evidenceFlipDown', { player: 'self', cardIds: [] }, ctxSelf()); });
    expect(zero.players.self.evidence[0].faceUp, '0 選択 → 表向きのまま').toBe(true);
  });
});
