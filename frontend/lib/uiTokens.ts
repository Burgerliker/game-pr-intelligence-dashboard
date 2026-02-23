/**
 * UI Tokens - Nexon PR Dashboard Design System
 * 라이트 모드 기반 깔끔한 디자인 시스템
 */

// ============================================
// 1. COLOR PALETTE
// ============================================

export const colors = {
  // Primary
  primary: {
    50: "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#3B82F6",
    600: "#2563EB",
    700: "#1D4ED8",
    800: "#1E40AF",
    900: "#1E3A8A",
  },

  // Slate (Neutral)
  slate: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
  },

  // Semantic - Status
  status: {
    success: {
      light: "#D1FAE5",
      main: "#10B981",
      dark: "#059669",
      text: "#047857",
    },
    warning: {
      light: "#FEF3C7",
      main: "#F59E0B",
      dark: "#D97706",
      text: "#B45309",
    },
    error: {
      light: "#FEE2E2",
      main: "#EF4444",
      dark: "#DC2626",
      text: "#B91C1C",
    },
    info: {
      light: "#DBEAFE",
      main: "#3B82F6",
      dark: "#2563EB",
      text: "#1D4ED8",
    },
  },

  // Brand Colors (Nexon IPs)
  brand: {
    nexon: {
      primary: "#0F3B66",
      accent: "#3B82F6",
    },
    maplestory: {
      primary: "#EA580C",
      accent: "#FB923C",
      bg: "#FFF7ED",
      border: "#FDBA74",
    },
    dnf: {
      primary: "#A45B73",
      accent: "#F2AEBD",
    },
    bluearchive: {
      primary: "#5F72AD",
      accent: "#B6C8F2",
    },
    fconline: {
      primary: "#3E8D67",
      accent: "#B7E3CD",
    },
  },

  // Chart Colors
  chart: {
    blue: "#2F67D8",
    green: "#11A36A",
    yellow: "#F2B248",
    red: "#DC3C4A",
    purple: "#7B61FF",
    cyan: "#00A5C4",
  },

  // Background
  background: {
    page: "linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)",
    card: "#FFFFFF",
    elevated: "#FFFFFF",
    muted: "#F8FAFC",
  },
} as const;

// ============================================
// 2. TYPOGRAPHY
// ============================================

export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',

  // Font Sizes
  size: {
    xs: "11px",
    sm: "12px",
    base: "14px",
    md: "15px",
    lg: "16px",
    xl: "18px",
    "2xl": "20px",
    "3xl": "24px",
    "4xl": "30px",
    "5xl": "36px",
    "6xl": "48px",
    "7xl": "56px",
  },

  // Font Weights
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  // Line Heights
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.625,
  },
} as const;

// ============================================
// 3. SPACING & SIZING
// ============================================

export const spacing = {
  0: "0px",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
} as const;

export const borderRadius = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "20px",
  "3xl": "24px",
  full: "9999px",
} as const;

// ============================================
// 4. SHADOWS
// ============================================

export const shadows = {
  none: "none",
  xs: "0 1px 2px rgba(15, 23, 42, 0.04)",
  sm: "0 1px 3px rgba(15, 23, 42, 0.05)",
  md: "0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.05)",
  lg: "0 4px 12px rgba(15, 23, 42, 0.05)",
  xl: "0 8px 24px rgba(15, 23, 42, 0.06)",
  "2xl": "0 12px 32px rgba(15, 23, 42, 0.08)",
  card: "0 1px 3px rgba(15, 23, 42, 0.05)",
  cardHover: "0 4px 12px rgba(15, 23, 42, 0.08)",
  button: "0 1px 2px rgba(15, 23, 42, 0.05)",
  buttonHover: "0 4px 8px rgba(15, 23, 42, 0.1)",
} as const;

// ============================================
// 5. MUI SX TOKENS (기존 호환성 유지)
// ============================================

export const pageShellCleanSx = {
  minHeight: "100vh",
  background: colors.background.page,
  py: { xs: 2, sm: 2.5, md: 4 },
} as const;

export const pageShellSx = {
  minHeight: "100vh",
  bgcolor: colors.slate[100],
} as const;

export const pageContainerSx = {
  px: { xs: 2, sm: 3, md: 4 },
} as const;

