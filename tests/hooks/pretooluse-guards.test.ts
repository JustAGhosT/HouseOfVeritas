import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { describe, it, expect } from "vitest"

// These hooks are the last line of defence before a destructive command runs or
// a secret file is overwritten, and nothing else exercises them. When they were
// ported from bash to Node they silently lost `git clean -f` coverage and began
// blocking any commit whose message merely mentioned a destructive command —
// neither of which surfaced until the behaviour was compared case by case.

const HOOKS = resolve(process.cwd(), ".claude/hooks")

const BLOCK = 2
const ALLOW = 0

function runHook(hook: string, toolInput: Record<string, unknown>): number {
  const result = spawnSync(process.execPath, [resolve(HOOKS, hook)], {
    input: JSON.stringify({ tool_input: toolInput }),
    encoding: "utf8",
  })
  if (result.error) throw result.error
  return result.status ?? -1
}

const guard = (command: string) => runHook("guard-destructive-bash.mjs", { command })
const protect = (filePath: string) => runHook("protect-sensitive.mjs", { file_path: filePath })

describe("guard-destructive-bash hook", () => {
  it.each([
    ["git push --force", "git push --force"],
    ["git push -f", "git push -f"],
    ["git push --force-with-lease", "git push --force-with-lease"],
    ["git reset --hard", "git reset --hard"],
    ["git clean -f", "git clean -f"],
    ["git clean -fd", "git clean -fd"],
    ["git clean -df", "git clean -df"],
    ["git clean --force", "git clean --force"],
    ["git checkout -- .", "git checkout -- ."],
    ["git restore .", "git restore ."],
    ["git branch -D", "git branch -D feature"],
    ["terraform destroy", "terraform destroy"],
    ["terraform apply -auto-approve", "terraform apply -var-file=x -auto-approve"],
    ["az group delete", "az group delete -n rg"],
    ["az resource delete", "az resource delete --ids /x"],
    ["rm -rf on an absolute path", "rm -rf /var/data"],
  ])("blocks %s", (_label, command) => {
    expect(guard(command)).toBe(BLOCK)
  })

  it.each([
    ["a read-only command", "git status"],
    ["a non-destructive branch delete", "git branch -d merged-feature"],
    ["a git clean dry run", "git clean -n"],
    ["terraform plan", "terraform plan -out tfplan"],
  ])("allows %s", (_label, command) => {
    expect(guard(command)).toBe(ALLOW)
  })

  it("allows a commit whose message only mentions a destructive command", () => {
    const command = ['git commit -m "$(cat <<\'EOF\'', "fix(docs): warn against git reset --hard", "EOF", ')"'].join(
      "\n",
    )
    expect(guard(command)).toBe(ALLOW)
  })

  it("still blocks a destructive command sharing the heredoc opener line", () => {
    const command = ["git push --force && cat <<'EOF'", "release notes", "EOF"].join("\n")
    expect(guard(command)).toBe(BLOCK)
  })

  it.each([
    ["malformed json", "not json at all"],
    ["an absent command", JSON.stringify({ tool_input: {} })],
  ])("exits cleanly on %s rather than breaking unrelated tool use", (_label, payload) => {
    const result = spawnSync(process.execPath, [resolve(HOOKS, "guard-destructive-bash.mjs")], {
      input: payload,
      encoding: "utf8",
    })
    expect(result.status).toBe(ALLOW)
  })
})

describe("protect-sensitive hook", () => {
  it.each([
    ["a dotenv file", "/proj/.env"],
    ["a local dotenv file", "/proj/.env.local"],
    ["terraform vars", "/proj/terraform.tfvars"],
    ["a secrets bundle", "/proj/secrets.json"],
    ["a private key", "/proj/server.key"],
    ["a certificate", "/proj/cert.pem"],
    ["a pfx bundle", "/proj/cert.pfx"],
    ["a terraform backend config", "/proj/backend.hcl"],
  ])("blocks %s", (_label, filePath) => {
    expect(protect(filePath)).toBe(BLOCK)
  })

  it.each([
    ["a dotenv template", "/proj/.env.example"],
    ["a tfvars template", "/proj/terraform.tfvars.example"],
    ["a sample config", "/proj/secrets.json.sample"],
    ["ordinary source", "/proj/app/dashboard/page.tsx"],
  ])("allows %s", (_label, filePath) => {
    expect(protect(filePath)).toBe(ALLOW)
  })

  // The blocklist carries separator-bearing patterns, so a Windows path has to
  // be normalised before matching or the rule never fires on this platform.
  it.each([
    ["an azure config", "C:\\Users\\dev\\.azure\\config"],
    ["terraform vars", "C:\\proj\\terraform.tfvars"],
  ])("blocks %s given a Windows path", (_label, filePath) => {
    expect(protect(filePath)).toBe(BLOCK)
  })
})
