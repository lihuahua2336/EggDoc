import { getCollection, type CollectionEntry } from "astro:content";

export type GuideEntry = CollectionEntry<"guides">;
export type LessonEntry = CollectionEntry<"lessons">;
export type NoteEntry = CollectionEntry<"notes">;
export type ContentEntry = GuideEntry | LessonEntry | NoteEntry;

export interface AdjacentEntries {
  previous?: LessonEntry;
  next?: LessonEntry;
}

export function isPublished<T extends ContentEntry>(entry: T) {
  return !entry.data.draft || import.meta.env.DEV;
}

export function byOrderThenDate<T extends ContentEntry>(a: T, b: T) {
  const orderA = "order" in a.data ? a.data.order : 100;
  const orderB = "order" in b.data ? b.data.order : 100;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return b.data.updatedAt.getTime() - a.data.updatedAt.getTime();
}

export function byUpdatedDate<T extends ContentEntry>(a: T, b: T) {
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
  return `/eggai/${entry.id.replace(/^eggai\//, "")}/`;
}

export function getLessonUrl(entry: LessonEntry) {
  return `/learn/${entry.id.replace(/^ai-programming\//, "").replace(/^\d+-/, "")}/`;
}

export function getNoteUrl(entry: NoteEntry) {
  return `/notes/${entry.id}/`;
}

export function getEntryUrl(entry: ContentEntry) {
  if (entry.collection === "guides") {
    return getGuideUrl(entry);
  }

  if (entry.collection === "lessons") {
    return getLessonUrl(entry);
  }

  return getNoteUrl(entry);
}

export function getEntryKindLabel(entry: ContentEntry) {
  if (entry.collection === "guides") {
    return "指南";
  }

  if (entry.collection === "lessons") {
    return "课程";
  }

  return "笔记";
}

export async function getPublishedGuides() {
  const guides = await getCollection("guides", isPublished);
  return guides.sort(byOrderThenDate);
}

export async function getPublishedLessons(path?: string) {
  const lessons = await getCollection("lessons", (entry) => {
    return isPublished(entry) && (!path || entry.data.path === path);
  });
  return lessons.sort(byOrderThenDate);
}

export async function getPublishedNotes() {
  const notes = await getCollection("notes", isPublished);
  return notes.sort(byUpdatedDate);
}

export async function getAllPublishedContent() {
  const [guides, lessons, notes] = await Promise.all([
    getPublishedGuides(),
    getPublishedLessons(),
    getPublishedNotes(),
  ]);

  return [...guides, ...lessons, ...notes].sort(byUpdatedDate);
}

export async function getAdjacentLessons(entry: LessonEntry): Promise<AdjacentEntries> {
  const lessons = await getPublishedLessons(entry.data.path);
  const currentIndex = lessons.findIndex((lesson) => lesson.id === entry.id);

  if (currentIndex === -1) {
    return {};
  }

  return {
    previous: lessons[currentIndex - 1],
    next: lessons[currentIndex + 1],
  };
}

export async function getRelatedEntries(entry: ContentEntry, limit = 3) {
  const allEntries = await getAllPublishedContent();
  const currentTags = new Set(entry.data.tags);

  return allEntries
    .filter((candidate) => candidate.id !== entry.id || candidate.collection !== entry.collection)
    .map((candidate) => {
      const sharedTagCount = candidate.data.tags.filter((tag) => currentTags.has(tag)).length;
      const sameCollection = candidate.collection === entry.collection ? 1 : 0;
      const sameService =
        "service" in candidate.data &&
        "service" in entry.data &&
        candidate.data.service &&
        candidate.data.service === entry.data.service
          ? 2
          : 0;
      const samePath =
        "path" in candidate.data &&
        "path" in entry.data &&
        candidate.data.path === entry.data.path
          ? 2
          : 0;

      return {
        entry: candidate,
        score: sharedTagCount * 2 + sameCollection + sameService + samePath,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      return byUpdatedDate(a.entry, b.entry);
    })
    .slice(0, limit)
    .map((item) => item.entry);
}
