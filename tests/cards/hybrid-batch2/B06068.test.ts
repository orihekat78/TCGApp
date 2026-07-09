// CARD PHASE hybrid-batch2 probe — B06068 京極真 (character, engine変更0)
//
// 公式テキスト (refusedLine = compiler 未製の novel 句):
//   【絆鈴木園子】【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、
//   手札を1枚リムーブしてもよい。そうした場合、このキャラをアクティブにし、
//   ターン終了時までこのキャラは〚突撃［キャラ］〛を失い、〚突撃［事件］〛を持つ。
//
// DSL: a1 triggered leave:to-remove / condition = and[bond(鈴木園子),
//        removedCharMatches{side:opp, cause:contact-ap, by:self}] / limit turn1 /
//        effect = optional{ chain[ discard self1, sceneSetState $self active,
//                                  charRevokeKeyword $self 突撃[キャラ] turn,
//                                  charGrantKeyword $self 突撃[事件] turn ] }
//
// 検証面 (全 novel 句を engine 実評価):
//   - observer 型 leave:to-remove (handleHook in-play scan、B06068 は在場)
//   - removedCharMatches gate: side:opp (相手の現場) / cause:contact-ap / by:self
//     (「このキャラとのコンタクトによって」= byUid===source.uid、cond/eval.ts:653-658)
//   - 絆鈴木園子 (cond/eval.ts:118 scene-only)
//   - optional「してもよい」→ human 経路 (AI auto-skip 回避)
//   - そうした場合: discard self1 / active化 / 突撃[キャラ]失う(turn) / 突撃[事件]得る(turn)
//   - 【ターン1】: 辞退しても発動済扱い (QA「手札をリムーブしなかった場合でも…このターン中は発動しません」、
//     triggered.ts:456-458 incrDeclaredUseCount は queue 時 = 辞退前に記録)
//
// production 形 emit = mutate/scene.ts:330 payload {uid,cause,side,byUid,removedChar}、
//   ctx {player,uid,cardId} = 除去された相手キャラの identity (side:'opp')。
// BUG-174 (owner=opp): 本カードの pick は self 手札 discard のみ (相手側 pick 無し) →
//   cross-side 次元は「相手の現場のキャラが除去された」トリガ側で担保 (positive/side:self 両ケースで pin)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks, _drainAllEffectPicksForTest, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { _peekPendingEffectOptionalSide, _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { char as readChar } from '@/engine/read/char';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

import { B06068 } from '@/cards/ct-p06/B06068';

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };
function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const FIXTURES: CardDef[] = [
  def('FILL'),
  def('SONOKO', { names: ['鈴木園子'] }), // 絆対象
  def('PLAIN'),                            // 除去された相手キャラ / 絆 decoy
];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  s.players.opp.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  return s;
}

// bond 成立 + kyo(=京極 sleep) + 手札1枚。opp.scene は空 (victim は既に splice 済 = payload snapshot で表現)。
function board(opts: { bond?: boolean; kyoState?: 'active' | 'sleep' } = {}): GameState {
  const { bond = true, kyoState = 'sleep' } = opts;
  const s = base();
  s.players.self.scene = bond
    ? [sc('B06068', 'kyo', kyoState), sc('SONOKO', 'sonoko')]
    : [sc('B06068', 'kyo', kyoState), sc('PLAIN', 'decoy')];
  s.players.self.hand = ['FILL'];
  return s;
}

