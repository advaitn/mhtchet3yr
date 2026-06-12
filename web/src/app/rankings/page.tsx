import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { AppFrame } from "@/components/app-frame";
import {
  CandidatureToggle,
  CourseSelector,
  courseQueryToEnum,
  courseQueryToShort,
} from "@/components/course-selector";
import { RankingsTable } from "@/components/rankings-table";
import { Alert, PageHeader, PageShell } from "@/components/ui/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COURSE_OPTIONS,
} from "@/lib/constants";
import { getCachedTopColleges } from "@/lib/cached-queries";
import { cutoffStatsReady } from "@/lib/merit-queries";

type RankingsPageProps = {
  searchParams: Promise<{ course?: string; candidature?: string }>;
};

export default async function RankingsPage({ searchParams }: RankingsPageProps) {
  const params = await searchParams;
  const courseShort = courseQueryToShort(params.course);
  const course = courseQueryToEnum(params.course);
  const candidatureGroup = params.candidature === "OMS" ? "OMS" : "MS";
  const ready = await cutoffStatsReady();

  const openRows = ready
    ? await getCachedTopColleges({
        course,
        category: "OPEN",
        candidatureGroup,
        limit: 10,
      })
    : [];

  return (
    <AppFrame>
      <PageShell className="space-y-10">
        <PageHeader
          eyebrow="Rankings"
          title="Top law colleges by category"
          description="Pre-aggregated 3-year median rankings. Maharashtra and OMS pools are ranked separately because cutoffs differ materially."
          actions={
            <div className="flex flex-wrap gap-3">
              <CourseSelector
                selected={courseShort}
                basePath="/rankings"
                query={{ candidature: candidatureGroup }}
              />
              <CandidatureToggle
                selected={candidatureGroup}
                courseShort={courseShort}
                basePath="/rankings"
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
          <>
            <RankingsTable
              rows={openRows}
              title={`Top OPEN colleges · ${candidatureGroup} · 3-year average`}
              exportFilename={`rankings-open-${courseShort}y-${candidatureGroup}.csv`}
              showYear={false}
            />

            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Browse by category</h2>
                <p className="text-sm text-muted-foreground">
                  {COURSE_OPTIONS.find((item) => item.value === course)?.label} ·{" "}
                  {candidatureGroup === "MS"
                    ? "Maharashtra seats (Type A–E)"
                    : "Outside Maharashtra (OMS)"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CATEGORIES.map((category) => (
                  <Link
                    key={category}
                    href={`/rankings/${encodeURIComponent(category)}?course=${courseShort}&candidature=${candidatureGroup}`}
                  >
                    <Card className="group h-full bg-white/90 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
                      <CardContent className="flex items-center justify-between p-5">
                        <div>
                          <p className="font-semibold text-foreground">
                            {CATEGORY_LABELS[category]}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{category}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </PageShell>
    </AppFrame>
  );
}
