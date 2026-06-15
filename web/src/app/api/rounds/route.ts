import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CANDIDATURE_TYPES,
  DIVISION_GENDER_OPTIONS,
  GENDER_OPTIONS,
} from "@/lib/candidate-profile";
import { CATEGORIES, COURSE_OPTIONS, YEARS } from "@/lib/constants";
import { fetchRoundCutoffs, getMsOpenRankList } from "@/lib/merit-queries";

const schema = z.object({
  course: z.enum(COURSE_OPTIONS.map((o) => o.value) as ["LLB_3", "LLB_5"]),
  category: z.enum(CATEGORIES),
  percentile: z.number().min(0).max(100),
  gender: z.enum(GENDER_OPTIONS.map((o) => o.value) as ["male", "female"]),
  candidatureType: z.enum(CANDIDATURE_TYPES),
  divisionGender: z.enum(
    DIVISION_GENDER_OPTIONS.map((o) => o.value) as ["any", "coed", "women"],
  ),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }

    const profile = {
      ...parsed.data,
      differentlyAbled: "No" as const,
      orphan: "No" as const,
      exServicemen: "No" as const,
      minority: "none" as const,
    };

    const [rows, rankList] = await Promise.all([
      fetchRoundCutoffs(profile, YEARS),
      getMsOpenRankList(parsed.data.course),
    ]);

    // Build rank lookup: "collegeId|divisionId" → rank index (1-based)
    const rankMap = new Map(
      rankList.map((r, i) => [`${r.college_id}|${r.division_id}`, i + 1]),
    );

    return NextResponse.json({ rows, rankMap: Object.fromEntries(rankMap) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
