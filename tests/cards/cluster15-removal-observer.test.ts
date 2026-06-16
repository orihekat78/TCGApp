// engine拡張 wave#2 cluster15 — removal-observer (反撃カード一族) gate5 実機検証
// spec: .claude/specs/engine-cluster15-contact-removal-observer-design.md
//
// 検証2層:
//  Block1 = end-to-end contact (declare→passGuard→snapshotAP→judge): contact.judge が aUid を
//           removeToRemove の byUid に渡し、observer の removedCharMatches{by:'self'} が発火するまで。
//  Block2 = 実出荷カード経由 (removeToRemove direct): 全 variant (SELF/FILTER/BARE) + pin
//           (self-not-firing / cause filter / cardName split-name / excludeSource)。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { declare, passGuard, snapshotAP, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { judge } from '@/engine/flow/contact';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import type { GameState, CardDef, AbilityDef } from '@/engine/types';

// observer (= source.uid) の leave:to-remove triggered effect が queue されたか
function observerFired(after: GameState, observerUid: string): boolean {
  return after.pendingEffects.some(
    (pe) => pe.triggeredBy?.hook === 'leave:to-remove' && pe.source?.uid === observerUid,
  );
}
function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.id, kind: 'character', names: o.names ?? [o.id], colors: ['赤'],
    level: o.level ?? 1, ap: o.ap ?? 1000, lp: o.lp ?? 1000, traits: o.traits ?? [],
    rarity: 'C', imageUrl: '', abilities: o.abilities ?? [], ruleRefs: [], ...o,
  };
}

// ---- Block1: end-to-end contact が aUid を byUid に渡すこと ----
describe('cluster15 removal-observer — end-to-end contact (contact.judge → byUid wiring)', () => {
  const OBS_ABILITY: AbilityDef = {
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:to-remove' },
    condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
    ruleRefs: [],
  };
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); _resetActionContexts(); _resetUidCounter(); resetDefRegistry();
    registerCardDef(defOf({ id: 'OBS', ap: 6000, abilities: [OBS_ABILITY] })); // 反撃 observer (high AP = 勝つ)
    registerCardDef(defOf({ id: 'VIC', ap: 1000 })); // 弱い相手 = 被除去
    registerTriggeredListener();
  });

  it('observer が攻撃して勝つ → 相手被除去 → observer (by:self) draw 発火', () => {
    let obsUid = '', vicUid = '', removed = false;
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}); vicUid = v.uid;
      mutate.scene.setState(d, vicUid, 'sleep'); // action target は sleep/stun
      const ax = declare(d, obsUid, { kind: 'char', uid: vicUid });
      passGuard(d, ax); snapshotAP(d, ax);
      removed = judge(d, ax).defenderRemoved;
    });
    expect(removed).toBe(true); // 6000 >= 1000
    expect(after.players.opp.scene.find((c) => c.uid === vicUid)).toBeUndefined();
    expect(observerFired(after, obsUid), 'observer should fire on contact removal it caused').toBe(true);
  });

  it('observer が攻撃して負ける (AP不足) → 相手非除去 → 非発火', () => {
    resetDefRegistry();
    registerCardDef(defOf({ id: 'OBS', ap: 500, abilities: [OBS_ABILITY] })); // 弱い
    registerCardDef(defOf({ id: 'VIC', ap: 1000 }));
    registerTriggeredListener();
    let obsUid = '', removed = true;
    const after = produce(createEmptyGameState(), (d) => {
      obsUid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.setState(d, v.uid, 'sleep');
      const ax = declare(d, obsUid, { kind: 'char', uid: v.uid });
      passGuard(d, ax); snapshotAP(d, ax);
      removed = judge(d, ax).defenderRemoved;
    });
    expect(removed).toBe(false); // 500 < 1000 = 攻撃側は除去されない、相手も除去されない
    expect(observerFired(after, obsUid)).toBe(false);
  });
});

