export const pageShellSx = {
  minHeight: "100dvh",
  bgcolor: "#eef0f3",
};

export const pageContainerSx = {
  maxWidth: "1180px !important",
};

export const sectionCardSx = {
  borderRadius: 3,
  borderColor: "rgba(15,23,42,.1)",
  bgcolor: "#ffffff",
  boxShadow: "0 12px 28px rgba(15,23,42,.06)",
};

export const actionButtonSx = {
  primary: {
    textTransform: "none",
    borderRadius: 2,
    px: 2,
    py: 0.8,
    fontWeight: 700,
    bgcolor: "#111827",
    "&:hover": { bgcolor: "#0b1220" },
  },
  secondary: {
    textTransform: "none",
    borderRadius: 2,
    px: 2,
    py: 0.8,
    fontWeight: 700,
    borderColor: "rgba(15,23,42,.24)",
    color: "#0f172a",
    "&:hover": { borderColor: "rgba(15,23,42,.34)", bgcolor: "#f8fafc" },
  },
};

export const navButtonSx = {
  minHeight: 40,
  fontSize: 14,
  fontWeight: 700,
  textTransform: "none",
  borderRadius: 999,
};

export const statusChipSx = {
  minHeight: 30,
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 999,
  bgcolor: "#ffffff",
};

export const filterChipSx = {
  minHeight: 40,
  fontSize: 14,
  fontWeight: 700,
  borderRadius: 999,
};

export const panelPaperSx = {
  borderRadius: 2.2,
  border: "1px solid rgba(15,23,42,.12)",
  bgcolor: "#ffffff",
};

export const metricValueSx = {
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-.01em",
  lineHeight: 1.08,
};

// 흰 배경 (rebuild 전용)
export const pageShellCleanSx = {
  minHeight: "100dvh",
  bgcolor: "#ffffff",
  fontFamily: "'Plus Jakarta Sans','Noto Sans KR',sans-serif",
};

// 시맨틱 컬러 (위기 수준별)
export const riskAccent = {
  critical: { color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
  high:     { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  caution:  { color: "#eab308", bg: "#fefce8", border: "#fef08a" },
  safe:     { color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0" },
  neutral:  { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
};

// 상단 컬러 바 카드 (Metric-First)
export const metricCardSx = {
  borderRadius: "10px",
  border: "1px solid rgba(15,23,42,.09)",
  bgcolor: "#ffffff",
  boxShadow: "0 1px 3px rgba(15,23,42,.05), 0 4px 12px rgba(15,23,42,.04)",
  overflow: "hidden",
};
