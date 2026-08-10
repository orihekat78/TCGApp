// B09061 ジェイムズ・ブラック (ct-p09) — ENGINE0 wave 専用 test。
// a1 【登場時】手札から特徴[FBI]のキャラを3枚公開してもよい。そうした場合、引く (handReveal exact-N gate + draw)。
// a2 【ヒラメキ】リムーブの特徴[FBI]のキャラを1枚まで手札に加え、加えた場合 手札を1枚リムーブ
//    (handAddFromRemove chain-gated discard、B03053 a2 同型)。
// 実 engine 経路 (resolver run + _drainAllEffectPicksForTest) を decoy 同梱で踏み、
//   filter (trait FBI ∧ kind character)・exact-N gate・chain gating を card text と 1対1 で固定する。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _drainAllEffectPicksForTest, applyOptionalAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _drainPendingEffectOptionalSide, _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { _drainPendingPublicHandRevealSide, resetPendingAtomSession } from '@/engine/effect/atom-handlers';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState, EffectCtx, Effect } from '@/engine/types';
import { B09061 } from '@/cards/ct-p09/B09061';

function mk(id: string, kind: 'character' | 'event', traits: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind, names: [id], colors: ['赤'], level: 3,
    ap: kind === 'character' ? 1000 : undefined, lp: kind === 'character' ? 1 : undefined,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

const ctxBare = (): EffectCtx => ({ source: { cardId: 'B09061', uid: 'u-jb', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx);
const a1Effect = B09061.abilities[0].effect as Effect;
const a2Effect = B09061.abilities[1].effect as Effect;

function surfaceA1Optional(state: GameState) {
  const effectCtx = ctxBare();
  const resolved = resolveEffectPicks(state, a1Effect, effectCtx, {
    byPlayer: 'self', humanChooser: true, humanPlayer: 'self',
    source: { cardId: 'B09061', abilityId: 'a1' },
  });
  runEffect(state, resolved, effectCtx);
  return _drainPendingEffectOptionalSide();
}

function acceptA1(state: GameState) {
  applyOptionalAndContinuation(state, surfaceA1Optional(state)!, true);
  return _drainPendingEffectPickSide();
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  resetPendingAtomSession();
  registerCardDef(B09061);
  registerCardDef(mk('FBIC1', 'character', ['FBI']));
  registerCardDef(mk('FBIC2', 'character', ['FBI']));
  registerCardDef(mk('FBIC3', 'character', ['FBI']));
  registerCardDef(mk('FBIC4', 'character', ['FBI']));
  registerCardDef(mk('FBIEV', 'event', ['FBI']));      // decoy: FBI だが event (kind 'character' で除外)
  registerCardDef(mk('NONFBI', 'character', ['CIA']));  // decoy: キャラだが非 FBI
  registerCardDef(mk('DK1', 'character', []));
  registerCardDef(mk('DK2', 'character', []));
});

describe('B09061 構造 (authoring 1対1)', () => {
  it('meta', () => {
    expect(B09061.id).toBe('B09061');
    expect(B09061.no).toBe('1003/B09061');
    expect(B09061.kind).toBe('character');
    expect(B09061.traits).toEqual(['FBI']);
    expect(B09061.level).toBe(4);
    expect(B09061.ap).toBe(3000);
    expect(B09061.lp).toBe(1);
  });
  it('a1 = enter chain[handReveal n:3 FBI char, draw]', () => {
    const a1 = B09061.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const optional = a1.effect as {
      kind: string;
      effect: { kind: string; steps: Array<{ verb: string; args: Record<string, unknown> }> };
    };
    expect(optional.kind).toBe('optional');
    expect(optional.effect.kind).toBe('chain');
    const steps = optional.effect.steps;
    expect(steps[0]).toMatchObject({
      verb: 'handReveal',
      args: {
        player: 'self',
        audience: 'all',
        lifetime: 'presentation',
        n: 3,
        minimumPolicy: 'exact',
        filter: { trait: 'FBI', kind: 'character' },
      },
    });
    expect(steps[1]).toMatchObject({ verb: 'draw', args: { player: 'self', n: 1 } });
  });
  it('a2 = hirameki chain[handAddFromRemove max:1 FBI char, discard 1]', () => {
    const a2 = B09061.abilities[1];
    expect(a2.type).toBe('triggered');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    const steps = (a2.effect as { steps: Array<{ verb: string; args: Record<string, unknown> }> }).steps;
    expect(steps[0]).toMatchObject({ verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { trait: 'FBI', kind: 'character' } } });
    expect(steps[1]).toMatchObject({ verb: 'discard', args: { player: 'self', n: 1 } });
  });
});

describe('B09061 a1 — handReveal exact-N gate (実 engine)', () => {
  it('FBIキャラ3枚 → 公開成立 → draw 実行', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['FBIC1', 'FBIC2', 'FBIC3'];
    s.players.self.deck = ['DK1', 'DK2'];
    const pending = acceptA1(s);
    expect(pending).toMatchObject({ atomVerb: 'handReveal', nMin: 3, nMax: 3, minimumPolicy: 'exact' });
    const pickedUids = pending!.candidates.map(candidate => candidate.uid);
    applyPickAndContinuation(s, pending!, pickedUids[0]!, pickedUids);
    expect(_drainPendingPublicHandRevealSide()).toMatchObject({
      owner: 'self',
      audience: 'all',
      cardIds: ['FBIC1', 'FBIC2', 'FBIC3'],
      handSnapshot: ['FBIC1', 'FBIC2', 'FBIC3'],
      lifetime: 'presentation',
      source: { cardId: 'B09061', uid: 'u-jb' },
    });
    expect(s.players.self.hand).toContain('DK1');
    expect(s.players.self.hand).toContain('FBIC1');
    expect(s.players.self.deck).toEqual(['DK2']);
  });

  it('FBIキャラ2 + FBIイベント1 (kind decoy) → FBI char 候補2<3 → gate → draw skip', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['FBIC1', 'FBIC2', 'FBIEV', 'NONFBI']; // char FBI=2 (FBIEV は event で除外)
    s.players.self.deck = ['DK1', 'DK2'];
    expect(acceptA1(s)).toBeNull();
    expect(s.players.self.hand).not.toContain('DK1');
    expect(s.players.self.deck).toEqual(['DK1', 'DK2']);
  });

  it('FBIキャラ4枚 (>3) → 公開成立 → draw 実行', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['FBIC1', 'FBIC2', 'FBIC3', 'FBIC4'];
    s.players.self.deck = ['DK1', 'DK2'];
    const pending = acceptA1(s);
    const pickedUids = pending!.candidates.slice(0, 3).map(candidate => candidate.uid);
    applyPickAndContinuation(s, pending!, pickedUids[0]!, pickedUids);
    expect(s.players.self.hand).toContain('DK1');
    expect(s.players.self.deck).toEqual(['DK2']);
  });

  it('任意効果を辞退 → 公開せず draw も実行しない', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['FBIC1', 'FBIC2', 'FBIC3'];
    s.players.self.deck = ['DK1', 'DK2'];
    const optional = surfaceA1Optional(s);
    expect(optional).not.toBeNull();
    applyOptionalAndContinuation(s, optional!, false);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(s.players.self.hand).toEqual(['FBIC1', 'FBIC2', 'FBIC3']);
    expect(s.players.self.deck).toEqual(['DK1', 'DK2']);
  });
});

