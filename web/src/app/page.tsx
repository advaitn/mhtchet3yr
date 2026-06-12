import Link from "next/link";
import { ArrowRight, BarChart3, Database, Search, Sparkles } from "lucide-react";

import { AppFrame } from "@/components/app-frame";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COURSE_OPTIONS } from "@/lib/constants";
import { cutoffStatsReady } from "@/lib/merit-queries";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const [ready, cycles, totalRows] = await Promise.all([
    cutoffStatsReady(),
    prisma.admissionCycle.findMany({
      orderBy: [{ course: "asc" }, { year: "desc" }],
      select: { slug: true, course: true, year: true, rowCount: true },
    }),
    prisma.meritEntry.count(),
  ]);

  const features = [
    {
      icon: Search,
      title: "College Finder",
      description:
        "Enter percentile, category, and MS/OMS candidature. See eligible colleges across 2023–2025 with CSV export.",
    },
    {
      icon: BarChart3,
      title: "Category Rankings",
      description:
        "Top colleges by OPEN, SC, OBC, NT, EWS, and more — with separate Maharashtra and OMS leaderboards.",
    },
    {
      icon: Database,
      title: "Built for speed",
      description:
        "Pre-aggregated cutoffs power instant search. Special filters only hit live SQL when you need them.",
    },
  ];

  return (
    <AppFrame>
      <PageHero />

      <section className="mx-auto grid max-w-6xl gap-4 px-4 sm:px-6 lg:grid-cols-3">
        {features.map((feature, index) => (
          <Card
            key={feature.title}
            className="animate-fade-up bg-white/85 backdrop-blur"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <CardContent className="space-y-4 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <feature.icon className="h-5 w-5" />
              </span>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">{feature.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
        <Card className="overflow-hidden bg-white/90">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">Database status</h2>
                <Badge variant={ready ? "success" : "warning"}>
                  {ready ? "Stats ready" : "Needs refresh"}
                </Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {totalRows.toLocaleString()} merit rows loaded across{" "}
                {cycles.length} admission cycles.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cycles.map((cycle) => (
                <div
                  key={cycle.slug}
                  className="rounded-2xl border border-border/70 bg-stone-50/80 px-4 py-3"
                >
                  <p className="font-medium text-foreground">{cycle.slug}</p>
                  <p className="text-sm text-muted-foreground">
                    {cycle.rowCount.toLocaleString()} rows
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
    <section className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14">
      <div className="animate-fade-up relative overflow-hidden rounded-[2rem] border border-border/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#fff7ed_100%)] p-8 shadow-[var(--shadow-card)] sm:p-12">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-orange-100/70 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-blue-100/70 blur-3xl" />

        <div className="relative max-w-3xl space-y-6">
          <Badge variant="accent" className="gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            Maharashtra LLB CAP Waitlist Intelligence
          </Badge>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.05]">
              Find your law college with real waitlist data.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Compare 3 years of LLB 3-year and 5-year waitlists. Filter by
              category, percentile, and Maharashtra vs OMS candidature.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {COURSE_OPTIONS.map((option) => {
              const short = option.value === "LLB_5" ? "5" : "3";
              return (
                <ButtonLink key={option.value} href={`/finder?course=${short}`}>
                  Start {option.label}
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              );
            })}
            <ButtonLink href="/rankings" variant="secondary">
              Browse rankings
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
