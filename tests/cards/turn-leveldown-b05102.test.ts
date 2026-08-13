// turn-scope levelDelta wave — B05102「小五郎の弟子」(黄 L1 event) の挙動テスト。engine変更0。
//
// DEFERRED-INDEX「evidence-self→hand cluster」で「continuous (temp) levelDelta が不在」を理由に DEFER
// されていたが誤診断。「ターン終了時までレベル－1」= 既存 charModifyLevel{scope:'turn'} (turnEffects
// ['lvlMod_turn']、read/char.ts level() 4-scope 合算 + mutate/char.ts turn end delete、BUG-119) で実装可能。
// よって engine 変更ゼロ。本テストは B05102 固有の composition を実 engine 経路で 1対1 検証する
// (非MVP のため smoke では踏めない = 専用 decoy 必須)。
//
// 検証:
//   §1 【パートナー黄】gate — partnerColor cond predicate (黄=true / 赤=false、rules/17 Point)。
//   §2 ★mandatory-tail★ 相手キャラ0 (level-down 候補不在) でも draw (必須) + sceneEnter が発火
//      (BUG-111 #2: sequence-origin の null-pick は remainder を実行。AI cands.length=0 → branch②)。境界=不在。
//   §3 相手キャラ在 → level-down 適用 (AI first-candidate fallback) で printed-1 + draw + enter。
//   §4 sceneEnter 黄+FILE枚数以下 filter — §4a 黄 Lv≤file 登場 / §4b 黄 Lv>file 不登場 (cap) /
//      §4c 非黄 不登場 (色)。いずれも draw は発火 (mandatory)。
//   §5 【ヒラメキ】self→hand — remove=[OTHER, B05102], source=B05102 → B05102 のみ手札 (PR085 a2 同型)。
//   §6 構造 — B05102 単独登録 (P変種なし) + a1 (event-use + partnerColor cond + sequence 3 step) + a2 hirameki fromSelf。
// rules: 10-action-event.md, 11-reasoning.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md (§FILE/§パートナー色),
//        19-special-rules.md (§レベル下限なし), 20-color-and-switch.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry, def } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { evalCond } from '@/engine/cond/index';
import { read } from '@/engine/read/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { cardOccurrenceUid, cardOccurrenceWitness } from '@/engine/target/card-occurrence';
import { sceneChar } from '../helpers/fixtures';
import { B05102 } from '@/cards/ct-p05/B05102';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黄'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// synthetic targets
const YC3 = 'YC3'; // 黄 Lv3 (FILE>=3 で登場可)
const RC3 = 'RC3'; // 赤 Lv3 (色不一致 → 登場不可)
const OPP5 = 'OPP5'; // 任意色 Lv5 (相手 level-down 対象、printed 5)
const DRAW1 = 'DRAW1'; // デッキ top (draw 検証)
const ZD = ['ZD1', 'ZD2']; // デッキ余り
const PY = 'PY'; // 黄 partner (gate ON)
const PR = 'PR'; // 赤 partner (gate OFF)

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerAll(); // B05102 込み
  registerCardDef(ch(YC3, { colors: ['黄'], level: 3 }));
  registerCardDef(ch(RC3, { colors: ['赤'], level: 3 }));
  registerCardDef(ch(OPP5, { colors: ['黒'], level: 5, ap: 5000 }));
  registerCardDef(ch(DRAW1, { colors: ['黒'], level: 9 }));
  for (const z of ZD) registerCardDef(ch(z, { colors: ['黒'], level: 9 }));
  registerCardDef({ ...ch(PY), id: PY, kind: 'partner', colors: ['黄'], names: ['毛利小五郎'] });
  registerCardDef({ ...ch(PR), id: PR, kind: 'partner', colors: ['赤'], names: ['赤パートナー'] });
  registerTriggeredListener();
});

/** B05102 a1 効果を実 engine 経路で駆動し pick を AI 解決して drain しきる (ctx.source.area='hand')。 */
function runA1(mutateBoard: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  s = produce(s, (d) => {
    d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    mutateBoard(d);
  });
  const a1 = def.card('B05102')!.abilities.find((a) => a.id === 'a1')!;
  s = produce(s, (d) => {
    const ctx = { source: { player: 'self', cardId: 'B05102', uid: 'ev#1', abilityId: 'a1', area: 'hand' }, bindings: {} } as unknown as EffectCtx;
    runEffect(d, a1.effect as never, ctx);
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    }
  });
  return s;
}

