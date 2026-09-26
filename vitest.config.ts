import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest is configured for pure logic only.
 *
 * Every test here exercises a module with no database and no network: the draw
 * algorithm, privacy redaction, CSV escaping, entry-number generation and the
 * validation schemas. That is deliberate — the parts worth testing here are
 * exactly the parts that must be correct without a database in front of them,
 * and a test that needs PGlite running stops being run at all very quickly.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Draw tests are deterministic by construction; the extra margin is for the
    // distribution checks, which run thousands of permutations.
    testTimeout: 20_000,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
