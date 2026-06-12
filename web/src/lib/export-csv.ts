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
    "College",
    "Division",
    "University",
    "Years Qualified",
    "Avg Median %",
    "2023 Cutoff %",
    "2023 Median %",
    "2023 Qualifies",
    "2024 Cutoff %",
    "2024 Median %",
    "2024 Qualifies",
    "2025 Cutoff %",
    "2025 Median %",
    "2025 Qualifies",
  ];

  const rows = matches.map((match) => {
    const byYear = Object.fromEntries(match.years.map((year) => [year.year, year]));

    return [
      match.collegeName,
      match.divisionName,
      match.universityName,
      match.yearsQualified,
      match.avgMedian.toFixed(2),
      byYear[2023]?.cutoff.toFixed(2) ?? "",
      byYear[2023]?.median.toFixed(2) ?? "",
      byYear[2023]?.qualifies ? "Yes" : "No",
      byYear[2024]?.cutoff.toFixed(2) ?? "",
      byYear[2024]?.median.toFixed(2) ?? "",
      byYear[2024]?.qualifies ? "Yes" : "No",
      byYear[2025]?.cutoff.toFixed(2) ?? "",
      byYear[2025]?.median.toFixed(2) ?? "",
      byYear[2025]?.qualifies ? "Yes" : "No",
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
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
    .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
    .join("\n");
}
