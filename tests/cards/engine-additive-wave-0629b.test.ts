// engine additive wave (2026-06-29b) — 2 つの純 additive primitive の挙動テスト。
//
// #1 cross-side 数値 aura (continuousModifier.apDeltaAuraOpp/lpDeltaAuraOpp + auraFilterOpp)
//    「【自分ターン中】相手の現場にいる [auraFilterOpp] のキャラを AP±N」(B03033 遠山和葉)。
//    read.char.auraDelta が反対 side の bearer も走査する。cluster13 (同 side aura) と対称・honor site 共有。
// #2 ターン終了時まで印字キーワードを失う (turnEffects.revokedKeywords + read.char.keywords 減算)
//    「ターン終了時までこのキャラは〚突撃[キャラ]〛を失う」(B06068 京極真)。
//    charRevokeKeyword scope:'turn' が積み、clearTurnEffects('turn') で清掃。
//
// いずれも既存カードは未宣言/未使用 ⇒ 挙動不変 (smoke baseline 不変)。専用テスト必須 (非 MVP ゆえ smoke 不踏)。
// rules: 15, 17 §【自分ターン中】, 19 (下限なし / 「失う」効果), 24 §常時有効型, 13 §キーワード能力

import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { read } from '@/engine/read/index';
import { char as mutateChar } from '@/engine/mutate/char';
import { runAtom } from '@/engine/effect/index';
import { matchOneFilter } from '@/engine/target/candidates';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, Candidate, SetCardEntry } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// cross-side aura bearer (B03033 型): 【自分ターン中】相手の現場の hasSetCards キャラを AP-1000。
const XAURA: CardDef = {
  id: 'XAURA', no: '9/XAURA', kind: 'character', names: ['XAURA'], colors: ['緑'], level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'turn', player: 'self' },
    continuousModifier: { apDeltaAuraOpp: -1000, auraFilterOpp: { hasSetCards: true } },
    description: 'cross-side aura: opp hasSetCards AP-1000', ruleRefs: [],
  }],
  ruleRefs: [],
};

// cross-side LP aura bearer (lpDeltaAuraOpp 経路の被覆)。
const XAURALP: CardDef = {
  id: 'XAURALP', no: '9/XAURALP', kind: 'character', names: ['XAURALP'], colors: ['緑'], level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'turn', player: 'self' },
    continuousModifier: { lpDeltaAuraOpp: -1, auraFilterOpp: { hasSetCards: true } },
    description: 'cross-side LP aura', ruleRefs: [],
  }],
  ruleRefs: [],
};

const SET: SetCardEntry[] = [{ cardId: 'X', faceUp: false }];

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(XAURA);
  registerCardDef(XAURALP);
  registerCardDef(ch('OPPSET', { colors: ['黒'], ap: 5000, lp: 3 }));
  registerCardDef(ch('OPPNO', { colors: ['黒'], ap: 5000 }));
  registerCardDef(ch('SELFSET', { colors: ['青'], ap: 5000 }));
  registerCardDef(ch('TOKKEKYA', { keywords: ['突撃[キャラ]'], ap: 6000 }));
  registerTriggeredListener();
});

function turn(s: GameState, player: 'self' | 'opp'): void {
  s.turn = { number: 5, player, phase: 'main', isFirstPlayerFirstTurn: false };
}

describe('#1 cross-side aura — 相手の現場 (hasSetCards) を AP-1000', () => {
  it('opp の set済キャラを -1000 / set無は不変 / 自分side は不変', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('XAURA', 'x#1'), sceneChar('SELFSET', 'ss#1', { setCards: SET })];
    s.players.opp.scene = [sceneChar('OPPSET', 'os#1', { setCards: SET }), sceneChar('OPPNO', 'on#1')];
    expect(read.char.ap(s, 'os#1'), 'opp set済 (base5000) は cross-side aura で -1000').toBe(4000);
    expect(read.char.ap(s, 'on#1'), 'opp set無は対象外 (不変)').toBe(5000);
    expect(read.char.ap(s, 'ss#1'), '自分side set済は cross-side aura の対象外 (同 side は apDeltaAuraOpp 不適用)').toBe(5000);
    expect(read.char.ap(s, 'x#1'), 'bearer 自身 (base4000) 不変').toBe(4000);
  });

  it('lpDeltaAuraOpp 経路 — opp set済キャラの LP を -1 / set無は不変', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('XAURALP', 'xl#1')];
    s.players.opp.scene = [sceneChar('OPPSET', 'os#1', { setCards: SET }), sceneChar('OPPNO', 'on#1', { setCards: [] })];
    expect(read.char.lp(s, 'os#1'), 'opp set済 (base LP3) は cross-side LP aura で -1').toBe(2);
    expect(read.char.lp(s, 'on#1'), 'opp set無は対象外 (OPPNO base LP1)').toBe(1);
  });

  it('【自分ターン中】gate — 相手ターンでは cross-side aura 不発', () => {
    const s = createEmptyGameState();
    turn(s, 'opp'); // bearer (self) の【自分ターン中】不成立
    s.players.self.scene = [sceneChar('XAURA', 'x#1')];
    s.players.opp.scene = [sceneChar('OPPSET', 'os#1', { setCards: SET })];
    expect(read.char.ap(s, 'os#1'), '相手ターン中は aura 不発 (base5000)').toBe(5000);
  });

  it('matchOneFilter 一致 (BUG-117 原則) — filter-AP が aura 込みの有効 AP を見る', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('XAURA', 'x#1')];
    s.players.opp.scene = [sceneChar('OPPSET', 'os#1', { setCards: SET })];
    const cand: Candidate = { kind: 'char', uid: 'os#1', cardId: 'OPPSET', player: 'opp' };
    const oppChar = s.players.opp.scene[0];
    // aura 適用後 AP=4000。apMax:4000 は一致、apMax:3999 は不一致 (有効 AP を見る証跡)。
    expect(matchOneFilter(s, 'OPPSET', { apMax: 4000 }, oppChar, cand), 'apMax:4000 = aura後AP一致').toBe(true);
    expect(matchOneFilter(s, 'OPPSET', { apMax: 3999 }, oppChar, cand), 'apMax:3999 = 不一致').toBe(false);
  });

  it('behavior-invariant — apDeltaAuraOpp 未宣言の盤面では cross-side 加算 0', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('SELFSET', 'ss#1')];
    s.players.opp.scene = [sceneChar('OPPSET', 'os#1', { setCards: SET })];
    expect(read.char.ap(s, 'os#1'), 'aura bearer 不在 → opp AP 不変 (base5000)').toBe(5000);
  });
});

