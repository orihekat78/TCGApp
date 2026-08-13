// defer-unlock mini-wave (2026-07-09) — 手書き probe (gen:probes 非対応 shape 分)。
// 対象: PR132/PR201 (optional{chain[mill bind, conditional boundAny]} + 突撃 turn grant) /
//       B02076 a1 (chain[removeAreaToDeckTop dest:bottom pick, draw] の「そうした場合」gate) /
//       B02006 a1 (cutin conditional contactCharMatches byUid 代わりに排他) /
//       B02080 (cutin:used observer + matcherCondition queue-time gate =【ターン1】保全) /
//       B05072 (phase:main:start trigger + chain[discard, handAddFromRemove]) /
//       B07046 (continuous apDelta dyn $self.partnerAreaTraitCount)。
// 経路は production (event.emit → triggered listener → runAllUntilEmpty → drain picks)。
// rules: 09/10/13/15/17/22/24/26。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { cutIn } from '@/engine/flow/contact';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { _peekPendingEffectOptionalSide, _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read/index';
import { sceneChar } from '../../helpers/fixtures';
import { B02006 } from '@/cards/ct-p02/B02006';
import { B02076 } from '@/cards/ct-p02/B02076';
import { B02080 } from '@/cards/ct-p02/B02080';
import { B05072 } from '@/cards/ct-p05/B05072';
import { B07046 } from '@/cards/ct-p07/B07046';
import { PR132 } from '@/cards/pr-01/PR132';
import { PR201 } from '@/cards/pr-01/PR201';
import type { ActionContext, CardDef, GameState } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };
const ch = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 2, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const partnerDef = (id: string, color: string): CardDef => ({
  id, no: `9/${id}`, kind: 'partner', names: [id], colors: [color], level: 0, ap: 0, lp: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  resetDefRegistry();
});

// ============================================================
// PR132 / PR201 — 【登場時】optional mill3 (gate/bind) → boundAny → 突撃 turn grant
// ============================================================
describe('PR132 諸伏景光 — mill bind → boundAny(警察) → 突撃 (turn)', () => {
  function fire(deck: string[], remove: string[] = ['SEED']): GameState {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner.cardId = 'PY';
    s.players.self.scene = [sceneChar('PR132', 'hm0', { state: 'active' })];
    s.players.self.deck = deck;
    s.players.self.remove = remove;
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'hm0', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'PR132', uid: 'hm0' });
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true); // 「行う」
      for (let i = 0; i < 4; i++) { _drainAllEffectPicksForTest(d); runAllUntilEmpty(d); }
    });
    return s;
  }
  beforeEach(() => {
    registerCardDef(PR132); registerCardDef(partnerDef('PY', '黄'));
    registerCardDef(ch('KCHAR', { traits: ['警察'] })); registerCardDef(ch('NCHAR', { traits: ['探偵'] }));
    registerCardDef(ch('SEED')); registerCardDef(ch('EVK', { kind: 'event', traits: ['警察'] } as Partial<CardDef>));
    registerTriggeredListener();
  });
  it('3枚に[警察]キャラ含む → 突撃を持つ (turn scope)', () => {
    const s = fire(['NCHAR', 'KCHAR', 'NCHAR', 'SEED']);
    expect(s.players.self.deck, '3枚リムーブ').toEqual(['SEED']);
    expect(read.char.keywords(s, 'hm0'), '突撃 granted').toContain('突撃');
  });
  it('3枚に[警察]なし → 突撃なし', () => {
    const s = fire(['NCHAR', 'NCHAR', 'NCHAR', 'SEED']);
    expect(read.char.keywords(s, 'hm0')).not.toContain('突撃');
  });
  it('[警察]でも event は不一致 (kind:character gate)', () => {
    const s = fire(['EVK', 'NCHAR', 'NCHAR', 'SEED']);
    expect(read.char.keywords(s, 'hm0')).not.toContain('突撃');
  });
  it('デッキ2枚 (gate) → リムーブ0・突撃なし (公式QA: 行えない)', () => {
    const s = fire(['KCHAR', 'KCHAR']);
    expect(s.players.self.deck, 'gate: リムーブしない').toEqual(['KCHAR', 'KCHAR']);
    expect(read.char.keywords(s, 'hm0')).not.toContain('突撃');
  });
  it('optional 辞退 → mill されない', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner.cardId = 'PY';
    s.players.self.scene = [sceneChar('PR132', 'hm0', { state: 'active' })];
    s.players.self.deck = ['KCHAR', 'KCHAR', 'KCHAR'];
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'hm0', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'PR132', uid: 'hm0' });
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p).not.toBeNull();
      applyOptionalAndContinuation(d, p!, false); // 「行わない」
      runAllUntilEmpty(d);
    });
    expect(s.players.self.deck).toHaveLength(3);
    expect(read.char.keywords(s, 'hm0')).not.toContain('突撃');
  });
});

