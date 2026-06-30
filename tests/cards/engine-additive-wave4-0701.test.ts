// engine additive wave-4 (2026-07-01) — 3 つの純 additive primitive の挙動テスト。
//
// #1 $self.level dyn (G16-partial) — 「このキャラのレベル(以下/同じ)の〜」相対 level フィルタの dyn 足場。
//    resolvePlaceholder に $self.level case が無く throw していた (ap/lp/setCardCount 等は実装済)。
//    filter 数値フィールド ({levelMax:{dyn:'$self.level'}}) は resolveFilterDynObj が field-agnostic に
//    解決 + matchOneFilter が effective level を honor (両方 origin/main で既出荷) → dyn 1 case 追加で解禁。
//    charRead.level と同式 (effective = base + 各 lvlMod + continuous、$self.ap/lp と対称、B09096 先例)。
//
// #2 drawUpToHandSize verb (P44-partial) — 「自分の手札がN枚になるまでカードを引く」(B08047 沖矢昴
//    「ターン終了時、手札が2枚になるまで引く」)。draw(max(0, n − hand.length)) の決定論 verb。手札が
//    既にN枚以上なら draw 0 (捨てない、draw-up 方向のみ)。discard-down 版 (B07076) / 引いた枚数 return
//    (B04048) は別 variant として DEFER。pick 無し (atomDraw の薄いラッパー)。
//
// #3 remove:exit observer + removeExitMatches matcher (P20) — 「自分のリムーブエリアにある〚特徴〛の
//    キャラがリムーブエリアから離れたとき」(B05087 諸伏高明 / B05088 大和敢助)。リフレッシュでデッキへ
//    戻る (mutate.deck.refresh) / 効果で回収される (mutate.remove.removeFromHere) 両出口で離脱カード毎に
//    emit。matcher は離脱カードの cardId → CardDef を matchOneFilter(c=null = 印字値) で評価 (remove-area
//    card は turnEffects 無 = 静的 def)。side='self' = payload.player===source.player (「自分の」)。
//    公式Q&A: リフレッシュでシャッフルされデッキへ移った場合に発動。
//
// いずれも既存登録カードは未宣言/未使用 ⇒ 挙動不変 (smoke baseline 不変)。専用テスト必須。
// rules: 11(LP/level), 14(リフレッシュ=remove→deck), 15(「まで」=0可/動的値解決), 16(セット), 19(level 下限なし),
//        17(【現場リムーブ時】= リムーブ方法問わず → remove-area 離脱も方法問わず emit)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { evalCond } from '@/engine/cond/eval';
import { evalDyn } from '@/engine/dyn/eval';
import { runAtom } from '@/engine/effect/index';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, Condition, EffectCtx, AbilityDef, Effect } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function ev(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors: ['青'], level: 4, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
});

// ============================================================
// #1 $self.level dyn (G16-partial)
// ============================================================
describe('wave4 #1 $self.level dyn', () => {
  function withSource(level: number, lvlModTurn = 0): { s: GameState; ctx: EffectCtx } {
    registerCardDef(ch('SRC', { level }));
    let uid = '';
    const s = produce(createEmptyGameState(), (d) => {
      uid = mutate.scene.enter(d, 'self', 'SRC', {}).uid;
      if (lvlModTurn !== 0) d.players.self.scene[0].turnEffects['lvlMod_turn'] = lvlModTurn;
    });
    return { s, ctx: makeCtx({ source: { player: 'self', area: 'scene', uid } }) };
  }

  it('印字 level 5 を返す', () => {
    const { s, ctx } = withSource(5);
    expect(evalDyn(s, '$self.level', ctx)).toBe(5);
  });

  it('effective level: lvlMod_turn +2 を合算 (charRead.level と同式、ap/lp と対称)', () => {
    const { s, ctx } = withSource(5, 2);
    expect(evalDyn(s, '$self.level', ctx)).toBe(7);
  });

  it('level マイナス (rules/19 下限なし): base 1 + mod -3 = -2', () => {
    const { s, ctx } = withSource(1, -3);
    expect(evalDyn(s, '$self.level', ctx)).toBe(-2);
  });

  it('算術式に使える: $self.level * 1000', () => {
    const { s, ctx } = withSource(3);
    expect(evalDyn(s, '$self.level * 1000', ctx)).toBe(3000);
  });

  it('uid 不在 (source.uid なし) は throw (ap/lp/setCardCount と同 guard)', () => {
    registerCardDef(ch('SRC', { level: 5 }));
    const s = createEmptyGameState();
    expect(() => evalDyn(s, '$self.level', makeCtx())).toThrow();
  });
});

