import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createEmptyGameState } from "@/engine/state-factory";
import { useMulliganStore } from "@/ui/hooks/useMulligan";
import {
  beginMatchSession,
  commitMatchSession,
  endMatchSession,
} from "@/ui/services/matchSession";
import { useGameStateStore } from "@/ui/state/store";
import {
  resetPresentationQueue,
} from "@/ui/presentation/coordinator";
import { usePresentationStore } from "@/ui/presentation/store";
import { RealMatchView } from "../../meta-app/src/screens/RealMatchView";

const replayMock = vi.hoisted(() => ({ log: null as object | null }));
const presentationHostMock = vi.hoisted(() => ({
  onTerminalDrained: null as null | (() => void),
}));

vi.mock("@/ui/components/Playmat", () => ({
  Playmat: ({
    replayReadOnly,
    replayViewer,
  }: {
    replayReadOnly?: boolean;
    replayViewer?: string;
  }) => (
    <div
      data-testid="active-playmat"
      data-replay-read-only={String(replayReadOnly ?? false)}
      data-replay-viewer={replayViewer ?? "none"}
    >
      旧盤面
    </div>
  ),
}));
vi.mock("@/ui/hooks/useReplayDriver", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/ui/hooks/useReplayDriver")>(),
  useReplayDriver: () => ({ state: { log: replayMock.log } }),
}));
vi.mock("@/ui/components/ReplayPanel", () => ({ ReplayPanel: () => null }));
vi.mock("@/ui/hooks/useEffectPickFlowDriver", () => ({
  useEffectPickFlowDriver: vi.fn(),
}));
vi.mock("@/ui/hooks/useHiramekiDemoDriver", () => ({
  useHiramekiDemoDriver: vi.fn(),
}));
vi.mock("@/ui/hooks/useCutinDemoDriver", () => ({
  useCutinDemoDriver: vi.fn(),
  _resetCutinDemoDriver: vi.fn(),
}));
vi.mock("@/ui/components/HiramekiDemoPickerModal", () => ({
  HiramekiDemoPickerModal: () => (
    <div data-testid="meta-hirameki-demo-picker">Hirameki picker</div>
  ),
}));
vi.mock("@/ui/components/CutinDemoPickerModal", () => ({
  CutinDemoPickerModal: () => (
    <div data-testid="meta-cutin-demo-picker">Cutin picker</div>
  ),
}));
vi.mock("@/ui/presentation/PresentationCoordinatorHost", () => ({
  PresentationCoordinatorHost: ({
    onTerminalDrained,
  }: {
    onTerminalDrained?: () => void;
  }) => {
    presentationHostMock.onTerminalDrained = onTerminalDrained ?? null;
    return null;
  },
}));

