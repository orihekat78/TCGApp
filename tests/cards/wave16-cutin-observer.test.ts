// tests/cards/wave16-cutin-observer
// wave16 card-authoring: cutin:used observer 初 consumer (B03118 キール)。
// engine 変更 0 — 既存 cutin:used hook + $contact.byUid (BUG-104 entryToCtx) + charModifyAP scope:contact。
// 実機 emit 経路 (flow/contact.cutIn) で AP+1000 が正しい参加者に載るかを検証 (wave3-observer 同型ハーネス)。
//
// ★設計注記: contact 依存 guard は effect の conditional{if} に置く (D11013 同型)。handleHook の
//   condition-eval ctx は .contact 未設定 (triggered.ts:300) のため ability.condition では読めない。
//   ctx.contact は queue 後 runtime ctx (entryToCtx) でのみ populate される。
// rules: 08-contact.md, 09-cutin-disguise.md, 22-qa-action-contact.md

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
import { B03118 } from '@/cards/ct-p03/B03118';
import type { CardDef, ActionContext } from '@/engine/types';

// 最小 cutin カード (rules/09: type:'triggered' scope:'on-hand' trigger effect:declared)。自効果 no-op。
const CUT: CardDef = {
  id: 'CUT', no: 'CUT', kind: 'event', names: ['CUT'], colors: ['赤'],
  level: 1, ap: 0, lp: 0, traits: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'cut', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: 'カットイン (自効果なし)', ruleRefs: [],
  }],
};
// 傍観キャラ (decoy 用、非参加者)
const MOB: CardDef = {
  id: 'MOB', no: 'MOB', kind: 'character', names: ['MOB'], colors: ['赤'],
  level: 1, ap: 2000, lp: 1, traits: ['探偵'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

function mkAx(attackerUid: string): ActionContext {
  return {
    id: 'ax', byUid: attackerUid, byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: attackerUid, aAP: 3000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
  };
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  registerCardDef(B03118); registerCardDef(CUT); registerCardDef(MOB);
  registerTriggeredListener();
});

describe('B03118 キール shape', () => {
  it('id/level/ap/lp/色/特徴 + 2 ability (cutin observer + hirameki)', () => {
    expect(B03118.id).toBe('B03118');
    expect(B03118.no).toBe('0367/B03118');
    expect(B03118.colors).toEqual(['黒']);
    expect(B03118.level).toBe(3);
    expect(B03118.ap).toBe(3000);
    expect(B03118.traits).toEqual(['黒ずくめの組織']);
    expect(B03118.abilities.length).toBe(2);
    expect(B03118.abilities[0].trigger?.hook).toBe('cutin:used');
    expect(B03118.abilities[0].effect?.kind).toBe('conditional');
    expect(B03118.abilities[1].trigger?.hook).toBe('evidence:remove-by-action');
  });
});

describe('B03118 キール behavioral', () => {
  it('キール自身がコンタクト参加中に自 cutin → キール AP+1000', () => {
    let keUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      keUid = mutate.scene.enter(d, 'self', 'B03118', {}).uid;
      d.players.self.hand = ['CUT'];
      const ax = mkAx(keUid); // キール = attacker = 参加者
      expect(canCutIn(d, ax, 'self', 'CUT')).toBe(true);
      cutIn(d, ax, 'self', 'CUT');
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, keUid)).toBe(4000); // 3000 + 1000(contact)
  });

  it('キールが参加者でない (別キャラが attacker) → guard 不成立 → AP 据置', () => {
    let keUid = '';
    let mobUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      keUid = mutate.scene.enter(d, 'self', 'B03118', {}).uid;
      mobUid = mutate.scene.enter(d, 'self', 'MOB', {}).uid;
      d.players.self.hand = ['CUT'];
      const ax = mkAx(mobUid); // MOB = attacker、キールは傍観
      cutIn(d, ax, 'self', 'CUT');
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, keUid)).toBe(3000); // 据置
    expect(engine.read.char.ap(after, mobUid)).toBe(2000); // MOB も影響なし (byUid=MOB だが guard 不成立)
  });

  it('相手が cutin → 自側 observer 非発火 (side:self)', () => {
    let keUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      keUid = mutate.scene.enter(d, 'self', 'B03118', {}).uid;
      d.players.opp.hand = ['CUT'];
      const ax: ActionContext = { ...mkAx('oatk'), byUid: 'oatk', byPlayer: 'opp', target: { kind: 'char', uid: keUid } };
      cutIn(d, ax, 'opp', 'CUT');
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, keUid)).toBe(3000);
  });
});