export const sectionCardSx = {
  borderRadius: "20px",
  border: `1px solid ${colors.slate[200]}`,
  boxShadow: shadows.card,
  bgcolor: colors.background.card,
  overflow: "hidden",
  transition: "box-shadow 0.2s ease",
  "&:hover": {
    boxShadow: shadows.cardHover,
  },
} as const;

export const contentCardSx = {
  p: { xs: 2.5, sm: 3, md: 3.5 },
} as const;

export const panelPaperSx = {
  borderRadius: "16px",
  border: `1px solid ${colors.slate[200]}`,
  bgcolor: colors.background.card,
  p: { xs: 2, sm: 2.5, md: 3 },
} as const;

export const subPanelSx = {
  borderRadius: "12px",
  border: `1px solid ${colors.slate[200]}`,
  bgcolor: colors.background.muted,
  p: { xs: 1.5, sm: 2, md: 2.5 },
} as const;

export const metricCardSx = {
  borderRadius: "20px",
  border: `1px solid ${colors.slate[200]}`,
  bgcolor: colors.background.card,
  boxShadow: shadows.card,
  p: { xs: 2, md: 2.5 },
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  minHeight: { xs: 140, md: 160 },
} as const;

export const crisisCardSx = {
  ...metricCardSx,
  p: { xs: 2.5, md: 3 },
  minHeight: { xs: 180, md: 200 },
} as const;

export const metricValueSx = {
  fontSize: { xs: 36, md: 42 },
  fontWeight: typography.weight.extrabold,
  lineHeight: typography.lineHeight.tight,
  color: colors.slate[800],
} as const;

export const crisisValueSx = {
  fontSize: { xs: 48, md: 56 },
  fontWeight: typography.weight.extrabold,
  lineHeight: 1,
} as const;

export const sectionTitleSx = {
  fontSize: { xs: 16, md: 18 },
  fontWeight: typography.weight.bold,
  color: colors.slate[800],
  mb: 2,
} as const;

export const specTypeSx = {
  h1: {
    fontSize: { xs: 32, md: 40 },
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.tight,
    color: colors.slate[900],
  },
  h2: {
    fontSize: { xs: 28, md: 36 },
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.tight,
    color: colors.slate[900],
  },
  h3: {
    fontSize: { xs: 24, md: 30 },
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.snug,
    color: colors.slate[800],
  },
  h4: {
    fontSize: { xs: 20, md: 24 },
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.snug,
    color: colors.slate[800],
  },
  h5: {
    fontSize: { xs: 18, md: 20 },
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.snug,
    color: colors.slate[700],
  },
  h6: {
    fontSize: { xs: 16, md: 18 },
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.normal,
    color: colors.slate[700],
  },
  body1: {
    fontSize: 15,
    fontWeight: typography.weight.normal,
    lineHeight: typography.lineHeight.relaxed,
    color: colors.slate[600],
  },
  body2: {
    fontSize: 14,
    fontWeight: typography.weight.normal,
    lineHeight: typography.lineHeight.normal,
    color: colors.slate[500],
  },
  caption: {
    fontSize: 12,
    fontWeight: typography.weight.normal,
    lineHeight: typography.lineHeight.normal,
    color: colors.slate[400],
  },
  label: {
    fontSize: 14,
    fontWeight: typography.weight.semibold,
    color: colors.slate[600],
  },
} as const;

// ============================================
// 6. CHIP STYLES
// ============================================

export const filterChipSx = {
  height: 28,
  borderRadius: "8px",
  border: `1px solid ${colors.slate[200]}`,
  bgcolor: colors.background.muted,
  color: colors.slate[600],
  fontSize: 12,
  fontWeight: typography.weight.medium,
  "& .MuiChip-label": {
    px: 1.5,
  },
  "&:hover": {
    bgcolor: colors.slate[100],
  },
} as const;

export const statusChipSx = {
  height: 26,
  borderRadius: "6px",
  border: `1px solid ${colors.slate[200]}`,
  bgcolor: "transparent",
  color: colors.slate[500],
  fontSize: 12,
  fontWeight: typography.weight.medium,
} as const;

