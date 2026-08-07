import { defineConfig } from "vitest/config"
import { createRequire } from "node:module"
import path from "path"

const require = createRequire(import.meta.url)

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    // The heaviest component tests land within a few percent of a 10s budget, so
    // on a loaded machine they tip over and the suite fails for no reason that
    // reflects the code. One observed failure came in at 10255ms — a 2.5%
    // overshoot — while the same file passes comfortably when run alone.
    //
    // This is headroom, not a way to hide a hang: a genuinely stuck test still
    // fails, just 20s later. The real cost driver is that every one of the 116
    // test files builds a happy-dom environment, including the API and lib suites
    // that never touch a DOM. Moving those to the node environment is the actual
    // fix and a larger change than raising a limit.
    testTimeout: 20000,
    hookTimeout: 20000,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // Inline next-auth so vite transforms it (rather than letting Node
    // externally resolve its internal bare "next/server" import) — required
    // for the resolve alias below to take effect.
    server: {
      deps: {
        inline: ["next-auth", "@auth/core"],
      },
    },
    coverage: {
      provider: "v8",
      include: ["lib/**", "app/api/**"],
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, ".") },
      // next has no package.json#exports map, so it relies on file-extension
      // resolution (next/server.js). next-auth v5 imports the bare specifier
      // "next/server", which vitest's resolver won't extension-complete — pin it
      // to the real file so the proxy/auth import chain loads under vitest.
      { find: /^next\/server$/, replacement: require.resolve("next/server.js") },
    ],
  },
})
