import { getCollection, type CollectionEntry } from "astro:content";

export type GuideEntry = CollectionEntry<"guides">;
export type ContentEntry = GuideEntry;

export const TOOL_TUTORIALS_PATH = "/eggai/";
export const TOOL_TUTORIALS_LABEL = "工具教程";
export const TOOL_TUTORIALS_DESCRIPTION = "Codex 与 Claude Code 的安装与配置教程。";

function byOrderThenDate(a: GuideEntry, b: GuideEntry) {
  if (a.data.order !== b.data.order) {
    return a.data.order - b.data.order;
  }

  return b.data.updatedAt.getTime() - a.data.updatedAt.getTime();
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getGuideUrl(entry: GuideEntry) {
  return `${TOOL_TUTORIALS_PATH}${entry.id.replace(/^eggai\//, "")}/`;
}

export async function getToolTutorials() {
  const tutorials = await getCollection(
    "guides",
    (entry) => !entry.data.draft || import.meta.env.DEV,
  );
  return tutorials.sort(byOrderThenDate);
}

export async function getRelatedEntries(entry: ContentEntry, limit = 3) {
  const guides = await getToolTutorials();
  return guides
    .filter((candidate) => candidate.id !== entry.id)
    .slice(0, limit);
}
