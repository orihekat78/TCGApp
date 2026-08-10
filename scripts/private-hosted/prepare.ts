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
  "1d85f5df61818642ff66d8fd540e542fa9d0be17324c682fa02fc574c624e705";

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
