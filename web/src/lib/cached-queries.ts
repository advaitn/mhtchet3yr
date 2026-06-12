import { unstable_cache } from "next/cache";

import type { Category } from "@/lib/constants";
import type { CandidatureGroup } from "@/lib/candidature";
import { getTopColleges } from "@/lib/merit-queries";
import type { Course } from "@/generated/prisma/client";

export async function getCachedTopColleges(params: {
  course: Course;
  category: Category;
  candidatureGroup: CandidatureGroup;
  year?: number;
  limit?: number;
}) {
  const cacheKey = [
    "top-colleges",
    params.course,
    params.category,
    params.candidatureGroup,
    String(params.year ?? "avg"),
    String(params.limit ?? 20),
  ];

  return unstable_cache(async () => getTopColleges(params), cacheKey, {
    revalidate: 3600,
  })();
}
