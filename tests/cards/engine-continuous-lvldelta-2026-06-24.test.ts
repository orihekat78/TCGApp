// Gap1 — ContinuousModifier.lvlDelta (engine additive wave 2026-06-24)。
// 「【自分ターン中】レベル+1」「【解決編】レベル+3」型の条件付き継続レベル修正を表現する継続機構。
// apDelta/lpDelta と完全対称に read.char.level + candidates.matchOneFilter の2 site で honor する
// (BUG-117 原則: filter-level == combat-level)。既存カードは lvlDelta 未宣言 → 回帰0 (additive)。
//
// 検証:
//   §1 read.char.level が continuous lvlDelta を on-scene で合算 (base 4 + 3 = 7)。
//   §2 candidates.matchOneFilter の levelMin/Max が同じ有効値で判定 (BUG-117)。
//   §3 condition-gated (【自分ターン中】) — 自分ターンのみ有効 / 相手ターンは base。
//   §4 additive — lvlDelta 未宣言の char は不変 / 既存 turnEffects.lvlMod と co-exist。
// rules: 15, 19 (下限なし), 24 §常時有効型
//
// 出典 card (card-session が出荷): B08050 宮野明美 (【解決編】レベル+3) / B08059 諸星大 (【自分ターン中】レベル+1)。
// spec: .claude/specs/engine-additive-wave-2026-06-24.md

import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { read } from '@/engine/read/index';
import { matchOneFilter } from '@/engine/target/candidates';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef, GameState, Candidate } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// 無条件 continuous lvlDelta:+3 (B08050 解決編+3 の condition を外した最小形)。
const LVL3: CardDef = ch('LVL3', {
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', continuousModifier: { lvlDelta: 3 }, description: 'continuous level +3', ruleRefs: [] }],
});
// 【自分ターン中】continuous lvlDelta:+1 (B08059 型 condition gate)。
const LVL1_TURN: CardDef = ch('LVL1T', {
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'turn', player: 'self' }, continuousModifier: { lvlDelta: 1 }, description: '【自分ターン中】level +1', ruleRefs: [] }],
});
// 負の lvlDelta (rules/19 下限なし: level<0 もあり得る)。base 4 + (-6) = -2。
const LVL_NEG: CardDef = ch('LVLNEG', {
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', continuousModifier: { lvlDelta: -6 }, description: 'continuous level -6', ruleRefs: [] }],
});
// closure 形 lvlDelta (ContinuousDelta の function branch、number/dyn 以外も read==filter で sync)。
const LVL_FN: CardDef = ch('LVLFN', {
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', continuousModifier: { lvlDelta: (_s, _ctx) => 3 }, description: 'continuous level +3 (closure)', ruleRefs: [] }],
});

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll();
  registerCardDef(LVL3);
  registerCardDef(LVL1_TURN);
  registerCardDef(LVL_NEG);
  registerCardDef(LVL_FN);
  registerCardDef(ch('PLAIN', { level: 4 }));
  registerTriggeredListener();
});

function turn(s: GameState, player: 'self' | 'opp'): void {
  s.turn = { number: 5, player, phase: 'main', isFirstPlayerFirstTurn: false };
}
function cand(uid: string, cardId: string, player: 'self' | 'opp'): Candidate {
  return { kind: 'char', uid, cardId, player } as Candidate;
}

describe('Gap1 §1 — read.char.level が continuous lvlDelta を合算', () => {
  it('base 4 + lvlDelta 3 = 7 (on-scene)', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('LVL3', 'l3#1')];
    expect(read.char.level(s, 'l3#1')).toBe(7);
  });
  it('lvlDelta 未宣言の PLAIN は base 4 (additive・回帰0)', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('PLAIN', 'p#1')];
    expect(read.char.level(s, 'p#1')).toBe(4);
  });
});

