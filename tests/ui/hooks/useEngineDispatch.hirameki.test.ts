// Phase 8 完全クローズ Commit 3a: hiramekiResolve dispatch tests
//
// rules: 10-action-event.md §ヒラメキ
// spec: 計画 — Commit 3a

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { useGameStateStore } from '@/ui/state/store';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import {
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef } from '@/engine/read/def';
import { mutate } from '@/engine/mutate';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { CardDef } from '@/engine/types';
import type { GameState } from '@/engine/types/game-state';

const PAUSED_HIRAMEKI_ID = 'TEST_PAUSED_HIRAMEKI';
const PAUSED_HIRAMEKI_TARGET_ID = 'TEST_PAUSED_HIRAMEKI_TARGET';
const pausedHirameki: CardDef = {
  id: PAUSED_HIRAMEKI_ID,
  no: 'TEST/PAUSED-HIRAMEKI',
  kind: 'character',
  names: ['テスト用ヒラメキ'],
  colors: ['青'],
  level: 1,
  ap: 1000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [{
    id: 'a1',
    type: 'triggered',
    scope: 'on-evidence',
    trigger: { hook: 'evidence:remove-by-action', optional: true },
    effect: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$pick',
            state: 'sleep',
            target: {
              kind: 'pick',
              query: { area: 'scene', side: 'either' },
              n: { min: 1, max: 1 },
              chooser: 'self',
            },
          },
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    },
    description: '【ヒラメキ】キャラを1枚選びスリープさせ、カードを1枚引く。',
    ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
  }],
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};
const pausedHiramekiTarget: CardDef = {
  id: PAUSED_HIRAMEKI_TARGET_ID,
  no: 'TEST/PAUSED-HIRAMEKI-TARGET',
  kind: 'character',
  names: ['対象'],
  colors: ['赤'],
  level: 1,
  ap: 1000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

describe('hiramekiResolve dispatch (Commit 3a)', () => {
  function resolvePendingHirameki(choice: 'fire' | 'skip') {
    const pending = useGameStateStore.getState().pendingHirameki;
    if (!pending) throw new Error('expected pending Hirameki');
    return dispatchEngineAction(bindPendingDecision(pending, { type: 'hiramekiResolve', choice }));
  }

  beforeAll(() => {
    registerAll();
    registerHiramekiListener();
    registerCardDef(pausedHirameki);
    registerCardDef(pausedHiramekiTarget);
  });

  beforeEach(() => {
    useGameStateStore.setState({ gameState: null, pendingHirameki: null, pendingEffectPick: null });
    _resetPendingHirameki();
    _clearPendingEffectPickQueue();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  afterEach(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  function makeStateWithDeckAndPending(): GameState {
    const s = createEmptyGameState();
    s.players.self.deck = ['x1', 'x2', 'x3'];
    s.players.self.hand = [];
    return s;
  }

  it('listener が pending を set した後 dispatchEngineAction 経由で Zustand へ転送される', () => {
    const s = makeStateWithDeckAndPending();
    s.players.self.evidence = [
      { cardId: 'D08013', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    useGameStateStore.setState({ gameState: s });

    // 直接 emit してから side channel が drain されることを確認するため、
    // 何らかの dispatch を経由する必要がある。ここでは reasoning dispatch を ((中身は無関係)) 利用。
    // 代わりに event.emit を直接呼んで side channel をセット → dispatch (no-op) で drain。
    engine.event.emit(
      useGameStateStore.getState().gameState!,
      'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'D08013' } },
      { player: 'opp', uid: 'attacker' },
    );

    // 次の dispatch で drain が走る (endTurn は state.turn.player==='opp' なので not-allowed,
    // 代わりに直接側チャネル → setState を経由するため、ここでは endTurn を試して drain 発火を見る)
    s.turn.player = 'self';
    s.turn.phase = 'main';
    useGameStateStore.setState({ gameState: s });
    dispatchEngineAction({ type: 'endTurn', player: 'self' });

    const pending = useGameStateStore.getState().pendingHirameki;
    expect(pending).not.toBeNull();
    expect(pending?.cardId).toBe('D08013');
    expect(pending?.player).toBe('self');
  });

  it('hiramekiResolve fire → ability effect が pendingEffects に queue → 解決後 hand+1', () => {
    const s = makeStateWithDeckAndPending();
    useGameStateStore.setState({
      gameState: s,
      pendingHirameki: { player: 'self', cardId: 'D08013', abilityId: 'a2' },
    });

    const r = resolvePendingHirameki('fire');
    expect(r.ok).toBe(true);
    // pendingHirameki クリア
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
    // hiramekiDraw n=1 → hand に 1 枚追加 / deck -1
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand.length).toBe(1);
    expect(after.players.self.deck.length).toBe(2);
  });

  it('hiramekiResolve は解決中の証拠カードを refresh 対象から除外する', () => {
    const s = makeStateWithDeckAndPending();
    s.players.self.deck = [];
    // 実運用では evidence 離脱処理が効果解決前に remove へ置く。
    s.players.self.remove = ['D08013'];
    useGameStateStore.setState({
      gameState: s,
      pendingHirameki: { player: 'self', cardId: 'D08013', abilityId: 'a2' },
    });

    const r = resolvePendingHirameki('fire');
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand).toEqual([]);
    expect(after.players.self.remove).toEqual(['D08013']);
    expect(after.gameResult).toMatchObject({ winner: 'opp', reason: 'deck-out' });
  });

  it('human ヒラメキが pick で pause/resume しても解決中カードを exact refresh から除外する', () => {
    const s = createEmptyGameState();
    const target = mutate.scene.enter(s, 'opp', PAUSED_HIRAMEKI_TARGET_ID, {});
    s.players.self.deck = ['DRAW'];
    // 実運用の evidence 離脱後。解決中 source と通常の refresh 対象を同居させる。
    s.players.self.remove = [PAUSED_HIRAMEKI_ID, 'REFRESHABLE'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    useGameStateStore.setState({
      gameState: s,
      pendingHirameki: { player: 'self', cardId: PAUSED_HIRAMEKI_ID, abilityId: 'a1' },
    });

    expect(resolvePendingHirameki('fire').ok).toBe(true);
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick?.atomVerb).toBe('sceneSetState');
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve',
      pickedUid: target.uid,
    })).ok).toBe(true);

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene.find((c) => c.uid === target.uid)?.state, 'pause 前の選択効果').toBe('sleep');
    expect(after.players.self.hand, 'resume 後の draw').toEqual(['DRAW']);
    expect(after.players.self.remove, '解決中ヒラメキは refresh 対象外').toEqual([PAUSED_HIRAMEKI_ID]);
    expect(after.players.self.deck, '通常 remove カードだけ refresh').toEqual(['REFRESHABLE']);
    expect(after.refreshCount.self).toBe(1);
    expect(after.players.opp.evidence).toHaveLength(1);
  });

  it('hiramekiResolve skip → 効果適用なし、pendingHirameki クリアのみ', () => {
    const s = makeStateWithDeckAndPending();
    useGameStateStore.setState({
      gameState: s,
      pendingHirameki: { player: 'self', cardId: 'D08013', abilityId: 'a2' },
    });

    const r = resolvePendingHirameki('skip');
    expect(r.ok).toBe(true);
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand.length).toBe(0); // 不変
    expect(after.players.self.deck.length).toBe(3); // 不変
  });

  it('pendingHirameki なし状態で hiramekiResolve dispatch → not-allowed', () => {
    const s = makeStateWithDeckAndPending();
    useGameStateStore.setState({ gameState: s, pendingHirameki: null });
    const r = dispatchEngineAction({
      type: 'hiramekiResolve',
      choice: 'fire',
      decisionId: 'missing-decision',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-allowed');
  });
});
