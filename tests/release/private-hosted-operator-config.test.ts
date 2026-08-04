import { execFile } from "node:child_process";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  createOperatorConfig,
  defaultOperatorConfigPath,
  hasBroadWindowsWriteAcl,
  loadOperatorConfig,
  MAX_APPROVED_EMAILS,
  validateOperatorConfig,
  writeNewOperatorConfig,
} from "../../scripts/private-hosted/operator-config.js";

const valid = {
  schemaVersion: 1 as const,
  accountId: "0123456789abcdef0123456789abcdef",
  projectName: "conan-private-a1b2c3d4",
  teamName: "conan-family",
  operatorEmail: "owner@example.com",
  approvedEmails: ["friend@example.com", "owner@example.com"],
};

const execFileAsync = promisify(execFile);

async function makePrivateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") return;
  const powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
  const script = [
    "$ErrorActionPreference='Stop'",
    "$target=$env:CONAN_PRIVATE_HOSTED_ACL_TARGET",
    "$acl=Get-Acl -LiteralPath $target",
    "$owner=([System.Security.Principal.NTAccount]$acl.Owner).Translate([System.Security.Principal.SecurityIdentifier])",
    "$acl.SetAccessRuleProtection($true,$false)",
    "foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($rule) }",
    "$inherit=[System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit",
    "foreach ($value in @($owner.Value,'S-1-5-18','S-1-5-32-544')) {",
    "  $sid=[System.Security.Principal.SecurityIdentifier]$value",
    "  $rule=[System.Security.AccessControl.FileSystemAccessRule]::new($sid,[System.Security.AccessControl.FileSystemRights]::FullControl,$inherit,[System.Security.AccessControl.PropagationFlags]::None,[System.Security.AccessControl.AccessControlType]::Allow)",
    "  [void]$acl.AddAccessRule($rule)",
    "}",
    "Set-Acl -LiteralPath $target -AclObject $acl",
  ].join("\n");
  await execFileAsync(
    powershell,
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      env: {
        SystemRoot: process.env.SystemRoot,
        SYSTEMROOT: process.env.SYSTEMROOT,
        WINDIR: process.env.WINDIR,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        CONAN_PRIVATE_HOSTED_ACL_TARGET: path,
      },
      windowsHide: true,
    },
  );
}

