import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testler önbelleği eskisi gibi depodaki .cache/ altında kullanır; paketlenmiş
// sunucu ise kullanıcı dizinini (src/core/cacheRoot.ts) kullanır.
const testCacheDir = fileURLToPath(new URL("./.cache", import.meta.url));

export default defineConfig({
  test: {
    // Testler ağa çıkmasın: paketin varsayılanı "live", testlerde "mock" sabit.
    env: { DOKTOR_MCP_CACHE_DIR: testCacheDir, DOKTOR_MCP_DEFAULT_SOURCE_MODE: "mock" },
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
