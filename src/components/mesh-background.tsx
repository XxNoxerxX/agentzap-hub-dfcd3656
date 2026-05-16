import { motion } from "framer-motion";

/** Fundo glass: gradiente mesh fixo + 3 orbs animados (roxo, magenta, cyan). */
export function MeshBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 10%, oklch(0.65 0.24 295 / 22%) 0%, transparent 55%), radial-gradient(ellipse at 85% 90%, oklch(0.68 0.27 340 / 18%) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, oklch(0.82 0.16 200 / 8%) 0%, transparent 70%)",
        }}
      />
      <motion.div
        className="absolute h-[520px] w-[520px] rounded-full blur-3xl"
        style={{ background: "oklch(0.65 0.24 295 / 35%)" }}
        animate={{ x: [0, 120, -40, 0], y: [0, 80, 160, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        initial={{ x: -100, y: -120 }}
      />
      <motion.div
        className="absolute right-0 h-[440px] w-[440px] rounded-full blur-3xl"
        style={{ background: "oklch(0.68 0.27 340 / 32%)" }}
        animate={{ x: [0, -160, -60, 0], y: [0, 100, -40, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        initial={{ x: 80, y: 200 }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[380px] w-[380px] rounded-full blur-3xl"
        style={{ background: "oklch(0.82 0.16 200 / 22%)" }}
        animate={{ x: [0, 80, -120, 0], y: [0, -120, 60, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
        initial={{ x: 0, y: 100 }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.97 0.01 280) 1px, transparent 1px), linear-gradient(90deg, oklch(0.97 0.01 280) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}
