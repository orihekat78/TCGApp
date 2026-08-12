// Phase 7 Task 7.3: Playmat layout structure tests
// renderToString で SSR snapshot + class/構造アサーション

import { describe, it, expect, beforeAll } from 'vitest';
import { renderToString } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Playmat } from '@/ui/components/Playmat';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';
import { createEmptyGameState } from '@/engine/state-factory';
import { useGameStateStore } from '@/ui/state/store';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useSceneSwitchPickerStore } from '@/ui/hooks/useSceneSwitchPickerStore';
import { registerAll } from '@/cards';

const resolveCard = (_cardId: string): ResolvedCardMeta => ({
  name: '???',
  color: 'blue',
  ap: 0,
  lp: 0,
  lv: 0,
});

describe('Playmat', () => {
  beforeAll(() => {
    registerAll();
  });

  it('renders the scaler + stage shell at 1920×1080', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).toMatch(/class="scaler"/);
    expect(html).toMatch(/id="scaler"/);
    expect(html).toMatch(/class="stage"/);
  });

  it('851x393でも1920x1080の同一盤面と既存操作をそのまま縮小表示する', () => {
    const previousWidth = window.innerWidth;
    const previousHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 851 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 393 });

    try {
      const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
      expect(html).toContain('data-playmat-layout="desktop"');
      expect(html).toContain('data-playmat-fit="contained-landscape"');
      expect(html).toContain('data-playmat-logical-width="1920"');
      expect(html).toContain('data-playmat-logical-height="1080"');
      expect(html).toContain('class="board-content"');
      const boardTag = html.match(/<div class="board-content"[^>]*>/)?.[0];
      expect(boardTag).toBeDefined();
      expect(boardTag).not.toContain('aria-hidden');
      expect(html).not.toContain('mobile-match-status-rail');
      expect(html).not.toContain('actions-panel--mobile-rail');
      expect(html).toContain('class="actions-panel"');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: previousHeight });
    }
  });

  it('keeps the desktop board visible and inert-free in compact spectator replay', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const previousWidth = window.innerWidth;
    const previousHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 851 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 393 });

    const state = createEmptyGameState();
    state.players.self.hand = ['SECRET-SELF-A', 'SECRET-SELF-B'];
    state.players.opp.hand = ['SECRET-OPP-A'];
    useTargetPickerStore.getState()._setPhase({
      phase: 'picking',
      candidates: ['secret-target'],
      purpose: 'replay-test',
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => root.render(
        <Playmat
          gameState={state}
          resolveCard={resolveCard}
          resolveHandCard={() => { throw new Error('spectator replay resolved a private hand'); }}
          replayReadOnly={true}
          replayViewer="spectator"
        />,
      ));

      const board = container.querySelector('.board-content');
      expect(board).not.toBeNull();
      expect(board!.hasAttribute('inert')).toBe(false);
      expect(board!.hasAttribute('aria-hidden')).toBe(false);
      expect(container.querySelector('.mobile-match-status-rail')).toBeNull();
      expect(container.querySelector('.actions-panel')).toBeNull();
      expect(container.querySelector('[data-testid="replay-hand-strip"]')).not.toBeNull();
      expect(container.querySelectorAll('.replay-hand-card-back')).toHaveLength(2);
      expect(container.querySelector('.hand-mini-card')).toBeNull();
      expect(container.textContent).not.toContain('SECRET-SELF');
      expect(container.textContent).not.toContain('secret-target');
      expect(container.querySelector('.evidence-area[role="button"]')).toBeNull();

      act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
      expect(useTargetPickerStore.getState().phase.phase).toBe('picking');
    } finally {
      act(() => root.unmount());
      container.remove();
      useTargetPickerStore.getState()._reset();
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: previousHeight });
    }
  });

  it('reveals the owner hand in solo replay while keeping the board read-only', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['SELF-HAND-A', 'SELF-HAND-B'];
    const html = renderToString(
      <Playmat
        gameState={state}
        resolveCard={resolveCard}
        resolveHandCard={(cardId) => ({
          cardId,
          name: `visible:${cardId}`,
          color: 'blue',
          type: 'キャラ',
          cost: 1,
          ap: 1000,
          lp: 1,
          lv: 1,
        })}
        replayReadOnly={true}
        replayViewer="solo-self"
      />,
    );

    expect(html).toContain('aria-label="visible:SELF-HAND-A"');
    expect(html).toContain('aria-label="visible:SELF-HAND-B"');
    expect(html).not.toContain('replay-hand-card-back');
    expect(html).not.toContain('actions-panel');
  });

  it('renders background and vignette layers', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).toMatch(/class="bg"/);
    expect(html).toMatch(/class="vignette"/);
  });

  it('renders TopBar + HandZone real components (default for null state)', () => {
    const raw = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    // React SSR は隣接 text 子要素間に <!-- --> を挿入するため除去
    const html = raw.replace(/<!--.*?-->/g, '');
    // TopBar real component (uses defaults when gameState is null)
    expect(html).toMatch(/class="topbar"[^>]*role="banner"/);
    expect(html).toMatch(/chapter-tag/);
    expect(html).toMatch(/先攻 1ターン目/);
    expect(html).toMatch(/効果スタック: 0/);
    // HandZone real component (empty when no resolveHandCard)
    expect(html).toMatch(/hand-zone hand-zone--empty/);
    expect(html).toMatch(/手札なし/);
  });

  it('marks hand cards unavailable while an exclusive decision owns interaction', () => {
    const state = createEmptyGameState();
    state.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.hand = ['CARD-A'];
    useGameStateStore.setState({
      gameState: state,
      pendingPublicHandReveal: {
        owner: 'self',
        audience: 'all',
        cardIds: ['CARD-A'],
        handSnapshot: ['CARD-A'],
        lifetime: 'effect',
        resolutionToken: 'public-hand-reveal:playmat-lock',
        source: {},
      },
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => root.render(
        <Playmat
          gameState={state}
          resolveCard={resolveCard}
          resolveHandCard={() => ({
            cardId: 'CARD-A',
            name: 'Card A',
            color: 'blue',
            type: 'character',
            cost: 1,
            ap: 1000,
            lp: 1,
            lv: 1,
          } as never)}
        />,
      ));
      const handCard = container.querySelector<HTMLButtonElement>(
        '.hand-mini-card[data-card-id="CARD-A"]',
      );
      expect(handCard?.dataset.usable).toBe('false');
    } finally {
      act(() => root.unmount());
      container.remove();
      useGameStateStore.setState({ gameState: null, pendingPublicHandReveal: null });
    }
  });

  it('does not resolve a switch victim after another decision takes interaction ownership', () => {
    const state = createEmptyGameState();
    state.players.self.scene.push({
      cardId: 'D08001',
      uid: 'switch-victim-1',
      state: 'active',
      isNamed: false,
      enterOrder: 0,
      setCards: [],
      stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null,
      lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    });
    let resolved: string | null | undefined;
    useGameStateStore.setState({ gameState: state, pendingPublicHandReveal: null });
    useSceneSwitchPickerStore.getState()._open({
      cardId: 'D08002',
      newCardName: 'New card',
      candidates: [{
        uid: 'switch-victim-1',
        cardId: 'D08001',
        name: 'Victim',
        state: 'active',
        isNamed: false,
      }],
      resolve: (uid) => { resolved = uid; },
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => root.render(<Playmat gameState={state} resolveCard={resolveCard} />));
      act(() => useGameStateStore.setState({
        pendingPublicHandReveal: {
          owner: 'self',
          audience: 'all',
          cardIds: ['SECRET-A'],
          handSnapshot: ['SECRET-A'],
          lifetime: 'effect',
          resolutionToken: 'public-hand-reveal:switch-lock',
          source: {},
        },
      }));

      const victim = container.querySelector<HTMLElement>('[data-uid="switch-victim-1"]');
      expect(victim).not.toBeNull();
      act(() => victim?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

      expect(resolved).toBeUndefined();
      expect(useSceneSwitchPickerStore.getState().current).not.toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
      useSceneSwitchPickerStore.getState()._close();
      useGameStateStore.setState({ gameState: null, pendingPublicHandReveal: null });
    }
  });

  it('does not render LogPanel when closed (Phase 8.5: LOG ボタンは ActionsPanel に集約)', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).not.toMatch(/class="log-panel"/);
    // ActionsPanel 内の LOG ボタンは描画される
    expect(html).toMatch(/class="panel-log-btn"/);
    expect(html).toMatch(/class="panel-log-btn-count">0/);
  });

  it('closes local hand, browse, card-detail, and log overlays when the supplied match becomes terminal', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const state = createEmptyGameState();
    state.players.self.hand = ['D08015'];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      act(() => root.render(<Playmat
        gameState={state}
        resolveCard={resolveCard}
        resolveHandCard={(cardId) => ({
          cardId, name: cardId, color: 'blue', type: '繧ｭ繝｣繝ｩ', cost: 1, ap: 1, lp: 1, lv: 1,
        })}
      />));
      act(() => (container.querySelector('.panel-log-btn') as HTMLButtonElement).click());
      act(() => (container.querySelector('.hand-mini-card') as HTMLElement).click());
      expect(container.querySelector('.hand-zone--expanded')).not.toBeNull();
      act(() => (container.querySelector('[data-testid="hand-card-magnifier-D08015"]') as HTMLButtonElement).click());
      act(() => (container.querySelector('.remove-area.side-self') as HTMLElement).click());
      expect(container.querySelector('.log-panel')).not.toBeNull();
      expect(container.querySelector('.card-list-modal')).not.toBeNull();
      expect(container.querySelector('.card-expand-modal-backdrop')).not.toBeNull();

      const terminal = structuredClone(state);
      terminal.gameResult = { winner: 'self', reason: 'evidence' };
      act(() => root.render(<Playmat
        gameState={terminal}
        resolveCard={resolveCard}
        resolveHandCard={(cardId) => ({
          cardId, name: cardId, color: 'blue', type: '繧ｭ繝｣繝ｩ', cost: 1, ap: 1, lp: 1, lv: 1,
        })}
      />));

      expect(container.querySelector('.log-panel')).toBeNull();
      expect(container.querySelector('.hand-zone--expanded')).toBeNull();
      expect(container.querySelector('.card-list-modal')).toBeNull();
      expect(container.querySelector('.card-expand-modal-backdrop')).toBeNull();

      act(() => (container.querySelector('.panel-log-btn') as HTMLButtonElement).click());
      act(() => (container.querySelector('.hand-mini-card') as HTMLElement).click());
      act(() => (container.querySelector('.remove-area.side-self') as HTMLElement).click());
      expect(container.querySelector('.log-panel')).toBeNull();
      expect(container.querySelector('.hand-zone--expanded')).toBeNull();
      expect(container.querySelector('.card-list-modal')).toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('does not offer card details from a log entry', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const state = createEmptyGameState();
    state.log.push({
      ts: 1,
      player: 'self',
      turn: 1,
      action: 'handUseCard',
      target: 'D08015',
    });
    useGameStateStore.setState({ gameState: state });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => root.render(<Playmat gameState={state} resolveCard={resolveCard} />));
      const logButton = container.querySelector('.panel-log-btn') as HTMLButtonElement | null;
      expect(logButton).not.toBeNull();
      act(() => logButton!.click());

      expect(container.querySelector('button[aria-label*="D08015"]')).toBeNull();
      expect(container.querySelector('.card-expand-modal-backdrop')).toBeNull();
      expect(container.querySelector('.log-panel')).not.toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
      useGameStateStore.setState({ gameState: null });
    }
  });

  it('renders ActionsPanel (Phase 8.6 — 8 action items (6 main + assist + solve-case) + phase toggles + END turn)', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).toMatch(/class="actions-panel"[^>]*aria-label="操作パネル"/);
    expect(html).toMatch(/actions-header">ACTIONS</);
    // 6 main + アシスト + 事件解決 = 8 items (Phase 8.6 で追加)
    expect(html.match(/class="action-item/g)?.length).toBe(8);
    expect(html).toMatch(/data-action-id="hand-use"/);
    expect(html).toMatch(/data-action-id="action"/);
    expect(html).toMatch(/data-action-id="assist"/);
    expect(html).toMatch(/data-action-id="solve-case"/);
    // phase toggles
    expect(html.match(/data-phase="(auto|main|end)"/g)?.length).toBe(3);
    // END turn
    expect(html).toMatch(/class="end-turn-btn"[^>]*aria-label="ターン終了"/);
  });

  it('renders both opponent and self mats inside play-area', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).toMatch(/class="play-area"/);
    expect(html).toMatch(/class="mat opp"[^>]*data-side="opp"/);
    expect(html).toMatch(/class="mat self"[^>]*data-side="self"/);
  });

  it('mats are in opp → self order (Phase 7.5: KEEP OUT 撤去)', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    const oppIdx = html.indexOf('data-side="opp"');
    const selfIdx = html.indexOf('data-side="self"');
    expect(oppIdx).toBeGreaterThan(0);
    expect(selfIdx).toBeGreaterThan(oppIdx);
    // KEEP OUT は Phase 7.5 で撤去済
    expect(html).not.toMatch(/class="keep-out"/);
  });

  it('renders SceneArea inside each mat with correct side prop', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html.match(/scene-area side-opp/g)?.length).toBe(1);
    expect(html.match(/scene-area side-self/g)?.length).toBe(1);
  });

  it('renders all 7 zone slots per mat in the new 3-col layout', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    // 各ゾーンは 2 (opp + self) で計 14
    expect(html.match(/class="left-col"/g)?.length).toBe(2);
    expect(html.match(/class="center-col"/g)?.length).toBe(2);
    expect(html.match(/class="right-col"/g)?.length).toBe(2);
    expect(html.match(/class="below-scene"/g)?.length).toBe(2);
    expect(html.match(/case-area side-/g)?.length).toBe(2);
    expect(html.match(/evidence-area side-/g)?.length).toBe(2);
    expect(html.match(/scene-col scene-zone/g)?.length).toBe(2);
    expect(html.match(/partner-col partner-zone/g)?.length).toBe(2);
    expect(html.match(/deck-col deck-zone/g)?.length).toBe(2);
    expect(html.match(/remove-col remove-zone/g)?.length).toBe(2);
    expect(html.match(/file-area side-/g)?.length).toBe(2);
  });

  it('renders CaseArea (real component, empty when null state)', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html.match(/case-area side-opp/g)?.length).toBe(1);
    expect(html.match(/case-area side-self/g)?.length).toBe(1);
    expect(html.match(/case-empty/g)?.length).toBe(2);
    // Round 3: case-edition-tag が事件↔証拠 余白に追加されたため "未開始" 表示が 4 → 8 に増加
    //   内訳: case-area aria-label + 表示テキスト 2 × 2 mat = 4
    //         case-edition-tag aria-label + 表示テキスト 2 × 2 mat = 4
    expect(html.match(/未開始/g)?.length).toBe(8);
  });

  it('maps black and white engine case colors without a resolver fallback', () => {
    const state = createEmptyGameState();
    state.players.self.case.cardId = 'BLACK-CASE';
    state.players.self.case.colors = ['黒'];
    state.players.opp.case.cardId = 'WHITE-CASE';
    state.players.opp.case.colors = ['白'];

    const html = renderToString(<Playmat gameState={state} resolveCard={resolveCard} />);

    expect(html).toMatch(/case-card[^"]*color-black/);
    expect(html).toMatch(/case-card[^"]*color-white/);
  });

  it('shows the chooser own misread candidates when the human player is opp, but not in spectator mode', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const state = createEmptyGameState();
    state.players.self.scene.push({
      cardId: 'SELF-REASONER', uid: 'self-reasoner#1', state: 'active',
      isNamed: false, enterOrder: 0,
      setCards: [], stackedCards: [], keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    });
    state.players.opp.scene.push({
      cardId: 'OPP-MISREAD', uid: 'opp-misread#1', state: 'active',
      isNamed: false, enterOrder: 0,
      setCards: [], stackedCards: [], keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    });
    useGameStateStore.setState({
      gameState: state,
      pendingMisread: {
        player: 'opp',
        reasoningUid: 'self-reasoner#1',
        reasoningPlayer: 'self',
        candidates: [{ uid: 'opp-misread#1', x: 1 }],
      },
    });
    const humanSide = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };
    const previousHumanSide = humanSide.__humanPlayerSide;
    const container = document.createElement('div');
    const root = createRoot(container);

    try {
      humanSide.__humanPlayerSide = 'opp';
      act(() => root.render(<Playmat gameState={state} resolveCard={resolveCard} />));
      expect(container.querySelector('[data-testid="misread-picker-modal"]')).not.toBeNull();
      expect(container.textContent).toContain('OPP-MISREAD');
      expect(container.querySelector('[data-testid="misread-card-opp-misread#1"] img')).not.toBeNull();
      expect(container.querySelector('[data-testid="misread-detail-opp-misread#1"]')).not.toBeNull();

      humanSide.__humanPlayerSide = null;
      act(() => {
        useGameStateStore.setState({
          spectatorMode: true,
          pendingMisread: {
            player: 'opp',
            reasoningUid: 'self-reasoner#1',
            reasoningPlayer: 'self',
            candidates: [],
          },
        });
        root.render(<Playmat gameState={state} resolveCard={resolveCard} />);
      });
      expect(container.querySelector('[data-testid="misread-picker-modal"]')).toBeNull();
      expect(useGameStateStore.getState().pendingMisread).toBeNull();
    } finally {
      act(() => root.unmount());
      humanSide.__humanPlayerSide = previousHumanSide;
      useGameStateStore.setState({ gameState: null, pendingMisread: null, spectatorMode: false });
    }
  });

  it('passes the pending hirameki card identity to its source-card controls', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const humanSide = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };
    const previousHumanSide = humanSide.__humanPlayerSide;
    humanSide.__humanPlayerSide = 'self';
    const state = createEmptyGameState();
    useGameStateStore.setState({
      gameState: state,
      pendingHirameki: { player: 'self', cardId: 'D08013', abilityId: 'a2' },
      spectatorMode: false,
    });
    const container = document.createElement('div');
    const root = createRoot(container);

    try {
      act(() => root.render(<Playmat gameState={state} resolveCard={resolveCard} />));
      expect(container.querySelector('[data-testid="hirameki-picker-modal"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="hirameki-source-card"] img')).not.toBeNull();
      expect(container.querySelector('[data-testid="hirameki-source-card-detail"]')).not.toBeNull();
    } finally {
      act(() => root.unmount());
      humanSide.__humanPlayerSide = previousHumanSide;
      useGameStateStore.setState({ gameState: null, pendingHirameki: null, spectatorMode: false });
    }
  });

  it('renders PartnerArea (real component) inside each mat', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html.match(/partner-area side-opp/g)?.length).toBe(1);
    expect(html.match(/partner-area side-self/g)?.length).toBe(1);
    expect(html.match(/zone-watermark-keyhole/g)?.length).toBe(2);
  });

  it('renders DeckArea (real component) inside each mat with count=0 when null state', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html.match(/deck-area side-opp/g)?.length).toBe(1);
    expect(html.match(/deck-area side-self/g)?.length).toBe(1);
    expect(html.match(/class="deck-count">0</g)?.length).toBe(2);
    expect(html.match(/deck-empty/g)?.length).toBe(2);
  });

  it('renders RemoveArea (real component) inside each mat (EMPTY when null state)', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html.match(/remove-area side-opp/g)?.length).toBe(1);
    expect(html.match(/remove-area side-self/g)?.length).toBe(1);
    expect(html.match(/class="count zero">0</g)?.length).toBe(2);
    expect(html.match(/class="stack-empty"/g)?.length).toBe(2);
  });

  it('renders empty SceneArea (5/5) when gameState is null', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    // 5 empty slots per mat × 2 mats = 10 .slot-empty divs
    expect(html.match(/slot-empty/g)?.length).toBe(10);
  });
});
