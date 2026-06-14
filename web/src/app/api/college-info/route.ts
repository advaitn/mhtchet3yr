import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type AdmitRow = {
  year: number;
  category: string;
  quota: string;
  count: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const collegeId = searchParams.get("collegeId");
  const divisionId = searchParams.get("divisionId");
  const course = searchParams.get("course");

  if (!collegeId || !divisionId || !course) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const rows = await prisma.$queryRawUnsafe<AdmitRow[]>(
    `
    SELECT
      year,
      CASE
        WHEN allotted_type LIKE 'OPEN-EWS%'          THEN 'OPEN-EWS'
        WHEN allotted_type LIKE 'OPEN%'               THEN 'OPEN'
        WHEN allotted_type LIKE 'SC%'                 THEN 'SC'
        WHEN allotted_type LIKE 'ST%'                 THEN 'ST'
        WHEN allotted_type LIKE 'OBC%'                THEN 'OBC'
        WHEN allotted_type LIKE 'SEBC%'               THEN 'SEBC'
        WHEN allotted_type LIKE 'SBC%'                THEN 'SBC'
        WHEN allotted_type LIKE 'NT 1%' OR allotted_type LIKE 'NT1%' THEN 'NT-B'
        WHEN allotted_type LIKE 'NT 2%' OR allotted_type LIKE 'NT2%' THEN 'NT-C'
        WHEN allotted_type LIKE 'NT 3%' OR allotted_type LIKE 'NT3%' THEN 'NT-D'
        WHEN allotted_type LIKE 'DT%'                 THEN 'DT/VJ'
        ELSE 'Other'
      END AS category,
      CASE
        WHEN allotted_quota IN ('MS', 'MH') THEN 'State'
        WHEN allotted_quota = 'OMS'         THEN 'OMS'
        WHEN allotted_quota = 'Minority'    THEN 'Minority'
        WHEN allotted_quota = 'NRI'         THEN 'NRI'
        ELSE allotted_quota
      END AS quota,
      COUNT(*)::int AS count
    FROM allotment_entries
    WHERE college_id = $1
      AND division_id = $2
      AND course = $3::"Course"
      AND merit_marks > 0
      AND merit_marks <= 100
    GROUP BY year, category, quota
    ORDER BY year, category, quota
    `,
    collegeId,
    divisionId,
    course,
  );

  return NextResponse.json({ rows });
}
