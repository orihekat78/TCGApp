// tests/cards/night-wC2b/invoke-hirameki
// engine night-wave WC2b (2026-07-11): invokeHiramekiOfCard verb + B06023/B06034。
//   別カードの【ヒラメキ】effect を明示発動 (証拠を表向きにした結果 → その【ヒラメキ】を発動)。
//   B06036/B06036P は DEFER (コスト flip 3 の中から「1枚まで選び」= cost-flipped-ids を候補とする
//   pick source が engine 未実装。verb + $cost.ids channel は本 wave で解禁済)。
// rules: 10-action-event.md, 15/17/21 + B06023/B06034/B06036 公式Q&A。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { registerHiramekiListener, _drainPendingHirameki, _resetPendingHirameki, _resetHiramekiRegistered } from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolve, runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { pay } from '@/engine/cost/pay';
import { char as charRead } from '@/engine/read/char';
import { validateCards } from '@/engine/effect/validate';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { B06023 } from '@/cards/ct-p06/B06023';
import { B06034 } from '@/cards/ct-p06/B06034';
import { B06049 } from '@/cards/ct-p06/B06049';
import { D03004 } from '@/cards/ct-d03/D03004';
import type { AbilityDef, CardDef, Effect, EffectCtx, GameState, SceneCharacter } from '@/engine/types';

type Player = 'self' | 'opp';
const setHuman = (v: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = v; };

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
// 【ヒラメキ】draw1 ability
const hirDraw: AbilityDef = {
  id: 'h1', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】draw1', ruleRefs: [],
};
// 【ヒラメキ】draw1 だが 【解決編】gate
const hirDrawKaiketsu: AbilityDef = {
  ...hirDraw, id: 'h1', condition: { kind: 'caseStatus', status: '解決編' } as never,
};
// 【ヒラメキ】= 「アクション中のキャラ ($trigger.byUid) を AP-1000」= trigger-依存 dyn
const hirTrigDyn: AbilityDef = {
  id: 'h1', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$trigger.byUid', delta: -1000, scope: 'turn' } },
  description: '【ヒラメキ】$trigger.byUid AP-1000', ruleRefs: [],
};

const HIR_DRAW = mkChar('HIR_DRAW', { traits: ['YAIBA'], abilities: [hirDraw] });          // YAIBA + hirameki
const HIR_NONYAIBA = mkChar('HIR_NONYAIBA', { traits: [], abilities: [hirDraw] });          // hirameki だが非YAIBA
const NO_HIR = mkChar('NO_HIR', { traits: ['YAIBA'], abilities: [] });                      // YAIBA だが hirameki 無
const HIR_KAIKETSU = mkChar('HIR_KAIKETSU', { traits: ['YAIBA'], abilities: [hirDrawKaiketsu] });
const HIR_TRIGDYN = mkChar('HIR_TRIGDYN', { traits: ['YAIBA'], abilities: [hirTrigDyn] });
const TARGET = mkChar('TARGET', { ap: 5000 });

const sc = (cardId: string, uid: string): SceneCharacter =>
  ({
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  } as unknown as SceneCharacter);

const invoke = (args: Record<string, unknown>): Effect => ({ kind: 'atom', verb: 'invokeHiramekiOfCard', args } as never);
const invokeLeave = (args: Record<string, unknown>): Effect => ({ kind: 'atom', verb: 'invokeLeaveToRemoveOfCard', args } as never);
const srcCtx = (player: Player = 'self'): EffectCtx =>
  ({ source: { cardId: 'PLAIN', uid: 'src#1', abilityId: 'a1', player, area: 'scene' }, bindings: {} } as EffectCtx);

function baseState(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['D1', 'D2', 'D3', 'D4'];
  s.players.opp.deck = ['O1', 'O2'];
  return s;
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetHiramekiRegistered(); _resetPendingHirameki();
  resetDefRegistry(); _resetUidCounter(); _clearPendingEffectPickQueue();
  for (const d of [HIR_DRAW, HIR_NONYAIBA, NO_HIR, HIR_KAIKETSU, HIR_TRIGDYN, TARGET, mkChar('PLAIN'), mkChar('D1'), mkChar('D2')]) registerCardDef(d);
  registerCardDef(B06023); registerCardDef(B06034); registerCardDef(B06049); registerCardDef(D03004);
  registerTriggeredListener(); registerHiramekiListener();
  setHuman(null);
  useGameStateStore.setState({ gameState: null, activeActionId: null, pendingHirameki: null, pendingMisread: null, pendingEffectPick: null, pendingEffectOptional: null });
});

