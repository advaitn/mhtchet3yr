import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AppFrame } from "@/components/app-frame";
import {
  CandidatureToggle,
  CourseSelector,
  courseQueryToEnum,
  courseQueryToShort,
  YearToggle,
} from "@/components/course-selector";
import { RankingsTable } from "@/components/rankings-table";
import { Alert, PageHeader, PageShell } from "@/components/ui/page-shell";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
} from "@/lib/constants";
import { getCachedTopColleges } from "@/lib/cached-queries";
import { cutoffStatsReady } from "@/lib/merit-queries";

type CategoryRankingsPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ course?: string; candidature?: string; year?: string }>;
};

function decodeCategory(value: string): Category | null {
  const decoded = decodeURIComponent(value);
  return CATEGORIES.includes(decoded as Category) ? (decoded as Category) : null;
}

export default async function CategoryRankingsPage({
  params,
  searchParams,
}: CategoryRankingsPageProps) {
  const [{ category: categoryParam }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  const category = decodeCategory(categoryParam);
  if (!category) {
    notFound();
  }

  const courseShort = courseQueryToShort(query.course);
  const course = courseQueryToEnum(query.course);
  const candidatureGroup = query.candidature === "OMS" ? "OMS" : "MS";
  const year = query.year ? Number.parseInt(query.year, 10) : undefined;
  const ready = await cutoffStatsReady();

  const rows = ready
    ? await getCachedTopColleges({
        course,
        category,
        candidatureGroup,
        year: Number.isFinite(year) ? year : undefined,
        limit: 25,
      })
    : [];

  const basePath = `/rankings/${encodeURIComponent(category)}`;

  return (
    <AppFrame>
      <PageShell className="space-y-8">
        <Link
          href={`/rankings?course=${courseShort}&candidature=${candidatureGroup}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to rankings
        </Link>

        <PageHeader
          eyebrow={`${CATEGORY_LABELS[category]} · ${candidatureGroup}`}
          title={`Top colleges — ${category}`}
          description="Colleges ranked by median waitlist percentile for the selected course, category, and candidature pool."
          actions={
            <div className="flex flex-wrap gap-3">
              <CourseSelector
                selected={courseShort}
                basePath={basePath}
                query={{
                  candidature: candidatureGroup,
                  year: year ? String(year) : undefined,
                }}
              />
              <CandidatureToggle
                selected={candidatureGroup}
                courseShort={courseShort}
                basePath={basePath}
                extraQuery={year ? { year: String(year) } : undefined}
              />
              <YearToggle
                selectedYear={year}
                courseShort={courseShort}
                candidatureGroup={candidatureGroup}
                basePath={basePath}
              />
            </div>
          }
        />

        {!ready ? (
          <Alert>
            Rankings cache not built yet. Run{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5">npm run db:refresh-stats</code>.
          </Alert>
        ) : (
          <RankingsTable
            rows={rows}
            title={`Top ${category} colleges`}
            exportFilename={`rankings-${category}-${courseShort}y-${candidatureGroup}${year ? `-${year}` : ""}.csv`}
            showYear={Boolean(year)}
          />
        )}
      </PageShell>
    </AppFrame>
  );
}

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}
