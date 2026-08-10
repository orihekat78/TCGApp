import { describe, expect, it } from "vitest";
import {
  normalizeVerifiedEmail,
  selectDeploymentPolicy,
  validateDatabaseSentinel,
  validateVerifiedClaims,
  type DeploymentPolicy,
} from "../../src/cloud-data/request-context";

const policies: readonly DeploymentPolicy[] = [
  {
    environment: "production",
    host: { kind: "exact", value: "conan-private-7302df07.pages.dev" },
    audience: "root-aud",
    databaseId: "production-db",
  },
  {
    environment: "preview",
    host: { kind: "suffix", value: ".conan-private-7302df07.pages.dev" },
    audience: "wildcard-aud",
    databaseId: "preview-db",
  },
];

describe("cloud request environment ownership", () => {
  it("binds the production hostname only to the production audience and database", () => {
    expect(
      selectDeploymentPolicy("conan-private-7302df07.pages.dev", policies),
    ).toEqual(policies[0]);
  });

  it("binds a deployment hostname only to the preview audience and database", () => {
    expect(
      selectDeploymentPolicy(
        "945de0aa.conan-private-7302df07.pages.dev",
        policies,
      ),
    ).toEqual(policies[1]);
  });

  it("rejects an unrelated hostname", () => {
    expect(() => selectDeploymentPolicy("attacker.example", policies)).toThrow(
      "HOST_NOT_ALLOWED",
    );
  });

  it("rejects a suffix policy without an explicit dot boundary", () => {
    const unsafePolicy: DeploymentPolicy = {
      ...policies[1],
      host: { kind: "suffix", value: "conan-private-7302df07.pages.dev" },
    };
    expect(() =>
      selectDeploymentPolicy("evilconan-private-7302df07.pages.dev", [
        unsafePolicy,
      ]),
    ).toThrow("POLICY_SUFFIX_INVALID");
  });

  it("rejects a preview token replayed against production", () => {
    expect(() =>
      validateVerifiedClaims(
        {
          sub: "access-user-1",
          email: "Player@Example.COM",
          type: "app",
          aud: ["wildcard-aud"],
        },
        policies[0],
      ),
    ).toThrow("AUDIENCE_MISMATCH");
  });

  it("accepts only an app token with non-empty subject and email", () => {
    expect(
      validateVerifiedClaims(
        {
          sub: "access-user-1",
          email: "Player@Example.COM",
          type: "app",
          aud: ["root-aud"],
        },
        policies[0],
      ),
    ).toEqual({ accessSub: "access-user-1", email: "Player@example.com" });

    expect(() =>
      validateVerifiedClaims(
        {
          sub: "",
          email: "Player@example.com",
          type: "app",
          aud: ["root-aud"],
        },
        policies[0],
      ),
    ).toThrow("SUBJECT_REQUIRED");
    expect(() =>
      validateVerifiedClaims(
        { sub: "access-user-1", email: "", type: "app", aud: ["root-aud"] },
        policies[0],
      ),
    ).toThrow("EMAIL_REQUIRED");
    expect(() =>
      validateVerifiedClaims(
        {
          sub: "access-user-1",
          email: "Player@example.com",
          type: "org",
          aud: ["root-aud"],
        },
        policies[0],
      ),
    ).toThrow("TOKEN_TYPE_INVALID");
  });

  it("normalizes only whitespace and the domain portion of verified email", () => {
    expect(normalizeVerifiedEmail("  Player.Name+deck@Example.COM  ")).toBe(
      "Player.Name+deck@example.com",
    );
  });

  it("rejects a malformed verified email claim", () => {
    expect(() => normalizeVerifiedEmail("not-an-email")).toThrow(
      "EMAIL_INVALID",
    );
    expect(() => normalizeVerifiedEmail("@example.com")).toThrow(
      "EMAIL_INVALID",
    );
    expect(() => normalizeVerifiedEmail("player@")).toThrow("EMAIL_INVALID");
  });

  it("fails closed when runtime environment or database sentinel differs", () => {
    expect(() =>
      validateDatabaseSentinel(policies[0], {
        environment: "preview",
        databaseId: "production-db",
      }),
    ).toThrow("ENVIRONMENT_MISMATCH");

    expect(() =>
      validateDatabaseSentinel(policies[0], {
        environment: "production",
        databaseId: "preview-db",
      }),
    ).toThrow("DATABASE_MISMATCH");
  });
});
