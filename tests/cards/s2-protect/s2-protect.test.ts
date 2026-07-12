// tests/cards/s2-protect — S2 保護系 wave probe (2026-07-11)
//   PR279 萩原千速: opponentEventRestrict:['remove'] (相手のイベントの効果によってリムーブされない)
//   B03093 西村京兵: untargetableByOppEventAura (+State) (自現場の警察スリープは相手イベントの効果で選ばれない)
// 経路 = production: handUseCard (event-use) / activateDeclaredAbility (char 能力対照) + runAllUntilEmpty。
// rules: 15 (常時有効) / Q&A PR279 (選ぶことは可・リムーブのみ block・sleep 等は素通し・event hirameki も block)
//       / Q&A B03093 (キャラ能力では選べる・イベント付与能力はキャラ能力扱い)
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { drainAiEffectPicks, _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _clearPendingEffectChoiceSide, _clearPendingEffectOptionalSide, _clearPendingOptionalResume, _clearPendingChoiceResume } from '@/engine/effect/pending-state';
import { _resetUidCounter, mutate as _m } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { PR279 } from '@/cards/pr-01/PR279';
import { B03093 } from '@/cards/ct-p03/B03093';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['黄'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const eventUse = (id: string, effect: AbilityDef['effect'], over: Partial<CardDef> = {}): CardDef =>
  def(id, {
    kind: 'event', level: 1,
    abilities: [{
      id: 'a1', type: 'triggered', scope: 'on-hand',
      trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
      effect, description: 'test event', ruleRefs: [],
    }],
    ...over,
  });

// イベント: キャラを1枚まで選びリムーブ (side either = どちらの現場でも)
const EVREM = eventUse('EVREM', { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either' } });
// イベント: 警察 filter でリムーブ (B03093 candidates 検証用)
const EVREMPOL = eventUse('EVREMPOL', { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { trait: '警察' } } });
// イベント: キャラを1枚まで選びスリープ (PR279 は block されない)
const EVSLEEP = eventUse('EVSLEEP', { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } });
// キャラの宣言能力: キャラを1枚まで選びリムーブ (対照 — event でない source)
const CHARREM = def('CHARREM', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either' } },
    description: 'キャラを1枚まで選び、リムーブする。', ruleRefs: [],
  }],
});
const KEISATSU = def('KEISATSU', { traits: ['警察'] });
const SHIMIN = def('SHIMIN', { traits: [] });
const FILL = def('FILL');

const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

beforeEach(() => {
  resetCardDefRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectChoiceSide();
  _clearPendingEffectOptionalSide();
  _clearPendingOptionalResume();
  _clearPendingChoiceResume();
  [PR279, B03093, EVREM, EVREMPOL, EVSLEEP, CHARREM, KEISATSU, SHIMIN, FILL].forEach(registerCardDef);
  registerTriggeredListener();
  setHuman(null); // AI 同士 — pick は drainAiEffectPicks で確定
});

function base(turnPlayer: 'self' | 'opp' = 'opp'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['FILL', 'FILL'];
  s.players.opp.deck = ['FILL', 'FILL'];
  return s;
}
// event 使用ゲート充足 (手札 + 事件色 + FILE)
function armEvent(s: GameState, p: 'self' | 'opp', eventId: string): void {
  s.players[p].hand = [eventId];
  s.players[p].case.colors = ['黄'];
  s.players[p].file = Array.from({ length: 7 }, () => ({ type: 'card-back' as const, cardId: 'FILL' }));
}
const drive = (s0: GameState, f: (d: GameState) => void) => produce(s0, (d) => {
  f(d);
  for (let i = 0; i < 4; i++) {
    runAllUntilEmpty(d);
    _drainAllEffectPicksForTest(d);
    drainAiEffectPicks(d);
  }
});

