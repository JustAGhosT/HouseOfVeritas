import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const productionWorkflows = [
  ".github/workflows/deploy-on-merge.yml",
  ".github/workflows/deploy.yml",
]

/**
 * Git hands these files back with CRLF on a Windows checkout, which the job
 * boundary pattern below would never match, leaving `deployJob` to swallow
 * every later job in the file. Normalise before parsing.
 */
function readWorkflow(workflowPath: string): string {
  return readFileSync(resolve(process.cwd(), workflowPath), "utf8").replace(/\r\n/g, "\n")
}

describe.each(productionWorkflows)("%s deployment identity contract", (workflowPath) => {
  const workflow = readWorkflow(workflowPath)
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
