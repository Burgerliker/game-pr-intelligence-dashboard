"use client";

const TONE = {
  error: {
    bg: "#fff4f4",
    border: "#f4b9be",
    title: "#7f1d1d",
    text: "#9f2a2a",
    codeBg: "#ffe7ea",
    codeBorder: "#f1a8af",
    icon: "#dc2626",
  },
  warning: {
    bg: "#fff8eb",
    border: "#f6d596",
    title: "#8a5700",
    text: "#9a6c1d",
    codeBg: "#fff1cc",
    codeBorder: "#edcc84",
    icon: "#d97706",
  },
  info: {
    bg: "#eff6ff",
    border: "#bfdbfe",
    title: "#1e3a8a",
    text: "#334155",
    codeBg: "#e0ecff",
    codeBorder: "#b7d1ff",
    icon: "#2563eb",
  },
};

export default function ErrorState({
  title = "문제가 발생했습니다",
  details = "",
  diagnosticCode = "",
  actionLabel = "",
  onAction = null,
  tone = "error",
}) {
  const palette = TONE[tone] || TONE.error;

  return (
    <div
      role="alert"
      style={{
        borderRadius: 8,
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
        padding: "12px 14px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <svg
        style={{ width: 18, height: 18, color: palette.icon, flexShrink: 0, marginTop: 1 }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <p style={{ margin: 0, fontWeight: 700, color: palette.title, fontSize: 14, lineHeight: 1.35 }}>
            {title}
          </p>
          {actionLabel && typeof onAction === "function" ? (
            <button
              onClick={onAction}
              style={{
                flexShrink: 0,
                minHeight: 32,
                padding: "4px 12px",
                borderRadius: 6,
                border: `1px solid ${palette.border}`,
                backgroundColor: "transparent",
                color: palette.title,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
        {details ? (
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", color: palette.text, fontSize: 13, lineHeight: 1.35, fontVariantNumeric: "tabular-nums" }}>
            {details}
          </p>
        ) : null}
        {diagnosticCode ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              marginTop: 6,
              minHeight: 26,
              padding: "0 8px",
              borderRadius: 999,
              border: `1px solid ${palette.codeBorder}`,
              backgroundColor: palette.codeBg,
              color: palette.title,
              fontSize: 12,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            진단코드: {diagnosticCode}
          </span>
        ) : null}
      </div>
    </div>
  );
}
