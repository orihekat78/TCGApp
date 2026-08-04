import { describe, expect, it } from "vitest";
import {
  evaluateReleaseBugs,
  parseBugFrontmatter,
  serializeBugGate,
} from "../../scripts/private-hosted/check-release-bugs.js";

function bug(
  id: string,
  severity: string,
  status: string,
  body = "private body must never be copied",
): { path: string; content: string } {
  return {
    path: `.claude/bugs/${id}.md`,
    content: [
      "---",
      `id: ${id}`,
      `title: ${id} title: detail`,
      `severity: ${severity}`,
      `status: ${status}`,
      "reporter: private@example.test",
      "---",
      "",
      body,
    ].join("\n"),
  };
}

describe("private hosted release bug gate", () => {
  it("blocks unresolved major/high and reports lower severities as minimal known limitations", () => {
    const result = evaluateReleaseBugs([
      bug("BUG-004", "高", "対応中"),
      bug("BUG-002", "中", "未着手"),
      bug("BUG-003", "重大", "見送り"),
      bug("BUG-001", "低", "修正済 (限定対応)"),
      bug("BUG-005", "高", "修正済"),
      bug("BUG-006", "重大", "仕様外"),
    ]);

    expect(result).toEqual({
      schemaVersion: 1,
      ok: false,
      blockers: [
        { id: "BUG-003", title: "BUG-003 title: detail", severity: "重大", status: "見送り" },
        { id: "BUG-004", title: "BUG-004 title: detail", severity: "高", status: "対応中" },
      ],
      knownLimitations: [
        { id: "BUG-001", title: "BUG-001 title: detail", severity: "低", status: "修正済 (限定対応)" },
        { id: "BUG-002", title: "BUG-002 title: detail", severity: "中", status: "未着手" },
      ],
    });
    const serialized = serializeBugGate(result);
    expect(serialized).not.toContain("private body");
    expect(serialized).not.toContain("private@example.test");
  });

  it("parses CRLF frontmatter and rejects malformed or mismatched authority", () => {
    const document = bug("BUG-010", "中", "対応中");
    expect(
      parseBugFrontmatter(document.path, document.content.replaceAll("\n", "\r\n")),
    ).toMatchObject({ id: "BUG-010", severity: "中", status: "対応中" });
    expect(() => parseBugFrontmatter(document.path, "no frontmatter")).toThrow(
      /frontmatter/,
    );
    expect(() =>
      parseBugFrontmatter(document.path, document.content.replace("BUG-010\n", "BUG-011\n")),
    ).toThrow(/does not match/);
    expect(() => evaluateReleaseBugs([bug("BUG-012", "unknown", "対応中")])).toThrow(
      /severity/,
    );
  });

  it("rejects duplicate IDs instead of silently replacing a gate record", () => {
    expect(() =>
      evaluateReleaseBugs([
        bug("BUG-020", "中", "対応中"),
        { ...bug("BUG-020", "高", "対応中"), path: ".claude/bugs/copy.md" },
      ]),
    ).toThrow(/duplicate/);
  });
});
