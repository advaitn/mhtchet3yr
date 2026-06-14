import "dotenv/config";

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "../src/lib/prisma";
import { refreshCutoffStats } from "../src/lib/merit-queries";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const BATCH_SIZE = 2_000;

type CsvRow = Record<string, string>;

type AllotmentInput = {
  course: "LLB_3" | "LLB_5";
  year: number;
  phase: string;
  universityId: string;
  universityName: string;
  collegeId: string;
  collegeName: string;
  divisionId: string;
  divisionName: string;
  eligibleCategory: string;
  allottedType: string;
  eligibleQuota: string;
  allottedQuota: string;
  meritMarks: Prisma.Decimal;
};

const DATASETS: Array<{ course: "LLB_3" | "LLB_5"; year: number; file: string }> = [
  { course: "LLB_3", year: 2023, file: "output/allotment_llb3_23.csv" },
  { course: "LLB_3", year: 2024, file: "output/allotment_llb3_24.csv" },
  { course: "LLB_3", year: 2025, file: "output/allotment_llb3_25.csv" },
  { course: "LLB_5", year: 2023, file: "output/allotment_llb5_23.csv" },
  { course: "LLB_5", year: 2024, file: "output/allotment_llb5_24.csv" },
  { course: "LLB_5", year: 2025, file: "output/allotment_llb5_25.csv" },
];

function mapRow(row: CsvRow): AllotmentInput | null {
  const m = Number.parseFloat(row.merit_marks);
  if (!Number.isFinite(m) || m <= 0 || m > 100) return null;

  const year = Number.parseInt(row.year, 10);
  const course = row.course === "5" || row.course === "LLB_5" ? "LLB_5" : "LLB_3";

  return {
    course,
    year: year < 100 ? 2000 + year : year,
    phase: row.phase,
    universityId: row.university_id,
    universityName: row.university_name,
    collegeId: row.college_id,
    collegeName: row.college_name,
    divisionId: row.division_id,
    divisionName: row.division_name,
    eligibleCategory: row.eligible_category,
    allottedType: row.allotted_type,
    eligibleQuota: row.eligible_quota,
    allottedQuota: row.allotted_quota,
    meritMarks: new Prisma.Decimal(row.merit_marks),
  };
}

async function readCsvRows(filePath: string): Promise<AllotmentInput[]> {
  return new Promise((resolve, reject) => {
    const rows: AllotmentInput[] = [];
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, relax_quotes: true }))
      .on("data", (row: CsvRow) => {
        const mapped = mapRow(row);
        if (mapped) rows.push(mapped);
      })
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

async function importFile(
  filePath: string,
  course: "LLB_3" | "LLB_5",
  year: number,
): Promise<number> {
  try {
    await stat(filePath);
  } catch {
    console.warn(`[skip] missing: ${filePath}`);
    return 0;
  }

  console.log(`\nImporting ${filePath}`);
  const rows = await readCsvRows(filePath);
  console.log(`  parsed ${rows.length.toLocaleString()} rows`);

  // delete existing allotments for this course+year
  const deleted = await prisma.allotmentEntry.deleteMany({ where: { course, year } });
  if (deleted.count > 0) console.log(`  deleted ${deleted.count} existing rows`);

  let imported = 0;
  let batch: AllotmentInput[] = [];

  for (const row of rows) {
    batch.push(row);
    if (batch.length >= BATCH_SIZE) {
      await prisma.allotmentEntry.createMany({ data: batch });
      imported += batch.length;
      batch = [];
      process.stdout.write(`  inserted ${imported.toLocaleString()}...\r`);
    }
  }

  if (batch.length > 0) {
    await prisma.allotmentEntry.createMany({ data: batch });
    imported += batch.length;
  }

  console.log(`  done: ${imported.toLocaleString()} rows`);
  return imported;
}

async function main(): Promise<void> {
  const slugArg = process.argv.find((a) => a.startsWith("--slug="));
  const slug = slugArg?.slice("--slug=".length);

  const datasets = slug
    ? DATASETS.filter((d) => `llb${d.course === "LLB_5" ? "5" : "3"}-${d.year}` === slug)
    : DATASETS;

  let total = 0;
  for (const d of datasets) {
    const filePath = path.join(REPO_ROOT, d.file);
    total += await importFile(filePath, d.course, d.year);
  }

  console.log(`\nImport complete: ${total.toLocaleString()} total rows.`);
  console.log("\nRefreshing cutoff stats...");
  await refreshCutoffStats();
  console.log("Done.");
}

main()
  .catch((e: unknown) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
