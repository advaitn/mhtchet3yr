"use client";

import { Loader2, Search, Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  CANDIDATURE_TYPES,
  DIVISION_GENDER_OPTIONS,
  GENDER_OPTIONS,
  MINORITY_OPTIONS,
  YES_NO,
} from "@/lib/candidate-profile";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants";
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

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended (rank + chances)" },
  { value: "rank", label: "MS OPEN rank" },
  { value: "chance-desc", label: "Best chances first" },
  { value: "chance-asc", label: "Hardest first" },
  { value: "ms-median-desc", label: "MS OPEN cutoff (high → low)" },
  { value: "name", label: "College name (A–Z)" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["value"];

/**
 * Composite score balancing college prestige (MS OPEN rank) and personal match chance.
 * prestige: rank #1 = 100, rank #N = 0 (normalized inverted rank)
 * score = average(chancePercent, prestige)
 * Naturally surfaces colleges where you have a real shot AND they're well-ranked.
 */
function recommendedScore(match: CollegeMatch, total: number): number {
  const prestige = (1 - (match.msOpenRank - 1) / Math.max(total - 1, 1)) * 100;
  return (match.chancePercent + prestige) / 2;
}

function sortMatches(matches: CollegeMatch[], sortBy: SortOption): CollegeMatch[] {
  const sorted = [...matches];
  const total = matches.length;

  switch (sortBy) {
    case "recommended":
      return sorted.sort(
        (a, b) => recommendedScore(b, total) - recommendedScore(a, total),
      );
    case "chance-desc":
      return sorted.sort(
        (a, b) => b.chancePercent - a.chancePercent || a.msOpenRank - b.msOpenRank,
      );
    case "chance-asc":
      return sorted.sort(
        (a, b) => a.chancePercent - b.chancePercent || a.msOpenRank - b.msOpenRank,
      );
    case "ms-median-desc":
      return sorted.sort(
        (a, b) => b.msOpenCutoff - a.msOpenCutoff || a.msOpenRank - b.msOpenRank,
      );
    case "name":
      return sorted.sort(
        (a, b) =>
          a.collegeName.localeCompare(b.collegeName) ||
          a.divisionName.localeCompare(b.divisionName),
      );
    case "rank":
    default:
      return sorted.sort((a, b) => a.msOpenRank - b.msOpenRank);
  }
}

const LABEL_CONFIG = {
  safe: { label: "Safe", className: "bg-green-50 text-green-700 border-green-200" },
  good: { label: "Good", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  borderline: { label: "Borderline", className: "bg-amber-50 text-amber-700 border-amber-200" },
  reach: { label: "Reach", className: "bg-orange-50 text-orange-700 border-orange-200" },
  unlikely: { label: "Unlikely", className: "bg-red-50 text-red-600 border-red-200" },
  unknown: { label: "No data", className: "bg-stone-50 text-stone-400 border-stone-200" },
} as const;

function ChancesPopover({ match }: { match: CollegeMatch }) {
  const labelCfg = LABEL_CONFIG[match.matchLabel];
  const hasAnyData = match.years.some((y) => y.hasData);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition hover:opacity-80 sm:gap-2 sm:px-3"
        >
          <span
            className={cn(
              "inline-block rounded-md border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide sm:text-xs",
              labelCfg.className,
            )}
          >
            {labelCfg.label}
          </span>
          {hasAnyData && (
            <span className="text-sm font-bold text-foreground sm:text-base">
              {match.chancePercent}%
            </span>
          )}
          {match.trend === "improving" && (
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-green-600" />
          )}
          {match.trend === "declining" && (
            <TrendingDown className="h-3.5 w-3.5 shrink-0 text-red-500" />
          )}
          {match.trend === "stable" && (
            <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(18rem,calc(100vw-2rem))] p-0">
        {!hasAnyData ? (
          <p className="p-4 text-sm text-muted-foreground">
            No waitlist data matches your profile at this college.
          </p>
        ) : (
          <div className="text-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Match score
                </p>
                <p className="text-3xl font-bold leading-tight">{match.chancePercent}%</p>
              </div>
              <span
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-bold uppercase tracking-wide",
                  labelCfg.className,
                )}
              >
                {labelCfg.label}
              </span>
            </div>

            <div className="px-4 py-2">
              {match.years.map((year) => (
                <div key={year.year} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="shrink-0 text-muted-foreground">{year.year}</span>
                  {!year.hasData ? (
                    <span className="text-xs text-muted-foreground/50">no data</span>
                  ) : (
                    <span className="min-w-0 text-right">
                      <span className="font-semibold">{year.yearProb}%</span>
                                          <span className="ml-2 text-xs text-muted-foreground">
                                            n={year.waitlistCount} · cutoff {year.cutoff.toFixed(1)}%
                                          </span>
                    </span>
                  )}
                </div>
              ))}
            </div>

            {match.trend !== "unknown" && (
              <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                Trend:{" "}
                <span
                  className={cn(
                    "font-medium",
                    match.trend === "improving"
                      ? "text-green-600"
                      : match.trend === "declining"
                        ? "text-red-500"
                        : "text-foreground",
                  )}
                >
                  {match.trend === "improving"
                    ? "getting easier ↑"
                    : match.trend === "declining"
                      ? "getting harder ↓"
                      : "stable →"}
                </span>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function MatchCard({ match }: { match: CollegeMatch }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-bold text-primary">#{match.msOpenRank}</p>
        <ChancesPopover match={match} />
      </div>
      <div className="mt-3 min-w-0 space-y-1">
        <p className="break-words font-semibold text-foreground">{match.collegeName}</p>
        <p className="break-words text-xs text-muted-foreground">{match.divisionName}</p>
        <p className="break-words text-xs text-primary/70">{match.universityName}</p>
        <p className="text-xs text-muted-foreground">
          MS OPEN cutoff ~{match.msOpenCutoff.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

export function FinderForm({ course }: FinderFormProps) {
  const [percentile, setPercentile] = useState("75");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("OPEN");
  const [candidatureType, setCandidatureType] =
    useState<(typeof CANDIDATURE_TYPES)[number]>("Maharashtra - Type A");
  const [differentlyAbled, setDifferentlyAbled] = useState<(typeof YES_NO)[number]>("No");
  const [orphan, setOrphan] = useState<(typeof YES_NO)[number]>("No");
  const [exServicemen, setExServicemen] = useState<(typeof YES_NO)[number]>("No");
  const [gender, setGender] = useState<(typeof GENDER_OPTIONS)[number]["value"]>("male");
  const [divisionGender, setDivisionGender] =
    useState<(typeof DIVISION_GENDER_OPTIONS)[number]["value"]>("any");
  const [minority, setMinority] =
    useState<(typeof MINORITY_OPTIONS)[number]["value"]>("none");
  const [matches, setMatches] = useState<CollegeMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [isPending, startTransition] = useTransition();

  const courseLabel = course === "LLB_5" ? "5Y" : "3Y";

  const sortedMatches = useMemo(
    () => sortMatches(matches, sortBy),
    [matches, sortBy],
  );

  const summary = useMemo(() => {
    if (!hasSearched) return null;
    return {
      safe: matches.filter((m) => m.matchLabel === "safe" || m.matchLabel === "good").length,
      borderline: matches.filter((m) => m.matchLabel === "borderline").length,
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
          gender,
          candidatureType,
          differentlyAbled,
          orphan,
          exServicemen,
          divisionGender,
          minority,
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
    if (sortedMatches.length === 0) return;
    downloadCsv(
      `eligible-colleges-${courseLabel}-${category}.csv`,
      collegeMatchesToCsv(sortedMatches),
    );
  }

  return (
    <div className="min-w-0 space-y-8">
      <Card className="overflow-hidden bg-white/90">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-6">

            {/* Row 1: Score + Category */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label htmlFor="percentile">Your MHT-CET percentile</Label>
                <div className="relative">
                  <Input
                    id="percentile"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={percentile}
                    onChange={(event) => setPercentile(event.target.value)}
                    className="pr-12 text-lg font-semibold"
                    required
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
                    %
                  </span>
                </div>
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
                      {CATEGORY_LABELS[item]} — {item}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Candidature type — pill row */}
            <Field>
              <Label>Candidature type</Label>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {CANDIDATURE_TYPES.map((item) => {
                  const short = item
                    .replace("Maharashtra - ", "")
                    .replace(" Migrant", "");
                  const active = candidatureType === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCandidatureType(item)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                        active
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Gender + Division + Minority */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <Label>Gender</Label>
                <div className="flex gap-2 pt-0.5">
                  {GENDER_OPTIONS.map((item) => {
                    const active = gender === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setGender(item.value)}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition",
                          active
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field>
                <Label>Division</Label>
                <div className="flex gap-2 pt-0.5">
                  {DIVISION_GENDER_OPTIONS.map((item) => {
                    const active = divisionGender === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setDivisionGender(item.value)}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition",
                          active
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field>
                <Label htmlFor="minority">Minority status</Label>
                <Select
                  id="minority"
                  value={minority}
                  onChange={(event) =>
                    setMinority(
                      event.target.value as (typeof MINORITY_OPTIONS)[number]["value"],
                    )
                  }
                >
                  {MINORITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Special status toggles */}
            <Field>
              <Label>Special status <span className="font-normal text-muted-foreground">(click to toggle)</span></Label>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {(
                  [
                    { label: "Differently abled (PH)", value: differentlyAbled, set: setDifferentlyAbled },
                    { label: "Orphan", value: orphan, set: setOrphan },
                    { label: "Ex-servicemen / Defence", value: exServicemen, set: setExServicemen },
                  ] as const
                ).map(({ label, value, set }) => {
                  const active = value === "Yes";
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => set(active ? "No" : "Yes")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                        active
                          ? "border-amber-400 bg-amber-50 text-amber-800"
                          : "border-border bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          active ? "bg-amber-500" : "bg-stone-300",
                        )}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Button type="submit" disabled={isPending} size="lg" className="w-full sm:w-auto">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Find colleges
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {summary ? (
        <section className="animate-fade-up min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="All colleges" value={summary.total.toLocaleString()} hint="MS OPEN rank order" />
            <StatCard
              label="Safe / Good"
              value={summary.safe.toLocaleString()}
              hint="≥ 65% match score"
            />
            <StatCard
              label="Borderline"
              value={summary.borderline.toLocaleString()}
              hint="45–65% match score"
            />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Results</h2>
              <p className="text-sm text-muted-foreground">
                {sortBy === "recommended"
                  ? "Balances college prestige (MS OPEN rank) with your match score equally."
                  : sortBy === "rank"
                    ? "Fixed MS OPEN ranking order — prestige only, ignores your chances."
                    : `Sorted by ${SORT_OPTIONS.find((option) => option.value === sortBy)?.label.toLowerCase()}.`}
              </p>
            </div>
            <div className="flex w-full min-w-0 flex-wrap items-end gap-3 sm:w-auto">
              <Field className="min-w-0 flex-1 sm:min-w-[200px] sm:flex-none">
                <Label htmlFor="sort">Sort by</Label>
                <Select
                  id="sort"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <ExportButton onClick={handleExport} disabled={sortedMatches.length === 0} />
            </div>
          </div>

          {matches.length === 0 ? (
            <Alert>No colleges found for this course.</Alert>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {sortedMatches.map((match) => (
                  <MatchCard key={`${match.collegeId}-${match.divisionId}`} match={match} />
                ))}
              </div>

              <DataTable className="hidden md:block">
                <DataTableHead>
                  <tr>
                    <th className="w-12 px-4 py-3">Rank</th>
                    <th className="px-4 py-3">College & Division</th>
                    <th className="w-44 px-4 py-3">Your Chances</th>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {sortedMatches.map((match) => (
                    <tr
                      key={`${match.collegeId}-${match.divisionId}`}
                      className="transition hover:bg-stone-50/80"
                    >
                      <td className="px-4 py-4 text-lg font-bold text-primary">
                        #{match.msOpenRank}
                      </td>
                      <td className="max-w-0 px-4 py-4">
                        <p className="break-words font-semibold text-foreground">
                          {match.collegeName}
                        </p>
                        <p className="break-words text-xs text-muted-foreground">
                          {match.divisionName}
                        </p>
                        <p className="break-words text-xs text-primary/70">
                          {match.universityName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          MS OPEN cutoff ~{match.msOpenCutoff.toFixed(1)}%
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <ChancesPopover match={match} />
                      </td>
                    </tr>
                  ))}
                </DataTableBody>
              </DataTable>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
