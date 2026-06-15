// cluster13 — aura-grant (他キャラへの AP buff aura) の挙動テスト。
// engine拡張 wave#2 cluster13 (2026-06-15): continuousModifier.apDeltaAura/lpDeltaAura + auraFilter + auraExcludeSelf。
// read.char.auraDelta が board-scan で同一 side 現場の bearer から集計し、ap()/lp() + candidates.matchOneFilter
// (auraDeltaSafe, 再帰 guard) に合算する。
//
// 検証 (非MVP のため smoke では踏めない = 専用テスト必須):
//   §1 aura が他キャラ (filter 一致) を +1000 / 非一致は不変 (color / trait filter)。
//   §2 auraExcludeSelf — bearer 自身は buff されない / include-self は buff される (synthetic)。
//   §3 【自分ターン中】 gate — 相手ターンでは aura 不発。
//   §4 filter-AP 一致 (BUG-117 原則) — matchOneFilter(apMax) が aura 込み AP を見る。
//   §5 B02012 levelMax:5 は 有効値 (turnEffects 反映レベル) で判定。
//   §6 PR274 conditional aura — case 非青色のときのみ発火。
//   §7 構造 — 11 printings 登録 + secondary ability 形。
// rules: 15, 17 §【自分ターン中】, 19 (下限なし), 24 §常時有効型

import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry, def } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { read } from '@/engine/read/index';
import { matchOneFilter } from '@/engine/target/candidates';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef, EffectCtx, GameState, Candidate } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// synthetic self-buff bearer (include-self) — auraFilter が自身に一致 + auraExcludeSelf なし
const SELFBUFF: CardDef = {
  id: 'SELFBUFF', no: '9/SELFBUFF', kind: 'character', names: ['SELFBUFF'], colors: ['桃'], level: 3, ap: 2000, lp: 1, traits: ['自己強化'], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'turn', player: 'self' }, continuousModifier: { apDeltaAura: 1000, auraFilter: { trait: '自己強化', kind: 'character' } }, description: 'self-buff aura (include-self)', ruleRefs: [] }],
  ruleRefs: [],
};

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll(); // cluster13 cards (D05005/B02012/B09009/PR274/...) 込み
  registerCardDef(ch('Y4', { colors: ['黄'], level: 4, ap: 3000 }));
  registerCardDef(ch('R4', { colors: ['赤'], level: 4, ap: 3000 }));
  registerCardDef(ch('B5', { colors: ['青'], level: 5, ap: 3000 }));
  registerCardDef(ch('B6', { colors: ['青'], level: 6, ap: 3000 }));
  registerCardDef(ch('MAGI', { colors: ['白'], level: 4, ap: 3000, traits: ['マジシャン'] }));
  registerCardDef(ch('SOCCER', { colors: ['青'], level: 4, ap: 3000, traits: ['サッカー選手'] }));
  registerCardDef(SELFBUFF);
  registerTriggeredListener();
});

function turn(s: GameState, player: 'self' | 'opp'): void {
  s.turn = { number: 5, player, phase: 'main', isFirstPlayerFirstTurn: false };
}

describe('cluster13 §1 — aura が他キャラ (filter 一致) を +1000', () => {
  it('D05005 (黄 aura): 黄 char +1000 / 赤 char 不変', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('D05005', 'kuroda#1'), sceneChar('Y4', 'y#1'), sceneChar('R4', 'r#1')];
    expect(read.char.ap(s, 'y#1'), '黄Lv4 (base3000) は黄auraで+1000').toBe(4000);
    expect(read.char.ap(s, 'r#1'), '赤Lv4 は黄auraの対象外 (不変)').toBe(3000);
  });

  it('B07044 (マジシャン trait aura): マジシャン char +1000 / 非マジシャン 不変', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('B07044', 'jodi#1'), sceneChar('MAGI', 'm#1'), sceneChar('R4', 'r#1')];
    expect(read.char.ap(s, 'm#1'), 'マジシャン char +1000').toBe(4000);
    expect(read.char.ap(s, 'r#1'), '非マジシャン 不変').toBe(3000);
  });
});

describe('cluster13 §2 — auraExcludeSelf / include-self', () => {
  it('D05005 (excludeSelf, 黄): bearer 自身 (黄) は buff されない', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('D05005', 'kuroda#1')]; // D05005 は黄だが「このキャラ以外」
    expect(read.char.ap(s, 'kuroda#1'), 'excludeSelf: 黒田自身は黄auraで buff されない (base6000)').toBe(6000);
  });

  it('SELFBUFF (include-self, 自己強化 trait): bearer 自身を +1000', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('SELFBUFF', 'sb#1')];
    expect(read.char.ap(s, 'sb#1'), 'include-self: 自身 (base2000) を +1000').toBe(3000);
  });
});

