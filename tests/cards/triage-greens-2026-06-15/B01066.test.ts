// gate5 runtime behavior verification — B01066 世良真純 (character)
//   公式テキスト: 【ターン1】このキャラがアクション［事件］したとき、このキャラをアクティブにする。
//   rules: 07-action-flow.md(アクション宣言=actorスリープ), 10-action-event.md, 22-qa-action-contact.md,
//          03-field-areas.md(スタン→スリープ特殊挙動), 17-icons.md(【ターン1】= turn limit), 24-qa-naming-stun.md(限度カウント)
//
// 検証の核:
//   declare() は actor を必ずスリープ化 (state-machine.ts:175) してから action:declare を emit (line 198)。
//   B01066 の a1 (selfOnly + triggerActionKind:'case') が発火し sceneSetState{$self,active} で「再アクティブ化」。
//   → 通常キャラは action[事件] 後スリープのまま、B01066 だけ active に戻る。これが engine が文言通り
//     filter/effect を実行している証明 (BUG-117/118 教訓)。
//
// decoy/negative:
//   D1: 別キャラ (DEC_B01066_PLAIN) が action[事件] → B01066 は非発火 (selfOnly) かつ DEC 自身は再アクティブ化しない
//   N1: B01066 が action[キャラ] (事件ではない) → triggerActionKind:'case' 不成立 → 再アクティブ化しない (subtype filter)
//   N2: 【ターン1】2回目の action[事件] → limit 消費済みで非発火 (B01066 はスリープのまま)。rules/24: limit はカウント済

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { declare, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { makeChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';
import { B01066 } from '@/cards/ct-p01/B01066';

// 汎用 decoy def — 能力なしのプレーンキャラ (色/レベル/特徴可変)
function plain(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function base(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.players.self.partner = { cardId: 'P-self', state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: 'P-opp', state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: 'cs', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
  s.players.opp.case = { cardId: 'co', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
  s.players.self.deck.push('d1', 'd2', 'd3', 'd4', 'd5');
  s.players.opp.deck.push('e1', 'e2', 'e3');
  // rules/07: 証拠が1つもない事件は action[事件] の対象外 → case を合法化するため相手証拠を1つ置く。
  // 2回目 action[事件] (limit テスト) でも対象を維持するため 2 つ置く。
  s.players.opp.evidence.push(
    { cardId: 'ev-opp-1', faceUp: false, origin: { turn: 1, via: 'action-case' } },
    { cardId: 'ev-opp-2', faceUp: false, origin: { turn: 1, via: 'action-case' } },
  );
  s.turn = { number: 2, player: 'self' } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetActionContexts();
});

describe('B01066 世良真純: 【ターン1】このキャラが action[事件] したとき自身をアクティブにする', () => {
  function setup() {
    registerCardDef(B01066);
    // decoy: B01066 と同じ現場に居る別キャラ。action[事件] しても再アクティブ化しないことを確認
    registerCardDef(plain('DEC_B01066_PLAIN', { colors: ['赤'] }));
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-sera', cardId: 'B01066', state: 'active', isNamed: false }));
    s.players.self.scene.push(makeChar({ uid: 'u-dec', cardId: 'DEC_B01066_PLAIN', state: 'active', isNamed: false }));
    return s;
  }

  it('POSITIVE: 世良 (u-sera) が action[事件] → 宣言でスリープ化 → a1 発火で再アクティブ化 = active に戻る', () => {
    const s = setup();
    // sanity: 宣言前は active
    expect(read.char.state(s, 'u-sera')).toBe('active');
    const after = produce(s, (d) => {
      declare(d, 'u-sera', { kind: 'case', player: 'opp' });
      runAllUntilEmpty(d);
    });
    // 文言「このキャラをアクティブにする」: declare で sleep 化された後、a1 が再 active 化
    expect(read.char.state(after, 'u-sera'), '世良は action[事件] 後 active に戻る').toBe('active');
    // limit:{turn,1} が消費されている (発火記録)
    expect(read.char.declaredUseCount(after, 'u-sera', 'a1'), '【ターン1】消費=1').toBe(1);
    // decoy (u-dec): action に関与していないので active のまま (盤面巻き添えなし)
    expect(read.char.state(after, 'u-dec'), 'decoy は無関係なので active のまま').toBe('active');
  });

  it('DECOY: 別キャラ (u-dec) が action[事件] → 世良(u-sera)は selfOnly で非発火、dec 自身も再アクティブ化しない', () => {
    const s = setup();
    const after = produce(s, (d) => {
      declare(d, 'u-dec', { kind: 'case', player: 'opp' });
      runAllUntilEmpty(d);
    });
    // 攻撃した decoy 自身は能力を持たないので宣言スリープのまま (再アクティブ化しない)
    expect(read.char.state(after, 'u-dec'), 'decoy は宣言スリープのまま').toBe('sleep');
    // 世良は actor ではないので selfOnly で非発火 → active のまま (誤って sleep/再 active 化されない)
    expect(read.char.state(after, 'u-sera'), '世良は actor でないので非発火・active のまま').toBe('active');
    // 世良の【ターン1】は未消費
    expect(read.char.declaredUseCount(after, 'u-sera', 'a1'), '非 actor なので limit 未消費').toBe(0);
  });

  it('NEGATIVE (subtype filter): 世良が action[キャラ] (事件ではない) → triggerActionKind:case 不成立で非発火 → スリープのまま', () => {
    const s = setup();
    // 相手の現場に sleep 状態の対象キャラを置く (action[キャラ] を合法化、rules/07: sleep/stun のみ対象)
    registerCardDef(plain('DEC_B01066_TGT'));
    const s2 = produce(s, (d) => {
      d.players.opp.scene.push(makeChar({ uid: 'u-tgt', cardId: 'DEC_B01066_TGT', state: 'sleep' }));
    });
    const after = produce(s2, (d) => {
      declare(d, 'u-sera', { kind: 'char', uid: 'u-tgt' });
      runAllUntilEmpty(d);
    });
    // action[キャラ] では a1 (triggerActionKind:'case') が成立しない → 再アクティブ化なし → 宣言スリープのまま
    expect(read.char.state(after, 'u-sera'), 'action[キャラ] では a1 非発火 → スリープのまま').toBe('sleep');
    expect(read.char.declaredUseCount(after, 'u-sera', 'a1'), 'action[キャラ] では limit 未消費').toBe(0);
  });

  it('NEGATIVE (【ターン1】limit): 同一ターン 2 回目の action[事件] では a1 非発火 → 2回目はスリープのまま', () => {
    const s = setup();
    // 1 回目: 発火して active に戻る
    const after1 = produce(s, (d) => {
      declare(d, 'u-sera', { kind: 'case', player: 'opp' });
      runAllUntilEmpty(d);
    });
    expect(read.char.state(after1, 'u-sera'), '1回目: active に戻る').toBe('active');
    expect(read.char.declaredUseCount(after1, 'u-sera', 'a1')).toBe(1);
    // 2 回目: 同一ターン (turn.number 据え置き) で再度 action[事件]。limit:{turn,1} 消費済みなので a1 非発火。
    const after2 = produce(after1, (d) => {
      declare(d, 'u-sera', { kind: 'case', player: 'opp' });
      runAllUntilEmpty(d);
    });
    // 宣言で再びスリープ化されるが a1 は発火しない → スリープのまま (再アクティブ化されない)
    expect(read.char.state(after2, 'u-sera'), '2回目: limit 消費済みで非発火 → スリープのまま').toBe('sleep');
    // limit カウントは 1 のまま (再発火していない)
    expect(read.char.declaredUseCount(after2, 'u-sera', 'a1'), 'limit は 1 のまま').toBe(1);
  });

  it('descriptor: a1 = triggered/action:declare + selfOnly + triggerActionKind case + sceneSetState active + limit turn1', () => {
    const a1 = B01066.abilities[0];
    expect(a1.type).toBe('triggered');
    expect((a1.trigger as { hook: string }).hook).toBe('action:declare');
    expect((a1.trigger as { selfOnly?: boolean }).selfOnly).toBe(true);
    expect((a1.trigger as { matcherCondition?: { kind: string; v: string } }).matcherCondition).toEqual({ kind: 'triggerActionKind', v: 'case' });
    expect((a1.effect as { verb: string; args: { uid: string; state: string } }).verb).toBe('sceneSetState');
    expect((a1.effect as { args: { uid: string; state: string } }).args).toEqual({ uid: '$self', state: 'active' });
    expect((a1.limit as { kind: string; n: number })).toEqual({ kind: 'turn', n: 1 });
  });
});
