// CARD PHASE hybrid-batch2 probe — B01085 安室透 (character, engine変更0)
//
// 公式テキスト (印字 = ground truth, .tmp/_hybrid_pilot/B01085.json refusedLine):
//   このキャラがアクションしたとき、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、
//   好きな順番でデッキの下に移す）する。レベル5以上のカードが発見された場合、
//   ターン終了時までこのキャラをAP+2000する。
//
// novel 句 (compiler refuse): action:declare(selfOnly) → souza{player:'opp', x:1, bind:'$found'}
//   → conditional{boundAnyMatchesFilter $found levelMin:5} then charModifyAP $self +2000 turn。
//
// rules: 07 (アクション宣言=souza 発動点、rules/22 ガード前), 13 (捜査X=相手デッキ上X公開→下へ),
//        15 (レベル参照=印字値). souza X=1 は count>=2 でのみ reorder modal を surface するため
//        (picks.ts:323) pick なしの完全決定論 = drain 不要。
// BUG-174: souza は player:'opp' — 対象カードは相手デッキ側。相手デッキが実際に操作された
//   (top→bottom) ことを owner=opp 経路として assert。
// BUG-117/118: level<5 の decoy を opp デッキ top に置き AP 加算されないことを assert。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { char as readChar } from '@/engine/read/char';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

import { B01085 } from '@/cards/ct-p01/B01085';

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// fixtures: opp デッキ top に置く公開対象カード
const FIXTURES: CardDef[] = [
  def('FILL'),
  def('LV5', { level: 5 }),   // 発見でレベル5以上成立 → AP+2000
  def('LV6', { level: 6 }),   // 5超も成立
  def('LV4', { level: 4 }),   // decoy: レベル5未満 → 加算なし
  def('PLAIN'),               // selfOnly negative 用の別アクター
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
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  for (const d of [B01085, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

// production emit 形 = pilot と同一 (flow の action:declare)。selfOnly は ctx.uid 照合。
const declare = (s0: GameState, byUid: string) => produce(s0, (d) => {
  event.emit(d, 'action:declare',
    { byUid, target: { kind: 'case', player: 'opp' }, uid: byUid, player: 'self', targetUid: undefined },
    { player: 'self', uid: byUid });
  runAllUntilEmpty(d);
  drainAiEffectPicks(d); // souza X=1 は pick 無し (無害の空 drain)
  runAllUntilEmpty(d);
});

describe('B01085 a1 — action:declare(self) → 捜査1 → lv5+ 発見で AP+2000(turn)', () => {
  function board(oppTop: string) {
    const s = base();
    s.players.self.scene = [sc('B01085', 'amuro'), sc('PLAIN', 'other')];
    // opp デッキ top を対象カードに差し替え (残りは FILL、下に移されるのを観測)
    s.players.opp.deck = [oppTop, 'FILL', 'FILL', 'FILL'];
    return s;
  }

  it('opp デッキ top = レベル5 → 発見成立で AP 3000→5000', () => {
    const after = declare(board('LV5'), 'amuro');
    expect(readChar.ap(after, 'amuro'), 'base 3000 + 2000').toBe(5000);
  });

  it('レベル6 (5超) も成立 → AP 5000', () => {
    const after = declare(board('LV6'), 'amuro');
    expect(readChar.ap(after, 'amuro')).toBe(5000);
  });

  it('opp デッキ top = レベル4 (decoy) → 発見不成立で AP 3000 のまま', () => {
    const after = declare(board('LV4'), 'amuro');
    expect(readChar.ap(after, 'amuro'), 'レベル5未満は加算なし').toBe(3000);
  });

  it('BUG-174 owner=opp: 捜査は相手デッキを操作 — top(LV4) が下へ、相手デッキ順が回転', () => {
    const s0 = board('LV4');
    expect(s0.players.opp.deck[0], '事前 top').toBe('LV4');
    const after = declare(s0, 'amuro');
    // souza X=1: top 1 枚を splice → bottom へ。top は次の FILL、末尾に LV4。
    expect(after.players.opp.deck[0], '新 top は元 2 番目').toBe('FILL');
    expect(after.players.opp.deck[after.players.opp.deck.length - 1], '元 top が末尾へ').toBe('LV4');
    expect(after.players.opp.deck.length, '枚数不変 (下に移すのみ)').toBe(4);
  });

  it('selfOnly negative: 別キャラ(other)のアクション → a1 不発 (AP不変 + opp デッキ不変)', () => {
    const s0 = board('LV5');
    const after = declare(s0, 'other');
    expect(readChar.ap(after, 'amuro'), '安室は加算されない').toBe(3000);
    expect(after.players.opp.deck[0], '捜査も走らず opp デッキ top 不変').toBe('LV5');
  });
});
