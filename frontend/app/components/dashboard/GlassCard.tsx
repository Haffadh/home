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
    <section className={`glass-card p-6 ${className}`} style={style}>
      {children}
    </section>
  );
}
