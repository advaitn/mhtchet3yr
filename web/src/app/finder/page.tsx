import {
  CourseSelector,
  courseQueryToEnum,
  courseQueryToShort,
} from "@/components/course-selector";
import { AppFrame } from "@/components/app-frame";
import { DataDisclaimer } from "@/components/data-disclaimer";
import { FinderForm } from "@/components/finder-form";
import { PageHeader, PageShell } from "@/components/ui/page-shell";

type FinderPageProps = {
  searchParams: Promise<{ course?: string }>;
};

export default async function FinderPage({ searchParams }: FinderPageProps) {
  const params = await searchParams;
  const courseShort = courseQueryToShort(params.course);
  const course = courseQueryToEnum(params.course);

  return (
    <AppFrame>
      <PageShell className="space-y-8">
        <PageHeader
          eyebrow="College Finder"
          title="Which colleges can you get?"
          description="Enter your percentile, category, and candidature type. Results compare 2023–2025 published waitlists and estimate how competitive you are at each college."
          actions={<CourseSelector selected={courseShort} basePath="/finder" />}
        />
        <DataDisclaimer variant="panel" />
        <FinderForm course={course} />
      </PageShell>
    </AppFrame>
  );
}
