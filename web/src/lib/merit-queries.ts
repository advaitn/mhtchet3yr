import { readFileSync } from "node:fs";
import path from "node:path";

import { Prisma } from "@/generated/prisma/client";
import { MIN_COHORT_SIZE } from "@/lib/candidate-profile";
import { toCandidatureGroup, type CandidatureGroup } from "@/lib/candidature";
import type { Category } from "@/lib/constants";
import { YEARS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type {
  CandidateProfile,
  CollegeMatch,
  MatchLabel,
  RankedCollege,
  Trend,
  YearCutoff,
} from "@/types/merit";

export const ARBITRATION_YEAR_COUNT = YEARS.length;

type CutoffRow = {
  course: string;
  year: number;
  college_id: string;
  college_name: string;
  division_id: string;
  division_name: string;
  university_name: string;
  category: string;
  candidature_group: string;
  cutoff_percentile: Prisma.Decimal;
  top_percentile: Prisma.Decimal;
  median_percentile: Prisma.Decimal;
  waitlist_count: number;
};

type ProfileCutoffRow = {
  year: number;
  college_id: string;
  college_name: string;
  division_id: string;
  division_name: string;
  university_name: string;
  cutoff_percentile: Prisma.Decimal;
  competitive_percentile: Prisma.Decimal;
  top_percentile: Prisma.Decimal;
  median_percentile: Prisma.Decimal;
  waitlist_count: number;
};

function toNumber(value: Prisma.Decimal | number | string): number {
  return Number(value);
}

function shortCollegeName(name: string): string {
  return name.includes(" - ") ? name.split(" - ").slice(1).join(" - ") : name;
}

function groupKey(collegeId: string, divisionId: string): string {
  return `${collegeId}|${divisionId}`;
}

/**
 * Estimate admission chance from allotment data.
 *
 *   minAdmitted  = MIN(merit_marks) across all CAP rounds — true floor.
 *                  Someone above this WAS admitted in that year.
 *   top          = MAX(merit_marks) — ceiling of admitted class.
 *   p25Admitted  = retained in signature for future use; not used in scoring.
 *
 * Design principle: being anywhere inside [min, top] means the user would have
 * been admitted in that historical year. The uncertainty comes from year-to-year
 * cutoff variation, not from where they sit within the admitted class.
 *
 * Scale:
 *   user ≥ top           →  95 %  (above everyone admitted)
 *   user = min           →  70 %  (just made the cut; cutoff shifts ±1-2 pts/year)
 *   user between min–top →  70–95 % linearly
 *   user within 2 pts below min →  5–70 % (near-floor uncertainty band)
 *   user > 2 pts below min →  5 %
 */
export function computeChanceFromCutoffs(
  userPercentile: number,
  minAdmitted: number,
  _p25Admitted: number,
  top: number,
): number {
  if (userPercentile >= top) return 95;

  if (userPercentile >= minAdmitted) {
    const t = (userPercentile - minAdmitted) / Math.max(top - minAdmitted, 0.01);
    return Math.round(70 + t * 25); // 70–95 %
  }

  // ±2 percentile point buffer for year-to-year cutoff variation
  const nearFloor = Math.max(0, minAdmitted - 2);
  if (userPercentile <= nearFloor) return 5;
  const t = (userPercentile - nearFloor) / Math.max(minAdmitted - nearFloor, 0.01);
  return Math.round(5 + t * 65); // 5–70 %
}

export function toMatchLabel(chancePercent: number): MatchLabel {
  if (chancePercent >= 88) return "safe";
  if (chancePercent >= 75) return "good";
  if (chancePercent >= 55) return "borderline";
  if (chancePercent >= 25) return "reach";
  return "unlikely";
}

function computeTrend(years: YearCutoff[]): Trend {
  const dataPoints = years
    .filter((y) => y.hasData && y.yearProb !== null)
    .sort((a, b) => a.year - b.year);

  if (dataPoints.length < 2) return "unknown";

  const delta = dataPoints[dataPoints.length - 1].yearProb! - dataPoints[0].yearProb!;
  if (delta > 10) return "improving";
  if (delta < -10) return "declining";
  return "stable";
}

function buildYearCutoff(row: ProfileCutoffRow, userPercentile: number): YearCutoff {
  const cutoff = toNumber(row.cutoff_percentile);
  const competitive = toNumber(row.competitive_percentile);
  const top = toNumber(row.top_percentile);
  const median = toNumber(row.median_percentile);

  return {
    year: row.year,
    yearProb: computeChanceFromCutoffs(userPercentile, cutoff, competitive, top),
    cutoff,
    median,
    top,
    waitlistCount: row.waitlist_count,
    hasData: true,
  };
}

function emptyYearCutoff(year: number): YearCutoff {
  return {
    year,
    yearProb: null,
    cutoff: 0,
    median: 0,
    top: 0,
    waitlistCount: 0,
    hasData: false,
  };
}


function buildArbitratedYears(
  rows: ProfileCutoffRow[],
  userPercentile: number,
): YearCutoff[] {
  const byYear = new Map(rows.map((row) => [row.year, buildYearCutoff(row, userPercentile)]));
  return YEARS.map((year) => byYear.get(year) ?? emptyYearCutoff(year));
}

function summarizeYears(years: YearCutoff[]): Pick<
  CollegeMatch,
  "years" | "chancePercent" | "matchLabel" | "trend" | "avgMedian" | "bestMedian"
> {
  const yearsWithData = years.filter((y) => y.hasData && y.yearProb !== null);
  const cutoffs = yearsWithData.map((y) => y.cutoff);

  const chancePercent =
    yearsWithData.length > 0
      ? Math.round(
          yearsWithData.reduce((sum, y) => sum + y.yearProb!, 0) / yearsWithData.length,
        )
      : 0;

  return {
    years,
    chancePercent,
    matchLabel: yearsWithData.length === 0 ? "unknown" : toMatchLabel(chancePercent),
    trend: computeTrend(years),
    avgMedian:
      cutoffs.length > 0 ? cutoffs.reduce((sum, v) => sum + v, 0) / cutoffs.length : 0,
    bestMedian: cutoffs.length > 0 ? Math.max(...cutoffs) : 0,
  };
}

type MsOpenRankRow = {
  college_id: string;
  college_name: string;
  division_id: string;
  division_name: string;
  university_name: string;
  ms_open_cutoff: Prisma.Decimal;
};

async function getMsOpenRankList(course: CandidateProfile["course"]): Promise<MsOpenRankRow[]> {
  return prisma.$queryRaw<MsOpenRankRow[]>`
    SELECT
      college_id,
      MIN(college_name) AS college_name,
      division_id,
      MIN(division_name) AS division_name,
      MIN(university_name) AS university_name,
      AVG(cutoff_percentile) AS ms_open_cutoff
    FROM college_cutoff_stats
    WHERE course = ${course}::"Course"
      AND category = 'OPEN'
      AND candidature_group = 'MS'
      AND waitlist_count >= ${MIN_COHORT_SIZE}
    GROUP BY college_id, division_id
    ORDER BY ms_open_cutoff DESC, MIN(college_name) ASC
  `;
}

function aggregateProfileByDivision(
  rows: ProfileCutoffRow[],
  userPercentile: number,
): Map<
  string,
  Pick<CollegeMatch, "years" | "chancePercent" | "matchLabel" | "trend" | "avgMedian" | "bestMedian">
> {
  const grouped = new Map<string, ProfileCutoffRow[]>();

  for (const row of rows) {
    const key = groupKey(row.college_id, row.division_id);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(key, [row]);
    }
  }

  const result = new Map<
    string,
    Pick<CollegeMatch, "years" | "chancePercent" | "matchLabel" | "trend" | "avgMedian" | "bestMedian">
  >();

  for (const [key, divisionRows] of grouped) {
    result.set(key, summarizeYears(buildArbitratedYears(divisionRows, userPercentile)));
  }

  return result;
}

