// engine additive wave (2026-06-29c) — on-set-host scope: セットカードが host にライダー能力を付与する。
//
// 装備イベント (B02013 ターボエンジン付きスケートボード / B06063 せんぷう剣 / B05117 コンコン 等、
// 14 rider + 8 conferred-ability = 最大の未実装クラスタ) は「このイベントを…キャラ1枚にセットする。
// セットされているキャラは〚突撃〛/「【自分ターン中】AP+2000」/「…したとき…」を持つ。」型。
// セットカード def の **scope:'on-set-host'** ability を host に適用する 2 honor site:
//   #A 継続ライダー (read.char.ap/lp/level/keywords): faceUp set card の scope:'on-set-host' continuous を
//      host に合算 (apDelta/lpDelta/lvlDelta/grantKeywords)。candidates.matchOneFilter も同経路で honor (BUG-117)。
//   #B triggered 付与 (listeners/triggered.handleHook): faceUp set card の scope:'on-set-host' triggered を
//      host (card.uid=host) の能力として発火 (selfOnly は host uid 照合)。
//
// 挙動不変: 'on-set-host' は新 scope = 既存カードは未宣言。set card の **on-scene** ability は host に
// 漏れない (gate=scope==='on-set-host')。裏向きセット (faceUp:false) は情報を持たない (rules/16) → 不適用。
// rules: 16-card-set.md (セット) / 15 / 17 / 19 (元の能力を無効/AP0 でも他カード修正は残る) / 13 §キーワード

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { read } from '@/engine/read/index';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { matchOneFilter } from '@/engine/target/candidates';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef, GameState, Candidate, SetCardEntry } from '@/engine/types';

function host(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// --- rider event defs (scope:'on-set-host') ---
function riderEvent(id: string, mod: Record<string, unknown>, condition?: object): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: ['青'], level: 4, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [{
      id: 'a1', type: 'continuous', scope: 'on-set-host', ...(condition ? { condition } : {}),
      continuousModifier: mod, description: `rider ${id}`, ruleRefs: [],
    }],
    ruleRefs: [],
  } as unknown as CardDef;
}

// #B conferred triggered: セットされているキャラが推理したとき 1 ドロー (selfOnly)。
const RIDER_TRIG: CardDef = {
  id: 'RIDER_TRIG', no: '9/RIDER_TRIG', kind: 'event', names: ['RIDER_TRIG'], colors: ['青'], level: 4, traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-set-host', trigger: { hook: 'reasoning:end', selfOnly: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: 'conferred trigger', ruleRefs: [],
  }],
  ruleRefs: [],
} as unknown as CardDef;

// DECOY: on-scene scope の能力を持つセットカード。host に漏れてはならない (gate 証跡)。
const DECOY_ONSCENE: CardDef = {
  id: 'DECOY_ONSCENE', no: '9/DECOY_ONSCENE', kind: 'character', names: ['DECOY_ONSCENE'], colors: ['黒'], level: 1, ap: 9000, lp: 9, traits: [], keywords: ['迅速'], rarity: 'C', imageUrl: '',
  abilities: [
    { id: 'a1', type: 'continuous', scope: 'on-scene', continuousModifier: { apDelta: 9999, grantKeywords: () => ['突撃'] }, description: 'decoy on-scene cont', ruleRefs: [] },
    { id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'reasoning:end', selfOnly: true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: 'decoy on-scene trig', ruleRefs: [] },
  ],
  ruleRefs: [],
} as unknown as CardDef;

const RIDER_AP = riderEvent('RIDER_AP', { apDelta: 2000 });
const RIDER_LP = riderEvent('RIDER_LP', { lpDelta: 3 });
const RIDER_LVL = riderEvent('RIDER_LVL', { lvlDelta: 2 });
const RIDER_KW = riderEvent('RIDER_KW', { grantKeywords: () => ['突撃'] });
const RIDER_COND = riderEvent('RIDER_COND', { apDelta: 2000 }, { kind: 'turn', player: 'self' }); // 【自分ターン中】AP+2000 (B06063 型)

