// engine mega-wave W6 — structural probe (step1: declareName 統合)
// step1: declareName{bind} verb + EffectCtx.declaredNames + boundNameMatchesDeclared / boundIsMr cond
//        + $declared.<key>[.sceneNameCount] dyn root
// rules: 15-abilities-effects.md (「してもよい」optional / 効果解決順) / 19-special-rules.md (複数名カード)
// 設計: .tmp/_w6_specs.json synthesis step1 — rows 49/53/999 の 3-way storage conflict を
//       EffectCtx.declaredNames: Record<string,string> + 単一 verb declareName に統一 (Candidate 汚染案は棄却)。

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { evalDyn } from '@/engine/dyn/eval';
import { evalCond } from '@/engine/cond/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { startTurn } from '@/engine/flow/turn';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { runAtom } from '@/engine/effect/atom-handlers';
import { run as runEffect } from '@/engine/effect/resolver';
import type { GameState, SceneCharacter, CardDef, EffectCtx } from '@/engine/types';
import { makeChar, makeCtx } from '../helpers/fixtures';

function defOf(overrides: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: overrides.id,
    no: overrides.no ?? 'NO',
    kind: 'character',
    names: ['default-name'],
    colors: [],
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...overrides,
  };
}

function withScene(s: GameState, p: 'self' | 'opp', chars: SceneCharacter[]): GameState {
  return {
    ...s,
    players: { ...s.players, [p]: { ...s.players[p], scene: chars } },
  };
}

describe('megaw6 step1 — declareName atom (EffectCtx.declaredNames writer)', () => {
  beforeEach(() => _resetRegistry());

  it('writes ctx.dyn.declaredName into ctx.declaredNames[bind]', () => {
    const s = createEmptyGameState();
    const ctx = makeCtx({ dyn: { declaredName: '工藤新一' } });
    runAtom(s, 'declareName', { bind: 'named' }, ctx);
    expect(ctx.declaredNames?.named).toBe('工藤新一');
  });

  it('does not serialize the declared name or binding key into the legacy fallback log', () => {
    const s = createEmptyGameState();
    const privateName = 'PRIVATE-DECLARED-NAME';
    const privateBind = 'PRIVATE-BIND-KEY';
    const ctx = makeCtx({ dyn: { declaredName: privateName } });

    runAtom(s, 'declareName', { bind: privateBind }, ctx);

    expect(s.log).toEqual([
      expect.objectContaining({ action: 'effect:declareName', result: 'supplied' }),
    ]);
    expect(JSON.stringify(s.log)).not.toContain(privateName);
    expect(JSON.stringify(s.log)).not.toContain(privateBind);
  });

  it('unsupplied dyn → empty-string fallback, no throw (defensive, AI/smoke safety)', () => {
    const s = createEmptyGameState();
    const ctx = makeCtx();
    expect(() => runAtom(s, 'declareName', { bind: 'named' }, ctx)).not.toThrow();
    expect(ctx.declaredNames?.named).toBe('');
  });

  it('whitespace-only supplied name is trimmed to empty string', () => {
    const s = createEmptyGameState();
    const ctx = makeCtx({ dyn: { declaredName: '   ' } });
    runAtom(s, 'declareName', { bind: 'named' }, ctx);
    expect(ctx.declaredNames?.named).toBe('');
  });
});

