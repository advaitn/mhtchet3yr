"use client";

import { Loader2, Search, Info } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  ExportButton,
  StatCard,
} from "@/components/ui/data-table";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/page-shell";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  CANDIDATURE_OPTIONS,
  CATEGORIES,
  CATEGORY_LABELS,
} from "@/lib/constants";
import { collegeMatchesToCsv, downloadCsv } from "@/lib/export-csv";
import { cn } from "@/lib/utils";
import type { CollegeMatch } from "@/types/merit";
import type { Course } from "@/generated/prisma/client";

type FinderFormProps = {
  course: Course;
};

type SearchResponse = {
  count: number;
  matches: CollegeMatch[];
  error?: string;
};

export function FinderForm({ course }: FinderFormProps) {
  const [percentile, setPercentile] = useState("75");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("OPEN");
  const [candidatureGroup, setCandidatureGroup] = useState<"MS" | "OMS">("MS");
  const [differentlyAbled, setDifferentlyAbled] = useState(false);
  const [orphan, setOrphan] = useState(false);
  const [exServicemen, setExServicemen] = useState(false);
  const [matches, setMatches] = useState<CollegeMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const courseLabel = course === "LLB_5" ? "5Y" : "3Y";

  const sortedMatches = useMemo(() => {
    // Sort by average cutoff percentile (lowest first = safest colleges)
    return [...matches].sort((a, b) => {
      const avgCutoffA = a.years.reduce((sum, y) => sum + y.cutoff, 0) / a.years.length;
      const avgCutoffB = b.years.reduce((sum, y) => sum + y.cutoff, 0) / b.years.length;
      return avgCutoffA - avgCutoffB;
    });
  }, [matches]);

  const summary = useMemo(() => {
    if (!hasSearched) {
      return null;
    }

    return {
      allThree: matches.filter((match) => match.yearsQualified === 3).length,
      total: matches.length,
    };
  }, [hasSearched, matches]);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsedPercentile = Number.parseFloat(percentile);
    if (
      !Number.isFinite(parsedPercentile) ||
      parsedPercentile < 0 ||
      parsedPercentile > 100
    ) {
      setError("Enter a valid percentile between 0 and 100.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course,
          category,
          percentile: parsedPercentile,
          candidatureGroup,
          differentlyAbled,
          orphan,
          exServicemen,
        }),
      });

      const data = (await response.json()) as SearchResponse;

      if (!response.ok) {
        setError(data.error ?? "Search failed.");
        setMatches([]);
        setHasSearched(true);
        return;
      }

      setMatches(data.matches);
      setHasSearched(true);
    });
  }

  function handleExport() {
    if (matches.length === 0) return;
    downloadCsv(
      `eligible-colleges-${courseLabel}-${category}-${candidatureGroup}.csv`,
      collegeMatchesToCsv(matches),
    );
  }

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden bg-white/90">
        <CardHeader>
          <h2 className="text-lg font-semibold text-foreground">Search parameters</h2>
          <p className="text-sm text-muted-foreground">
            MS includes Maharashtra Type A–E seats. OMS is filtered separately.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="grid gap-6 md:grid-cols-2">
            <Field>
              <Label htmlFor="percentile">Your percentile</Label>
              <Input
                id="percentile"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={percentile}
                onChange={(event) => setPercentile(event.target.value)}
                required
              />
            </Field>

            <Field>
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as (typeof CATEGORIES)[number])
                }
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {CATEGORY_LABELS[item]} ({item})
                  </option>
                ))}
              </Select>
            </Field>

            <fieldset className="space-y-3 md:col-span-2">
              <legend className="text-sm font-medium text-stone-700">Candidature</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {CANDIDATURE_OPTIONS.map((option) => {
                  const active = candidatureGroup === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "cursor-pointer rounded-2xl border px-4 py-4 transition",
                        active
                          ? "border-primary bg-blue-50/70 shadow-sm"
                          : "border-border bg-stone-50/50 hover:border-stone-300",
                      )}
                    >
                      <input
                        type="radio"
                        name="candidatureGroup"
                        value={option.value}
                        checked={active}
                        onChange={() => setCandidatureGroup(option.value)}
                        className="sr-only"
                      />
                      <span className="block font-medium text-foreground">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {option.description}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-3 md:col-span-2">
              <legend className="text-sm font-medium text-stone-700">
                Additional filters
              </legend>
              <div className="flex flex-wrap gap-3">
                {[
                  {
                    id: "ph",
                    label: "Differently abled (PH)",
                    checked: differentlyAbled,
                    onChange: setDifferentlyAbled,
                  },
                  {
                    id: "orphan",
                    label: "Orphan",
                    checked: orphan,
                    onChange: setOrphan,
                  },
                  {
                    id: "ex",
                    label: "Ex-servicemen",
                    checked: exServicemen,
                    onChange: setExServicemen,
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                      item.checked
                        ? "border-primary bg-blue-50 text-primary"
                        : "border-border bg-white text-muted-foreground hover:border-stone-300",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(event) => item.onChange(event.target.checked)}
                      className="sr-only"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="md:col-span-2">
              <Button type="submit" disabled={isPending} size="lg">
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Find eligible colleges
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {summary ? (
        <section className="animate-fade-up space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total matches" value={summary.total.toLocaleString()} />
            <StatCard
              label="All 3 years"
              value={summary.allThree.toLocaleString()}
              hint="Consistent eligibility"
            />
            <StatCard
              label="Candidature"
              value={candidatureGroup}
              hint={candidatureGroup === "MS" ? "Maharashtra seats" : "Outside Maharashtra"}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Results</h2>
              <p className="text-sm text-muted-foreground">
                Ranked by qualification consistency and average median. Hover on percentages for details.
              </p>
            </div>
            <ExportButton onClick={handleExport} disabled={matches.length === 0} />
          </div>

          {matches.length === 0 ? (
            <Alert>
              No colleges found. Try a lower percentile or switch candidature type.
            </Alert>
          ) : (
            <DataTable>
              <DataTableHead>
                <tr>
                  <th className="px-4 py-3 w-12">Rank</th>
                  <th className="px-4 py-3">College & Division</th>
                  <th className="px-4 py-3">Your Chances</th>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {matches.map((match, index) => {
                  // Calculate overall chance: percentage of years where user qualifies
                  const chancePercent = Math.round(
                    (match.yearsQualified / match.years.length) * 100
                  );
                  
                  // Get the average cutoff across all years
                  const avgCutoff = match.years.reduce((sum, y) => sum + y.cutoff, 0) / match.years.length;

                  return (
                    <tr
                      key={`${match.collegeId}-${match.divisionId}`}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-4 py-4 font-bold text-primary text-lg">
                        #{index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">
                            {match.collegeName}
                          </p>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">
                              {match.divisionName}
                            </p>
                            <p className="text-xs font-medium text-primary/70">
                              {match.universityName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                "cursor-help inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-bold text-xl transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                chancePercent === 100
                                  ? "text-success"
                                  : chancePercent >= 50
                                    ? "text-warning"
                                    : "text-muted-foreground",
                              )}
                            >
                              {chancePercent}%
                              <Info className="h-4 w-4 opacity-50" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent>
                            <div className="space-y-3 w-72">
                              <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">
                                  Your percentile
                                </p>
                                <p className="text-lg font-bold text-foreground">
                                  {percentile}%
                                </p>
                              </div>
                              <div className="border-t border-border pt-3">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">
                                  Qualification consistency
                                </p>
                                <div className="mt-2 space-y-1">
                                  {match.years.map((year) => (
                                    <div key={year.year} className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">{year.year}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">
                                          {year.cutoff.toFixed(1)}%
                                        </span>
                                        <span className={cn(
                                          "text-xs px-2 py-0.5 rounded",
                                          year.qualifies
                                            ? "bg-green-100 text-green-800"
                                            : "bg-red-100 text-red-800"
                                        )}>
                                          {year.qualifies ? "✓ Qualify" : "✗ Below"}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <p className="mt-2 text-xs font-medium text-foreground">
                                  Overall: {match.yearsQualified}/{match.years.length} years
                                </p>
                              </div>
                              <div className="border-t border-border pt-3">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">
                                  Average cutoff
                                </p>
                                <p className="text-lg font-bold text-foreground">
                                  {avgCutoff.toFixed(1)}%
                                </p>
                              </div>
                              <div className="border-t border-border pt-3">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">
                                  Median percentiles
                                </p>
                                <p className="text-sm text-foreground">
                                  Average: <span className="font-bold">{match.avgMedian.toFixed(1)}%</span>
                                </p>
                                <p className="text-sm text-foreground">
                                  Best: <span className="font-bold">{match.bestMedian.toFixed(1)}%</span>
                                </p>
                              </div>
                              <div className="border-t border-border pt-3">
                                <p className="text-xs font-medium text-muted-foreground">
                                  {chancePercent === 100
                                    ? "✓ You qualify in all available years. Very safe option."
                                    : chancePercent >= 67
                                      ? "✓ You qualify in most years. Safe option."
                                      : chancePercent >= 34
                                        ? "◐ You qualify in some years. Moderate option."
                                        : "✗ You qualify in very few years. Risky option."}
                                </p>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                    </tr>
                  );
                })}
              </DataTableBody>
            </DataTable>
          )}
        </section>
      ) : null}
    </div>
  );
}
