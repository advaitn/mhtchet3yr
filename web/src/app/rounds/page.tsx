import { AppFrame } from "@/components/app-frame";
import { RoundsForm } from "@/components/rounds-form";
import { PageHeader, PageShell } from "@/components/ui/page-shell";

export default function RoundsPage() {
  return (
    <AppFrame>
      <PageShell className="space-y-8">
        <PageHeader
          eyebrow="Round Strategy"
          title="When would you get admitted?"
          description="See your fitment across all 3 CAP rounds for every college. Round I is most competitive; cutoffs typically drop in Rounds II and III as candidates with better offers vacate seats."
        />
        <RoundsForm />
      </PageShell>
    </AppFrame>
  );
}
