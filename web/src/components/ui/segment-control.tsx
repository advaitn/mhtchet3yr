import Link from "next/link";

import { cn } from "@/lib/utils";

type SegmentOption = {
  href: string;
  label: string;
  value: string;
};

type SegmentControlProps = {
  options: SegmentOption[];
  activeValue: string;
  className?: string;
};

export function SegmentControl({
  options,
  activeValue,
  className,
}: SegmentControlProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-border bg-stone-100/80 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === activeValue;

        return (
          <Link
            key={option.value}
            href={option.href}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              isActive
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
