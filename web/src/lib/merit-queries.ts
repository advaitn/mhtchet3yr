import { readFileSync } from "node:fs";
import path from "node:path";

import { Prisma } from "@/generated/prisma/client";
import { candidatureSqlCondition } from "@/lib/candidature";
import type { Category } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type {
  CollegeMatch,
  FinderFilters,
  RankedCollege,
  YearCutoff,
} from "@/types/merit";

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

type LiveCutoffRow = {
  year: number;
  college_id: string;
  college_name: string;
  division_id: string;
  division_name: string;
  university_name: string;
  cutoff_percentile: Prisma.Decimal;
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

function groupKey(row: {
  collegeId: string;
  divisionId: string;
}): string {
  return `${row.collegeId}|${row.divisionId}`;
}

function buildYearCutoff(
  row: {
    year: number;
    cutoff_percentile: Prisma.Decimal;
    median_percentile: Prisma.Decimal;
    top_percentile: Prisma.Decimal;
    waitlist_count: number;
  },
  userPercentile: number,
): YearCutoff {
  const cutoff = toNumber(row.cutoff_percentile);
  return {
    year: row.year,
    cutoff,
    median: toNumber(row.median_percentile),
    top: toNumber(row.top_percentile),
    waitlistCount: row.waitlist_count,
    qualifies: userPercentile >= cutoff,
  };
}

function aggregateMatches(
  rows: Array<
    LiveCutoffRow & {
      college_id: string;
      college_name: string;
      division_id: string;
      division_name: string;
      university_name: string;
    }
  >,
  userPercentile: number,
  msOpenRanks?: Map<string, number>,
): CollegeMatch[] {
  const grouped = new Map<string, CollegeMatch>();

  for (const row of rows) {
    const key = groupKey({ collegeId: row.college_id, divisionId: row.division_id });
    const yearData = buildYearCutoff(row, userPercentile);

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        collegeId: row.college_id,
        collegeName: shortCollegeName(row.college_name),
        divisionId: row.division_id,
        divisionName: row.division_name,
        universityName: row.university_name,
        years: [yearData],
        yearsQualified: yearData.qualifies ? 1 : 0,
        avgMedian: yearData.median,
        bestMedian: yearData.median,
        msOpenRank: msOpenRanks?.get(key) ?? 999999,
      });
      continue;
    }

    existing.years.push(yearData);
    if (yearData.qualifies) {
      existing.yearsQualified += 1;
    }
  }

  for (const match of grouped.values()) {
    match.years.sort((a, b) => a.year - b.year);
    const medians = match.years.map((year) => year.median);
    match.avgMedian =
      medians.reduce((sum, value) => sum + value, 0) / medians.length;
    match.bestMedian = Math.max(...medians);
  }

  return [...grouped.values()].sort((a, b) => a.msOpenRank - b.msOpenRank);
}

function hasSpecialFilters(filters: FinderFilters): boolean {
  return Boolean(
    filters.differentlyAbled || filters.orphan || filters.exServicemen,
  );
}

async function findFromMaterializedView(
  filters: FinderFilters,
): Promise<CollegeMatch[]> {
  // Fetch MS OPEN rankings (for fixed ranking across all configurations)
  const msOpenRawRows = await prisma.$queryRaw<Array<{ college_id: string; division_id: string }>>`
    SELECT DISTINCT college_id, division_id
    FROM college_cutoff_stats
    WHERE course = ${filters.course}::"Course"
      AND category = 'OPEN'
      AND candidature_group = 'MS'
    ORDER BY median_percentile DESC, college_name ASC
  `;

  const msOpenRanks = new Map<string, number>();
  msOpenRawRows.forEach((row, index) => {
    msOpenRanks.set(groupKey({ collegeId: row.college_id, divisionId: row.division_id }), index + 1);
  });

  const rows = await prisma.$queryRaw<CutoffRow[]>`
    SELECT *
    FROM college_cutoff_stats
    WHERE course = ${filters.course}::"Course"
      AND category = ${filters.category}
      AND candidature_group = ${filters.candidatureGroup}
      AND cutoff_percentile <= ${filters.percentile}
    ORDER BY median_percentile DESC, college_name ASC
  `;

  return aggregateMatches(
    rows.map((row) => ({
      year: row.year,
      college_id: row.college_id,
      college_name: row.college_name,
      division_id: row.division_id,
      division_name: row.division_name,
      university_name: row.university_name,
      cutoff_percentile: row.cutoff_percentile,
      top_percentile: row.top_percentile,
      median_percentile: row.median_percentile,
      waitlist_count: row.waitlist_count,
    })),
    filters.percentile,
    msOpenRanks,
  );
}

