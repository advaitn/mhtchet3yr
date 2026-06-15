"use client";

import { Loader2, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/page-shell";
import {
  CANDIDATURE_TYPES,
  DIVISION_GENDER_OPTIONS,
  GENDER_OPTIONS,
} from "@/lib/candidate-profile";
import { CATEGORIES, CATEGORY_LABELS, COURSE_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { universityLogo, shortUniversityName } from "@/lib/university-logos";

type RoundCutoffRow = {
  year: number;
  college_id: string;
  college_name: string;
  division_id: string;
  division_name: string;
  university_name: string;
  phase: string;
  cutoff: number;
  count: number;
};

type CollegeRoundProfile = {
  college_id: string;
  college_name: string;
  division_id: string;
  division_name: string;
  university_name: string;
  msOpenRank: number;
  msOpenCutoff: number;
  /** year → phase → { cutoff, count } */
  data: Record<number, Record<string, { cutoff: number; count: number }>>;
};

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended (rank + opportunity)" },
  { value: "rank", label: "MS OPEN rank" },
  { value: "opportunity", label: "Best round opportunity first" },
  { value: "name", label: "College name (A–Z)" },
] as const;
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

const PHASES = ["Round-I", "Round-II", "Round-III"] as const;
const PHASE_SHORT: Record<string, string> = {
  "Round-I": "Round I",
  "Round-II": "Round II",
  "Round-III": "Round III",
};

function fitmentLabel(
  userPercentile: number,
  cutoff: number,
): "qualify" | "borderline" | "miss" {
  if (userPercentile >= cutoff) return "qualify";
  if (userPercentile >= cutoff - 2) return "borderline";
  return "miss";
}

const FIT_STYLES = {
  qualify: "bg-green-50 text-green-700 border-green-200",
  borderline: "bg-amber-50 text-amber-700 border-amber-200",
  miss: "bg-stone-50 text-stone-400 border-stone-200",
};

const FIT_LABEL = {
  qualify: "✓",
  borderline: "~",
  miss: "✗",
};

function cleanDivisionName(raw: string): string {
  return raw.replace(/^\d+-/, "").trim();
}

function RoundCell({
  cutoff,
  count,
  fit,
}: {
  cutoff: number | null;
  count: number | null;
  fit: "qualify" | "borderline" | "miss" | null;
}) {
  if (cutoff === null || fit === null) {
    return (
      <td className="border-l border-border px-3 py-3 text-center">
        <span className="text-xs text-muted-foreground/40">—</span>
      </td>
    );
  }
  return (
    <td className="border-l border-border px-3 py-3">
      <div
        className={cn(
          "flex flex-col items-center rounded-lg border px-2 py-1.5",
          FIT_STYLES[fit],
        )}
      >
        <span className="text-sm font-bold leading-none">
          {FIT_LABEL[fit]} {cutoff.toFixed(1)}%
        </span>
        <span className="mt-0.5 text-[10px] opacity-70">{count} seats</span>
      </div>
    </td>
  );
}

export function RoundsForm() {
  const [percentile, setPercentile] = useState("90");
  const [course, setCourse] = useState<string>("LLB_3");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("OPEN");
  const [candidatureType, setCandidatureType] =
    useState<(typeof CANDIDATURE_TYPES)[number]>("Maharashtra - Type A");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [divisionGender, setDivisionGender] =
    useState<(typeof DIVISION_GENDER_OPTIONS)[number]["value"]>("any");

  const [colleges, setColleges] = useState<CollegeRoundProfile[]>([]);
  const [userPct, setUserPct] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [isPending, startTransition] = useTransition();

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const pct = parseFloat(percentile);
    if (!isFinite(pct) || pct < 0 || pct > 100) {
      setError("Enter a valid percentile.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course, category, percentile: pct, gender, candidatureType, divisionGender }),
      });
      const data = await res.json() as { rows?: RoundCutoffRow[]; rankMap?: Record<string, number>; error?: string };
      if (!res.ok || !data.rows) {
        setError(data.error ?? "Search failed.");
        setColleges([]);
        setHasSearched(true);
        return;
      }

      const rankMap = data.rankMap ?? {};

      // Pivot rows → CollegeRoundProfile[]
      const map = new Map<string, CollegeRoundProfile>();
      for (const row of data.rows) {
        const key = `${row.college_id}|${row.division_id}`;
        if (!map.has(key)) {
          map.set(key, {
            college_id: row.college_id,
            college_name: row.college_name,
            division_id: row.division_id,
            division_name: row.division_name,
            university_name: row.university_name,
            msOpenRank: rankMap[key] ?? 9999,
            msOpenCutoff: 0,
            data: {},
          });
        }
        const profile = map.get(key)!;
        if (!profile.data[row.year]) profile.data[row.year] = {};
        profile.data[row.year][row.phase] = { cutoff: row.cutoff, count: row.count };
      }

      setColleges([...map.values()]);
      setUserPct(pct);
      setHasSearched(true);
    });
  }

  const years = useMemo(() => {
    const yrs = new Set<number>();
    for (const c of colleges) for (const y of Object.keys(c.data)) yrs.add(Number(y));
    return [...yrs].sort();
  }, [colleges]);

  function opportunityScore(p: CollegeRoundProfile, pct: number): number {
    for (const phase of PHASES) {
      const cutoffs = Object.values(p.data)
        .map((yr) => yr[phase]?.cutoff)
        .filter((c): c is number => c !== undefined);
      if (cutoffs.length === 0) continue;
      const minCutoff = Math.min(...cutoffs);
      if (pct >= minCutoff) return PHASES.indexOf(phase);
      if (pct >= minCutoff - 2) return PHASES.indexOf(phase) + 0.5;
    }
    return 10;
  }

  const sortedColleges = useMemo(() => {
    if (!userPct) return colleges;
    const total = colleges.length;
    return [...colleges].sort((a, b) => {
      switch (sortBy) {
        case "recommended": {
          // Blend prestige (rank) and opportunity (round score) equally
          const prestige = (p: CollegeRoundProfile) =>
            (1 - (p.msOpenRank - 1) / Math.max(total - 1, 1)) * 10;
          const opp = (p: CollegeRoundProfile) => -opportunityScore(p, userPct!); // negate so lower = better
          return (opp(b) + prestige(b)) - (opp(a) + prestige(a));
        }
        case "rank":
          return a.msOpenRank - b.msOpenRank;
        case "opportunity":
          return opportunityScore(a, userPct!) - opportunityScore(b, userPct!);
        case "name":
          return a.college_name.localeCompare(b.college_name);
      }
    });
  }, [colleges, sortBy, userPct]);

  const qualifyCount = useMemo(() => {
    if (!userPct) return 0;
    return colleges.filter((c) =>
      PHASES.some((ph) =>
        Object.values(c.data).some(
          (yr) => yr[ph] !== undefined && userPct >= yr[ph]!.cutoff,
        ),
      ),
    ).length;
  }, [colleges, userPct]);

  return (
    <div className="min-w-0 space-y-8">
      <Card className="overflow-hidden bg-white/90">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-5">
            {/* Row 1: Course + Percentile + Category */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <Label htmlFor="course">Course</Label>
                <Select
                  id="course"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                >
                  {COURSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label htmlFor="percentile">Your percentile</Label>
                <div className="relative">
                  <Input
                    id="percentile"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={percentile}
                    onChange={(e) => setPercentile(e.target.value)}
                    className="pr-10 text-lg font-semibold"
                    required
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
                </div>
              </Field>
              <Field>
                <Label htmlFor="category">Category</Label>
                <Select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as typeof category)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]} — {c}</option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Row 2: Gender + Candidature */}
            <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
              <Field>
                <Label>Gender</Label>
                <div className="flex gap-2 pt-0.5">
                  {GENDER_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setGender(item.value)}
                      className={cn(
                        "w-20 rounded-lg border px-3 py-2 text-sm font-medium transition",
                        gender === item.value
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field>
                <Label>Candidature type</Label>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {CANDIDATURE_TYPES.map((item) => {
                    const short = item.replace("Maharashtra - ", "").replace(" Migrant", "");
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCandidatureType(item)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-medium transition",
                          candidatureType === item
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
            </div>

            {/* Row 3: Division */}
            <Field>
              <Label>College type</Label>
              <div className="flex gap-2 pt-0.5">
                {DIVISION_GENDER_OPTIONS.map((item) => {
                  const short =
                    item.value === "any" ? "Any" :
                    item.value === "coed" ? "Co-ed" : "Women's";
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setDivisionGender(item.value)}
                      className={cn(
                        "rounded-lg border px-4 py-2 text-sm font-medium transition",
                        divisionGender === item.value
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

            <Button type="submit" disabled={isPending} size="lg" className="w-full sm:w-auto">
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Analysing rounds…</>
              ) : (
                <><Search className="h-4 w-4" />Analyse rounds</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {hasSearched && colleges.length > 0 && userPct !== null && (
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Round-by-round fitment</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {qualifyCount} of {colleges.length} colleges have at least one round where your {userPct}% qualifies.
              </p>
            </div>
            <Field className="min-w-[200px]">
              <Label htmlFor="sort-rounds">Sort by</Label>
              <Select
                id="sort-rounds"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            {(["qualify", "borderline", "miss"] as const).map((f) => (
              <span key={f} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium", FIT_STYLES[f])}>
                {FIT_LABEL[f]} {f === "qualify" ? "Qualifies" : f === "borderline" ? "Borderline (≤2%)" : "Misses"}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-medium text-muted-foreground/40">— No data this round</span>
          </div>

          {/* Scrollable table */}
          <div className="w-full overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">College</th>
                  {years.flatMap((yr) =>
                    PHASES.map((ph) => (
                      <th
                        key={`${yr}-${ph}`}
                        className="border-l border-border px-3 py-3 text-center whitespace-nowrap"
                      >
                        {PHASE_SHORT[ph]}
                        <span className="ml-1 font-normal opacity-60">{yr}</span>
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedColleges.map((college) => {
                  const logo = universityLogo(college.university_name);
                  const uniName = shortUniversityName(college.university_name);
                  return (
                    <tr key={`${college.college_id}|${college.division_id}`} className="hover:bg-stone-50/60 transition">
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="break-words font-semibold leading-snug text-foreground">
                          {college.college_name.replace(/^\d+ - /, "")}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {logo && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logo} alt="" width={12} height={12} className="h-3 w-3 shrink-0 rounded-full object-contain" />
                          )}
                          <span className="text-[11px] text-muted-foreground/70">{uniName}</span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/50 break-words">
                          {cleanDivisionName(college.division_name)}
                        </p>
                      </td>
                      {years.flatMap((yr) =>
                        PHASES.map((ph) => {
                          const entry = college.data[yr]?.[ph];
                          const fit = entry ? fitmentLabel(userPct, entry.cutoff) : null;
                          return (
                            <RoundCell
                              key={`${yr}-${ph}`}
                              cutoff={entry?.cutoff ?? null}
                              count={entry?.count ?? null}
                              fit={fit}
                            />
                          );
                        }),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {hasSearched && colleges.length === 0 && !error && (
        <Alert>No round data found for this profile.</Alert>
      )}
    </div>
  );
}
