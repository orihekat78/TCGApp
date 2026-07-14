// engine wave-12 — partnerAreaCards + toPartnerArea (G39 PA 一般カード枠、demand-signal #2)
//
// 対象: 「このカードをパートナーエリアに移す」イベント族 (移動4テキスト・6 printings):
//   B07059/B07059P 赤い涙 / B07060/B07060P クリスタル・マザー / PR195/PR196 ブルーサファイア。
// engine 変更: PlayerState.partnerAreaCards?: CardId[] (optional additive) +
//   atom verb 'toPartnerArea' (mutate.partner.addAreaCardFromRemove 経由、
//   evidence.gainCard 同型: remove から lastIndexOf splice + 不在 no-op (B06026 Q&A 同型) +
//   remove:exit emit) + candidates.ts case 'partner-area' の PA カード列挙。
//
// 検証 (certify wf_66b41e13 の敵対 grounding 指摘を反映):
//   §A runAtom 直接: A1 remove→PA / A2 lastIndexOf (同 cardId 複数) / A3 不在 no-op。
//   §B B07059 event-use e2e: B1 AI drain full path (apMax8000 filter honor + PA 移動) /
//      B2 ★human 0-skip★ (sceneRemove 0枚辞退でも sequence remainder の toPartnerArea 発火 = 公式Q&A) /
//      B3 【パートナー白】不成立 → 全効果不発・カードは remove 残留 (rules/17 Point)。
//   §C B07059 hirameki e2e: C1 accept (remove→PA) / C2 decline (remove 残留 = 公式Q&A)。
//   §D candidates: D1 PA カード列挙 / D2 filter honor (kind/color) / D3 field 未初期化 = 旧挙動。
//   §E refresh 隔離: PA カードは remove ではないので refresh shuffle に巻き込まれない。
//   §F B07060 e2e: draw + sceneEnter (levelMax dyn $self.fileCount、D01014 同型) + PA 移動。
//   §G PR195 e2e: deckRevealUntil (cardName 中森青子) → 手札加入 + 残り bottom + shuffle + PA 移動。
//   §H 出荷構造: 6 printings 登録 + parallel spread 同一 abilities。
// rules: 03-field-areas.md (§PA 上限なし), 06-card-types.md (§イベント使い切り),
//        10-action-event.md (§ヒラメキ), 14-refresh.md, 15-abilities-effects.md (§量指定子),
//        17-icons.md (§【パートナー(色)】/条件不成立=能力を持たない扱い), 20-color-and-switch.md,
//        26-qa-deck-refresh.md (§出るまで公開)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef, def } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingHirameki } from '@/engine/listeners/hirameki';
import { removeOpponentEvidenceTop } from '@/engine/flow/action-case';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runNextHint } from '@/engine/flow/main/next-hint';
import { candidates } from '@/engine/target/candidates';
import { sceneChar } from '../helpers/fixtures';
import { B07059 } from '@/cards/ct-p07/B07059';
import { B07059P } from '@/cards/ct-p07/B07059P';
import { B07060 } from '@/cards/ct-p07/B07060';
import { B07060P } from '@/cards/ct-p07/B07060P';
import { PR195 } from '@/cards/pr-01/PR195';
import { PR196 } from '@/cards/pr-01/PR196';
import type { ActionContext, CardDef, EffectCtx, EvidenceCard, GameState, TargetingRef } from '@/engine/types';

const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'effect' } });
// event-use / hirameki の ctx.source: cardId = 当該イベント自身、player = 使用者/証拠所有者
const ectx = (cardId: string, player: 'self' | 'opp' = 'self'): EffectCtx =>
  ({ source: { player, cardId, abilityId: 'a1', uid: `event:${player}` }, bindings: {} } as unknown as EffectCtx);
const hctx = (cardId: string, player: 'self' | 'opp' = 'self'): EffectCtx =>
  ({ source: { player, area: 'evidence', cardId, abilityId: 'a2', uid: `evidence:${player}` }, bindings: {} } as unknown as EffectCtx);