describe('PR279 — 相手のイベントの効果によってリムーブされない (opponentEventRestrict)', () => {
  it('相手イベントの sceneRemove → block (現場に残る)', () => {
    const s = base('opp');
    const me = mutate.scene.enter(s, 'self', 'PR279', {});
    mutate.scene.setState(s, me.uid, 'sleep'); // 唯一候補 (AI が必ず選ぶ)
    armEvent(s, 'opp', 'EVREM');
    const r = drive(s, (d) => handUseCard(d, 'opp', 'EVREM'));
    expect(r.players.self.scene.some(c => c.cardId === 'PR279'), 'イベント発リムーブは block').toBe(true);
    expect(r.players.self.remove).not.toContain('PR279');
  });

  it('相手キャラ能力の sceneRemove → block されない (event 限定保護)', () => {
    const s = base('opp');
    const me = mutate.scene.enter(s, 'self', 'PR279', {});
    mutate.scene.setState(s, me.uid, 'sleep');
    const actor = mutate.scene.enter(s, 'opp', 'CHARREM', {});
    const r = drive(s, (d) => { activateDeclaredAbility(d, actor.uid, 'a1'); });
    expect(r.players.self.scene.some(c => c.cardId === 'PR279'), 'キャラ能力発は素通し').toBe(false);
    expect(r.players.self.remove).toContain('PR279');
  });

  it('相手イベントのスリープ効果 → block されない (remove のみ保護)', () => {
    const s = base('opp');
    mutate.scene.enter(s, 'self', 'PR279', {}); // active のまま
    armEvent(s, 'opp', 'EVSLEEP');
    const r = drive(s, (d) => handUseCard(d, 'opp', 'EVSLEEP'));
    const me = r.players.self.scene.find(c => c.cardId === 'PR279');
    expect(me?.state, 'sleep は素通し (公式Q&A)').toBe('sleep');
  });

  it('自分のイベントによるリムーブ → block されない (「相手の」限定)', () => {
    const s = base('self');
    const me = mutate.scene.enter(s, 'self', 'PR279', {});
    mutate.scene.setState(s, me.uid, 'sleep');
    armEvent(s, 'self', 'EVREM');
    const r = drive(s, (d) => handUseCard(d, 'self', 'EVREM'));
    expect(r.players.self.remove, '自発は保護対象外').toContain('PR279');
  });

  it('owner=opp pin: 相手側の PR279 を自分のイベントで除去 → block (対称)', () => {
    const s = base('self');
    const him = mutate.scene.enter(s, 'opp', 'PR279', {});
    mutate.scene.setState(s, him.uid, 'sleep');
    armEvent(s, 'self', 'EVREM');
    const r = drive(s, (d) => handUseCard(d, 'self', 'EVREM'));
    expect(r.players.opp.scene.some(c => c.cardId === 'PR279')).toBe(true);
  });

  it('【疾風】1番目登場で相手の裏向き証拠を1つ表向きに (効果登場 = sceneEnter atom 経由、AI 経路)', () => {
    // mutate.scene.enter 直呼びは 'enter' hook を emit しない (emit は atom/flow 層) — cluster11 §4 と同流儀。
    const s = base('self');
    // 証拠は distinct cardId にする — drive の drain loop は解決済み pending を再適用しうる
    // (target=cardId 解決の atom は 2 週目以降 not-found no-op になるのが前提。同一 cardId 複製だと
    //  2 枚目が誤 flip されて観測が壊れる、fixture 規約)。
    s.players.opp.evidence = [{ cardId: 'FILL', faceUp: false }, { cardId: 'SHIMIN', faceUp: false }];
    s.players.self.remove = ['PR279'];
    const r = drive(s, (d) => {
      runEffect(d,
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'PR279', target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' } } } as never,
        { source: { cardId: 'FILL', uid: 'test:src', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as never);
    });
    expect(r.players.self.scene.some(c => c.cardId === 'PR279'), '登場済').toBe(true);
    expect(r.players.opp.evidence.filter(e => e.faceUp).length, '1つ表向き').toBe(1);
  });
});

describe('B03093 — 自現場の警察スリープは相手イベントの効果で選ばれない (untargetableByOppEventAura)', () => {
  it('相手イベント (警察 filter リムーブ): スリープ警察は候補外 → 残る / アクティブ警察は選ばれる', () => {
    const s = base('opp');
    mutate.scene.enter(s, 'self', 'B03093', {}); // bearer (active)
    const sleepPol = mutate.scene.enter(s, 'self', 'KEISATSU', {});
    mutate.scene.setState(s, sleepPol.uid, 'sleep');
    armEvent(s, 'opp', 'EVREMPOL');
    const r = drive(s, (d) => handUseCard(d, 'opp', 'EVREMPOL'));
    // スリープ警察 (KEISATSU) は保護 — 候補は active の B03093 (警察) 自身のみ → それが除去される
    expect(r.players.self.scene.some(c => c.cardId === 'KEISATSU'), 'スリープ警察は選ばれない').toBe(true);
    expect(r.players.self.remove, 'アクティブ警察 (bearer 自身) は保護外で選ばれる').toContain('B03093');
  });

  it('bearer 自身がスリープ → aura は自分にも掛かる (全滅候補 0 = 誰も除去されない)', () => {
    const s = base('opp');
    const bearer = mutate.scene.enter(s, 'self', 'B03093', {});
    mutate.scene.setState(s, bearer.uid, 'sleep');
    const sleepPol = mutate.scene.enter(s, 'self', 'KEISATSU', {});
    mutate.scene.setState(s, sleepPol.uid, 'sleep');
    armEvent(s, 'opp', 'EVREMPOL');
    const r = drive(s, (d) => handUseCard(d, 'opp', 'EVREMPOL'));
    expect(r.players.self.scene.length, '警察スリープ 2 枚とも保護').toBe(2);
  });

  it('スリープでも非警察は保護されない', () => {
    const s = base('opp');
    mutate.scene.enter(s, 'self', 'B03093', {});
    const civ = mutate.scene.enter(s, 'self', 'SHIMIN', {});
    mutate.scene.setState(s, civ.uid, 'sleep');
    armEvent(s, 'opp', 'EVREM');
    const r = drive(s, (d) => handUseCard(d, 'opp', 'EVREM'));
    // EVREM (filter なし) の候補: B03093(active 警察=aura state 外) と SHIMIN(sleep 非警察) — 少なくとも SHIMIN は候補たりうる
    expect(r.players.self.scene.length, '1 枚は除去される (保護なし)').toBe(1);
  });

  it('相手キャラ能力ではスリープ警察も選べる (公式Q&A)', () => {
    const s = base('opp');
    mutate.scene.enter(s, 'self', 'B03093', {});
    const sleepPol = mutate.scene.enter(s, 'self', 'KEISATSU', {});
    mutate.scene.setState(s, sleepPol.uid, 'sleep');
    const actor = mutate.scene.enter(s, 'opp', 'CHARREM', {});
    const r = drive(s, (d) => { activateDeclaredAbility(d, actor.uid, 'a1'); });
    expect(r.players.self.scene.length + r.players.opp.scene.length, 'キャラ能力はどれか 1 枚除去できる').toBe(2);
  });

  it('owner=opp pin: 相手側 bearer の警察スリープを自分のイベントで選べない', () => {
    const s = base('self');
    mutate.scene.enter(s, 'opp', 'B03093', {});
    const sleepPol = mutate.scene.enter(s, 'opp', 'KEISATSU', {});
    mutate.scene.setState(s, sleepPol.uid, 'sleep');
    armEvent(s, 'self', 'EVREMPOL');
    const r = drive(s, (d) => handUseCard(d, 'self', 'EVREMPOL'));
    expect(r.players.opp.scene.some(c => c.cardId === 'KEISATSU'), '対称保護').toBe(true);
    expect(r.players.opp.remove, 'アクティブ警察 bearer は選ばれる').toContain('B03093');
  });
});
