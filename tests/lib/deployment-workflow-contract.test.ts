import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const productionWorkflows = [
  ".github/workflows/deploy-on-merge.yml",
  ".github/workflows/deploy.yml",
]

const terraformMutationWorkflows = [
  [".github/workflows/deploy.yml", "deploy-infrastructure", undefined],
  [".github/workflows/terraform-apply.yml", "terraform-apply", "if: inputs.confirm == 'APPLY'"],
  [
    ".github/workflows/terraform-destroy.yml",
    "terraform-destroy",
    "if: inputs.confirm_destroy == 'DESTROY'",
  ],
] as const

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

describe("production mutation concurrency contracts", () => {
  it.each(terraformMutationWorkflows)(
    "%s protects %s with the shared Terraform-state group",
    (workflowPath, jobName, confirmationGuard) => {
      const workflow = readWorkflow(workflowPath)
      const job = workflow
        .slice(workflow.indexOf(`  ${jobName}:`))
        .split(/\n  [a-z][a-z0-9-]+:\n/, 1)[0]

      expect(job).toContain("group: hov-production-terraform-state")
      expect(job).toContain("cancel-in-progress: false")
      if (confirmationGuard) {
        expect(job).toContain(confirmationGuard)
      }
    }
  )

  it.each([".github/workflows/deploy.yml", ".github/workflows/deploy-on-merge.yml"])(
    "%s protects deploy-webapp with the shared web-app group",
    (workflowPath) => {
      const workflow = readWorkflow(workflowPath)
      const job = workflow
        .slice(workflow.indexOf("  deploy-webapp:"))
        .split(/\n  [a-z][a-z0-9-]+:\n/, 1)[0]

      expect(job).toContain("group: hov-production-webapp")
      expect(job).toContain("cancel-in-progress: false")
    }
  )
})
