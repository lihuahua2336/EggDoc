import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const outputRoot = path.resolve("dist");
const fixtureRoute = path.join(
  outputRoot,
  "client",
  "learn",
  "article-interactions-fixture",
  "index.html",
);

try {
  await access(fixtureRoute);
  throw new Error(`Test-only article route leaked into production: ${fixtureRoute}`);
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
      }),
    )
  ).flat();
}

for (const outputFile of await listFiles(outputRoot)) {
  const contents = await readFile(outputFile);
  if (contents.includes(Buffer.from("video.example.test"))) {
    throw new Error(`Test-only video address leaked into production: ${outputFile}`);
  }
}
