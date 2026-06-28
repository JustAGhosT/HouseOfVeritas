import { defineConfig } from "vitest/config"
import { createRequire } from "node:module"
import path from "path"

const require = createRequire(import.meta.url)

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    testTimeout: 10000,
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
