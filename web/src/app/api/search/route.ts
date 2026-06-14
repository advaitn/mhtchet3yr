import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CANDIDATURE_TYPES,
  DIVISION_GENDER_OPTIONS,
  MINORITY_OPTIONS,
  YES_NO,
} from "@/lib/candidate-profile";
import { CATEGORIES, COURSE_OPTIONS } from "@/lib/constants";
import { findEligibleColleges } from "@/lib/merit-queries";

const searchSchema = z.object({
  course: z.enum(COURSE_OPTIONS.map((option) => option.value) as ["LLB_3", "LLB_5"]),
  category: z.enum(CATEGORIES),
  percentile: z.number().min(0).max(100),
  candidatureType: z.enum(CANDIDATURE_TYPES),
  differentlyAbled: z.enum(YES_NO),
  orphan: z.enum(YES_NO),
  exServicemen: z.enum(YES_NO),
  divisionGender: z.enum(
    DIVISION_GENDER_OPTIONS.map((option) => option.value) as ["any", "coed", "women"],
  ),
  minority: z.enum(MINORITY_OPTIONS.map((option) => option.value)),
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

    const matches = await findEligibleColleges(parsed.data);

    return NextResponse.json({
      count: matches.length,
      profile: parsed.data,
      matches,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
