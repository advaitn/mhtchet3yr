import { cn } from "@/lib/utils";

const styles = {
  default: "bg-stone-100 text-stone-700",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  accent: "bg-accent-soft text-accent-foreground",
  primary: "bg-blue-50 text-primary",
} as const;

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof styles;
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