/**
 * Build WHERE fragments + params for querying allotment_entries by profile.
 * Maps profile.category → allotted_type prefix pattern.
 * Maps profile.candidatureType → allotted_quota (MS / OMS).
 * Demographic sub-filters (PH / orphan / ex-servicemen) are not present in
 * allotment data and are intentionally omitted.
 */
function buildAllotmentWhere(
  profile: CandidateProfile,
  startIndex: number,
  alias = "ae",
): { where: string[]; params: unknown[]; nextIndex: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  let i = startIndex;

  const cat = profile.category;
  if (cat === "OPEN-EWS") {
    where.push(`${alias}.allotted_type LIKE 'OPEN-EWS%'`);
  } else if (cat === "OPEN") {
    where.push(
      `${alias}.allotted_type LIKE 'OPEN%' AND ${alias}.allotted_type NOT LIKE 'OPEN-EWS%'`,
    );
  } else if (cat === "NT 1 (NT-B)") {
    where.push(`${alias}.allotted_type LIKE 'NT 1%'`);
  } else if (cat === "NT 2 (NT-C)") {
    where.push(`${alias}.allotted_type LIKE 'NT 2%'`);
  } else if (cat === "NT 3 (NT-D)") {
    where.push(`${alias}.allotted_type LIKE 'NT 3%'`);
  } else if (cat === "DT / VJ") {
    where.push(
      `(${alias}.allotted_type LIKE 'DT / VJ%' OR ${alias}.allotted_type LIKE 'DT/VJ%')`,
    );
  } else {
    // SC, ST, OBC, SEBC, SBC, etc. — safe to use parameterised LIKE
    params.push(`${cat}%`);
    where.push(`${alias}.allotted_type LIKE $${i++}`);
  }

  // Strictly match MS or OMS — excludes NRI, Minority, J&K quota seats.
  if (toCandidatureGroup(profile.candidatureType) === "OMS") {
    where.push(`${alias}.allotted_quota = 'OMS'`);
  } else {
    where.push(`${alias}.allotted_quota = 'MS'`);
  }

  // Gender: male candidates compete only for non-female-designated seats.
  // Female candidates are eligible for both General and Female-designated seats.
  if (profile.gender === "male") {
    where.push(`${alias}.allotted_type NOT LIKE '%-Female%'`);
  }

  // Exclude demographic sub-allocations (PH / Orphan / Defence / NRI-converted)
  // which have abnormally low merit marks and distort the category cutoff.
  where.push(
    `${alias}.allotted_type NOT LIKE '%-PH%'` +
    ` AND ${alias}.allotted_type NOT LIKE '%-OrPHan%'` +
    ` AND ${alias}.allotted_type NOT LIKE '%-Defence%'` +
    ` AND ${alias}.allotted_type NOT LIKE '%(NRI%'`,
  );

  if (profile.divisionGender === "coed") {
    where.push(`${alias}.division_name ILIKE '%Co-Education%'`);
  } else if (profile.divisionGender === "women") {
    where.push(
      `(${alias}.division_name ILIKE '%Women%' OR ${alias}.division_name ILIKE '%Woman%')`,
    );
  }

  return { where, params, nextIndex: i };
}

