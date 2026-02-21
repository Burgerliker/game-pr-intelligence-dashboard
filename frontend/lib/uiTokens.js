export const pageShellSx = {
  minHeight: "100dvh",
  bgcolor: "#edf1f5",
};

export const pageContainerSx = {
  maxWidth: "1200px !important",
  px: { xs: 2, sm: 3, md: 4 },
};

export const sectionCardSx = {
  borderRadius: 2,
  borderColor: "rgba(15,23,42,.08)",
  borderStyle: "solid",
  borderWidth: "1px",
  bgcolor: "#ffffff",
  boxShadow: "0 1px 3px rgba(15,23,42,.06), 0 6px 20px rgba(15,23,42,.06)",
  minHeight: 0,
};

export const actionButtonSx = {
  primary: {
    textTransform: "none",
    borderRadius: 2.5,
    px: 2.25,
    py: 1,
    minHeight: 40,
    fontSize: 14,
    fontWeight: 700,
    bgcolor: "#111827",
    "&:hover": { bgcolor: "#0b1220" },
  },
  secondary: {
    textTransform: "none",
    borderRadius: 2.5,
    px: 2.25,
    py: 1,
    minHeight: 40,
    fontSize: 14,
    fontWeight: 700,
    borderColor: "rgba(15,23,42,.24)",
    color: "#0f172a",
    "&:hover": { borderColor: "rgba(15,23,42,.34)", bgcolor: "#f8fafc" },
  },
};

export const navButtonSx = {
  minHeight: 40,
  px: 2,
  fontSize: 14,
  fontWeight: 700,
  textTransform: "none",
  borderRadius: 999,
};

export const statusChipSx = {
  minHeight: 30,
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 999,
  bgcolor: "#ffffff",
};

export const filterChipSx = {
  minHeight: 40,
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 999,
};

export const panelPaperSx = {
  borderRadius: 2,
  border: "1px solid rgba(15,23,42,.08)",
  bgcolor: "#ffffff",
};

export const metricValueSx = {
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-.01em",
  lineHeight: 1.14,
};

// 흰 배경 (rebuild 전용)
export const pageShellCleanSx = {
  minHeight: "100dvh",
  bgcolor: "#f3f6f9",
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
  borderRadius: 2,
  border: "1px solid rgba(15,23,42,.09)",
  bgcolor: "#ffffff",
  boxShadow: "0 1px 3px rgba(15,23,42,.06), 0 6px 16px rgba(15,23,42,.05)",
  overflow: "hidden",
  minHeight: 176,
};
