// tests/cards/night-wA3/B02087 キール (character) — engine A3 wave (2026-07-11)
//   新 primitive: colorIgnoreOnNextHint token (ネクストヒント経路**限定**の事件色無視)。
//   - NH gate (next-hint colorAllowed / UI flows toCandidate) は本 token を honor。
//   - 手札の使用 gate (hand-use colorAllowed / handUseReason) は honor しない = NH 限定を担保。
//   a2 (【登場時】setcard 除去 → 突撃[キャラ]付与) は既存 verb で構成、production enter dispatch で検証。
// rules: 12 (NH) / 13・17 (突撃[キャラ]) / 16 (set card) / 20 (色制限).

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { handUseColorIgnoreAllowed, nextHintColorIgnoreAllowed } from '@/engine/flow/main/hand-use-card';
import { char as charRead } from '@/engine/read/char';
import { B02087 } from '@/cards/ct-p02/B02087';
import type { CardDef, GameState } from '@/engine/types';

const OPPCH = 'DEC_WA3_OPPCH';   // opp scene char that will hold a set card
const OPPBARE = 'DEC_WA3_OPPBARE'; // opp scene char with NO set card (decoy)
const SET = 'DEC_WA3_SET';        // the set card
// B03126 型: 手札の使用 + NH 両経路の色無視 (colorIgnoreOnHandUse) — 対比用
const BOTHIGNORE: CardDef = {
  id: 'DEC_WA3_BOTH', no: 'BOTH', kind: 'character', names: ['両無視'], colors: ['緑'], level: 3, ap: 1000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [{ id: 'x', type: 'continuous', continuousModifier: { colorIgnoreOnHandUse: true }, description: '' }], ruleRefs: [],
};
function ch(id: string): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = v; };

beforeEach(() => {
  event._resetRegistry();
  resetDefRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  for (const d of [B02087, BOTHIGNORE, ch(OPPCH), ch(OPPBARE), ch(SET)]) registerCardDef(d);
  registerTriggeredListener();
  setHuman('self');
});

function base(caseColors: string[]): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.case.colors = caseColors;
  return s;
}

// ─────────────────────── colorIgnoreOnNextHint token (新 primitive)
describe('colorIgnoreOnNextHint — NH 限定の事件色無視 token', () => {
  it('B02087 (黒) は NH 経路では色無視 OK (事件=青、黒⊄青)', () => {
    const s = base(['青']);
    expect(nextHintColorIgnoreAllowed(s, 'self', 'B02087'), 'NH は colorIgnoreOnNextHint を honor').toBe(true);
  });
  it('B02087 は 手札の使用 経路では色無視されない (NH 限定 = over-wide 回避)', () => {
    const s = base(['青']);
    expect(handUseColorIgnoreAllowed(s, 'self', 'B02087'), '手札の使用 gate は token を見ない').toBe(false);
  });
  it('B03126 型 (colorIgnoreOnHandUse) は 両経路とも色無視 OK', () => {
    const s = base(['青']);
    expect(handUseColorIgnoreAllowed(s, 'self', 'DEC_WA3_BOTH'), '手札の使用も OK').toBe(true);
    expect(nextHintColorIgnoreAllowed(s, 'self', 'DEC_WA3_BOTH'), 'NH も OK (NH は「手札から使用」の一種)').toBe(true);
  });
  it('token 無しの通常カードは両経路とも false (回帰)', () => {
    const s = base(['青']);
    expect(nextHintColorIgnoreAllowed(s, 'self', 'DEC_WA3_OPPCH')).toBe(false);
    expect(handUseColorIgnoreAllowed(s, 'self', 'DEC_WA3_OPPCH')).toBe(false);
  });
});

// ─────────────────────── a2 【登場時】 setcard 除去 → 突撃[キャラ] 付与
describe('B02087 a2 — 【登場時】相手セットカード除去 → 突撃[キャラ] (production enter dispatch)', () => {
  function boardWithOppSet(): { s: GameState; setUid: string; bareUid: string } {
    const s = base(['黒']);
    const c1 = mutate.scene.enter(s, 'opp', OPPCH, {});
    const c2 = mutate.scene.enter(s, 'opp', OPPBARE, {});
    mutate.char.setCard(s, c1.uid, SET, false); // OPPCH に裏向きセット
    return { s, setUid: c1.uid, bareUid: c2.uid };
  }
  function emitEnter(s: GameState): string {
    const me = mutate.scene.enter(s, 'self', 'B02087', { named: true, viaEffect: false });
    event.emit(s, 'enter', { uid: me.uid, viaEffect: false, enterOrder: me.enterOrder, enterOrderThisTurn: me.enterOrderThisTurn }, { player: 'self', cardId: 'B02087', uid: me.uid });
    runAllUntilEmpty(s);
    return me.uid;
  }

  it('セットカードを1枚除去 → このキャラが突撃[キャラ]を持つ', () => {
    const { s, setUid, bareUid } = boardWithOppSet();
    const meUid = emitEnter(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'charRemoveSetCard の pick が surface').toBeTruthy();
    const setCardOccurrence = pick!.candidates.find(candidate => candidate.hostUid === setUid);
    expect(setCardOccurrence, 'セット持ちの OPPCH の occurrence のみ候補').toMatchObject({
      kind: 'card',
      area: 'set-card',
      hidden: true,
    });
    expect(pick!.candidates.some(candidate => candidate.hostUid === bareUid), 'bare は候補外').toBe(false);
    applyPickAndContinuation(s, pick!, setCardOccurrence!.uid, [setCardOccurrence!.uid]);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.find((c) => c.uid === setUid)?.setCards.length, 'セットカード除去済').toBe(0);
    expect(s.players.opp.remove, 'セットカードはリムーブへ').toContain(SET);
    expect(charRead.keywords(s, meUid), 'リムーブした → 突撃[キャラ] 付与').toContain('突撃[キャラ]');
  });

  it('0枚選択 (skip) → 突撃[キャラ]を持たない (公式Q&A)', () => {
    const { s } = boardWithOppSet();
    const meUid = emitEnter(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick!.nMin, '「1枚まで」= 0枚可').toBe(0);
    applyPickSkipAndContinuation(s, pick!, false); // 0枚 skip
    runAllUntilEmpty(s);
    expect(charRead.keywords(s, meUid), '除去しなければ突撃なし').not.toContain('突撃[キャラ]');
  });

  it('相手にセットカードが無い → pick が出ず突撃も付かない', () => {
    const s = base(['黒']);
    mutate.scene.enter(s, 'opp', OPPBARE, {}); // set card 無し
    const meUid = emitEnter(s);
    expect(_drainPendingEffectPickSide(), '候補なし → pick 無し').toBeNull();
    expect(charRead.keywords(s, meUid)).not.toContain('突撃[キャラ]');
  });
});