describe('cluster13 §3 — 【自分ターン中】 gate', () => {
  it('相手ターンでは D05005 の aura は不発', () => {
    const s = createEmptyGameState();
    turn(s, 'opp'); // 相手ターン
    s.players.self.scene = [sceneChar('D05005', 'kuroda#1'), sceneChar('Y4', 'y#1')];
    expect(read.char.ap(s, 'y#1'), '相手ターンでは黄aura不発 (base3000)').toBe(3000);
  });
});

describe('cluster13 §4 — filter-AP 一致 (BUG-117 原則: matchOneFilter が aura 込み AP を見る)', () => {
  it('aura 込みで AP4000 の黄charは apMax:3500 filter に一致しない (aura 未反映なら誤って一致)', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('D05005', 'kuroda#1'), sceneChar('Y4', 'y#1')];
    const y = s.players.self.scene.find(c => c.uid === 'y#1')!;
    const cand = { kind: 'char', uid: 'y#1', cardId: 'Y4', player: 'self' } as Candidate;
    // base3000 + aura1000 = 4000 > 3500 → filter 不一致 (aura が matchOneFilter に反映されている証跡)
    expect(matchOneFilter(s, 'Y4', { apMax: 3500 }, y, cand), 'aura込み4000 は apMax3500 に不一致').toBe(false);
    expect(matchOneFilter(s, 'Y4', { apMax: 4000 }, y, cand), 'aura込み4000 は apMax4000 に一致 (境界)').toBe(true);
  });
});

describe('cluster13 §5 — B02012 levelMax:5 は 有効値 (turnEffects 反映)', () => {
  it('青Lv5 は +1000 / 青Lv6 は対象外 / lvlMod で Lv6→4 になった青は +1000', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('B02012', 'mouri#1'), sceneChar('B5', 'b5#1'), sceneChar('B6', 'b6#1')];
    expect(read.char.ap(s, 'b5#1'), '青Lv5 ≤5 → +1000').toBe(4000);
    expect(read.char.ap(s, 'b6#1'), '青Lv6 >5 → 不変').toBe(3000);
    // 青Lv6 に lvlMod_turn -2 → 有効レベル4 → 対象に入る (有効値判定の証跡)
    const b6 = s.players.self.scene.find(c => c.uid === 'b6#1')!;
    b6.turnEffects['lvlMod_turn'] = -2;
    expect(read.char.ap(s, 'b6#1'), 'Lv6-2=4 → levelMax5 対象に入り +1000').toBe(4000);
  });
});

describe('cluster13 §6 — PR274 conditional aura (case 非青色のとき)', () => {
  function setCase(s: GameState, colors: string[]): void {
    s.players.self.case = { cardId: 'CASE', status: '事件編', requiredEvidence: 7, colors, declaredUseCount: {} } as GameState['players']['self']['case'];
    registerCardDef({ id: 'CASE', no: '9/CASE', kind: 'case', names: ['CASE'], colors, level: 7, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef);
  }
  it('case が【青】のみ → aura 不発 / case が青+赤 → 発火', () => {
    const sBlue = createEmptyGameState();
    turn(sBlue, 'self');
    setCase(sBlue, ['青']);
    sBlue.players.self.scene = [sceneChar('PR274', 'shin#1'), sceneChar('B5', 'b5#1')];
    expect(read.char.ap(sBlue, 'b5#1'), 'case青のみ → PR274 aura 不発 (base3000)').toBe(3000);

    const sMix = createEmptyGameState();
    turn(sMix, 'self');
    setCase(sMix, ['青', '赤']);
    sMix.players.self.scene = [sceneChar('PR274', 'shin#1'), sceneChar('B5', 'b5#1')];
    expect(read.char.ap(sMix, 'b5#1'), 'case青+赤 (非青色を持つ) → aura +1000').toBe(4000);
  });
});

describe('cluster13 §7 — 構造 (11 printings + secondary ability 形)', () => {
  it('11 printings 登録 + a1 = continuous aura', () => {
    const ids = ['D05005', 'D07010', 'D07011', 'B01038', 'B01038P', 'B02012', 'B03075', 'B07044', 'B09009', 'PR274', 'PR275'];
    for (const id of ids) {
      const d = def.card(id);
      expect(d, `${id} 登録済`).toBeTruthy();
      const a1 = d!.abilities.find(a => a.id === 'a1')!;
      expect(a1.type, `${id} a1 continuous`).toBe('continuous');
      expect(typeof a1.continuousModifier?.apDeltaAura, `${id} apDeltaAura`).toBe('number');
    }
    // secondary abilities
    expect(def.card('B02012')!.abilities.find(a => a.id === 'a2')!.trigger?.hook).toBe('action:declare');
    expect(def.card('B09009')!.abilities.find(a => a.id === 'a2')!.trigger?.hook).toBe('evidence:remove-by-action');
    expect(def.card('PR274')!.abilities.find(a => a.id === 'a2')!.type).toBe('declared');
  });
});
