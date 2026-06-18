// engine拡張 wave#2 cluster16 — 萩原千速 (PR280/B06087/B06087P) gate5 実機検証
// 初の「effect に removal verb (sceneRemove $self) を含む & 【ターン1】無し」removal-observer。
// cluster15 spec §6.6 の DEFER 境界に座る novel ケースの安全性を end-to-end で実証する。
//
// 検証3層:
//   A. filter gate5: a2 sceneEnter の出荷 filter 値 {cardNameNot:'萩原千速', trait:'警察', levelMax:7, kind:'character'}
//      が「〚カード名[萩原千速]〛以外のレベル7以下の〚特徴[警察]〛のキャラ」を decoy 盤面で 1対1 に表すこと。
//   B. trigger 条件 gating: and[fileAtLeast{6}, removedCharMatches{opp,contact-ap,self}] の両 leg が要求されること
//      (FILE6 未満 / 自分キャラ除去 / cause≠contact では非発火)。end-to-end contact (declare→judge) で byUid 配線も確認。
//   C. 自己リムーブ再入の非 cascade (最重要 novel pin): sceneRemove{$self,cause:'effect'} が再 emit する
//      leave:to-remove は cause:'effect'/side:own のため 萩原自身の a2 condition {side:'opp',cause:'contact-ap'} を
//      再合致できず → 自己 cascade 不能。これが cluster15 §6.6 DEFER 懸念の唯一の実害可能性であり、ここで否定する。
//      (event.emit の listener snapshot 再入安全性は engine 層 leave-to-remove.test.ts 既存カバレッジ + apply-pick の
//       queue-defer は cluster14 multi-sceneEnter で実証済。)
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { matchOneFilter } from '@/engine/target/candidates';
import { declare, passGuard, snapshotAP, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { judge } from '@/engine/flow/contact';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { B06087 } from '@/cards/ct-p06/B06087';
import type {
  GameState, CardDef, Candidate, TargetFilter, EffectDescriptor, AbilityDef,
} from '@/engine/types';

function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.id, kind: 'character', names: o.names ?? [o.id], colors: o.colors ?? ['黄'],
    level: o.level ?? 1, ap: o.ap ?? 1000, lp: o.lp ?? 1000, traits: o.traits ?? [],
    rarity: 'C', imageUrl: '', abilities: o.abilities ?? [], ruleRefs: [], ...o,
  };
}
// optional/sequence を walk して最初の指定 verb の args を返す (cluster16-ship.test.ts と同方式)。
function findArgs(eff: EffectDescriptor | undefined, verb: string): Record<string, unknown> | null {
  if (!eff || typeof eff !== 'object') return null;
  const e = eff as Record<string, unknown>;
  if (e.kind === 'atom' && e.verb === verb) return e.args as Record<string, unknown>;
  for (const k of ['effect', 'then', 'else']) {
    const r = findArgs(e[k] as EffectDescriptor | undefined, verb);
    if (r) return r;
  }
  for (const s of (e.steps as EffectDescriptor[] | undefined) ?? []) {
    const r = findArgs(s, verb);
    if (r) return r;
  }
  return null;
}
const cand = (cardId: string): Candidate => ({ kind: 'card', cardId, area: 'hand', player: 'self' });
const s = (): GameState => createEmptyGameState();
// observer (= source.uid) の leave:to-remove triggered effect が queue されたか
function observerFired(after: GameState, observerUid: string): boolean {
  return after.pendingEffects.some(
    (pe) => pe.triggeredBy?.hook === 'leave:to-remove' && pe.source?.uid === observerUid,
  );
}
function withFile(d: GameState, player: 'self' | 'opp', n: number): void {
  d.players[player].file = Array.from({ length: n }, (_, i) => ({ uid: `f${player}${i}`, cardId: 'VIC', faceDown: true })) as never;
}