describe('megaw6 step1 — boundNameMatchesDeclared condition', () => {
  beforeEach(() => _resetRegistry());

  function ctxWith(bindCards: string[], declared: string | undefined): EffectCtx {
    const ctx = makeCtx({
      bindings: bindCards.length
        ? { removed: bindCards.map(cardId => ({ kind: 'card' as const, cardId, area: 'file' as const, player: 'opp' as const })) }
        : {},
    });
    if (declared !== undefined) ctx.declaredNames = { named: declared };
    return ctx;
  }

  it('true when a bound card printed name equals declared name', () => {
    registerCardDef(defOf({ id: 'X1', names: ['工藤新一'] }));
    const s = createEmptyGameState();
    expect(evalCond(s, { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' }, ctxWith(['X1'], '工藤新一'))).toBe(true);
  });

  it('true via rules/19 split-name component (複数名カード)', () => {
    registerCardDef(defOf({ id: 'X2', names: ['江戸川コナン&工藤新一'] }));
    const s = createEmptyGameState();
    expect(evalCond(s, { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' }, ctxWith(['X2'], '工藤新一'))).toBe(true);
  });

  it('false when names differ', () => {
    registerCardDef(defOf({ id: 'X3', names: ['毛利小五郎'] }));
    const s = createEmptyGameState();
    expect(evalCond(s, { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' }, ctxWith(['X3'], '工藤新一'))).toBe(false);
  });

  it('false when declared name is empty / missing / binding empty', () => {
    registerCardDef(defOf({ id: 'X4', names: ['工藤新一'] }));
    const s = createEmptyGameState();
    expect(evalCond(s, { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' }, ctxWith(['X4'], ''))).toBe(false);
    expect(evalCond(s, { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' }, ctxWith(['X4'], undefined))).toBe(false);
    expect(evalCond(s, { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' }, ctxWith([], '工藤新一'))).toBe(false);
  });

  it('any-match over multi-card binding (「指定したカード名のカードがリムーブされた場合」)', () => {
    registerCardDef(defOf({ id: 'Y1', names: ['毛利蘭'] }));
    registerCardDef(defOf({ id: 'Y2', names: ['工藤新一'] }));
    const s = createEmptyGameState();
    expect(evalCond(s, { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' }, ctxWith(['Y1', 'Y2'], '工藤新一'))).toBe(true);
  });
});

describe('megaw6 step1 — boundIsMr condition (B06085 gate)', () => {
  beforeEach(() => _resetRegistry());

  it('true when bound[0] is an MR card (rarity prefix)', () => {
    registerCardDef(defOf({ id: 'MR1', rarity: 'MR' }));
    const s = createEmptyGameState();
    const ctx = makeCtx({ bindings: { chosen: [{ kind: 'char', uid: 'u1', cardId: 'MR1', player: 'opp' }] } });
    expect(evalCond(s, { kind: 'boundIsMr', bindKey: 'chosen' }, ctx)).toBe(true);
  });

  it('false when bound[0] is not MR', () => {
    registerCardDef(defOf({ id: 'C9', rarity: 'C' }));
    const s = createEmptyGameState();
    const ctx = makeCtx({ bindings: { chosen: [{ kind: 'char', uid: 'u1', cardId: 'C9', player: 'opp' }] } });
    expect(evalCond(s, { kind: 'boundIsMr', bindKey: 'chosen' }, ctx)).toBe(false);
  });

  it('false when binding missing or empty', () => {
    const s = createEmptyGameState();
    expect(evalCond(s, { kind: 'boundIsMr', bindKey: 'chosen' }, makeCtx())).toBe(false);
    expect(evalCond(s, { kind: 'boundIsMr', bindKey: 'chosen' }, makeCtx({ bindings: { chosen: [] } }))).toBe(false);
  });
});

describe('megaw6 step1 — $declared.<key> dyn root', () => {
  beforeEach(() => _resetRegistry());

  it('$declared.<key> returns declared string; missing key → empty string (defensive)', () => {
    const s = createEmptyGameState();
    const ctx = makeCtx();
    ctx.declaredNames = { named: '工藤新一' };
    expect(evalDyn(s, '$declared.named', ctx)).toBe('工藤新一');
    expect(evalDyn(s, '$declared.other', makeCtx())).toBe('');
  });

  it('$declared.<key>.sceneNameCount counts own scene chars incl. split-name components', () => {
    registerCardDef(defOf({ id: 'N1', names: ['工藤新一'] }));
    registerCardDef(defOf({ id: 'N2', names: ['江戸川コナン&工藤新一'] }));
    registerCardDef(defOf({ id: 'N3', names: ['毛利蘭'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [
      makeChar({ uid: 'u1', cardId: 'N1' }),
      makeChar({ uid: 'u2', cardId: 'N2' }),
      makeChar({ uid: 'u3', cardId: 'N3' }),
    ]);
    const ctx = makeCtx();
    ctx.declaredNames = { named: '工藤新一' };
    expect(evalDyn(s, '$declared.named.sceneNameCount', ctx)).toBe(2);
  });

  it('sceneNameCount is 0 when no match or declared empty', () => {
    registerCardDef(defOf({ id: 'N4', names: ['毛利蘭'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'u1', cardId: 'N4' })]);
    const ctx = makeCtx();
    ctx.declaredNames = { named: '工藤新一' };
    expect(evalDyn(s, '$declared.named.sceneNameCount', ctx)).toBe(0);
    const ctx2 = makeCtx();
    ctx2.declaredNames = { named: '' };
    expect(evalDyn(s, '$declared.named.sceneNameCount', ctx2)).toBe(0);
  });

  it('sceneNameCount counts ctx.source.player side (opp source counts opp scene)', () => {
    registerCardDef(defOf({ id: 'N5', names: ['工藤新一'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'opp', [makeChar({ uid: 'o1', cardId: 'N5' })]);
    const ctx = makeCtx({ source: { player: 'opp', area: 'scene' } });
    ctx.declaredNames = { named: '工藤新一' };
    expect(evalDyn(s, '$declared.named.sceneNameCount', ctx)).toBe(1);
  });
});

describe('megaw6 step1 — integration: declareName → conditional(boundNameMatchesDeclared)', () => {
  beforeEach(() => _resetRegistry());

  it('B09108 型 sequence: 一致時のみ then 枝 (draw) が実行される', () => {
    registerCardDef(defOf({ id: 'T1', names: ['工藤新一'] }));
    const s = createEmptyGameState();
    s.players.self.deck.push('D1', 'D2');
    // 手動で file 除去済み想定の bind を作る (fileRemoveTop 自体は既出荷 — ここは結線のみ検証)
    const ctx = makeCtx({ dyn: { declaredName: '工藤新一' } });
    ctx.bindings.removed = [{ kind: 'card', cardId: 'T1', area: 'file', player: 'opp' }];
    const before = s.players.self.hand.length;
    runEffect(s, {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
        {
          kind: 'conditional',
          if: { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' },
          then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        },
      ],
    }, ctx);
    expect(s.players.self.hand.length).toBe(before + 1);
  });

  it('不一致時は then 枝が実行されない', () => {
    registerCardDef(defOf({ id: 'T2', names: ['毛利蘭'] }));
    const s = createEmptyGameState();
    s.players.self.deck.push('D1');
    const ctx = makeCtx({ dyn: { declaredName: '工藤新一' } });
    ctx.bindings.removed = [{ kind: 'card', cardId: 'T2', area: 'file', player: 'opp' }];
    const before = s.players.self.hand.length;
    runEffect(s, {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
        {
          kind: 'conditional',
          if: { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' },
          then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        },
      ],
    }, ctx);
    expect(s.players.self.hand.length).toBe(before);
  });
});

// ================= step2: charSetTurnEffect resolveBindRef merge + nameOverride (rows 74/999) =================
import { resolveBindRef } from '@/engine/effect/atom-handlers/_shared';
import { char as charRead } from '@/engine/read/char';
import { mutate } from '@/engine/mutate';

describe('megaw6 step2 — resolveBindRef $dyn.* branch + charSetTurnEffect val 解決', () => {
  beforeEach(() => _resetRegistry());

  it('resolveBindRef resolves $dyn.<key> from ctx.dyn; missing key passes through', () => {
    const ctx = makeCtx({ dyn: { declaredName: '工藤新一' } });
    expect(resolveBindRef('$dyn.declaredName', ctx)).toBe('工藤新一');
    expect(resolveBindRef('$dyn.missing', ctx)).toBe('$dyn.missing');
    expect(resolveBindRef('$dyn.x', makeCtx())).toBe('$dyn.x');
  });

  it('resolveBindRef literal / non-$ passthrough unchanged (回帰0)', () => {
    const ctx = makeCtx();
    expect(resolveBindRef(true, ctx)).toBe(true);
    expect(resolveBindRef(3, ctx)).toBe(3);
    expect(resolveBindRef('literal', ctx)).toBe('literal');
  });

  it('charSetTurnEffect resolves $dyn val → turnEffects (PR105 nameOverride 経路)', () => {
    registerCardDef(defOf({ id: 'YK1', names: ['工藤有希子'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'u1', cardId: 'YK1' })]);
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' }, dyn: { declaredName: '毛利小五郎' } });
    runAtom(s, 'charSetTurnEffect', { uid: '$self', key: 'nameOverride', val: '$dyn.declaredName' }, ctx);
    expect(s.players.self.scene[0]!.turnEffects['nameOverride']).toBe('毛利小五郎');
  });

  it('charSetTurnEffect literal val 回帰なし (既存カード boolean/number)', () => {
    registerCardDef(defOf({ id: 'YK2' }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'u1', cardId: 'YK2' })]);
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u1' } });
    runAtom(s, 'charSetTurnEffect', { uid: '$self', key: 'cannotReason', val: true }, ctx);
    expect(s.players.self.scene[0]!.turnEffects['cannotReason']).toBe(true);
  });
});

describe('megaw6 step2 — names() nameOverride (完全置換, rules/19)', () => {
  beforeEach(() => _resetRegistry());

  it('nameOverride set → names() returns [override] only (printed は持たない扱い)', () => {
    registerCardDef(defOf({ id: 'YK3', names: ['工藤有希子'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'u1', cardId: 'YK3', turnEffects: { contactImmune: false, removeOnTurnEnd: false, nameOverride: '毛利小五郎' } })]);
    expect(charRead.names(s, 'u1')).toEqual(['毛利小五郎']);
  });

  it('empty-string override は無視 (未指定と同じ、モーダル空 submit 防御)', () => {
    registerCardDef(defOf({ id: 'YK4', names: ['工藤有希子'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'u1', cardId: 'YK4', turnEffects: { contactImmune: false, removeOnTurnEnd: false, nameOverride: '' } })]);
    expect(charRead.names(s, 'u1')).toEqual(['工藤有希子']);
  });

  it('clearTurnEffects(turn) で nameOverride が消え印字名に戻る', () => {
    registerCardDef(defOf({ id: 'YK5', names: ['工藤有希子'] }));
    const s = createEmptyGameState();
    s.players.self.scene.push(makeChar({ uid: 'u1', cardId: 'YK5', turnEffects: { contactImmune: false, removeOnTurnEnd: false, nameOverride: '毛利小五郎' } }));
    expect(charRead.names(s, 'u1')).toEqual(['毛利小五郎']);
    mutate.char.clearTurnEffects(s, 'u1', 'turn');
    expect(charRead.names(s, 'u1')).toEqual(['工藤有希子']);
  });

  it('sceneNameCount honors nameOverride (書き換え後の名前で計数)', () => {
    registerCardDef(defOf({ id: 'YK6', names: ['工藤有希子'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'u1', cardId: 'YK6', turnEffects: { contactImmune: false, removeOnTurnEnd: false, nameOverride: '毛利小五郎' } })]);
    const ctx = makeCtx();
    ctx.declaredNames = { named: '毛利小五郎' };
    expect(evalDyn(s, '$declared.named.sceneNameCount', ctx)).toBe(1);
    const ctx2 = makeCtx();
    ctx2.declaredNames = { named: '工藤有希子' };
    expect(evalDyn(s, '$declared.named.sceneNameCount', ctx2)).toBe(0);
  });
});

// ================= step3: r63 useEventFromHand + eventUseSource (P18/P19) =================
import { event } from '@/engine/event/index';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import type { AbilityDef } from '@/engine/types';

const EVT_PLAIN: CardDef = {
  id: 'EVT_PLAIN', no: 'NO', kind: 'event', names: ['プレーンイベント'], colors: ['緑'], level: 6,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => !!p && typeof p === 'object' && (p as { kind?: unknown }).kind === 'event-use' },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    description: '', ruleRefs: [],
  } as AbilityDef],
};

// P19 検知イベント: 「このイベントが能力や効果によって使用されていた場合、カードを1枚引く」(B07026 型)
const EVT_COND: CardDef = {
  id: 'EVT_COND', no: 'NO', kind: 'event', names: ['使用元検知'], colors: ['緑'], level: 2,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => !!p && typeof p === 'object' && (p as { kind?: unknown }).kind === 'event-use' },
    effect: {
      kind: 'conditional',
      if: { kind: 'eventUseSource', viaEffect: true },
      then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    },
    description: '', ruleRefs: [],
  } as AbilityDef],
};

describe('megaw6 step3 — useEventFromHand (P18 再入的イベント使用)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetRegistry();
    registerCardDef(EVT_PLAIN);
    registerCardDef(EVT_COND);
    registerTriggeredListener();
  });

  it('手札のイベントを使用: emit→hand→remove 移動 + on-hand 効果が再入解決される (FILE 0 でも成功 = FILE バイパス)', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['EVT_PLAIN'];
    s.players.self.deck = ['d1', 'd2', 'd3'];
    expect(s.players.self.file).toHaveLength(0);
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', cardId: 'SRC', abilityId: 'x' } });
    runAtom(s, 'useEventFromHand', { player: 'self', target: ['EVT_PLAIN'] }, ctx);
    expect(s.players.self.hand).not.toContain('EVT_PLAIN');
    expect(s.players.self.remove).toContain('EVT_PLAIN');
    runAllUntilEmpty(s);
    expect(s.players.self.hand).toHaveLength(2); // on-hand a1 の draw 2 が発火 = emit が hand.remove より先
  });

  it('eventUseBanned 中は防御的 no-op (手札に残る + chainStepNoApply)', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['EVT_PLAIN'];
    s.turnState.self.eventUseBanned = true;
    const ctx = makeCtx();
    runAtom(s, 'useEventFromHand', { player: 'self', target: ['EVT_PLAIN'] }, ctx);
    expect(s.players.self.hand).toContain('EVT_PLAIN');
    expect(s.players.self.remove).not.toContain('EVT_PLAIN');
    expect(ctx.dyn?.chainStepNoApply).toBe(true);
  });

  it('0件 (辞退/候補なし) → chainStepNoApply gate、crash なし', () => {
    const s = createEmptyGameState();
    const ctx = makeCtx();
    runAtom(s, 'useEventFromHand', { player: 'self', target: [] }, ctx);
    expect(ctx.dyn?.chainStepNoApply).toBe(true);
  });
});

describe('megaw6 step3 — eventUseSource condition (P19)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetRegistry();
    registerCardDef(EVT_PLAIN);
    registerCardDef(EVT_COND);
    registerTriggeredListener();
  });

  it('useEventFromHand 経由 → viaEffect:true 成立で後続 draw 発火', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['EVT_COND'];
    s.players.self.deck = ['d1', 'd2'];
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', cardId: 'SRC', abilityId: 'x' } });
    runAtom(s, 'useEventFromHand', { player: 'self', target: ['EVT_COND'] }, ctx);
    runAllUntilEmpty(s);
    expect(s.players.self.hand).toHaveLength(1); // conditional 成立 → draw 1
  });

  it('手札の使用 (viaEffect 無し emit) 経由 → 不成立で draw なし', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['EVT_COND'];
    s.players.self.deck = ['d1', 'd2'];
    // hand-use-card.ts の emit 形を模倣 (viaEffect 無指定 = player-action 起源)
    event.emit(s, 'effect:declared', { kind: 'event-use', cardId: 'EVT_COND', player: 'self' }, { player: 'self', cardId: 'EVT_COND' });
    mutateAll.hand.remove(s, 'self', ['EVT_COND']);
    mutateAll.remove.add(s, 'self', ['EVT_COND']);
    runAllUntilEmpty(s);
    expect(s.players.self.hand).toHaveLength(0); // conditional 不成立 → draw なし
  });

  it('evalCond 単体: kind 不一致 payload (cutin 形) は誤検出しない / viaEffect:false は player-action 起源に一致', () => {
    const s = createEmptyGameState();
    const cutinCtx = makeCtx({ triggerPayload: { abilityId: 'cutin', cardId: 'X' } });
    expect(evalCond(s, { kind: 'eventUseSource', viaEffect: true }, cutinCtx)).toBe(false);
    expect(evalCond(s, { kind: 'eventUseSource', viaEffect: false }, cutinCtx)).toBe(false);
    const handUseCtx = makeCtx({ triggerPayload: { kind: 'event-use', cardId: 'X', player: 'self' } });
    expect(evalCond(s, { kind: 'eventUseSource', viaEffect: false }, handUseCtx)).toBe(true);
    expect(evalCond(s, { kind: 'eventUseSource', viaEffect: true }, handUseCtx)).toBe(false);
    const viaCtx = makeCtx({ triggerPayload: { kind: 'event-use', cardId: 'X', player: 'self', viaEffect: true } });
    expect(evalCond(s, { kind: 'eventUseSource', viaEffect: true }, viaCtx)).toBe(true);
  });
});

// ================= step4: 疾風 cluster — r58 per-char flag + B09090/P16 waive =================
import { produce } from 'immer';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { Effect } from '@/engine/types';

function pchar(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黄'], level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function summonFrom(cardId: string): Effect {
  return { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId, viaEffect: true, target: { query: { area: 'remove', side: 'self' } } } } as unknown as Effect;
}
const w6SrcCtx = () => makeCtx({ source: { cardId: 'SRC', uid: 'src#1', abilityId: 'a1', player: 'self', area: 'scene' } });

// 疾風 a1 (enter + enterOrderEquals:1 + draw) — cluster11 §4 正準形状
const shippuA1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【疾風】draw', ruleRefs: [],
};
const enterA1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【登場時】draw', ruleRefs: [],
};

describe('megaw6 step4 — r58 shippuFiredCharThisTurn (per-char flag + TargetFilter 軸)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetRegistry();
    _resetUidCounter();
    registerTriggeredListener();
  });

  it('疾風発動キャラに per-char flag が立つ (per-player flag と同一 gate)', () => {
    registerCardDef(pchar('SHIPPU', { abilities: [shippuA1] }));
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['SHIPPU'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('SHIPPU'), w6SrcCtx());
      runAllUntilEmpty(d);
    });
    const c = s.players.self.scene.find(x => x.cardId === 'SHIPPU')!;
    expect(c.turnEffects['shippuFiredCharThisTurn']).toBe(true);
    expect(s.turnState.self.shippuFiredThisTurn).toBe(true); // per-player 既存挙動は不変
  });

  it('【登場時】decoy には立たない / clearTurnEffects(turn) で消える', () => {
    registerCardDef(pchar('ENTER', { abilities: [enterA1] }));
    registerCardDef(pchar('SHIPPU', { abilities: [shippuA1] }));
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2', 'Z3'];
    s.players.self.remove = ['ENTER', 'SHIPPU'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('SHIPPU'), w6SrcCtx());
      runAllUntilEmpty(d);
      runEffect(d, summonFrom('ENTER'), w6SrcCtx());
      runAllUntilEmpty(d);
    });
    const dec = s.players.self.scene.find(x => x.cardId === 'ENTER')!;
    expect(dec.turnEffects['shippuFiredCharThisTurn']).toBeUndefined();
    const sh = s.players.self.scene.find(x => x.cardId === 'SHIPPU')!;
    expect(sh.turnEffects['shippuFiredCharThisTurn']).toBe(true);
    // BUG-170: clearTurnEffects('turn') では消えない (B09070 a3 が phase:end:start queue の
    // 解決時に読むため)。清掃は次 startTurn 境界。
    s = produce(s, (d) => { mutateAll.char.clearTurnEffects(d, sh.uid, 'turn'); });
    expect(s.players.self.scene.find(x => x.cardId === 'SHIPPU')!.turnEffects['shippuFiredCharThisTurn'], 'endTurn 清掃では残る (BUG-170)').toBe(true);
    s = produce(s, (d) => { d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn']; startTurn(d, 'opp'); });
    expect(s.players.self.scene.find(x => x.cardId === 'SHIPPU')!.turnEffects['shippuFiredCharThisTurn'], '次 startTurn で解除').toBeUndefined();
  });

  it('B09070 a3 型 forEach 一括アクティブ: 疾風発動キャラのみ active 化 (未発動 decoy は sleep のまま)', () => {
    registerCardDef(pchar('SHIPPU', { abilities: [shippuA1] }));
    registerCardDef(pchar('PLAIN'));
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['SHIPPU', 'PLAIN'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('SHIPPU'), w6SrcCtx());
      runAllUntilEmpty(d);
      runEffect(d, summonFrom('PLAIN'), w6SrcCtx());
      runAllUntilEmpty(d);
      // 両者をスリープさせてから一括アクティブ (a3 の主眼 = 疾風後にスリープ化したキャラの再アクティブ)
      for (const c of d.players.self.scene) mutateAll.scene.setState(d, c.uid, 'sleep');
      runEffect(d, {
        kind: 'forEach',
        over: { kind: 'all', query: { area: 'scene', side: 'self', filter: { shippuFiredCharThisTurn: true } } },
        do: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$each.uid', state: 'active' } },
      } as unknown as Effect, w6SrcCtx());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find(x => x.cardId === 'SHIPPU')!.state).toBe('active');
    expect(s.players.self.scene.find(x => x.cardId === 'PLAIN')!.state).toBe('sleep');
  });
});

