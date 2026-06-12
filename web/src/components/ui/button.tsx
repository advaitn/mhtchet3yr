import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-blue-700 active:scale-[0.98]",
  secondary:
    "border border-border bg-white text-foreground hover:bg-gray-50 active:scale-[0.98]",
  ghost: "text-muted-foreground hover:bg-gray-100 hover:text-foreground",
  accent:
    "bg-accent text-white shadow-sm hover:bg-sky-500 active:scale-[0.98]",
  success:
    "bg-success text-white shadow-sm hover:bg-emerald-600 active:scale-[0.98]",
} as const;

const sizes = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
} as const;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

type ButtonLinkProps = React.ComponentProps<"a"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonLinkProps) {
  return (
    <a
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
