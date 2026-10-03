import { defineConfig } from "vitest/config";

// Fixture repos under evals/ have their own tests (run by the fixture's gate), not by this suite.
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