function up(cardId: string): SetCardEntry { return { cardId, faceUp: true }; }
function down(cardId: string): SetCardEntry { return { cardId, faceUp: false }; }

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(host('HOST'));
  [RIDER_AP, RIDER_LP, RIDER_LVL, RIDER_KW, RIDER_COND, RIDER_TRIG, DECOY_ONSCENE].forEach(registerCardDef);
  registerTriggeredListener();
});

function turn(s: GameState, player: 'self' | 'opp'): void {
  s.turn = { number: 5, player, phase: 'main', isFirstPlayerFirstTurn: false };
}

describe('#A on-set-host continuous rider', () => {
  it('faceUp AP rider → host AP +2000 / set 無は base / faceDown は不適用 (rules/16)', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [
      sceneChar('HOST', 'h#1', { setCards: [up('RIDER_AP')] }),
      sceneChar('HOST', 'h#2'),
      sceneChar('HOST', 'h#3', { setCards: [down('RIDER_AP')] }),
    ];
    expect(read.char.ap(s, 'h#1'), 'faceUp rider → base3000+2000').toBe(5000);
    expect(read.char.ap(s, 'h#2'), 'set 無 → base3000').toBe(3000);
    expect(read.char.ap(s, 'h#3'), 'faceDown は情報なし → base3000').toBe(3000);
  });

  it('LP rider / level rider', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [
      sceneChar('HOST', 'l#1', { setCards: [up('RIDER_LP')] }),
      sceneChar('HOST', 'v#1', { setCards: [up('RIDER_LVL')] }),
    ];
    expect(read.char.lp(s, 'l#1'), 'LP rider base1+3').toBe(4);
    expect(read.char.level(s, 'v#1'), 'level rider base4+2').toBe(6);
  });

  it('keyword rider → host が 〚突撃〛を持つ / faceDown は不適用', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [
      sceneChar('HOST', 'k#1', { setCards: [up('RIDER_KW')] }),
      sceneChar('HOST', 'k#2', { setCards: [down('RIDER_KW')] }),
    ];
    expect(read.char.keywords(s, 'k#1'), 'faceUp keyword rider').toContain('突撃');
    expect(read.char.hasKeyword(s, 'k#1', '突撃')).toBe(true);
    expect(read.char.keywords(s, 'k#2'), 'faceDown → 付与なし').not.toContain('突撃');
  });

  it('rider keyword は外部付与扱い — disabledOriginal でも残る (rules/19)', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('HOST', 'do#1', {
      setCards: [up('RIDER_KW')],
      keywordOverrides: { granted: [], disabledOriginal: true },
    })];
    expect(read.char.keywords(s, 'do#1'), 'disabledOriginal でも rider の 突撃 は外部付与ゆえ残る').toContain('突撃');
  });

  it('legacy save without a temporal marker treats its active rider as pre-boundary', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('HOST', 'rv#1', {
      setCards: [up('RIDER_KW')],
      turnEffects: { contactImmune: false, removeOnTurnEnd: false, revokedKeywords: ['突撃'] },
    })];
    expect(read.char.keywords(s, 'rv#1')).not.toContain('突撃');
  });

  it('conditional rider (【自分ターン中】AP+2000) — 自分ターンのみ有効', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('HOST', 'c#1', { setCards: [up('RIDER_COND')] })];
    turn(s, 'self');
    expect(read.char.ap(s, 'c#1'), '自分ターン → +2000').toBe(5000);
    turn(s, 'opp');
    expect(read.char.ap(s, 'c#1'), '相手ターン → +0').toBe(3000);
  });

  it('複数ライダー stack (公式 B06063 Q&A: 2枚セット可)', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('HOST', 'm#1', { setCards: [up('RIDER_AP'), up('RIDER_AP')] })];
    expect(read.char.ap(s, 'm#1'), '2枚で +4000').toBe(7000);
  });

  it('BUG-117 原則 — matchOneFilter が rider 込みの有効 AP を見る', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    const hc = sceneChar('HOST', 'f#1', { setCards: [up('RIDER_AP')] });
    s.players.self.scene = [hc];
    const cand: Candidate = { kind: 'char', uid: 'f#1', cardId: 'HOST', player: 'self' };
    expect(matchOneFilter(s, 'HOST', { apMin: 5000 }, hc, cand), 'apMin:5000 = rider後AP一致').toBe(true);
    expect(matchOneFilter(s, 'HOST', { apMin: 5001 }, hc, cand), 'apMin:5001 = 不一致').toBe(false);
  });

  it('behavior-invariant gate — set card の on-scene 能力は host に漏れない', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('HOST', 'd#1', { setCards: [up('DECOY_ONSCENE')] })];
    expect(read.char.ap(s, 'd#1'), 'DECOY の on-scene apDelta:9999 は host に適用されない').toBe(3000);
    expect(read.char.keywords(s, 'd#1'), 'DECOY の on-scene grantKeywords/印字キーワードも漏れない').toEqual([]);
  });
});

