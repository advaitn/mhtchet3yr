import { NextResponse } from "next/server";
import { z } from "zod";

import { CATEGORIES, COURSE_OPTIONS } from "@/lib/constants";
import { parseCandidatureGroup } from "@/lib/candidature";
import { cutoffStatsReady, findEligibleColleges } from "@/lib/merit-queries";

const searchSchema = z.object({
  course: z.enum(COURSE_OPTIONS.map((option) => option.value) as ["LLB_3", "LLB_5"]),
  category: z.enum(CATEGORIES),
  percentile: z.number().min(0).max(100),
  candidatureGroup: z.enum(["MS", "OMS"]),
  differentlyAbled: z.boolean().optional(),
  orphan: z.boolean().optional(),
  exServicemen: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = searchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search parameters", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const ready = await cutoffStatsReady();
    if (!ready) {
      return NextResponse.json(
        { error: "Cutoff stats not initialized. Run db:refresh-stats." },
        { status: 503 },
      );
    }

    const filters = {
      ...parsed.data,
      candidatureGroup: parseCandidatureGroup(parsed.data.candidatureGroup),
    };

    const matches = await findEligibleColleges(filters);

    return NextResponse.json({
      count: matches.length,
      filters,
      matches,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
