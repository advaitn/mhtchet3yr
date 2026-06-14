import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

type DataDisclaimerProps = {
  variant?: "banner" | "panel";
  className?: string;
};

export function DataDisclaimer({ variant = "banner", className }: DataDisclaimerProps) {
  if (variant === "panel") {
    return (
      <aside
        role="note"
        aria-label="Data accuracy disclaimer"
        className={cn(
          "rounded-2xl border-2 border-amber-400 bg-amber-50 px-5 py-4 shadow-sm",
          className,
        )}
      >
        <DisclaimerContent emphasized />
      </aside>
    );
  }

  return (
    <div
      role="note"
      aria-label="Data accuracy disclaimer"
      className={cn(
        "border-b-2 border-amber-400 bg-amber-50 px-4 py-3.5 sm:px-6",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl">
        <DisclaimerContent />
      </div>
    </div>
  );
}

function DisclaimerContent({ emphasized = false }: { emphasized?: boolean }) {
  return (
    <div className="flex gap-3 sm:gap-4">
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-amber-400/30 text-amber-900",
          emphasized ? "h-11 w-11" : "h-9 w-9",
        )}
      >
        <AlertTriangle className={emphasized ? "h-6 w-6" : "h-5 w-5"} aria-hidden />
      </div>
      <div className="min-w-0 space-y-1 text-amber-950">
        <p className={cn("font-semibold tracking-tight", emphasized ? "text-base" : "text-sm")}>
          Estimates only — not official admission advice
        </p>
        <p className={cn("leading-relaxed text-amber-950/90", emphasized ? "text-sm" : "text-xs sm:text-sm")}>
          Match scores and cutoffs are derived from publicly published Maharashtra CET waitlist
          documents and institute-wise lists from previous years (2023–2025). They are{" "}
          <strong className="font-semibold text-amber-950">not guaranteed to match</strong> this
          year&apos;s CAP rounds, seat intake, reservations, minority quotas, or college-specific
          rules. Some institutes may be missing, miscategorized, or show figures that differ from
          official PDFs.{" "}
          <strong className="font-semibold text-amber-950">
            Always confirm with the State CET Cell, FC/ARC, and the college before you choose.
          </strong>
        </p>
      </div>
    </div>
  );
}
