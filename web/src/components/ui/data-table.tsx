"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTableProps = {
  children: React.ReactNode;
  className?: string;
};

export function DataTable({ children, className }: DataTableProps) {
  return (
    <div
      className={cn(
        "table-scroll w-full max-w-full min-w-0 overflow-x-auto rounded-[1.25rem] border border-border/80 bg-card shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function DataTableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <thead
      className={cn(
        "bg-stone-50 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </thead>
  );
}

export function DataTableBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tbody className={cn("divide-y divide-border/70", className)}>{children}</tbody>;
}

export function ExportButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} disabled={disabled}>
      <Download className="h-4 w-4" />
      Export CSV
    </Button>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