// ───────────────────────── A. filter gate5 (出荷 a2 sceneEnter filter) ─────────────────────────
describe('萩原千速 a2 sceneEnter filter — 「〚カード名[萩原千速]〛以外のLv7以下の〚特徴[警察]〛のキャラ」decoy 1対1', () => {
  // a2 = abilities[1]。optional{sequence[sceneRemove, sceneEnter]} を walk して sceneEnter.filter を取得。
  const filter = findArgs((B06087.abilities[1] as AbilityDef).effect, 'sceneEnter')!.filter as TargetFilter;
  beforeEach(() => {
    _resetRegistry();
    // 除外名 (警察/Lv5 = 名前以外は全適格) → cardNameNot のみで外れること
    registerCardDef(defOf({ id: 'HAGI2', names: ['萩原千速'], traits: ['警察', '神奈川県警'], level: 5 }));
    // 適格 (別名/警察/Lv7)
    registerCardDef(defOf({ id: 'VALID', names: ['佐藤美和子'], traits: ['警察'], level: 7 }));
    // レベル超過 (警察/Lv8)
    registerCardDef(defOf({ id: 'LV8', names: ['松本清長'], traits: ['警察'], level: 8 }));
    // 非警察 (Lv4)
    registerCardDef(defOf({ id: 'NONPOL', names: ['毛利蘭'], traits: ['高校生'], level: 4 }));
    // キャラでない (event/警察を騙る)
    registerCardDef(defOf({ id: 'EV', kind: 'event', names: ['緊急配備'], traits: ['警察'], level: 3 }));
    // 複合名に「萩原千速」を含む (rules/19 split-name) → cardNameNot で除外されること
    registerCardDef(defOf({ id: 'COMPOUND', names: ['萩原千速&松田陣平'], traits: ['警察'], level: 5 }));
    // 近縁 trait のみ (神奈川県警 保持・「警察」非保持) → trait:警察 は完全一致なので除外
    registerCardDef(defOf({ id: 'NEARTRAIT', names: ['白鳥任三郎'], traits: ['神奈川県警'], level: 5 }));
  });
  it('出荷 filter が公式文言どおりの値 (cardNameNot/trait/levelMax/kind)', () => {
    expect(filter.cardNameNot).toBe('萩原千速');
    expect(filter.trait).toBe('警察');
    expect(filter.levelMax).toBe(7);
    expect(filter.kind).toBe('character');
  });
  it('〚萩原千速〛(除外名) は候補外 / 別名の警察Lv7は候補内', () => {
    expect(matchOneFilter(s(), 'HAGI2', filter, null, cand('HAGI2'))).toBe(false); // cardNameNot
    expect(matchOneFilter(s(), 'VALID', filter, null, cand('VALID'))).toBe(true);
  });
  it('Lv8 / 非警察 / 非キャラ も候補外 (filter 各条件)', () => {
    expect(matchOneFilter(s(), 'LV8', filter, null, cand('LV8'))).toBe(false);       // levelMax:7
    expect(matchOneFilter(s(), 'NONPOL', filter, null, cand('NONPOL'))).toBe(false); // trait:警察
    expect(matchOneFilter(s(), 'EV', filter, null, cand('EV'))).toBe(false);         // kind:character
  });
  it('複合名[萩原千速&X] は split-name 除外 / 近縁trait[神奈川県警]のみ は trait 不一致で除外', () => {
    expect(matchOneFilter(s(), 'COMPOUND', filter, null, cand('COMPOUND'))).toBe(false); // cardNameNot split-name (rules/19)
    expect(matchOneFilter(s(), 'NEARTRAIT', filter, null, cand('NEARTRAIT'))).toBe(false); // trait:警察 完全一致 (神奈川県警≠警察)
  });
});

