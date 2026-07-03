// tests/cards/engine-wave18-incontact-consumers
// engine wave-18 exemplar 実機検証 — inContact TargetQuery + contact emit enrichment の初 consumer。
//
// 検証対象 (engine 変更):
//   1. disguise:into emit に player + source.bindings.contact を追加 (白鳥の変装 reaction / inContact pick)
//   2. contact:start emit の source に bindings.contact を追加 (キャンティの contact reaction / inContact pick)
//   3. inContact TargetQuery = pick を現コンタクト参加者に限定 (parked axis land)
//
//   B04075 白鳥任三郎: 【ターン1】相手 cutin/変装 → コンタクト中のキャラ1枚まで AP-1000
//     (multi-hook cutin:used+disguise:into / triggerPlayerIs opp / inContact pick)。
//   B04092 キャンティ: 自分の他キャラ contact → optional self-sleep → コンタクト中のキャラ1枚 AP+2000
//     (contact:start or payloadKey aUid/bUid + excludeSource / inContact pick)。
//
//   実機 emit 経路: 白鳥 = flow/contact.cutIn / disguise、キャンティ = flow/action/state-machine.declare→advance。
// rules: 08-contact.md, 09-cutin-disguise.md, 15-abilities-effects.md, 22-qa-action-contact.md, 24-qa-naming-stun.md

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
import { _drainAllEffectPicksForTest, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { _peekPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { cutIn, canCutIn, disguise, canDisguise } from '@/engine/flow/contact';
import { declare, advance, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { B04075 } from '@/cards/ct-p04/B04075';
import { B04092 } from '@/cards/ct-p04/B04092';
import type { CardDef, ActionContext, GameState } from '@/engine/types';

// 最小 cutin カード (rules/09: type:'triggered' scope:'on-hand' trigger:effect:declared)。自効果 no-op。
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
// 最小 変装キャラ (type:'icon-disguise'、ゲート条件なし = 常に変装可)。
const DIS: CardDef = {
  id: 'DIS', no: 'DIS', kind: 'character', names: ['DIS'], colors: ['赤'],
  level: 1, ap: 2000, lp: 1, traits: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'd', type: 'icon-disguise', scope: 'on-hand',
    effect: { kind: 'sequence', steps: [] }, // 変装時効果なし
    description: '変装 (効果なし)', ruleRefs: [],
  }],
};
// 汎用キャラ (attacker / target / observer decoy)
function ch(id: string, ap: number): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const ATK = ch('ATK', 3000);
const DEF = ch('DEF', 3000);
const MOB = ch('MOB', 9000); // 非参加者 decoy (inContact pick から除外されるべき)

// self=attacker(ATK uid) vs opp=target(DEF uid) の contact ax
function mkAx(atkUid: string, dftUid: string): ActionContext {
  return {
    id: 'ax', byUid: atkUid, byPlayer: 'self', target: { kind: 'char', uid: dftUid },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: atkUid, aAP: 3000, bUid: dftUid, bAP: 3000 }, contactImmune: false,
  };
}
// uid 指定 pick chooser (fallback は先頭)
function pick(uid: string) {
  return { chooseAtomTarget: (_s: GameState, _v: string, _a: Readonly<Record<string, unknown>>, cands: ReadonlyArray<{ uid: string }>) => cands.find((c) => c.uid === uid) ?? null };
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  _clearPendingEffectPickQueue(); _resetActionContexts();
  registerCardDef(B04075); registerCardDef(B04092);
  registerCardDef(CUT); registerCardDef(DIS); registerCardDef(ATK); registerCardDef(DEF); registerCardDef(MOB);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('B04075 白鳥 shape', () => {
  it('id/no/色/lv/ap/特徴 + a1 multi-hook + a2 hirameki', () => {
    expect(B04075.id).toBe('B04075');
    expect(B04075.no).toBe('0256/B04075');
    expect(B04075.colors).toEqual(['黄']);
    expect(B04075.ap).toBe(4000);
    expect(B04075.traits).toEqual(['警察', '警視庁']);
    expect(B04075.abilities[0].trigger?.hook).toBe('cutin:used');
    expect(B04075.abilities[0].trigger?.hooks).toEqual(['disguise:into']);
    expect(B04075.abilities[0].trigger?.matcherCondition).toMatchObject({ kind: 'triggerPlayerIs', side: 'opp' });
    expect(B04075.abilities[0].limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(B04075.abilities[1].trigger?.hook).toBe('evidence:remove-by-action');
  });
});

describe('B04075 白鳥 behavioral', () => {
  // self 現場: 白鳥(obs) + ATK(attacker) + MOB(decoy) / opp 現場: DEF(target)
  function board(): { s: GameState; atk: string; def: string; mob: string; sw: string } {
    let atk = '', def = '', mob = '', sw = '';
    const s = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      sw = mutate.scene.enter(d, 'self', 'B04075', {}).uid;
      atk = mutate.scene.enter(d, 'self', 'ATK', {}).uid;
      mob = mutate.scene.enter(d, 'self', 'MOB', {}).uid;
      def = mutate.scene.enter(d, 'opp', 'DEF', {}).uid;
    });
    return { s, atk, def, mob, sw };
  }

  it('相手が cutin 使用 → 白鳥発火 → コンタクト参加者(DEF)を AP-1000', () => {
    const { s, atk, def } = board();
    const after = produce(s, (d) => {
      d.players.opp.hand = ['CUT'];
      const ax = mkAx(atk, def);
      expect(canCutIn(d, ax, 'opp', 'CUT')).toBe(true);
      cutIn(d, ax, 'opp', 'CUT'); // 相手(opp)が cutin
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, pick(def)); // 参加者 DEF を選択
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, def)).toBe(2000); // 3000 - 1000(contact)
  });

  it('inContact pick は非参加者(MOB)を候補にしない → MOB 選択不可、AP 据置', () => {
    const { s, atk, def, mob } = board();
    const after = produce(s, (d) => {
      d.players.opp.hand = ['CUT'];
      const ax = mkAx(atk, def);
      cutIn(d, ax, 'opp', 'CUT');
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, pick(mob)); // MOB を要求するが候補に無い → fallback 先頭(参加者)
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, mob)).toBe(9000); // MOB は非参加者 → 不変
    // fallback で参加者いずれかが -1000 されている (ATK か DEF)
    const total = engine.read.char.ap(after, atk) + engine.read.char.ap(after, def);
    expect(total).toBe(3000 + 3000 - 1000);
  });

  it('相手が変装 使用 → 白鳥発火 (disguise:into player enrichment) → 参加者 AP-1000', () => {
    const { s, atk, def } = board();
    const after = produce(s, (d) => {
      d.players.opp.hand = ['DIS'];
      const ax = mkAx(atk, def);
      expect(canDisguise(d, ax, 'opp', 'DIS')).toBe(true);
      disguise(d, ax, 'opp', 'DIS'); // 相手(opp)が変装 (DEF uid 維持で DIS へ)
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, pick(def)); // 変装後も uid=def の参加者を選択
      runAllUntilEmpty(d);
    });
    // DEF(uid) は DIS(ap2000) に変装済 → 2000 - 1000 = 1000
    expect(engine.read.char.ap(after, def)).toBe(1000);
  });

  it('自分が cutin 使用 → 白鳥発火せず (triggerPlayerIs opp) → AP 据置', () => {
    const { s, atk, def } = board();
    const after = produce(s, (d) => {
      d.players.self.hand = ['CUT'];
      const ax = mkAx(atk, def);
      cutIn(d, ax, 'self', 'CUT'); // 自分(self)が cutin
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, pick(def));
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, def)).toBe(3000); // 発火せず不変
    expect(engine.read.char.ap(after, atk)).toBe(3000);
  });
});

