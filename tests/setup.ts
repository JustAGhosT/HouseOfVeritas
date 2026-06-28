import "@testing-library/jest-dom/vitest"

// Auth.js requires a secret to initialise; provide a deterministic dummy in
// tests so the proxy/auth wrapper doesn't emit MissingSecret noise. No auth
// cookie is present in tests, so sessions still resolve to null.
process.env.AUTH_SECRET ??= "test-secret-not-used-in-production"
