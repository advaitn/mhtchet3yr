import path from "node:path";

import type { Course } from "@/generated/prisma/client";

export type MeritDatasetConfig = {
  course: Course;
  year: number;
  slug: string;
  /** Path relative to repo root (parent of `web/`). */
  relativeFile: string;
};

const REPO_ROOT = path.resolve(process.cwd(), "..");

/** Add new years/courses here after scraping — import picks them up automatically. */
export const MERIT_DATASETS: MeritDatasetConfig[] = [
  {
    course: "LLB_3",
    year: 2023,
    slug: "llb3-2023",
    relativeFile: "output/merit_list_all_23.csv",
  },
  {
    course: "LLB_3",
    year: 2024,
    slug: "llb3-2024",
    relativeFile: "output/merit_list_all_24.csv",
  },
  {
    course: "LLB_3",
    year: 2025,
    slug: "llb3-2025",
    relativeFile: "output/merit_list_all_25.csv",
  },
  {
    course: "LLB_5",
    year: 2023,
    slug: "llb5-2023",
    relativeFile: "output/merit_list_all_llb5_23.csv",
  },
  {
    course: "LLB_5",
    year: 2024,
    slug: "llb5-2024",
    relativeFile: "output/merit_list_all_llb5_24.csv",
  },
  {
    course: "LLB_5",
    year: 2025,
    slug: "llb5-2025",
    relativeFile: "output/merit_list_all_llb5_25.csv",
  },
];

export function resolveDatasetPath(relativeFile: string): string {
  return path.join(REPO_ROOT, relativeFile);
}

export function findDataset(slug: string): MeritDatasetConfig | undefined {
  return MERIT_DATASETS.find((dataset) => dataset.slug === slug);
}