// ---- Block2: 実出荷カード (removeToRemove direct で contact-ap 除去を再現) ----
describe('cluster15 removal-observer — 実出荷カード variant + pin', () => {
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
    registerAll();
    registerCardDef(defOf({ id: 'VIC', ap: 1000 })); // ability 無しの相手 victim (real cards に上書き追加)
    registerTriggeredListener();
  });

  // CONTACT-SELF: 「このキャラとのコンタクトによって」= by:'self' (byUid===observer)
  it('D10007 (蘭, CONTACT-SELF): 自分が除去者なら発火 / 別キャラが除去者なら非発火', () => {
    let obsA = '';
    const a = produce(createEmptyGameState(), (d) => {
      const obs = mutate.scene.enter(d, 'self', 'D10007', {}); obsA = obs.uid;
      const vic = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, vic.uid, 'contact-ap', obs.uid); // 蘭自身が除去者
    });
    expect(observerFired(a, obsA)).toBe(true);
    let obsB = '';
    const b = produce(createEmptyGameState(), (d) => {
      const obs = mutate.scene.enter(d, 'self', 'D10007', {}); obsB = obs.uid;
      const other = mutate.scene.enter(d, 'self', 'VIC', {});
      const vic = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, vic.uid, 'contact-ap', other.uid); // 別の自分キャラが除去者
    });
    expect(observerFired(b, obsB)).toBe(false);
  });

  it('D10007 (蘭): cause が effect (非contact) なら非発火 [cause filter pin]', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      const obs = mutate.scene.enter(d, 'self', 'D10007', {}); obsUid = obs.uid;
      const vic = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, vic.uid, 'effect', obs.uid); // cause=effect
    });
    expect(observerFired(after, obsUid)).toBe(false);
  });

  it('D10007 (蘭): 自分のキャラが除去された場合は非発火 [self-not-firing pin]', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      const obs = mutate.scene.enter(d, 'self', 'D10007', {}); obsUid = obs.uid;
      const myVictim = mutate.scene.enter(d, 'self', 'VIC', {}); // 自分キャラ
      mutate.scene.removeToRemove(d, myVictim.uid, 'contact-ap', obs.uid); // side=self
    });
    expect(observerFired(after, obsUid)).toBe(false);
  });

  // CONTACT-BARE: 「コンタクトによって」(攻撃者無指定) = by 省略
  it('B01030 (CONTACT-BARE): 任意の自分キャラが除去者でも発火', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      const obs = mutate.scene.enter(d, 'self', 'B01030', {}); obsUid = obs.uid;
      const atk = mutate.scene.enter(d, 'self', 'VIC', {}); // observer 以外が除去者
      const vic = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, vic.uid, 'contact-ap', atk.uid);
    });
    expect(observerFired(after, obsUid)).toBe(true);
  });

  // CONTACT-FILTER (trait): D09010 降谷零=警察、excludeSource なし (self-count)
  it('D09010 (CONTACT-FILTER 特徴警察): 除去者が警察なら発火 / 非警察なら非発火', () => {
    // D09010 (降谷零) 自身が警察 → observer 自身を除去者にして self-count (excludeSource なし) を兼ねる
    let obsA = '';
    const a = produce(createEmptyGameState(), (d) => {
      const obs = mutate.scene.enter(d, 'self', 'D09010', {}); obsA = obs.uid;
      const vic = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, vic.uid, 'contact-ap', obs.uid); // 除去者=警察(降谷零)
    });
    expect(observerFired(a, obsA)).toBe(true);
    let obsB = '';
    const b = produce(createEmptyGameState(), (d) => {
      const obs = mutate.scene.enter(d, 'self', 'D09010', {}); obsB = obs.uid;
      const nonPolice = mutate.scene.enter(d, 'self', 'VIC', {}); // VIC は trait 無
      const vic = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, vic.uid, 'contact-ap', nonPolice.uid); // 除去者=非警察
    });
    expect(observerFired(b, obsB)).toBe(false);
  });

  // CONTACT-FILTER (cardName): B09026 伊織無我、自身も該当 (excludeSource なし)
  it('B09026 (CONTACT-FILTER カード名伊織無我): 除去者が伊織無我なら発火', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      const obs = mutate.scene.enter(d, 'self', 'B09026', {}); obsUid = obs.uid; // 伊織無我自身が除去者
      const vic = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, vic.uid, 'contact-ap', obs.uid);
    });
    expect(observerFired(after, obsUid)).toBe(true);
  });
});
