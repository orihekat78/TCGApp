import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
    // BUG-077 flaky 解消: 既定 5s では bug-077 の Phase I/K 等が `await import('@/cards/index')`
    // (933 カード) を全 suite 実行時に行うと、本環境 (OneDrive 同期パス・遅ディスク) で import が
    // 5s を超過し timeout flaky になっていた。テストロジックは正しく時間を与えれば確定 pass のため、
    // 環境依存の import 遅延を吸収する余裕を持たせる (真の hang は 20s 超で依然検出可能)。
    testTimeout: 20000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      reportsDirectory: "./.claude/reports/coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/index.ts",
        "src/**/types/**",
        "src/cards/ct-d??/D?????.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
