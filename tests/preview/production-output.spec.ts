import { expect, test } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

const CONFIGURATION_PLACEHOLDER = "sk-EGGDOC-EXAMPLE-REPLACE-ME";
const TEST_ONLY_ROUTE = "/learn/article-interactions-fixture/";
const PERSONALIZED_FIXTURE_VALUES = [
  "sk-PERSONALIZED-FIXTURE-MUST-NEVER-SHIP",
  "sk-EGGDOC-SINGLE-FIXTURE-ONLY",
  "sk-EGGDOC-SECONDARY-FIXTURE-ONLY",
  "https://api.fixture.eggai.test/v1",
  "https://edge.fixture.eggai.test/v1",
];

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );

  return files.flat();
}

type ContentFrontmatter = {
  draft?: boolean;
  tags?: string[];
};

async function getPublishedRoutes() {
  const contentRoot = path.resolve("src/content");
  const contentFiles = (await listFiles(contentRoot)).filter((file) => /\.mdx?$/.test(file));
  const routes = new Set(["/", "/eggai/", "/learn/", "/notes/", "/search/"]);

  for (const contentFile of contentFiles) {
    const source = await readFile(contentFile, "utf8");
    const frontmatterSource = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
    expect(frontmatterSource, `${contentFile} should contain frontmatter`).toBeDefined();
    const frontmatter = parse(frontmatterSource!) as ContentFrontmatter;

    if (frontmatter.draft) {
      continue;
    }

    const contentPath = path.relative(contentRoot, contentFile).replaceAll("\\", "/");
    const slug = contentPath.replace(/\.mdx?$/, "");

    if (slug.startsWith("guides/eggai/")) {
      routes.add(`/${slug.replace(/^guides\//, "")}/`);
    } else if (slug.startsWith("lessons/ai-programming/")) {
      routes.add(`/learn/${slug.replace(/^lessons\/ai-programming\/\d+-/, "")}/`);
    } else if (slug.startsWith("notes/")) {
      routes.add(`/${slug}/`);
    }

    for (const tag of frontmatter.tags ?? []) {
      routes.add(`/tags/${tag}/`);
    }
  }

  return [...routes].sort();
}

function routeFromBuiltHtml(file: string) {
  const relativePath = path.relative(path.resolve("dist/client"), file).replaceAll("\\", "/");
  return relativePath === "index.html" ? "/" : `/${relativePath.replace(/index\.html$/, "")}`;
}

test("the production build serves Pagefind search and the sitemap", async ({ page, request }) => {
  const [pagefind, sitemap] = await Promise.all([
    request.get("/pagefind/pagefind.js"),
    request.get("/sitemap-index.xml"),
  ]);

  expect(pagefind.status()).toBe(200);
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("sitemap-0.xml");

  await page.goto("/search/");
  const searchInput = page.getByLabel("关键词");
  await expect(searchInput).toBeEnabled();
  await searchInput.fill("EGGDOC");
  await expect(page.getByRole("heading", { name: "用脚本把 Codex 接入 EggAi" })).toBeVisible();
});

test("every published page is anonymous, prerendered, and included in the sitemap", async ({
  page,
  request,
}) => {
  const expectedRoutes = await getPublishedRoutes();
  const builtHtmlFiles = (await listFiles(path.resolve("dist/client"))).filter((file) =>
    file.endsWith(".html"),
  );
  const builtRoutes = builtHtmlFiles.map(routeFromBuiltHtml).sort();
  expect(builtRoutes).not.toContain(TEST_ONLY_ROUTE);
  expect(builtRoutes).toEqual(expectedRoutes);

  const responses = await Promise.all(expectedRoutes.map((route) => request.get(route)));
  for (const [index, response] of responses.entries()) {
    expect(response.status(), expectedRoutes[index]).toBe(200);
  }

  const sitemapResponse = await request.get("/sitemap-0.xml");
  const sitemapUrls = await page.evaluate((xml) => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    return [...document.querySelectorAll("loc")].map((node) => node.textContent);
  }, await sitemapResponse.text());
  const testOnlyUrl = new URL(TEST_ONLY_ROUTE, "https://eggdoc.pages.dev").href;
  expect(sitemapUrls).not.toContain(testOnlyUrl);
  expect(sitemapUrls.sort()).toEqual(
    expectedRoutes.map((route) => new URL(route, "https://eggdoc.pages.dev").href).sort(),
  );

  const builtTutorial = await readFile(
    "dist/client/eggai/codex-installer/index.html",
    "utf8",
  );
  expect(builtTutorial).toContain(CONFIGURATION_PLACEHOLDER);

  const outputFiles = await listFiles("dist");
  for (const outputFile of outputFiles) {
    const contents = await readFile(outputFile);
    for (const fixtureValue of PERSONALIZED_FIXTURE_VALUES) {
      expect(contents.includes(Buffer.from(fixtureValue)), `${outputFile} contains ${fixtureValue}`).toBe(
        false,
      );
    }
  }
});
