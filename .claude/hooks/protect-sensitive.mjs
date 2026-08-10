import process from "node:process";

let input = "";
for await (const chunk of process.stdin) input += chunk;

try {
  const filePath = JSON.parse(input)?.tool_input?.file_path;
  if (typeof filePath !== "string" || filePath.length === 0) process.exit(0);

  // Windows paths arrive with backslashes; normalise so separator-bearing
  // patterns like ".azure/config" match there too.
  const normalised = filePath.replace(/\\/g, "/").toLowerCase();

  if (/\.(?:example|sample|template|dist)$/i.test(filePath)) process.exit(0);

  const blocked = [
    ".env",
    "terraform.tfvars",
    "secrets.json",
    "azure-credentials.json",
    ".pfx",
    ".key",
    ".pem",
    "credentials.json",
    ".azure/config",
    "backend.hcl",
  ];

  if (blocked.some(pattern => normalised.includes(pattern))) {
    process.stderr.write(`BLOCKED: Cannot modify sensitive file: ${filePath}\n`);
    process.exit(2);
  }
} catch {
  // Malformed input must not break unrelated tool use.
}

process.exit(0);