describe('shape / validate', () => {
  it('B06023 / B06034 が validateCards を通る', () => {
    expect(validateCards([B06023]).ok).toBe(true);
    expect(validateCards([B06034]).ok).toBe(true);
  });
});

describe('BUG-249 public direct invoke order gate', () => {
  it('confirms B06049.a3 before creating its human pick', () => {
    setHuman('self');
    const s = baseState();
    mutate.case.toResolved(s, 'self');
    s.players.self.scene = [sc('B06023', 'B06023#0')];
    s.players.self.evidence = [{ cardId: B06049.id, faceUp: false, origin: { turn: 1, via: 'reasoning' } }] as GameState['players']['self']['evidence'];
    s.players.opp.scene = [sc('TARGET', 'sleep-target')];
    useGameStateStore.setState({ gameState: s });

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'B06023#0', abilId: 'a2', costParams: { flipFaceUpEvidence: { indices: [0] } } } as never).ok).toBe(true);
    expect(dispatchEngineAction({ type: 'optionalResolve', run: true }).ok).toBe(true);
    const group = resolve.pendingOwnerOrderGroup(useGameStateStore.getState().gameState!, 'self');
    expect(group.map(entry => entry.source.cardId)).toEqual(['B06023', B06049.id]);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    expect(dispatchEngineAction({ type: 'resolveEffectOrder', player: 'self', entryIds: group.map(entry => entry.id) }).ok).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick?.source).toMatchObject({ cardId: B06049.id, abilityId: 'a3' });
  });
});

