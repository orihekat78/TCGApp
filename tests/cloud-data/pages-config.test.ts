import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAccessTeamDomain } from "../../src/cloud-data/access-auth";
import privateHostedViteConfig from "../../vite.config.private-hosted";
import metaViteConfig from "../../meta-app/vite.config.meta";

type D1Binding = {
  binding: string;
  database_name: string;
  database_id: string;
};

type EnvironmentConfig = {
  d1_databases?: D1Binding[];
  vars?: Record<string, string>;
};

type PagesConfig = EnvironmentConfig & {
  name: string;
  pages_build_output_dir: string;
  compatibility_date: string;
  env: {
    production: EnvironmentConfig;
    preview: EnvironmentConfig;
  };
};

const root = process.cwd();

function readConfig(): PagesConfig {
  return JSON.parse(
    readFileSync(resolve(root, "wrangler.json"), "utf8"),
  ) as PagesConfig;
}

function effectiveEnvironment(
  config: PagesConfig,
  environment: "production" | "preview",
): Required<EnvironmentConfig> {
  const override = config.env[environment];
  return {
    d1_databases: override.d1_databases ?? config.d1_databases ?? [],
    vars: override.vars ?? config.vars ?? {},
  };
}

function sentinelDatabaseId(environment: "production" | "preview"): string {
  const sql = readFileSync(
    resolve(root, `migrations/environments/${environment}.sql`),
    "utf8",
  );
  const match = sql.match(/VALUES\s*\(1,\s*'[^']+',\s*'([^']+)'/u);
  if (!match?.[1]) throw new Error(`${environment} sentinel is missing`);
  return match[1];
}

describe("Cloudflare Pages environment config", () => {
  it("keeps the downloaded project identity and private-hosted output boundary", () => {
    const config = readConfig();
    expect(config).toMatchObject({
      name: "conan-private-7302df07",
      pages_build_output_dir: "./dist",
      compatibility_date: "2026-08-10",
    });
  });

  it.each([
    {
      environment: "production" as const,
      databaseName: "conan-cloud-data-production",
      databaseId: "4ee3b0b4-560a-46b9-9e9f-17dd394fc291",
      hostKind: "exact",
      hostValue: "conan-private-7302df07.pages.dev",
    },
    {
      environment: "preview" as const,
      databaseName: "conan-cloud-data-preview",
      databaseId: "94745040-6b8d-4579-82e5-5a6a9e8a71cb",
      hostKind: "suffix",
      hostValue: ".conan-private-7302df07.pages.dev",
    },
  ])(
    "binds $environment to only its own database and host",
    ({ environment, databaseName, databaseId, hostKind, hostValue }) => {
      const effective = effectiveEnvironment(readConfig(), environment);
      expect(effective.d1_databases).toEqual([
        { binding: "DB", database_name: databaseName, database_id: databaseId },
      ]);
      expect(effective.vars).toMatchObject({
        ACCESS_TEAM_DOMAIN: "https://steep-mouse-bb22.cloudflareaccess.com",
        DEPLOYMENT_ENV: environment,
        APP_HOST_KIND: hostKind,
        APP_HOST_VALUE: hostValue,
        D1_DATABASE_ID: databaseId,
      });
      expect(effective.vars.ACCESS_AUD).toMatch(/^[a-f0-9]{64}$/u);
      expect(sentinelDatabaseId(environment)).toBe(databaseId);
    },
  );

  it("uses distinct Access audiences and never stores a secret or email", () => {
    const config = readConfig();
    const production = effectiveEnvironment(config, "production");
    const preview = effectiveEnvironment(config, "preview");
    expect(production.vars.ACCESS_AUD).not.toBe(preview.vars.ACCESS_AUD);
    expect(JSON.stringify(config)).not.toMatch(/EMAIL_KEY_SECRET|@/iu);
  });

  it.each(["production", "preview"] as const)(
    "keeps the effective %s Access team domain valid for runtime authentication",
    (environment) => {
      const effective = effectiveEnvironment(readConfig(), environment);
      expect(
        normalizeAccessTeamDomain(effective.vars.ACCESS_TEAM_DOMAIN),
      ).toBe("https://steep-mouse-bb22.cloudflareaccess.com");
    },
  );
});

describe("private-hosted cloud sync flag", () => {
  it("enables sync only in the qualified private-hosted artifact", () => {
    const privateDefine = privateHostedViteConfig.define ?? {};
    const localDefine = metaViteConfig.define ?? {};
    expect(
      privateDefine["import.meta.env.VITE_CLOUD_DATA_SYNC_ENABLED"],
    ).toBe(JSON.stringify("true"));
    expect(
      localDefine["import.meta.env.VITE_CLOUD_DATA_SYNC_ENABLED"],
    ).toBeUndefined();
    expect(
      privateDefine["import.meta.env.VITE_PRIVATE_HOSTED_RELEASE"],
    ).toBe(JSON.stringify("true"));
    expect(
      localDefine["import.meta.env.VITE_PRIVATE_HOSTED_RELEASE"],
    ).toBeUndefined();
  });
});