describe('megaw6 step4 — B09090/P16 shippuWaiveArmed (疾風条件 waive)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetRegistry();
    _resetUidCounter();
    registerTriggeredListener();
  });

  it('setShippuWaive verb → turnState.shippuWaiveArmed / resetTurnFlags で失効', () => {
    const s = createEmptyGameState();
    runAtom(s, 'setShippuWaive', { player: 'self' }, makeCtx());
    expect(s.turnState.self.shippuWaiveArmed).toBe(true);
    mutateAll.flag.resetTurnFlags(s, 'self');
    expect(s.turnState.self.shippuWaiveArmed).toBe(false);
  });

  it('armed 中に 2 番目登場の疾風 (enterOrderEquals:1) が発動する + arm 消費', () => {
    registerCardDef(pchar('SHIPPU', { abilities: [shippuA1] }));
    registerCardDef(pchar('PLAIN'));
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['PLAIN', 'SHIPPU'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('PLAIN'), w6SrcCtx()); // 1番目 (arm 前)
      runAllUntilEmpty(d);
      runAtom(d, 'setShippuWaive', { player: 'self' }, makeCtx());
      runEffect(d, summonFrom('SHIPPU'), w6SrcCtx()); // 2番目 = waive で発動
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand, 'waive により enterOrderEquals:1 不成立でも draw 発火').toHaveLength(1);
    expect(s.turnState.self.shippuWaiveArmed, 'arm は消費済み').toBe(false);
    expect(s.turnState.self.shippuFiredThisTurn, 'waive 発動も「発動」として記録').toBe(true);
  });

  it('公式Q&A pin: armed 消費は「次に登場したキャラ」— 疾風を持たないキャラでも消費し、その次の疾風は発動しない', () => {
    registerCardDef(pchar('SHIPPU', { abilities: [shippuA1] }));
    registerCardDef(pchar('PLAIN'));
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['PLAIN', 'SHIPPU'];
    s = produce(s, (d) => {
      runAtom(d, 'setShippuWaive', { player: 'self' }, makeCtx());
      runEffect(d, summonFrom('PLAIN'), w6SrcCtx()); // 1番目 = 疾風なしでも arm 消費
      runAllUntilEmpty(d);
      runEffect(d, summonFrom('SHIPPU'), w6SrcCtx()); // 2番目 = arm 消費済み → 発動しない
      runAllUntilEmpty(d);
    });
    expect(s.turnState.self.shippuWaiveArmed).toBe(false);
    const plain = s.players.self.scene.find(x => x.cardId === 'PLAIN')!;
    expect(plain.turnEffects['shippuWaived'], '消費痕跡は 1番目キャラに付く').toBe(true);
    expect(s.players.self.hand, '2番目の疾風は発動しない (Q&A)').toHaveLength(0);
  });

  it('非 armed の従来挙動 pin: 2番目登場の疾風は発動しない', () => {
    registerCardDef(pchar('SHIPPU', { abilities: [shippuA1] }));
    registerCardDef(pchar('PLAIN'));
    let s = createEmptyGameState();
    s.players.self.deck = ['Z1', 'Z2'];
    s.players.self.remove = ['PLAIN', 'SHIPPU'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('PLAIN'), w6SrcCtx());
      runAllUntilEmpty(d);
      runEffect(d, summonFrom('SHIPPU'), w6SrcCtx());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand).toHaveLength(0);
  });

  it('相手側現場への登場は自分の arm を消費しない (owner 側で判定)', () => {
    registerCardDef(pchar('PLAIN'));
    let s = createEmptyGameState();
    s.players.opp.remove = ['PLAIN'];
    s = produce(s, (d) => {
      runAtom(d, 'setShippuWaive', { player: 'self' }, makeCtx());
      const oppCtx = makeCtx({ source: { cardId: 'SRC', uid: 'src#2', abilityId: 'a1', player: 'opp', area: 'scene' } });
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'PLAIN', viaEffect: true, target: { query: { area: 'remove', side: 'self' } } } } as unknown as Effect, oppCtx);
      runAllUntilEmpty(d);
    });
    expect(s.players.opp.scene.find(x => x.cardId === 'PLAIN')).toBeTruthy();
    expect(s.turnState.self.shippuWaiveArmed, '自分の arm は残る').toBe(true);
  });
});

