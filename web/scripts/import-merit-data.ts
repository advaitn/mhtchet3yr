import "dotenv/config";

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

import { parse } from "csv-parse";
import { Prisma } from "@/generated/prisma/client";

import {
  MERIT_DATASETS,
  resolveDatasetPath,
  type MeritDatasetConfig,
} from "../src/lib/merit-datasets";
import { refreshCutoffStats } from "../src/lib/merit-queries";
import { sanitizeCandidateName } from "../src/lib/sanitize-name";
import { prisma } from "../src/lib/prisma";

const BATCH_SIZE = 2_000;

type CsvRow = Record<string, string>;

type MeritEntryInput = {
  universityId: string;
  universityName: string;
  collegeId: string;
  collegeName: string;
  divisionId: string;
  divisionName: string;
  meritNo: number;
  meritPercentile: Prisma.Decimal;
  applicationId: string;
  candidateName: string;
  candidatureType: string;
  category: string;
  eligibleInOpenCategory: string;
  differentlyAbledPh: string;
  orphan: string;
  exServicemen: string;
  exServicemenMeritNo: string | null;
  exServicemenPriority: string | null;
  minorityDetails: string | null;
};

function emptyToNull(value: string | undefined): string | null {
  if (!value || value === "--" || value === "-") {
    return null;
  }
  return value;
}

function mapRow(row: CsvRow): MeritEntryInput | null {
  const meritNo = Number.parseInt(row.merit_no, 10);
  const meritPercentile = Number.parseFloat(row.merit_percentile);

  if (!Number.isFinite(meritNo) || !Number.isFinite(meritPercentile)) {
    return null;
  }

  return {
    universityId: row.university_id,
    universityName: row.university_name,
    collegeId: row.college_id,
    collegeName: row.college_name,
    divisionId: row.division_id,
    divisionName: row.division_name,
    meritNo,
    meritPercentile: new Prisma.Decimal(row.merit_percentile),
    applicationId: row.application_id,
    candidateName: sanitizeCandidateName(row.candidate_name),
    candidatureType: row.candidature_type,
    category: row.category,
    eligibleInOpenCategory: row.eligible_in_open_category,
    differentlyAbledPh: row.differently_abled_ph,
    orphan: row.orphan,
    exServicemen: row.ex_servicemen,
    exServicemenMeritNo: emptyToNull(row.ex_servicemen_merit_no),
    exServicemenPriority: emptyToNull(row.ex_servicemen_priority),
    minorityDetails: emptyToNull(row.minority_details),
  };
}

async function readCsvRows(filePath: string): Promise<MeritEntryInput[]> {
  return new Promise((resolve, reject) => {
    const rows: MeritEntryInput[] = [];

    createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_quotes: true,
        }),
      )
      .on("data", (row: CsvRow) => {
        const mapped = mapRow(row);
        if (mapped) {
          rows.push(mapped);
        }
      })
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

async function flushBatch(cycleId: string, batch: MeritEntryInput[]): Promise<void> {
  if (batch.length === 0) {
    return;
  }

  await prisma.meritEntry.createMany({
    data: batch.map((entry) => ({ ...entry, cycleId })),
  });
}

async function importDataset(dataset: MeritDatasetConfig): Promise<number> {
  const filePath = resolveDatasetPath(dataset.relativeFile);

  try {
    await stat(filePath);
  } catch {
    console.warn(`[skip] missing file: ${filePath}`);
    return 0;
  }

  console.log(`\nImporting ${dataset.slug} from ${filePath}`);
  const rows = await readCsvRows(filePath);
  console.log(`  parsed ${rows.length.toLocaleString()} rows`);

  const cycle = await prisma.admissionCycle.upsert({
    where: { slug: dataset.slug },
    create: {
      course: dataset.course,
      year: dataset.year,
      slug: dataset.slug,
      sourceFile: dataset.relativeFile,
    },
    update: {
      sourceFile: dataset.relativeFile,
    },
  });

  await prisma.meritEntry.deleteMany({ where: { cycleId: cycle.id } });

  let imported = 0;
  let batch: MeritEntryInput[] = [];

  for (const row of rows) {
    batch.push(row);

    if (batch.length >= BATCH_SIZE) {
      await flushBatch(cycle.id, batch);
      imported += batch.length;
      batch = [];
      process.stdout.write(`  inserted ${imported.toLocaleString()}...\r`);
    }
  }

  await flushBatch(cycle.id, batch);
  imported += batch.length;

  await prisma.admissionCycle.update({
    where: { id: cycle.id },
    data: {
      rowCount: imported,
      importedAt: new Date(),
    },
  });

  console.log(`  done: ${imported.toLocaleString()} rows for ${dataset.slug}`);
  return imported;
}

async function main(): Promise<void> {
  const slugArg = process.argv.find((arg) => arg.startsWith("--slug="));
  const slug = slugArg?.slice("--slug=".length);

  const datasets = slug
    ? MERIT_DATASETS.filter((dataset) => dataset.slug === slug)
    : MERIT_DATASETS;

  if (datasets.length === 0) {
    throw new Error(
      slug
        ? `Unknown slug "${slug}". Available: ${MERIT_DATASETS.map((d) => d.slug).join(", ")}`
        : "No datasets configured.",
    );
  }

  let total = 0;
  for (const dataset of datasets) {
    total += await importDataset(dataset);
  }

  console.log(`\nImport complete: ${total.toLocaleString()} total rows.`);
  console.log("\nRefreshing cutoff stats materialized view...");
  await refreshCutoffStats();
  console.log("Cutoff stats refreshed.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
