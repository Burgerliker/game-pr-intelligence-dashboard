"use client";

const TONE_MAP = {
  info: {
    bg: "#eff6ff",
    border: "#bfdbfe",
    title: "#1e3a8a",
    subtitle: "#334155",
  },
  error: {
    bg: "#fff4f4",
    border: "#f4b9be",
    title: "#7f1d1d",
    subtitle: "#9f2a2a",
  },
  warning: {
    bg: "#fff8eb",
    border: "#f6d596",
    title: "#8a5700",
    subtitle: "#9a6c1d",
  },
  neutral: {
    bg: "#f8fafc",
    border: "#cbd5e1",
    title: "#334155",
    subtitle: "#64748b",
  },
};

export default function EmptyState({
  title = "표시할 데이터가 없습니다.",
  subtitle = "",
  actionLabel = "",
  onAction = null,
  tone = "neutral",
  compact = false,
}) {
  const palette = TONE_MAP[tone] || TONE_MAP.neutral;

  return (
    <div
      style={{
        padding: compact ? "8px 12px" : "12px 16px",
        minHeight: compact ? 40 : 44,
        borderRadius: 8,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        textAlign: compact ? "left" : "center",
        display: "flex",
        flexDirection: "column",
        gap: compact ? 4 : 6,
      }}
    >
      <p style={{ margin: 0, fontWeight: 700, color: palette.title, fontSize: 14, lineHeight: 1.35 }}>
        {title}
      </p>
      {subtitle ? (
        <p style={{ margin: 0, color: palette.subtitle, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.35, fontVariantNumeric: "tabular-nums" }}>
          {subtitle}
        </p>
      ) : null}
      {actionLabel && typeof onAction === "function" ? (
        <div style={{ display: "flex", justifyContent: compact ? "flex-start" : "center" }}>
          <button
            onClick={onAction}
            style={{
              minHeight: 36,
              padding: "6px 14px",
              borderRadius: 6,
              border: `1px solid ${palette.border}`,
              backgroundColor: "transparent",
              color: palette.title,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
