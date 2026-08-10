import process from "node:process";

let input = "";
for await (const chunk of process.stdin) input += chunk;

// Heredoc bodies are data, not commands — a commit message that merely mentions
// `git reset --hard` must not be blocked. Keeps the text before the `<<` opener,
// so a destructive command sharing that line is still matched.
// Known limitation, same as the shell version this replaces: a body fed to an
// interpreter (`bash <<EOF`) does execute, and is not inspected.
function stripHeredocs(command) {
  const lines = command.split(/\r?\n/);
  const kept = [];
  let terminator = null;

  for (const line of lines) {
    if (terminator !== null) {
      if (line.trim() === terminator) terminator = null;
      continue;
    }
    const opener = line.match(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
    if (opener) {
      terminator = opener[2];
      kept.push(line.slice(0, opener.index));
      continue;
    }
    kept.push(line);
  }

  return kept.join("\n");
}

try {
  const raw = JSON.parse(input)?.tool_input?.command;
  if (typeof raw !== "string" || raw.length === 0) process.exit(0);
  const command = stripHeredocs(raw);

  const blocked = [
    /\bgit\s+push\s+(?:--force(?:-with-lease)?|-f)(?:\s|$)/i,
    /\bgit\s+reset\s+--hard(?:\s|$)/i,
    // Any force flag, in any order and any position: -f, -fd, -df, -xf, --force.
    // `-n`/`--dry-run` alone stays allowed.
    /\bgit\s+clean\b[^\r\n]*?\s(?:-[a-zA-Z]*f[a-zA-Z]*|--force)(?:\s|$)/i,
    /\bgit\s+checkout\s+(?:--\s+)?\.(?:\s|$)/i,
    /\bgit\s+restore\s+\.(?:\s|$)/i,
    /\bgit\s+branch\s+-D(?:\s|$)/,
    /\bterraform\s+destroy(?:\s|$)/i,
    /\bterraform\s+apply\b[^\r\n]*\s-auto-approve(?:\s|$)/i,
    /\baz\s+(?:group|resource)\s+delete(?:\s|$)/i,
    /\brm\s+-[^\s]*[rRfF]{2,}[^\s]*\s+[\/~]/,
  ];

  const match = blocked.find(pattern => pattern.test(command));
  if (match) {
    process.stderr.write("BLOCKED: Destructive operation detected. Ask the user for explicit confirmation first.\n");
    process.exit(2);
  }
} catch {
  // Malformed input must not break unrelated tool use.
}

process.exit(0);