const ch = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 2, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const FB = { type: 'card-back' as const, cardId: 'D08017' };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerAll();
  // 白パートナー / 非白パートナー / decoy キャラ / 中森青子 (cardName filter 用)
  registerCardDef({ ...ch('PW'), kind: 'partner', names: ['白パートナー'], colors: ['白'], lp: 2, ap: undefined });
  registerCardDef({ ...ch('PB'), kind: 'partner', names: ['青パートナー'], colors: ['青'], lp: 2, ap: undefined });
  registerCardDef(ch('TGT8000', { ap: 8000, colors: ['緑'] }));
  registerCardDef(ch('TGT9000', { ap: 9000, colors: ['緑'] }));
  registerCardDef(ch('WCH2', { colors: ['白'], level: 2 }));
  registerCardDef(ch('WCH9', { colors: ['白'], level: 9 }));
  registerCardDef(ch('AOKO', { names: ['中森青子'], colors: ['白'], level: 3 }));
  registerCardDef(ch('OTHER', { colors: ['緑'] }));
  registerTriggeredListener();
  _drainPendingHirameki();
});

function baseState(partnerId: string = 'PW'): GameState {
  let s = createEmptyGameState();
  s = produce(s, (d) => {
    d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    d.players.self.partner.cardId = partnerId;
    d.players.self.case.colors = ['白']; // 色制限 (rules/20): 白イベント使用可
    d.players.self.file = [FB, FB, FB, FB, FB]; // FILE5 ≥ B07059 lv5
  });
  return s;
}

describe('§A toPartnerArea — runAtom 直接駆動', () => {
  it('A1 remove→PA: source カードのみ移動 (別 cardId は remove に残る)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.remove = ['OTHER', 'B07059'];
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'toPartnerArea', {}, ectx('B07059'));
    });
    expect(after.players.self.partnerAreaCards).toEqual(['B07059']);
    expect(after.players.self.remove).toEqual(['OTHER']);
  });

  it('A2 同 cardId 複数 → lastIndexOf で末尾 (直近 push 分) を取る', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.remove = ['B07059', 'OTHER', 'B07059'];
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'toPartnerArea', {}, ectx('B07059'));
    });
    expect(after.players.self.partnerAreaCards).toEqual(['B07059']);
    expect(after.players.self.remove).toEqual(['B07059', 'OTHER']);
  });

  it('A3 remove に不在 → no-op (crash せず、PA も remove も不変)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.remove = ['OTHER'];
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'toPartnerArea', {}, ectx('B07059'));
    });
    expect(after.players.self.partnerAreaCards ?? []).toEqual([]);
    expect(after.players.self.remove).toEqual(['OTHER']);
  });

  it('A4 opp 側使用: opp の remove → opp の PA (owner 解決 = ctx.source.player)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.opp.remove = ['B07059'];
      d.players.self.remove = ['B07059']; // decoy: self 側は触らない
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'toPartnerArea', {}, ectx('B07059', 'opp'));
    });
    expect(after.players.opp.partnerAreaCards).toEqual(['B07059']);
    expect(after.players.opp.remove).toEqual([]);
    expect(after.players.self.remove).toEqual(['B07059']); // self 不変
    expect(after.players.self.partnerAreaCards ?? []).toEqual([]);
  });

  it('A5 PA 既存カードへの accumulation: 2枚目は append (上限なし = 公式Q&A)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.partnerAreaCards = ['B07059'];
      d.players.self.remove = ['B07059']; // 同名 2枚目
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'toPartnerArea', {}, ectx('B07059'));
    });
    expect(after.players.self.partnerAreaCards).toEqual(['B07059', 'B07059']);
    expect(after.players.self.remove).toEqual([]);
  });
});

