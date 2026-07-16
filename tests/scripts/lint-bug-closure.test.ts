import { describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createRegularRepoFilePredicate,
  lintBugClosure,
  parseFrontmatter,
  type ClosureDocument,
} from "../../scripts/lint-bug-closure.js";

const fixedTicket = (overrides: Record<string, string> = {}): string => {
  const values = {
    id: "BUG-900",
    title: "fixture",
    severity: "中",
    category: "engine",
    status: "修正済",
    date_found: "2026-07-16",
    date_fixed: "2026-07-16",
    commit: "abcdef1",
    reporter: "test",
    ...overrides,
  };
  return [
    "---",
    ...Object.entries(values).map(([key, value]) => `${key}: ${value}`),
    "---",
    "",
    "## RCA",
    "",
    "ownerを失ったpendingが残留していた。",
    "",
    "## 関連ファイル",
    "",
    "- `src/engine/example.ts`",
    "- `tests/engine/example.test.ts`",
  ].join("\n");
};

const changelog = (category: string, bugs: string[]): string =>
  [
    "---",
    "date: 2026-07-16",
    `category: ${category}`,
    `bugs: [${bugs.join(", ")}]`,
    "---",
    "",
    "## fixture",
  ].join("\n");

const docs = (
  ticketContent: string,
  changelogContent = changelog("fixes", ["BUG-900"]),
): ClosureDocument[] => [
  { path: ".claude/bugs/BUG-900.md", kind: "ticket", content: ticketContent },
  {
    path: ".claude/changelog-entries/fixture.md",
    kind: "changelog",
    content: changelogContent,
  },
];

describe("parseFrontmatter", () => {
  it("parses LF and CRLF without a YAML dependency", () => {
    expect(parseFrontmatter("---\na: one\n---\n").a).toBe("one");
    expect(parseFrontmatter("---\r\na: two\r\n---\r\n").a).toBe("two");
  });
});

