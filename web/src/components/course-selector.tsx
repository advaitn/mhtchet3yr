import Link from "next/link";

import { COURSE_OPTIONS } from "@/lib/constants";

type CourseSelectorProps = {
  selected: "3" | "5";
  basePath?: string;
  query?: Record<string, string | undefined>;
};

function buildHref(
  basePath: string,
  courseShort: string,
  query?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  params.set("course", courseShort);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        params.set(key, value);
      }
    }
  }

  return `${basePath}?${params.toString()}`;
}

export function CourseSelector({
  selected,
  basePath = "",
  query,
}: CourseSelectorProps) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-stone-100/80 p-1">
      {COURSE_OPTIONS.map((option) => {
        const short = option.short.replace("Y", "");
        const isActive = short === selected;

        return (
          <Link
            key={option.value}
            href={buildHref(basePath, short, query)}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              isActive
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

export function courseQueryToEnum(course: string | undefined): "LLB_3" | "LLB_5" {
  return course === "5" ? "LLB_5" : "LLB_3";
}

export function courseQueryToShort(course: string | undefined): "3" | "5" {
  return course === "5" ? "5" : "3";
}

export function CandidatureToggle({
  selected,
  courseShort,
  basePath,
  extraQuery,
}: {
  selected: "MS" | "OMS";
  courseShort: "3" | "5";
  basePath: string;
  extraQuery?: Record<string, string | undefined>;
}) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-stone-100/80 p-1">
      {(["MS", "OMS"] as const).map((value) => {
        const params = new URLSearchParams();
        params.set("course", courseShort);
        params.set("candidature", value);
        if (extraQuery) {
          for (const [key, val] of Object.entries(extraQuery)) {
            if (val) params.set(key, val);
          }
        }

        return (
          <Link
            key={value}
            href={`${basePath}?${params.toString()}`}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              selected === value
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {value === "MS" ? "Maharashtra (MS)" : "OMS"}
          </Link>
        );
      })}
    </div>
  );
}

export function YearToggle({
  selectedYear,
  courseShort,
  candidatureGroup,
  basePath,
}: {
  selectedYear?: number;
  courseShort: "3" | "5";
  candidatureGroup: "MS" | "OMS";
  basePath: string;
}) {
  const years = [undefined, 2023, 2024, 2025] as const;

  return (
    <div className="inline-flex flex-wrap rounded-xl border border-border bg-stone-100/80 p-1">
      {years.map((year) => {
        const params = new URLSearchParams();
        params.set("course", courseShort);
        params.set("candidature", candidatureGroup);
        if (year) params.set("year", String(year));

        const isActive = selectedYear === year || (!selectedYear && !year);

        return (
          <Link
            key={year ?? "avg"}
            href={`${basePath}?${params.toString()}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {year ?? "3-yr avg"}
          </Link>
        );
      })}
    </div>
  );
}