describe('§B B07059 赤い涙 — event-use e2e', () => {
  it('B1 AI drain full path: apMax8000 filter honor + 使用後 PA へ (remove に残らない)', () => {
    let s = baseState();
    s = produce(s, (d) => {
      d.players.self.hand = ['B07059'];
      d.players.opp.scene = [sceneChar('TGT8000', 'o1', { state: 'sleep' }), sceneChar('TGT9000', 'o2', { state: 'sleep' })];
    });
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07059');
      for (let i = 0; i < 6; i++) {
        runAllUntilEmpty(d);
        _drainAllEffectPicksForTest(d);
        runAllUntilEmpty(d);
      }
    });
    // AP8000 以下 (TGT8000) のみリムーブ可、TGT9000 は filter 外で残る
    expect(s.players.opp.scene.map((c) => c.cardId)).toEqual(['TGT9000']);
    expect(s.players.opp.remove).toContain('TGT8000');
    // 使用イベント自身は remove → PA へ
    expect(s.players.self.partnerAreaCards).toEqual(['B07059']);
    expect(s.players.self.remove).not.toContain('B07059');
    expect(s.players.self.hand).toEqual([]);
  });

  it('B2 ★human 0-skip★: sceneRemove を 0枚辞退しても sequence remainder の toPartnerArea が発火 (公式Q&A)', () => {
    let s = baseState();
    s = produce(s, (d) => {
      d.players.self.hand = ['B07059'];
      d.players.opp.scene = [sceneChar('TGT8000', 'o1', { state: 'sleep' })]; // 候補は居るが辞退する
    });
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07059');
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      expect(pending, 'sceneRemove pick が human に surface される').not.toBeNull();
      // human が「選ばない」(0枚 skip) → runDeclinedAtom=false 経路
      applyPickSkipAndContinuation(d, pending!, false);
      runAllUntilEmpty(d);
    });
    // 辞退したので相手キャラは残る
    expect(s.players.opp.scene.map((c) => c.cardId)).toEqual(['TGT8000']);
    // それでも「必ずパートナーエリアに移す」(Q&A)
    expect(s.players.self.partnerAreaCards).toEqual(['B07059']);
    expect(s.players.self.remove).not.toContain('B07059');
  });

  it('B4 候補ゼロ (相手現場 空) → pick を surface せず sequence が toPartnerArea まで自走', () => {
    let s = baseState();
    s = produce(s, (d) => {
      d.players.self.hand = ['B07059'];
      d.players.opp.scene = []; // sceneRemove 候補 0
    });
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07059');
      for (let i = 0; i < 6; i++) {
        runAllUntilEmpty(d);
        _drainAllEffectPicksForTest(d);
        runAllUntilEmpty(d);
      }
    });
    expect(s.players.self.partnerAreaCards).toEqual(['B07059']);
    expect(s.players.self.remove).not.toContain('B07059');
  });

  it('B5 ネクストヒント経由の使用 (hand-use と別の remove.add site) でも toPartnerArea 発火', () => {
    let s = baseState();
    s = produce(s, (d) => {
      // runNextHint step1: FILE top → 手札。step2: FILE 枚数以下 lv のカード使用。
      // B07059 (lv5) を手札に持ち、FILE 5枚 (step1 で 4枚に減るため lv5 は不可) →
      // lv1 の PR195 を使う (FILE4 ≥ 1)。
      d.players.self.hand = ['PR195'];
      d.players.self.deck = ['D08003', 'D08005'];
      d.players.opp.scene = [];
    });
    s = produce(s, (d) => {
      runNextHint(d, 'self', 'PR195');
      for (let i = 0; i < 6; i++) {
        runAllUntilEmpty(d);
        _drainAllEffectPicksForTest(d);
        runAllUntilEmpty(d);
      }
    });
    expect(s.players.self.partnerAreaCards).toEqual(['PR195']);
    expect(s.players.self.remove).not.toContain('PR195');
  });

  it('B3 【パートナー白】不成立 (青パートナー) → 効果全体不発・カードは remove 残留 (rules/17 Point)', () => {
    let s = baseState('PB');
    s = produce(s, (d) => {
      d.players.self.hand = ['B07059'];
      d.players.opp.scene = [sceneChar('TGT8000', 'o1', { state: 'sleep' })];
    });
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07059');
      for (let i = 0; i < 6; i++) {
        runAllUntilEmpty(d);
        _drainAllEffectPicksForTest(d);
        runAllUntilEmpty(d);
      }
    });
    expect(s.players.opp.scene.map((c) => c.cardId)).toEqual(['TGT8000']); // リムーブ発生せず
    expect(s.players.self.remove).toContain('B07059');                    // 使い切りで remove 残留
    expect(s.players.self.partnerAreaCards ?? []).toEqual([]);            // PA へは移らない
  });
});

