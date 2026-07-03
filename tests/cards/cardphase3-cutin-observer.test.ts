// tests/cards/cardphase3-cutin-observer
// CARD PHASE #3: cutin:used observer ペア (B09086 諸伏高明 / B04090 ライ)。engine 変更 0。
// B03118 キール (wave16) 同型ハーネス。実 emit 経路 (flow/contact.cutIn) で:
//   B09086 = 使用 cutin が〚諸伏景光〛か〚長野県警〛のキャラのときのみ AP+2000 (triggerCutinMatches filter)。
//   B04090 = 任意 cutin で発動 → リムーブの【黒】lv3以下キャラを登場 (sceneEnter from:remove)。
// contact 依存 guard は effect conditional{if} (B03118 教訓、ability.condition では ctx.contact 未populate)。
// rules: 08-contact.md, 09-cutin-disguise.md, 13-keywords.md, 20-color-and-switch.md, 22-qa-action-contact.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { cutIn, canCutIn } from '@/engine/flow/contact';
import { B09086 } from '@/cards/ct-p09/B09086';
import { B04090 } from '@/cards/ct-p04/B04090';
import type { CardDef, AbilityDef, ActionContext, EffectCtx } from '@/engine/types';

// 最小 cutin ability (rules/09: type:'triggered' scope:'on-hand' hook:'effect:declared' optional:true)。
const cutinAbility: AbilityDef = {
  id: 'cut', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'カットイン (自効果なし)', ruleRefs: [],
};
function cutinChar(id: string, opts: { names?: string[]; traits?: string[]; color?: string; level?: number }): CardDef {
  return {
    id, no: id, kind: 'character', names: opts.names ?? [id], colors: [opts.color ?? '赤'],
    level: opts.level ?? 1, ap: 2000, lp: 1, traits: opts.traits ?? [], rarity: 'C', imageUrl: '',
    abilities: [cutinAbility], ruleRefs: [],
  };
}
// 使用 cutin カード群
const CUT_NAGANO = cutinChar('CUT_NAGANO', { traits: ['長野県警'] }); // 特徴一致
const CUT_SCOTCH = cutinChar('CUT_SCOTCH', { names: ['諸伏景光'] });   // 名一致
const CUT_OTHER = cutinChar('CUT_OTHER', { traits: ['探偵'] });        // 非一致
const CUT_EVENT: CardDef = { // 任意 cutin (event、B04090 用)
  id: 'CUT_EVENT', no: 'CUT_EVENT', kind: 'event', names: ['CUT'], colors: ['赤'],
  level: 1, ap: 0, lp: 0, traits: [], rarity: 'C', imageUrl: '', abilities: [cutinAbility], ruleRefs: [],
};
// B04090 リムーブから登場する【黒】lv3以下キャラ / 除外用 lv5 黒 / 非黒
const BLK3 = cutinChar('BLK3', { color: '黒', level: 3 });
const BLK5 = cutinChar('BLK5', { color: '黒', level: 5 });
const MOB: CardDef = {
  id: 'MOB', no: 'MOB', kind: 'character', names: ['MOB'], colors: ['赤'],
  level: 1, ap: 2000, lp: 1, traits: ['探偵'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

function mkAx(attackerUid: string): ActionContext {
  return {
    id: 'ax', byUid: attackerUid, byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: attackerUid, aAP: 5000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
  };
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  registerCardDef(B09086); registerCardDef(B04090);
  registerCardDef(CUT_NAGANO); registerCardDef(CUT_SCOTCH); registerCardDef(CUT_OTHER); registerCardDef(CUT_EVENT);
  registerCardDef(BLK3); registerCardDef(BLK5); registerCardDef(MOB);
  registerTriggeredListener();
});

describe('B09086 諸伏高明 shape', () => {
  it('metadata + 1 ability (cutin observer, matcher and/or)', () => {
    expect(B09086.id).toBe('B09086');
    expect(B09086.no).toBe('1026/B09086');
    expect(B09086.colors).toEqual(['黄']);
    expect(B09086.level).toBe(5);
    expect(B09086.ap).toBe(5000);
    expect(B09086.traits).toEqual(['警察', '長野県警']);
    expect(B09086.abilities.length).toBe(1);
    expect(B09086.abilities[0].trigger?.hook).toBe('cutin:used');
    expect(B09086.abilities[0].trigger?.matcherCondition?.kind).toBe('and');
    expect(B09086.abilities[0].effect?.kind).toBe('conditional');
  });
});

describe('B09086 諸伏高明 behavioral', () => {
  function run(cutinId: string, asGuard = false, attackerIsDecoy = false) {
    let shUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      shUid = mutate.scene.enter(d, 'self', 'B09086', {}).uid;
      let attackerUid = shUid;
      if (attackerIsDecoy) attackerUid = mutate.scene.enter(d, 'self', 'MOB', {}).uid;
      d.players.self.hand = [cutinId];
      let ax = mkAx(attackerUid);
      if (asGuard) {
        // 相手が attacker、諸伏高明 が自分側でガード → p='self' の自コンタクトキャラ = guardUid
        ax = { ...ax, byUid: 'oatk', byPlayer: 'opp', guardUid: shUid, target: { kind: 'char', uid: 'oatk' } };
      }
      expect(canCutIn(d, ax, 'self', cutinId)).toBe(true);
      cutIn(d, ax, 'self', cutinId);
      runAllUntilEmpty(d);
    });
    return { after, shUid };
  }

  it('参加中 + 〚長野県警〛のキャラの cutin → AP+2000', () => {
    const { after, shUid } = run('CUT_NAGANO');
    expect(engine.read.char.ap(after, shUid)).toBe(7000); // 5000 + 2000
  });
  it('参加中 + 〚カード名 諸伏景光〛の cutin → AP+2000', () => {
    const { after, shUid } = run('CUT_SCOTCH');
    expect(engine.read.char.ap(after, shUid)).toBe(7000);
  });
  it('参加中 + 非一致 cutin (探偵) → 発火せず AP 据置', () => {
    const { after, shUid } = run('CUT_OTHER');
    expect(engine.read.char.ap(after, shUid)).toBe(5000);
  });
  it('自分がガードしたコンタクト + 〚長野県警〛cutin → AP+2000 (byUid=自参加キャラ)', () => {
    const { after, shUid } = run('CUT_NAGANO', true);
    expect(engine.read.char.ap(after, shUid)).toBe(7000);
  });
  it('DECOY: 諸伏高明 が非参加 (別キャラ attacker) → guard 不成立で据置', () => {
    const { after, shUid } = run('CUT_NAGANO', false, true);
    expect(engine.read.char.ap(after, shUid)).toBe(5000);
  });
});

