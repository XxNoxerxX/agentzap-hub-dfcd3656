import { cn } from "@/lib/utils";
import { type HTMLAttributes, forwardRef } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  neonTop?: boolean;
  strong?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, glow, neonTop, strong, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        strong ? "glass-strong" : "glass",
        "relative rounded-2xl p-5 transition-shadow",
        glow && "glow-primary",
        neonTop && "neon-border-top overflow-hidden",
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = "GlassCard";