describe("lintBugClosure", () => {
  it.each([
    "TBD",
    "未コミット (本セッション)",
    "(本コミットで修正)",
    "pending",
    "abcdef1 (pending)",
    "abcdef1-TBD",
  ])("rejects placeholder commit %s on fixed tickets", (commit) => {
    const issues = lintBugClosure(docs(fixedTicket({ commit })), {
      scopedBugIds: new Set(["BUG-900"]),
    });
    expect(issues.some((issue) => issue.code === "fixed-commit")).toBe(true);
  });

  it("rejects a fixed ticket without a concrete date_fixed", () => {
    const issues = lintBugClosure(docs(fixedTicket({ date_fixed: "" })), {
      scopedBugIds: new Set(["BUG-900"]),
    });
    expect(issues.some((issue) => issue.code === "fixed-date")).toBe(true);
  });

  it.each(["調査中", "未調査", "TBD", "pending", "unknown", "N/A", "-", "."])(
    "rejects placeholder RCA %s on fixed tickets",
    (placeholder) => {
      const ticket = fixedTicket().replace(
        "ownerを失ったpendingが残留していた。",
        placeholder,
      );
      const issues = lintBugClosure(docs(ticket), {
        scopedBugIds: new Set(["BUG-900"]),
      });
      expect(issues.some((issue) => issue.code === "fixed-rca")).toBe(true);
    },
  );

  it("rejects missing implementation and test evidence on fixed tickets", () => {
    const ticket = fixedTicket()
      .replace("- `src/engine/example.ts`\n", "")
      .replace("- `tests/engine/example.test.ts`", "");
    const issues = lintBugClosure(docs(ticket), {
      scopedBugIds: new Set(["BUG-900"]),
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["fixed-implementation", "fixed-test"]),
    );
  });

  it("rejects fixes changelog references to in-progress tickets", () => {
    const issues = lintBugClosure(docs(fixedTicket({ status: "対応中" })), {
      scopedBugIds: new Set(["BUG-900"]),
    });
    expect(
      issues.some((issue) => issue.code === "fixes-ticket-not-fixed"),
    ).toBe(true);
  });

  it("reads a multiline bugs list from changelog frontmatter", () => {
    const multiline = [
      "---",
      "date: 2026-07-16",
      "category: fixes",
      "bugs:",
      "  - BUG-900",
      "---",
      "",
      "## fixture",
    ].join("\n");
    const issues = lintBugClosure(
      docs(fixedTicket({ status: "対応中" }), multiline),
      { scopedBugIds: new Set(["BUG-900"]) },
    );
    expect(
      issues.some((issue) => issue.code === "fixes-ticket-not-fixed"),
    ).toBe(true);
  });

  it("rejects fixes changelog references to spec-out tickets", () => {
    const issues = lintBugClosure(docs(fixedTicket({ status: "仕様外" })), {
      scopedBugIds: new Set(["BUG-900"]),
    });
    expect(issues.some((issue) => issue.code === "fixes-ticket-spec-out")).toBe(
      true,
    );
  });

  it("does not force closure metadata onto open tickets outside fixes entries", () => {
    const ticket = fixedTicket({ status: "対応中", date_fixed: "", commit: "" })
      .replace("ownerを失ったpendingが残留していた。", "調査中")
      .replace("- `src/engine/example.ts`\n", "")
      .replace("- `tests/engine/example.test.ts`", "");
    expect(
      lintBugClosure(docs(ticket, changelog("investigation", ["BUG-900"])), {
        scopedBugIds: new Set(["BUG-900"]),
      }),
    ).toEqual([]);
  });

  it("accepts concrete fixed evidence and ignores unrelated legacy tickets", () => {
    const documents = docs(fixedTicket());
    documents.push({
      path: ".claude/bugs/BUG-001.md",
      kind: "ticket",
      content: fixedTicket({ id: "BUG-001", commit: "TBD" }),
    });
    expect(
      lintBugClosure(documents, { scopedBugIds: new Set(["BUG-900"]) }),
    ).toEqual([]);
  });

  it("does not accept lexical traversal as implementation evidence", () => {
    const ticket = fixedTicket().replace(
      "src/engine/example.ts",
      "src/../../scripts/lint-bug-closure.ts",
    );
    const issues = lintBugClosure(docs(ticket), {
      scopedBugIds: new Set(["BUG-900"]),
      pathIsRegularRepoFile: () => true,
    });
    expect(issues.some((issue) => issue.code === "fixed-implementation")).toBe(
      true,
    );
  });

  it("rejects extension-prefix matches and paths outside the evidence section", () => {
    const backupPaths = fixedTicket()
      .replace("src/engine/example.ts", "src/engine/example.ts.bak")
      .replace(
        "tests/engine/example.test.ts",
        "tests/engine/example.test.ts.bak",
      );
    const proseOnly = fixedTicket()
      .replace(
        "- `src/engine/example.ts`",
        "- 修正対象ではない `src/engine/example.ts`",
      )
      .replace(
        "- `tests/engine/example.test.ts`",
        "- 回帰証拠ではない `tests/engine/example.test.ts`",
      );
    const absoluteTraversal = fixedTicket()
      .replace("src/engine/example.ts", "/../../src/engine/example.ts")
      .replace(
        "tests/engine/example.test.ts",
        "/../../tests/engine/example.test.ts",
      );
    for (const ticket of [backupPaths, proseOnly, absoluteTraversal]) {
      const issues = lintBugClosure(docs(ticket), {
        scopedBugIds: new Set(["BUG-900"]),
        pathIsRegularRepoFile: () => true,
      });
      expect(issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(["fixed-implementation", "fixed-test"]),
      );
    }
  });

  it("rejects a junction whose realpath escapes the repository", () => {
    const base = mkdtempSync(join(tmpdir(), "bug-closure-"));
    const root = join(base, "repo");
    const outside = join(base, "outside");
    mkdirSync(root);
    mkdirSync(outside);
    writeFileSync(join(outside, "escape.ts"), "export {};\n");
    symlinkSync(outside, join(root, "src"), "junction");
    try {
      const isRegularRepoFile = createRegularRepoFilePredicate(root);
      expect(isRegularRepoFile("src/escape.ts")).toBe(false);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("validates unscoped and missing BUG IDs in a mixed current-wave fixes entry", () => {
    const documents = docs(
      fixedTicket(),
      changelog("fixes", ["BUG-900", "BUG-901", "BUG-999", "BUG-90O"]),
    );
    documents.push({
      path: ".claude/bugs/BUG-901.md",
      kind: "ticket",
      content: fixedTicket({ id: "BUG-901", status: "対応中" }),
    });
    const issues = lintBugClosure(documents, {
      scopedBugIds: new Set(["BUG-900"]),
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "fixes-ticket-not-fixed" }),
        expect.objectContaining({ code: "fixes-ticket-missing" }),
        expect.objectContaining({ code: "changelog-bug-id-invalid" }),
      ]),
    );
  });

  it.each(["'fixes' # current wave", '"fixes" # current wave'])(
    "normalizes quoted/commented category %s",
    (category) => {
      const issues = lintBugClosure(
        docs(
          fixedTicket({ status: "対応中" }),
          changelog(category, ["BUG-900"]),
        ),
        { scopedBugIds: new Set(["BUG-900"]) },
      );
      expect(
        issues.some((issue) => issue.code === "fixes-ticket-not-fixed"),
      ).toBe(true);
    },
  );

  it("validates missing references in the hardening investigation entry", () => {
    const documents = docs(
      fixedTicket(),
      changelog("investigation", ["BUG-900", "BUG-999"]),
    );
    documents[1].path =
      ".claude/changelog-entries/2026-07-16-01-you-vs-cpu-hardening.md";
    const issues = lintBugClosure(documents, {
      scopedBugIds: new Set(["BUG-900"]),
    });
    expect(
      issues.some((issue) => issue.code === "changelog-ticket-missing"),
    ).toBe(true);
  });

  it("validates an unscoped-only fixes entry with an empty manifest scope", () => {
    const documents: ClosureDocument[] = [
      {
        path: ".claude/bugs/BUG-901.md",
        kind: "ticket",
        content: fixedTicket({ id: "BUG-901", status: "対応中" }),
      },
      {
        path: ".claude/changelog-entries/unscoped-fix.md",
        kind: "changelog",
        content: changelog("fixes", ["BUG-901", "BUG-999"]),
      },
    ];
    const issues = lintBugClosure(documents, { scopedBugIds: new Set() });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "fixes-ticket-not-fixed" }),
        expect.objectContaining({ code: "fixes-ticket-missing" }),
      ]),
    );
  });

  it("rejects suffix prose after implementation and test evidence tokens", () => {
    const ticket = fixedTicket()
      .replace(
        "- `src/engine/example.ts`",
        "- `src/engine/example.ts` - not implemented",
      )
      .replace(
        "- `tests/engine/example.test.ts`",
        "- `tests/engine/example.test.ts`: not executed",
      );
    const issues = lintBugClosure(docs(ticket), {
      scopedBugIds: new Set(["BUG-900"]),
      pathIsRegularRepoFile: () => true,
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["fixed-implementation", "fixed-test"]),
    );
  });

  it("rejects a scoped BUG without its ticket document", () => {
    const issues = lintBugClosure([], {
      scopedBugIds: new Set(["BUG-900"]),
    });
    expect(issues).toEqual([
      expect.objectContaining({
        path: ".claude/bugs/BUG-900.md",
        code: "scoped-ticket-missing",
      }),
    ]);
  });
});
