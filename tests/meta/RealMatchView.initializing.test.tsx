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
import { RealMatchView } from "../../meta-app/src/screens/RealMatchView";

vi.mock("@/ui/components/Playmat", () => ({
  Playmat: () => <div data-testid="active-playmat">旧盤面</div>,
}));
vi.mock("@/ui/hooks/useReplayDriver", () => ({
  useReplayDriver: () => ({ state: { log: null } }),
}));
vi.mock("@/ui/hooks/useEffectPickFlowDriver", () => ({
  useEffectPickFlowDriver: vi.fn(),
}));
vi.mock("@/ui/hooks/useHiramekiDemoDriver", () => ({
  useHiramekiDemoDriver: vi.fn(),
}));
vi.mock("@/ui/hooks/useCutinDemoDriver", () => ({
  useCutinDemoDriver: vi.fn(),
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
  });

  it("replaces a previous playmat with only loading and the current mulligan dialog", () => {
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
});
