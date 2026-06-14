import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "animate-fade-up flex flex-col gap-5 border-b border-border/70 pb-8 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="text-base leading-7 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full min-w-0 max-w-6xl px-4 py-8 sm:px-6 sm:py-10",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function Alert({
  children,
  variant = "warning",
  className,
}: {
  children: React.ReactNode;
  variant?: "warning" | "error" | "info";
  className?: string;
}) {
  const styles = {
    warning: "border-amber-200 bg-warning-soft text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-900",
  } as const;

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm leading-6",
        styles[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
