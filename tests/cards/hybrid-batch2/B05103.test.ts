// hybrid-batch2 probe — B05103「籌を帷幄の中に運らし…勝ちを千里の外に決す…」(event, engine変更0)
//
// 公式テキスト (novel line, payload refusedLine):
//   【パートナー黄】キャラを1枚まで選び、リムーブする。相手の証拠が自分の証拠より2つ以上多い場合、
//   手札を1枚リムーブしてもよい。そうした場合、相手の証拠を1つまで選び、デッキの下に移し、自分は証拠を1つ得る。
//
// DSL: triggered(effect:declared, selfOnly, matcher kind==='event-use', condition partnerColor:'黄') →
//   sequence[
//     atom sceneRemove{player:'self', max:1, side:'either', cause:'effect'},         // キャラ1枚まで選びリムーブ
//     conditional{ if evidenceDiff{player:'opp', other:'self', n:2}                  // 相手証拠 − 自証拠 ≥ 2
//       then chain[                                                                  // 「そうした場合」= chain gate
//         atom discard{player:'self', max:1},                                        // 手札1枚リムーブ「してもよい」
//         atom evidenceToDeckBottom{player:'opp', pick evidence side:opp chooser:self n:0-1}, // 相手証拠1つまでデッキ下
//         atom evidenceGain{player:'self', n:1} ] } ]                                // 自分は証拠1つ得る
//
// 検証面 (全 novel 句を production dispatch = handUseCard 経由で実測):
//   - effect:declared(event-use) + partnerColor:'黄' gate で発火 (青パートナーは不発)
//   - sceneRemove side:'either' の 1枚まで選択 / BUG-174: owner='opp' 側の相手キャラを選び remove
//   - evidenceDiff{opp,self,n:2} の分岐 (差 2 で成立 / 差 <2 で chain 非進入)
//   - 「そうした場合」= chain-origin gate: discard を human 辞退 → evidenceToDeckBottom / evidenceGain skip
//   - QA: キャラを0枚 remove しても (sequence-origin) 以降の効果は解決される
//   - evidenceToDeckBottom pick は相手証拠のみ (BUG-117/118: 自証拠 decoy は候補外 / owner=opp)
//   - evidenceToDeckBottom は「持ち主の」デッキ下 (相手デッキ末尾) / evidenceGain は自デッキから +1
//   - negative: partnerColor 不成立 / evidenceDiff 不成立
//
// 人手 pick は setHuman('self') で held → _drainPendingEffectPickSide + apply/skip で駆動 (B09061/B01084 慣行)。

import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter, CardDef, EvidenceCard } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

import { B05103 } from '@/cards/ct-p05/B05103';

const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });
const ev = (cardId: string): EvidenceCard => ({ cardId, faceUp: false, origin: { turn: 1, via: 'opening' } });

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const FIXTURES: CardDef[] = [
  def('FILL'),
  def('HAND1'),                        // discard 対象 (手札)
  def('SELFCH'),                       // sceneRemove 候補 (自陣)
  def('OPPCH'),                        // sceneRemove 候補 (相手陣、owner=opp pin)
  def('YPART', { colors: ['黄'] }),    // 黄 パートナー
  def('BPART', { colors: ['青'] }),    // 青 パートナー (partnerColor 不成立)
];

type Opt = { partner?: string; selfEv?: number; oppEv?: number; scenes?: boolean; hand?: string[] };

function base(o: Opt = {}): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK1', 'DK2', 'DK3', 'DK4'];
  s.players.opp.deck = ['ODK1', 'ODK2', 'ODK3', 'ODK4'];
  s.players.self.hand = o.hand ?? ['B05103', 'HAND1'];
  s.players.self.partner.cardId = o.partner ?? 'YPART';
  s.players.self.case.colors = ['黄'];
  s.players.self.file = Array.from({ length: 7 }, () => ({ type: 'card-back' as const, cardId: 'FILL' }));
  // 証拠: self は先頭に decoy 'SE_DECOY' を必ず1枚、以降 filler。opp は 'OE0','OE1',... で識別。
  const selfN = o.selfEv ?? 1;
  s.players.self.evidence = Array.from({ length: selfN }, (_v, i) => ev(i === 0 ? 'SE_DECOY' : `SE${i}`));
  const oppN = o.oppEv ?? 3;
  s.players.opp.evidence = Array.from({ length: oppN }, (_v, i) => ev(`OE${i}`));
  if (o.scenes) {
    s.players.self.scene = [sc('SELFCH', 'sc1')];
    s.players.opp.scene = [sc('OPPCH', 'oc1')];
  }
  return s;
}