describe("private hosted operator config", () => {
  it("accepts only the exact canonical schema", () => {
    expect(validateOperatorConfig(valid)).toEqual(valid);
    for (const candidate of [
      { ...valid, schemaVersion: 2 },
      { ...valid, accountId: "A".repeat(32) },
      { ...valid, projectName: "Upper_Project" },
      { ...valid, teamName: "-leading" },
      { ...valid, operatorEmail: "Owner@example.com" },
      { ...valid, approvedEmails: ["owner@example.com", "owner@example.com"] },
      { ...valid, approvedEmails: ["friend@example.com"] },
      { ...valid, apiToken: "must-not-be-stored" },
    ]) {
      expect(() => validateOperatorConfig(candidate)).toThrow();
    }
  });

  it("creates the random project name and canonicalizes interactive text", () => {
    expect(
      createOperatorConfig(
        {
          accountId: `  ${valid.accountId.toUpperCase()}  `,
          teamName: "  CONAN-FAMILY ",
          operatorEmail: " Owner@Example.COM ",
          approvedEmails: [" Friend@Example.com ", "owner@example.com"],
        },
        () => "deadbeef",
      ),
    ).toEqual({
      ...valid,
      projectName: "conan-private-deadbeef",
    });
    expect(() => createOperatorConfig(valid, () => "not-hex!")).toThrow(/random/);
  });

  it("enforces the fixed small-circle audience limit including the operator", () => {
    const atLimit = Array.from(
      { length: MAX_APPROVED_EMAILS },
      (_, index) => index === 0 ? valid.operatorEmail : `friend${index}@example.com`,
    );
    expect(validateOperatorConfig({ ...valid, approvedEmails: atLimit }).approvedEmails)
      .toHaveLength(MAX_APPROVED_EMAILS);
    expect(() =>
      validateOperatorConfig({
        ...valid,
        approvedEmails: [...atLimit, "overflow@example.com"],
      })
    ).toThrow(/at most 12/);
  });

  it("uses the LocalAppData default outside the repository", () => {
    expect(
      defaultOperatorConfigPath({ LOCALAPPDATA: "C:\\Users\\owner\\AppData\\Local" }),
    ).toBe("C:\\Users\\owner\\AppData\\Local\\ConanPrivateHosted\\operator.json");
    expect(() => defaultOperatorConfigPath({})).toThrow(/LOCALAPPDATA/);
  });

  it("recognizes broad Windows write grants by SID and rights", () => {
    const ownerSid = "S-1-5-21-1000-1001-1002-1003";
    expect(
      hasBroadWindowsWriteAcl([
        { sid: "S-1-1-0", type: "Allow", rights: 2 },
      ], ownerSid),
    ).toBe(true);
    expect(
      hasBroadWindowsWriteAcl([
        { sid: "S-1-5-32-545", type: "Allow", rights: 197055 },
      ], ownerSid),
    ).toBe(true);
    expect(
      hasBroadWindowsWriteAcl([
        { sid: "S-1-5-21-private", type: "Allow", rights: 2032127 },
        { sid: "S-1-1-0", type: "Allow", rights: 1 },
      ], ownerSid),
    ).toBe(true);
    expect(
      hasBroadWindowsWriteAcl([
        { sid: ownerSid, type: "Allow", rights: 2032127 },
        { sid: "S-1-5-18", type: "Allow", rights: 2032127 },
        { sid: "S-1-5-32-544", type: "Allow", rights: 2032127 },
        { sid: "S-1-1-0", type: "Allow", rights: 1 },
      ], ownerSid, ownerSid),
    ).toBe(false);
    const operatorSid = "S-1-5-21-2000-2001-2002-2003";
    expect(
      hasBroadWindowsWriteAcl([
        { sid: operatorSid, type: "Allow", rights: 2032127 },
      ], "S-1-5-18", operatorSid),
    ).toBe(false);
    expect(
      hasBroadWindowsWriteAcl([
        { sid: ownerSid, type: "Allow", rights: 2032127 },
      ], ownerSid, operatorSid),
    ).toBe(true);
    expect(
      hasBroadWindowsWriteAcl([
        { sid: ownerSid, type: "Allow", rights: 2 },
      ], "UNRESOLVED:owner"),
    ).toBe(true);
  });

  it("writes once outside the repo and rejects existing, repo-local, or broad-write targets", async () => {
    const parent = await mkdtemp(join(tmpdir(), "conan-operator-config-test-"));
    const repoRoot = resolve(parent, "repo");
    const externalRoot = resolve(parent, "private");
    await mkdir(repoRoot);
    const output = resolve(externalRoot, "operator.json");
    await expect(
      writeNewOperatorConfig(output, valid, {
        repoRoot,
        hasBroadWriteAccess: async () => false,
      }),
    ).resolves.toBe(output);
    expect(JSON.parse(await readFile(output, "utf8"))).toEqual(valid);
    await expect(
      writeNewOperatorConfig(output, valid, {
        repoRoot,
        hasBroadWriteAccess: async () => false,
      }),
    ).rejects.toThrow(/already exists/);
    await expect(
      writeNewOperatorConfig(resolve(repoRoot, "operator.json"), valid, {
        repoRoot,
        hasBroadWriteAccess: async () => false,
      }),
    ).rejects.toThrow(/repository/);
    const broad = resolve(parent, "broad/operator.json");
    await expect(
      writeNewOperatorConfig(broad, valid, {
        repoRoot,
        hasBroadWriteAccess: async () => true,
      }),
    ).rejects.toThrow(/broad write/);
    await expect(readFile(broad, "utf8")).rejects.toThrow();
  });

  it("never overwrites a target created between checks", async () => {
    const parent = await mkdtemp(join(tmpdir(), "conan-operator-race-test-"));
    const repoRoot = resolve(parent, "repo");
    const output = resolve(parent, "outside/operator.json");
    await mkdir(repoRoot);
    await mkdir(resolve(parent, "outside"));
    await writeFile(output, "attacker-owned\n");
    await expect(
      writeNewOperatorConfig(output, valid, {
        repoRoot,
        hasBroadWriteAccess: async () => false,
      }),
    ).rejects.toThrow(/already exists/);
    expect(await readFile(output, "utf8")).toBe("attacker-owned\n");
  });

  it("rejects a parent directory replaced during creation without writing config bytes", async () => {
    const parent = await mkdtemp(join(tmpdir(), "conan-operator-parent-race-test-"));
    const repoRoot = resolve(parent, "repo");
    const externalRoot = resolve(parent, "private");
    const movedRoot = resolve(parent, "private-checked");
    const output = resolve(externalRoot, "operator.json");
    await mkdir(repoRoot);
    await mkdir(externalRoot);
    let replaced = false;

    await expect(
      writeNewOperatorConfig(output, valid, {
        repoRoot,
        hasBroadWriteAccess: async (path) => {
          if (path === externalRoot && !replaced) {
            replaced = true;
            await rename(externalRoot, movedRoot);
            await mkdir(externalRoot);
          }
          return false;
        },
      }),
    ).rejects.toThrow(/parent changed during creation/);
    await expect(readFile(output, "utf8")).rejects.toThrow();
    await expect(readFile(resolve(movedRoot, "operator.json"), "utf8")).rejects.toThrow();
  });

  it("rejects a hard link created during the pre-write ACL check before exposing config bytes", async () => {
    const parent = await mkdtemp(join(tmpdir(), "conan-operator-prewrite-link-test-"));
    const repoRoot = resolve(parent, "repo");
    const externalRoot = resolve(parent, "private");
    const retained = resolve(parent, "retained.json");
    const output = resolve(externalRoot, "operator.json");
    await mkdir(repoRoot);
    await mkdir(externalRoot);
    let targetInspections = 0;
    let observedAfterWrite: string | undefined;
    let blankMtimeNs: bigint | undefined;

    await expect(
      writeNewOperatorConfig(output, valid, {
        repoRoot,
        hasBroadWriteAccess: async (path) => {
          if (path === output) {
            targetInspections += 1;
            if (targetInspections === 1) {
              await link(output, retained);
              blankMtimeNs = (await stat(retained, { bigint: true })).mtimeNs;
            }
            else observedAfterWrite = await readFile(retained, "utf8");
          }
          return false;
        },
      }),
    ).rejects.toThrow(/changed|hard links/);
    expect(targetInspections).toBe(1);
    expect(observedAfterWrite).toBeUndefined();
    expect(await readFile(retained, "utf8")).toBe("");
    expect((await stat(retained, { bigint: true })).mtimeNs).toBe(blankMtimeNs);
    await expect(readFile(output, "utf8")).rejects.toThrow();
  });

  it("erases config bytes through the handle after a post-write location attack", async () => {
    const parent = await mkdtemp(join(tmpdir(), "conan-operator-postwrite-race-test-"));
    const repoRoot = resolve(parent, "repo");
    const externalRoot = resolve(parent, "private");
    const movedRoot = resolve(parent, "private-written");
    const retained = resolve(parent, "retained.json");
    const output = resolve(externalRoot, "operator.json");
    await mkdir(repoRoot);
    await mkdir(externalRoot);
    let targetInspections = 0;
    let parentMoved = false;

    await expect(
      writeNewOperatorConfig(output, valid, {
        repoRoot,
        hasBroadWriteAccess: async (path) => {
          if (path === output) {
            targetInspections += 1;
            if (targetInspections === 2) {
              try {
                await rename(externalRoot, movedRoot);
                await mkdir(externalRoot);
                parentMoved = true;
              } catch (error) {
                if (
                  !["EPERM", "EBUSY", "EACCES"].includes(
                    (error as NodeJS.ErrnoException).code ?? "",
                  )
                ) {
                  throw error;
                }
                await link(output, retained);
              }
            }
          }
          return false;
        },
      }),
    ).rejects.toThrow(/changed during creation|hard links/);
    expect(targetInspections).toBe(2);
    await expect(readFile(output, "utf8")).rejects.toThrow();
    expect(
      await readFile(
        parentMoved ? resolve(movedRoot, "operator.json") : retained,
        "utf8",
      ),
    ).toBe("");
  });

  it("loads through a checked file handle and inspects both parent and file ACLs", async () => {
    const parent = await mkdtemp(join(tmpdir(), "conan-operator-load-test-"));
    const repoRoot = resolve(parent, "repo");
    const externalRoot = resolve(parent, "private");
    const output = resolve(externalRoot, "operator.json");
    await mkdir(repoRoot);
    await mkdir(externalRoot);
    await writeFile(output, `${JSON.stringify(valid)}\n`);
    const inspected: string[] = [];

    await expect(
      loadOperatorConfig(output, {
        repoRoot,
        hasBroadWriteAccess: async (path) => {
          inspected.push(path);
          return false;
        },
      }),
    ).resolves.toEqual(valid);
    expect(inspected).toEqual(
      expect.arrayContaining([externalRoot, output]),
    );
  });

  it("rejects broad-write parents and a file swapped after ACL inspection", async () => {
    const parent = await mkdtemp(join(tmpdir(), "conan-operator-load-race-test-"));
    const repoRoot = resolve(parent, "repo");
    const externalRoot = resolve(parent, "private");
    const output = resolve(externalRoot, "operator.json");
    await mkdir(repoRoot);
    await mkdir(externalRoot);
    await writeFile(output, `${JSON.stringify(valid)}\n`);

    await expect(
      loadOperatorConfig(output, {
        repoRoot,
        hasBroadWriteAccess: async (path) => path === externalRoot,
      }),
    ).rejects.toThrow(/parent grants broad write/);

    let replaced = false;
    await expect(
      loadOperatorConfig(output, {
        repoRoot,
        hasBroadWriteAccess: async (path) => {
          if (path === output && !replaced) {
            replaced = true;
            await rename(output, resolve(externalRoot, "checked.json"));
            await writeFile(output, `${JSON.stringify(valid)}\n`);
          }
          return false;
        },
      }),
    ).rejects.toThrow(/changed during inspection/);
  });

  it("rejects a linked ancestor during creation and loading", async () => {
    const parent = await mkdtemp(join(tmpdir(), "conan-operator-ancestor-link-test-"));
    const repoRoot = resolve(parent, "repo");
    const actualRoot = resolve(parent, "actual");
    const linkedRoot = resolve(parent, "linked");
    const actualOutput = resolve(actualRoot, "leaf/operator.json");
    const linkedOutput = resolve(linkedRoot, "leaf/operator.json");
    await mkdir(repoRoot);
    await mkdir(actualRoot);
    await symlink(actualRoot, linkedRoot, process.platform === "win32" ? "junction" : "dir");

    await expect(
      writeNewOperatorConfig(linkedOutput, valid, {
        repoRoot,
        hasBroadWriteAccess: async () => false,
      }),
    ).rejects.toThrow(/ancestor must be a regular directory/);
    await expect(stat(resolve(actualRoot, "leaf"))).rejects.toThrow();

    await mkdir(resolve(actualRoot, "leaf"));
    await writeFile(actualOutput, `${JSON.stringify(valid)}\n`);
    await expect(
      loadOperatorConfig(linkedOutput, {
        repoRoot,
        hasBroadWriteAccess: async () => false,
      }),
    ).rejects.toThrow(/ancestor must be a regular directory/);
  });

  it("rejects broad-write access on any ancestor component", async () => {
    const parent = await mkdtemp(join(tmpdir(), "conan-operator-ancestor-acl-test-"));
    const repoRoot = resolve(parent, "repo");
    const guarded = resolve(parent, "guarded");
    const privateRoot = resolve(guarded, "private");
    const output = resolve(privateRoot, "operator.json");
    await mkdir(repoRoot);
    await mkdir(privateRoot, { recursive: true });

    const controls = {
      repoRoot,
      hasBroadWriteAccess: async (path: string) => path === guarded,
    };
    await expect(writeNewOperatorConfig(output, valid, controls)).rejects.toThrow(
      /ancestor grants broad write access/,
    );

    await writeFile(output, `${JSON.stringify(valid)}\n`);
    await expect(loadOperatorConfig(output, controls)).rejects.toThrow(
      /ancestor grants broad write access/,
    );
  });

  it("rejects hard-linked config files", async () => {
    const parent = await mkdtemp(join(tmpdir(), "conan-operator-hardlink-test-"));
    const repoRoot = resolve(parent, "repo");
    const externalRoot = resolve(parent, "private");
    const original = resolve(externalRoot, "original.json");
    const output = resolve(externalRoot, "operator.json");
    await mkdir(repoRoot);
    await mkdir(externalRoot);
    await writeFile(original, `${JSON.stringify(valid)}\n`);
    await link(original, output);

    await expect(
      loadOperatorConfig(output, {
        repoRoot,
        hasBroadWriteAccess: async () => false,
      }),
    ).rejects.toThrow(/hard links/);
  });

  it("passes the real platform permission inspection for a private new file", async () => {
    const secureBase = process.platform === "win32"
      ? process.env.LOCALAPPDATA ?? homedir()
      : homedir();
    const parent = await mkdtemp(join(secureBase, "conan-operator-acl-test-"));
    const repoRoot = resolve(parent, "repo");
    const privateRoot = resolve(parent, "private");
    const output = resolve(privateRoot, "operator.json");
    await mkdir(repoRoot);
    await makePrivateDirectory(privateRoot);
    try {
      await expect(writeNewOperatorConfig(output, valid, { repoRoot })).resolves.toBe(
        output,
      );
      expect(JSON.parse(await readFile(output, "utf8"))).toEqual(valid);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  }, 60_000);
});
