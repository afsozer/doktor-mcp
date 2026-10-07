import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testler önbelleği eskisi gibi depodaki .cache/ altında kullanır; paketlenmiş
// sunucu ise kullanıcı dizinini (src/core/cacheRoot.ts) kullanır.
const testCacheDir = fileURLToPath(new URL("./.cache", import.meta.url));

// CI-specific config: skip tests that require live network access
export default defineConfig({
  test: {
    env: { DOKTOR_MCP_CACHE_DIR: testCacheDir },
    exclude: [
      "**/node_modules/**",
      "**/benchmark.test.ts",
      "**/liveYargitayAdapter.test.ts",
      "**/t20CandidateVerification.test.ts",
      "**/multiSourcePrecedents.test.ts",
      "**/liveDanistayAdapter.test.ts",
      "**/liveHealthPrimaryLegislation.test.ts",
      "**/legislationProvisionDedup.test.ts",
      "**/liveTimeBudgetLegislationPhase.test.ts",
      "**/extendedLiveVerification.test.ts",
      "**/snapshotMode.test.ts",
      "**/linkHealthChecker.test.ts",
      "**/precedentProbeCli.test.ts",
      "**/ingestFixtureCli.test.ts",
      "**/precedentFullTextCache.test.ts",
      "**/precedentCache.test.ts",
      "**/legislationCache.test.ts",
      "**/cacheWarmCli.test.ts",
      "**/liveAdapterFixture.test.ts",
      "**/liveLegislationAdapter.test.ts",
      "**/cloudflareFallback.test.ts",
      "**/articleCrossReferences.test.ts",
      "**/articleStatusDetection.test.ts",
      "**/articleParserSanitization.test.ts",
      "**/legislationDocCache.test.ts",
      "**/fixtureReplayLivePipeline.test.ts",
      "**/faz31_32_coveragePerformance.test.ts",
      "**/axisCoverageFixtureFed.test.ts",
      "**/aymProbe.test.ts",
      "**/realWorldLiveSmoke.test.ts",
      "**/multiSourcePrecedents.test.ts",
      "**/axisE2EPack.test.ts",
      "**/faz38_41_combined.test.ts",
      "**/faz42_43_kapsam.test.ts",
      "**/fixtureReplayLivePipeline.test.ts",
    ]
  }
});
