import "@testing-library/jest-dom/vitest"

// Auth.js requires a secret to initialise; provide a deterministic dummy in
// tests so the proxy/auth wrapper doesn't emit MissingSecret noise. No auth
// cookie is present in tests, so sessions still resolve to null.
process.env.AUTH_SECRET ??= "test-secret-not-used-in-production"

// Unit tests exercise the production-like empty-state behavior. Explicitly
// disable opt-in demo fixtures so a developer's shell environment cannot
// change assertions while modules are imported.
process.env.ALLOW_DEMO_DATA = "false"
process.env.ALLOW_DEMO_USERS = "false"
