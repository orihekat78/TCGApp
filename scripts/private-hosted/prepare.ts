import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parsePrepareArgs, prepareReleaseCore } from "./prepare-internal.js";
import type {
  PrepareReleaseOptions,
  PreparedRelease,
} from "./prepare-internal.js";

const MODULE_REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const EXPECTED_VITE_CONFIG_SHA256 =
  "549d2efcfcff5117127865eb2450947700b5cf967e965a095515d7bf72f55406";

export type { PrepareReleaseOptions } from "./prepare-internal.js";
export {
  assertAcceptableBuildOutput,
  parsePrepareArgs,
} from "./prepare-internal.js";

export async function prepareRelease(
  options: PrepareReleaseOptions,
): Promise<PreparedRelease> {
  return prepareReleaseCore(options, {
    moduleRoot: MODULE_REPOSITORY_ROOT,
    expectedConfigSha256: EXPECTED_VITE_CONFIG_SHA256,
  });
}

export async function runPrepareCli(
  args: readonly string[],
): Promise<PreparedRelease> {
  const paths = parsePrepareArgs(args);
  return prepareRelease({ repoRoot: process.cwd(), ...paths });
}