// ================= step5: board-scan cluster — r50 untargetableByActionAura + r74 auto-phase lock/aura =================
import { candidates as targetCandidates } from '@/engine/flow/action/target-expander';
import { runAutoPhase } from '@/engine/flow/auto-phase';

// B04072 白鳥任三郎 型: 「このキャラがスリープ状態の場合、相手は自分の現場にいるレベル5以下の【青】と
// レベル5以下の【黄】のキャラを指定してアクションできない」
const AURA_BEARER: CardDef = {
  id: 'AURA_BEARER', no: 'NO', kind: 'character', names: ['白鳥'], colors: ['黄'], level: 6, ap: 6000, lp: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{
    id: 'a1', type: 'continuous', scope: 'on-scene',
    condition: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' },
    continuousModifier: { untargetableByActionAura: { levelMax: 5, color: ['青', '黄'] } },
    description: '', ruleRefs: [],
  } as AbilityDef],
};

describe('megaw6 step5 — r50 untargetableByActionAura (B04072 型)', () => {
  beforeEach(() => {
    _resetRegistry();
    _resetUidCounter();
    registerCardDef(AURA_BEARER);
    registerCardDef(pchar('ATK', { ap: 5000 }));
    registerCardDef(pchar('BLUE4', { colors: ['青'], level: 4 }));
    registerCardDef(pchar('BLUE6', { colors: ['青'], level: 6 }));
    registerCardDef(pchar('RED2', { colors: ['赤'], level: 2 }));
  });

  function board(bearerState: 'active' | 'sleep' | 'stun') {
    const s = createEmptyGameState();
    const atk = mutateAll.scene.enter(s, 'self', 'ATK', { active: true });
    atk.isNamed = false;
    const bearer = mutateAll.scene.enter(s, 'opp', 'AURA_BEARER', {});
    mutateAll.scene.setState(s, bearer.uid, bearerState);
    const b4 = mutateAll.scene.enter(s, 'opp', 'BLUE4', {});
    mutateAll.scene.setState(s, b4.uid, 'sleep');
    const b6 = mutateAll.scene.enter(s, 'opp', 'BLUE6', {});
    mutateAll.scene.setState(s, b6.uid, 'sleep');
    const r2 = mutateAll.scene.enter(s, 'opp', 'RED2', {});
    mutateAll.scene.setState(s, r2.uid, 'sleep');
    return { s, atk, b4, b6, r2 };
  }

  it('bearer sleep 時: levelMax5 × 色OR 一致キャラのみ候補から除外', () => {
    const { s, atk, b4, b6, r2 } = board('sleep');
    const cands = targetCandidates(s, atk.uid);
    expect(cands.some(c => c.uid === b4.uid), 'lv4 青 = 除外').toBe(false);
    expect(cands.some(c => c.uid === b6.uid), 'lv6 青 = levelMax 超過で残る').toBe(true);
    expect(cands.some(c => c.uid === r2.uid), '赤 = 色不一致で残る').toBe(true);
  });

  it('bearer active/stun 時: condition 不成立で aura 無効 (Q&A: スタン状態は有効でない)', () => {
    for (const st of ['active', 'stun'] as const) {
      const { s, atk, b4 } = board(st);
      const cands = targetCandidates(s, atk.uid);
      expect(cands.some(c => c.uid === b4.uid), `bearer ${st} = 除外されない`).toBe(true);
    }
  });

  it('aura 宣言なし盤面は従来出力 (静的 pre-check 素通し回帰)', () => {
    const s = createEmptyGameState();
    const atk = mutateAll.scene.enter(s, 'self', 'ATK', { active: true });
    atk.isNamed = false;
    const b4 = mutateAll.scene.enter(s, 'opp', 'BLUE4', {});
    mutateAll.scene.setState(s, b4.uid, 'sleep');
    const cands = targetCandidates(s, atk.uid);
    expect(cands.some(c => c.uid === b4.uid)).toBe(true);
  });
});