/**
 * Query allotment_entries to derive admission cutoffs.
 * All CAP rounds (phases) are combined — GROUP BY omits phase so MIN(merit_marks)
 * captures the true floor across the entire admission season for a given year.
 *
 * cutoff_percentile  = MIN  — lowest admitted score (real floor)
 * competitive_percentile = PERCENTILE_CONT(0.25) — lower quartile of admitted class
 * top_percentile     = MAX  — highest admitted score
 * median_percentile  = PERCENTILE_CONT(0.5) — median of admitted class
 */
async function fetchAllotmentCutoffs(
  profile: CandidateProfile,
  years: readonly number[],
): Promise<ProfileCutoffRow[]> {
  const allotWhere = buildAllotmentWhere(profile, 3);
  const minCohortParam = allotWhere.nextIndex;

  const query = `
    SELECT
      ae.year,
      ae.college_id,
      MIN(ae.college_name)    AS college_name,
      ae.division_id,
      MIN(ae.division_name)   AS division_name,
      MIN(ae.university_name) AS university_name,
      MIN(ae.merit_marks::float)                                            AS cutoff_percentile,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ae.merit_marks::float)  AS competitive_percentile,
      MAX(ae.merit_marks::float)                                            AS top_percentile,
      PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY ae.merit_marks::float)  AS median_percentile,
      COUNT(*)::int                                                          AS waitlist_count
    FROM allotment_entries ae
    WHERE ae.course = $1::"Course"
      AND ae.year = ANY($2::int[])
      AND ae.merit_marks >= 0
      AND ae.merit_marks <= 100
      AND ${allotWhere.where.join("\n      AND ")}
    GROUP BY ae.year, ae.college_id, ae.division_id
    HAVING COUNT(*) >= $${minCohortParam}
  `;

  return prisma.$queryRawUnsafe<ProfileCutoffRow[]>(
    query,
    profile.course,
    years,
    ...allotWhere.params,
    MIN_COHORT_SIZE,
  );
}