export const deltaChipSx = {
  height: 24,
  borderRadius: "6px",
  border: "none",
  fontSize: 12,
  fontWeight: typography.weight.semibold,
  "& .MuiChip-label": {
    px: 1,
  },
} as const;

export const brandChipSx = {
  height: 24,
  borderRadius: "20px",
  fontSize: 12,
  fontWeight: typography.weight.semibold,
  letterSpacing: "0.5px",
} as const;

export const alertChipStyles = {
  critical: {
    bgcolor: colors.status.error.light,
    color: colors.status.error.text,
    border: "none",
    fontWeight: typography.weight.bold,
  },
  warning: {
    bgcolor: colors.status.warning.light,
    color: colors.status.warning.text,
    border: "none",
    fontWeight: typography.weight.bold,
  },
  safe: {
    bgcolor: colors.status.success.light,
    color: colors.status.success.text,
    border: "none",
    fontWeight: typography.weight.bold,
  },
} as const;

// ============================================
// 7. BUTTON STYLES
// ============================================

export const navButtonSx = {
  borderRadius: "12px",
  border: `1px solid ${colors.slate[200]}`,
  bgcolor: colors.background.card,
  color: colors.slate[600],
  fontSize: 14,
  fontWeight: typography.weight.medium,
  px: 2,
  py: 1,
  boxShadow: shadows.button,
  textTransform: "none",
  "&:hover": {
    bgcolor: colors.slate[50],
    boxShadow: shadows.buttonHover,
  },
} as const;

export const actionButtonSx = {
  primary: {
    ...navButtonSx,
    bgcolor: colors.slate[900],
    borderColor: colors.slate[900],
    color: "#fff",
    "&:hover": {
      bgcolor: colors.slate[800],
      borderColor: colors.slate[800],
      boxShadow: shadows.buttonHover,
    },
  },
  secondary: {
    ...navButtonSx,
  },
} as const;

export const iconButtonSx = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  border: `1px solid ${colors.slate[200]}`,
  bgcolor: "rgba(255,255,255,0.92)",
  color: colors.slate[800],
  boxShadow: shadows.md,
  transition: "all 0.2s ease",
  "&:hover": {
    bgcolor: colors.background.card,
    transform: "translateY(-1px)",
    boxShadow: shadows.lg,
  },
  "&.Mui-disabled": {
    color: colors.slate[400],
    borderColor: colors.slate[200],
    boxShadow: "none",
  },
} as const;

// ============================================
// 8. RISK ACCENT COLORS
// ============================================

export const riskAccent = {
  critical: {
    color: colors.status.error.main,
    bg: colors.status.error.light,
    text: colors.status.error.text,
    gradient: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
  },
  high: {
    color: colors.status.warning.main,
    bg: colors.status.warning.light,
    text: colors.status.warning.text,
    gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
  },
  caution: {
    color: colors.status.info.main,
    bg: colors.status.info.light,
    text: colors.status.info.text,
    gradient: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
  },
  safe: {
    color: colors.status.success.main,
    bg: colors.status.success.light,
    text: colors.status.success.text,
    gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  },
  neutral: {
    color: colors.slate[500],
    bg: colors.slate[100],
    text: colors.slate[600],
    gradient: "linear-gradient(135deg, #94A3B8 0%, #64748B 100%)",
  },
} as const;

// ============================================
// 9. PROGRESS BAR STYLES
// ============================================

export const progressBarSx = {
  height: 8,
  borderRadius: "4px",
  bgcolor: colors.slate[100],
  overflow: "hidden",
} as const;

export const riskProgressGradient = "linear-gradient(90deg, #10B981 0%, #F59E0B 50%, #EF4444 100%)";

// ============================================
// 10. GRID LAYOUTS
// ============================================

export const gridLayouts = {
  statsGrid: {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", lg: "1.5fr 1fr 1fr 1fr" },
    gap: { xs: 1.5, md: 2 },
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
    gap: { xs: 1.5, md: 2 },
  },
  threeColumn: {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
    gap: { xs: 1, md: 1.5 },
  },
  fourColumn: {
    display: "grid",
    gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
    gap: { xs: 1, md: 1.5 },
  },
} as const;

// ============================================
// 11. ICON STYLES
// ============================================

export const iconToken = {
  size: 16,
  strokeWidth: 2,
  color: "currentColor",
} as const;

