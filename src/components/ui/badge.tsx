import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/20 text-warning-foreground",
        destructive: "border-transparent bg-destructive/15 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  style,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} style={style} {...props} />;
}

/** Badge whose color is driven by a hex value (for custom stage/status colors). */
function DotBadge({
  className,
  color,
  children,
  ...props
}: React.ComponentProps<"span"> & { color: string }) {
  return (
    <span
      data-slot="dot-badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-xs font-medium text-foreground w-fit whitespace-nowrap shrink-0",
        className
      )}
      {...props}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </span>
  );
}

export { Badge, badgeVariants, DotBadge };
