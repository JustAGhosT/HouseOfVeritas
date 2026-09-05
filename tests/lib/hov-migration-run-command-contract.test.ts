import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const runCommand = readFileSync(
  resolve(process.cwd(), "scripts/migration/hov-nexamesh/Invoke-ProtectedMigrationRunCommand.ps1"),
  "utf8"
).replace(/\r\n/g, "\n")

const runnerReadme = readFileSync(
  resolve(process.cwd(), "terraform/migrations/hov-nexamesh/migration-runner/README.md"),
  "utf8"
).replace(/\r\n/g, "\n")

describe("HOV protected migration Run Command contract", () => {
  it("uses a cleanup-bound POSIX launcher without recording protected payload output", () => {
    expect(runCommand).toContain("#!/usr/bin/env bash")
    expect(runCommand).toContain("umask 077")
    expect(runCommand).toContain("mktemp -d /tmp/hov-migration-run-command.XXXXXXXX")
    expect(runCommand).toContain('chmod 700 "$temporary_directory"')
    expect(runCommand).toContain('chmod 600 "$payload_path" "$launcher_path"')
    expect(runCommand).toContain(
      'pwsh -NoLogo -NoProfile -NonInteractive -File "$launcher_path" "$payload_path"'
    )
    expect(runCommand).toContain('unset "$name" || true')
    expect(runCommand).toContain('rm -rf -- "$temporary_directory"')
    expect(runCommand).toContain("payload output was not recorded")
    expect(runCommand).toContain("protectedValuesRecorded = $false")
    expect(runnerReadme).toContain(
      "launcher makes protected Run Command execution technically available"
    )
    expect(runnerReadme).not.toContain("protected migration\ncommand gate remains blocked")
  })
})