describe('§C B07059 — 【ヒラメキ】 e2e (action[事件] → removeTop → resolve)', () => {
  it('C1 accept: 証拠から action リムーブ → ヒラメキ発動 → remove→PA', () => {
    let s = createEmptyGameState();
    s = produce(s, (d) => {
      d.turn = { number: 3, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.evidence = [ev('DECOY_EV'), ev('B07059')]; // B07059 が証拠 top (末尾)
    });
    const ax = { id: 'act#1', byUid: 'opp:atk', byPlayer: 'opp', target: { kind: 'case', player: 'self' }, phase: 'resolve', startedAt: { turn: 3, nano: 0 } } as unknown as ActionContext;
    s = produce(s, (d) => {
      removeOpponentEvidenceTop(d, ax);
    });
    expect(s.players.self.remove).toContain('B07059');
    const pending = _drainPendingHirameki();
    expect(pending).not.toBeNull();
    expect(pending!.cardId).toBe('B07059');
    const a2 = def.card('B07059')!.abilities.find((a) => a.id === 'a2')!;
    s = produce(s, (d) => {
      runEffect(d, a2.effect as never, hctx('B07059', 'self'));
    });
    expect(s.players.self.partnerAreaCards).toEqual(['B07059']);
    expect(s.players.self.remove).not.toContain('B07059');
    expect(s.players.self.evidence.map((e) => e.cardId)).toEqual(['DECOY_EV']);
  });

  it('C2 decline: 発動させない → そのまま remove 残留 (公式Q&A)', () => {
    let s = createEmptyGameState();
    s = produce(s, (d) => {
      d.turn = { number: 3, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.evidence = [ev('B07059')];
    });
    const ax = { id: 'act#2', byUid: 'opp:atk', byPlayer: 'opp', target: { kind: 'case', player: 'self' }, phase: 'resolve', startedAt: { turn: 3, nano: 0 } } as unknown as ActionContext;
    s = produce(s, (d) => {
      removeOpponentEvidenceTop(d, ax);
    });
    _drainPendingHirameki(); // decline = resolve しない
    expect(s.players.self.remove).toContain('B07059');
    expect(s.players.self.partnerAreaCards ?? []).toEqual([]);
  });
});

describe('§D candidates — partner-area 列挙', () => {
  const pickRef = (filter?: Record<string, unknown>): TargetingRef =>
    ({ kind: 'pick', query: { area: 'partner-area', side: 'self', ...(filter ? { filter } : {}) }, n: { min: 0, max: 9 }, chooser: 'self' } as unknown as TargetingRef);

  it('D1 PA カードが {kind:card, area:partner-area} で列挙される (partner 本体と共存)', () => {
    const s = produce(baseState(), (d) => {
      d.players.self.partnerAreaCards = ['B07059', 'B07060'];
    });
    const out = candidates(s, pickRef(), ectx('X'));
    const cards = out.filter((c) => c.kind === 'card');
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => (c as { cardId: string }).cardId)).toEqual(['B07059', 'B07060']);
    expect(cards.every((c) => (c as { area: string }).area === 'partner-area')).toBe(true);
    expect(out.some((c) => c.kind === 'partner')).toBe(true);
  });

  it('D2 filter honor: kind:event で partner 除外、color 不一致で空', () => {
    const s = produce(baseState(), (d) => {
      d.players.self.partnerAreaCards = ['B07059'];
    });
    const evOnly = candidates(s, pickRef({ kind: 'event' }), ectx('X'));
    expect(evOnly.every((c) => c.kind === 'card')).toBe(true);
    expect(evOnly).toHaveLength(1);
    const redOnly = candidates(s, pickRef({ color: '赤' }), ectx('X'));
    expect(redOnly.filter((c) => c.kind === 'card')).toHaveLength(0);
  });

  it('D3 field 未初期化 (undefined) → 旧挙動 (partner のみ)', () => {
    const s = baseState();
    expect(s.players.self.partnerAreaCards).toBeUndefined();
    const out = candidates(s, pickRef(), ectx('X'));
    expect(out.filter((c) => c.kind === 'card')).toHaveLength(0);
  });
});

