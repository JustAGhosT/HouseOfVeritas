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
      '/usr/bin/pwsh -NoLogo -NoProfile -NonInteractive -File "$launcher_path" "$payload_path"'
    )
    expect(runCommand).toContain('unset "$name" || true')
    expect(runCommand).toContain('rm -rf -- "$temporary_directory"')
    expect(runCommand).toContain("trap cleanup EXIT")
    expect(runCommand).toContain("trap 'exit 129' HUP")
    expect(runCommand).toContain("trap 'exit 130' INT")
    expect(runCommand).toContain("trap 'exit 143' TERM")
    expect(runCommand).toContain("local payload_status=$?")
    expect(runCommand).toContain('return "$payload_status"')
    expect(runCommand).not.toContain('2>"$payload_stderr" || return 47')
    expect(runCommand).toContain("set +e\nmigration_main >/dev/null 2>&1\nstatus=$?\nset -e")
    expect(runCommand).toContain('exit "$status"')
    expect(runCommand).toContain("payload output was not recorded")
    expect(runCommand).toContain("protectedValuesRecorded = $false")
    expect(runnerReadme).toContain(
      "launcher makes protected Run Command execution technically available"
    )
    expect(runnerReadme).toContain("mode-0600 files inside a mode-0700 temporary directory")
    expect(runnerReadme).not.toContain("protected migration\ncommand gate remains blocked")
  })
})
