import type { CollegeMatch } from "@/types/merit";

function escapeCsv(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function collegeMatchesToCsv(matches: CollegeMatch[]): string {
  const headers = [
    "MS OPEN Rank",
    "MS OPEN Median %",
    "College",
    "Division",
    "University",
    "Match",
    "Chance %",
    "Trend",
    "Avg Pool Median %",
    "2023 Chance %",
    "2023 Pool Median %",
    "2023 Cohort Size",
    "2024 Chance %",
    "2024 Pool Median %",
    "2024 Cohort Size",
    "2025 Chance %",
    "2025 Pool Median %",
    "2025 Cohort Size",
  ];

  const rows = matches.map((match) => {
    const byYear = Object.fromEntries(match.years.map((y) => [y.year, y]));

    return [
      match.msOpenRank,
      match.msOpenMedian.toFixed(2),
      match.collegeName,
      match.divisionName,
      match.universityName,
      match.matchLabel,
      match.chancePercent,
      match.trend,
      match.avgMedian > 0 ? match.avgMedian.toFixed(2) : "",
      byYear[2023]?.hasData ? byYear[2023].yearProb : "",
      byYear[2023]?.hasData ? byYear[2023].median.toFixed(2) : "",
      byYear[2023]?.hasData ? byYear[2023].waitlistCount : "",
      byYear[2024]?.hasData ? byYear[2024].yearProb : "",
      byYear[2024]?.hasData ? byYear[2024].median.toFixed(2) : "",
      byYear[2024]?.hasData ? byYear[2024].waitlistCount : "",
      byYear[2025]?.hasData ? byYear[2025].yearProb : "",
      byYear[2025]?.hasData ? byYear[2025].median.toFixed(2) : "",
      byYear[2025]?.hasData ? byYear[2025].waitlistCount : "",
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell as string | number)).join(","))
    .join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function rankedCollegesToCsv(
  rows: Array<{
    collegeName: string;
    divisionName: string;
    universityName: string;
    year: number;
    cutoff: number;
    median: number;
    top: number;
    waitlistCount: number;
  }>,
): string {
  const headers = [
    "Rank",
    "College",
    "Division",
    "University",
    "Year",
    "Median %",
    "Cutoff %",
    "Top %",
    "Waitlist Count",
  ];

  const data = rows.map((row, index) => [
    index + 1,
    row.collegeName,
    row.divisionName,
    row.universityName,
    row.year || "3-yr avg",
    row.median.toFixed(2),
    row.cutoff.toFixed(2),
    row.top.toFixed(2),
    row.waitlistCount,
  ]);

  return [headers, ...data]
    .map((row) => row.map((cell) => escapeCsv(cell as string | number)).join(","))
    .join("\n");
}
