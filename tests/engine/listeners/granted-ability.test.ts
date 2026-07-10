// Task D E4 (2026-06-12): charGrantAbility — triggered ability の動的付与
//
// 「そのキャラに『このキャラがアクションしたとき、カードを1枚引く。』を与える」(B02014) 等。
// granted ability は turnEffects.grantedAbilities[] に JSON descriptor で積まれ、
// triggered.ts handleHook が def.abilities と合算して走査する。清掃は clearTurnEffects 'turn'。
//
// rules: 15 (付与元が離場しても効果は有効 / 解決順), 19 (元の能力無効は付与に及ばない)
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { runAtom } from '@/engine/effect/atom-handlers';
import { runAllUntilEmpty } from '@/engine/resolve';
import { validate } from '@/engine/effect/validate';
import { evalCond } from '@/engine/cond/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState, SceneCharacter, CardDef, EffectCtx, Effect } from '@/engine/types';
import { makeCtx as baseCtx, sceneChar as baseScene } from '../../helpers/fixtures';

function sceneChar(cardId: string, uid: string): SceneCharacter {
  return baseScene(cardId, uid, { apOverride: 5000 });
}

function defOf(id: string): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 5000, lp: 1,
    traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as CardDef;
}

function makeCtx(overrides: Partial<EffectCtx> = {}): EffectCtx {
  return baseCtx({ source: { player: 'self', area: 'scene', cardId: 'SRC', abilityId: 'a1' }, ...overrides } as Partial<EffectCtx>);
}

const GRANT_DRAW_ON_ACTION = {
  trigger: { hook: 'action:declare', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

describe('charGrantAbility (Task D E4)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerTriggeredListener();
  });

  it('付与された triggered ability が hook で発火する (B02014「アクションしたとき1ドロー」)', () => {
    registerCardDef(defOf('TGT'));
    let s = createEmptyGameState();
    s.players.self.deck = ['X1', 'X2'];
    s.players.self.scene.push(sceneChar('TGT', 't-uid'));
    s = produce(s, draft => {
      runAtom(draft, 'charGrantAbility', { uid: 't-uid', ability: GRANT_DRAW_ON_ACTION, scope: 'turn' }, makeCtx());
    });
    const after = produce(s, draft => {
      event.emit(draft, 'action:declare', { byUid: 't-uid' }, { player: 'self', cardId: 'TGT', uid: 't-uid' });
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.hand, '付与能力が発火して 1 ドロー').toHaveLength(1);
  });

  it('selfOnly: 付与先以外のアクションでは発火しない', () => {
    registerCardDef(defOf('TGT'));
    registerCardDef(defOf('OTHER'));
    let s = createEmptyGameState();
    s.players.self.deck = ['X1'];
    s.players.self.scene.push(sceneChar('TGT', 't-uid'));
    s.players.self.scene.push(sceneChar('OTHER', 'o-uid'));
    s = produce(s, draft => {
      runAtom(draft, 'charGrantAbility', { uid: 't-uid', ability: GRANT_DRAW_ON_ACTION, scope: 'turn' }, makeCtx());
    });
    const after = produce(s, draft => {
      event.emit(draft, 'action:declare', { byUid: 'o-uid' }, { player: 'self', cardId: 'OTHER', uid: 'o-uid' });
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.hand, '他キャラのアクションでは発火しない').toHaveLength(0);
  });

  it('付与は同一カードへの印字 ability と共存し、印字側の挙動を変えない (回帰)', () => {
    const printed = defOf('PRT');
    (printed.abilities as unknown[]).push({
      id: 'p1', type: 'triggered', scope: 'on-scene',
      trigger: { hook: 'action:declare', selfOnly: true },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      description: '',
    });
    registerCardDef(printed);
    let s = createEmptyGameState();
    s.players.self.deck = ['X1', 'X2', 'X3'];
    s.players.self.scene.push(sceneChar('PRT', 'p-uid'));
    s = produce(s, draft => {
      runAtom(draft, 'charGrantAbility', { uid: 'p-uid', ability: GRANT_DRAW_ON_ACTION, scope: 'turn' }, makeCtx());
    });
    const after = produce(s, draft => {
      event.emit(draft, 'action:declare', { byUid: 'p-uid' }, { player: 'self', cardId: 'PRT', uid: 'p-uid' });
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.hand, '印字 + 付与の両方が発火して 2 ドロー').toHaveLength(2);
  });

  it("validate: charGrantAbility の trigger.hook='leave:to-remove' は許可 (engine additive A2, B07063 解禁)", () => {
    // 2026-07-11: 旧禁止 (virtual-location 未対応) を撤廃。在場 observer は handleHook が grantedAbilities を
    // 合算走査 / 自己 leave は handleLeaveToRemoveSelf が removedChar.turnEffects.grantedAbilities を走査。
    const eff: Effect = {
      kind: 'atom', verb: 'charGrantAbility',
      args: { uid: 'x', scope: 'turn', ability: { trigger: { hook: 'leave:to-remove', selfOnly: true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } } },
    } as Effect;
    const r = validate(eff);
    expect(r.ok).toBe(true);
  });

  it('validate: ability 内の function (matcher 等) は拒否 (JSON シリアライズ可能性維持)', () => {
    const eff: Effect = {
      kind: 'atom', verb: 'charGrantAbility',
      args: { uid: 'x', scope: 'turn', ability: { trigger: { hook: 'action:declare', matcher: () => true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } } },
    } as Effect;
    const r = validate(eff);
    expect(r.ok).toBe(false);
  });
});

describe('charTurnEffect condition + triggerCharMatches payloadKey (Task D E4, B09041)', () => {
  beforeEach(() => {
    resetCardDefRegistry();
  });

  it('charTurnEffect: ctx.source キャラ自身の turnEffects flag を読む (「このターン中ガードされていた場合」)', () => {
    registerCardDef(defOf('C1'));
    const s = createEmptyGameState();
    const c = sceneChar('C1', 'u1');
    c.turnEffects['wasGuardedThisTurn'] = true;
    s.players.self.scene.push(c);
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1', cardId: 'C1' } });
    expect(evalCond(s, { kind: 'charTurnEffect', key: 'wasGuardedThisTurn' } as never, ctx)).toBe(true);
    expect(evalCond(s, { kind: 'charTurnEffect', key: 'somethingElse' } as never, ctx)).toBe(false);
  });

  it('triggerCharMatches payloadKey: action:guarded の guardUid をフィルタ評価 (「レベル6以下のキャラによってガードされたとき」)', () => {
    registerCardDef(defOf('ME'));
    const gDef = defOf('GUARD');
    (gDef as { level?: number }).level = 5;
    registerCardDef(gDef);
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('ME', 'me'));
    s.players.opp.scene.push(sceneChar('GUARD', 'g1'));
    const ctx = makeCtx({
      source: { player: 'self', area: 'scene', uid: 'me', cardId: 'ME' },
      triggerPayload: { byUid: 'me', guardUid: 'g1' },
    } as Partial<EffectCtx>);
    expect(evalCond(s, { kind: 'triggerCharMatches', payloadKey: 'guardUid', filter: { levelMax: 6 } } as never, ctx)).toBe(true);
    expect(evalCond(s, { kind: 'triggerCharMatches', payloadKey: 'guardUid', filter: { levelMax: 4 } } as never, ctx)).toBe(false);
  });
});
