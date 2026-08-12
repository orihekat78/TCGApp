import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { engine } from "@/engine";
import {
  BUG_274_PARTNER_CARD,
  BUG_274_PARTNER_ID,
} from "../../meta-app/src/data/bug274ValidationDeck";

const workspace = resolve(import.meta.dirname, "../..");
const forbiddenModules = [
  "meta-app/src/data/cardPool.ts",
  "meta-app/src/stubs/engineStub.ts",
  "src/cards/index.ts",
];

const forbiddenInitialGraphRoots = [
  "meta-app/src/data/cardPool.ts",
  "meta-app/src/services/historyReplayRepository.ts",
  "src/ai/",
  "src/cards/",
  "src/engine/",
  "src/ui/services/matchSession.ts",
  "src/ui/state/store.ts",
];

function identitySources<T>(cards: readonly T[]) {
  return [...cards, {
    id: BUG_274_PARTNER_ID,
    kind: BUG_274_PARTNER_CARD.type,
    names: [BUG_274_PARTNER_CARD.name],
    colors: BUG_274_PARTNER_CARD.colors,
  }];
}

async function runtimeImportGraph(entry: string, seen = new Set<string>()) {
  const absolute = resolve(workspace, entry);
  if (seen.has(absolute)) return seen;
  seen.add(absolute);

  const source = await readFile(absolute, "utf8");
  const imports = source.matchAll(
    /^(?!\s*import\s+type\b)\s*(?:import|export)\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/gm,
  );

  for (const match of imports) {
    const specifier = match[1]!;
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
    const base = specifier.startsWith("@/")
      ? resolve(workspace, "src", specifier.slice(2))
      : resolve(absolute, "..", specifier);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];
    let dependency: string | undefined;
    for (const candidate of candidates) {
      try {
        if ((await stat(candidate)).isFile()) {
          dependency = candidate;
          break;
        }
      } catch {
        // Try the next extension.
      }
    }
    if (dependency) await runtimeImportGraph(resolve(workspace, dependency), seen);
  }

  return seen;
}

describe("generated meta card identities", () => {
  it("keeps HOME and decksStore outside the full card registry graph", async () => {
    const imported = await Promise.all([
      runtimeImportGraph("meta-app/src/screens/HomeScreen.tsx"),
      runtimeImportGraph("meta-app/src/state/decksStore.ts"),
    ]);
    const graph = new Set([...imported[0], ...imported[1]]);

    for (const forbidden of forbiddenModules) {
      expect([...graph].map((path) => path.replace(/\\/g, "/"))).not.toContain(
        resolve(workspace, forbidden).replace(/\\/g, "/"),
      );
    }
  });

  it("keeps the initial HOME application graph outside the game runtime", async () => {
    const imported = await runtimeImportGraph("meta-app/src/main.tsx");
    const normalized = [...imported].map((path) => path.replace(/\\/g, "/"));

    for (const forbidden of forbiddenInitialGraphRoots) {
      const absolute = resolve(workspace, forbidden).replace(/\\/g, "/");
      expect(
        normalized.some((path) => path === absolute || path.startsWith(`${absolute}/`)),
        `initial graph contains ${forbidden}`,
      ).toBe(false);
    }
  });

  it("covers every partner and case with the same display identity", async () => {
    const { ALL_CARDS } = await import("@/cards/index");
    const { CARD_IDENTITIES } = await import(
      "../../meta-app/src/data/cardIdentities.generated"
    );
    const identities = ALL_CARDS.filter(
      (card) => card.kind === "partner" || card.kind === "case",
    );

    expect(Object.keys(CARD_IDENTITIES)).toHaveLength(identities.length + 1);
    for (const card of identities) {
      expect(CARD_IDENTITIES[card.id]).toMatchObject({
        num: card.id,
        name: card.names[0] ?? card.id,
        kind: card.kind,
        imagePath: card.imageUrl ?? null,
      });
    }
    expect(CARD_IDENTITIES[BUG_274_PARTNER_ID]).toMatchObject({
      num: BUG_274_PARTNER_ID,
      name: BUG_274_PARTNER_CARD.name,
      kind: "partner",
      imagePath: null,
    });
  });

  it("renders the committed identity index deterministically across checkout line endings", async () => {
    const { ALL_CARDS } = await import("@/cards/index");
    const { renderMetaCardIdentities } = await import(
      "../../scripts/gen-meta-card-identities"
    );
    const committed = await readFile(
      resolve(workspace, "meta-app/src/data/cardIdentities.generated.ts"),
      "utf8",
    );

    const sources = identitySources(ALL_CARDS);
    const once = renderMetaCardIdentities(sources);
    expect(renderMetaCardIdentities(sources)).toBe(once);
    expect(committed.replace(/\r\n?/g, "\n")).toBe(once);
  });

  it("does not rewrite a checkout whose only difference is line endings", async () => {
    const { writeMetaCardIdentitiesIfChanged } = await import(
      "../../scripts/gen-meta-card-identities"
    );
    const directory = await mkdtemp(resolve(tmpdir(), "conan-card-identities-"));
    const target = resolve(directory, "identities.ts");

    try {
      await writeFile(target, "alpha\r\nbeta\r\n", "utf8");
      const before = (await stat(target, { bigint: true })).mtimeNs;

      expect(
        await writeMetaCardIdentitiesIfChanged(target, "alpha\nbeta\n"),
      ).toBe(false);
      expect(await readFile(target, "utf8")).toBe("alpha\r\nbeta\r\n");
      expect((await stat(target, { bigint: true })).mtimeNs).toBe(before);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("shows identity art before the card registry has been registered", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    engine.cards._resetRegistry();
    const { IdentityCardArt } = await import(
      "../../meta-app/src/components/IdentityCardArt"
    );
    const container = document.createElement("div");
    const root: Root = createRoot(container);
    document.body.append(container);

    act(() => {
      root.render(
        createElement(IdentityCardArt, {
          imagePath: "D08001.jpg",
          alt: "partner identity",
        }),
      );
    });
    const image = container.querySelector("img")!;
    expect(image.src).toBe(
      "https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/D08001.jpg",
    );

    act(() => {
      root.render(
        createElement(IdentityCardArt, {
          imagePath: "D11001.jpg",
          alt: "next partner identity",
        }),
      );
    });
    expect(image.src).toBe(
      "https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/D11001.jpg",
    );

    act(() => image.dispatchEvent(new Event("error")));
    expect(image.src).toMatch(/^data:image\/svg\+xml/);
    act(() => root.unmount());
    container.remove();
  });
});