describe('#2 printed-keyword turn-revoke — 突撃[キャラ] をターン終了時まで失う', () => {
  it('revokeKeywordTurn で印字キーワードが集合から消える / clearTurnEffects(turn) で復活', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('TOKKEKYA', 't#1')];
    expect(read.char.keywords(s, 't#1'), '初期は印字 突撃[キャラ] を持つ').toContain('突撃[キャラ]');
    mutateChar.revokeKeywordTurn(s, 't#1', '突撃[キャラ]');
    expect(read.char.keywords(s, 't#1'), 'turn-revoke 後は集合から消える').not.toContain('突撃[キャラ]');
    expect(read.char.hasKeyword(s, 't#1', '突撃[キャラ]'), 'hasKeyword も false').toBe(false);
    mutateChar.clearTurnEffects(s, 't#1', 'turn');
    expect(read.char.keywords(s, 't#1'), 'ターン終了清掃で印字 突撃[キャラ] が復活').toContain('突撃[キャラ]');
  });

  it('再付与で復活 (B06068 Q&A) — 失った後に外部 turn-grant された 突撃[キャラ] は持つ', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('TOKKEKYA', 't#1')];
    mutateChar.revokeKeywordTurn(s, 't#1', '突撃[キャラ]'); // 印字を失う
    expect(read.char.keywords(s, 't#1'), '失った直後は持たない').not.toContain('突撃[キャラ]');
    mutateChar.grantKeyword(s, 't#1', '突撃[キャラ]', 'turn'); // 他カードが再付与 (turnGranted へ)
    expect(read.char.keywords(s, 't#1'), '外部 turn-grant は revoke と独立 → 再付与で復活 (公式Q&A)').toContain('突撃[キャラ]');
    expect(read.char.hasKeyword(s, 't#1', '突撃[キャラ]'), 'hasKeyword も true').toBe(true);
  });

  it('charRevokeKeyword verb (scope:turn) 経由でも同挙動', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('TOKKEKYA', 't#1')];
    runAtom(s, 'charRevokeKeyword', { uid: 't#1', kw: '突撃[キャラ]', scope: 'turn' }, makeCtx());
    expect(read.char.keywords(s, 't#1'), 'verb turn-revoke で消える').not.toContain('突撃[キャラ]');
  });

  it('default scope (permanent) は granted のみ splice — 印字キーワードは消えない', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('TOKKEKYA', 't#1')];
    runAtom(s, 'charRevokeKeyword', { uid: 't#1', kw: '突撃[キャラ]' }, makeCtx()); // scope 省略 = permanent
    expect(read.char.keywords(s, 't#1'), 'permanent(granted-splice) は印字を消さない').toContain('突撃[キャラ]');
  });

  it('granted キーワードは permanent revoke で除去できる (従来挙動の保持)', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('TOKKEKYA', 't#1', { keywordOverrides: { granted: ['迅速'], disabledOriginal: false } })];
    expect(read.char.keywords(s, 't#1')).toContain('迅速');
    runAtom(s, 'charRevokeKeyword', { uid: 't#1', kw: '迅速' }, makeCtx());
    expect(read.char.keywords(s, 't#1'), 'granted 迅速 は permanent revoke で除去').not.toContain('迅速');
  });

  it('behavior-invariant — revoke 未実施なら keywords 不変', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('TOKKEKYA', 't#1')];
    expect(read.char.keywords(s, 't#1')).toEqual(['突撃[キャラ]']);
  });
});
