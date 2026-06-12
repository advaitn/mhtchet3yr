import {
  CourseSelector,
  courseQueryToEnum,
  courseQueryToShort,
} from "@/components/course-selector";
import { AppFrame } from "@/components/app-frame";
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
          description="Enter your percentile, category, and candidature type. Results compare 2023–2025 waitlist cutoffs and highlight colleges where your percentile meets or exceeds the lowest waitlist percentile for that year."
          actions={<CourseSelector selected={courseShort} basePath="/finder" />}
        />
        <FinderForm course={course} />
      </PageShell>
    </AppFrame>
  );
}
