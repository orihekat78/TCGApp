import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAll } from '@/cards';
import { B02052 } from '@/cards/ct-p02/B02052';
import { B02052P } from '@/cards/ct-p02/B02052P';
import { B05117 } from '@/cards/ct-p05/B05117';
import { B05117P } from '@/cards/ct-p05/B05117P';
import { B06012 } from '@/cards/ct-p06/B06012';
import { B10017 } from '@/cards/ct-p10/B10017';
import { EffectChoiceModalHost } from '@/ui/components/EffectChoiceModalHost';
import { EffectOptionalModalHost } from '@/ui/components/EffectOptionalModalHost';
import { EffectPickerModal } from '@/ui/components/EffectPickerModal';
import { EffectRepeatOptionalModalHost } from '@/ui/components/EffectRepeatOptionalModalHost';
import { EffectStackPanel } from '@/ui/components/EffectStackPanel';
import type { HandCardMeta } from '@/ui/components/HandZone';
import { Playmat } from '@/ui/components/Playmat';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetRegistry, register } from '@/engine/read/def';
import type { CardDef, EffectStackEntry, GameState } from '@/engine/types';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const { dispatchEngineActionMock, surfacePendingSideChannelsMock } = vi.hoisted(() => ({
  dispatchEngineActionMock: vi.fn(),
  surfacePendingSideChannelsMock: vi.fn(),
}));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({
  dispatchEngineAction: dispatchEngineActionMock,
  surfacePendingSideChannels: surfacePendingSideChannelsMock,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HOST: CardDef = {
  id: 'W35-UI-HOST', no: 'test/W35-UI-HOST', kind: 'character', names: ['発生源ホスト'],
  colors: ['青'], level: 1, ap: 9000, lp: 1, traits: [], keywords: [], rarity: 'C',
  imageUrl: '', abilities: [], ruleRefs: [],
};

const resolveCard = (cardId: string): ResolvedCardMeta => ({
  name: cardId,
  color: '青',
  ap: 9000,
  lp: 1,
  lv: 1,
});

const resolveHandCard = (cardId: string): HandCardMeta => ({
  cardId,
  name: cardId,
  color: 'blue',
  type: 'キャラ',
  cost: 1,
  ap: 9000,
  lp: 1,
  lv: 1,
});

function effectRowText(html: string, effectId: string): string {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper.querySelector(`[data-effect-id="${effectId}"]`)?.textContent ?? '';
}

function effectRowControlLabel(html: string, effectId: string, testId: string): string {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper
    .querySelector(`[data-effect-id="${effectId}"] [data-testid="${testId}"]`)
    ?.getAttribute('aria-label') ?? '';
}

function entry(
  id: string,
  setCardId: string,
  setCardInstanceId: string,
): EffectStackEntry {
  return {
    id,
    source: {
      player: 'self', uid: 'host', cardId: HOST.id, abilityId: 'b05117_set_t1',
      setCardId, setCardInstanceId,
    },
    triggeredBy: { hook: 'leave:to-remove' },
    triggeredAt: { turn: 4, phase: 'main', nano: 1 },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    state: 'pending',
  };
}

function stateWithSetCards(entries: Array<{ cardId: string; instanceId: string }>): GameState {
  const state = createEmptyGameState();
  state.players.self.scene = [sceneChar(HOST.id, 'host', {
    setCards: entries.map(item => ({ ...item, faceUp: true })),
  })];
  return state;
}

describe('Wave35 public effect-source identity', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    _resetRegistry();
    registerAll();
    register(HOST);
    dispatchEngineActionMock.mockClear();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStateStore.setState({
      gameState: null,
      spectatorMode: false,
      pendingEffectPick: null,
      pendingEffectChoice: null,
      pendingEffectOptional: null,
      pendingEffectRepeatOptional: null,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.setState({
      gameState: null,
      pendingEffectPick: null,
      pendingEffectChoice: null,
      pendingEffectOptional: null,
      pendingEffectRepeatOptional: null,
    });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('distinguishes mixed and same-print B05117 owner-order rows without exposing instance IDs', () => {
    const mixed = renderToString(
      <EffectStackPanel
        entries={[
          entry('mixed-base', B05117.id, 'set:fox:mixed:base'),
          entry('mixed-parallel', B05117P.id, 'set:fox:mixed:parallel'),
        ]}
        open
        reorderPlayer="self"
        onReorder={() => {}}
        onConfirmOrder={() => {}}
      />,
    );
    expect(mixed).toContain('コンコン（通常版）');
    expect(mixed).toContain('コンコン（パラレル版）');
    expect(mixed).not.toContain('発生源ホスト');
    expect(effectRowText(mixed, 'mixed-base')).toContain('コンコン（通常版）');
    expect(effectRowText(mixed, 'mixed-parallel')).toContain('コンコン（パラレル版）');

    const same = renderToString(
      <EffectStackPanel
        entries={[
          entry('same-2', B05117.id, 'set:fox:same:2'),
          entry('same-1', B05117.id, 'set:fox:same:1'),
        ]}
        open
        reorderPlayer="self"
        onReorder={() => {}}
        onConfirmOrder={() => {}}
      />,
    );
    expect(effectRowText(same, 'same-1')).toContain('コンコン（通常版・1枚目）');
    expect(effectRowText(same, 'same-2')).toContain('コンコン（通常版・2枚目）');
    expect(effectRowControlLabel(same, 'same-1', 'reorder-down-same-1'))
      .toBe('コンコン（通常版・1枚目）を下へ');
    expect(effectRowControlLabel(same, 'same-2', 'reorder-up-same-2'))
      .toBe('コンコン（通常版・2枚目）を上へ');
    expect(same).not.toContain('set:fox:same');

    const parallel = renderToString(
      <EffectStackPanel
        entries={[
          entry('parallel-2', B05117P.id, 'set:fox:parallel:2'),
          entry('parallel-1', B05117P.id, 'set:fox:parallel:1'),
        ]}
        open
        reorderPlayer="self"
        onReorder={() => {}}
        onConfirmOrder={() => {}}
      />,
    );
    expect(effectRowText(parallel, 'parallel-1')).toContain('コンコン（パラレル版・1枚目）');
    expect(effectRowText(parallel, 'parallel-2')).toContain('コンコン（パラレル版・2枚目）');
    expect(parallel).not.toContain('set:fox:parallel');
  });

  it('excludes resolved source history from the current occurrence ordinal', () => {
    const state = createEmptyGameState();
    const history = entry('history', B05117.id, 'set:1');
    history.state = 'resolved';
    const current = entry('current', B05117.id, 'set:2');
    state.pendingEffects = [history, current];
    useGameStateStore.setState({
      gameState: state,
      pendingEffectOptional: {
        player: 'self',
        source: current.source,
      },
    });

    act(() => root.render(<EffectOptionalModalHost />));

    expect(container.textContent).toContain('コンコン（通常版）');
    expect(container.textContent).not.toContain('コンコン（通常版・2枚目）');
    expect(container.textContent).not.toContain('set:2');
  });

  it('shows the exact B10017 shoe occurrence in the pending target modal', () => {
    const state = stateWithSetCards([
      { cardId: B10017.id, instanceId: 'set:shoe:1' },
      { cardId: B10017.id, instanceId: 'set:shoe:2' },
    ]);
    useGameStateStore.setState({
      gameState: state,
      pendingEffectPick: {
        player: 'self',
        candidates: [{ uid: 'target-card', cardId: HOST.id, player: 'opp', kind: 'card' }],
        atomVerb: 'sceneRemove', atomArgs: {}, nMin: 0, nMax: 1,
        source: {
          cardId: HOST.id, uid: 'host', abilityId: 'a2',
          setCardId: B10017.id, setCardInstanceId: 'set:shoe:2',
        },
      },
    });

    act(() => root.render(<EffectPickerModal />));

    expect(container.querySelector('[data-testid="effect-picker-modal"]')).not.toBeNull();
    expect(container.textContent).toContain('キック力増強シューズ（通常版・2枚目）');
    expect(container.textContent).not.toContain('発生源ホスト: 対象を選んでください');
    expect(container.textContent).not.toContain('set:shoe:2');
  });

  it('shows the exact B10017 shoe occurrence in the production direct-pick banner', () => {
    const state = stateWithSetCards([
      { cardId: B10017.id, instanceId: 'set:shoe:direct:1' },
      { cardId: B10017.id, instanceId: 'set:shoe:direct:2' },
    ]);
    state.players.opp.scene = [sceneChar(HOST.id, 'target')];
    useGameStateStore.setState({
      gameState: state,
      pendingEffectPick: {
        player: 'self',
        candidates: [{ uid: 'target', cardId: HOST.id, player: 'opp', kind: 'char', area: 'scene' }],
        atomVerb: 'sceneRemove', atomArgs: {}, nMin: 0, nMax: 1,
        source: {
          cardId: HOST.id, uid: 'host', abilityId: 'a2',
          setCardId: B10017.id, setCardInstanceId: 'set:shoe:direct:2',
        },
      },
    });

    act(() => root.render(<Playmat gameState={state} resolveCard={resolveCard} />));

    const banner = container.querySelector('.scene-pick-skip-banner');
    expect(banner?.textContent).toContain('キック力増強シューズ（通常版・2枚目）');
    expect(banner?.textContent).toContain('現場のキャラを1枚選んでリムーブしてください');
    expect(banner?.textContent).not.toContain('set:shoe:direct:2');
    expect(container.querySelector('[data-testid="effect-picker-modal"]')).toBeNull();
  });

  it('shows the exact set-card occurrence in the production public-area picker', () => {
    const state = stateWithSetCards([
      { cardId: B06012.id, instanceId: 'set:doll:area:1' },
      { cardId: B06012.id, instanceId: 'set:doll:area:2' },
    ]);
    state.players.self.remove = [HOST.id];
    useGameStateStore.setState({
      gameState: state,
      pendingEffectPick: {
        player: 'self',
        candidates: [{
          uid: `card:self:remove:${HOST.id}#0`, cardId: HOST.id,
          player: 'self', kind: 'card', area: 'remove', index: 0,
        }],
        atomVerb: 'sceneEnter',
        atomArgs: { target: { query: { area: 'remove' } } },
        nMin: 0,
        nMax: 1,
        source: {
          cardId: HOST.id, uid: 'host', abilityId: 'a3',
          setCardId: B06012.id, setCardInstanceId: 'set:doll:area:2',
        },
      },
    });

    act(() => root.render(<Playmat gameState={state} resolveCard={resolveCard} />));

    const banner = container.querySelector('.card-list-modal-pick-banner');
    expect(banner?.textContent).toContain('石川五右衛門人形（通常版・2枚目）');
    expect(banner?.textContent).toContain('リムーブから1枚選んで現場に登場させてください');
    expect(banner?.textContent).not.toContain('set:doll:area:2');
    expect(container.querySelector('[data-testid="effect-picker-modal"]')).toBeNull();
  });

  it('uses the set-card occurrence in choice and optional decision headers', () => {
    const state = stateWithSetCards([
      { cardId: B02052.id, instanceId: 'set:gun:1' },
      { cardId: B02052.id, instanceId: 'set:gun:2' },
    ]);
    useGameStateStore.setState({
      gameState: state,
      pendingEffectChoice: {
        player: 'self',
        source: {
          player: 'self', area: 'scene', cardId: HOST.id, uid: 'host', abilityId: 'a2',
          setCardId: B02052.id, setCardInstanceId: 'set:gun:1',
        },
        options: [{ index: 0, label: '選択肢' }],
      },
    });
    act(() => root.render(<EffectChoiceModalHost />));
    expect(container.textContent).toContain('トランプ銃（通常版・1枚目）');
    expect(container.textContent).not.toContain('発生源ホスト: いずれかの効果を選んでください');

    act(() => {
      useGameStateStore.setState({
        pendingEffectChoice: null,
        pendingEffectOptional: {
          player: 'self',
          source: {
            cardId: HOST.id, uid: 'host', abilityId: 'a2',
            setCardId: B02052.id, setCardInstanceId: 'set:gun:2',
          },
        },
      });
      root.render(<EffectOptionalModalHost />);
    });
    expect(container.textContent).toContain('トランプ銃（通常版・2枚目）');
    expect(container.textContent).toContain(B02052.abilities[1]!.description);
    expect(container.textContent).not.toContain('set:gun:2');
  });

  it('uses exact base, parallel, and mixed occurrences in repeat-optional headers', () => {
    const cases = [
      {
        entries: [
          { cardId: B02052.id, instanceId: 'set:repeat:base:1' },
          { cardId: B02052.id, instanceId: 'set:repeat:base:2' },
        ],
        selected: { cardId: B02052.id, instanceId: 'set:repeat:base:2' },
        label: 'トランプ銃（通常版・2枚目）',
      },
      {
        entries: [
          { cardId: B02052P.id, instanceId: 'set:repeat:parallel:1' },
          { cardId: B02052P.id, instanceId: 'set:repeat:parallel:2' },
        ],
        selected: { cardId: B02052P.id, instanceId: 'set:repeat:parallel:1' },
        label: 'トランプ銃（パラレル版・1枚目）',
      },
      {
        entries: [
          { cardId: B02052.id, instanceId: 'set:repeat:mixed:base' },
          { cardId: B02052P.id, instanceId: 'set:repeat:mixed:parallel' },
        ],
        selected: { cardId: B02052P.id, instanceId: 'set:repeat:mixed:parallel' },
        label: 'トランプ銃（パラレル版）',
      },
    ];

    for (const testCase of cases) {
      const state = stateWithSetCards(testCase.entries);
      act(() => {
        useGameStateStore.setState({
          gameState: state,
          pendingEffectRepeatOptional: {
            player: 'self',
            remaining: 2,
            source: {
              player: 'self', area: 'scene', cardId: HOST.id, uid: 'host', abilityId: 'a2',
              setCardId: testCase.selected.cardId,
              setCardInstanceId: testCase.selected.instanceId,
            },
          },
        });
        root.render(<EffectRepeatOptionalModalHost />);
      });
      expect(container.querySelector('[data-testid="repeat-optional-picker-modal"]')).not.toBeNull();
      expect(container.textContent).toContain(testCase.label);
      expect(container.textContent).not.toContain(testCase.selected.instanceId);
    }
  });

  it('uses exact base, parallel, and mixed occurrences in hand scene-enter and discard banners', () => {
    const sourceCases = [
      {
        entries: [
          { cardId: B02052.id, instanceId: 'set:hand:base:1' },
          { cardId: B02052.id, instanceId: 'set:hand:base:2' },
        ],
        selected: { cardId: B02052.id, instanceId: 'set:hand:base:2' },
        label: 'トランプ銃（通常版・2枚目）',
      },
      {
        entries: [
          { cardId: B02052P.id, instanceId: 'set:hand:parallel:1' },
          { cardId: B02052P.id, instanceId: 'set:hand:parallel:2' },
        ],
        selected: { cardId: B02052P.id, instanceId: 'set:hand:parallel:1' },
        label: 'トランプ銃（パラレル版・1枚目）',
      },
      {
        entries: [
          { cardId: B02052.id, instanceId: 'set:hand:mixed:base' },
          { cardId: B02052P.id, instanceId: 'set:hand:mixed:parallel' },
        ],
        selected: { cardId: B02052.id, instanceId: 'set:hand:mixed:base' },
        label: 'トランプ銃（通常版）',
      },
    ];
    const pickCases = [
      {
        atomVerb: 'sceneEnter' as const,
        atomArgs: { target: { query: { area: 'hand' } } },
        instruction: '手札から条件を満たすキャラを1枚まで登場させてください',
      },
      {
        atomVerb: 'discard' as const,
        atomArgs: {},
        instruction: '手札からリムーブするカードを選んでください',
      },
    ];

    for (const sourceCase of sourceCases) {
      for (const pickCase of pickCases) {
        const state = stateWithSetCards(sourceCase.entries);
        state.players.self.hand = [HOST.id];
        act(() => {
          useGameStateStore.setState({
            gameState: state,
            pendingEffectPick: {
              player: 'self',
              candidates: [{
                uid: `card:self:hand:${HOST.id}#0`, cardId: HOST.id,
                player: 'self', kind: 'card', area: 'hand', index: 0,
              }],
              atomVerb: pickCase.atomVerb,
              atomArgs: pickCase.atomArgs,
              nMin: 0,
              nMax: 1,
              source: {
                cardId: HOST.id, uid: 'host', abilityId: 'a2',
                setCardId: sourceCase.selected.cardId,
                setCardInstanceId: sourceCase.selected.instanceId,
              },
            },
          });
          root.render(
            <Playmat
              gameState={state}
              resolveCard={resolveCard}
              resolveHandCard={resolveHandCard}
            />,
          );
        });
        const banner = container.querySelector('.hand-zone-pick-banner');
        expect(banner?.textContent).toContain(sourceCase.label);
        expect(banner?.textContent).toContain(pickCase.instruction);
        expect(banner?.textContent).not.toContain(sourceCase.selected.instanceId);
      }
    }
  });
});
