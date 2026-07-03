// tests/cards/wave17-b08086-tequila
// wave17 card-authoring: B08086 テキーラ (engine変更0)。
//   a1 = 継続 AP aura: 相手現場キャラ1枚につき AP+2000 (【パートナー黒】【自分ターン中】gate)。
//        $self.oppSceneCount dyn (dyn/eval.test.ts:210 で *2000=4000 実証済) を continuous apDelta で消費。
//   a2 = 自身の【カットイン】(D11013 型): [黒]相手に cutin する場合 $contact.byUid AP+2000 (【自分ターン中】)。
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md

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
import { cutIn, canCutIn } from '@/engine/flow/contact';
import { B08086 } from '@/cards/ct-p08/B08086';
import type { CardDef, ActionContext } from '@/engine/types';

function partner(id: string, color: string): CardDef {
  return { id, no: `9/${id}`, kind: 'partner', names: [id], colors: [color], level: 0, ap: 0, lp: 2, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
function charDef(id: string, colors: string[], ap = 2000): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors, level: 1, ap, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const PB = partner('PB', '黒');
const PBLUE = partner('PBLUE', '青');
const MOB = charDef('MOB', ['赤']);       // 汎用 (opp scene 埋め / self attacker)
const KURO = charDef('KURO', ['黒']);     // cutin 相手=黒
const AKA = charDef('AKA', ['赤']);       // cutin 相手=非黒 decoy

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  registerCardDef(B08086); registerCardDef(PB); registerCardDef(PBLUE);
  registerCardDef(MOB); registerCardDef(KURO); registerCardDef(AKA);
  registerTriggeredListener();
});

describe('B08086 テキーラ shape', () => {
  it('黒/Lv5/AP0/LP0/黒ずくめ + 2 ability (continuous aura + cutin)', () => {
    expect(B08086.id).toBe('B08086');
    expect(B08086.no).toBe('0922/B08086');
    expect(B08086.colors).toEqual(['黒']);
    expect(B08086.ap).toBe(0);
    expect(B08086.lp).toBe(0);
    expect(B08086.traits).toEqual(['黒ずくめの組織']);
    expect(B08086.abilities[0].type).toBe('continuous');
    expect(B08086.abilities[1].trigger?.hook).toBe('effect:declared');
  });
});

describe('B08086 a1 継続 AP aura (oppSceneCount * 2000)', () => {
  it('partner黒 + 自分ターン + opp 2枚 → AP = 0 + 2*2000 = 4000', () => {
    let tqUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      d.players.self.partner.cardId = 'PB';
      tqUid = mutate.scene.enter(d, 'self', 'B08086', {}).uid;
      mutate.scene.enter(d, 'opp', 'MOB', {});
      mutate.scene.enter(d, 'opp', 'KURO', {});
    });
    expect(engine.read.char.ap(after, tqUid)).toBe(4000);
  });

  it('opp 0枚 → AP = 0 (aura 発火するが係数0)', () => {
    let tqUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      d.players.self.partner.cardId = 'PB';
      tqUid = mutate.scene.enter(d, 'self', 'B08086', {}).uid;
    });
    expect(engine.read.char.ap(after, tqUid)).toBe(0);
  });

  it('DECOY partner青 → partnerColor gate 未充足 → AP 据置 (0)', () => {
    let tqUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      d.players.self.partner.cardId = 'PBLUE';
      tqUid = mutate.scene.enter(d, 'self', 'B08086', {}).uid;
      mutate.scene.enter(d, 'opp', 'MOB', {});
      mutate.scene.enter(d, 'opp', 'KURO', {});
    });
    expect(engine.read.char.ap(after, tqUid)).toBe(0);
  });

  it('DECOY 相手ターン → turn gate 未充足 → AP 据置 (0)', () => {
    let tqUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.players.self.partner.cardId = 'PB';
      tqUid = mutate.scene.enter(d, 'self', 'B08086', {}).uid;
      mutate.scene.enter(d, 'opp', 'MOB', {});
    });
    expect(engine.read.char.ap(after, tqUid)).toBe(0);
  });
});

describe('B08086 a2 【カットイン】([黒]相手に cutin → $contact.byUid AP+2000)', () => {
  function mkAx(attackerUid: string, defUid: string): ActionContext {
    return {
      id: 'ax', byUid: attackerUid, byPlayer: 'self', target: { kind: 'char', uid: defUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: attackerUid, aAP: 2000, bUid: defUid, bAP: 3000 }, contactImmune: false,
    };
  }

  it('コンタクト相手が[黒] → 自 attacker AP+2000', () => {
    let atk = '';
    let def = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      atk = mutate.scene.enter(d, 'self', 'MOB', {}).uid;
      def = mutate.scene.enter(d, 'opp', 'KURO', {}).uid;
      d.players.self.hand = ['B08086'];
      const ax = mkAx(atk, def);
      expect(canCutIn(d, ax, 'self', 'B08086')).toBe(true);
      cutIn(d, ax, 'self', 'B08086');
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, atk)).toBe(4000); // 2000 + 2000
  });

  it('DECOY コンタクト相手が非[黒] → conditional 不成立 → AP 据置', () => {
    let atk = '';
    let def = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      atk = mutate.scene.enter(d, 'self', 'MOB', {}).uid;
      def = mutate.scene.enter(d, 'opp', 'AKA', {}).uid;
      d.players.self.hand = ['B08086'];
      const ax = mkAx(atk, def);
      cutIn(d, ax, 'self', 'B08086');
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, atk)).toBe(2000); // 据置
  });
});