describe('megaw6 step5 — r74 noAutoActivateBySourceUid (B01082 標的固定 lock)', () => {
  beforeEach(() => {
    _resetRegistry();
    _resetUidCounter();
    registerCardDef(pchar('BEARER'));
    registerCardDef(pchar('LOCKED'));
    registerCardDef(pchar('FREE'));
  });

  it('lock 中 (bearer 生存) は auto-phase でアクティブ化されない / bearer 離脱で解錠 (live 再評価)', () => {
    const s = createEmptyGameState();
    s.players.opp.deck = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
    const bearer = mutateAll.scene.enter(s, 'self', 'BEARER', {});
    const locked = mutateAll.scene.enter(s, 'opp', 'LOCKED', {});
    const free = mutateAll.scene.enter(s, 'opp', 'FREE', {});
    mutateAll.scene.setState(s, locked.uid, 'sleep');
    mutateAll.scene.setState(s, free.uid, 'sleep');
    // B01082 a2 相当: charSetTurnEffect val:'$self' → bearer uid が書かれる (step2 resolveBindRef)
    runAtom(s, 'charSetTurnEffect', { uid: locked.uid, key: 'noAutoActivateBySourceUid', val: '$self' },
      makeCtx({ source: { player: 'self', area: 'scene', uid: bearer.uid, cardId: 'BEARER' } }));
    expect(s.players.opp.scene.find(c => c.uid === locked.uid)!.turnEffects['noAutoActivateBySourceUid']).toBe(bearer.uid);
    runAutoPhase(s, 'opp');
    expect(s.players.opp.scene.find(c => c.uid === locked.uid)!.state, 'lock 中は sleep のまま').toBe('sleep');
    expect(s.players.opp.scene.find(c => c.uid === free.uid)!.state, '非 lock は通常アクティブ化').toBe('active');
    // bearer 離脱 → 解錠 (turnEffects キーは残置でも liveness re-check で無効化)
    mutateAll.scene.removeToRemove(s, bearer.uid, 'effect');
    mutateAll.scene.setState(s, free.uid, 'sleep');
    runAutoPhase(s, 'opp');
    expect(s.players.opp.scene.find(c => c.uid === locked.uid)!.state, 'bearer 離脱後は active 化').toBe('active');
  });

  it('lock はターンを跨いで持続する (clearTurnEffects(turn) で消えない)', () => {
    const s = createEmptyGameState();
    const bearer = mutateAll.scene.enter(s, 'self', 'BEARER', {});
    const locked = mutateAll.scene.enter(s, 'opp', 'LOCKED', {});
    mutateAll.scene.setState(s, locked.uid, 'sleep');
    runAtom(s, 'charSetTurnEffect', { uid: locked.uid, key: 'noAutoActivateBySourceUid', val: '$self' },
      makeCtx({ source: { player: 'self', area: 'scene', uid: bearer.uid, cardId: 'BEARER' } }));
    mutateAll.char.clearTurnEffects(s, locked.uid, 'turn');
    expect(s.players.opp.scene.find(c => c.uid === locked.uid)!.turnEffects['noAutoActivateBySourceUid'], 'turn 清掃対象外').toBe(bearer.uid);
  });

  it('stun + lock: 複数回 auto-phase でも stun のまま (stun→sleep 変換もスキップ)', () => {
    const s = createEmptyGameState();
    s.players.opp.deck = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
    const bearer = mutateAll.scene.enter(s, 'self', 'BEARER', {});
    const locked = mutateAll.scene.enter(s, 'opp', 'LOCKED', {});
    mutateAll.scene.setState(s, locked.uid, 'stun');
    runAtom(s, 'charSetTurnEffect', { uid: locked.uid, key: 'noAutoActivateBySourceUid', val: '$self' },
      makeCtx({ source: { player: 'self', area: 'scene', uid: bearer.uid, cardId: 'BEARER' } }));
    runAutoPhase(s, 'opp');
    runAutoPhase(s, 'opp');
    expect(s.players.opp.scene.find(c => c.uid === locked.uid)!.state).toBe('stun');
  });
});

