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
