// m1-megasweep probe — B03029 遠山和葉 (character, engine変更0)
//
// 印字 (ground truth, payloads/B03029.json fullTexts):
//   a1 (effect / declared):
//     【宣言】【ターン1】【スリープ】〚リムーブエリアにある【緑】のイベントを2枚好きな順番で
//     デッキの下に移す〛：手札からレベル5か6の【緑】のイベントを1枚まで使用する。
//
// rules: 13 (キーワード/宣言共通), 15 (「〜まで」=0枚可), 17 (【ターン1】), 20 (効果使用は色制限外),
//        21 (宣言/コスト = 全部行えなければ使用不可), 26 (Q&A: 効果使用は FILE 枚数無関係)。
//
// カード固有 Q&A (payloads/B03029.json):
//   - リムーブに【緑】イベントが1枚だけ → 2枚移せないので宣言不可 (canPay=false)。
//   - 効果でイベント使用 = 「手札の使用」同様に解決しリムーブへ。
//   - FILE 4枚以下でも lv5 イベント使用可 (効果使用は FILE 無関係)。
//
// novel 経路 = production dispatch:
//   cost = pay[ sleepSelf, removeAreaToDeckBottom{pick 緑 event ×2, chooser owner} ]。
//     activateDeclaredAbility → engineCost.pay を必ず呼ぶ (BUG-116 の silent skip 構造排除)。
//     removeAreaToDeckBottom は explicit ids 無指定 → pay.ts が pickCandidates(filter{緑,event}) fallback
//     で先頭 2 枚を remove→デッキ下へ (cluster4 契約)。赤 event / 緑 character は filter 外 = 非選択。
//   effect = atom useEventFromHand{player:self, max:1, filter{color:緑, levelIn:[5,6], kind:event}}。
//     mega-W6 step3 PB pick (atom-pick-spec)。runAllUntilEmpty→drain(HeuristicPolicy) で
//     手札の該当イベントを greedily 使用 (hand→remove)。lv4緑 / lv5赤 / lv7緑 は filter 外 = 非使用。
//     「1枚まで」= 候補 0 で 0-pick 許容 (crash なし)。
// BUG-171: declared は activateDeclaredAbility + runAllUntilEmpty (production dispatch)。
// BUG-174: owner='opp' で cost/effect が self 側へ漏れない (ctx.source.player 相対) を 1 scenario で pin。
// beforeEach: registry / triggered / uid / pending pick queue を全 reset + event._resetRegistry
//   (handler 累積で N 重発火を防ぐ、CLAUDE.md 規約)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canPay } from '@/engine/cost/evaluate';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { makeChar } from '../../helpers/fixtures';
import { B03029 } from '@/cards/ct-p03/B03029';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

type Player = 'self' | 'opp';

// 色/種別/レベルつき def — cost/effect の candidates 判定は registry の def を読むため必須。
function evDef(id: string, colors: string[], level: number): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors, level,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function chDef(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors,
    level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

function base(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.players.self.partner = { cardId: 'P-self', state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: 'P-opp', state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: 'cs', status: '事件編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {} };
  s.players.opp.case = { cardId: 'co', status: '事件編', requiredEvidence: 6, colors: ['緑'], declaredUseCount: {} };
  s.players.self.deck.push('d1', 'd2', 'd3');
  s.players.opp.deck.push('e1', 'e2', 'e3');
  s.turn = { number: 2, player: 'self' } as GameState['turn'];
  return s;
}

// 各 event / decoy def を registry に登録 (candidates が色/レベル/種別を読む)
function registerFixtures(): void {
  registerCardDef(B03029);
  registerCardDef(evDef('GEV5a', ['緑'], 5)); // cost 用 緑 event
  registerCardDef(evDef('GEV5b', ['緑'], 5)); // cost 用 緑 event
  registerCardDef(evDef('GEV6', ['緑'], 6));  // effect 用 lv6 緑 event (valid)
  registerCardDef(evDef('GEV5h', ['緑'], 5)); // effect 用 lv5 緑 event (valid)
  registerCardDef(evDef('GEV4', ['緑'], 4));  // effect decoy: lv4 (level 外)
  registerCardDef(evDef('GEV7', ['緑'], 7));  // effect decoy: lv7 (level 外)
  registerCardDef(evDef('REV5', ['赤'], 5));  // decoy: 赤 lv5 (色外) — cost/effect 両方で非選択
  registerCardDef(chDef('GCH', ['緑']));      // cost decoy: 緑 character (kind 外)
}

const ctxFor = (uid: string, player: Player): EffectCtx => ({
  source: { cardId: 'B03029', uid, abilityId: 'a1', player, area: 'scene' },
  bindings: {},
});

const a1 = B03029.abilities![0]!;

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  registerFixtures();
  registerTriggeredListener();
});