describe('PR201 鈴木次郎吉 — boundAny or[カード名[京極真], 特徴[鈴木財閥]]', () => {
  function fire(deck: string[]): GameState {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner.cardId = 'PW';
    s.players.self.scene = [sceneChar('PR201', 'jz0', { state: 'active' })];
    s.players.self.deck = deck;
    s.players.self.remove = ['SEED'];
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'jz0', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'PR201', uid: 'jz0' });
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true);
      for (let i = 0; i < 4; i++) { _drainAllEffectPicksForTest(d); runAllUntilEmpty(d); }
    });
    return s;
  }
  beforeEach(() => {
    registerCardDef(PR201); registerCardDef(partnerDef('PW', '白'));
    registerCardDef(ch('KYOGOKU', { names: ['京極真'] }));
    registerCardDef(ch('SUZUKI', { traits: ['鈴木財閥'] }));
    registerCardDef(ch('NCHAR', { traits: ['探偵'] }));
    registerCardDef(ch('SEED'));
    registerTriggeredListener();
  });
  it('カード名[京極真] hit → 突撃', () => {
    expect(read.char.keywords(fire(['KYOGOKU', 'NCHAR', 'NCHAR', 'SEED']), 'jz0')).toContain('突撃');
  });
  it('特徴[鈴木財閥] hit → 突撃', () => {
    expect(read.char.keywords(fire(['SUZUKI', 'NCHAR', 'NCHAR', 'SEED']), 'jz0')).toContain('突撃');
  });
  it('どちらも無し → 突撃なし', () => {
    expect(read.char.keywords(fire(['NCHAR', 'NCHAR', 'NCHAR', 'SEED']), 'jz0')).not.toContain('突撃');
  });
});

// ============================================================
// B02076 a1 — chain[removeAreaToDeckTop dest:bottom pick, draw] の「そうした場合」
// ============================================================
describe('B02076 大和敢助 a1 — [長野県警]をデッキの下へ → そうした場合 draw', () => {
  function fire(remove: string[], deck: string[]): GameState {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B02076', 'ym0', { state: 'active' })];
    s.players.self.remove = remove;
    s.players.self.deck = deck;
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'ym0', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'B02076', uid: 'ym0' });
      runAllUntilEmpty(d);
      for (let i = 0; i < 4; i++) { _drainAllEffectPicksForTest(d); runAllUntilEmpty(d); }
    });
    return s;
  }
  beforeEach(() => {
    registerCardDef(B02076);
    registerCardDef(ch('NAGANO', { traits: ['警察', '長野県警'] }));
    registerCardDef(ch('OTHERC', { traits: ['探偵'] }));
    registerCardDef(ch('X')); registerCardDef(ch('Y'));
    registerTriggeredListener();
  });
  it('候補あり → デッキの**下**へ移動 + draw 1 (上からでないこと = dest:bottom pin)', () => {
    const s = fire(['NAGANO', 'OTHERC'], ['X', 'Y']);
    // NAGANO が bottom へ → deck [X,Y,NAGANO] → draw で X が手札へ → deck [Y,NAGANO]
    expect(s.players.self.hand, 'draw 1 (=X)').toEqual(['X']);
    expect(s.players.self.deck, 'NAGANO は下 (top なら [Y] 終わり)').toEqual(['Y', 'NAGANO']);
    expect(s.players.self.remove, 'OTHERC は残る').toEqual(['OTHERC']);
  });
  it('候補 0 ([長野県警] 不在) → 移動なし・draw なし (そうした場合 gate)', () => {
    const s = fire(['OTHERC'], ['X', 'Y']);
    expect(s.players.self.hand, 'draw されない').toEqual([]);
    expect(s.players.self.deck).toEqual(['X', 'Y']);
    expect(s.players.self.remove).toEqual(['OTHERC']);
  });
});

