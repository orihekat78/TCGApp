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
import { CardsScreen } from "../../meta-app/src/screens/CardsScreen";
import { COLOR_META, EMPTY_FILTER } from "../../meta-app/src/data/cardFilter";
import { CARD_POOL } from "../../meta-app/src/data/cardPool";
import { useFiltersStore } from "../../meta-app/src/state/filtersStore";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("CARDS filter drawer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  beforeEach(() => {
    localStorage.clear();
    useFiltersStore.setState({
      cards: { ...EMPTY_FILTER },
      cardsSort: "num",
      cardsSortDir: "desc",
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("closes filters on Escape without stealing a later focus move", async () => {
    act(() => root.render(<CardsScreen onNav={() => undefined} />));

    const trigger = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.includes("絞り込み"));
    expect(trigger).toBeDefined();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelector('[role="dialog"][aria-label="カードを絞り込む"]'),
    ).toBeNull();

    act(() => trigger?.click());
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    const dialog = container.querySelector(
      '[role="dialog"][aria-label="カードを絞り込む"]',
    );
    expect(dialog).not.toBeNull();

    const partner = Array.from(
      dialog!.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.startsWith("パートナー"));
    expect(partner?.textContent?.trim()).toBe("パートナー");
    expect(partner?.getAttribute("aria-pressed")).toBe("false");
    act(() => partner?.click());
    expect(partner?.getAttribute("aria-pressed")).toBe("true");

    act(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(
      container.querySelector('[role="dialog"][aria-label="カードを絞り込む"]'),
    ).toBeNull();
    expect(document.activeElement).toBe(trigger);

    const nextAction = container.querySelector<HTMLButtonElement>('button[data-route="home"]')!;
    nextAction.focus();
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(document.activeElement).toBe(nextAction);
  });

  it("names search without exposing developer-facing OR/AND controls", () => {
    act(() => root.render(<CardsScreen onNav={() => undefined} />));

    expect(
      container.querySelector('input[aria-label="カードを検索"]'),
    ).not.toBeNull();
    const trigger = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.includes("絞り込み"));
    act(() => trigger?.click());

    expect(
      container.querySelector('[role="group"][aria-label="特徴の一致方法"]'),
    ).toBeNull();
    expect(
      container.querySelector(
        '[role="group"][aria-label="キーワードの一致方法"]',
      ),
    ).toBeNull();
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "OR",
      ),
    ).toBe(false);
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "AND",
      ),
    ).toBe(false);
  });

  it("uses the shared primary header and maps every label to its route", () => {
    const onNav = vi.fn();
    act(() => root.render(<CardsScreen onNav={onNav} />));

    const nav = container.querySelector(
      'nav[aria-label="メインナビゲーション"]',
    )!;
    expect(
      Array.from(nav.querySelectorAll("button")).map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual([
      "ホーム",
      "デッキ",
      "カード",
      "ゲーム開始",
      "チュートリアル",
      "履歴",
      "設定",
    ]);
    expect(
      nav
        .querySelector('button[data-route="cards"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");

    for (const button of Array.from(nav.querySelectorAll("button"))) {
      act(() => button.click());
    }
    expect(onNav.mock.calls).toEqual([
      ["home"],
      ["deck"],
      ["cards"],
      ["setup"],
      ["tutorial"],
      ["history"],
      ["settings"],
    ]);
  });

  it("moves the inspector to the first visible card when filtering hides the selection", () => {
    useFiltersStore.setState({ cards: { ...EMPTY_FILTER, q: "D09014" } });
    act(() => root.render(<CardsScreen onNav={() => undefined} />));

    expect(
      container
        .querySelector(".cards-selected-art")
        ?.getAttribute("aria-label"),
    ).toBe("大和敢助 を拡大表示");
  });

  it("keeps same-card print choices while excluding deck analytics from card details", () => {
    useFiltersStore.setState({ cards: { ...EMPTY_FILTER, q: "B09001" } });
    act(() => root.render(<CardsScreen onNav={() => undefined} />));

    const card = container.querySelector<HTMLElement>(
      '[role="button"][aria-label="江戸川コナン"]',
    );
    expect(card).not.toBeNull();
    act(() => card?.click());

    const printChoices = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".cards-print-variants button",
      ),
    ).map((button) => button.textContent?.trim());
    expect(printChoices).toEqual(
      expect.arrayContaining([
        "B06001Sec2",
        "B09001",
        "B09001P",
        "PR001",
        "PR002",
        "PR007",
      ]),
    );
    expect(new Set(printChoices).size).toBe(printChoices.length);
    expect(container.textContent).not.toContain("使用デッキ");
    expect(container.textContent).not.toContain("採用デッキ");
    expect(container.textContent).not.toContain("デッキへ追加");
  });

  it("keeps D08003 effect text while removing the visible EFFECT heading", () => {
    const effectCard = CARD_POOL.find((card) => card.num === "D08003");
    expect(effectCard?.effectShort).toBeTruthy();
    useFiltersStore.setState({ cards: { ...EMPTY_FILTER, q: "D08003" } });
    act(() => root.render(<CardsScreen onNav={() => undefined} />));

    const card = container.querySelector<HTMLElement>(
      '[data-card-num="D08003"] [role="button"]',
    );
    expect(card).not.toBeNull();
    act(() => card?.click());

    const detail = container.querySelector(".cards-selected-detail");
    expect(detail?.textContent).toContain(effectCard!.effectShort!);
    expect(
      Array.from(detail!.querySelectorAll("*")).some(
        (element) => element.textContent?.trim() === "EFFECT · 効果",
      ),
    ).toBe(false);
  });

  it("uses the same card-kind-specific stats in list rows", () => {
    useFiltersStore.setState({ cards: { ...EMPTY_FILTER, q: "D08001" } });
    act(() => root.render(<CardsScreen onNav={() => undefined} />));
    const listView = container.querySelector<HTMLButtonElement>(
      'button[aria-label="リスト"]',
    );
    act(() => listView?.click());

    const visibleStatNames = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          '.meta-row [role="group"]',
        ),
      ).map((stat) => stat.getAttribute("aria-label"));
    const searchFor = (q: string) => {
      act(() => useFiltersStore.getState().setCards({ q }));
    };

    expect(visibleStatNames()).toEqual(["LP 1"]);
    searchFor("D08026");
    expect(visibleStatNames()).toEqual(["先攻 7枚", "後攻 6枚"]);
    searchFor("D08024");
    expect(visibleStatNames()).toEqual(["C 6"]);
    searchFor("D08003");
    expect(visibleStatNames()).toEqual(["C 8", "AP 7,000", "LP 2"]);
  });

  it("shows every print choice in canonical order without a next-print control", () => {
    useFiltersStore.setState({ cards: { ...EMPTY_FILTER, q: "B09001" } });
    act(() => root.render(<CardsScreen onNav={() => undefined} />));

    const activePrint = () =>
      container.querySelector<HTMLButtonElement>(
        '.cards-print-chip[aria-checked="true"]',
      );
    const printChips = () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(".cards-print-chip"),
      );
    const printNumbers = printChips().map((chip) => chip.textContent);
    const selectedCard = CARD_POOL.find((card) => card.num === "B09001");
    expect(selectedCard).toBeDefined();
    const expectedPrintNumbers = CARD_POOL.filter(
      (card) => card.id === selectedCard!.id,
    ).map((card) => card.num);
    expect(printNumbers).toEqual(expectedPrintNumbers);
    expect(printNumbers).toEqual(
      expect.arrayContaining([
        "B06001Sec2",
        "B09001",
        "B09001P",
        "PR001",
        "PR002",
        "PR007",
      ]),
    );

    expect(
      container.querySelector(
        'button[aria-label="\u6b21\u306e\u5225\u30a4\u30e9\u30b9\u30c8"]',
      ),
    ).toBeNull();

    const printSelector = container.querySelector<HTMLElement>(
      ".cards-print-selector",
    );
    expect(printSelector?.getAttribute("role")).toBe("radiogroup");
    const initiallyActive = activePrint();
    expect(initiallyActive).not.toBeNull();
    expect(initiallyActive?.getAttribute("role")).toBe("radio");
    expect(initiallyActive?.getAttribute("aria-checked")).toBe("true");
    expect(initiallyActive?.tabIndex).toBe(0);
    expect(
      printChips().filter((chip) => chip.tabIndex === 0),
    ).toHaveLength(1);
    expect(
      printChips()
        .filter((chip) => chip !== initiallyActive)
        .every((chip) => chip.tabIndex === -1),
    ).toBe(true);

    const activeIndex = printChips().indexOf(initiallyActive!);
    const nextPrintNumber = printNumbers[(activeIndex + 1) % printNumbers.length];
    act(() => {
      initiallyActive?.focus();
      initiallyActive?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });
    expect(activePrint()?.textContent).toBe(nextPrintNumber);
    expect(activePrint()).toBe(document.activeElement);

    for (const [index, chip] of printChips().entries()) {
      act(() => chip.click());
      expect(activePrint()?.textContent).toBe(printNumbers[index]);
    }
  });

  it("does not offer a purple card-color filter", () => {
    expect(COLOR_META.map(({ c }) => c)).not.toContain("purple");
  });

  it("renders only the rules-relevant stat labels for partner, incident, event, and character details", () => {
    const statViewFor = (num: string, sourceNum = num) => {
      useFiltersStore.setState({ cards: { ...EMPTY_FILTER, q: sourceNum } });
      act(() => root.render(<CardsScreen onNav={() => undefined} />));

      const card = container.querySelector<HTMLElement>(
        `[data-card-num="${sourceNum}"] [role="button"]`,
      );
      expect(card).not.toBeNull();
      act(() => card?.click());

      if (num !== sourceNum) {
        const print = Array.from(
          container.querySelectorAll<HTMLButtonElement>(".cards-print-chip"),
        ).find((button) => button.textContent === num);
        expect(print).not.toBeNull();
        act(() => print?.click());
      }

      const stats = container.querySelector<HTMLElement>(
        '.cards-selected-stats[role="group"][aria-label="\u30ab\u30fc\u30c9\u306e\u80fd\u529b\u5024"]',
      );
      expect(stats).not.toBeNull();
      return {
        labels: Array.from(
          stats!.querySelectorAll<HTMLElement>('[role="group"][aria-label]'),
        ).map((stat) => stat.getAttribute("aria-label")),
        text: stats!.textContent?.replace(/\s/g, ""),
      };
    };

    const partner = CARD_POOL.find((card) => card.num === "D08001")!;
    expect(partner.type).toBe("partner");
    expect(statViewFor(partner.num)).toEqual({
      labels: [`LP ${partner.lp}`],
      text: `LP${partner.lp}`,
    });

    const incident = CARD_POOL.find((card) => card.num === "D08026")!;
    expect(incident.type).toBe("case");
    expect(statViewFor(incident.num)).toEqual({
      labels: ["\u5148\u653b 7\u679a", "\u5f8c\u653b 6\u679a"],
      text: "\u5148\u653b7\u679a\u5f8c\u653b6\u679a",
    });

    const zeroDifficultyIncident = CARD_POOL.find(
      (card) => card.num === "B09107P",
    )!;
    expect(zeroDifficultyIncident.type).toBe("case");
    expect(statViewFor(zeroDifficultyIncident.num, "B09107")).toEqual({
      labels: ["\u5148\u653b 0\u679a", "\u5f8c\u653b 0\u679a"],
      text: "\u5148\u653b0\u679a\u5f8c\u653b0\u679a",
    });

    const event = CARD_POOL.find((card) => card.num === "D08024")!;
    expect(event.type).toBe("event");
    expect(statViewFor(event.num)).toEqual({
      labels: [`C ${event.cost}`],
      text: `C${event.cost}`,
    });

    const character = CARD_POOL.find((card) => card.num === "D08003")!;
    expect(character.type).toBe("character");
    expect(statViewFor(character.num)).toEqual({
      labels: [
        `C ${character.cost}`,
        `AP ${character.ap!.toLocaleString()}`,
        `LP ${character.lp}`,
      ],
      text: `C${character.cost}AP${character.ap!.toLocaleString()}LP${character.lp}`,
    });
  });

  it("keeps official first- and second-player difficulty values for every incident card", () => {
    const cases = CARD_POOL.filter((card) => card.type === "case");
    expect(cases.length).toBeGreaterThan(0);
    for (const card of cases) {
      expect(Number.isInteger(card.difficultyFirst)).toBe(true);
      expect(Number.isInteger(card.difficultySecond)).toBe(true);
    }
  });

  it("mounts one initial card window, releases distant cards on scroll, and caps the active window", () => {
    act(() => root.render(<CardsScreen onNav={() => undefined} />));

    const scroller = container.querySelector<HTMLElement>(".cards-grid-scroll")!;
    const initialCards = Array.from(
      container.querySelectorAll<HTMLElement>(".cards-grid-item"),
    );
    const firstCard = initialCards[0]!;
    expect(initialCards).toHaveLength(48);

    act(() => {
      scroller.scrollTop = 20_000;
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    expect(container.querySelectorAll(".cards-grid-item").length).toBeLessThanOrEqual(96);
    expect(firstCard.isConnected).toBe(false);
  });

  it("resets the active window for filters and views while retaining the selected print", () => {
    act(() => root.render(<CardsScreen onNav={() => undefined} />));

    const print = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".cards-print-chip"),
    ).find((button) => button.textContent === "B09001P");
    expect(print).not.toBeNull();
    act(() => print?.click());

    const scroller = container.querySelector<HTMLElement>(".cards-grid-scroll")!;
    act(() => {
      scroller.scrollTop = 20_000;
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      useFiltersStore.getState().setCards({ q: "B09001" });
    });

    expect(container.querySelectorAll(".cards-grid-item")).toHaveLength(1);
    expect(
      container.querySelector('.cards-print-chip[aria-checked="true"]')?.textContent,
    ).toBe("B09001P");

    const listView = container.querySelector<HTMLButtonElement>(
      '.cards-view-selector button[data-last="true"]',
    );
    act(() => listView?.click());
    expect(container.querySelectorAll(".meta-row")).toHaveLength(1);
  });
});