describe('B04092 キャンティ shape', () => {
  it('id/no/色/特徴 + contact:start or-matcher + optional chain', () => {
    expect(B04092.id).toBe('B04092');
    expect(B04092.no).toBe('0474/B04092');
    expect(B04092.colors).toEqual(['黒']);
    expect(B04092.traits).toEqual(['黒ずくめの組織']);
    expect(B04092.abilities[0].trigger?.hook).toBe('contact:start');
    expect(B04092.abilities[0].trigger?.matcherCondition).toMatchObject({ kind: 'or' });
    expect(B04092.abilities[0].effect?.kind).toBe('optional');
  });
});

describe('B04092 キャンティ behavioral', () => {
  // self 現場: キャンティ(obs) + ATK(attacker) / opp 現場: DEF(target, sleep)
  function board(kantiAsAttacker = false): { s: GameState; atk: string; def: string; kan: string } {
    let atk = '', def = '', kan = '';
    const s = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      kan = mutate.scene.enter(d, 'self', 'B04092', {}).uid; // active, 非名乗り (enter default)
      atk = mutate.scene.enter(d, 'self', 'ATK', {}).uid;
      def = mutate.scene.enter(d, 'opp', 'DEF', { active: false }).uid; // action 対象は sleep/stun
    });
    return { s, atk, def, kan };
  }
  // real contact:start を driver (declare → advance で contact-pending 通過)
  function driveContact(d: GameState, atkUid: string, dftUid: string): void {
    const ax = declare(d, atkUid, { kind: 'char', uid: dftUid });
    for (let i = 0; i < 5 && ax.phase !== 'judge' && ax.phase !== 'contact'; i++) advance(d, ax);
  }

  it('自分の他キャラ(ATK)が contact → キャンティ発火 → opt-in で self-sleep + 参加者 AP+2000', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const { s, atk, def, kan } = board();
    const after = produce(s, (d) => {
      driveContact(d, atk, def);
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'キャンティ optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true); // 「する」= self-sleep + AP+
      for (let i = 0; i < 6; i++) { _drainAllEffectPicksForTest(d, pick(def)); runAllUntilEmpty(d); }
    });
    expect(after.players.self.scene.find((c) => c.uid === kan)!.state, 'キャンティ sleep').toBe('sleep');
    expect(engine.read.char.ap(after, def)).toBe(5000); // 3000 + 2000(contact)
  });

  it('opt-out → self-sleep せず AP 据置', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const { s, atk, def, kan } = board();
    const after = produce(s, (d) => {
      driveContact(d, atk, def);
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      applyOptionalAndContinuation(d, p!, false); // 「しない」
      for (let i = 0; i < 6; i++) { _drainAllEffectPicksForTest(d, pick(def)); runAllUntilEmpty(d); }
    });
    expect(after.players.self.scene.find((c) => c.uid === kan)!.state).toBe('active');
    expect(engine.read.char.ap(after, def)).toBe(3000);
  });
});