export const iconProps = (overrides?: Partial<typeof iconToken>) => ({
  ...iconToken,
  ...overrides,
});

export const inlineIconSx = {
  display: "inline-flex",
  verticalAlign: "middle",
  marginRight: "6px",
} as const;

export const iconBgSx = (color: string, bgColor: string) => ({
  width: 36,
  height: 36,
  borderRadius: "10px",
  bgcolor: bgColor,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: color,
}) as const;

// ============================================
// 12. STAT CARD PRESETS
// ============================================

export const statCardPresets = {
  volume: {
    label: "24h 보도량",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
  },
  cluster: {
    label: "이슈 분류",
    color: "#8B5CF6",
    bgColor: "#F5F3FF",
  },
  monthly: {
    label: "월간 기사",
    color: "#06B6D4",
    bgColor: "#ECFEFF",
  },
  outlet: {
    label: "언론사",
    color: "#EC4899",
    bgColor: "#FDF2F8",
  },
} as const;

// ============================================
// 13. TOP ISSUE CARD STYLES
// ============================================

export const topIssueCardSx = (isHigh: boolean) => ({
  p: 1.5,
  borderRadius: "12px",
  border: `1px solid ${isHigh ? "#FECACA" : colors.slate[200]}`,
  bgcolor: isHigh ? "#FEF2F2" : colors.background.muted,
}) as const;

export const topIssueBadgeSx = (isHigh: boolean) => ({
  width: 26,
  height: 26,
  borderRadius: "8px",
  background: isHigh
    ? "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)"
    : "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
  color: "#FFFFFF",
  fontSize: 13,
  fontWeight: typography.weight.bold,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}) as const;

// ============================================
// 14. ANIMATION & TRANSITION
// ============================================

export const transitions = {
  fast: "all 0.15s ease",
  normal: "all 0.2s ease",
  slow: "all 0.3s ease",
} as const;

// ============================================
// 15. UTILITY FUNCTIONS
// ============================================

export const getCrisisColor = (score: number) => {
  if (score >= 70) return riskAccent.critical;
  if (score >= 45) return riskAccent.high;
  if (score >= 20) return riskAccent.caution;
  return riskAccent.safe;
};

export const getDeltaTone = (value: number) => {
  if (value > 0) return { bg: colors.status.error.light, color: colors.status.error.text };
  if (value < 0) return { bg: colors.status.success.light, color: colors.status.success.text };
  return { bg: colors.slate[200], color: colors.slate[600] };
};

export const toSignedText = (value: number, fractionDigits = 0) => {
  const fixed = value.toFixed(fractionDigits);
  if (value > 0) return `+${fixed}`;
  return fixed;
};

export const getAlertInfo = (level: string) => {
  const normalized = level.toUpperCase();
  if (normalized === "P1") return { label: "심각", desc: "위기 지수 70 이상", ...alertChipStyles.critical };
  if (normalized === "P2") return { label: "주의", desc: "위기 지수 45~69", ...alertChipStyles.warning };
  return { label: "관심", desc: "위기 지수 0~44", ...alertChipStyles.safe };
};

// ============================================
// 16. MUI SPEC (기존 호환성)
// ============================================

export const MUI_SPEC = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  type: {
    h3: 48,
    h4: 34,
  },
} as const;

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  pageShellSx,
  pageShellCleanSx,
  pageContainerSx,
  sectionCardSx,
  contentCardSx,
  panelPaperSx,
  subPanelSx,
  metricCardSx,
  crisisCardSx,
  metricValueSx,
  crisisValueSx,
  sectionTitleSx,
  specTypeSx,
  filterChipSx,
  statusChipSx,
  deltaChipSx,
  brandChipSx,
  alertChipStyles,
  actionButtonSx,
  navButtonSx,
  iconButtonSx,
  riskAccent,
  progressBarSx,
  riskProgressGradient,
  gridLayouts,
  iconToken,
  iconProps,
  inlineIconSx,
  iconBgSx,
  statCardPresets,
  topIssueCardSx,
  topIssueBadgeSx,
  transitions,
  getCrisisColor,
  getDeltaTone,
  toSignedText,
  getAlertInfo,
  MUI_SPEC,
};