// ============================================================
// B02006 a1 — cutin: Lv5以下[少年探偵団] に「代わりに」+3000 / それ以外 +1000
// ============================================================
describe('B02006 仮面ヤイバー a1 — contactCharMatches byUid 排他 conditional', () => {
  function mkAx(attackerUid: string, defUid: string): ActionContext {
    return {
      id: 'ax', byUid: attackerUid, byPlayer: 'self', target: { kind: 'char', uid: defUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: attackerUid, aAP: 2000, bUid: defUid, bAP: 3000 }, contactImmune: false,
    } as ActionContext;
  }
  function fire(ownCardId: string): { s: GameState; atk: string } {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar(ownCardId, 'atk0', { state: 'sleep' })];
    s.players.opp.scene = [sceneChar('OPPC', 'def0', { state: 'sleep' })];
    s.players.self.hand = ['B02006'];
    s = produce(s, (d) => {
      cutIn(d, mkAx('atk0', 'def0'), 'self', 'B02006');
      runAllUntilEmpty(d);
    });
    return { s, atk: 'atk0' };
  }
  beforeEach(() => {
    registerCardDef(B02006);
    registerCardDef(ch('SHONEN5', { traits: ['少年探偵団'], level: 5, ap: 2000 }));
    registerCardDef(ch('SHONEN6', { traits: ['少年探偵団'], level: 6, ap: 2000 }));
    registerCardDef(ch('KEISATSU', { traits: ['警察'], level: 3, ap: 2000 }));
    registerCardDef(ch('OPPC', { traits: ['少年探偵団'], level: 3, ap: 3000 }));
    registerTriggeredListener();
  });
  it('自コンタクトキャラ = Lv5 少年探偵団 → 代わりに +3000 (2000→5000)', () => {
    const { s, atk } = fire('SHONEN5');
    expect(read.char.ap(s, atk)).toBe(5000);
  });
  it('自コンタクトキャラ = Lv6 少年探偵団 (levelMax:5 外) → +1000 (2000→3000)', () => {
    const { s, atk } = fire('SHONEN6');
    expect(read.char.ap(s, atk)).toBe(3000);
  });
  it('自コンタクトキャラ = 警察 (trait 外、相手が少年探偵団でも) → +1000 (B02006 公式QA)', () => {
    // qa: card:B02006:f3ec718c14d9727f759ff72f61af57b75e6d7fb794305d5a7621e6be378d7584
    const { s, atk } = fire('KEISATSU');
    expect(read.char.ap(s, atk)).toBe(3000);
  });
});

// ============================================================
// B02080 — cutin:used observer + matcherCondition queue-time gate (【ターン1】保全)
// ============================================================
describe('B02080 三池苗子 — [警察]コンタクト中の自 cutin 使用 → そのキャラ AP+1000', () => {
  const CUT: CardDef = {
    id: 'CUT', no: '9/CUT', kind: 'event', names: ['CUT'], colors: [], level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
    abilities: [{
      id: 'cut', type: 'triggered', scope: 'on-hand',
      trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 500, scope: 'contact' } },
      description: 'カットイン AP+500', ruleRefs: [],
    }],
  };
  function mkAx(attackerUid: string, defUid: string): ActionContext {
    return {
      id: 'ax', byUid: attackerUid, byPlayer: 'self', target: { kind: 'char', uid: defUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: attackerUid, aAP: 2000, bUid: defUid, bAP: 3000 }, contactImmune: false,
    } as ActionContext;
  }
  function fire(ownCardId: string): GameState {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar(ownCardId, 'atk0', { state: 'sleep' }), sceneChar('B02080', 'obs0', { state: 'active' })];
    s.players.opp.scene = [sceneChar('OPPC', 'def0', { state: 'sleep' })];
    s.players.self.hand = ['CUT'];
    s = produce(s, (d) => {
      cutIn(d, mkAx('atk0', 'def0'), 'self', 'CUT');
      runAllUntilEmpty(d);
    });
    return s;
  }
  beforeEach(() => {
    registerCardDef(B02080); registerCardDef(CUT);
    registerCardDef(ch('KEISATSU', { traits: ['警察'], ap: 2000 }));
    registerCardDef(ch('TANTEI', { traits: ['探偵'], ap: 2000 }));
    registerCardDef(ch('OPPC', { traits: ['警察'], ap: 3000 }));
    registerTriggeredListener();
  });
  it('自コンタクトキャラ[警察] + 自分が cutin → そのキャラ +1000 (cutin 分 +500 と合算 3500)', () => {
    const s = fire('KEISATSU');
    expect(read.char.ap(s, 'atk0')).toBe(3500); // 2000 + 500 (cutin) + 1000 (B02080)
  });
  it('自コンタクトキャラ非[警察] (相手が警察でも) → queue されず +500 のみ =【ターン1】未消費 (rules/24)', () => {
    const s = fire('TANTEI');
    expect(read.char.ap(s, 'atk0')).toBe(2500); // cutin 分のみ
    expect(s.pendingEffects.some(pe => pe.source?.cardId === 'B02080'), 'B02080 は queue されない').toBe(false);
  });
});