async function findFromLiveAggregation(
  filters: FinderFilters,
): Promise<CollegeMatch[]> {
  // Fetch MS OPEN rankings for the reference ordering
  const msOpenRows = await prisma.$queryRaw<Array<{ college_id: string; division_id: string }>>`
    SELECT DISTINCT college_id, division_id
    FROM college_cutoff_stats
    WHERE course = ${filters.course}::"Course"
      AND category = 'OPEN'
      AND candidature_group = 'MS'
    ORDER BY median_percentile DESC, college_name ASC
  `;

  const msOpenRanks = new Map<string, number>();
  msOpenRows.forEach((row, index) => {
    msOpenRanks.set(groupKey({ collegeId: row.college_id, divisionId: row.division_id }), index + 1);
  });

  const candidatureCondition = candidatureSqlCondition(filters.candidatureGroup);
  const specialConditions: string[] = [];

  if (filters.differentlyAbled) {
    specialConditions.push("me.differently_abled_ph = 'Yes'");
  }
  if (filters.orphan) {
    specialConditions.push("me.orphan = 'Yes'");
  }
  if (filters.exServicemen) {
    specialConditions.push("me.ex_servicemen = 'Yes'");
  }

  const specialSql =
    specialConditions.length > 0 ? `AND ${specialConditions.join(" AND ")}` : "";

  const query = `
    SELECT
      ac.year,
      me.college_id,
      me.college_name,
      me.division_id,
      me.division_name,
      me.university_name,
      MIN(me.merit_percentile) AS cutoff_percentile,
      MAX(me.merit_percentile) AS top_percentile,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY me.merit_percentile) AS median_percentile,
      COUNT(*)::int AS waitlist_count
    FROM merit_entries me
    INNER JOIN admission_cycles ac ON ac.id = me.cycle_id
    WHERE ac.course = $1::"Course"
      AND me.category = $2
      AND ${candidatureCondition}
      ${specialSql}
    GROUP BY
      ac.year,
      me.college_id,
      me.college_name,
      me.division_id,
      me.division_name,
      me.university_name
    HAVING MIN(me.merit_percentile) <= $3
    ORDER BY median_percentile DESC, me.college_name ASC
  `;

  const rows = await prisma.$queryRawUnsafe<LiveCutoffRow[]>(
    query,
    filters.course,
    filters.category,
    filters.percentile,
  );

  return aggregateMatches(rows, filters.percentile, msOpenRanks);
}

export async function findEligibleColleges(
  filters: FinderFilters,
): Promise<CollegeMatch[]> {
  if (hasSpecialFilters(filters)) {
    return findFromLiveAggregation(filters);
  }
  return findFromMaterializedView(filters);
}

export async function getTopColleges(params: {
  course: FinderFilters["course"];
  category: Category;
  candidatureGroup: FinderFilters["candidatureGroup"];
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
        AND waitlist_count >= 3
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
      college_name,
      division_id,
      division_name,
      university_name,
      AVG(median_percentile) AS avg_median,
      AVG(cutoff_percentile) AS avg_cutoff,
      MAX(top_percentile) AS max_top,
      SUM(waitlist_count)::int AS total_waitlist,
      COUNT(*)::int AS years_seen
    FROM college_cutoff_stats
    WHERE course = ${params.course}::"Course"
      AND category = ${params.category}
      AND candidature_group = ${params.candidatureGroup}
      AND waitlist_count >= 3
    GROUP BY college_id, college_name, division_id, division_name, university_name
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
