#!/bin/bash
# Stop hook: verify type checking and tests before Claude finishes.
# Successful hook stdout must be empty or a single valid JSON object.

INPUT=$(cat)

# Avoid repeatedly blocking when Claude is already continuing because of this hook.
if printf '%s' "$INPUT" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  try { process.exit(JSON.parse(input).stop_hook_active ? 0 : 1); }
  catch { process.exit(1); }
});
'; then
    exit 0
fi

emit_json() {
    HOOK_DECISION="$1" HOOK_MESSAGE="$2" node -e '
const decision = process.env.HOOK_DECISION;
const message = process.env.HOOK_MESSAGE || "Build check could not complete.";
const result = decision === "block"
  ? { decision: "block", reason: message }
  : { systemMessage: message };
process.stdout.write(JSON.stringify(result));
'
}

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd "$(dirname "$0")/../.." 2>/dev/null || {
    emit_json "allow" "Build check skipped: could not change to the project directory."
    exit 0
}

if ! command -v node &>/dev/null || ! command -v pnpm &>/dev/null; then
    # No JSON helper is available if Node itself is missing, so fail silently.
    if command -v node &>/dev/null; then
        emit_json "allow" "Build check skipped: pnpm is not available."
    fi
    exit 0
fi

TS_OUTPUT=$(pnpm exec tsc --noEmit 2>&1)
TS_STATUS=$?
TEST_OUTPUT=$(pnpm test -- --run 2>&1)
TEST_STATUS=$?

if [ "$TS_STATUS" -eq 0 ] && [ "$TEST_STATUS" -eq 0 ]; then
    exit 0
fi

MESSAGE="Build checks failed."
if [ "$TS_STATUS" -ne 0 ]; then
    TS_ERRORS=$(printf '%s\n' "$TS_OUTPUT" | grep -c "error TS" || true)
    TS_DETAILS=$(printf '%s\n' "$TS_OUTPUT" | grep "error TS" | head -10)
    MESSAGE="$MESSAGE TypeScript failed (${TS_ERRORS} reported errors)."
    if [ -n "$TS_DETAILS" ]; then
        MESSAGE="$MESSAGE
$TS_DETAILS"
    fi
fi

if [ "$TEST_STATUS" -ne 0 ]; then
    TEST_DETAILS=$(printf '%s\n' "$TEST_OUTPUT" | tail -20)
    MESSAGE="$MESSAGE Tests failed."
    if [ -n "$TEST_DETAILS" ]; then
        MESSAGE="$MESSAGE
$TEST_DETAILS"
    fi
fi

emit_json "block" "$MESSAGE"
exit 0