describe('invokeHiramekiOfCard verb (直接 runEffect)', () => {
  it.each([
    ['hirameki', B06049.id, 'a3', invoke({ cardId: B06049.id, player: 'self' })],
    ['leave-to-remove', D03004.id, 'a1', invokeLeave({ cardId: D03004.id, player: 'self' })],
  ] as const)('BUG-249: direct %s child pick waits for its new owner-order confirmation', (_kind, cardId, abilityId, effect) => {
    setHuman('self');
    const after = produce(baseState(), (d) => {
      d.turn.player = 'opp'; // D03004 a1's printed opponent-turn condition.
      d.players.opp.scene = [sc('TARGET', 'sleep-target')];
      d.players.opp.scene[0]!.state = 'sleep';
      const parent = event.queue(
        d,
        effect,
        { player: 'self', cardId: 'PARENT', abilityId: 'a1', description: 'parent' },
        'manual',
        undefined,
        undefined,
        { triggerBatch: 7, ownerOrderConfirmed: true },
      );
      event.queue(
        d,
        { kind: 'atom', verb: 'noop', args: {} } as never,
        { player: 'self', cardId: 'SIBLING', abilityId: 'a2', description: 'sibling' },
        'manual',
        undefined,
        undefined,
        { triggerBatch: 7, ownerOrderConfirmed: true },
      );

      resolve.runOne(d, parent);
    });
    setHuman(null);

    const child = after.pendingEffects.find(entry => entry.source.cardId === cardId);
    expect(child?.source.abilityId).toBe(abilityId);
    expect(child?.deferredPicks).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(resolve.pendingOwnerOrderGroup(after, 'self').map(entry => entry.source.cardId))
      .toEqual(['SIBLING', cardId]);
  });

  it('BUG-249: confirmed parent direct-invoke child is a newly orderable labeled entry', () => {
    setHuman('self');
    const after = produce(baseState(), (d) => {
      const parent = event.queue(
        d,
        invoke({ cardId: 'HIR_DRAW', trait: 'YAIBA', player: 'self' }),
        { player: 'self', cardId: 'PARENT', abilityId: 'a1', description: 'parent' },
        'manual',
        undefined,
        undefined,
        { triggerBatch: 7, ownerOrderConfirmed: true },
      );
      event.queue(
        d,
        { kind: 'atom', verb: 'noop', args: {} } as never,
        { player: 'self', cardId: 'SIBLING', abilityId: 'a2', description: 'sibling' },
        'manual',
        undefined,
        undefined,
        { triggerBatch: 7, ownerOrderConfirmed: true },
      );

      resolve.runOne(d, parent);
    });
    setHuman(null);

    const child = after.pendingEffects.find(entry => entry.source.cardId === 'HIR_DRAW');
    expect(child?.source).toMatchObject({
      player: 'self', cardId: 'HIR_DRAW', abilityId: 'h1', description: hirDraw.description,
    });
    expect(child?.resumesCurrentEffect).toBeUndefined();
    expect(child?.ownerOrderConfirmed).toBeUndefined();
    expect(resolve.pendingOwnerOrderGroup(after, 'self').map(entry => entry.source.cardId))
      .toEqual(['SIBLING', 'HIR_DRAW']);
  });

  it('対象ヒラメキ effect が実際に走る (draw1)', () => {
    const s = baseState();
    const after = produce(s, (d) => { runEffect(d, invoke({ cardId: 'HIR_DRAW', trait: 'YAIBA', player: 'self' }), srcCtx()); runAllUntilEmpty(d); });
    expect(after.players.self.hand.length, 'HIR_DRAW の【ヒラメキ】draw1 発動').toBe(1);
  });

  it('ヒラメキ無しカード (NO_HIR) → no-op', () => {
    const s = baseState();
    const after = produce(s, (d) => { runEffect(d, invoke({ cardId: 'NO_HIR', trait: 'YAIBA', player: 'self' }), srcCtx()); runAllUntilEmpty(d); });
    expect(after.players.self.hand.length).toBe(0);
  });

  it('trait gate: 非YAIBA card + trait:YAIBA → no-op / trait 省略なら発動 (印字判定)', () => {
    const gated = produce(baseState(), (d) => { runEffect(d, invoke({ cardId: 'HIR_NONYAIBA', trait: 'YAIBA', player: 'self' }), srcCtx()); runAllUntilEmpty(d); });
    expect(gated.players.self.hand.length, 'trait 不一致 → no-op').toBe(0);
    const nogate = produce(baseState(), (d) => { runEffect(d, invoke({ cardId: 'HIR_NONYAIBA', player: 'self' }), srcCtx()); runAllUntilEmpty(d); });
    expect(nogate.players.self.hand.length, 'trait 省略 → 発動').toBe(1);
  });

  it('未登録 cardId → silent no-op', () => {
    const after = produce(baseState(), (d) => { runEffect(d, invoke({ cardId: 'UNKNOWN_XYZ', player: 'self' }), srcCtx()); runAllUntilEmpty(d); });
    expect(after.players.self.hand.length).toBe(0);
  });

  it('ability.condition (【解決編】) honor: 未達で invoke → 発動できるが何も起こらない', () => {
    const jiken = produce(baseState(), (d) => { runEffect(d, invoke({ cardId: 'HIR_KAIKETSU', trait: 'YAIBA', player: 'self' }), srcCtx()); runAllUntilEmpty(d); });
    expect(jiken.players.self.hand.length, '事件編 → skip').toBe(0);
    const kaiketsu = produce(baseState(), (d) => { mutate.case.toResolved(d, 'self'); runEffect(d, invoke({ cardId: 'HIR_KAIKETSU', trait: 'YAIBA', player: 'self' }), srcCtx()); runAllUntilEmpty(d); });
    expect(kaiketsu.players.self.hand.length, '解決編 → 発動').toBe(1);
  });

  it('trigger-依存 dyn ヒラメキ ($trigger.byUid) を invoke → no crash / no-op (unbound)', () => {
    const s = produce(baseState(), (d) => { d.players.self.scene = [sc('TARGET', 'tgt#1')]; });
    const after = produce(s, (d) => { runEffect(d, invoke({ cardId: 'HIR_TRIGDYN', trait: 'YAIBA', player: 'self' }), srcCtx()); runAllUntilEmpty(d); });
    expect(charRead.ap(after, 'tgt#1'), 'byUid unbound → AP 修正なし').toBe(5000);
    expect(after.players.self.hand.length).toBe(0);
  });

  it('owner=opp pin: player:opp で invoke → opp が draw (source 相対)', () => {
    const after = produce(baseState(), (d) => { runEffect(d, invoke({ cardId: 'HIR_DRAW', trait: 'YAIBA', player: 'opp' }), srcCtx('self')); runAllUntilEmpty(d); });
    expect(after.players.opp.hand.length, 'opp が draw').toBe(1);
    expect(after.players.self.hand.length, 'self は draw せず').toBe(0);
  });

  it('cardIds 配列: 各 cardId を順に invoke', () => {
    const after = produce(baseState(), (d) => { runEffect(d, invoke({ cardIds: ['HIR_DRAW', 'HIR_DRAW'], trait: 'YAIBA', player: 'self' }), srcCtx()); runAllUntilEmpty(d); });
    expect(after.players.self.hand.length, '2 回 invoke → draw2').toBe(2);
  });
});