describe("RealMatchView initializing UI", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    replayMock.log = null;
    presentationHostMock.onTerminalDrained = null;
    resetPresentationQueue("real-match-view-test");
    usePresentationStore.setState({ presentationCompletionNotice: null });
    useGameStateStore.setState({
      gameState: createEmptyGameState(),
      spectatorMode: false,
    });
    useMulliganStore.getState()._reset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useMulliganStore.getState()._reset();
    endMatchSession();
    vi.useRealTimers();
  });

  it("replaces a previous playmat with only loading and the current mulligan dialog", () => {
    act(() => { beginMatchSession("self"); });
    act(() => { useGameStateStore.setState({ gameState: createEmptyGameState() }); });
    act(() => root.render(<RealMatchView onMatchEnd={() => undefined} />));
    expect(
      container.querySelector('[data-testid="active-playmat"]'),
    ).not.toBeNull();

    act(() => {
      useMulliganStore
        .getState()
        ._setCurrent({ player: "self", hand: ["D08003"] });
      useGameStateStore.setState({ gameState: null });
    });

    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "対戦を準備しています",
    );
    expect(
      container.querySelector('[aria-labelledby="mulligan-modal-title"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="active-playmat"]'),
    ).toBeNull();
    expect(container.querySelector(".game-setup-modal")).toBeNull();
  });

  it("rejects a stale session commit in the rendered view and shows only the fresh commit", () => {
    act(() => root.render(<RealMatchView onMatchEnd={() => undefined} />));

    let staleToken = 0;
    let freshToken = 0;
    act(() => {
      staleToken = beginMatchSession("self");
      freshToken = beginMatchSession("self");
    });

    const staleState = createEmptyGameState();
    staleState.players.self.case.cardId = "STALE-CASE";
    let staleAccepted = true;
    act(() => {
      staleAccepted = commitMatchSession(staleToken, staleState);
    });

    expect(staleAccepted).toBe(false);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "対戦を準備しています",
    );
    expect(
      container.querySelector('[data-testid="active-playmat"]'),
    ).toBeNull();

    const freshState = createEmptyGameState();
    freshState.players.self.case.cardId = "FRESH-CASE";
    let freshAccepted = false;
    act(() => {
      freshAccepted = commitMatchSession(freshToken, freshState);
    });

    expect(freshAccepted).toBe(true);
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="active-playmat"]'),
    ).not.toBeNull();
  });

  it.each([
    [{ schemaVersion: 3, viewerMode: "solo-self" }, "solo-self"],
    [{ schemaVersion: 3, viewerMode: "spectator" }, "spectator"],
    [{ schemaVersion: 1 }, "solo-self"],
  ])("passes the loaded replay viewer mode to Playmat", (log, expectedViewer) => {
    replayMock.log = log;

    act(() => root.render(<RealMatchView onMatchEnd={() => undefined} />));

    expect(container.querySelector('[data-testid="active-playmat"]')?.getAttribute(
      "data-replay-viewer",
    )).toBe(expectedViewer);
  });

  it("offers a setup recovery action when MATCH has no active session", () => {
    const onReturnToSetup = vi.fn();
    act(() => {
      endMatchSession();
      useGameStateStore.setState({ gameState: null });
      root.render(
        <RealMatchView
          onMatchEnd={() => undefined}
          onReturnToSetup={onReturnToSetup}
        />,
      );
    });

    const recovery = container.querySelector<HTMLButtonElement>(
      '[data-testid="match-recovery-setup"]',
    );
    expect(recovery).not.toBeNull();
    act(() => recovery?.click());
    expect(onReturnToSetup).toHaveBeenCalledTimes(1);
  });

  it("keeps the real Hirameki reset path on MATCH and exposes its picker", () => {
    const session = beginMatchSession("self");
    expect(commitMatchSession(session, createEmptyGameState())).toBe(true);
    useGameStateStore.setState({
      hiramekiDemoMode: "completed",
      hiramekiDemoSelectedCardId: "B04028",
    });
    act(() => root.render(<RealMatchView onMatchEnd={() => undefined} />));

    const reset = container.querySelector<HTMLButtonElement>(
      '[data-testid="hirameki-demo-banner-reset"]',
    );
    expect(reset).not.toBeNull();
    act(() => reset!.click());

    expect(
      container.querySelector('[data-testid="meta-hirameki-demo-picker"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="match-recovery-setup"]')).toBeNull();
  });

  it("keeps the real Cutin reset path on MATCH and exposes its picker", () => {
    const session = beginMatchSession("self");
    expect(commitMatchSession(session, createEmptyGameState())).toBe(true);
    useGameStateStore.setState({
      cutinDemoMode: "completed",
      cutinDemoSelectedCardId: "D08018",
    });
    act(() => root.render(<RealMatchView onMatchEnd={() => undefined} />));

    const reset = container.querySelector<HTMLButtonElement>(
      '[data-testid="cutin-demo-banner-reset"]',
    );
    expect(reset).not.toBeNull();
    act(() => reset!.click());

    expect(
      container.querySelector('[data-testid="meta-cutin-demo-picker"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="match-recovery-setup"]')).toBeNull();
  });

  it("routes a finished live match only after the presentation host drains", () => {
    const liveState = createEmptyGameState();
    useGameStateStore.setState({ gameState: liveState });
    const onMatchEnd = vi.fn();

    act(() => root.render(<RealMatchView onMatchEnd={onMatchEnd} />));
    const terminalState = structuredClone(liveState);
    terminalState.gameResult = { winner: "self", reason: "evidence" };
    act(() => useGameStateStore.setState({ gameState: terminalState }));
    expect(onMatchEnd).not.toHaveBeenCalled();

    act(() => {
      presentationHostMock.onTerminalDrained?.();
      presentationHostMock.onTerminalDrained?.();
    });
    expect(onMatchEnd).toHaveBeenCalledOnce();
  });

  it("never routes a terminal replay into the live result flow", () => {
    vi.useFakeTimers();
    const state = createEmptyGameState();
    state.gameResult = { winner: "self", reason: "evidence" };
    useGameStateStore.setState({ gameState: state });
    replayMock.log = {};
    const onMatchEnd = vi.fn();

    act(() => root.render(<RealMatchView onMatchEnd={onMatchEnd} />));
    expect(
      container.querySelector('[data-testid="active-playmat"]')?.getAttribute(
        "data-replay-read-only",
      ),
    ).toBe("true");
    act(() => presentationHostMock.onTerminalDrained?.());
    expect(onMatchEnd).not.toHaveBeenCalled();
  });

  it("does not route a remounted terminal state that never observed the live match", () => {
    const terminalState = createEmptyGameState();
    terminalState.gameResult = { winner: "self", reason: "evidence" };
    useGameStateStore.setState({ gameState: terminalState });
    const onMatchEnd = vi.fn();

    act(() => root.render(<RealMatchView onMatchEnd={onMatchEnd} />));
    act(() => presentationHostMock.onTerminalDrained?.());
    expect(onMatchEnd).not.toHaveBeenCalled();
  });
});