const drain = () => _drainPendingEffectPickSide();

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  setHuman('self');
  for (const d of [B05103, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

describe('B05103 — event 使用 full path (handUseCard, engine変更0)', () => {
  it('黄P + 証拠差2 → 相手キャラremove(owner=opp) → 手札discard → 相手証拠デッキ下 → 自証拠+1', () => {
    const s = base({ scenes: true, selfEv: 1, oppEv: 3 }); // diff = 3-1 = 2 → 成立

    handUseCard(s, 'self', 'B05103');
    runAllUntilEmpty(s);
    expect(s.players.self.hand, 'イベント使用でB05103は手札を離れる').toEqual(['HAND1']);
    expect(s.players.self.remove, 'B05103はリムーブエリアへ (rules/06)').toContain('B05103');

    // ---- step1: sceneRemove (side:either) ----
    const p1 = drain();
    expect(p1?.atomVerb, 'sceneRemove pick が surface').toBe('sceneRemove');
    const p1uids = (p1!.candidates as Array<{ uid: string }>).map(c => c.uid).sort();
    expect(p1uids, 'side:either → 自陣sc1 と 相手陣oc1 の両方が候補').toEqual(['oc1', 'sc1']);
    applyPickAndContinuation(s, p1!, 'oc1'); // BUG-174: 相手キャラを選ぶ
    expect(s.players.opp.scene.some(c => c.uid === 'oc1'), '相手キャラ oc1 removed').toBe(false);
    expect(s.players.self.scene.some(c => c.uid === 'sc1'), '自陣 sc1 は残存').toBe(true);

    // ---- step2: discard (手札1枚) ----
    const p2 = drain();
    expect(p2?.atomVerb, 'evidenceDiff 成立 → chain 進入 → discard pick').toBe('discard');
    expect((p2!.candidates as Array<{ cardId: string }>).map(c => c.cardId), '手札候補は HAND1').toEqual(['HAND1']);
    applyPickAndContinuation(s, p2!, p2!.candidates[0]!.uid);
    expect(s.players.self.hand, 'HAND1 discard → 手札空').toEqual([]);

    // ---- step3: evidenceToDeckBottom (相手証拠1つまで) ----
    const p3 = drain();
    expect(p3?.atomVerb, 'evidenceToDeckBottom pick').toBe('evidenceToDeckBottom');
    const p3cands = p3!.candidates as Array<{ uid: string; cardId: string; player: string }>;
    expect(p3cands.map(c => c.cardId).sort(), '相手証拠3つのみ (自証拠 SE_DECOY は候補外)').toEqual(['OE0', 'OE1', 'OE2']);
    expect(p3cands.every(c => c.player === 'opp'), 'BUG-174: 全候補が相手側').toBe(true);
    expect(p3cands.some(c => c.cardId === 'SE_DECOY'), 'BUG-117/118: 自証拠 decoy は候補に無い').toBe(false);
    const oe0 = p3cands.find(c => c.cardId === 'OE0')!;
    applyPickAndContinuation(s, p3!, oe0.uid);

    // ---- 結果 ----
    expect(s.players.opp.evidence.map(e => e.cardId).sort(), 'OE0 が証拠から抜ける').toEqual(['OE1', 'OE2']);
    expect(s.players.opp.deck[s.players.opp.deck.length - 1], 'OE0 は持ち主(相手)デッキの下へ').toBe('OE0');
    expect(s.players.self.evidence.length, '自証拠 +1 (1→2)').toBe(2);
    expect(s.players.self.evidence.map(e => e.cardId), 'decoy 残存 + 自デッキ先頭 DK1 を獲得').toEqual(['SE_DECOY', 'DK1']);
    expect(drain(), '以降 pick は無い').toBeNull();
  });
});

describe('B05103 — evidenceDiff 分岐 (negative)', () => {
  it('証拠差1 (opp2 - self1) → chain 非進入: discard/デッキ下/証拠獲得なし', () => {
    const s = base({ scenes: true, selfEv: 1, oppEv: 2 }); // diff = 1 < 2

    handUseCard(s, 'self', 'B05103');
    runAllUntilEmpty(s);

    const p1 = drain();
    expect(p1?.atomVerb).toBe('sceneRemove');
    applyPickAndContinuation(s, p1!, 'oc1');

    expect(drain(), 'evidenceDiff 不成立 → 後続 pick は surface しない').toBeNull();
    expect(s.players.self.hand, '手札は discard されない').toEqual(['HAND1']);
    expect(s.players.opp.evidence.length, '相手証拠 不変').toBe(2);
    expect(s.players.self.evidence.length, '自証拠 不変').toBe(1);
  });
});

describe('B05103 — partnerColor gate (negative)', () => {
  it('青パートナー → a1 発火せず: sceneRemove pick も出ない (イベント自体は使用済)', () => {
    const s = base({ scenes: true, partner: 'BPART', selfEv: 1, oppEv: 3 });

    handUseCard(s, 'self', 'B05103');
    runAllUntilEmpty(s);

    expect(drain(), 'partnerColor黄 不成立 → 効果不発 (pick なし)').toBeNull();
    expect(s.players.opp.scene.some(c => c.uid === 'oc1'), '相手キャラ removed されない').toBe(true);
    expect(s.players.self.scene.some(c => c.uid === 'sc1'), '自陣 sc1 不変').toBe(true);
    expect(s.players.self.remove, 'イベントは使用済 → リムーブエリア').toContain('B05103');
  });
});

describe('B05103 —「そうした場合」= chain-origin gate', () => {
  it('discard を human 辞退 → evidenceToDeckBottom / evidenceGain を skip', () => {
    // 現場を空にして sceneRemove を候補0 (skip) → discard を最初の pick にする
    const s = base({ scenes: false, selfEv: 1, oppEv: 3 }); // diff = 2 → 成立

    handUseCard(s, 'self', 'B05103');
    runAllUntilEmpty(s);

    const p1 = drain();
    expect(p1?.atomVerb, '現場0 → sceneRemove は候補なしで skip、discard が最初の pick').toBe('discard');
    applyPickSkipAndContinuation(s, p1!, false); // human が「リムーブしない」を選択

    expect(drain(), 'chain-origin decline → evidenceToDeckBottom は surface しない').toBeNull();
    expect(s.players.self.hand, '手札 unchanged (discard 辞退)').toEqual(['HAND1']);
    expect(s.players.opp.evidence.length, '相手証拠 unchanged (デッキ下移動 skip)').toBe(3);
    expect(s.players.self.evidence.length, '自証拠 unchanged (証拠獲得 skip)').toBe(1);
    expect(s.players.opp.deck[s.players.opp.deck.length - 1], '相手デッキ末尾 unchanged').toBe('ODK4');
  });
});

describe('B05103 — QA: キャラ0枚removeでも以降を解決 (sequence-origin)', () => {
  it('sceneRemove を human 辞退 → 相手キャラ残存 だが chain (discard) は進む', () => {
    const s = base({ scenes: true, selfEv: 1, oppEv: 3 }); // diff = 2 → 成立

    handUseCard(s, 'self', 'B05103');
    runAllUntilEmpty(s);

    const p1 = drain();
    expect(p1?.atomVerb).toBe('sceneRemove');
    applyPickSkipAndContinuation(s, p1!, false); // キャラを1枚も選ばない

    expect(s.players.opp.scene.some(c => c.uid === 'oc1'), 'キャラは remove されていない').toBe(true);
    expect(s.players.self.scene.some(c => c.uid === 'sc1'), '自陣も不変').toBe(true);

    // sequence-origin: sceneRemove 辞退でも conditional は解決 → discard pick が出る (QA 準拠)
    const p2 = drain();
    expect(p2?.atomVerb, 'キャラ0枚でも以降 (chain) を解決 → discard surface').toBe('discard');
  });
});
