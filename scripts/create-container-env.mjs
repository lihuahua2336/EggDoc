import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const force = args.includes("--force");
const positional = args.filter((argument) => argument !== "--force");
const sourcePath = path.resolve(positional[0] ?? ".env.local");
const targetPath = path.resolve(positional[1] ?? ".env");

if (!force) {
  try {
    await access(targetPath);
    throw new Error(`${path.basename(targetPath)} already exists; pass --force to replace it`);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
}

const source = await readFile(sourcePath, "utf8");
const assignments = new Map();
for (const line of source.split(/\r?\n/)) {
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (match) assignments.set(match[1], match[2]);
}

const required = [
  "EGGDOC_OIDC_ISSUER",
  "EGGDOC_OIDC_CLIENT_ID",
  "EGGDOC_OIDC_RESOURCE",
  "EGGDOC_OIDC_SCOPES",
  "EGGDOC_SESSION_SECRET",
  "EGGDOC_EGGAI_PLATFORM_URL",
  "EGGDOC_EGGAI_ECOSYSTEM_URL",
  "PUBLIC_EGGAI_BASE_URL",
  "PUBLIC_INSTALLER_ORIGIN",
];
const missing = required.filter((name) => !assignments.get(name));
if (missing.length > 0) {
  throw new Error(`Source environment is missing: ${missing.join(", ")}`);
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

const additions = [];
if (!assignments.has("EGGDOC_SITE_URL")) {
  const installerOrigin = new URL(unquote(assignments.get("PUBLIC_INSTALLER_ORIGIN")));
  additions.push(`EGGDOC_SITE_URL=${installerOrigin.origin}`);
}
if (!assignments.has("EGGDOC_PORT")) additions.push("EGGDOC_PORT=4321");

const output = `${source.trimEnd()}\n${additions.length ? `\n# Container deployment\n${additions.join("\n")}\n` : ""}`;
await writeFile(targetPath, output, { encoding: "utf8", flag: force ? "w" : "wx", mode: 0o600 });

const variableCount = [...output.matchAll(/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/gm)].length;
console.log(`Created ${path.basename(targetPath)} with ${variableCount} variables; values were not printed.`);