function drain(s: GameState): GameState {
  let after = produce(s, (d) => {
    activateDeclaredAbility(d, 'u-wakasa', 'a1');
    runAllUntilEmpty(d);
  });
  after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
  after = produce(after, (d) => runAllUntilEmpty(d));
  return after;
}

// ───────── S1: happy path — cost 2枚デッキ下 + effect lv5/6緑イベント使用。cost/effect 両 decoy 除外 ─────────
describe('S1 宣言 full path: 緑イベント2枚をデッキ下 (cost) → 手札の lv5/6 緑イベント使用 (effect)', () => {
  it('自身スリープ / 緑event×2 remove→デッキ下 / lv6緑を使用、cost赤・緑char・effect lv4/lv7/赤 は非対象', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-wakasa', cardId: 'B03029', state: 'active' }));
    // cost 候補: 緑 event ×2 (対象) + 赤 event + 緑 character (decoy)
    s.players.self.remove.push('GEV5a', 'GEV5b', 'REV5', 'GCH');
    // effect 候補: lv6緑 (valid) + lv4緑 / lv7緑 / lv5赤 (decoy)
    s.players.self.hand.push('GEV6', 'GEV4', 'GEV7', 'REV5');
    const deckBefore = s.players.self.deck.length;

    const after = drain(s);

    // cost sleepSelf
    expect(after.players.self.scene.find((c) => c.uid === 'u-wakasa')!.state).toBe('sleep');
    // cost: 緑 event ×2 が remove→デッキ下 (デッキ +2、remove から消える)
    expect(after.players.self.remove).not.toContain('GEV5a');
    expect(after.players.self.remove).not.toContain('GEV5b');
    expect(after.players.self.deck).toContain('GEV5a');
    expect(after.players.self.deck).toContain('GEV5b');
    expect(after.players.self.deck.length).toBe(deckBefore + 2);
    expect(after.players.self.deck.slice(-2).sort()).toEqual(['GEV5a', 'GEV5b']); // 最下2枚
    // cost decoy: 赤 event / 緑 character は移動されず remove に残る
    expect(after.players.self.remove).toContain('REV5');
    expect(after.players.self.remove).toContain('GCH');
    // effect: lv6緑イベント使用 (hand→remove)
    expect(after.players.self.hand).not.toContain('GEV6');
    expect(after.players.self.remove).toContain('GEV6');
    // effect decoy: level外 / 色外 は手札に残る
    expect(after.players.self.hand).toContain('GEV4');
    expect(after.players.self.hand).toContain('GEV7');
    expect(after.players.self.hand).toContain('REV5');
  });
});

// ───────── S2: cost gate off-variant — 緑event 1枚のみ → 2枚移せず canPay=false (カード固有Q&A) ─────────
describe('S2 cost gate: リムーブに緑イベント1枚のみ → 宣言不可 (Q&A「2枚移せない場合は使用できません」)', () => {
  it('canPay=false (removeAreaToDeckBottom candidates < 2)', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-wakasa', cardId: 'B03029', state: 'active' }));
    s.players.self.remove.push('GEV5a'); // 緑 event 1枚だけ
    expect(canPay(s, a1.cost!, ctxFor('u-wakasa', 'self'))).toBe(false);
  });
});