describe('Gap1 §2 — candidates.matchOneFilter が同じ有効値で判定 (BUG-117)', () => {
  it('levelMax:6 は lvlDelta後 7 の char を除外 / levelMin:7 は含む', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('LVL3', 'l3#1')];
    const c = cand('l3#1', 'LVL3', 'self');
    expect(matchOneFilter(s, 'LVL3', { levelMax: 6 }, s.players.self.scene[0], c)).toBe(false);
    expect(matchOneFilter(s, 'LVL3', { levelMin: 7 }, s.players.self.scene[0], c)).toBe(true);
  });
  it('2 char 盤面で cross-contamination なし (LVL3=7 / PLAIN=4 を独立判定)', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('LVL3', 'l3#1'), sceneChar('PLAIN', 'p#1')];
    const cL = cand('l3#1', 'LVL3', 'self');
    const cP = cand('p#1', 'PLAIN', 'self');
    // levelMax:4 → PLAIN(4) のみ含む、LVL3(7) は除外
    expect(matchOneFilter(s, 'LVL3', { levelMax: 4 }, s.players.self.scene[0], cL)).toBe(false);
    expect(matchOneFilter(s, 'PLAIN', { levelMax: 4 }, s.players.self.scene[1], cP)).toBe(true);
    // levelMin:7 → LVL3 のみ含む、PLAIN は除外
    expect(matchOneFilter(s, 'LVL3', { levelMin: 7 }, s.players.self.scene[0], cL)).toBe(true);
    expect(matchOneFilter(s, 'PLAIN', { levelMin: 7 }, s.players.self.scene[1], cP)).toBe(false);
  });
});

describe('Gap1 §5 — filter 側も ability.condition を honor (BUG-117 不変条件の要)', () => {
  // 敵対 review CONCERN: §2 は無条件 delta のため、matchOneFilter 内で condition 評価が落ちても
  // 気付けない。条件付き lvlDelta を filter 経路で踏み、combat (read.char.level) と一致することを pin。
  it('自分ターン: read=5 かつ filter levelMin:5 が含む / 相手ターン: read=4 かつ filter levelMin:5 が除外', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('LVL1T', 't#1')];
    const c = cand('t#1', 'LVL1T', 'self');
    turn(s, 'self');
    expect(read.char.level(s, 't#1')).toBe(5);
    expect(matchOneFilter(s, 'LVL1T', { levelMin: 5 }, s.players.self.scene[0], c)).toBe(true);
    turn(s, 'opp');
    expect(read.char.level(s, 't#1')).toBe(4);
    expect(matchOneFilter(s, 'LVL1T', { levelMin: 5 }, s.players.self.scene[0], c)).toBe(false);
  });
});

describe('Gap1 §6 — 負の lvlDelta / level<0 (rules/19 下限なし) read+filter sync', () => {
  it('base 4 + (-6) = -2 を read と filter が一致して扱う', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('LVLNEG', 'n#1')];
    const c = cand('n#1', 'LVLNEG', 'self');
    expect(read.char.level(s, 'n#1')).toBe(-2);
    expect(matchOneFilter(s, 'LVLNEG', { levelMax: 0 }, s.players.self.scene[0], c)).toBe(true);  // -2 <= 0
    expect(matchOneFilter(s, 'LVLNEG', { levelMin: 0 }, s.players.self.scene[0], c)).toBe(false); // -2 < 0
  });
});

describe('Gap1 §7 — closure 形 lvlDelta も read==filter で sync', () => {
  it('lvlDelta: ()=>3 → read.char.level 7 かつ filter levelMin:7 が含む', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('LVLFN', 'f#1')];
    const c = cand('f#1', 'LVLFN', 'self');
    expect(read.char.level(s, 'f#1')).toBe(7);
    expect(matchOneFilter(s, 'LVLFN', { levelMin: 7 }, s.players.self.scene[0], c)).toBe(true);
    expect(matchOneFilter(s, 'LVLFN', { levelMax: 6 }, s.players.self.scene[0], c)).toBe(false);
  });
});

describe('Gap1 §3 — condition-gated (【自分ターン中】)', () => {
  it('自分ターンは 4+1=5 / 相手ターンは base 4', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('LVL1T', 't#1')];
    turn(s, 'self');
    expect(read.char.level(s, 't#1')).toBe(5);
    turn(s, 'opp');
    expect(read.char.level(s, 't#1')).toBe(4);
  });
});

describe('Gap1 §4 — 既存 turnEffects.lvlMod と co-exist (additive)', () => {
  it('lvlDelta 3 + turnEffects lvlMod_turn -1 = 4+3-1 = 6', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    const c = sceneChar('LVL3', 'l3#1');
    c.turnEffects['lvlMod_turn'] = -1;
    s.players.self.scene = [c];
    expect(read.char.level(s, 'l3#1')).toBe(6);
  });
});
