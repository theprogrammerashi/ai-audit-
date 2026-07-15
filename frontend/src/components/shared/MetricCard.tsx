"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  accentColor?: string;
  icon?: React.ReactNode;
}

export default function MetricCard({ label, value, change, changeLabel, accentColor, icon }: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div
      className="card animate-fade-in"
      style={{
        borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "120px",
          height: "120px",
          background: accentColor
            ? `radial-gradient(circle at top right, ${accentColor}08 0%, transparent 70%)`
            : undefined,
          pointerEvents: "none",
        }}
      />
      
      <div style={{ position: "relative" }}>
        <div className="label" style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
          {icon}
          {label}
        </div>
        <div style={{ fontSize: "28px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
          {value}
        </div>
        {change !== undefined && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.8rem",
              color: isPositive ? "var(--success)" : isNegative ? "var(--danger)" : "var(--text-tertiary)",
            }}
          >
            {isPositive ? <TrendingUp size={14} /> : isNegative ? <TrendingDown size={14} /> : <Minus size={14} />}
            <span style={{ fontWeight: 500 }}>
              {isPositive ? "+" : ""}
              {change}%
            </span>
            {changeLabel && (
              <span style={{ color: "var(--text-tertiary)", marginLeft: "2px" }}>{changeLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