describe('B09061 a2 — hirameki handAddFromRemove → 加えた場合 discard (実 engine)', () => {
  it('リムーブに FBIキャラ → 手札に加える + 手札を1枚 discard', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.remove = ['FBIC1', 'NONFBI', 'FBIEV']; // FBI char=1、decoy 2
    s.players.self.hand = ['DK1'];                         // discard 用の手札
    s.players.self.deck = ['DK2'];
    const after = produce(s, (d) => { runEffect(d, a2Effect, ctxBare()); _drainAllEffectPicksForTest(d); });
    expect(after.players.self.hand).toContain('FBIC1');    // FBIキャラ追加
    expect(after.players.self.remove).not.toContain('FBIC1'); // remove から splice
    // 加えた1枚 + discard1枚 = hand 純増減: 元1(DK1) +1(FBIC1) -1(discard) = 1枚
    expect(after.players.self.hand.length).toBe(1);
  });

  it('リムーブに FBIキャラ無し (decoy のみ) → 加えない → discard 不発火 (chain gate)', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.remove = ['NONFBI', 'FBIEV']; // FBI char=0 (NONFBI=非FBI、FBIEV=event)
    s.players.self.hand = ['DK1', 'DK2'];
    const after = produce(s, (d) => { runEffect(d, a2Effect, ctxBare()); _drainAllEffectPicksForTest(d); });
    expect(after.players.self.hand).toEqual(['DK1', 'DK2']); // discard 不発火 (手札不変)
    expect(after.players.self.remove).toEqual(['NONFBI', 'FBIEV']); // remove 不変
  });

  // edge (review MINOR): 加えた FBIキャラ自身が唯一の手札のとき discard 対象になれるか
  // (既存 test は discard 用に別手札を seed していたため曖昧だった)。
  it('手札0 + リムーブFBIキャラ1 → FBIキャラ追加 → その1枚を discard (hand 空に戻る)', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.remove = ['FBIC1'];
    s.players.self.hand = []; // discard 対象は「加えた FBIキャラ」のみ
    const after = produce(s, (d) => { runEffect(d, a2Effect, ctxBare()); _drainAllEffectPicksForTest(d); });
    expect(after.players.self.hand).toEqual([]);           // 加えた1枚を discard → 手札0
    expect(after.players.self.remove).toContain('FBIC1');  // discard で remove へ戻る
  });
});

