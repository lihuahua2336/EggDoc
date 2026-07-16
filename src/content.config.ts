import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const sharedSchema = z.object({
  title: z.string(),
  description: z.string(),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
});

const guides = defineCollection({
  loader: glob({
    base: "./src/content/guides",
    pattern: "**/*.{md,mdx}",
  }),
  schema: sharedSchema.extend({
    type: z.literal("guide"),
    service: z.string().optional(),
    app: z.string().optional(),
    order: z.number().default(100),
  }),
});

const lessons = defineCollection({
  loader: glob({
    base: "./src/content/lessons",
    pattern: "**/*.{md,mdx}",
  }),
  schema: sharedSchema.extend({
    type: z.literal("lesson"),
    path: z.string(),
    order: z.number(),
    videoUrl: z
      .url()
      .refine((url) => ["http:", "https:"].includes(new URL(url).protocol), {
        message: "videoUrl must use http or https",
      })
      .optional(),
  }),
});

const notes = defineCollection({
  loader: glob({
    base: "./src/content/notes",
    pattern: "**/*.{md,mdx}",
  }),
  schema: sharedSchema.extend({
    type: z.literal("note"),
    topic: z.string().optional(),
  }),
});

export const collections = { guides, lessons, notes };