// ───────── S3: cost decoy gate — 緑event1 + 赤event1 + 緑char1 → 緑event候補は1のみ → canPay=false ─────────
describe('S3 cost decoy: 緑event1 + 赤event + 緑character → filter外は数えず候補<2 → 宣言不可', () => {
  it('canPay=false (赤event / 緑character は filter{緑,event} 外で候補にならない)', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-wakasa', cardId: 'B03029', state: 'active' }));
    s.players.self.remove.push('GEV5a', 'REV5', 'GCH');
    expect(canPay(s, a1.cost!, ctxFor('u-wakasa', 'self'))).toBe(false);
  });

  it('緑event2 + decoy → canPay=true (対象2枚を満たす)', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-wakasa', cardId: 'B03029', state: 'active' }));
    s.players.self.remove.push('GEV5a', 'GEV5b', 'REV5', 'GCH');
    expect(canPay(s, a1.cost!, ctxFor('u-wakasa', 'self'))).toBe(true);
  });
});

// ───────── S4: effect 0-pick — 手札に有効イベント無し → 「1枚まで」= 0 使用 (cost は成立) ─────────
describe('S4 effect 0-pick (「〜まで」= 0枚可): 手札の緑イベントが全て level 外 → 使用0、crash なし', () => {
  it('cost は払われ (自身スリープ + 緑event2枚デッキ下)、effect は 0 使用で decoy 全残存', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-wakasa', cardId: 'B03029', state: 'active' }));
    s.players.self.remove.push('GEV5a', 'GEV5b');
    // 手札は decoy のみ: lv4緑 / lv7緑 / lv5赤 (どれも filter{緑,lv5-6,event} 外)
    s.players.self.hand.push('GEV4', 'GEV7', 'REV5');

    const after = drain(s);

    // cost 成立
    expect(after.players.self.scene.find((c) => c.uid === 'u-wakasa')!.state).toBe('sleep');
    expect(after.players.self.deck).toContain('GEV5a');
    expect(after.players.self.deck).toContain('GEV5b');
    // effect 0 使用: decoy は手札に残り remove に何も追加されない
    expect([...after.players.self.hand].sort()).toEqual(['GEV4', 'GEV7', 'REV5']);
    expect(after.players.self.remove).toHaveLength(0);
  });
});

// ───────── S5: owner='opp' reversal pin (BUG-174) — opp 所有で自資源が opp 側のみ消費、self 不変 ─────────
describe('S5 反転 pin: B03029 が opp 所有 → cost/effect は opp 資源のみ消費、self は不変', () => {
  it('opp 自身スリープ + opp 緑event2枚→opp デッキ下 / self の remove・deck・hand 全て不変', () => {
    const s = base();
    s.players.opp.scene.push(makeChar({ uid: 'u-wakasa', cardId: 'B03029', state: 'active' }));
    s.players.opp.remove.push('GEV5a', 'GEV5b');
    s.players.opp.hand.push('GEV6');
    // self 側にも同種を置いておき「漏れて self が消費される」誤配線を検出
    s.players.self.remove.push('GEV5h');
    s.players.self.hand.push('GEV7');
    const selfDeckBefore = [...s.players.self.deck];

    let after = produce(s, (d) => {
      activateDeclaredAbility(d, 'u-wakasa', 'a1');
      runAllUntilEmpty(d);
    });
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    after = produce(after, (d) => runAllUntilEmpty(d));

    // opp 側で cost 成立 (反転せず opp 資源を消費)
    expect(after.players.opp.scene.find((c) => c.uid === 'u-wakasa')!.state).toBe('sleep');
    expect(after.players.opp.remove).not.toContain('GEV5a');
    expect(after.players.opp.remove).not.toContain('GEV5b');
    expect(after.players.opp.deck).toContain('GEV5a');
    expect(after.players.opp.deck).toContain('GEV5b');
    // effect も opp 側 (lv6緑を opp hand→opp remove)
    expect(after.players.opp.hand).not.toContain('GEV6');
    expect(after.players.opp.remove).toContain('GEV6');
    // self 側は完全不変
    expect(after.players.self.remove).toEqual(['GEV5h']);
    expect(after.players.self.hand).toEqual(['GEV7']);
    expect(after.players.self.deck).toEqual(selfDeckBefore);
    expect(after.players.self.scene).toHaveLength(0);
  });
});
