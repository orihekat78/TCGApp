// BUG-196: B04018/B04018P の公式3能力とprint variant同値性。
// rules: 15-abilities-effects.md, 19-special-rules.md, 20-color-and-switch.md,
//        21-declared-ability-cost.md, 24-qa-naming-stun.md, 25-qa-effects-resolution.md
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { registerAll } from '@/cards';
import { B04018 } from '@/cards/ct-p04/B04018';
import { B04018P } from '@/cards/ct-p04/B04018P';
import { engine } from '@/engine';
import { event } from '@/engine/event';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { canPay } from '@/engine/cost/evaluate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { read } from '@/engine/read';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../helpers/fixtures';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';

const H5 = 'BUG196_HEIJI_L5';
const H6 = 'BUG196_HEIJI_L6';
const OTHER = 'BUG196_OTHER';
const TARGET = 'BUG196_TARGET';
const COST = 'BUG196_COST';
const HEIJI_EVENT = 'BUG196_HEIJI_EVENT';

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `BUG196/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner.cardId = 'D02001';
  s.players.self.case.cardId = 'D02016';
  s.players.self.case.colors = ['緑'];
  s.players.self.case.status = '解決編';
  s.players.self.scene = [sceneChar('B04018', 'kazuha')];
  return s;
}

beforeEach(() => {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  registerAll();
  engine.cards.register(card(H5, { names: ['服部平次'], level: 5 }));
  engine.cards.register(card(H6, { names: ['服部平次'], level: 6 }));
  engine.cards.register(card(OTHER));
  engine.cards.register(card(TARGET, { keywords: ['迅速'] }));
  engine.cards.register(card(COST));
  engine.cards.register(card(HEIJI_EVENT, { kind: 'event', names: ['服部平次'], level: 4 }));
  registerTriggeredListener();
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
});

afterEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
});

describe('BUG-196 B04018 / B04018P 遠山和葉', () => {
  it.each([B04018, B04018P])('$id: 公式3能力を句単位で保持する', (card) => {
    expect(card.abilities.map(a => a.id)).toEqual(['a1', 'a2', 'a3']);
    expect(card.abilities[0]).toMatchObject({
      type: 'triggered',
      scope: 'on-scene',
      trigger: {
        hook: 'enter',
        matcherCondition: {
          kind: 'or',
          cs: [
            { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', requireSource: true },
            { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { cardName: '服部平次' } },
          ],
        },
      },
      effect: {
        kind: 'atom',
        verb: 'charDisableOriginal',
        args: {
          uid: '$pick', scope: 'turn',
          target: { kind: 'pick', query: { area: 'scene', side: 'opp' }, n: { min: 0, max: 1 }, chooser: 'self' },
        },
      },
    });
    expect(card.abilities[1]).toMatchObject({
      type: 'triggered', trigger: { hook: 'leave:to-remove', selfOnly: true },
      condition: { kind: 'turn', player: 'opp' },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    });
    expect(card.abilities[2]).toMatchObject({
      type: 'declared', scope: 'on-scene',
      condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '緑' }, { kind: 'caseStatus', status: '解決編' }] },
      cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeFromHand', n: 1 }] },
      effect: {
        kind: 'atom', verb: 'sceneEnter',
        args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filter: { kind: 'character', cardName: '服部平次', levelMax: 5 } },
      },
    });
    expect(card.abilities.map(a => a.description).join('\n')).toContain('ターン終了時まで元の能力を無効');
    expect(card.abilities.map(a => a.description).join('\n')).toContain('【相手ターン中】【現場リムーブ時】');
    expect(card.abilities.map(a => a.description).join('\n')).toContain('【パートナー緑】【解決編】【宣言】【スリープ】');
  });

  it('通常/Pは印刷固有metadata以外の能力・本文・statsが同一', () => {
    expect(B04018P.abilities).toEqual(B04018.abilities);
    expect({ ...B04018P, id: B04018.id, no: B04018.no, rarity: B04018.rarity, imageUrl: B04018.imageUrl })
      .toEqual(B04018);
  });

  it.each([
    ['自身', 'self', 'kazuha', 'B04018', true],
    ['自分の服部平次', 'self', 'heiji', H5, true],
    ['自分の別名キャラ', 'self', 'other', OTHER, false],
    ['相手の服部平次', 'opp', 'opp-heiji', H5, false],
  ] as const)('a1: %sの登場 trigger=%s', (_label, side, uid, cardId, fires) => {
    const s = base();
    s.players.opp.scene = [sceneChar(TARGET, 'target')];
    if (uid !== 'kazuha') s.players[side].scene.push(sceneChar(cardId, uid));
    event.emit(s, 'enter', { uid, viaEffect: false, enterOrder: 2, enterOrderThisTurn: 1 }, { player: side, uid, cardId });
    runAllUntilEmpty(s);
    useGameStateStore.getState().setGameState(s);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick != null).toBe(fires);
  });

  it('a1: 相手キャラの元能力をターン中だけ無効化し、ターン終了で戻す', () => {
    const s = base();
    s.players.opp.scene = [sceneChar(TARGET, 'target')];
    event.emit(s, 'enter', { uid: 'kazuha', viaEffect: false, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', uid: 'kazuha', cardId: 'B04018' });
    runAllUntilEmpty(s);
    useGameStateStore.getState().setGameState(s);
    surfacePendingSideChannels();
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'target' })).toEqual({ ok: true });
    let after = useGameStateStore.getState().gameState!;
    expect(read.char.hasKeyword(after, 'target', '迅速')).toBe(false);
    after = produce(after, draft => mutate.char.clearTurnEffects(draft, 'target', 'turn'));
    expect(read.char.hasKeyword(after, 'target', '迅速')).toBe(true);
  });

  it('a2: 相手ターンに現場からリムーブされた場合だけ1枚引く', () => {
    const s = base();
    s.turn.player = 'opp';
    s.players.self.deck = [OTHER, COST];
    mutate.scene.removeToRemove(s, 'kazuha', 'effect');
    runAllUntilEmpty(s);
    expect(s.players.self.hand).toEqual([OTHER]);
    expect(s.players.self.remove).toContain('B04018');
  });

  it('a3: partner・解決編・active・手札1枚をすべて要求する', () => {
    const legal = base();
    legal.players.self.hand = [COST];
    const a3 = B04018.abilities[2]!;
    const ctx = { source: { player: 'self', uid: 'kazuha', cardId: 'B04018', abilityId: 'a3', area: 'scene' }, bindings: {} } as EffectCtx;
    expect(canDeclaredAbility(legal, 'kazuha', 'a3')).toBe(true);
    expect(canPay(legal, a3.cost!, ctx)).toBe(true);
    const wrongPartner = base(); wrongPartner.players.self.partner.cardId = 'D01001'; wrongPartner.players.self.hand = [COST];
    const wrongStatus = base(); wrongStatus.players.self.case.status = '事件編'; wrongStatus.players.self.hand = [COST];
    const asleep = base(); asleep.players.self.scene[0]!.state = 'sleep'; asleep.players.self.hand = [COST];
    const noHand = base();
    expect(canDeclaredAbility(wrongPartner, 'kazuha', 'a3'), 'partner不一致').toBe(false);
    expect(canDeclaredAbility(wrongStatus, 'kazuha', 'a3'), '事件編').toBe(false);
    expect(canPay(asleep, a3.cost!, ctx), 'sleepSelfを払えない').toBe(false);
    expect(canPay(noHand, a3.cost!, ctx), '手札コスト不足').toBe(false);
  });

  it('a3: コスト支払い後、removeの服部平次Lv5だけを候補化し登場させる', () => {
    const s = base();
    s.players.self.hand = [COST];
    s.players.self.remove = [H5, H6, HEIJI_EVENT, OTHER];
    useGameStateStore.getState().setGameState(s);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'kazuha', abilId: 'a3' })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(pending.atomVerb).toBe('sceneEnter');
    expect(pending.candidates.map(c => c.cardId)).toEqual([H5]);
    expect(useGameStateStore.getState().gameState?.players.self.scene[0]?.state).toBe('sleep');
    expect(useGameStateStore.getState().gameState?.players.self.remove).toContain(COST);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pending.candidates[0]!.uid })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.scene.map(c => c.cardId)).toContain(H5);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('a3: 0枚選択可。満員時は自身をswitchして服部平次を登場可能', () => {
    const skipped = base(); skipped.players.self.hand = [COST]; skipped.players.self.remove = [H5];
    useGameStateStore.getState().setGameState(skipped);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'kazuha', abilId: 'a3' }).ok).toBe(true);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.scene.map(c => c.cardId)).toEqual(['B04018']);

    const full = base(); full.players.self.hand = [COST]; full.players.self.remove = [H5];
    full.players.self.scene.push(...[1, 2, 3, 4].map(n => sceneChar(OTHER, `other-${n}`)));
    useGameStateStore.getState().setGameState(full); useGameStateStore.getState().setPendingEffectPick(null);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'kazuha', abilId: 'a3' }).ok).toBe(true);
    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pending.candidates[0]!.uid, switchRemoveUid: 'kazuha' })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene).toHaveLength(5);
    expect(after.players.self.scene.map(c => c.cardId)).toContain(H5);
    expect(after.players.self.scene.map(c => c.cardId)).not.toContain('B04018');
    expect(after.players.self.remove).toContain('B04018');
  });
});
