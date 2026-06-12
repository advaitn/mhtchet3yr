"use client";

import { rankedCollegesToCsv, downloadCsv } from "@/lib/export-csv";
import type { RankedCollege } from "@/types/merit";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  ExportButton,
} from "@/components/ui/data-table";

type RankingsTableProps = {
  rows: RankedCollege[];
  title: string;
  exportFilename: string;
  showYear?: boolean;
};

export function RankingsTable({
  rows,
  title,
  exportFilename,
  showYear = true,
}: RankingsTableProps) {
  function handleExport() {
    downloadCsv(exportFilename, rankedCollegesToCsv(rows));
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Ranked by median waitlist percentile — higher means more competitive.
          </p>
        </div>
        <ExportButton onClick={handleExport} disabled={rows.length === 0} />
      </div>

      <DataTable>
        <DataTableHead>
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">College</th>
            <th className="px-4 py-3">Division</th>
            {showYear ? <th className="px-4 py-3">Year</th> : null}
            <th className="px-4 py-3">Median</th>
            <th className="px-4 py-3">Cutoff</th>
            <th className="px-4 py-3">Top</th>
            <th className="px-4 py-3">Waitlist</th>
          </tr>
        </DataTableHead>
        <DataTableBody>
          {rows.map((row, index) => (
            <tr
              key={`${row.collegeId}-${row.divisionId}-${row.year}-${index}`}
              className="transition hover:bg-stone-50/80"
            >
              <td className="px-4 py-4 font-medium text-muted-foreground">
                {index + 1}
              </td>
              <td className="px-4 py-4 font-medium text-foreground">
                {row.collegeName}
              </td>
              <td className="max-w-sm px-4 py-4 text-muted-foreground">
                {row.divisionName}
              </td>
              {showYear ? (
                <td className="px-4 py-4 text-muted-foreground">
                  {row.year > 0 ? row.year : "3-yr avg"}
                </td>
              ) : null}
              <td className="px-4 py-4 font-semibold text-foreground">
                {row.median.toFixed(1)}%
              </td>
              <td className="px-4 py-4 text-muted-foreground">
                {row.cutoff.toFixed(1)}%
              </td>
              <td className="px-4 py-4 text-muted-foreground">{row.top.toFixed(1)}%</td>
              <td className="px-4 py-4 text-muted-foreground">{row.waitlistCount}</td>
            </tr>
          ))}
        </DataTableBody>
      </DataTable>
    </section>
  );
}