describe('megaw6 step5 — r74 opponentRestrict stunAutoActivate (B03046 partner aura)', () => {
  const PARTNER_AURA: CardDef = {
    id: 'PARTNER_AURA', no: 'NO', kind: 'partner', names: ['怪盗キッド'], colors: ['白'], lp: 2,
    traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
    abilities: [{
      id: 'a1', type: 'continuous', scope: 'on-scene',
      continuousModifier: { opponentRestrict: ['stunAutoActivate'] },
      description: '相手の現場にいるスタン状態のキャラはオートフェイズにアクティブにならない', ruleRefs: [],
    } as AbilityDef],
  };

  beforeEach(() => {
    _resetRegistry();
    _resetUidCounter();
    registerCardDef(PARTNER_AURA);
    registerCardDef(pchar('STUNNED'));
    registerCardDef(pchar('SLEEPER'));
  });

  function boardWithPartner(partnerLocation: 'partner-area' | 'file-area') {
    const s = createEmptyGameState();
    s.players.self.deck = ['d1', 'd2', 'd3', 'd4'];
    s.players.opp.partner = { cardId: 'PARTNER_AURA', state: 'active', location: partnerLocation };
    const z = mutateAll.scene.enter(s, 'self', 'STUNNED', {});
    mutateAll.scene.setState(s, z.uid, 'stun');
    const w = mutateAll.scene.enter(s, 'self', 'SLEEPER', {});
    mutateAll.scene.setState(s, w.uid, 'sleep');
    return { s, z, w };
  }

  it('相手 partner aura 成立: 自分の stun キャラは auto-phase で stun のまま (sleep 変換もされない)', () => {
    const { s, z, w } = boardWithPartner('partner-area');
    runAutoPhase(s, 'self');
    expect(s.players.self.scene.find(c => c.uid === z.uid)!.state, 'stun のまま').toBe('stun');
    expect(s.players.self.scene.find(c => c.uid === w.uid)!.state, 'sleep キャラは通常アクティブ化 (stun 限定)').toBe('active');
  });

  it('aura なし従来挙動 pin: stun → sleep 変換 (rules/03)', () => {
    const s = createEmptyGameState();
    s.players.self.deck = ['d1', 'd2', 'd3', 'd4'];
    const z = mutateAll.scene.enter(s, 'self', 'STUNNED', {});
    mutateAll.scene.setState(s, z.uid, 'stun');
    runAutoPhase(s, 'self');
    expect(s.players.self.scene.find(c => c.uid === z.uid)!.state).toBe('sleep');
  });

  it('partner 非在場 (file-area = アシスト中) は aura 不成立', () => {
    const { s, z } = boardWithPartner('file-area');
    runAutoPhase(s, 'self');
    expect(s.players.self.scene.find(c => c.uid === z.uid)!.state, '通常の stun→sleep 変換').toBe('sleep');
  });

  it('自陣 partner の同 aura は自分の stun キャラに影響しない (方向性)', () => {
    const s = createEmptyGameState();
    s.players.self.deck = ['d1', 'd2', 'd3', 'd4'];
    s.players.self.partner = { cardId: 'PARTNER_AURA', state: 'active', location: 'partner-area' };
    const z = mutateAll.scene.enter(s, 'self', 'STUNNED', {});
    mutateAll.scene.setState(s, z.uid, 'stun');
    runAutoPhase(s, 'self');
    expect(s.players.self.scene.find(c => c.uid === z.uid)!.state).toBe('sleep');
  });
});

