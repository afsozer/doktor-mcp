import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testler önbelleği eskisi gibi depodaki .cache/ altında kullanır; paketlenmiş
// sunucu ise kullanıcı dizinini (src/core/cacheRoot.ts) kullanır.
const testCacheDir = fileURLToPath(new URL("./.cache", import.meta.url));

export default defineConfig({
  test: {
    env: { DOKTOR_MCP_CACHE_DIR: testCacheDir },
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/benchmark/doctorQuestions.ts",
        "src/benchmark/realWorldPhysicianQuestions.ts",
        "src/**/__mocks__/**",
      ],
      reporter: ["text-summary", "html"],
      reportsDirectory: "coverage",
    },
  },
});
