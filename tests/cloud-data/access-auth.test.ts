// @vitest-environment node

import { generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  authenticateAccessRequest,
  normalizeAccessTeamDomain,
} from "../../src/cloud-data/access-auth";
import type { DeploymentPolicy } from "../../src/cloud-data/request-context";

const teamDomain = "https://family-team.cloudflareaccess.com";
const policy: DeploymentPolicy = {
  environment: "preview",
  host: { kind: "suffix", value: ".conan-private.pages.dev" },
  audience: "preview-audience",
  databaseId: "preview-db",
};

let publicKey: CryptoKey;
let privateKey: CryptoKey;

beforeAll(async () => {
  ({ publicKey, privateKey } = await generateKeyPair("RS256"));
});

async function createToken(
  overrides: {
    issuer?: string;
    audience?: string;
    subject?: string;
    email?: string;
    type?: string;
    expiresIn?: string;
  } = {},
): Promise<string> {
  return new SignJWT({
    email: overrides.email ?? "Player.Name+deck@Example.COM",
    type: overrides.type ?? "app",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(overrides.issuer ?? teamDomain)
    .setAudience(overrides.audience ?? policy.audience)
    .setSubject(overrides.subject ?? "access-user-1")
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? "5m")
    .sign(privateKey);
}

function requestWithToken(token: string): Request {
  return new Request("https://preview.conan-private.pages.dev/api/v1/me", {
    headers: { "Cf-Access-Jwt-Assertion": token },
  });
}

describe("Cloudflare Access request authentication", () => {
  it("accepts a signed app token and derives identity only from its claims", async () => {
    const token = await createToken();

    await expect(
      authenticateAccessRequest(
        requestWithToken(token),
        { teamDomain, policy },
        publicKey,
      ),
    ).resolves.toEqual({
      accessSub: "access-user-1",
      email: "Player.Name+deck@example.com",
    });
  });

  it("requires the Access assertion header and never falls back to cookies", async () => {
    const token = await createToken();
    const cookieOnlyRequest = new Request(
      "https://preview.conan-private.pages.dev/api/v1/me",
      { headers: { Cookie: `CF_Authorization=${token}` } },
    );

    await expect(
      authenticateAccessRequest(
        cookieOnlyRequest,
        { teamDomain, policy },
        publicKey,
      ),
    ).rejects.toThrow("ACCESS_TOKEN_REQUIRED");
  });

  it.each([
    ["wrong issuer", { issuer: "https://other.cloudflareaccess.com" }],
    ["wrong audience", { audience: "production-audience" }],
    ["wrong token type", { type: "org" }],
    ["missing subject", { subject: "" }],
    ["expired token", { expiresIn: "-1s" }],
  ])("rejects %s without exposing claim details", async (_label, overrides) => {
    const token = await createToken(overrides);

    await expect(
      authenticateAccessRequest(
        requestWithToken(token),
        { teamDomain, policy },
        publicKey,
      ),
    ).rejects.toThrow("ACCESS_TOKEN_INVALID");
  });

  it("rejects a token whose signature does not match", async () => {
    const otherPair = await generateKeyPair("RS256");
    const token = await new SignJWT({ email: "player@example.com", type: "app" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(teamDomain)
      .setAudience(policy.audience)
      .setSubject("access-user-1")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(otherPair.privateKey);

    await expect(
      authenticateAccessRequest(
        requestWithToken(token),
        { teamDomain, policy },
        publicKey,
      ),
    ).rejects.toThrow("ACCESS_TOKEN_INVALID");
  });

  it("does not include the raw JWT in verification errors", async () => {
    const token = `${await createToken()}tampered`;

    try {
      await authenticateAccessRequest(
        requestWithToken(token),
        { teamDomain, policy },
        publicKey,
      );
      throw new Error("EXPECTED_AUTHENTICATION_FAILURE");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("ACCESS_TOKEN_INVALID");
      expect((error as Error).message).not.toContain(token);
    }
  });
});

describe("Cloudflare Access team domain", () => {
  it("normalizes the canonical HTTPS team domain", () => {
    expect(
      normalizeAccessTeamDomain("https://Family-Team.cloudflareaccess.com/"),
    ).toBe(teamDomain);
  });

  it.each([
    "http://family-team.cloudflareaccess.com",
    "https://family-team.cloudflareaccess.com.evil.example",
    "https://nested.family-team.cloudflareaccess.com",
    "https://family-team.cloudflareaccess.com/path",
    "https://user@family-team.cloudflareaccess.com",
    "https://family-team.cloudflareaccess.com?next=https://evil.example",
  ])("rejects a non-canonical team domain: %s", (value) => {
    expect(() => normalizeAccessTeamDomain(value)).toThrow(
      "ACCESS_TEAM_DOMAIN_INVALID",
    );
  });
});
