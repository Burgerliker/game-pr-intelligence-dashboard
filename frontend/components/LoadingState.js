"use client";

const TONE = {
  info: {
    bg: "#eff6ff",
    border: "#bfdbfe",
    title: "#1e3a8a",
    subtitle: "#334155",
    spinner: "#2563eb",
  },
  warning: {
    bg: "#fff9eb",
    border: "#f9d48f",
    title: "#8a5b00",
    subtitle: "#8b6b2d",
    spinner: "#d97706",
  },
};

export default function LoadingState({
  title = "로딩 중",
  subtitle = "데이터를 불러오고 있습니다.",
  tone = "info",
}) {
  const palette = TONE[tone] || TONE.info;

  return (
    <div
      style={{
        padding: "10px 14px",
        minHeight: 44,
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        backgroundColor: palette.bg,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <svg
        style={{ width: 18, height: 18, color: palette.spinner, flexShrink: 0 }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12" cy="12" r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeOpacity="0.25"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ transformOrigin: "center", animation: "spin 0.75s linear infinite" }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </svg>
      <div>
        <p style={{ margin: 0, fontWeight: 700, color: palette.title, fontSize: 14, lineHeight: 1.35 }}>
          {title}
        </p>
        <p style={{ margin: 0, color: palette.subtitle, fontSize: 13, lineHeight: 1.35, fontVariantNumeric: "tabular-nums" }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}