export async function findEligibleColleges(
  profile: CandidateProfile,
): Promise<CollegeMatch[]> {
  const [rankList, allotRows] = await Promise.all([
    getMsOpenRankList(profile.course),
    fetchAllotmentCutoffs(profile, YEARS),
  ]);

  const profileByDivision = aggregateProfileByDivision(allotRows, profile.percentile);

  const emptyProfile = summarizeYears(YEARS.map((year) => emptyYearCutoff(year)));

  return rankList.map((row, index) => {
    const key = groupKey(row.college_id, row.division_id);
    const profileData = profileByDivision.get(key) ?? emptyProfile;

    return {
      collegeId: row.college_id,
      collegeName: shortCollegeName(row.college_name),
      divisionId: row.division_id,
      divisionName: row.division_name,
      universityName: row.university_name,
      years: profileData.years,
      chancePercent: profileData.chancePercent,
      matchLabel: profileData.matchLabel,
      trend: profileData.trend,
      avgMedian: profileData.avgMedian,
      bestMedian: profileData.bestMedian,
      msOpenRank: index + 1,
      msOpenCutoff: toNumber(row.ms_open_cutoff),
    };
  });
}

export async function getTopColleges(params: {
  course: CandidateProfile["course"];
  category: Category;
  candidatureGroup: CandidatureGroup;
  year?: number;
  limit?: number;
}): Promise<RankedCollege[]> {
  const limit = params.limit ?? 20;

  if (params.year) {
    const rows = await prisma.$queryRaw<CutoffRow[]>`
      SELECT *
      FROM college_cutoff_stats
      WHERE course = ${params.course}::"Course"
        AND category = ${params.category}
        AND candidature_group = ${params.candidatureGroup}
        AND year = ${params.year}
        AND waitlist_count >= ${MIN_COHORT_SIZE}
      ORDER BY median_percentile DESC, top_percentile DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      collegeId: row.college_id,
      collegeName: shortCollegeName(row.college_name),
      divisionId: row.division_id,
      divisionName: row.division_name,
      universityName: row.university_name,
      year: row.year,
      cutoff: toNumber(row.cutoff_percentile),
      median: toNumber(row.median_percentile),
      top: toNumber(row.top_percentile),
      waitlistCount: row.waitlist_count,
    }));
  }

  const rows = await prisma.$queryRaw<
    Array<{
      college_id: string;
      college_name: string;
      division_id: string;
      division_name: string;
      university_name: string;
      avg_median: Prisma.Decimal;
      avg_cutoff: Prisma.Decimal;
      max_top: Prisma.Decimal;
      total_waitlist: number;
      years_seen: number;
    }>
  >`
    SELECT
      college_id,
      MIN(college_name) AS college_name,
      division_id,
      MIN(division_name) AS division_name,
      MIN(university_name) AS university_name,
      AVG(median_percentile) AS avg_median,
      AVG(cutoff_percentile) AS avg_cutoff,
      MAX(top_percentile) AS max_top,
      SUM(waitlist_count)::int AS total_waitlist,
      COUNT(*)::int AS years_seen
    FROM college_cutoff_stats
    WHERE course = ${params.course}::"Course"
      AND category = ${params.category}
      AND candidature_group = ${params.candidatureGroup}
      AND waitlist_count >= ${MIN_COHORT_SIZE}
    GROUP BY college_id, division_id
    HAVING COUNT(*) >= 2
    ORDER BY avg_median DESC, max_top DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    collegeId: row.college_id,
    collegeName: shortCollegeName(row.college_name),
    divisionId: row.division_id,
    divisionName: row.division_name,
    universityName: row.university_name,
    year: 0,
    cutoff: toNumber(row.avg_cutoff),
    median: toNumber(row.avg_median),
    top: toNumber(row.max_top),
    waitlistCount: row.total_waitlist,
  }));
}

export async function refreshCutoffStats(): Promise<void> {
  const sqlPath = path.join(process.cwd(), "prisma/sql/create-cutoff-view.sql");
  const sql = readFileSync(sqlPath, "utf8");
  await prisma.$executeRawUnsafe(sql);
}

export async function cutoffStatsReady(): Promise<boolean> {
  const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_matviews
      WHERE matviewname = 'college_cutoff_stats'
    ) AS exists
  `;
  return result[0]?.exists ?? false;
}
