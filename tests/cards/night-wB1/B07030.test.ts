// tests/cards/night-wB1/B07030 黒羽快斗＆中森青子 probe — Cluster WB1: toPartnerArea pick (a1後段、2nd consumer)
//   a1【パートナー白】【宣言】: 相手lv8以下1枚デッキ下 → リムーブの〚ビッグジュエル〛イベント1枚 PA へ。
// production dispatch (activateDeclaredAbility). rules: 15/17/18/21.
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { sceneChar } from '../../helpers/fixtures';
import { B07030 } from '@/cards/ct-p07/B07030';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) =>
  ((globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s);
const sc = (cardId: string, uid: string): SceneCharacter => sceneChar(cardId, uid, { state: 'active' });
function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const PARTNER_W = def('PARTNER_W', { colors: ['白'] });
const OPPLV8 = def('OPPLV8', { names: ['敵8'], colors: ['赤'], level: 8 });
const OPPLV9 = def('OPPLV9', { names: ['敵9'], colors: ['赤'], level: 9 }); // decoy: levelMax8 外
const JEWEL_EV = { ...def('JEWEL_EV', { names: ['宝石ｲﾍﾞ'], traits: ['ビッグジュエル'] }), kind: 'event' as const };
const JEWEL_CH = def('JEWEL_CH', { names: ['宝石ｷｬﾗ'], traits: ['ビッグジュエル'] }); // decoy: kind:event でない
const ALL_DEFS = [B07030, def('FILL'), PARTNER_W, OPPLV8, OPPLV9, JEWEL_EV, JEWEL_CH];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK1', 'DK2'];
  s.players.opp.deck = ['ODK1', 'ODK2'];
  s.players.self.partner.cardId = 'PARTNER_W'; // 【パートナー白】
  return s;
}
beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  setHuman('self');
  for (const d of ALL_DEFS) registerCardDef(d);
  registerTriggeredListener();
});

describe('B07030 a1 — sceneToDeck(opp) + toPartnerArea pick (remove の〚ビッグジュエル〛イベント→ PA)', () => {
  it('相手lv8 デッキ下 → 宝石イベント PA へ (lv9/宝石キャラ は各 decoy)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'B07030', {});
    s.players.opp.scene = [sc('OPPLV8', 'o8'), sc('OPPLV9', 'o9')];
    s.players.self.remove = ['JEWEL_EV', 'JEWEL_CH'];
    activateDeclaredAbility(s, me.uid, 'a1');
    runAllUntilEmpty(s);
    // 1st pick: sceneToDeck opp lv8以下
    const p1 = _drainPendingEffectPickSide();
    expect(p1?.atomVerb, 'sceneToDeck pick surface').toBe('sceneToDeck');
    const c1 = p1!.candidates as Array<{ uid: string; cardId: string }>;
    expect(c1.map(c => c.cardId), '候補 = lv8 のみ (lv9 除外)').toEqual(['OPPLV8']);
    applyPickAndContinuation(s, p1!, 'o8', ['o8']);
    runAllUntilEmpty(s);
    // 2nd pick: toPartnerArea remove の宝石イベント
    const p2 = _drainPendingEffectPickSide();
    expect(p2?.atomVerb, 'toPartnerArea pick surface').toBe('toPartnerArea');
    const c2 = p2!.candidates as Array<{ uid: string; cardId: string }>;
    expect(c2.map(c => c.cardId), '候補 = 宝石イベントのみ (宝石キャラ=kind:event でない ので除外)').toEqual(['JEWEL_EV']);
    const evUid = c2.find(c => c.cardId === 'JEWEL_EV')!.uid;
    applyPickAndContinuation(s, p2!, evUid, [evUid]);
    runAllUntilEmpty(s);
    // 結果
    expect(s.players.opp.scene.some(c => c.uid === 'o8'), 'OPPLV8 は現場を離れた').toBe(false);
    expect(s.players.opp.deck[s.players.opp.deck.length - 1], 'OPPLV8 はデッキ下').toBe('OPPLV8');
    expect(s.players.self.partnerAreaCards, 'JEWEL_EV が PA へ').toEqual(['JEWEL_EV']);
    expect(s.players.self.remove, 'JEWEL_EV は remove から除去 (宝石キャラ残る)').toEqual(['JEWEL_CH']);
  });
});

describe('B07030 — a2/a3 構造 (M3 PA batch / cutin 既存 primitive)', () => {
  it('a2 = on-partner-area declared / or[bond] / cost partnerAreaRemove n2 / sceneEnter from hand', () => {
    const a2 = B07030.abilities[1]!;
    expect(a2.type).toBe('declared');
    expect(a2.scope).toBe('on-partner-area'); // scene+PA 双方で宣言可 (declared-ability.ts:147)
    expect(a2.condition).toMatchObject({ kind: 'or', cs: [{ kind: 'bond', cardName: '黒羽快斗' }, { kind: 'bond', cardName: '怪盗キッド' }] });
    expect(a2.cost).toMatchObject({ kind: 'partnerAreaRemove', n: 2 });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'sceneEnter', args: { from: 'hand', enterSleep: true } });
  });
  it('a3 = 【カットイン】AP+2000 (on-hand effect:declared → $contact.byUid)', () => {
    const a3 = B07030.abilities[2]!;
    expect(a3.scope).toBe('on-hand');
    expect(a3.effect).toMatchObject({ kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } });
  });
  it('MR flag: rarity MR + split-names (rules/19)', () => {
    expect(B07030.rarity).toBe('MR');
    expect(B07030.names).toEqual(['黒羽快斗＆中森青子', '黒羽快斗', '中森青子']);
  });
});