describe('$cost.flipFaceUpEvidence.ids channel (pay + resolveBindRef $cost)', () => {
  it('flipFaceUpEvidence cost が表向きにした cardId を invoke (B06023 a2 型)', () => {
    const s = produce(baseState(), (d) => {
      d.players.self.evidence = [{ cardId: 'HIR_DRAW', faceUp: false, origin: { turn: 1, via: 'reasoning' } }] as GameState['players']['self']['evidence'];
    });
    const ctx: EffectCtx = {
      source: { cardId: 'B06023', uid: 'B06023#0', abilityId: 'a2', player: 'self', area: 'scene' },
      bindings: {}, dyn: { costParams: { flipFaceUpEvidence: { indices: [0] } } },
    } as unknown as EffectCtx;
    const after = produce(s, (d) => {
      const acc = { paidItems: [] as unknown[] };
      pay(d, { kind: 'flipFaceUpEvidence', n: { min: 1, max: 1 } } as never, ctx, acc as never);
      // $cost.flipFaceUpEvidence.ids が記録され invoke で解決される
      runEffect(d, invoke({ cardIds: '$cost.flipFaceUpEvidence.ids', trait: 'YAIBA', player: 'self' }), ctx);
      runAllUntilEmpty(d);
    });
    expect(ctx.costPaid?.['flipFaceUpEvidence'], 'ids 記録').toMatchObject({ count: 1, ids: ['HIR_DRAW'] });
    expect(after.players.self.evidence[0].faceUp, 'コストで表向き化').toBe(true);
    expect(after.players.self.hand.length, 'HIR_DRAW の【ヒラメキ】draw1 発動').toBe(1);
  });
});

// production dispatch: B06023 金棒博士【宣言】a2 = cost flipFaceUpEvidence(1) → optional invoke。
// optional resume ctx が costPaid を復元 (WC2b fix) → $cost.flipFaceUpEvidence.ids が解決される。
describe('B06023 金棒博士 production (declared → cost flip → optional invoke)', () => {
  function board(): GameState {
    const s = baseState();
    mutate.case.toResolved(s, 'self'); // 【解決編】
    s.players.self.scene = [sc('B06023', 'B06023#0')];
    s.players.self.evidence = [{ cardId: 'HIR_DRAW', faceUp: false, origin: { turn: 1, via: 'reasoning' } }] as GameState['players']['self']['evidence'];
    return s;
  }
  function declare(s: GameState): void {
    useGameStateStore.setState({ gameState: s });
    const r = dispatchEngineAction({ type: 'declaredAbility', uid: 'B06023#0', abilId: 'a2', costParams: { flipFaceUpEvidence: { indices: [0] } } } as never);
    expect(r.ok, `declaredAbility ok: ${r.error ?? ''}`).toBe(true);
  }

  it('run:true → cost で HIR_DRAW 表向き化 → invoke で HIR_DRAW ヒラメキ draw', () => {
    setHuman('self');
    declare(board());
    expect(useGameStateStore.getState().pendingEffectOptional, 'invoke optional surface').not.toBeNull();
    expect(dispatchEngineAction({ type: 'optionalResolve', run: true }).ok).toBe(true);
    const group = resolve.pendingOwnerOrderGroup(useGameStateStore.getState().gameState!, 'self');
    expect(group.map(entry => entry.source.cardId)).toEqual(['B06023', 'HIR_DRAW']);
    expect(dispatchEngineAction({ type: 'resolveEffectOrder', player: 'self', entryIds: group.map(entry => entry.id) }).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence[0].faceUp, 'コストで表向き化').toBe(true);
    expect(after.players.self.hand.length).toBe(1);
  });

  it('run:false (decline) → cost flip のみ / invoke draw なし', () => {
    setHuman('self');
    declare(board());
    expect(dispatchEngineAction({ type: 'optionalResolve', run: false }).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence[0].faceUp, 'コスト flip は実行済').toBe(true);
    expect(after.players.self.hand.length, 'decline → invoke なし').toBe(0);
  });
});

