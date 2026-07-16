import { defineConfig, devices } from "@playwright/test"
import { loadEnvConfig } from "@next/env"

process.env.E2E_TEST = "1"

// Resolve AUTH_SECRET the same way the dev server (booted below) will — Next
// loads .env.local via @next/env — so the session cookie the auth helper mints
// (tests/e2e/helpers/auth.ts) decrypts with the identical key. Loading it here
// pins the value into the inherited env before the server starts, guaranteeing
// both sides agree whether or not a .env.local is present (e.g. CI has none, so
// the fallback below applies on both sides). Keep the fallback in sync with the
// helper.
loadEnvConfig(process.cwd())
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "e2e-insecure-test-secret-do-not-use-in-production"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Serve a production build so route compilation cannot consume an E2E
    // assertion timeout. This also keeps the suite on the same runtime path
    // used by deployment rather than relying on the dev server's bundler.
    command: "pnpm run build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 300_000,
    // Auth.js rejects localhost unless the host is explicitly trusted. Without
    // this, the login page's session probe never resolves and every browser
    // authentication flow remains on its loading spinner.
    env: { ...process.env, E2E_TEST: "1", AUTH_TRUST_HOST: "true" },
  },
})
