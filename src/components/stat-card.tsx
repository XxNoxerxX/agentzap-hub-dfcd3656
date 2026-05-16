import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "./glass-card";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tint?: "primary" | "accent" | "cyan";
}

const TINT: Record<NonNullable<StatCardProps["tint"]>, string> = {
  primary: "from-[oklch(0.65_0.24_295)] to-[oklch(0.55_0.22_295)]",
  accent: "from-[oklch(0.68_0.27_340)] to-[oklch(0.55_0.25_340)]",
  cyan: "from-[oklch(0.82_0.16_200)] to-[oklch(0.55_0.16_220)]",
};

export function StatCard({ label, value, icon: Icon, tint = "primary" }: StatCardProps) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <GlassCard className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${TINT[tint]} shadow-lg`}
        >
          <Icon className="h-6 w-6 text-white" strokeWidth={2.2} />
        </div>
        <div>
          <div className="text-3xl font-bold leading-none gradient-text">{display}</div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