// ============================================================
// #2 drawUpToHandSize verb (P44-partial)
// ============================================================
describe('wave4 #2 drawUpToHandSize verb', () => {
  function base(handN: number, deckN: number): GameState {
    const s = createEmptyGameState();
    s.players.self.hand = Array.from({ length: handN }, (_, i) => `H${i}`);
    s.players.self.deck = Array.from({ length: deckN }, (_, i) => `D${i}`);
    return s;
  }

  it('手札0 → n:2 まで引く (deck 5 → hand 2 / deck 3)', () => {
    const after = produce(base(0, 5), (d) => { runAtom(d, 'drawUpToHandSize', { player: 'self', n: 2 }, makeCtx()); });
    expect(after.players.self.hand.length).toBe(2);
    expect(after.players.self.deck.length).toBe(3);
  });

  it('手札が既に n:2 → draw 0 (no-op)', () => {
    const after = produce(base(2, 5), (d) => { runAtom(d, 'drawUpToHandSize', { player: 'self', n: 2 }, makeCtx()); });
    expect(after.players.self.hand.length).toBe(2);
    expect(after.players.self.deck.length).toBe(5);
  });

  it('手札が n を超過 (3 > n:2) → draw 0 (捨てない、draw-up 方向のみ)', () => {
    const after = produce(base(3, 5), (d) => { runAtom(d, 'drawUpToHandSize', { player: 'self', n: 2 }, makeCtx()); });
    expect(after.players.self.hand.length).toBe(3);
    expect(after.players.self.deck.length).toBe(5);
  });

  it('decoy: opp の手札は影響を受けない', () => {
    const s = base(0, 5);
    s.players.opp.hand = ['O0'];
    const after = produce(s, (d) => { runAtom(d, 'drawUpToHandSize', { player: 'self', n: 2 }, makeCtx()); });
    expect(after.players.opp.hand.length).toBe(1);
  });

  it('デッキ不足: deck 2 + remove 5 で n:3 → 途中リフレッシュ経由で hand 3 (deck.draw へ委譲、相手証拠+1)', () => {
    const s = base(0, 2);
    s.players.self.remove = ['R0', 'R1', 'R2', 'R3', 'R4'];
    const after = produce(s, (d) => { runAtom(d, 'drawUpToHandSize', { player: 'self', n: 3 }, makeCtx()); });
    expect(after.players.self.hand.length).toBe(3); // rules/14: デッキ枯渇→リフレッシュ後に残り draw
    expect(after.players.opp.evidence.length).toBe(1); // refresh ペナルティ (相手証拠+1)
  });
});