describe('#B on-set-host triggered conferral', () => {
  function setup(setCardId: string, faceUp: boolean): { s: GameState; hostUid: string } {
    let s = createEmptyGameState();
    turn(s, 'self');
    let hostUid = '';
    s = produce(s, (d) => {
      d.players.self.deck = ['D1', 'D2', 'D3'];
      hostUid = mutate.scene.enter(d, 'self', 'HOST', {}).uid;
      mutate.char.setCard(d, hostUid, setCardId, faceUp);
    });
    return { s, hostUid };
  }

  it('faceUp conferred trigger — host 推理時に発火 (1ドロー)', () => {
    const { s, hostUid } = setup('RIDER_TRIG', true);
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      event.emit(d, 'reasoning:end', { player: 'self', uid: hostUid }, { player: 'self', uid: hostUid });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, 'conferred trigger 発火 → +1').toBe(before + 1);
  });

  it('faceDown conferred trigger → 不発 (rules/16)', () => {
    const { s, hostUid } = setup('RIDER_TRIG', false);
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      event.emit(d, 'reasoning:end', { player: 'self', uid: hostUid }, { player: 'self', uid: hostUid });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, 'faceDown → 付与なし').toBe(before);
  });

  it('selfOnly — 別 uid の推理では発火しない', () => {
    const { s, hostUid } = setup('RIDER_TRIG', true);
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      event.emit(d, 'reasoning:end', { player: 'self', uid: 'OTHER' }, { player: 'self', uid: 'OTHER' });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, '別 uid → 不発 (selfOnly host照合)').toBe(before);
    // 確認: 同じ盤面で host uid なら発火する
    const after2 = produce(s, (d) => {
      event.emit(d, 'reasoning:end', { player: 'self', uid: hostUid }, { player: 'self', uid: hostUid });
      runAllUntilEmpty(d);
    });
    expect(after2.players.self.hand.length, 'host uid なら発火').toBe(before + 1);
  });

  it('behavior-invariant gate — set card の on-scene triggered は conferral されない', () => {
    const { s, hostUid } = setup('DECOY_ONSCENE', true);
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      event.emit(d, 'reasoning:end', { player: 'self', uid: hostUid }, { player: 'self', uid: hostUid });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, 'on-scene set-card trigger は host に conferral されない').toBe(before);
  });
});

describe('keyword-loss temporal boundary for on-set-host grants', () => {
  it('live revoke suppresses an existing rider while a later rider source restores the keyword', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('HOST', 'rv#1', {
      setCards: [up('RIDER_KW')],
    })];

    mutate.char.revokeKeywordTurn(s, 'rv#1', '突撃');
    expect(s.players.self.scene[0]!.setCards[0]!.instanceId).toMatch(/^set:\d+$/);
    expect(read.char.keywords(s, 'rv#1')).not.toContain('突撃');
    const hydrated = structuredClone(s);
    expect(read.char.keywords(hydrated, 'rv#1')).not.toContain('突撃');
    mutate.char.setCard(hydrated, 'rv#1', 'RIDER_KW', true);
    expect(read.char.keywords(hydrated, 'rv#1')).toContain('突撃');
  });
});
