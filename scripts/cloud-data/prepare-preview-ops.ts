import { randomBytes as nodeRandomBytes } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveEmailKey } from "../../src/cloud-data/identity.js";
import { normalizeVerifiedEmail } from "../../src/cloud-data/request-context.js";

export type OperatorConfig = {
  schemaVersion: number;
  operatorEmail: string;
  approvedEmails: string[];
};

export type CloudDataSecrets = {
  schemaVersion: 1;
  previewEmailKeySecret: string;
  productionEmailKeySecret: string;
};

type RandomBytes = (size: number) => Uint8Array;

const SECRET_BYTES = 48;
const EMAIL_KEY = /^v1_[A-Za-z0-9_-]{43}$/u;

function parseJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`${label}_INVALID_JSON`, { cause: error });
  }
}

function validateSecret(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label}_INVALID`);
  const size = new TextEncoder().encode(value).byteLength;
  if (size < 32 || size > 1_024) throw new Error(`${label}_INVALID`);
  return value;
}

function validateSecrets(value: unknown): CloudDataSecrets {
  if (!value || typeof value !== "object") {
    throw new Error("CLOUD_DATA_SECRETS_INVALID");
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1) {
    throw new Error("CLOUD_DATA_SECRETS_VERSION_INVALID");
  }
  const previewEmailKeySecret = validateSecret(
    candidate.previewEmailKeySecret,
    "PREVIEW_EMAIL_KEY_SECRET",
  );
  const productionEmailKeySecret = validateSecret(
    candidate.productionEmailKeySecret,
    "PRODUCTION_EMAIL_KEY_SECRET",
  );
  if (previewEmailKeySecret === productionEmailKeySecret) {
    throw new Error("CLOUD_DATA_SECRETS_MUST_DIFFER");
  }
  return {
    schemaVersion: 1,
    previewEmailKeySecret,
    productionEmailKeySecret,
  };
}

function newSecret(randomBytes: RandomBytes): string {
  return Buffer.from(randomBytes(SECRET_BYTES)).toString("base64url");
}

async function readSecrets(path: string): Promise<CloudDataSecrets> {
  return validateSecrets(parseJson(await readFile(path, "utf8"), "SECRETS"));
}

export async function ensureCloudDataSecrets(
  path: string,
  randomBytes: RandomBytes = nodeRandomBytes,
): Promise<CloudDataSecrets> {
  try {
    return await readSecrets(path);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const secrets = validateSecrets({
    schemaVersion: 1,
    previewEmailKeySecret: newSecret(randomBytes),
    productionEmailKeySecret: newSecret(randomBytes),
  });
  await mkdir(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(secrets, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await chmod(temporary, 0o600);
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return readSecrets(path);
    }
    throw error;
  }
  return secrets;
}

function validateOperator(value: OperatorConfig): {
  operatorEmail: string;
  approvedEmails: string[];
} {
  if (value.schemaVersion !== 1 || !Array.isArray(value.approvedEmails)) {
    throw new Error("OPERATOR_CONFIG_INVALID");
  }
  if (value.approvedEmails.length < 1 || value.approvedEmails.length > 12) {
    throw new Error("APPROVED_EMAIL_COUNT_INVALID");
  }
  const operatorEmail = normalizeVerifiedEmail(value.operatorEmail);
  const approvedEmails = value.approvedEmails.map(normalizeVerifiedEmail);
  if (!approvedEmails.includes(operatorEmail)) {
    throw new Error("OPERATOR_NOT_APPROVED");
  }
  return { operatorEmail, approvedEmails };
}

export async function renderPreviewEnrollmentSql(
  operatorConfig: OperatorConfig,
  secrets: CloudDataSecrets,
  now: number = Date.now(),
): Promise<string> {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("TIME_INVALID");
  const operator = validateOperator(operatorConfig);
  const validSecrets = validateSecrets(secrets);
  const emailKey = await deriveEmailKey(
    operator.operatorEmail,
    validSecrets.previewEmailKeySecret,
  );
  if (!EMAIL_KEY.test(emailKey)) throw new Error("EMAIL_KEY_INVALID");
  return [
    "INSERT INTO sync_enrollments (email_key, enabled, created_at, updated_at)",
    `VALUES ('${emailKey}', 1, ${now}, ${now})`,
    "ON CONFLICT(email_key) DO UPDATE SET",
    "  enabled = 1,",
    "  updated_at = excluded.updated_at;",
    "",
  ].join("\n");
}

function assertOutsideRepository(repositoryRoot: string, path: string): void {
  const relation = relative(resolve(repositoryRoot), resolve(path));
  const inside =
    relation === "" ||
    (!isAbsolute(relation) && relation !== ".." && !relation.startsWith(`..${sep}`));
  if (inside) throw new Error("OPERATION_FILE_MUST_BE_OUTSIDE_REPOSITORY");
}

async function run(): Promise<void> {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) throw new Error("LOCALAPPDATA_REQUIRED");
  const operationsRoot = join(localAppData, "ConanPrivateHosted");
  const operatorPath = join(operationsRoot, "operator.json");
  const secretsPath = join(operationsRoot, "cloud-data-secrets.json");
  const enrollmentPath = join(operationsRoot, "preview-enrollment.sql");
  assertOutsideRepository(process.cwd(), secretsPath);
  assertOutsideRepository(process.cwd(), enrollmentPath);

  const operator = parseJson(
    await readFile(operatorPath, "utf8"),
    "OPERATOR_CONFIG",
  ) as OperatorConfig;
  const secrets = await ensureCloudDataSecrets(secretsPath);
  const sql = await renderPreviewEnrollmentSql(operator, secrets);
  await writeFile(enrollmentPath, sql, { encoding: "utf8", mode: 0o600 });
  await chmod(enrollmentPath, 0o600);
  console.log("Prepared preview secret and enrollment SQL outside the repository.");
}

const entry = process.argv[1] ? resolve(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "PREVIEW_OPS_FAILED");
    process.exitCode = 1;
  });
}