// ================= step6: r79 MR selectedByOwnMr (dual-path tagging) =================
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';

const gHuman = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };

// 「【登場時】キャラを1枚まで選び、ターン終了時までAP+1000」(Pattern A pick) を持つ picker
const mrPickAbility = (side: 'self' | 'opp' = 'self'): AbilityDef => ({
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom', verb: 'charModifyAP',
    args: {
      uid: '$pick', delta: 1000, scope: 'turn',
      target: { kind: 'pick', query: { area: 'scene', side }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '', ruleRefs: [],
});
const MR_PICKER: CardDef = {
  id: 'MR_PICKER', no: 'NO', kind: 'character', names: ['MRピッカー'], colors: ['黒'], level: 8, ap: 8000, lp: 1,
  traits: [], rarity: 'MR', imageUrl: '', ruleRefs: [], abilities: [mrPickAbility()],
};
const NORMAL_PICKER: CardDef = { ...MR_PICKER, id: 'NORMAL_PICKER', names: ['通常ピッカー'], rarity: 'SR', abilities: [mrPickAbility()] };
const MR_PICKER_OPP: CardDef = { ...MR_PICKER, id: 'MR_PICKER_OPP', names: ['MR相手選択'], abilities: [mrPickAbility('opp')] };

describe('megaw6 step6 — r79 selectedByOwnMr (MR 選択追跡、AI/human 両経路)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetRegistry();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    gHuman.__humanPlayerSide = null;
    registerCardDef(MR_PICKER);
    registerCardDef(NORMAL_PICKER);
    registerCardDef(MR_PICKER_OPP);
    registerCardDef(pchar('TGT'));
    registerTriggeredListener();
  });
  afterEach(() => { gHuman.__humanPlayerSide = null; });

  it('AI 経路 (queue walk): MR の【登場時】pick で選ばれた自分の現場キャラに flag が立つ', () => {
    let s = createEmptyGameState();
    s.players.self.remove = ['MR_PICKER'];
    let tgtUid = '';
    s = produce(s, (d) => {
      tgtUid = mutateAll.scene.enter(d, 'self', 'TGT', {}).uid;
      runEffect(d, summonFrom('MR_PICKER'), w6SrcCtx());
      runAllUntilEmpty(d);
    });
    const flagged = s.players.self.scene.filter(c => c.turnEffects['selectedByOwnMr'] === true);
    expect(flagged.length, '選ばれた1枚に flag').toBe(1);
    void tgtUid;
  });

  it('AI 経路 decoy: 非 MR source の pick では flag が立たない (isMR gate)', () => {
    let s = createEmptyGameState();
    s.players.self.remove = ['NORMAL_PICKER'];
    s = produce(s, (d) => {
      mutateAll.scene.enter(d, 'self', 'TGT', {});
      runEffect(d, summonFrom('NORMAL_PICKER'), w6SrcCtx());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.some(c => c.turnEffects['selectedByOwnMr'] === true)).toBe(false);
  });

  it('human 経路: pending → applyPickAndContinuation でも対称に flag が立つ (BUG-158 型 両経路検証)', () => {
    const s = createEmptyGameState();
    s.players.self.remove = ['MR_PICKER'];
    const tgt = mutateAll.scene.enter(s, 'self', 'TGT', {});
    gHuman.__humanPlayerSide = 'self';
    runEffect(s, summonFrom('MR_PICKER'), w6SrcCtx());
    runAllUntilEmpty(s);
    const pend = _drainPendingEffectPickSide();
    expect(pend, 'human pick が pending 化').toBeTruthy();
    applyPickAndContinuation(s, pend!, tgt.uid);
    expect(s.players.self.scene.find(c => c.uid === tgt.uid)!.turnEffects['selectedByOwnMr']).toBe(true);
  });

  it('human 経路 decoy: 非 MR source では flag なし', () => {
    const s = createEmptyGameState();
    s.players.self.remove = ['NORMAL_PICKER'];
    const tgt = mutateAll.scene.enter(s, 'self', 'TGT', {});
    gHuman.__humanPlayerSide = 'self';
    runEffect(s, summonFrom('NORMAL_PICKER'), w6SrcCtx());
    runAllUntilEmpty(s);
    const pend = _drainPendingEffectPickSide();
    expect(pend).toBeTruthy();
    applyPickAndContinuation(s, pend!, tgt.uid);
    expect(s.players.self.scene.find(c => c.uid === tgt.uid)!.turnEffects['selectedByOwnMr']).toBeUndefined();
  });

  it('「自分の」guard: 相手側現場キャラを MR が選んでも flag は立たない (owner 不一致)', () => {
    let s = createEmptyGameState();
    s.players.self.remove = ['MR_PICKER_OPP'];
    s = produce(s, (d) => {
      mutateAll.scene.enter(d, 'opp', 'TGT', {});
      runEffect(d, summonFrom('MR_PICKER_OPP'), w6SrcCtx());
      runAllUntilEmpty(d);
    });
    expect(s.players.opp.scene.some(c => c.turnEffects['selectedByOwnMr'] === true), '相手キャラは「自分のMR」に該当しない').toBe(false);
  });

  it('selfSelectedByOwnMrThisTurn cond + not 包み (B08014 形) + BUG-170 清掃境界', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const tgt = mutateAll.scene.enter(s, 'self', 'TGT', {});
    const ctxOf = () => makeCtx({ source: { player: 'self', area: 'scene', uid: tgt.uid, cardId: 'TGT' } });
    expect(evalCond(s, { kind: 'selfSelectedByOwnMrThisTurn' }, ctxOf())).toBe(false);
    expect(evalCond(s, { kind: 'not', c: { kind: 'selfSelectedByOwnMrThisTurn' } }, ctxOf()), '未選択 → 手札戻し条件成立').toBe(true);
    mutateAll.char.tagSelectedByOwnMr(s, tgt.uid, 'self');
    expect(evalCond(s, { kind: 'selfSelectedByOwnMrThisTurn' }, ctxOf())).toBe(true);
    expect(evalCond(s, { kind: 'not', c: { kind: 'selfSelectedByOwnMrThisTurn' } }, ctxOf()), '選択済 → 条件不成立').toBe(false);
    // BUG-170: clearTurnEffects('turn') では消えない (endTurn 同期清掃 vs 未解決効果の解決時参照
    // rules/25 の衝突回避 — B08014 rider が endTurn 後の runAllUntilEmpty で flag を読めること)。
    mutateAll.char.clearTurnEffects(s, tgt.uid, 'turn');
    expect(evalCond(s, { kind: 'selfSelectedByOwnMrThisTurn' }, ctxOf()), 'endTurn 清掃では残る (BUG-170)').toBe(true);
    // 清掃は次ターン開始境界 (flow/turn.ts startTurn)
    startTurn(s, 'opp');
    expect(evalCond(s, { kind: 'selfSelectedByOwnMrThisTurn' }, ctxOf()), '次 startTurn で解除').toBe(false);
  });

  it('paMrColorCountMin: PA-MR 不在 / 1色 / 2色 の分岐 (B09047)', () => {
    _resetRegistry();
    registerCardDef({ ...MR_PICKER, id: 'MR1C', colors: ['黒'], abilities: [] });
    registerCardDef({ ...MR_PICKER, id: 'MR2C', colors: ['黒', '白'], abilities: [] });
    const s = createEmptyGameState();
    const ctx = makeCtx();
    expect(evalCond(s, { kind: 'paMrColorCountMin', side: 'self', min: 2 }, ctx), 'PA-MR 不在').toBe(false);
    s.players.self.partnerAreaMR = { cardId: 'MR1C', uid: 'pamr#1', state: 'active' } as never;
    expect(evalCond(s, { kind: 'paMrColorCountMin', side: 'self', min: 2 }, ctx), '1色 < 2').toBe(false);
    s.players.self.partnerAreaMR = { cardId: 'MR2C', uid: 'pamr#2', state: 'active' } as never;
    expect(evalCond(s, { kind: 'paMrColorCountMin', side: 'self', min: 2 }, ctx), '2色 >= 2').toBe(true);
  });
});

