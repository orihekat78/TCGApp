import { defineConfig, mergeConfig } from "vite";

import baseConfig from "./vite.config";

export function resolveE2EBuildPort(
  value = process.env.PLAYWRIGHT_PORT,
): string {
  if (value === undefined) return "5173";
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error("PLAYWRIGHT_PORT must be a decimal integer from 1 to 65535");
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65_535) {
    throw new Error("PLAYWRIGHT_PORT must be a decimal integer from 1 to 65535");
  }
  return String(port);
}

export function createE2EViteConfig(
  port = resolveE2EBuildPort(),
) {
  return mergeConfig(
    baseConfig,
    defineConfig({
      define: {
        "import.meta.env.VITE_E2E_BRIDGE": JSON.stringify("true"),
      },
      build: {
        outDir: `.tmp/e2e-dist-${port}`,
        emptyOutDir: true,
      },
    }),
  );
}

export default createE2EViteConfig();