describe('§E refresh 隔離', () => {
  it('E1 PA カードは refresh の shuffle 対象外 (remove のみ deck へ戻る)', () => {
    let s = createEmptyGameState();
    s = produce(s, (d) => {
      d.players.self.partnerAreaCards = ['B07059'];
      d.players.self.deck = [];
      d.players.self.remove = ['OTHER', 'TGT8000'];
    });
    s = produce(s, (d) => {
      runAtom(d, 'draw', { player: 'self', n: 1 }, ectx('X'));
    });
    // refresh 発生: remove 2枚 → deck → 1枚 draw
    expect(s.players.self.partnerAreaCards).toEqual(['B07059']); // PA 不変
    expect(s.players.self.deck.concat(s.players.self.hand)).not.toContain('B07059');
    expect(s.players.self.hand.length + s.players.self.deck.length).toBe(2);
    expect(s.players.self.remove).toEqual([]);
  });
});

describe('§F B07060 クリスタル・マザー — event-use e2e', () => {
  it('F1 draw + sceneEnter (levelMax dyn fileCount) + PA 移動', () => {
    let s = baseState();
    s = produce(s, (d) => {
      d.players.self.file = [FB, FB, FB]; // FILE3
      d.players.self.hand = ['B07060', 'WCH2', 'WCH9']; // WCH2(lv2≤3) 可 / WCH9(lv9>3) 不可
      d.players.self.deck = ['OTHER', 'TGT8000'];
    });
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07060');
      for (let i = 0; i < 6; i++) {
        runAllUntilEmpty(d);
        _drainAllEffectPicksForTest(d);
        runAllUntilEmpty(d);
      }
    });
    // draw 1: deck 末尾 (top) → 手札
    expect(s.players.self.deck).toHaveLength(1);
    // sceneEnter: WCH2 のみ登場可能 (levelMax=FILE3)。AI drain は候補を pick する
    expect(s.players.self.scene.map((c) => c.cardId)).toEqual(['WCH2']);
    expect(s.players.self.hand).not.toContain('WCH2');
    expect(s.players.self.hand).toContain('WCH9'); // lv9 は filter 外で手札残留
    // 使用イベント自身は PA へ
    expect(s.players.self.partnerAreaCards).toEqual(['B07060']);
    expect(s.players.self.remove).not.toContain('B07060');
  });
});

describe('§G PR195 ブルーサファイア — event-use e2e', () => {
  it('G1 中森青子が出るまで公開 → 手札へ (必須) + 残り bottom + shuffle + PA 移動', () => {
    let s = baseState();
    s = produce(s, (d) => {
      d.players.self.file = [FB]; // FILE1 ≥ lv1
      d.players.self.hand = ['PR195'];
      // deck 末尾 = top。公開順: X1 → AOKO (match、停止)。X2/X3 は未公開
      d.players.self.deck = ['X3', 'X2', 'AOKO', 'X1'];
    });
    registerCardDef(ch('X1', { colors: ['緑'] }));
    registerCardDef(ch('X2', { colors: ['緑'] }));
    registerCardDef(ch('X3', { colors: ['緑'] }));
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR195');
      for (let i = 0; i < 6; i++) {
        runAllUntilEmpty(d);
        _drainAllEffectPicksForTest(d);
        runAllUntilEmpty(d);
      }
    });
    expect(s.players.self.hand).toEqual(['AOKO']);            // 必ず加える (rules/26)
    expect([...s.players.self.deck].sort()).toEqual(['X1', 'X2', 'X3']); // 残りは deck (shuffle 済、集合一致)
    expect(s.players.self.partnerAreaCards).toEqual(['PR195']);
    expect(s.players.self.remove).not.toContain('PR195');
  });
});

describe('§G2 PR195 — 中森青子 不在 (not-found 分岐)', () => {
  it('G2 全公開 → 何も加えず全部デッキへ + shuffle + それでも PA 移動 (公式Q&A)', () => {
    let s = baseState();
    s = produce(s, (d) => {
      d.players.self.file = [FB];
      d.players.self.hand = ['PR195'];
      d.players.self.deck = ['X3', 'X2', 'X1']; // 中森青子 不在
    });
    registerCardDef(ch('X1', { colors: ['緑'] }));
    registerCardDef(ch('X2', { colors: ['緑'] }));
    registerCardDef(ch('X3', { colors: ['緑'] }));
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'PR195');
      for (let i = 0; i < 6; i++) {
        runAllUntilEmpty(d);
        _drainAllEffectPicksForTest(d);
        runAllUntilEmpty(d);
      }
    });
    expect(s.players.self.hand).toEqual([]);                              // 何も加えない
    expect([...s.players.self.deck].sort()).toEqual(['X1', 'X2', 'X3']);  // 全部デッキへ (shuffle 済)
    expect(s.players.self.partnerAreaCards).toEqual(['PR195']);           // それでも必ず PA へ
    expect(s.players.self.remove).not.toContain('PR195');
  });
});

