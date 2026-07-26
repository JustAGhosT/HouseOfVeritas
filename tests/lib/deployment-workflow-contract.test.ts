import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const productionWorkflows = [
  ".github/workflows/deploy-on-merge.yml",
  ".github/workflows/deploy.yml",
]

describe.each(productionWorkflows)("%s deployment identity contract", (workflowPath) => {
  const workflow = readFileSync(resolve(process.cwd(), workflowPath), "utf8")
  const deployJob = workflow
    .slice(workflow.indexOf("  deploy-webapp:"))
    .split(/\n  [a-z][a-z0-9-]+:\n/, 1)[0]

  it("bakes the triggering commit into the application build", () => {
    expect(workflow).toContain("NEXT_PUBLIC_BUILD_COMMIT: ${{ github.sha }}")
  })

  it("blocks deployment success until the exact triggering commit is healthy", () => {
    expect(workflow).toContain("node scripts/verify-deployment-build.mjs")
    expect(workflow).toContain('--expected "${{ github.sha }}"')
  })

  it("packages only the verifier with the standalone artifact", () => {
    expect(workflow).toContain("cp scripts/verify-deployment-build.mjs .next/standalone/scripts/")
    expect(deployJob).not.toContain("actions/checkout")
  })
})
