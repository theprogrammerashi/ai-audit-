"use client";

export default function Logo({ size = "default" }: { size?: "small" | "default" | "large" }) {
  const sizes = {
    small: { brand: "text-lg", dot: "text-lg" },
    default: { brand: "text-2xl", dot: "text-2xl" },
    large: { brand: "text-5xl", dot: "text-5xl" },
  };
  const s = sizes[size];

  return (
    <span className="inline-flex items-baseline" style={{ fontFamily: "'Inter', sans-serif" }}>
      <span className={`${s.brand} font-bold`} style={{ color: "var(--text-primary)" }}>
        CareAudit
      </span>
      <span className={`${s.dot} font-bold`} style={{ color: "#E8521A" }}>
        .ai
      </span>
    </span>
  );
}