// ============================================================
// B05072 — phase:main:start + chain[discard max1, handAddFromRemove 赤井秀一/ライ]
// ============================================================
describe('B05072 沖矢昴 — メインフェイズ開始時 discard → 赤井秀一/ライ 回収', () => {
  function fire(hand: string[], remove: string[], player: 'self' | 'opp' = 'self'): GameState {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player, phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B05072', 'ok0', { state: 'active' })];
    s.players.self.hand = hand;
    s.players.self.remove = remove;
    s = produce(s, (d) => {
      event.emit(d, 'phase:main:start', { player }, undefined);
      runAllUntilEmpty(d);
      for (let i = 0; i < 4; i++) { _drainAllEffectPicksForTest(d); runAllUntilEmpty(d); }
    });
    return s;
  }
  beforeEach(() => {
    registerCardDef(B05072);
    registerCardDef(ch('AKAI', { names: ['赤井秀一'] }));
    registerCardDef(ch('FODDER'));
    registerTriggeredListener();
  });
  it('自ターン: 手札1枚リムーブ → リムーブの[赤井秀一]を手札に', () => {
    const s = fire(['FODDER'], ['AKAI']);
    expect(s.players.self.hand, '赤井秀一 回収').toEqual(['AKAI']);
    expect(s.players.self.remove).toContain('FODDER');
    expect(s.players.self.remove).not.toContain('AKAI');
  });
  it('相手ターンの main:start → 発動しない (triggerPlayerIs gate)', () => {
    const s = fire(['FODDER'], ['AKAI'], 'opp');
    expect(s.players.self.hand).toEqual(['FODDER']);
    expect(s.players.self.remove).toEqual(['AKAI']);
  });
});

// ============================================================
// B07046 — continuous apDelta dyn $self.partnerAreaTraitCount
// ============================================================
describe('B07046 ドロン刑事 — PA ビッグジュエル ×1000 AP aura (【自分ターン中】)', () => {
  beforeEach(() => {
    registerCardDef(B07046);
    registerCardDef(ch('JEWEL', { kind: 'event', traits: ['ビッグジュエル'] } as Partial<CardDef>));
    registerCardDef(ch('OTHERCARD'));
    registerTriggeredListener();
  });
  function board(paCards: string[], turnPlayer: 'self' | 'opp'): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B07046', 'dr0', { state: 'active' })];
    s.players.self.partnerAreaCards = paCards;
    return s;
  }
  it('自ターン + jewel 2枚 → AP 5000+2000', () => {
    expect(read.char.ap(board(['JEWEL', 'JEWEL'], 'self'), 'dr0')).toBe(7000);
  });
  it('非 jewel は数えない', () => {
    expect(read.char.ap(board(['JEWEL', 'OTHERCARD'], 'self'), 'dr0')).toBe(6000);
  });
  it('相手ターン → aura 無効 (5000)', () => {
    expect(read.char.ap(board(['JEWEL', 'JEWEL'], 'opp'), 'dr0')).toBe(5000);
  });
  it('keywords: 突撃[キャラ] 印字', () => {
    expect(B07046.keywords).toEqual(['突撃[キャラ]']);
  });
});
