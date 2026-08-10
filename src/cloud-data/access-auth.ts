import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import {
  validateVerifiedClaims,
  type DeploymentPolicy,
} from "./request-context";

export type AccessAuthConfig = {
  teamDomain: string;
  policy: DeploymentPolicy;
};

export type VerifiedAccessIdentity = {
  accessSub: string;
  email: string;
};

export type AccessVerificationKey =
  | CryptoKey
  | Uint8Array
  | JWTVerifyGetKey;

const remoteKeySets = new Map<string, JWTVerifyGetKey>();

export function normalizeAccessTeamDomain(teamDomain: string): string {
  let url: URL;
  try {
    url = new URL(teamDomain.trim());
  } catch {
    throw new Error("ACCESS_TEAM_DOMAIN_INVALID");
  }

  const hostname = url.hostname.toLowerCase();
  const teamHostnamePattern =
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/;
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    !teamHostnamePattern.test(hostname)
  ) {
    throw new Error("ACCESS_TEAM_DOMAIN_INVALID");
  }

  return `https://${hostname}`;
}

function getRemoteKeySet(issuer: string): JWTVerifyGetKey {
  const cached = remoteKeySets.get(issuer);
  if (cached) return cached;

  const remoteKeySet = createRemoteJWKSet(
    new URL(`${issuer}/cdn-cgi/access/certs`),
  );
  remoteKeySets.set(issuer, remoteKeySet);
  return remoteKeySet;
}

export async function authenticateAccessRequest(
  request: Request,
  config: AccessAuthConfig,
  verificationKey?: AccessVerificationKey,
): Promise<VerifiedAccessIdentity> {
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion")?.trim();
  if (!assertion) throw new Error("ACCESS_TOKEN_REQUIRED");

  const issuer = normalizeAccessTeamDomain(config.teamDomain);
  try {
    const { payload } = await jwtVerify(
      assertion,
      verificationKey ?? getRemoteKeySet(issuer),
      {
        issuer,
        audience: config.policy.audience,
        algorithms: ["RS256"],
      },
    );
    return validateVerifiedClaims(payload, config.policy);
  } catch {
    throw new Error("ACCESS_TOKEN_INVALID");
  }
}
