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
    // ECharts palette
    palette: ["#2F67D8", "#11A36A", "#F2B248", "#DC3C4A", "#7B61FF", "#00A5C4"],
  },

  // Progress bar
  progress: {
    track: "#EDF2FB",
    gradient: "linear-gradient(90deg, #10B981 0%, #F59E0B 50%, #EF4444 100%)",
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
// 1-B. IP BANNER STYLE MAP
// ============================================

export const IP_BANNER_STYLE = {
  all: {
    kicker: "NEXON OVERVIEW",
    accent: "#8db5ee",
    bg: "#5f89bd",
    glow: "none",
  },
  maplestory: {
    kicker: "MAPLESTORY",
    accent: "#f2cb89",
    bg: "#a5692f",
    glow: "none",
  },
  dnf: {
    kicker: "DNF",
    accent: "#f2aebd",
    bg: "#a45b73",
    glow: "none",
  },
  arcraiders: {
    kicker: "ARC RAIDERS",
    accent: "#a7dff0",
    bg: "#3b889b",
    glow: "none",
  },
  bluearchive: {
    kicker: "BLUE ARCHIVE",
    accent: "#b6c8f2",
    bg: "#5f72ad",
    glow: "none",
  },
  fconline: {
    kicker: "FC ONLINE",
    accent: "#b7e3cd",
    bg: "#3e8d67",
    glow: "none",
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

// Page Shell
export const pageShellCleanSx = {
  minHeight: "100vh",
  background: colors.background.page,
  py: { xs: 2, sm: 2.5, md: 4 },
} as const;

// Alias for backward compatibility
export const pageShellSx = pageShellCleanSx;

// Page Container
export const pageContainerSx = {
  px: { xs: 2, sm: 3, md: 4 },
} as const;

// Section Card (주요 섹션 카드)
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

// Content Card (카드 내부 패딩)
export const contentCardSx = {
  p: { xs: 2.5, sm: 3, md: 3.5 },
} as const;

// Panel Paper (서브 패널)
export const panelPaperSx = {
  borderRadius: "16px",
  border: `1px solid ${colors.slate[200]}`,
  bgcolor: colors.background.card,
  p: { xs: 2, sm: 2.5, md: 3 },
} as const;

// Sub Panel (더 작은 내부 패널)
export const subPanelSx = {
  borderRadius: "12px",
  border: `1px solid ${colors.slate[200]}`,
  bgcolor: colors.background.muted,
  p: { xs: 1.5, sm: 2, md: 2.5 },
} as const;

// Metric Card (지표 카드)
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

// Crisis Card (위기 지수 카드 - 강조)
export const crisisCardSx = {
  ...metricCardSx,
  p: { xs: 2.5, md: 3 },
  minHeight: { xs: 180, md: 200 },
} as const;

// Metric Value (큰 숫자 표시)
export const metricValueSx = {
  fontSize: { xs: 36, md: 42 },
  fontWeight: typography.weight.extrabold,
  lineHeight: typography.lineHeight.tight,
  color: colors.slate[800],
} as const;

// Crisis Value (위기 지수 숫자 - 더 큼)
export const crisisValueSx = {
  fontSize: { xs: 48, md: 56 },
  fontWeight: typography.weight.extrabold,
  lineHeight: 1,
} as const;

// Section Title
export const sectionTitleSx = {
  fontSize: { xs: 16, md: 18 },
  fontWeight: typography.weight.bold,
  color: colors.slate[800],
  mb: 2,
} as const;

// Typography Specs
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

// Filter Chip (필터/컨트롤용)
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

// Status Chip (상태 표시용)
export const statusChipSx = {
  height: 26,
  borderRadius: "6px",
  border: `1px solid ${colors.slate[200]}`,
  bgcolor: "transparent",
  color: colors.slate[500],
  fontSize: 12,
  fontWeight: typography.weight.medium,
} as const;

// Delta Chip (변화량 표시)
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

// Brand Chip (브랜드/태그용)
export const brandChipSx = {
  height: 24,
  borderRadius: "20px",
  fontSize: 12,
  fontWeight: typography.weight.semibold,
  letterSpacing: "0.5px",
} as const;

// Brand Chip with Gradient (IP별 그라데이션 칩)
export const brandChipGradientSx = {
  maplestory: {
    ...brandChipSx,
    background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)",
    color: "#FFFFFF",
    border: "none",
    px: 1.5,
    py: 0.5,
  },
  dnf: {
    ...brandChipSx,
    background: "linear-gradient(135deg, #A45B73 0%, #F2AEBD 100%)",
    color: "#FFFFFF",
    border: "none",
    px: 1.5,
    py: 0.5,
  },
  bluearchive: {
    ...brandChipSx,
    background: "linear-gradient(135deg, #5F72AD 0%, #B6C8F2 100%)",
    color: "#FFFFFF",
    border: "none",
    px: 1.5,
    py: 0.5,
  },
  fconline: {
    ...brandChipSx,
    background: "linear-gradient(135deg, #3E8D67 0%, #B7E3CD 100%)",
    color: "#FFFFFF",
    border: "none",
    px: 1.5,
    py: 0.5,
  },
  arcraiders: {
    ...brandChipSx,
    background: "linear-gradient(135deg, #3B889B 0%, #A7DFF0 100%)",
    color: "#FFFFFF",
    border: "none",
    px: 1.5,
    py: 0.5,
  },
  nexon: {
    ...brandChipSx,
    background: "linear-gradient(135deg, #0F3B66 0%, #3B82F6 100%)",
    color: "#FFFFFF",
    border: "none",
    px: 1.5,
    py: 0.5,
  },
} as const;

// IP별 그라데이션 가져오기 헬퍼
export const getBrandChipSx = (ipId: string) => {
  const key = ipId.toLowerCase().replace(/[^a-z]/g, "");
  return brandChipGradientSx[key as keyof typeof brandChipGradientSx] || brandChipGradientSx.nexon;
};

// Alert Level Chips
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

// Nav Button (네비게이션용)
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

// Icon Button (원형)
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

// Banner Pager Button (배너 좌우 이동)
export const bannerPagerBtnSx = {
  width: 42,
  height: 42,
  borderRadius: 99,
  border: "1px solid rgba(15,23,42,.14)",
  color: colors.slate[900],
  bgcolor: "rgba(255,255,255,.92)",
  boxShadow: "0 8px 18px rgba(15,23,42,.12)",
  transition: "all .2s ease",
  "&:hover": {
    bgcolor: "#fff",
    transform: "translateY(-1px)",
    boxShadow: "0 12px 24px rgba(15,23,42,.16)",
  },
  "&.Mui-disabled": {
    color: colors.slate[400],
    borderColor: "rgba(148,163,184,.35)",
    boxShadow: "none",
  },
} as const;

// Action Button (CTA용)
export const actionButtonSx = {
  primary: {
    borderRadius: "12px",
    bgcolor: colors.brand.nexon.primary,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: typography.weight.semibold,
    px: 2.5,
    py: 1.25,
    textTransform: "none",
    boxShadow: shadows.md,
    "&:hover": {
      bgcolor: colors.primary[800],
      boxShadow: shadows.lg,
    },
  },
  secondary: {
    borderRadius: "12px",
    border: `1px solid ${colors.slate[200]}`,
    bgcolor: colors.background.card,
    color: colors.slate[700],
    fontSize: 14,
    fontWeight: typography.weight.medium,
    px: 2.5,
    py: 1.25,
    textTransform: "none",
    boxShadow: shadows.button,
    "&:hover": {
      bgcolor: colors.slate[50],
      borderColor: colors.slate[300],
      boxShadow: shadows.buttonHover,
    },
  },
} as const;

// ============================================
// 8. PAGINATION STYLES
// ============================================

export const paginationTrackSx = {
  px: 1.2,
  py: 0.9,
  borderRadius: 99,
  borderColor: "rgba(15,23,42,.14)",
  backgroundColor: colors.slate[50],
} as const;

export const paginationDotSx = (active: boolean) => ({
  width: active ? 26 : 10,
  height: 10,
  borderRadius: 999,
  bgcolor: active ? colors.primary[600] : "rgba(100,116,139,.35)",
  transition: "all .2s ease",
}) as const;

// ============================================
// 8. RISK ACCENT COLORS
// ============================================

export const riskAccent = {
  critical: {
    color: colors.status.error.main,
    bg: colors.status.error.light,
    text: colors.status.error.text,
    border: "#FECACA",
    gradient: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
  },
  high: {
    color: colors.status.warning.main,
    bg: colors.status.warning.light,
    text: colors.status.warning.text,
    border: "#FDE68A",
    gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
  },
  caution: {
    color: colors.status.info.main,
    bg: colors.status.info.light,
    text: colors.status.info.text,
    border: "#BFDBFE",
    gradient: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
  },
  safe: {
    color: colors.status.success.main,
    bg: colors.status.success.light,
    text: colors.status.success.text,
    border: "#BBF7D0",
    gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  },
  // Neutral (호환성 유지용)
  neutral: {
    color: colors.slate[500],
    bg: colors.slate[100],
    text: colors.slate[600],
    border: colors.slate[300],
    gradient: "linear-gradient(135deg, #94A3B8 0%, #64748B 100%)",
  },
} as const;

// ============================================
// 9. PROGRESS BAR STYLES
// ============================================

export const progressBarSx = {
  height: 8,
  borderRadius: "4px",
  bgcolor: colors.progress.track,
  overflow: "hidden",
} as const;

export const riskProgressGradient = colors.progress.gradient;

// Linear Progress MUI style
export const linearProgressSx = {
  height: 10,
  borderRadius: 999,
  bgcolor: colors.progress.track,
  "& .MuiLinearProgress-bar": {
    bgcolor: colors.chart.blue,
  },
} as const;

// ============================================
// 10. ECHARTS CONFIG TOKENS
// ============================================

export const echartsTokens = {
  // 공통 그리드
  grid: {
    default: { left: 38, right: 20, top: 26, bottom: 38 },
    horizontal: { left: 90, right: 20, top: 26, bottom: 24 },
  },

  // 축 라벨 색상
  axisLabel: {
    color: colors.slate[500],
  },

  // 시리즈 색상
  series: {
    bar: colors.chart.blue,
    barRadius: [4, 4, 0, 0],
    line: colors.chart.red,
    positive: colors.chart.green,
    neutral: colors.chart.yellow,
    negative: colors.chart.red,
  },

  // 트리맵 팔레트
  treemapPalette: [
    colors.chart.blue,
    colors.chart.green,
    colors.chart.yellow,
    colors.chart.red,
    "#4A63D9",
    colors.chart.cyan,
  ],
} as const;

// ECharts 옵션 헬퍼
export const getEchartsAxisStyle = () => ({
  axisLabel: { color: colors.slate[500] },
  axisLine: { lineStyle: { color: colors.slate[300] } },
  splitLine: { lineStyle: { color: colors.slate[200] } },
});

export const getEchartsBarStyle = (customColor?: string) => ({
  color: customColor || colors.chart.blue,
  borderRadius: [4, 4, 0, 0],
});

export const getEchartsLineStyle = (customColor?: string) => ({
  color: customColor || colors.chart.red,
  width: 2,
});

// ============================================
// 10. GRID LAYOUTS
// ============================================

export const gridLayouts = {
  // 메인 스탯 카드 그리드 (위기지수 강조)
  statsGrid: {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", lg: "1.5fr 1fr 1fr 1fr" },
    gap: { xs: 1.5, md: 2 },
  },
  // 2열 그리드
  twoColumn: {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
    gap: { xs: 1.5, md: 2 },
  },
  // 3열 그리드
  threeColumn: {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
    gap: { xs: 1, md: 1.5 },
  },
  // 4열 그리드
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

// Icon Background (아이콘 배경 박스)
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
    key: "volume",
    label: "24h 보도량",
    unit: "건",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
    iconName: "Newspaper" as const,
  },
  cluster: {
    key: "cluster",
    label: "이슈 분류",
    unit: "개",
    color: "#8B5CF6",
    bgColor: "#F5F3FF",
    iconName: "Tag" as const,
  },
  monthly: {
    key: "monthly",
    label: "월간 기사",
    unit: "건",
    color: "#06B6D4",
    bgColor: "#ECFEFF",
    iconName: "FileText" as const,
  },
  outlet: {
    key: "outlet",
    label: "언론사",
    unit: "개",
    color: "#EC4899",
    bgColor: "#FDF2F8",
    iconName: "Globe" as const,
  },
} as const;

// statCards 배열 생성 헬퍼
export const createStatCards = (data: {
  volume: { value: number; delta: number };
  cluster: { value: number; delta: number };
  monthly: { value: number; delta: number };
}) => [
  { ...statCardPresets.volume, value: data.volume.value, delta: data.volume.delta },
  { ...statCardPresets.cluster, value: data.cluster.value, delta: data.cluster.delta },
  { ...statCardPresets.monthly, value: data.monthly.value, delta: data.monthly.delta },
];

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

/**
 * 위기 지수에 따른 색상 반환
 */
export const getCrisisColor = (score: number) => {
  if (score >= 70) return riskAccent.critical;
  if (score >= 45) return riskAccent.high;
  if (score >= 20) return riskAccent.caution;
  return riskAccent.safe;
};

/**
 * 델타값에 따른 톤 반환 (아이콘 이름 포함)
 */
export const getDeltaTone = (value: number) => {
  const num = Number(value || 0);
  if (num > 0) return {
    bg: colors.status.error.light,
    color: colors.status.error.text,
    iconName: "TrendingUp" as const,
  };
  if (num < 0) return {
    bg: colors.status.success.light,
    color: colors.status.success.text,
    iconName: "TrendingDown" as const,
  };
  return {
    bg: colors.slate[200],
    color: colors.slate[600],
    iconName: null,
  };
};

/**
 * 부호 포함 텍스트 변환
 */
export const toSignedText = (value: number, fractionDigits = 0) => {
  const fixed = value.toFixed(fractionDigits);
  if (value > 0) return `+${fixed}`;
  return fixed;
};

/**
 * Alert Level 정보 반환
 */
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
  // Typography sizes (MUI 기본 사이즈 참조용)
  type: {
    h1: 96,
    h2: 60,
    h3: 48,
    h4: 34,
    h5: 24,
    h6: 20,
    subtitle1: 16,
    subtitle2: 14,
    body1: 16,
    body2: 14,
    caption: 12,
    overline: 12,
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
  // IP Banner
  IP_BANNER_STYLE,
  // SX Tokens
  pageShellCleanSx,
  pageShellSx,
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
  // Chips
  filterChipSx,
  statusChipSx,
  deltaChipSx,
  brandChipSx,
  brandChipGradientSx,
  getBrandChipSx,
  alertChipStyles,
  // Buttons
  navButtonSx,
  iconButtonSx,
  bannerPagerBtnSx,
  actionButtonSx,
  // Pagination
  paginationTrackSx,
  paginationDotSx,
  // Risk
  riskAccent,
  progressBarSx,
  riskProgressGradient,
  linearProgressSx,
  // Layouts
  gridLayouts,
  // Icons
  iconToken,
  iconProps,
  inlineIconSx,
  iconBgSx,
  // Presets
  statCardPresets,
  createStatCards,
  topIssueCardSx,
  topIssueBadgeSx,
  // ECharts
  echartsTokens,
  getEchartsAxisStyle,
  getEchartsBarStyle,
  getEchartsLineStyle,
  // Transitions
  transitions,
  // Utils
  getCrisisColor,
  getDeltaTone,
  toSignedText,
  getAlertInfo,
  MUI_SPEC,
};
