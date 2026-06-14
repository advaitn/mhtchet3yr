import { readFileSync } from "node:fs";
import path from "node:path";

import { Prisma } from "@/generated/prisma/client";
import { MIN_COHORT_SIZE } from "@/lib/candidate-profile";
import { toCandidatureGroup, type CandidatureGroup } from "@/lib/candidature";
import type { Category } from "@/lib/constants";
import { YEARS } from "@/lib/constants";
import { buildProfileSql } from "@/lib/profile-sql";
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
  /** cume_dist: fraction of cohort with merit_percentile <= user's percentile (0–1). */
  year_prob: Prisma.Decimal;
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
 * Calibrate the raw cume_dist value into an admission probability.
 *
 * The waitlist is the full applicant pool, not just admitted students.
 * Typically the top ~25% of each college's pool get seats, meaning
 * a cume_dist of 0.75 is the 50/50 boundary.
 * We use a linear mapping centered at 0.75 with ±0.15 spread:
 *   0.60 → 0%   (clearly below cutoff zone)
 *   0.75 → 50%  (right at the margin)
 *   0.90 → 100% (solidly in the top tier)
 */
export function calibrateYearProb(rawCumeDist: number): number {
  const CUTOFF = 0.75;
  const SPREAD = 0.15;
  const calibrated = 0.5 + (rawCumeDist - CUTOFF) / (2 * SPREAD);
  return Math.round(Math.min(1, Math.max(0, calibrated)) * 100);
}

export function toMatchLabel(chancePercent: number): MatchLabel {
  if (chancePercent >= 85) return "safe";
  if (chancePercent >= 65) return "good";
  if (chancePercent >= 45) return "borderline";
  if (chancePercent >= 20) return "reach";
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

function buildYearCutoff(row: ProfileCutoffRow): YearCutoff {
  return {
    year: row.year,
    yearProb: calibrateYearProb(toNumber(row.year_prob)),
    median: toNumber(row.median_percentile),
    top: toNumber(row.top_percentile),
    waitlistCount: row.waitlist_count,
    hasData: true,
  };
}

function emptyYearCutoff(year: number): YearCutoff {
  return {
    year,
    yearProb: null,
    median: 0,
    top: 0,
    waitlistCount: 0,
    hasData: false,
  };
}

function mergeCutoffRows(...sources: ProfileCutoffRow[][]): ProfileCutoffRow[] {
  const byKey = new Map<string, ProfileCutoffRow>();

  for (const rows of sources) {
    for (const row of rows) {
      const key = `${row.year}|${row.college_id}|${row.division_id}`;
      if (!byKey.has(key)) {
        byKey.set(key, row);
      }
    }
  }

  return [...byKey.values()];
}

function buildArbitratedYears(rows: ProfileCutoffRow[]): YearCutoff[] {
  const byYear = new Map(rows.map((row) => [row.year, buildYearCutoff(row)]));
  return YEARS.map((year) => byYear.get(year) ?? emptyYearCutoff(year));
}

function summarizeYears(years: YearCutoff[]): Pick<
  CollegeMatch,
  "years" | "chancePercent" | "matchLabel" | "trend" | "avgMedian" | "bestMedian"
> {
  const yearsWithData = years.filter((y) => y.hasData && y.yearProb !== null);
  const medians = yearsWithData.map((y) => y.median);

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
      medians.length > 0 ? medians.reduce((sum, v) => sum + v, 0) / medians.length : 0,
    bestMedian: medians.length > 0 ? Math.max(...medians) : 0,
  };
}

type MsOpenRankRow = {
  college_id: string;
  college_name: string;
  division_id: string;
  division_name: string;
  university_name: string;
  ms_open_median: Prisma.Decimal;
};

async function getMsOpenRankList(course: CandidateProfile["course"]): Promise<MsOpenRankRow[]> {
  return prisma.$queryRaw<MsOpenRankRow[]>`
    SELECT
      college_id,
      MIN(college_name) AS college_name,
      division_id,
      MIN(division_name) AS division_name,
      MIN(university_name) AS university_name,
      AVG(median_percentile) AS ms_open_median
    FROM college_cutoff_stats
    WHERE course = ${course}::"Course"
      AND category = 'OPEN'
      AND candidature_group = 'MS'
      AND waitlist_count >= ${MIN_COHORT_SIZE}
    GROUP BY college_id, division_id
    ORDER BY ms_open_median DESC, MIN(college_name) ASC
  `;
}

function aggregateProfileByDivision(
  rows: ProfileCutoffRow[],
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
    result.set(key, summarizeYears(buildArbitratedYears(divisionRows)));
  }

  return result;
}

async function fetchProfileCutoffs(
  profile: CandidateProfile,
  options: {
    years?: readonly number[];
    includeDemographics?: boolean;
  } = {},
): Promise<ProfileCutoffRow[]> {
  const years = options.years ?? YEARS;
  const profileSql = buildProfileSql(profile, 3, "me", {
    includeDemographics: options.includeDemographics ?? true,
  });
  const yearFilterIndex = profileSql.params.length + 3;
  const minCohortParam = profileSql.params.length + 4;

  // $1 = course, $2 = user percentile (for cume_dist), $3..N = profile filters
  const query = `
    SELECT
      ac.year,
      me.college_id,
      me.college_name,
      me.division_id,
      me.division_name,
      me.university_name,
      COUNT(*) FILTER (WHERE me.merit_percentile <= $2::float)::float / COUNT(*) AS year_prob,
      MAX(me.merit_percentile) AS top_percentile,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY me.merit_percentile) AS median_percentile,
      COUNT(*)::int AS waitlist_count
    FROM merit_entries me
    INNER JOIN admission_cycles ac ON ac.id = me.cycle_id
    WHERE ac.course = $1::"Course"
      AND ac.year = ANY($${yearFilterIndex}::int[])
      AND ${profileSql.where.join("\n      AND ")}
    GROUP BY
      ac.year,
      me.college_id,
      me.college_name,
      me.division_id,
      me.division_name,
      me.university_name
    HAVING COUNT(*) >= $${minCohortParam}
  `;

  return prisma.$queryRawUnsafe<ProfileCutoffRow[]>(
    query,
    profile.course,
    profile.percentile,
    ...profileSql.params,
    years,
    MIN_COHORT_SIZE,
  );
}

export async function findEligibleColleges(
  profile: CandidateProfile,
): Promise<CollegeMatch[]> {
  const legacyYears = YEARS.filter((year) => year < 2025);
  const strictYears = [2025] as const;

  const [rankList, strictRows, relaxedRows] = await Promise.all([
    getMsOpenRankList(profile.course),
    fetchProfileCutoffs(profile, { years: strictYears, includeDemographics: true }),
    fetchProfileCutoffs(profile, { years: legacyYears, includeDemographics: false }),
  ]);

  const mergedRows = mergeCutoffRows(strictRows, relaxedRows);
  const profileByDivision = aggregateProfileByDivision(mergedRows);

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
      msOpenMedian: toNumber(row.ms_open_median),
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
