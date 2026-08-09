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
  "f9341320fe8bac84708e7633ef37691c6f4557e8b037c233a6a6f91d677d3ea2";

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
