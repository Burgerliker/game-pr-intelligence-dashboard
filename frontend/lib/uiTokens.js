export const MUI_SPEC = {
  spacingUnit: 8,
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    pill: 999,
  },
  controlHeight: {
    chipSm: 24,
    chipMd: 32,
    buttonSm: 30,
    buttonMd: 36,
    buttonLg: 42,
    nav: 40,
    input: 56,
  },
  type: {
    h3: 48,
    h4: 34,
    h5: 24,
    h6: 20,
    body1: 16,
    body2: 14,
    caption: 12,
    button: 14,
  },
  lineHeight: {
    heading: 1.2,
    body: 1.5,
    compact: 1.1,
  },
  card: {
    metricMinHeight: 176,
    contentPadding: 16,
    contentPaddingLg: 24,
  },
};

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
    minHeight: MUI_SPEC.controlHeight.nav,
    fontSize: MUI_SPEC.type.button,
    fontWeight: 700,
    bgcolor: "#111827",
    "&:hover": { bgcolor: "#0b1220" },
  },
  secondary: {
    textTransform: "none",
    borderRadius: 2.5,
    px: 2.25,
    py: 1,
    minHeight: MUI_SPEC.controlHeight.nav,
    fontSize: MUI_SPEC.type.button,
    fontWeight: 700,
    borderColor: "rgba(15,23,42,.24)",
    color: "#0f172a",
    "&:hover": { borderColor: "rgba(15,23,42,.34)", bgcolor: "#f8fafc" },
  },
};

export const navButtonSx = {
  minHeight: MUI_SPEC.controlHeight.nav,
  px: 2,
  fontSize: MUI_SPEC.type.button,
  fontWeight: 700,
  textTransform: "none",
  borderRadius: MUI_SPEC.radius.pill,
};

export const statusChipSx = {
  minHeight: MUI_SPEC.controlHeight.chipMd,
  fontSize: MUI_SPEC.type.caption,
  fontWeight: 700,
  borderRadius: MUI_SPEC.radius.pill,
  bgcolor: "#ffffff",
};

export const filterChipSx = {
  minHeight: MUI_SPEC.controlHeight.nav,
  fontSize: 13,
  fontWeight: 700,
  borderRadius: MUI_SPEC.radius.pill,
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
  lineHeight: MUI_SPEC.lineHeight.compact,
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
  minHeight: MUI_SPEC.card.metricMinHeight,
};

export const specTypeSx = {
  h3: { fontSize: MUI_SPEC.type.h3, lineHeight: MUI_SPEC.lineHeight.heading, fontWeight: 800, letterSpacing: "-.02em" },
  h4: { fontSize: MUI_SPEC.type.h4, lineHeight: MUI_SPEC.lineHeight.heading, fontWeight: 800, letterSpacing: "-.02em" },
  h5: { fontSize: MUI_SPEC.type.h5, lineHeight: MUI_SPEC.lineHeight.heading, fontWeight: 800, letterSpacing: "-.01em" },
  h6: { fontSize: MUI_SPEC.type.h6, lineHeight: MUI_SPEC.lineHeight.heading, fontWeight: 700, letterSpacing: "-.01em" },
  body1: { fontSize: MUI_SPEC.type.body1, lineHeight: MUI_SPEC.lineHeight.body },
  body2: { fontSize: MUI_SPEC.type.body2, lineHeight: MUI_SPEC.lineHeight.body },
  caption: { fontSize: MUI_SPEC.type.caption, lineHeight: 1.4 },
};
