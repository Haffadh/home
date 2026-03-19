"use client";

export default function GlassCard({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={`glass-card rounded-3xl p-6 bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 shadow-xl transition hover:bg-[#0f172a]/80 active:scale-[0.99] flex flex-col min-h-0 ${className}`} style={style}>
      {children}
    </section>
  );
}