// review MINOR: AI-drain は greedy ゆえ「候補あり×human が辞退」path を踏めない (false-green 回避)。
// 実 UI dispatch が呼ぶ apply-pick の human 経路 (applyPickAndContinuation / applyPickSkipAndContinuation false)
// を直接踏み、handReveal が初の handReveal 採用カードである human pick surfacing を empirical に固定する。
describe('B09061 — human pick 経路 (apply-pick、AI-drain ではない)', () => {
  it('a1 human: FBIキャラ3 → exact-Nで3枚公開 → reveal(zone不変) + draw', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['FBIC1', 'FBIC2', 'FBIC3'];
    s.players.self.deck = ['DK1', 'DK2'];
    const pending = acceptA1(s);
    expect(pending?.atomVerb).toBe('handReveal');       // human に surface されるのは handReveal pick
    expect(pending?.nMin).toBe(3);                       // exact-N (min:3)
    const pickedUids = pending!.candidates.map(candidate => candidate.uid);
    applyPickAndContinuation(s, pending!, pickedUids[0]!, pickedUids);
    expect(s.players.self.hand).toContain('DK1');        // continuation の draw が発火 (human 経路)
    expect(s.players.self.hand).toContain('FBIC1');      // 公開=zone 不変で手札残存
    expect(s.players.self.deck).toEqual(['DK2']);
  });

  it('a2 human 辞退 (候補あり) → discard 不発火 (chain-origin decline = remainder skip)', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.remove = ['FBIC1', 'NONFBI']; // FBIキャラ候補あり (=辞退 path を踏む)
    s.players.self.hand = ['DK1', 'DK2'];
    runEffect(s, a2Effect, ctxBare());
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('handAddFromRemove');
    applyPickSkipAndContinuation(s, pending!, false);    // human が「加えない」を選択 (UI dispatch と同経路)
    expect(s.players.self.hand).toEqual(['DK1', 'DK2']); // 加えていない → discard も不発火 (手札不変)
    expect(s.players.self.remove).toContain('FBIC1');    // 加えていない (remove 残存)
  });
});
