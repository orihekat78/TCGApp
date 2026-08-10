export type DeploymentEnvironment = "production" | "preview";

export type DeploymentPolicy = {
  environment: DeploymentEnvironment;
  host: { kind: "exact" | "suffix"; value: string };
  audience: string;
  databaseId: string;
};

export type AccessClaims = {
  sub?: unknown;
  email?: unknown;
  type?: unknown;
  aud?: unknown;
};

export type DatabaseSentinel = {
  environment: DeploymentEnvironment;
  databaseId: string;
};

export function parseDatabaseSentinelRow(row: unknown): DatabaseSentinel {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    throw new Error("DATABASE_SENTINEL_MISSING");
  }
  const candidate = row as Record<string, unknown>;
  if (candidate.singleton !== 1) throw new Error("DATABASE_SENTINEL_INVALID");
  if (
    candidate.environment !== "production" &&
    candidate.environment !== "preview"
  ) {
    throw new Error("DATABASE_SENTINEL_INVALID");
  }
  if (
    typeof candidate.databaseId !== "string" ||
    candidate.databaseId.length === 0
  ) {
    throw new Error("DATABASE_SENTINEL_INVALID");
  }
  return {
    environment: candidate.environment,
    databaseId: candidate.databaseId,
  };
}

export function selectDeploymentPolicy(
  hostname: string,
  policies: readonly DeploymentPolicy[],
): DeploymentPolicy {
  const normalizedHost = hostname.trim().toLowerCase();
  if (
    policies.some(
      (policy) =>
        policy.host.kind === "suffix" && !policy.host.value.startsWith("."),
    )
  ) {
    throw new Error("POLICY_SUFFIX_INVALID");
  }
  const matches = policies.filter((policy) => {
    const policyHost = policy.host.value.toLowerCase();
    if (policy.host.kind === "exact") return normalizedHost === policyHost;
    return (
      normalizedHost.length > policyHost.length &&
      normalizedHost.endsWith(policyHost)
    );
  });
  if (matches.length !== 1) throw new Error("HOST_NOT_ALLOWED");
  return matches[0];
}

export function normalizeVerifiedEmail(email: string): string {
  const trimmed = email.trim();
  const separator = trimmed.lastIndexOf("@");
  if (separator <= 0 || separator === trimmed.length - 1)
    throw new Error("EMAIL_INVALID");
  const local = trimmed.slice(0, separator);
  const domain = trimmed.slice(separator + 1);
  if (local.includes("@") || /\s/.test(trimmed))
    throw new Error("EMAIL_INVALID");
  return `${local}@${domain.toLowerCase()}`;
}

export function validateVerifiedClaims(
  claims: AccessClaims,
  policy: DeploymentPolicy,
): { accessSub: string; email: string } {
  if (claims.type !== "app") throw new Error("TOKEN_TYPE_INVALID");
  if (typeof claims.sub !== "string" || claims.sub.trim() === "") {
    throw new Error("SUBJECT_REQUIRED");
  }
  if (typeof claims.email !== "string" || claims.email.trim() === "") {
    throw new Error("EMAIL_REQUIRED");
  }
  const audiences =
    typeof claims.aud === "string"
      ? [claims.aud]
      : Array.isArray(claims.aud)
        ? claims.aud.filter(
            (audience): audience is string => typeof audience === "string",
          )
        : [];
  if (!audiences.includes(policy.audience))
    throw new Error("AUDIENCE_MISMATCH");
  return {
    accessSub: claims.sub.trim(),
    email: normalizeVerifiedEmail(claims.email),
  };
}

export function validateDatabaseSentinel(
  policy: DeploymentPolicy,
  sentinel: DatabaseSentinel,
): void {
  if (sentinel.environment !== policy.environment)
    throw new Error("ENVIRONMENT_MISMATCH");
  if (sentinel.databaseId !== policy.databaseId)
    throw new Error("DATABASE_MISMATCH");
}