// ============================================================
// #3 remove:exit observer + removeExitMatches matcher (P20)
// ============================================================
describe('wave4 #3 remove:exit observer', () => {
  const DRAW: Effect = { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } };
  // 「自分のリムーブエリアにある〚特徴[長野県警]〛のキャラがリムーブエリアから離れたとき」B05087/B05088
  const REMOVE_EXIT_OBS: AbilityDef = {
    id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'remove:exit' },
    condition: { kind: 'removeExitMatches', side: 'self', removeFilter: { kind: 'character', trait: ['長野県警'] } } as unknown as Condition,
    effect: DRAW, description: '自分のリムーブエリアの長野県警キャラが離れたとき1枚引く (B05088)', ruleRefs: [],
  };
  function firedBy(after: GameState, hook: string, uid: string): boolean {
    return after.pendingEffects.some((pe) => pe.triggeredBy?.hook === hook && pe.source?.uid === uid);
  }
  beforeEach(() => {
    registerCardDef(ch('OBS', { abilities: [REMOVE_EXIT_OBS] }));
    registerCardDef(ch('NAGANO', { traits: ['長野県警'] })); // matcher 一致
    registerCardDef(ch('OTHER', { traits: ['探偵'] }));        // matcher 不一致 (decoy)
    registerCardDef(ev('EVT', { traits: ['長野県警'] }));      // 種別不一致 (event、kind gate decoy)
    registerTriggeredListener();
  });

  it('refresh: 自リムーブの長野県警キャラがデッキへ戻る → side:self observer 発火', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['NAGANO'];
      mutate.deck.refresh(d, 'self');
    });
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(true);
  });

  it('removeFromHere: 効果で自リムーブから回収 → 発火', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['NAGANO', 'OTHER'];
      mutate.remove.removeFromHere(d, 'self', ['NAGANO']);
    });
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(true);
  });

  it('matcher: 不一致特徴 (探偵) のみ離脱 → removedFilter 不成立で非発火', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['OTHER'];
      mutate.remove.removeFromHere(d, 'self', ['OTHER']);
    });
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(false);
  });

  it('matcher: kind gate — 長野県警だが event (EVT) は kind:character 不一致 → 非発火', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['EVT'];
      mutate.remove.removeFromHere(d, 'self', ['EVT']);
    });
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(false);
  });

  it('pin: 相手のリムーブエリア離脱 → side:self observer は非発火', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.opp.remove = ['NAGANO'];
      mutate.deck.refresh(d, 'opp');
    });
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(false);
  });

  it('matcher direct: evalCond(removeExitMatches) を triggerPayload で評価', () => {
    const s = produce(createEmptyGameState(), (d) => { mutate.scene.enter(d, 'self', 'OBS', {}); });
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 's1' }, triggerPayload: { player: 'self', cardId: 'NAGANO' } });
    expect(evalCond(s, REMOVE_EXIT_OBS.condition as Condition, ctx)).toBe(true);
    const ctxMiss = makeCtx({ source: { player: 'self', area: 'scene', uid: 's1' }, triggerPayload: { player: 'self', cardId: 'OTHER' } });
    expect(evalCond(s, REMOVE_EXIT_OBS.condition as Condition, ctxMiss)).toBe(false);
  });

  // --- emit-site coverage (review BLOCKER fix): 全離脱経路で emit する (原因非依存) ---
  it('handAddFromRemove (single): remove→手札 離脱 → 発火 (B05087 第2能力経路)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['NAGANO'];
      runAtom(d, 'handAddFromRemove', { player: 'self', target: 'NAGANO' }, makeCtx());
    });
    expect(after.players.self.hand).toContain('NAGANO');
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(true);
  });

  it('handAddFromRemove (fromSelf): イベント自身が remove→手札 → 発火', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['NAGANO'];
      runAtom(d, 'handAddFromRemove', { player: 'self', fromSelf: true }, makeCtx({ source: { player: 'self', area: 'scene', cardId: 'NAGANO' } }));
    });
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(true);
  });

  it('removeAreaAllToDeckBottom: remove→デッキ下 離脱 → 発火 (B08027 経路)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['NAGANO'];
      runAtom(d, 'removeAreaAllToDeckBottom', {}, makeCtx({ source: { player: 'self', area: 'scene' } }));
    });
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(true);
  });

  it('evidence.gainCard(fromArea=remove): remove→証拠 離脱 → 発火', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['NAGANO'];
      mutate.evidence.gainCard(d, 'self', 'NAGANO', false, { turn: 0, via: 'effect' }, 'remove');
    });
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(true);
  });

  it('charSetCard fromSelf: 使用イベント自身が remove→set-card 離脱 → 発火', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['NAGANO'];
      runAtom(d, 'charSetCard', { uid: obsUid, fromSelf: true, player: 'self' }, makeCtx({ source: { player: 'self', area: 'scene', cardId: 'NAGANO' } }));
    });
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(true);
  });

  it('sceneEnter (from remove): remove→登場 離脱 → 発火 (B05087 1st 能力が観測しうる経路)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['NAGANO'];
      runAtom(d, 'sceneEnter', { player: 'self', cardId: 'NAGANO', viaEffect: true, target: { query: { area: 'remove', side: 'self' } } }, makeCtx());
    });
    expect(after.players.self.remove).not.toContain('NAGANO'); // remove から離脱 (複製登場でない)
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(true);
  });

  // --- NIT coverage: 複数枚 / absent-id / matcher branches / payload guard ---
  it('refresh 複数枚 (一部のみ一致): NAGANO は発火・OTHER 単独では発火しない (per-card 独立)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['OTHER', 'NAGANO', 'OTHER'];
      mutate.deck.refresh(d, 'self');
    });
    // NAGANO 離脱で matcher 一致 → 発火 (OTHER は不一致だが NAGANO 分の emit が拾われる)
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(true);
  });

  it('removeFromHere: remove に無い id (idx===-1) は emit しない → 非発火', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      d.players.self.remove = ['NAGANO'];
      mutate.remove.removeFromHere(d, 'self', ['GHOST']); // remove に無い → splice/emit せず
    });
    expect(after.players.self.remove).toContain('NAGANO'); // 触れていない
    expect(firedBy(after, 'remove:exit', obsUid)).toBe(false);
  });

  it('matcher side=opp: 相手リムーブ離脱を観測 (B05087/B05088 は未使用だが engine 経路を pin)', () => {
    const s = produce(createEmptyGameState(), (d) => { mutate.scene.enter(d, 'self', 'OBS', {}); });
    const condOpp = { kind: 'removeExitMatches', side: 'opp', removeFilter: { kind: 'character', trait: ['長野県警'] } } as unknown as Condition;
    const ctxOppExit = makeCtx({ source: { player: 'self', area: 'scene', uid: 's1' }, triggerPayload: { player: 'opp', cardId: 'NAGANO' } });
    expect(evalCond(s, condOpp, ctxOppExit)).toBe(true);
    const ctxSelfExit = makeCtx({ source: { player: 'self', area: 'scene', uid: 's1' }, triggerPayload: { player: 'self', cardId: 'NAGANO' } });
    expect(evalCond(s, condOpp, ctxSelfExit)).toBe(false);
  });

  it('matcher removeFilter 省略: 全カード一致 (kind/特徴 問わず true)', () => {
    const s = produce(createEmptyGameState(), (d) => { mutate.scene.enter(d, 'self', 'OBS', {}); });
    const condAny = { kind: 'removeExitMatches', side: 'self' } as unknown as Condition;
    const ctxEvt = makeCtx({ source: { player: 'self', area: 'scene', uid: 's1' }, triggerPayload: { player: 'self', cardId: 'EVT' } });
    expect(evalCond(s, condAny, ctxEvt)).toBe(true); // filter 無 → event でも一致
  });

  it('matcher 不正 payload: undefined / 不正 player / cardId 非文字列 → 防御的 false', () => {
    const s = produce(createEmptyGameState(), (d) => { mutate.scene.enter(d, 'self', 'OBS', {}); });
    const cond = REMOVE_EXIT_OBS.condition as Condition;
    expect(evalCond(s, cond, makeCtx({ source: { player: 'self', area: 'scene', uid: 's1' } }))).toBe(false); // payload 無
    expect(evalCond(s, cond, makeCtx({ source: { player: 'self', area: 'scene', uid: 's1' }, triggerPayload: { player: 'neither', cardId: 'NAGANO' } }))).toBe(false);
    expect(evalCond(s, cond, makeCtx({ source: { player: 'self', area: 'scene', uid: 's1' }, triggerPayload: { player: 'self' } }))).toBe(false); // cardId 無
  });
});