describe('§F2 B07060 — deck0 draw→refresh は解決中イベントを除外する (rules/26)', () => {
  // 既存 engine-wide 簡略化 (event は使用時に remove へ置かれ、解決中も refresh shuffle 対象):
  // deck0 で a1 step1 draw → refresh が remove (B07060 自身含む) を deck へ shuffle →
  // 末尾 toPartnerArea は lastIndexOf=-1 で graceful no-op → カードは PA でなく deck/hand に居る。
  // rules/26 では「解決中のイベントはまだリムーブエリアに無い (shuffle 非対象)」なので本来は PA 到達が正。
  // 修正は engine-wide の resolving-card 隔離が必要 = 本 wave スコープ外 (DEFERRED-INDEX wave12 節)。
  it('F2 deck0 → refresh 後も解決中イベントを PA へ移す', () => {
    let s = baseState();
    s = produce(s, (d) => {
      d.players.self.file = [FB, FB, FB];
      d.players.self.hand = ['B07060'];
      d.players.self.deck = []; // draw で即 refresh
      d.players.self.remove = ['OTHER']; // refresh 可能 (remove 0 なら敗北)
    });
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B07060');
      for (let i = 0; i < 6; i++) {
        runAllUntilEmpty(d);
        _drainAllEffectPicksForTest(d);
        runAllUntilEmpty(d);
      }
    });
    expect(s.players.self.partnerAreaCards).toEqual(['B07060']);
    const everywhere = [...s.players.self.deck, ...s.players.self.hand, ...s.players.self.remove];
    expect(everywhere).not.toContain('B07060');
    expect(s.gameResult).toBeUndefined();
  });
});

describe('§H 出荷構造 — 6 printings + parallel spread', () => {
  it('H1 6 printings が registerAll で登録される', () => {
    for (const id of ['B07059', 'B07059P', 'B07060', 'B07060P', 'PR195', 'PR196']) {
      expect(def.card(id), `${id} registered`).toBeTruthy();
    }
  });

  it('H2 parallel は base と同一 abilities 参照 (spread)', () => {
    expect(B07059P.abilities).toBe(B07059.abilities);
    expect(B07060P.abilities).toBe(B07060.abilities);
    expect(PR196.abilities).toBe(PR195.abilities);
  });

  it('H3 a1 は event-use trigger + sequence 末尾 toPartnerArea / a2 は hirameki + toPartnerArea', () => {
    for (const c of [B07059, B07060, PR195]) {
      const a1 = c.abilities.find((a) => a.id === 'a1')!;
      expect(a1.scope).toBe('on-hand');
      expect(a1.trigger?.hook).toBe('effect:declared');
      const eff = a1.effect as { kind: string; steps: { kind: string; verb?: string }[] };
      expect(eff.kind).toBe('sequence'); // chain 不可 (0-skip でも remainder 発火 = Q&A)
      expect(eff.steps[eff.steps.length - 1]).toMatchObject({ kind: 'atom', verb: 'toPartnerArea' });
      const a2 = c.abilities.find((a) => a.id === 'a2')!;
      expect(a2.scope).toBe('on-evidence');
      expect(a2.trigger?.hook).toBe('evidence:remove-by-action');
      expect(a2.trigger?.optional).toBe(true);
      expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'toPartnerArea' });
    }
    // 【パートナー白】は B07059/B07060 のみ (PR195 は無条件)
    expect(B07059.abilities.find((a) => a.id === 'a1')!.condition).toMatchObject({ kind: 'partnerColor', color: '白' });
    expect(B07060.abilities.find((a) => a.id === 'a1')!.condition).toMatchObject({ kind: 'partnerColor', color: '白' });
    expect(PR195.abilities.find((a) => a.id === 'a1')!.condition).toBeUndefined();
  });
});