// ───────────────────────── B + C. removal-observer trigger gating + 再入非 cascade ─────────────────────────
describe('萩原千速 a2 — removal-observer trigger gating + 自己リムーブ非 cascade', () => {
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); _resetActionContexts(); _resetUidCounter(); _resetRegistry();
    registerAll(); // 萩原千速 trio 登録済
    registerCardDef(defOf({ id: 'VIC', ap: 1000, traits: [] })); // ability 無し弱victim
    registerTriggeredListener();
  });

  // B1: FILE6 達成 + 萩原(AP5000) が opp victim を contact 除去 → observer 発火 (end-to-end declare→judge)
  it('B1 end-to-end: FILE6 + 萩原がコンタクト除去 → 発火 (byUid 配線)', () => {
    let obsUid = '', removed = false;
    const after = produce(createEmptyGameState(), (d) => {
      withFile(d, 'self', 6);
      obsUid = mutate.scene.enter(d, 'self', 'B06087', {}).uid; // AP5000
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}); // AP1000
      mutate.scene.setState(d, v.uid, 'sleep'); // action 対象は sleep
      const ax = declare(d, obsUid, { kind: 'char', uid: v.uid });
      passGuard(d, ax); snapshotAP(d, ax);
      removed = judge(d, ax).defenderRemoved;
    });
    expect(removed).toBe(true);          // 5000 >= 1000
    expect(observerFired(after, obsUid)).toBe(true);
  });

  // B2: FILE 不足 (5枚) → and[fileAtLeast6, ...] の fileAtLeast leg 不成立 → 非発火
  it('B2: FILE5 (条件不足) では除去が起きても非発火 (fileAtLeast leg)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      withFile(d, 'self', 5);
      obsUid = mutate.scene.enter(d, 'self', 'B06087', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, v.uid, 'contact-ap', obsUid); // 萩原が除去者
    });
    expect(observerFired(after, obsUid)).toBe(false);
  });

  // B3: cause≠contact (effect) では非発火 (removedCharMatches.cause leg)
  it('B3: cause=effect (非コンタクト除去) では非発火 (cause leg)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      withFile(d, 'self', 6);
      obsUid = mutate.scene.enter(d, 'self', 'B06087', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect', obsUid);
    });
    expect(observerFired(after, obsUid)).toBe(false);
  });

  // C (最重要 novel pin): 萩原自身が cause:'effect' でリムーブされる (= a2 effect の sceneRemove{$self} 再 emit を模擬)
  //   → side=self & cause=effect の二重不一致で 萩原の a2 condition {side:'opp',cause:'contact-ap'} を再合致できず
  //   → 自己 cascade / 無限ループ 不能。これが cluster15 §6.6 DEFER 懸念を否定する核心 pin。
  it('C: 萩原自身を cause:effect でリムーブしても自分の observer は再発火しない (非 cascade)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      withFile(d, 'self', 6);
      obsUid = mutate.scene.enter(d, 'self', 'B06087', {}).uid;
      // sceneRemove{$self, cause:'effect'} と同じ: 自分(side=self)を effect cause で除去
      mutate.scene.removeToRemove(d, obsUid, 'effect', obsUid);
    });
    // 自分の leave:to-remove が再 emit されても、自分の a2 は再 queue されない
    expect(observerFired(after, obsUid)).toBe(false);
  });

  // C補強: 別の自分キャラが contact 除去されても (by≠self) 非発火 = 「このキャラとの」自己限定 (by:'self')
  it('C補強: 別の自分キャラが除去者の場合は非発火 (by:self 自己限定)', () => {
    let obsUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      withFile(d, 'self', 6);
      obsUid = mutate.scene.enter(d, 'self', 'B06087', {}).uid;
      const other = mutate.scene.enter(d, 'self', 'VIC', {});
      const v = mutate.scene.enter(d, 'opp', 'VIC', {});
      mutate.scene.removeToRemove(d, v.uid, 'contact-ap', other.uid); // 除去者=別キャラ
    });
    expect(observerFired(after, obsUid)).toBe(false);
  });
});
