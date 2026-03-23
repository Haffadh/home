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
    <section className={`glass-card rounded-3xl p-6 bg-[#12101e]/70 backdrop-blur-xl border border-white/[0.08] shadow-xl transition hover:bg-[#12101e]/80 active:scale-[0.99] flex flex-col min-h-0 ${className}`} style={style}>
      {children}
    </section>
  );
}