// production emit 形 = mutate/scene.ts:330 {uid,cause,side,byUid,removedChar} + ctx{player,uid,cardId}
function emitRemoval(d: GameState, opts: { cause?: string; side?: 'self' | 'opp'; byUid?: string } = {}): void {
  const { cause = 'contact-ap', side = 'opp', byUid = 'kyo' } = opts;
  const victim = sc('PLAIN', 'ovictim');
  const victimPlayer = side === 'opp' ? 'opp' : 'self';
  event.emit(d, 'leave:to-remove',
    { uid: 'ovictim', cause, side, byUid, removedChar: victim },
    { player: victimPlayer, uid: 'ovictim', cardId: 'PLAIN' });
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of [B06068, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

describe('B06068 京極真 a1 — 相手キャラ contact 除去 → してもよい[active化 + 突撃[キャラ]→突撃[事件]]', () => {
  it('する (human) → 手札-1 / kyo active化 / 突撃[キャラ]失い 突撃[事件]得る', () => {
    setHuman('self');
    const s = produce(board(), (d) => {
      emitRemoval(d);
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional が human に surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true);
      _drainAllEffectPicksForTest(d); // self 手札 discard pick (単一候補 FILL)
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    const kyo = s.players.self.scene.find(c => c.uid === 'kyo')!;
    expect(s.players.self.hand.length, '手札1枚リムーブ').toBe(0);
    expect(kyo.state, 'アクティブ化').toBe('active');
    expect(readChar.hasKeyword(s, 'kyo', '突撃[キャラ]'), '突撃[キャラ]を失う (turn)').toBe(false);
    expect(readChar.hasKeyword(s, 'kyo', '突撃[事件]'), '突撃[事件]を得る (turn)').toBe(true);
  });

  it('しない (human 辞退) → 手札・状態・キーワード 不変', () => {
    setHuman('self');
    const s = produce(board(), (d) => {
      emitRemoval(d);
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p).not.toBeNull();
      applyOptionalAndContinuation(d, p!, false);
    });
    const kyo = s.players.self.scene.find(c => c.uid === 'kyo')!;
    expect(s.players.self.hand.length, '手札不変').toBe(1);
    expect(kyo.state, 'sleep のまま').toBe('sleep');
    expect(readChar.hasKeyword(s, 'kyo', '突撃[キャラ]'), '突撃[キャラ] 保持').toBe(true);
    expect(readChar.hasKeyword(s, 'kyo', '突撃[事件]'), '突撃[事件] 未付与').toBe(false);
  });

  it('cause:effect (コンタクト以外の除去) → 発動しない (cause:contact-ap gate)', () => {
    setHuman('self');
    produce(board(), (d) => {
      emitRemoval(d, { cause: 'effect' });
      runAllUntilEmpty(d);
      expect(_peekPendingEffectOptionalSide(), 'contact-ap でない → 不発').toBeNull();
    });
  });

  it('byUid が別キャラ (このキャラとのコンタクトでない) → 発動しない (by:self gate)', () => {
    setHuman('self');
    produce(board(), (d) => {
      emitRemoval(d, { byUid: 'sonoko' }); // 京極以外が除去者
      runAllUntilEmpty(d);
      expect(_peekPendingEffectOptionalSide(), 'byUid!==source.uid → 不発').toBeNull();
    });
  });

  it('絆鈴木園子 不成立 → 発動しない (bond gate、decoy PLAIN は絆を満たさない)', () => {
    setHuman('self');
    produce(board({ bond: false }), (d) => {
      emitRemoval(d);
      runAllUntilEmpty(d);
      expect(_peekPendingEffectOptionalSide(), '園子不在 → 不発').toBeNull();
    });
  });

  it('side:self (自分のキャラが除去された) → 発動しない (「相手の現場」gate、cross-side pin)', () => {
    setHuman('self');
    produce(board(), (d) => {
      emitRemoval(d, { side: 'self' });
      runAllUntilEmpty(d);
      expect(_peekPendingEffectOptionalSide(), '自分側除去 → 不発 (side:opp 限定)').toBeNull();
    });
  });

  it('【ターン1】: 辞退しても発動済扱い → 同ターン2回目は条件を満たしても不発 (QA)', () => {
    setHuman('self');
    produce(board(), (d) => {
      // 1回目: surface → 辞退 (但し queue 時に ターン1 消費済)
      emitRemoval(d);
      runAllUntilEmpty(d);
      const p1 = _peekPendingEffectOptionalSide();
      expect(p1, '1回目は surface').not.toBeNull();
      applyOptionalAndContinuation(d, p1!, false);
      runAllUntilEmpty(d);
      _clearPendingEffectOptionalSide();
      // 2回目: 同じ条件を満たすが ターン1 消費済 → 再発動しない
      emitRemoval(d);
      runAllUntilEmpty(d);
      expect(_peekPendingEffectOptionalSide(), '2回目は ターン1 消費済で不発').toBeNull();
    });
  });
});
