import type { LessonEntry } from "@/lib/content";

export function isTestContentFixture(entry: LessonEntry) {
  return (
    import.meta.env.MODE === "test" &&
    entry.data.draft &&
    entry.data.tags.includes("test-fixture")
  );
}
