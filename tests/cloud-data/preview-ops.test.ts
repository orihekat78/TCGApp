import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureCloudDataSecrets,
  renderPreviewEnrollmentSql,
  type OperatorConfig,
} from "../../scripts/cloud-data/prepare-preview-ops";

const tempRoots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "conan-cloud-data-preview-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("preview cloud-data operations", () => {
  it("exposes one reproducible preview preparation command", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["cloud-data:prepare-preview"]).toBe(
      "tsx scripts/cloud-data/prepare-preview-ops.ts",
    );
  });

  it("creates distinct secrets once and never rotates an existing file", async () => {
    const path = join(temporaryRoot(), "cloud-data-secrets.json");
    let seed = 1;
    const random = (size: number) => Buffer.alloc(size, seed++);

    const first = await ensureCloudDataSecrets(path, random);
    const bytesAfterFirstWrite = readFileSync(path, "utf8");
    const second = await ensureCloudDataSecrets(path, () => {
      throw new Error("must not rotate");
    });

    expect(first).toEqual(second);
    expect(readFileSync(path, "utf8")).toBe(bytesAfterFirstWrite);
    expect(first.previewEmailKeySecret).not.toBe(
      first.productionEmailKeySecret,
    );
    expect(first.previewEmailKeySecret.length).toBeGreaterThanOrEqual(32);
    expect(first.productionEmailKeySecret.length).toBeGreaterThanOrEqual(32);
  });

  it("renders only a pseudonymous enrollment key", async () => {
    const operator: OperatorConfig = {
      schemaVersion: 1,
      operatorEmail: "family.member@example.com",
      approvedEmails: ["family.member@example.com"],
    };
    const secrets = {
      schemaVersion: 1 as const,
      previewEmailKeySecret: "p".repeat(64),
      productionEmailKeySecret: "q".repeat(64),
    };

    const sql = await renderPreviewEnrollmentSql(operator, secrets, 1_786_400_000_000);

    expect(sql).toContain("INSERT INTO sync_enrollments");
    expect(sql).toMatch(/'v1_[A-Za-z0-9_-]+'/u);
    expect(sql).not.toContain("family.member@example.com");
    expect(sql).not.toContain("@");
    expect(sql).not.toContain(secrets.previewEmailKeySecret);
    expect(sql).not.toContain(secrets.productionEmailKeySecret);
  });

  it("rejects an operator outside the existing approved-email set", async () => {
    await expect(
      renderPreviewEnrollmentSql(
        {
          schemaVersion: 1,
          operatorEmail: "operator@example.com",
          approvedEmails: ["member@example.com"],
        },
        {
          schemaVersion: 1,
          previewEmailKeySecret: "p".repeat(64),
          productionEmailKeySecret: "q".repeat(64),
        },
        1,
      ),
    ).rejects.toThrow("OPERATOR_NOT_APPROVED");
  });
});
