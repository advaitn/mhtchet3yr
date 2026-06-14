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
 * Estimate admission chance from where the user's percentile sits in the
 * waitlist's competitive band. The full waitlist median (~60–70%) reflects
 * all applicants, not admitted students — so we anchor on p75 (seat line),
 * p95 (strong), and max (ceiling) instead of score-distribution cume_dist.
 */
export function computeChanceFromCutoffs(
  userPercentile: number,
  cutoffP75: number,
  competitiveP95: number,
  top: number,
): number {
  if (top <= cutoffP75) {
    if (userPercentile >= top) return 90;
    if (userPercentile >= cutoffP75) return 50;
    return 10;
  }

  if (userPercentile >= top) return 95;

  if (userPercentile >= competitiveP95) {
    const span = Math.max(top - competitiveP95, 0.01);
    const t = (userPercentile - competitiveP95) / span;
    return Math.round(75 + t * 20);
  }

  if (userPercentile >= cutoffP75) {
    const span = Math.max(competitiveP95 - cutoffP75, 0.01);
    const t = (userPercentile - cutoffP75) / span;
    return Math.round(40 + t * 35);
  }

  const floor = Math.max(0, cutoffP75 - 20);
  if (userPercentile <= floor) return 5;

  const span = Math.max(cutoffP75 - floor, 0.01);
  const t = (userPercentile - floor) / span;
  return Math.round(5 + t * 35);
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

async function fetchProfileCutoffs(
  profile: CandidateProfile,
  options: {
    years?: readonly number[];
    includeDemographics?: boolean;
  } = {},
): Promise<ProfileCutoffRow[]> {
  const years = options.years ?? YEARS;
  const profileSql = buildProfileSql(profile, 2, "me", {
    includeDemographics: options.includeDemographics ?? true,
  });
  const yearFilterIndex = profileSql.params.length + 2;
  const minCohortParam = profileSql.params.length + 3;

  const query = `
    SELECT
      ac.year,
      me.college_id,
      me.college_name,
      me.division_id,
      me.division_name,
      me.university_name,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY me.merit_percentile) AS cutoff_percentile,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY me.merit_percentile) AS competitive_percentile,
      MAX(me.merit_percentile) AS top_percentile,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY me.merit_percentile) AS median_percentile,
      COUNT(*)::int AS waitlist_count
    FROM merit_entries me
    INNER JOIN admission_cycles ac ON ac.id = me.cycle_id
    WHERE ac.course = $1::"Course"
      AND ac.year = ANY($${yearFilterIndex}::int[])
      AND me.merit_percentile >= 0
      AND me.merit_percentile <= 100
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
  const profileByDivision = aggregateProfileByDivision(mergedRows, profile.percentile);

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
