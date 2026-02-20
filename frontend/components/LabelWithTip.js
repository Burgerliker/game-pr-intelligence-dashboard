"use client";

import { Info } from "lucide-react";

export default function LabelWithTip({ label, tip, variant = "body2", fontWeight = 700 }) {
  const fontSize = variant === "h6" ? 18 : variant === "body1" ? 16 : 14;

  return (
    <span className="inline-flex items-center gap-1">
      <span style={{ fontSize, fontWeight, lineHeight: 1.35 }}>{label}</span>
      <button
        type="button"
        title={tip || ""}
        aria-label={`${label} 설명 보기`}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
      >
        <Info size={16} strokeWidth={2} />
      </button>
    </span>
  );
}