// production dispatch: B06034 鬼丸城 event の【ヒラメキ】(a2) fire → flip pick → conditional
// (boundMatchesFilter $flipped {trait:YAIBA, keyword:ヒラメキ}) → inner optional invoke。
// 印字の 2 独立意思決定 (①「1つまで選び表向きにする」pick / ②「発動させてもよい」optional) が
// 別 prompt で再現されること (T2 review 指摘) を pin する。
describe('B06034 鬼丸城 production (【ヒラメキ】fire → flip pick → conditional → inner optional invoke)', () => {
  function board(faceDownIds: string[] = ['HIR_DRAW']): GameState {
    const s = baseState();
    mutate.case.toResolved(s, 'self'); // 【解決編】
    s.players.self.evidence = [
      ...faceDownIds.map((cardId) => ({ cardId, faceUp: false, origin: { turn: 1, via: 'reasoning' } })),
      { cardId: 'B06034', faceUp: true, origin: { turn: 1, via: 'reasoning' } }, // action[事件] removed 契機
    ] as GameState['players']['self']['evidence'];
    return s;
  }
  function fire(s: GameState): void {
    event.emit(s, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B06034' }, byUid: 'atk' }, { player: 'opp', uid: 'atk' });
    const pending = _drainPendingHirameki();
    expect(pending, 'B06034【ヒラメキ】検出').not.toBeNull();
    useGameStateStore.setState({ gameState: s, pendingHirameki: pending });
    expect(dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' }).ok).toBe(true);
  }
  function resolveFlipPick(cardId: string): void {
    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick, 'flip pick surface').not.toBeNull();
    const c = pick.candidates.find((x) => x.cardId === cardId)!;
    expect(c, `候補に ${cardId}`).toBeTruthy();
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: c.uid }).ok).toBe(true);
  }

  it('① fire → flip pick(HIR_DRAW) → inner optional run → HIR_DRAW ヒラメキ draw', () => {
    setHuman('self');
    fire(board());
    resolveFlipPick('HIR_DRAW');
    // conditional true (YAIBA + ヒラメキ印字) → inner optional surface
    expect(useGameStateStore.getState().pendingEffectOptional, 'inner optional surface').not.toBeNull();
    expect(dispatchEngineAction({ type: 'optionalResolve', run: true }).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence.find((e) => e.cardId === 'HIR_DRAW')?.faceUp, 'HIR_DRAW 表向き化').toBe(true);
    expect(after.players.self.hand.length, 'invoke → HIR_DRAW draw1').toBe(1);
  });

  it('② flip 実行 → inner optional decline → 証拠は表のまま・invoke なし (「表向きにしたが発動しない」)', () => {
    setHuman('self');
    fire(board());
    resolveFlipPick('HIR_DRAW');
    expect(useGameStateStore.getState().pendingEffectOptional, 'inner optional surface').not.toBeNull();
    expect(dispatchEngineAction({ type: 'optionalResolve', run: false }).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence.find((e) => e.cardId === 'HIR_DRAW')?.faceUp, 'flip は実行済 (表のまま)').toBe(true);
    expect(after.players.self.hand.length, 'decline → invoke なし').toBe(0);
  });

  it('③ 非該当 flip (hirameki 持ちだが非YAIBA) → conditional false → optional 非 surface・invoke なし', () => {
    setHuman('self');
    fire(board(['HIR_NONYAIBA']));
    resolveFlipPick('HIR_NONYAIBA');
    expect(useGameStateStore.getState().pendingEffectOptional, '非YAIBA → optional 出さない').toBeNull();
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence.find((e) => e.cardId === 'HIR_NONYAIBA')?.faceUp, 'flip は実行済').toBe(true);
    expect(after.players.self.hand.length, 'invoke なし').toBe(0);
  });

  it("③' 非該当 flip (YAIBA だが ヒラメキ印字なし) → optional 非 surface", () => {
    setHuman('self');
    fire(board(['NO_HIR']));
    resolveFlipPick('NO_HIR');
    expect(useGameStateStore.getState().pendingEffectOptional, 'ヒラメキ無し → optional 出さない').toBeNull();
    expect(useGameStateStore.getState().gameState!.players.self.hand.length).toBe(0);
  });

  it('④ 0枚 flip (pick decline) → 何も起きない (flip なし・optional 非 surface)', () => {
    setHuman('self');
    fire(board());
    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick, 'flip pick surface').not.toBeNull();
    // 「1つまで」= 0 可 (rules/15): pick skip
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null }).ok).toBe(true);
    expect(useGameStateStore.getState().pendingEffectOptional, '0枚 → optional 出さない').toBeNull();
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence.find((e) => e.cardId === 'HIR_DRAW')?.faceUp, 'flip なし').toBe(false);
    expect(after.players.self.hand.length, 'invoke なし').toBe(0);
  });
});
