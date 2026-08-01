import { defineConfig, devices } from "@playwright/test"
import { loadEnvConfig } from "@next/env"
import { resolveProductionProbePolicy } from "./tests/e2e/helpers/production-probe-policy"

process.env.E2E_TEST = "1"

// Resolve AUTH_SECRET the same way the dev server (booted below) will — Next
// loads .env.local via @next/env — so the session cookie the auth helper mints
// (tests/e2e/helpers/auth.ts) decrypts with the identical key. Loading it here
// pins the value into the inherited env before the server starts, guaranteeing
// both sides agree whether or not a .env.local is present (e.g. CI has none, so
// the fallback below applies on both sides). Keep the fallback in sync with the
// helper.
const probePolicy = resolveProductionProbePolicy(process.env, () => loadEnvConfig(process.cwd()))
const { isPostDeployProbe } = probePolicy
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "e2e-insecure-test-secret-do-not-use-in-production"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: probePolicy.retries,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    // Production traces retain raw Cookie request headers, and screenshots can
    // retain production UI data. Never write either artifact when legitimate
    // short-lived production sessions are injected.
    trace: probePolicy.trace,
    screenshot: probePolicy.screenshot,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Post-deploy probes target an already deployed application. Do not build or
  // start a local server when BASE_URL points at that deployment.
  webServer: isPostDeployProbe
    ? undefined
    : {
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
