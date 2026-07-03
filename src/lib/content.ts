import { getCollection, type CollectionEntry } from "astro:content";

export type GuideEntry = CollectionEntry<"guides">;
export type LessonEntry = CollectionEntry<"lessons">;
export type NoteEntry = CollectionEntry<"notes">;
export type ContentEntry = GuideEntry | LessonEntry | NoteEntry;

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