// ================= 混成 review NIT 対応 probe (2026-07-04) =================
import { matchOneFilter } from '@/engine/target/candidates';
import type { Candidate } from '@/engine/types';

describe('megaw6 review-fix — nameOverride を bond / matchOneFilter cardName が honor (BUG-117 一貫性)', () => {
  beforeEach(() => {
    _resetRegistry();
    _resetUidCounter();
  });

  it('nameOverride 後: TargetFilter cardName は新名で一致・旧印字名で不一致 (完全置換)', () => {
    registerCardDef(defOf({ id: 'YK7', names: ['工藤有希子'] }));
    const s = createEmptyGameState();
    const c = mutateAll.scene.enter(s, 'self', 'YK7', {});
    mutateAll.char.setTurnEffect(s, c.uid, 'nameOverride', '毛利小五郎');
    const sc = s.players.self.scene.find(x => x.uid === c.uid)!;
    const cand: Candidate = { kind: 'char', uid: c.uid, cardId: 'YK7', player: 'self' };
    expect(matchOneFilter(s, 'YK7', { cardName: '毛利小五郎' }, sc, cand), '新名で一致').toBe(true);
    expect(matchOneFilter(s, 'YK7', { cardName: '工藤有希子' }, sc, cand), '旧印字名は持っていない扱い (rules/19)').toBe(false);
    expect(matchOneFilter(s, 'YK7', { cardNameNot: '工藤有希子' }, sc, cand), 'cardNameNot も新名基準').toBe(true);
  });

  it('nameOverride 後: 【絆】は新名で成立・旧印字名で不成立', () => {
    registerCardDef(defOf({ id: 'YK8', names: ['工藤有希子'] }));
    const s = createEmptyGameState();
    const c = mutateAll.scene.enter(s, 'self', 'YK8', {});
    mutateAll.char.setTurnEffect(s, c.uid, 'nameOverride', '毛利小五郎');
    const ctx = makeCtx();
    expect(evalCond(s, { kind: 'bond', cardName: '毛利小五郎' }, ctx)).toBe(true);
    expect(evalCond(s, { kind: 'bond', cardName: '工藤有希子' }, ctx)).toBe(false);
  });

  it('nameOverride は分割名 component も honor (複数名へ書き換えた場合)', () => {
    registerCardDef(defOf({ id: 'YK9', names: ['工藤有希子'] }));
    const s = createEmptyGameState();
    const c = mutateAll.scene.enter(s, 'self', 'YK9', {});
    mutateAll.char.setTurnEffect(s, c.uid, 'nameOverride', '江戸川コナン&工藤新一');
    const ctx = makeCtx();
    expect(evalCond(s, { kind: 'bond', cardName: '工藤新一' }, ctx), 'rules/19 分割 component').toBe(true);
  });
});

describe('megaw6 review-fix — useEventFromHand kind guard', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetRegistry();
    registerCardDef(pchar('CHARCARD'));
    registerTriggeredListener();
  });

  it('キャラカードは使用されず手札に残る (author filter 漏れ footgun 防御)', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['CHARCARD'];
    const ctx = makeCtx();
    runAtom(s, 'useEventFromHand', { player: 'self', target: ['CHARCARD'] }, ctx);
    expect(s.players.self.hand).toContain('CHARCARD');
    expect(s.players.self.remove).not.toContain('CHARCARD');
    expect(ctx.dyn, '非イベント対象の原子的な拒否は chain state を作らない').toBeUndefined();
  });
});