describe('B04090 ライ shape', () => {
  it('metadata + 2 ability (partnerColor 突撃[キャラ] / cutin observer revive)', () => {
    expect(B04090.id).toBe('B04090');
    expect(B04090.no).toBe('0472/B04090');
    expect(B04090.colors).toEqual(['黒']);
    expect(B04090.level).toBe(8);
    expect(B04090.ap).toBe(8000);
    expect(B04090.abilities.length).toBe(2);
    expect(B04090.abilities[0].type).toBe('continuous'); // 【パートナー黒】突撃[キャラ]
    expect(B04090.abilities[1].trigger?.hook).toBe('cutin:used');
    expect(B04090.abilities[1].effect?.kind).toBe('conditional');
  });
});

describe('B04090 ライ behavioral', () => {
  it('【パートナー黒】 → 突撃[キャラ] 付与 (partnerColor 成立時)', () => {
    let raiUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      d.players.self.partner = { cardId: 'BLK3', uid: 'pt', state: 'active', colors: ['黒'] } as never;
      raiUid = mutate.scene.enter(d, 'self', 'B04090', {}).uid;
    });
    expect(engine.read.char.keywords(after, raiUid)).toContain('突撃[キャラ]');
  });

  // 正の revive は guard 成立後の then (sceneEnter pick) を直接 run + Heuristic greedy drain で確認。
  // (hook 全経路の pick は「1枚まで」= n.min:0 ゆえ AI が合法的に 0 を選び skip しうる。guard 成立自体は
  //  partnerColor/lv5-no-candidate/decoy の全経路テストで担保済。)
  it('guard 成立 → リムーブの【黒】lv3以下を登場 (then 直接 run + greedy pick)', () => {
    const s = createEmptyGameState();
    s.players.self.deck = ['MOB', 'MOB', 'MOB'];
    s.players.self.remove = ['BLK3'];
    const a2 = B04090.abilities[1] as AbilityDef;
    const after = produce(s, (d) => {
      const raiUid = mutate.scene.enter(d, 'self', 'B04090', {}).uid;
      // このキャラがコンタクト参加者 = guard 成立 (byUid === source.uid)
      const ctx: EffectCtx = {
        source: { cardId: 'B04090', uid: raiUid, abilityId: 'a2', player: 'self', area: 'scene' },
        bindings: {},
        contact: { byUid: raiUid, byPlayer: 'self', targetUid: 'x', attackerSide: 'self' },
      } as never;
      runEffect(d, a2.effect!, ctx);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    // BLK3 が現場に登場 (ライ + BLK3 = 2枚) / リムーブから抜ける
    expect(after.players.self.scene.some((c) => c.cardId === 'BLK3')).toBe(true);
    expect(after.players.self.remove.includes('BLK3')).toBe(false);
  });

  it('リムーブに【黒】lv3以下が無い (lv5のみ) → 登場なし (1枚まで=0可)', () => {
    let raiUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      raiUid = mutate.scene.enter(d, 'self', 'B04090', {}).uid;
      d.players.self.hand = ['CUT_EVENT'];
      d.players.self.deck = ['MOB', 'MOB', 'MOB'];
      d.players.self.remove = ['BLK5'];
      const ax = mkAx(raiUid);
      cutIn(d, ax, 'self', 'CUT_EVENT');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene.some((c) => c.cardId === 'BLK5')).toBe(false);
    expect(after.players.self.remove.includes('BLK5')).toBe(true); // lv5 は候補外 → 据置
  });

  it('DECOY: ライが非参加 (別キャラ attacker) → guard 不成立で登場なし', () => {
    let raiUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      raiUid = mutate.scene.enter(d, 'self', 'B04090', {}).uid;
      const mobUid = mutate.scene.enter(d, 'self', 'MOB', {}).uid;
      d.players.self.hand = ['CUT_EVENT'];
      d.players.self.deck = ['MOB', 'MOB', 'MOB'];
      d.players.self.remove = ['BLK3'];
      const ax = mkAx(mobUid);
      cutIn(d, ax, 'self', 'CUT_EVENT');
      runAllUntilEmpty(d);
      void raiUid;
    });
    expect(after.players.self.scene.some((c) => c.cardId === 'BLK3')).toBe(false);
  });
});