const inScene = (s: GameState, cardId: string) => s.players.self.scene.some((c) => c.cardId === cardId);
const inHand = (s: GameState, cardId: string) => s.players.self.hand.includes(cardId);

describe('B05102 §1 — 【パートナー黄】gate (partnerColor cond)', () => {
  const ctx = (player: 'self' = 'self') => ({ source: { player, area: 'hand', cardId: 'B05102', abilityId: 'a1' }, bindings: {} } as unknown as EffectCtx);
  it('§1a partner=黄 → gate 成立 (true)', () => {
    const s = produce(createEmptyGameState(), (d) => { d.players.self.partner = { cardId: PY, state: 'active' } as never; });
    expect(evalCond(s, { kind: 'partnerColor', color: '黄' }, ctx())).toBe(true);
  });
  it('§1b partner=赤 → gate 不成立 (false=何も効果のないイベント)', () => {
    const s = produce(createEmptyGameState(), (d) => { d.players.self.partner = { cardId: PR, state: 'active' } as never; });
    expect(evalCond(s, { kind: 'partnerColor', color: '黄' }, ctx())).toBe(false);
  });
});

describe('B05102 §2 — mandatory-tail: 相手キャラ0 でも draw + enter 発火 (BUG-111 #2, 境界=不在)', () => {
  it('相手現場0 → level-down 候補不在でも draw(必須)発火 + 黄キャラ登場', () => {
    const s = runA1((d) => {
      d.players.opp.scene = []; // level-down 候補 0
      d.players.self.file = [FB, FB, FB]; // fileCount 3
      d.players.self.hand = [YC3]; // 黄 Lv3 (≤3 で登場可)
      d.players.self.deck = [DRAW1, ...ZD]; // 上=DRAW1
    });
    expect(inHand(s, DRAW1), 'draw が発火 (DRAW1 が手札へ)').toBe(true);
    expect(inScene(s, YC3), 'sceneEnter が発火 (YC3 登場) — level-down 不在でも remainder 実行').toBe(true);
    expect(inHand(s, YC3), '登場した YC3 は手札に無い').toBe(false);
  });
});

describe('B05102 §3 — 相手キャラ在 → level-down 適用 + draw + enter', () => {
  it('相手 Lv5 → ターン終了までレベル-1 (=4) + draw + enter (AI first-candidate fallback)', () => {
    let oppUid = '';
    const s = runA1((d) => {
      d.players.opp.scene = [sceneChar(OPP5, 'opp#1', { named: false })];
      oppUid = 'opp#1';
      d.players.self.file = [FB, FB, FB];
      d.players.self.hand = [YC3];
      d.players.self.deck = [DRAW1, ...ZD];
    });
    expect(read.char.level(s, oppUid), '相手 Lv5 → 4 (turn-scope -1)').toBe(4);
    expect(s.players.opp.scene[0].turnEffects['lvlMod_turn'], 'lvlMod_turn に -1 が積まれた').toBe(-1);
    expect(inHand(s, DRAW1), 'draw 発火').toBe(true);
    expect(inScene(s, YC3), 'enter 発火').toBe(true);
  });
});

