"use client";

import { Info } from "lucide-react";

export default function LabelWithTip({ label, tip, variant = "body2", fontWeight = 700 }) {
  const fontSize = variant === "h6" ? 18 : variant === "body1" ? 16 : 14;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}>
      <span style={{ fontSize, fontWeight, lineHeight: 1.35 }}>{label}</span>
      <button
        type="button"
        title={tip || ""}
        aria-label={`${label} 설명 보기`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          minHeight: 40,
          padding: 4,
          borderRadius: 6,
          border: "none",
          backgroundColor: "transparent",
          color: "#64748b",
          cursor: "pointer",
          marginLeft: -2,
          marginTop: -6,
          marginBottom: -6,
          flexShrink: 0,
        }}
      >
        <Info size={16} strokeWidth={2} />
      </button>
    </span>
  );
}
