import Link from "next/link";
import { ArrowRight, BarChart3, Lightbulb, Zap, TrendingUp, Database } from "lucide-react";

import { AppFrame } from "@/components/app-frame";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COURSE_OPTIONS } from "@/lib/constants";
import { cutoffStatsReady } from "@/lib/merit-queries";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  let ready = false;
  let cycles = [];
  let totalRows = 0;

  try {
    const [readyResult, cyclesResult, totalRowsResult] = await Promise.all([
      cutoffStatsReady(),
      prisma.admissionCycle.findMany({
        orderBy: [{ course: "asc" }, { year: "desc" }],
        select: { slug: true, course: true, year: true, rowCount: true },
      }),
      prisma.meritEntry.count(),
    ]);
    ready = readyResult;
    cycles = cyclesResult;
    totalRows = totalRowsResult;
  } catch (error) {
    console.error("[v0] Error loading database data:", error);
    // Continue with empty data if database is not ready
  }

  const features = [
    {
      icon: Zap,
      title: "Instant Search",
      description:
        "Find eligible colleges instantly by entering your percentile, category, and MS/OMS status across 3 years of data.",
    },
    {
      icon: TrendingUp,
      title: "Smart Rankings",
      description:
        "View top colleges by category and candidature type—Maharashtra and OMS pools analyzed separately for accuracy.",
    },
    {
      icon: Database,
      title: "Real-time Data",
      description:
        "Built on aggregated cutoff statistics for lightning-fast performance. Pre-calculated rankings for instant results.",
    },
  ];

  return (
    <AppFrame>
      <PageHero />

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="animate-fade-up border-0 shadow-sm hover:shadow-md transition-shadow"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <CardContent className="space-y-4 p-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <feature.icon className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl px-4 sm:px-6">
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="grid gap-6 p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">Database status</h2>
                <Badge variant={ready ? "success" : "warning"}>
                  {ready ? "Ready" : "Processing"}
                </Badge>
              </div>
              <p className="text-base leading-6 text-muted-foreground max-w-md">
                {totalRows.toLocaleString()} merit entries loaded across{" "}
                {cycles.length} admission cycles. Your data is up-to-date and ready for search.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cycles.map((cycle) => (
                <div
                  key={cycle.slug}
                  className="rounded-lg border border-border bg-gray-50 px-4 py-3 text-sm"
                >
                  <p className="font-semibold text-foreground">{cycle.slug}</p>
                  <p className="text-xs text-muted-foreground">
                    {cycle.rowCount.toLocaleString()} entries
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </AppFrame>
  );
}

function PageHero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
      <div className="animate-fade-up space-y-8">
        <div className="space-y-4">
          <Badge variant="accent" className="gap-1.5 px-3.5 py-1.5 text-xs font-medium">
            <Lightbulb className="h-3.5 w-3.5" />
            Admission Intelligence Platform
          </Badge>

          <div className="space-y-6">
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl leading-tight">
              Find your ideal law college with confidence
            </h1>
            <p className="max-w-2xl text-xl leading-8 text-muted-foreground">
              Access 3 years of real LLB waitlist data. Compare colleges by percentile, category, and candidature type to make informed decisions.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            {COURSE_OPTIONS.map((option) => {
              const short = option.value === "LLB_5" ? "5" : "3";
              return (
                <ButtonLink key={option.value} href={`/finder?course=${short}`} size="lg">
                  Search {option.label}
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              );
            })}
            <ButtonLink href="/rankings" variant="secondary" size="lg">
              View rankings
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