describe('B05102 §4 — sceneEnter 黄 + FILE枚数以下 filter', () => {
  it('§4a 黄 Lv3 / FILE3 → 登場 (Lv3<=3, 色一致)', () => {
    const s = runA1((d) => {
      d.players.opp.scene = [];
      d.players.self.file = [FB, FB, FB];
      d.players.self.hand = [YC3];
      d.players.self.deck = [DRAW1, ...ZD];
    });
    expect(inScene(s, YC3)).toBe(true);
  });
  it('§4b 黄 Lv3 / FILE2 → 不登場 (cap: Lv3>2) + draw は発火', () => {
    const s = runA1((d) => {
      d.players.opp.scene = [];
      d.players.self.file = [FB, FB]; // fileCount 2
      d.players.self.hand = [YC3];
      d.players.self.deck = [DRAW1, ...ZD];
    });
    expect(inScene(s, YC3), 'Lv3 は FILE2 では cap で不登場').toBe(false);
    expect(inHand(s, YC3), '登場しなかった YC3 は手札に残る').toBe(true);
    expect(inHand(s, DRAW1), 'draw は発火').toBe(true);
  });
  it('§4c 赤 Lv3 / FILE3 → 不登場 (色不一致) + draw は発火', () => {
    const s = runA1((d) => {
      d.players.opp.scene = [];
      d.players.self.file = [FB, FB, FB];
      d.players.self.hand = [RC3]; // 赤
      d.players.self.deck = [DRAW1, ...ZD];
    });
    expect(inScene(s, RC3), '赤は【黄】filter で不登場').toBe(false);
    expect(inHand(s, RC3), '登場しなかった RC3 は手札に残る').toBe(true);
    expect(inHand(s, DRAW1), 'draw は発火').toBe(true);
  });
});

describe('B05102 §5 — 【ヒラメキ】self→hand (PR085 a2 同型)', () => {
  const hctx = (state: GameState, cardId: string): EffectCtx => {
    const index = state.players.self.remove.lastIndexOf(cardId);
    return {
      source: { player: 'self', area: 'remove', cardId, abilityId: 'a2', uid: cardOccurrenceUid('self', 'remove', cardId, index) },
      bindings: {
        occurrence: [{
          kind: 'card', uid: cardOccurrenceUid('self', 'remove', cardId, index), cardId, player: 'self', area: 'remove', index,
          occurrenceWitness: cardOccurrenceWitness(state, 'self', 'remove'),
        }],
      },
    } as unknown as EffectCtx;
  };
  it('remove=[OTHER, B05102], source=B05102 → B05102 のみ手札 (別 cardId は残る)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = [];
      d.players.self.remove = ['OTHER', 'B05102'];
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'handAddFromRemove', { player: 'self', fromSelf: true }, hctx(d, 'B05102'));
    });
    expect(after.players.self.hand).toEqual(['B05102']);
    expect(after.players.self.remove).toEqual(['OTHER']);
  });
});

describe('B05102 §6 — 構造', () => {
  it('§6a B05102 登録済 (P変種なし)', () => {
    expect(def.card('B05102')?.id).toBe('B05102');
    expect(def.card('B05102P')).toBeUndefined();
  });
  it('§6b shape: 黄 L1 event 小五郎の弟子', () => {
    expect(B05102.kind).toBe('event');
    expect(B05102.no).toBe('0600/B05102');
    expect(B05102.names).toEqual(['小五郎の弟子']);
    expect(B05102.colors).toEqual(['黄']);
    expect(B05102.level).toBe(1);
    expect(B05102.rarity).toBe('C');
    expect(B05102.imageUrl).toBe('1746628078739579.jpg');
  });
  it('§6c a1 = event-use + partnerColor黄 cond + sequence[charModifyLevel, draw, sceneEnter]', () => {
    const a1 = B05102.abilities[0];
    expect(a1.trigger?.hook).toBe('effect:declared');
    expect(a1.trigger?.selfOnly).toBe(true);
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '黄' });
    const eff = a1.effect as { kind: string; steps: { verb?: string; args?: Record<string, unknown> }[] };
    expect(eff.kind).toBe('sequence');
    expect(eff.steps.map((st) => st.verb)).toEqual(['charModifyLevel', 'draw', 'sceneEnter']);
    expect(eff.steps[0].args).toMatchObject({ side: 'opp', delta: -1, scope: 'turn', max: 1 });
    expect(eff.steps[2].args).toMatchObject({ from: 'hand', viaEffect: true });
    expect((eff.steps[2].args!.filter as Record<string, unknown>)).toMatchObject({ color: '黄', kind: 'character', levelMax: { dyn: '$self.fileCount' } });
  });
  it('§6d a2 = hirameki fromSelf', () => {
    const a2 = B05102.abilities[1];
    expect(a2.trigger).toEqual({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toEqual({ kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', fromSelf: true } });
  });
});
